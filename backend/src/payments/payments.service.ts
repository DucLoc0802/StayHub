import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { bookingDates, overlap } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import {
  availabilityConflict,
  bookingInclude,
} from '../bookings/bookings.service';
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}
  pay(id: string, guestId: string) {
    return this.prisma.serializable(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id, guestId },
        include: { payment: true, property: true },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt chỗ.');
      if (booking.status !== 'PENDING_PAYMENT' || booking.payment)
        throw new ConflictException('Đơn đặt chỗ không còn chờ thanh toán.');
      if (booking.property.status !== 'ACTIVE')
        throw new ConflictException('Chỗ nghỉ đang tạm ngưng nhận đặt chỗ.');
      bookingDates(
        booking.checkIn.toISOString().slice(0, 10),
        booking.checkOut.toISOString().slice(0, 10),
        new Date(),
        booking.checkInTimeSnapshot,
      );
      if (
        await tx.booking.findFirst({
          where: overlap(booking.propertyId, booking.checkIn, booking.checkOut),
        })
      )
        throw new ConflictException(availabilityConflict);
      const changed = await tx.booking.updateMany({
        where: { id, guestId, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED' },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Đơn đặt chỗ vừa thay đổi. Vui lòng thử lại.',
        );
      await tx.payment.create({
        data: {
          bookingId: id,
          amount: booking.depositAmount,
          status: 'SUCCESS',
          method: 'FAKE',
          paidAt: new Date(),
        },
      });
      return tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
    });
  }
}
