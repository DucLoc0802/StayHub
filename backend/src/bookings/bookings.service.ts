import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, BookingStatus, PaymentMethod, PaymentStatus, Prisma, PropertyStatus } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { calculateBookingPricing } from './booking-rules';

const detailInclude = { property: { include: { images: { orderBy: { sortOrder: 'asc' as const }, take: 1 } } }, payments: { orderBy: { createdAt: 'desc' as const } } };

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(user: AuthUser, dto: CreateBookingDto) {
    const checkIn = this.date(dto.checkIn); const checkOut = this.date(dto.checkOut);
    const nights = this.nights(checkIn, checkOut);
    const property = await this.prisma.property.findFirst({ where: { id: dto.propertyId, status: PropertyStatus.ACTIVE } });
    if (!property) throw new NotFoundException('Chỗ nghỉ không tồn tại hoặc đang tạm ngưng.');
    if (dto.guestCount > property.maxGuests) throw new BadRequestException(`Chỗ nghỉ chỉ nhận tối đa ${property.maxGuests} khách.`);
    if (await this.overlap(this.prisma, property.id, checkIn, checkOut)) throw this.conflict();
    const { totalAmount, depositAmount, remainingAmount } = calculateBookingPricing(property.pricePerNight, property.depositPercent, nights);
    return this.prisma.booking.create({ data: { guestId: user.id, propertyId: property.id, checkIn, checkOut, guestCount: dto.guestCount, nightlyPriceSnapshot: property.pricePerNight, totalNights: nights, totalAmount, depositPercentSnapshot: property.depositPercent, depositAmount, remainingAmount }, include: detailInclude });
  }
  my(user: AuthUser) { return this.prisma.booking.findMany({ where: { guestId: user.id }, include: detailInclude, orderBy: { createdAt: 'desc' } }); }
  async host(user: AuthUser) {
    if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Tài khoản chủ nhà của bạn chưa được phê duyệt.');
    return this.prisma.booking.findMany({ where: { property: { hostId: user.id } }, include: { ...detailInclude, guest: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async pay(user: AuthUser, id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findFirst({ where: { id, guestId: user.id }, include: { payments: true } });
        if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
        if (booking.status !== BookingStatus.PENDING_PAYMENT) throw new BadRequestException('Đặt phòng này không ở trạng thái chờ thanh toán.');
        if (booking.payments.some((payment) => payment.status === PaymentStatus.SUCCESS)) throw new ConflictException('Tiền cọc đã được thanh toán.');
        if (await this.overlap(tx, booking.propertyId, booking.checkIn, booking.checkOut, booking.id)) throw this.conflict();
        const payment = await tx.payment.create({ data: { bookingId: booking.id, amount: booking.depositAmount, method: PaymentMethod.FAKE, status: PaymentStatus.SUCCESS, paidAt: new Date() } });
        const updated = await tx.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED }, include: detailInclude });
        return { booking: updated, payment };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw this.conflict();
      throw error;
    }
  }
  async cancel(user: AuthUser, id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, guestId: user.id }, include: detailInclude });
    if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
    if (booking.status === BookingStatus.CANCELLED) throw new BadRequestException('Đặt phòng đã được hủy trước đó.');
    return this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.CANCELLED }, include: detailInclude });
  }
  private date(input: string) { const date = new Date(`${input.slice(0, 10)}T00:00:00.000Z`); if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày đặt phòng không hợp lệ.'); return date; }
  private nights(checkIn: Date, checkOut: Date) { const result = (checkOut.getTime() - checkIn.getTime()) / 86400000; if (!Number.isInteger(result) || result < 1) throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.'); return result; }
  private overlap(client: PrismaService | Prisma.TransactionClient, propertyId: string, checkIn: Date, checkOut: Date, excludeId?: string) { return client.booking.findFirst({ where: { propertyId, status: BookingStatus.CONFIRMED, checkIn: { lt: checkOut }, checkOut: { gt: checkIn }, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } }); }
  private conflict() { return new ConflictException('Chỗ nghỉ vừa được người khác đặt trong khoảng thời gian này. Vui lòng chọn ngày khác.'); }
}
