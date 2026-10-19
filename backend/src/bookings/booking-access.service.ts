import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SessionUser } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { bookingInclude, bookingResponse } from './bookings.service';

export function bookingScope(user: SessionUser): Prisma.BookingWhereInput {
  if (user.role === 'HOST')
    return { roomType: { property: { hostId: user.id } } };
  if (user.role === 'ADMIN') return {};
  return { guestId: user.id };
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
    if (booking.payment?.status !== 'SUCCESS')
      throw new ConflictException(
        'Biên nhận chỉ được cấp khi khoản cọc đã được ghi nhận thành công.',
      );
    return booking;
  }
}
