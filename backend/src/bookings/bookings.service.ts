import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { bookingDates, overlap, priceSnapshot } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './booking.dto';
export const bookingInclude = {
  property: { include: { images: { orderBy: { sortOrder: 'asc' as const } } } },
  payment: true,
} satisfies Prisma.BookingInclude;
export const availabilityConflict =
  'Chỗ nghỉ vừa được người khác đặt trong khoảng thời gian này. Vui lòng chọn ngày khác.';
@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(guestId: string, dto: CreateBookingDto) {
    return this.prisma.serializable(async (tx) => {
      const property = await tx.property.findFirst({
        where: { id: dto.propertyId, status: 'ACTIVE' },
      });
      if (!property)
        throw new NotFoundException('Không tìm thấy chỗ nghỉ đang hoạt động.');
      const dates = bookingDates(
        dto.checkIn,
        dto.checkOut,
        new Date(),
        property.checkInTime,
      );
      if (dto.guestCount > property.maxGuests)
        throw new BadRequestException(
          'Số khách vượt quá sức chứa của chỗ nghỉ.',
        );
      if (
        await tx.booking.findFirst({
          where: overlap(property.id, dates.checkIn, dates.checkOut),
        })
      )
        throw new ConflictException(availabilityConflict);
      return tx.booking.create({
        data: {
          guestId,
          propertyId: property.id,
          guestCount: dto.guestCount,
          checkInTimeSnapshot: property.checkInTime,
          checkOutTimeSnapshot: property.checkOutTime,
          ...dates,
          ...priceSnapshot(
            property.pricePerNight,
            property.depositPercent,
            dates.totalNights,
          ),
        },
        include: bookingInclude,
      });
    });
  }
  mine(guestId: string) {
    return this.prisma.booking.findMany({
      where: { guestId },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
  host(hostId: string) {
    return this.prisma.booking.findMany({
      where: { property: { hostId } },
      include: {
        ...bookingInclude,
        guest: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  cancel(id: string, guestId: string) {
    return this.prisma.serializable(async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, guestId } });
      if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt chỗ.');
      if (booking.status === 'CANCELLED')
        throw new ConflictException('Đơn đặt chỗ đã được hủy.');
      const result = await tx.booking.updateMany({
        where: { id, guestId, status: booking.status },
        data: { status: 'CANCELLED' },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Đơn đặt chỗ vừa thay đổi. Vui lòng thử lại.',
        );
      return tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
    });
  }
}
