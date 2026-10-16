import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from '../bookings/inventory.service';
import { bookingInclude, bookingResponse } from '../bookings/bookings.service';
import {
  availabilityConflict,
  expiredMessage,
} from '../bookings/booking-policy';
@Injectable()
export class PaymentsService {
  constructor(private readonly inventory: InventoryService) {}
  pay(id: string, guestId: string, outcome: 'SUCCESS' | 'FAILED' = 'SUCCESS') {
    return this.inventory.forGuest(guestId, async (tx) => {
      let booking = await tx.booking.findFirst({
        where: { id, guestId },
        include: bookingInclude,
      });
      if (!booking)
        throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
      await this.inventory.lockProperty(tx, booking.roomType.propertyId);
      const now = new Date();
      await this.inventory.expireGuest(tx, guestId, now);
      booking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
      if (booking.status === 'EXPIRED')
        throw new ConflictException(expiredMessage);
      if (
        booking.status === 'CONFIRMED' &&
        booking.payment?.status === 'SUCCESS'
      )
        return bookingResponse(booking); // Idempotent retry after a lost response.
      if (
        booking.status !== 'PENDING_PAYMENT' ||
        booking.payment?.status === 'SUCCESS'
      )
        throw new ConflictException('Đơn đặt phòng không thể thanh toán.');
      if (
        booking.roomType.status !== 'ACTIVE' ||
        booking.roomType.property.status !== 'ACTIVE'
      )
        throw new ConflictException('Loại phòng hiện ngừng nhận đặt chỗ.');
      const { availableUnits } = await this.inventory.availability(
        tx,
        booking.roomTypeId,
        booking.roomType.totalUnits,
        booking.checkIn,
        booking.checkOut,
        now,
        id,
      );
      if (availableUnits < booking.quantity)
        throw new ConflictException(availabilityConflict);
      const paidAt = new Date();
      if (booking.paymentDeadlineAt <= paidAt) {
        await this.inventory.expireGuest(tx, guestId, paidAt);
        throw new ConflictException(expiredMessage);
      }
      await tx.paymentAttempt.create({
        data: {
          bookingId: id,
          amount: booking.depositAmount,
          status: outcome,
          method: 'FAKE',
          failureReason:
            outcome === 'FAILED'
              ? 'Thanh toán demo thất bại. Vui lòng thử lại trước hạn.'
              : null,
          createdAt: paidAt,
        },
      });
      if (outcome === 'FAILED')
        return bookingResponse(
          await tx.booking.findUniqueOrThrow({
            where: { id },
            include: bookingInclude,
          }),
        );
      await tx.booking.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          events: {
            create: {
              type: 'CONFIRMED',
              status: 'CONFIRMED',
              createdAt: paidAt,
            },
          },
        },
      });
      await tx.payment.upsert({
        where: { bookingId: id },
        update: {
          amount: booking.depositAmount,
          status: 'SUCCESS',
          method: 'FAKE',
          paidAt,
        },
        create: {
          bookingId: id,
          amount: booking.depositAmount,
          status: 'SUCCESS',
          method: 'FAKE',
          paidAt,
        },
      });
      return bookingResponse(
        await tx.booking.findUniqueOrThrow({
          where: { id },
          include: bookingInclude,
        }),
      );
    });
  }
}
