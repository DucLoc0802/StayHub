import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Property, RoomType } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { profileComplete } from '../common/profile';
import { priceSnapshot } from '../common/domain';
import { PrismaService } from '../prisma/prisma.service';
import {
  AvailabilityQueryDto,
  CreateBookingDto,
  QuoteQueryDto,
} from './booking.dto';
import { InventoryService } from './inventory.service';
import { availabilityByNight, dateRange, heldBookings } from './availability';
import {
  availabilityConflict,
  expiredMessage,
  paymentDeadline,
} from './booking-policy';

export const bookingInclude = {
  roomType: {
    include: {
      property: {
        include: { images: { orderBy: { sortOrder: 'asc' as const } } },
      },
    },
  },
  payment: true,
  feedback: true,
} satisfies Prisma.BookingInclude;
type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
export function bookingResponse<T extends BookingRow>(booking: T) {
  const { property, ...roomType } = booking.roomType;
  return { ...booking, roomType, property };
}
export function validateRoomRequest(
  room: RoomType & { property: Property },
  quantity: number,
  guests: number,
) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > room.totalUnits ||
    (room.property.type === 'HOMESTAY' && quantity !== 1)
  )
    throw new BadRequestException('Số phòng không hợp lệ.');
  if (
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > room.maxGuests * quantity
  )
    throw new BadRequestException(
      'Số khách vượt quá sức chứa của số phòng đã chọn.',
    );
}
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}
  private async activeRoom(tx: Prisma.TransactionClient, id: string) {
    const room = await tx.roomType.findFirst({
      where: { id, status: 'ACTIVE', property: { status: 'ACTIVE' } },
      include: { property: true },
    });
    if (!room)
      throw new NotFoundException('Không tìm thấy loại phòng đang mở bán.');
    return room;
  }
  async propertyCalendar(propertyId: string, dto: AvailabilityQueryDto) {
    const { checkIn, checkOut } = dateRange(dto.checkIn, dto.checkOut);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.findFirst({
        where: { id: propertyId, status: 'ACTIVE' },
        select: {
          roomTypes: {
            where: { status: 'ACTIVE' },
            orderBy: [{ pricePerNight: 'asc' }, { id: 'asc' }],
            select: { id: true, pricePerNight: true, totalUnits: true },
          },
        },
      });
      if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
      const bookings = await tx.booking.findMany({
        where: {
          roomTypeId: { in: property.roomTypes.map((room) => room.id) },
          ...heldBookings(now),
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
        select: { roomTypeId: true, checkIn: true, checkOut: true, quantity: true },
      });
      const occupancy = new Map<string, typeof bookings>();
      for (const booking of bookings) {
        const rows = occupancy.get(booking.roomTypeId) ?? [];
        rows.push(booking);
        occupancy.set(booking.roomTypeId, rows);
      }
      const calendars = property.roomTypes.map((room) => ({
        room,
        days: availabilityByNight(room.totalUnits, occupancy.get(room.id) ?? [], checkIn, checkOut).days,
      }));
      const dates = availabilityByNight(0, [], checkIn, checkOut).days;
      return {
        serverNow: now,
        days: dates.map(({ date }, index) => {
          const chosen = calendars.find((calendar) => calendar.days[index].availableUnits >= 1);
          return {
            date,
            pricePerNight: chosen?.room.pricePerNight ?? null,
            availableUnits: chosen?.days[index].availableUnits ?? 0,
          };
        }),
      };
    });
  }
  async availability(roomTypeId: string, dto: AvailabilityQueryDto) {
    const { checkIn, checkOut } = dateRange(dto.checkIn, dto.checkOut);
    await this.inventory.expireRoomType(roomTypeId);
    const room = await this.activeRoom(this.prisma, roomTypeId);
    const now = new Date();
    return {
      roomTypeId,
      checkIn,
      checkOut,
      totalUnits: room.totalUnits,
      serverNow: now,
      ...(await this.inventory.availability(
        this.prisma,
        roomTypeId,
        room.totalUnits,
        checkIn,
        checkOut,
        now,
      )),
    };
  }
  async quote(roomTypeId: string, dto: QuoteQueryDto) {
    await this.inventory.expireRoomType(roomTypeId);
    const room = await this.activeRoom(this.prisma, roomTypeId);
    const now = new Date();
    const { checkIn, checkOut, totalNights } = dateRange(
      dto.checkIn,
      dto.checkOut,
    );
    validateRoomRequest(room, dto.quantity, dto.guestCount);
    const paymentDeadlineAt = paymentDeadline(
      dto.checkIn,
      room.property.checkInTime,
      room.property.paymentWindowHours,
      now,
    );
    const { availableUnits } = await this.inventory.availability(
      this.prisma,
      roomTypeId,
      room.totalUnits,
      checkIn,
      checkOut,
      now,
    );
    if (availableUnits < dto.quantity)
      throw new ConflictException(availabilityConflict);
    return {
      roomTypeId,
      roomTypeName: room.name,
      quantity: dto.quantity,
      guestCount: dto.guestCount,
      ...priceSnapshot(
        room.pricePerNight,
        room.property.depositPercent,
        totalNights,
        dto.quantity,
      ),
      availableUnits,
      paymentDeadlineAt,
      serverNow: now,
    };
  }
  create(guestId: string, dto: CreateBookingDto) {
    return this.inventory.forGuest(guestId, async (tx) => {
      const customer = await tx.user.findUniqueOrThrow({
        where: { id: guestId },
      });
      if (!profileComplete(customer))
        throw new ForbiddenException(
          'Vui lòng hoàn thiện thông tin cá nhân trước khi đặt phòng.',
        );
      const initial = await this.activeRoom(tx, dto.roomTypeId);
      await this.inventory.lockProperty(tx, initial.propertyId);
      const room = await this.activeRoom(tx, dto.roomTypeId);
      const now = new Date();
      await this.inventory.expireGuest(tx, guestId, now);
      await this.inventory.assertEligible(tx, guestId, now);
      const { checkIn, checkOut, totalNights } = dateRange(
        dto.checkIn,
        dto.checkOut,
      );
      validateRoomRequest(room, dto.quantity, dto.guestCount);
      const paymentDeadlineAt = paymentDeadline(
        dto.checkIn,
        room.property.checkInTime,
        room.property.paymentWindowHours,
        now,
      );
      const duplicate = await tx.booking.findFirst({
        where: {
          guestId,
          roomTypeId: room.id,
          status: 'PENDING_PAYMENT',
          paymentDeadlineAt: { gt: now },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      });
      if (duplicate)
        throw new ConflictException(
          'Bạn đã có đơn chưa thanh toán cho loại phòng này trong khoảng ngày đã chọn.',
        );
      const { availableUnits } = await this.inventory.availability(
        tx,
        room.id,
        room.totalUnits,
        checkIn,
        checkOut,
        now,
      );
      if (availableUnits < dto.quantity)
        throw new ConflictException(availabilityConflict);
      return bookingResponse(
        await tx.booking.create({
          data: {
            bookingCode: `STB-${randomBytes(8).toString('hex').toUpperCase()}`,
            customerNameSnapshot: customer.fullName,
            customerPhoneSnapshot: customer.phoneNumber!,
            customerEmailSnapshot: customer.email,
            propertyNameSnapshot: room.property.name,
            propertyAddressSnapshot: room.property.address,
            guestId,
            roomTypeId: room.id,
            roomTypeNameSnapshot: room.name,
            quantity: dto.quantity,
            guestCount: dto.guestCount,
            checkIn,
            checkOut,
            checkInTimeSnapshot: room.property.checkInTime,
            checkOutTimeSnapshot: room.property.checkOutTime,
            paymentDeadlineAt,
            ...priceSnapshot(
              room.pricePerNight,
              room.property.depositPercent,
              totalNights,
              dto.quantity,
            ),
          },
          include: bookingInclude,
        }),
      );
    });
  }
  mine(guestId: string) {
    return this.inventory.forGuest(guestId, async (tx) =>
      (
        await tx.booking.findMany({
          where: { guestId },
          include: bookingInclude,
          orderBy: { createdAt: 'desc' },
        })
      ).map(bookingResponse),
    );
  }
  async host(hostId: string) {
    const due = await this.prisma.booking.findMany({
      where: {
        roomType: { property: { hostId } },
        status: 'PENDING_PAYMENT',
        paymentDeadlineAt: { lte: new Date() },
      },
      select: { guestId: true },
      distinct: ['guestId'],
    });
    for (const { guestId } of due)
      await this.inventory.forGuest(guestId, async () => undefined);
    return (
      await this.prisma.booking.findMany({
        where: { roomType: { property: { hostId } } },
        include: {
          ...bookingInclude,
          guest: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    ).map(bookingResponse);
  }
  eligibility(guestId: string) {
    return this.inventory.forGuest(guestId, (tx, now) =>
      this.inventory.eligibility(tx, guestId, now),
    );
  }
  cancel(id: string, guestId: string) {
    return this.inventory.forGuest(guestId, async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id, guestId } });
      if (!booking)
        throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
      if (booking.status === 'EXPIRED')
        throw new ConflictException(expiredMessage);
      if (booking.status === 'CANCELLED')
        throw new ConflictException('Đơn đặt phòng đã được hủy.');
      return bookingResponse(
        await tx.booking.update({
          where: { id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
          include: bookingInclude,
        }),
      );
    });
  }
}
