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
  pay(id: string, guestId: string) {
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
      if (booking.status !== 'PENDING_PAYMENT' || booking.payment)
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
      await tx.booking.update({ where: { id }, data: { status: 'CONFIRMED' } });
      await tx.payment.create({
        data: {
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
