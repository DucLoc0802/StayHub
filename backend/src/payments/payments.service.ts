import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from '../bookings/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { bookingInclude, bookingResponse } from '../bookings/bookings.service';
import {
  availabilityConflict,
  expiredMessage,
} from '../bookings/booking-policy';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  checkout(id: string, guestId: string) {
    return this.inventory.forGuest(guestId, async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id, guestId },
        include: bookingInclude,
      });
      if (!booking)
        throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
      return { booking: bookingResponse(booking), serverNow: new Date() };
    });
  }

  async pay(id: string, guestId: string) {
    await this.inventory.forGuest(
      guestId,
      async (tx) => {
        // Internal callers cannot impersonate a Guest either.
        const customer = await tx.user.findUnique({
          where: { id: guestId },
          select: { role: true, status: true, archivedAt: true },
        });
        if (
          customer?.role !== 'GUEST' ||
          customer.status !== 'ACTIVE' ||
          customer.archivedAt
        )
          throw new ForbiddenException(
            'Chỉ khách hàng đang hoạt động được thanh toán.',
          );
        const initial = await tx.booking.findFirst({
          where: { id, guestId },
          select: { roomType: { select: { propertyId: true } } },
        });
        if (!initial)
          throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
        await this.inventory.lockProperty(tx, initial.roomType.propertyId);
        const now = new Date();
        await this.inventory.expireGuest(tx, guestId, now);
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id },
          include: { roomType: { include: { property: true } }, payment: true },
        });
        // Retries return the original settlement, even after later cancellation.
        if (booking.payment?.status === 'SUCCESS') return;
        if (booking.status === 'EXPIRED' || booking.paymentDeadlineAt <= now)
          throw new ConflictException(expiredMessage);
        if (booking.status !== 'PENDING_PAYMENT')
          throw new ConflictException('Đơn không còn đủ điều kiện thanh toán.');
        // Never replace any existing historical obligation.
        if (booking.payment)
          throw new ConflictException(
            'Đơn có bản ghi thanh toán lịch sử. Vui lòng liên hệ hỗ trợ.',
          );
        const room = booking.roomType;
        const availability = await this.inventory.availability(
          tx,
          room.id,
          room.totalUnits,
          booking.checkIn,
          booking.checkOut,
          now,
          id,
        );
        if (
          room.status !== 'ACTIVE' ||
          room.property.status !== 'ACTIVE' ||
          room.property.archivedAt ||
          availability.availableUnits < booking.quantity
        )
          throw new ConflictException(availabilityConflict);
        if (booking.paymentDeadlineAt.getTime() <= Date.now()) {
          await this.inventory.expireGuest(tx, guestId, new Date());
          throw new ConflictException(expiredMessage);
        }
        // SERIALIZABLE, user/property locks and Payment.bookingId uniqueness guard
        // concurrent clicks and competing bookings. All writes roll back together.
        await tx.payment.create({
          data: {
            bookingId: id,
            amount: booking.depositAmount,
            status: 'SUCCESS',
            method: 'FAKE',
            paidAt: now,
          },
        });
        await tx.paymentAttempt.create({
          data: {
            bookingId: id,
            amount: booking.depositAmount,
            status: 'SUCCESS',
            method: 'FAKE',
            createdAt: now,
          },
        });
        await tx.booking.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            events: {
              create: [
                {
                  type: 'PAYMENT_SUCCESS',
                  status: 'CONFIRMED',
                  createdAt: now,
                },
                { type: 'CONFIRMED', status: 'CONFIRMED', createdAt: now },
              ],
            },
          },
        });
      },
      20000,
    );
    // Load images, feedback and history after commit instead of keeping locks
    // while repeating the full response queries across a remote database link.
    return bookingResponse(
      await this.prisma.booking.findUniqueOrThrow({
        where: { id, guestId },
        include: bookingInclude,
      }),
    );
  }
}
