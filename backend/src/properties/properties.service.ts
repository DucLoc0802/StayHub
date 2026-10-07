import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../bookings/inventory.service';
import { heldBookings, peakOccupancy } from '../bookings/availability';
import { bookingPolicy } from '../bookings/booking-policy';
import { propertyLookup, withPropertySlug } from './property-slug';
import {
  CreatePropertyDto,
  RoomTypeDto,
  SearchPropertyDto,
  UpdatePropertyDto,
} from './property.dto';
export const propertyInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  amenities: { include: { amenity: true } },
  roomTypes: {
    orderBy: [{ pricePerNight: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.PropertyInclude;
type PropertyRow = Prisma.PropertyGetPayload<{
  include: typeof propertyInclude;
}>;
function response(property: PropertyRow, publicOnly = false) {
  const active = property.roomTypes.filter((room) => room.status === 'ACTIVE');
  return {
    ...property,
    roomTypes: publicOnly ? active : property.roomTypes,
    minPricePerNight: active.length
      ? Math.min(...active.map((room) => room.pricePerNight))
      : null,
  };
}
@Injectable()
export class PropertiesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}
  async onModuleInit() {
    const missing = await this.prisma.property.findMany({
      where: { slug: null },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    for (const property of missing)
      await withPropertySlug(property.name, (slug) =>
        this.prisma.property.updateMany({
          where: { id: property.id, slug: null },
          data: { slug },
        }),
      );
  }
  async search(dto: SearchPropertyDto) {
    if (
      dto.minPrice !== undefined &&
      dto.maxPrice !== undefined &&
      dto.minPrice > dto.maxPrice
    )
      throw new BadRequestException(
        'Giá tối thiểu không được lớn hơn giá tối đa.',
      );
    const clauses = [Prisma.sql`p.status = 'ACTIVE'`];
    if (dto.type) clauses.push(Prisma.sql`p.type = ${dto.type}`);
    if (dto.district) clauses.push(Prisma.sql`p.district = ${dto.district}`);
    if (dto.q?.trim()) {
      const query = `%${dto.q.trim()}%`;
      clauses.push(
        Prisma.sql`(p.name LIKE ${query} OR p.district LIKE ${query})`,
      );
    }
    if (dto.minPrice !== undefined)
      clauses.push(Prisma.sql`r.minPrice >= ${dto.minPrice}`);
    if (dto.maxPrice !== undefined)
      clauses.push(Prisma.sql`r.minPrice <= ${dto.maxPrice}`);
    for (const id of dto.amenities ?? [])
      clauses.push(
        Prisma.sql`EXISTS (SELECT 1 FROM PropertyAmenity pa WHERE pa.propertyId = p.id AND pa.amenityId = ${id})`,
      );
    const from = Prisma.sql`FROM Property p JOIN (SELECT propertyId, MIN(pricePerNight) minPrice FROM RoomType WHERE status = 'ACTIVE' GROUP BY propertyId) r ON r.propertyId = p.id WHERE ${Prisma.join(clauses, ' AND ')}`;
    const order =
      dto.sort === 'price_asc'
        ? Prisma.sql`r.minPrice ASC, p.id ASC`
        : dto.sort === 'price_desc'
          ? Prisma.sql`r.minPrice DESC, p.id ASC`
          : Prisma.sql`p.createdAt DESC, p.id ASC`;
    return this.prisma.$transaction(async (tx) => {
      const counts = await tx.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) total ${from}`,
      );
      const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT p.id ${from} ORDER BY ${order} LIMIT ${dto.limit} OFFSET ${(dto.page - 1) * dto.limit}`,
      );
      const properties = await tx.property.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        include: propertyInclude,
      });
      const byId = new Map(properties.map((p) => [p.id, p]));
      const total = Number(counts[0].total);
      return {
        items: rows.map((row) => response(byId.get(row.id)!, true)),
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      };
    });
  }
  async detail(slug: string) {
    const property = await this.prisma.property.findFirst({
      where: { ...propertyLookup(slug), status: 'ACTIVE' },
      include: propertyInclude,
    });
    if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
    return response(property, true);
  }
  async mine(hostId: string) {
    return (
      await this.prisma.property.findMany({
        where: { hostId },
        include: propertyInclude,
        orderBy: { createdAt: 'desc' },
      })
    ).map((p) => response(p));
  }
  async owned(id: string, hostId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, hostId },
      include: propertyInclude,
    });
    if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
    return response(property);
  }
  private validateRooms(type: string, rooms: RoomTypeDto[]) {
    if (
      type === 'HOMESTAY' &&
      (rooms.length !== 1 || rooms[0].totalUnits !== 1)
    )
      throw new BadRequestException(
        'Homestay phải có đúng một loại chỗ ở với số lượng bằng 1.',
      );
    const ids = rooms.flatMap((r) => (r.id ? [r.id] : []));
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Loại phòng bị trùng lặp.');
  }
  private async validateAmenities(ids?: string[], propertyId?: string) {
    if (
      ids &&
      (await this.prisma.amenity.count({
        where: {
          id: { in: ids },
          OR: [
            { active: true },
            ...(propertyId ? [{ properties: { some: { propertyId } } }] : []),
          ],
        },
      })) !== ids.length
    )
      throw new BadRequestException('Tiện ích không hợp lệ.');
  }
  async create(hostId: string, dto: CreatePropertyDto) {
    await this.validateAmenities(dto.amenityIds);
    this.validateRooms(dto.type, dto.roomTypes);
    if (dto.roomTypes.some((r) => r.id))
      throw new BadRequestException(
        'Không truyền mã loại phòng khi tạo chỗ nghỉ.',
      );
    const { images, amenityIds, roomTypes, ...data } = dto;
    return withPropertySlug(dto.name, async (slug) =>
      response(
        await this.prisma.property.create({
          data: {
            ...data,
            paymentWindowHours:
              data.paymentWindowHours ??
              bookingPolicy.defaultPaymentWindowHours,
            slug,
            hostId,
            roomTypes: { create: roomTypes },
            images: {
              create: images.map((url, sortOrder) => ({ url, sortOrder })),
            },
            amenities: {
              create: amenityIds.map((amenityId) => ({ amenityId })),
            },
          },
          include: propertyInclude,
        }),
      ),
    );
  }
  async update(id: string, hostId: string, dto: UpdatePropertyDto) {
    await this.validateAmenities(dto.amenityIds, id);
    return this.prisma.serializable(async (tx) => {
      await this.inventory.lockProperty(tx, id);
      const current = await tx.property.findFirst({
        where: { id, hostId },
        include: propertyInclude,
      });
      if (!current) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
      const { images, amenityIds, roomTypes, ...data } = dto;
      this.validateRooms(
        data.type ?? current.type,
        roomTypes ?? current.roomTypes,
      );
      if (
        data.type &&
        data.type !== current.type &&
        current.roomTypes.length > 1
      )
        throw new BadRequestException(
          'Không thể đổi khách sạn có nhiều loại phòng thành homestay.',
        );
      if (
        roomTypes &&
        (data.type ?? current.type) === 'HOMESTAY' &&
        roomTypes[0].id !== current.roomTypes[0]?.id
      )
        throw new BadRequestException(
          'Hãy cập nhật loại chỗ ở hiện tại của homestay.',
        );
      if (roomTypes) {
        const now = new Date();
        for (const room of roomTypes) {
          if (room.id && !current.roomTypes.some((r) => r.id === room.id))
            throw new BadRequestException(
              'Loại phòng không thuộc chỗ nghỉ này.',
            );
          if (room.id) {
            const holds = await tx.booking.findMany({
              where: {
                roomTypeId: room.id,
                ...heldBookings(now),
                checkOut: { gt: now },
              },
              select: { checkIn: true, checkOut: true, quantity: true },
            });
            if (room.totalUnits < peakOccupancy(holds, now))
              throw new ConflictException(
                'Số phòng không được thấp hơn số phòng đang được giữ hoặc đã xác nhận.',
              );
          }
        }
        await tx.roomType.updateMany({
          where: {
            propertyId: id,
            id: { notIn: roomTypes.flatMap((r) => (r.id ? [r.id] : [])) },
          },
          data: { status: 'INACTIVE' },
        });
        for (const room of roomTypes) {
          const { id: roomId, ...fields } = room;
          if (roomId)
            await tx.roomType.update({ where: { id: roomId }, data: fields });
          else
            await tx.roomType.create({ data: { ...fields, propertyId: id } });
        }
      }
      return response(
        await tx.property.update({
          where: { id },
          data: {
            ...data,
            ...(images
              ? {
                  images: {
                    deleteMany: {},
                    create: images.map((url, sortOrder) => ({
                      url,
                      sortOrder,
                    })),
                  },
                }
              : {}),
            ...(amenityIds
              ? {
                  amenities: {
                    deleteMany: {},
                    create: amenityIds.map((amenityId) => ({ amenityId })),
                  },
                }
              : {}),
          },
          include: propertyInclude,
        }),
      );
    });
  }
  async status(id: string, hostId: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.prisma.serializable(async (tx) => {
      await this.inventory.lockProperty(tx, id);
      const property = await tx.property.findFirst({ where: { id, hostId } });
      if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
      return response(
        await tx.property.update({
          where: { id },
          data: { status },
          include: propertyInclude,
        }),
      );
    });
  }
}
