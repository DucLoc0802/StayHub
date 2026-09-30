import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePropertyDto,
  SearchPropertyDto,
  UpdatePropertyDto,
} from './property.dto';

export const propertyInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  amenities: { include: { amenity: true } },
} satisfies Prisma.PropertyInclude;
@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}
  async search(dto: SearchPropertyDto) {
    if (
      dto.minPrice !== undefined &&
      dto.maxPrice !== undefined &&
      dto.minPrice > dto.maxPrice
    )
      throw new BadRequestException(
        'Giá tối thiểu không được lớn hơn giá tối đa.',
      );
    const where: Prisma.PropertyWhereInput = {
      status: 'ACTIVE',
      district: dto.district,
      ...(dto.q
        ? {
            OR: [
              { name: { contains: dto.q.trim() } },
              { district: { contains: dto.q.trim() } },
            ],
          }
        : {}),
      pricePerNight: { gte: dto.minPrice, lte: dto.maxPrice },
      AND: dto.amenities?.map((amenityId) => ({
        amenities: { some: { amenityId } },
      })),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: propertyInclude,
        orderBy: dto.sort
          ? [
              { pricePerNight: dto.sort === 'price_asc' ? 'asc' : 'desc' },
              { id: 'asc' },
            ]
          : [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.property.count({ where }),
    ]);
    return {
      items,
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.ceil(total / dto.limit),
    };
  }
  async detail(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, status: 'ACTIVE' },
      include: propertyInclude,
    });
    if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
    const unavailableDates = await this.prisma.booking.findMany({
      where: {
        propertyId: id,
        status: 'CONFIRMED',
        checkOut: { gte: new Date() },
      },
      select: { checkIn: true, checkOut: true },
    });
    return { ...property, unavailableDates };
  }
  mine(hostId: string) {
    return this.prisma.property.findMany({
      where: { hostId },
      include: propertyInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
  async owned(id: string, hostId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, hostId },
      include: propertyInclude,
    });
    if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
    return property;
  }
  private async validateAmenities(ids?: string[]) {
    if (
      ids &&
      (await this.prisma.amenity.count({ where: { id: { in: ids } } })) !==
        ids.length
    )
      throw new BadRequestException('Tiện ích không hợp lệ.');
  }
  async create(hostId: string, dto: CreatePropertyDto) {
    await this.validateAmenities(dto.amenityIds);
    const { images, amenityIds, ...data } = dto;
    return this.prisma.property.create({
      data: {
        ...data,
        hostId,
        images: {
          create: images.map((url, sortOrder) => ({ url, sortOrder })),
        },
        amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
      },
      include: propertyInclude,
    });
  }
  async update(id: string, hostId: string, dto: UpdatePropertyDto) {
    await this.owned(id, hostId);
    await this.validateAmenities(dto.amenityIds);
    const { images, amenityIds, ...data } = dto;
    return this.prisma.property.update({
      where: { id, hostId },
      data: {
        ...data,
        ...(images
          ? {
              images: {
                deleteMany: {},
                create: images.map((url, sortOrder) => ({ url, sortOrder })),
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
    });
  }
  async status(id: string, hostId: string, status: 'ACTIVE' | 'INACTIVE') {
    await this.owned(id, hostId);
    return this.prisma.property.update({
      where: { id, hostId },
      data: { status },
      include: propertyInclude,
    });
  }
}
