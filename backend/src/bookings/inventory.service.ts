import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  bookingPolicy,
  blockedMessage,
  unpaidLimitMessage,
} from './booking-policy';
import { availabilityByNight, heldBookings } from './availability';

@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  private readonly logger = new Logger(InventoryService.name);
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() {
    this.timer = setInterval(
      () => void this.sweep(),
      bookingPolicy.expirationIntervalMs,
    );
    this.timer.unref();
    void this.sweep();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async forGuest<T>(
    guestId: string,
    work: (tx: Prisma.TransactionClient, now: Date) => Promise<T>,
  ): Promise<T> {
    const result = await this.prisma.serializable(async (tx) => {
      // Serialize requests for one guest even when they target different properties.
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM User WHERE id = ${guestId} FOR UPDATE`;
      if (!users.length)
        throw new NotFoundException('Không tìm thấy tài khoản.');
      const now = new Date();
      await this.expireGuest(tx, guestId, now);
      try {
        return { value: await work(tx, now) };
      } catch (error) {
        // Commit lazy expiry/strikes even when the requested payment/booking is rejected.
        // Database failures still throw and roll back the whole transaction.
        if (error instanceof HttpException) return { error };
        throw error;
      }
    });
    if ('error' in result) throw result.error;
    return result.value;
  }
  async lockProperty(tx: Prisma.TransactionClient, propertyId: string) {
    await tx.$queryRaw`SELECT id FROM Property WHERE id = ${propertyId} FOR UPDATE`;
  }
  async expireGuest(tx: Prisma.TransactionClient, guestId: string, now: Date) {
    const overdue = await tx.booking.findMany({
      where: {
        guestId,
        status: 'PENDING_PAYMENT',
        paymentDeadlineAt: { lte: now },
      },
      orderBy: [{ paymentDeadlineAt: 'asc' }, { id: 'asc' }],
    });
    for (const booking of overdue) {
      const changed = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: 'PENDING_PAYMENT',
          paymentDeadlineAt: { lte: now },
        },
        data: { status: 'EXPIRED', expiredAt: booking.paymentDeadlineAt },
      });
      if (!changed.count) continue;
      const user = await tx.user.findUniqueOrThrow({ where: { id: guestId } });
      const eventAt = booking.paymentDeadlineAt;
      const since = new Date(
        eventAt.getTime() - bookingPolicy.expirationPeriodDays * 86400000,
      );
      const count = await tx.booking.count({
        where: {
          guestId,
          status: 'EXPIRED',
          expiredAt: {
            gte: since,
            lte: eventAt,
            ...(user.expirationStrikeResetAt
              ? { gt: user.expirationStrikeResetAt }
              : {}),
          },
        },
      });
      if (count >= bookingPolicy.expirationThreshold) {
        const until = new Date(
          eventAt.getTime() + bookingPolicy.blockDurationHours * 3600000,
        );
        await tx.user.update({
          where: { id: guestId },
          data: {
            bookingBlockedUntil:
              user.bookingBlockedUntil && user.bookingBlockedUntil > until
                ? user.bookingBlockedUntil
                : until,
            expirationStrikeResetAt: eventAt,
          },
        });
      }
    }
  }
  async eligibility(tx: Prisma.TransactionClient, guestId: string, now: Date) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: guestId } });
    const activeUnpaidBookings = await tx.booking.count({
      where: {
        guestId,
        status: 'PENDING_PAYMENT',
        paymentDeadlineAt: { gt: now },
      },
    });
    const bookingBlockedUntil =
      user.bookingBlockedUntil && user.bookingBlockedUntil > now
        ? user.bookingBlockedUntil
        : null;
    return {
      activeUnpaidBookings,
      maxActiveUnpaidBookings: bookingPolicy.maxActiveUnpaidBookings,
      bookingBlockedUntil,
      canBook:
        !bookingBlockedUntil &&
        activeUnpaidBookings < bookingPolicy.maxActiveUnpaidBookings,
    };
  }
  async assertEligible(
    tx: Prisma.TransactionClient,
    guestId: string,
    now: Date,
  ) {
    const state = await this.eligibility(tx, guestId, now);
    if (state.bookingBlockedUntil) throw new ForbiddenException(blockedMessage);
    if (!state.canBook) throw new ConflictException(unpaidLimitMessage);
  }
  async availability(
    tx: Prisma.TransactionClient,
    roomTypeId: string,
    totalUnits: number,
    checkIn: Date,
    checkOut: Date,
    now: Date,
    excludeId?: string,
  ) {
    const bookings = await tx.booking.findMany({
      where: {
        roomTypeId,
        ...heldBookings(now),
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { checkIn: true, checkOut: true, quantity: true },
    });
    return availabilityByNight(totalUnits, bookings, checkIn, checkOut);
  }
  async expireRoomType(roomTypeId: string) {
    const users = await this.prisma.booking.findMany({
      where: {
        roomTypeId,
        status: 'PENDING_PAYMENT',
        paymentDeadlineAt: { lte: new Date() },
      },
      select: { guestId: true },
      distinct: ['guestId'],
    });
    for (const { guestId } of users)
      await this.forGuest(guestId, async () => undefined);
  }
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      // Batches keep the scheduler from holding a long transaction across unrelated guests.
      const due = await this.prisma.booking.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          paymentDeadlineAt: { lte: new Date() },
        },
        select: { guestId: true },
        distinct: ['guestId'],
        take: 100,
        orderBy: { paymentDeadlineAt: 'asc' },
      });
      for (const { guestId } of due)
        await this.forGuest(guestId, async () => undefined);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Không thể xử lý đơn hết hạn.',
      );
    } finally {
      this.sweeping = false;
    }
  }
}
