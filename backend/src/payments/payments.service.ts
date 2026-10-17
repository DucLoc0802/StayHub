import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from '../bookings/inventory.service';
import { bookingInclude, bookingResponse } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { momoConfig } from './momo-config';
import {
  PaymentQueryDto,
  ReviewTransferDto,
  SubmitTransferDto,
} from './payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  async checkout(id: string, guestId: string) {
    return this.inventory.forGuest(guestId, async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id, guestId },
        include: bookingInclude,
      });
      if (!booking)
        throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
      return {
        booking: bookingResponse(booking),
        recipient: momoConfig(),
        serverNow: new Date(),
      };
    });
  }

  async submit(id: string, guestId: string, dto: SubmitTransferDto) {
    const config = momoConfig();
    if (!config.available)
      throw new ServiceUnavailableException(
        'Phương thức thanh toán đang tạm ngừng. Vui lòng liên hệ hỗ trợ.',
      );
    try {
      return await this.inventory.forGuest(guestId, async (tx) => {
        let booking = await tx.booking.findFirst({
          where: { id, guestId },
          include: bookingInclude,
        });
        if (!booking)
          throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
        await this.inventory.lockProperty(tx, booking.roomType.propertyId);
        await this.inventory.expireGuest(tx, guestId, new Date());
        booking = await tx.booking.findUniqueOrThrow({
          where: { id },
          include: bookingInclude,
        });
        const reference = dto.transactionRef.trim().toUpperCase();
        const existing = await tx.paymentAttempt.findUnique({
          where: { transactionRef: reference },
        });
        if (existing) {
          if (existing.bookingId === id) return bookingResponse(booking);
          throw new ConflictException(
            'Mã giao dịch đã được sử dụng. Vui lòng kiểm tra lại.',
          );
        }
        if (booking.payment?.status === 'SUCCESS')
          throw new ConflictException('Đơn đã được thanh toán.');
        if (
          booking.paymentAttempts.some(
            (p) =>
              p.status === 'SUBMITTED' || p.status === 'RESOLUTION_REQUIRED',
          )
        )
          throw new ConflictException(
            'Thông báo chuyển tiền đang được xử lý. Không cần gửi lại.',
          );
        const now = new Date();
        const eligible =
          booking.status === 'PENDING_PAYMENT' &&
          booking.paymentDeadlineAt > now;
        const deadline = new Date(
          Math.min(
            booking.paymentDeadlineAt.getTime(),
            now.getTime() + config.verificationWindowMinutes * 60000,
          ),
        );
        await tx.paymentAttempt.create({
          data: {
            bookingId: id,
            amount: booking.depositAmount,
            method: 'MOMO_MANUAL',
            transactionRef: reference,
            evidenceNote: dto.evidenceNote?.trim() || null,
            status: eligible ? 'SUBMITTED' : 'RESOLUTION_REQUIRED',
            failureReason: eligible
              ? null
              : 'Đơn không còn giữ phòng. Cần kiểm tra tiền nhận và xử lý riêng.',
            verificationDeadlineAt: eligible ? deadline : now,
            receiverNameSnapshot: config.receiverName,
            receiverPhoneSnapshot: config.receiverPhone,
            hostIdSnapshot: booking.roomType.property.hostId,
          },
        });
        await tx.booking.update({
          where: { id },
          data: {
            ...(eligible ? { paymentDeadlineAt: deadline } : {}),
            events: {
              create: {
                type: eligible
                  ? 'PAYMENT_SUBMITTED'
                  : 'PAYMENT_RESOLUTION_REQUIRED',
                status: booking.status,
              },
            },
          },
        });
        return bookingResponse(
          await tx.booking.findUniqueOrThrow({
            where: { id },
            include: bookingInclude,
          }),
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Mã giao dịch đã được sử dụng. Vui lòng kiểm tra lại.',
        );
      throw error;
    }
  }

  async review(attemptId: string, reviewerId: string, dto: ReviewTransferDto) {
    const initial = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: { booking: { select: { guestId: true } } },
    });
    if (!initial)
      throw new NotFoundException('Không tìm thấy thông báo thanh toán.');
    if (dto.decision !== 'VERIFY' && !dto.reason?.trim())
      throw new BadRequestException('Vui lòng ghi lý do xử lý.');
    return this.inventory.forGuest(initial.booking.guestId, async (tx) => {
      const reviewer = await tx.user.findFirst({
        where: { id: reviewerId, role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      if (!reviewer)
        throw new ForbiddenException(
          'Chỉ quản trị viên được xác minh thanh toán.',
        );
      let attempt = await tx.paymentAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: { booking: { include: bookingInclude } },
      });
      if (attempt.method !== 'MOMO_MANUAL')
        throw new ConflictException('Giao dịch cũ chỉ được xem trong lịch sử.');
      await this.inventory.lockProperty(
        tx,
        attempt.booking.roomType.propertyId,
      );
      await this.inventory.expireGuest(tx, initial.booking.guestId, new Date());
      attempt = await tx.paymentAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: { booking: { include: bookingInclude } },
      });
      const booking = attempt.booking,
        now = new Date();
      // A reviewed claim is an audit record. Repeated decisions are safe;
      // a different decision must never erase the first reviewer or reason.
      if (attempt.reviewedAt && attempt.status === 'RESOLUTION_REQUIRED') {
        if (dto.decision === 'RESOLUTION_REQUIRED' || dto.decision === 'VERIFY')
          return bookingResponse(booking);
        throw new ConflictException(
          'Kết quả kiểm tra đã được ghi nhận. Vui lòng xử lý khoản tiền riêng và giữ nguyên lịch sử.',
        );
      }
      if (attempt.status === 'SUCCESS' && dto.decision === 'VERIFY')
        return bookingResponse(booking);
      if (attempt.status === 'SUCCESS' || attempt.status === 'FAILED')
        throw new ConflictException('Thông báo đã được xử lý.');
      let decision = dto.decision;
      let reason = dto.reason?.trim();
      if (decision === 'VERIFY') {
        if (
          dto.receivedAmount !== attempt.amount ||
          dto.verifiedTransactionRef?.trim().toUpperCase() !==
            attempt.transactionRef
        )
          throw new BadRequestException(
            'Số tiền hoặc mã giao dịch thực nhận không khớp. Cần kiểm tra lại hoặc chuyển xử lý riêng.',
          );
        const availability = await this.inventory.availability(
          tx,
          booking.roomTypeId,
          booking.roomType.totalUnits,
          booking.checkIn,
          booking.checkOut,
          now,
          booking.id,
        );
        if (
          booking.payment?.status === 'SUCCESS' ||
          attempt.status !== 'SUBMITTED' ||
          !attempt.verificationDeadlineAt ||
          attempt.verificationDeadlineAt <= now ||
          booking.status !== 'PENDING_PAYMENT' ||
          booking.paymentDeadlineAt <= now ||
          booking.roomType.status !== 'ACTIVE' ||
          booking.roomType.property.status !== 'ACTIVE' ||
          availability.availableUnits < booking.quantity
        ) {
          decision = 'RESOLUTION_REQUIRED';
          reason =
            'Không thể bảo đảm phòng hoặc đã hết hạn xác minh. Kiểm tra khoản tiền nhận và liên hệ khách để xử lý; không tự động hoàn tiền.';
        }
      }
      const status =
        decision === 'VERIFY'
          ? 'SUCCESS'
          : decision === 'REJECT'
            ? 'FAILED'
            : 'RESOLUTION_REQUIRED';
      await tx.paymentAttempt.update({
        where: { id: attemptId },
        data: {
          status,
          reviewedById: reviewerId,
          reviewedAt: now,
          failureReason: reason ?? null,
        },
      });
      if (decision === 'VERIFY') {
        await tx.payment.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            amount: attempt.amount,
            status: 'SUCCESS',
            method: 'MOMO_MANUAL',
            paidAt: now,
          },
          update: {
            amount: attempt.amount,
            status: 'SUCCESS',
            method: 'MOMO_MANUAL',
            paidAt: now,
          },
        });
        await tx.booking.update({
          where: { id: booking.id },
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
      } else
        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            type:
              decision === 'REJECT'
                ? 'PAYMENT_REJECTED'
                : 'PAYMENT_RESOLUTION_REQUIRED',
            status: booking.status,
            createdAt: now,
          },
        });
      return bookingResponse(
        await tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          include: bookingInclude,
        }),
      );
    });
  }

  async list(dto: PaymentQueryDto) {
    await this.inventory.sweep();
    const where: Prisma.PaymentAttemptWhereInput = {
      method: 'MOMO_MANUAL',
      status: dto.status,
    };
    return this.prisma.$transaction(async (tx) => ({
      items: await tx.paymentAttempt.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        include: {
          reviewedBy: { select: { id: true, fullName: true } },
          booking: {
            select: {
              id: true,
              bookingCode: true,
              status: true,
              customerNameSnapshot: true,
              depositAmount: true,
              propertyNameSnapshot: true,
              roomType: {
                select: {
                  property: {
                    select: {
                      id: true,
                      name: true,
                      host: { select: { id: true, fullName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      total: await tx.paymentAttempt.count({ where }),
      page: dto.page,
      limit: dto.limit,
    }));
  }
}
