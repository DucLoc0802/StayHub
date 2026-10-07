import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { SessionUser } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { bookingInclude, bookingResponse } from './bookings.service';

export function bookingScope(user: SessionUser): Prisma.BookingWhereInput {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'HOST' && user.status === 'ACTIVE')
    return { OR: [{ guestId: user.id }, { roomType: { property: { hostId: user.id } } }] };
  return { guestId: user.id };
}
export function demoPaymentPayload(booking: {
  bookingCode: string;
  depositAmount: number;
}) {
  return {
    mode: 'DEMO',
    currency: 'VND',
    amount: booking.depositAmount,
    reference: booking.bookingCode,
    description: `STAYHUB ${booking.bookingCode}`,
  };
}
@Injectable()
export class BookingAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}
  async find(user: SessionUser, where: Prisma.BookingWhereInput) {
    const initial = await this.prisma.booking.findFirst({
      where: { AND: [bookingScope(user), where] },
      select: { guestId: true },
    });
    if (!initial) throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
    return this.inventory.forGuest(initial.guestId, async (tx) => {
      const row = await tx.booking.findFirst({
        where: { AND: [bookingScope(user), where] },
        include: bookingInclude,
      });
      if (!row) throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
      return bookingResponse(row);
    });
  }
  async invoice(user: SessionUser, id: string) {
    const booking = await this.find(user, { id });
    if (booking.status !== 'CONFIRMED' || booking.payment?.status !== 'SUCCESS')
      throw new ConflictException(
        'Chỉ đơn đã xác nhận và thanh toán cọc mới có hóa đơn.',
      );
    return booking;
  }
  async paymentDemo(user: SessionUser, id: string) {
    const booking = await this.find(user, { id });
    if (
      booking.status !== 'PENDING_PAYMENT' ||
      booking.payment ||
      booking.paymentDeadlineAt <= new Date()
    )
      throw new ConflictException('Đơn đặt phòng không thể thanh toán.');
    const payload = demoPaymentPayload(booking);
    return {
      booking,
      payload,
      qrDataUrl: await QRCode.toDataURL(JSON.stringify(payload), {
        width: 280,
        margin: 2,
        errorCorrectionLevel: 'M',
      }),
      serverNow: new Date(),
    };
  }
}
