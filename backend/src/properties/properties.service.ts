import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, Prisma, PropertyStatus } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';

const propertyInclude = { images: { orderBy: { sortOrder: 'asc' as const } }, propertyAmenities: { include: { amenity: true } } };

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: QueryPropertiesDto) {
    const filters: Prisma.PropertyWhereInput[] = [];
    if (query.q) filters.push({ OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { district: { contains: query.q, mode: 'insensitive' } }] });
    if (query.district) filters.push({ district: { contains: query.district, mode: 'insensitive' } });
    if (query.minPrice !== undefined || query.maxPrice !== undefined) filters.push({ pricePerNight: { gte: query.minPrice, lte: query.maxPrice } });
    for (const code of query.amenities ?? []) filters.push({ propertyAmenities: { some: { amenity: { code } } } });
    const where: Prisma.PropertyWhereInput = { status: PropertyStatus.ACTIVE, AND: filters };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({ where, include: propertyInclude, orderBy: query.sort ? { pricePerNight: query.sort === 'price_asc' ? 'asc' : 'desc' } : { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.prisma.property.count({ where }),
    ]);
    return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }
  async detail(id: string) {
    const item = await this.prisma.property.findFirst({ where: { id, status: PropertyStatus.ACTIVE }, include: propertyInclude });
    if (!item) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
    return item;
  }
  async hostList(user: AuthUser) { this.ensureActive(user); return this.prisma.property.findMany({ where: { hostId: user.id }, include: propertyInclude, orderBy: { createdAt: 'desc' } }); }
  async create(user: AuthUser, dto: CreatePropertyDto) {
    this.ensureActive(user); await this.ensureAmenities(dto.amenityCodes);
    return this.prisma.property.create({ data: { hostId: user.id, type: dto.type, name: dto.name, description: dto.description, district: dto.district, address: dto.address, pricePerNight: dto.pricePerNight, depositPercent: dto.depositPercent, maxGuests: dto.maxGuests, bedrooms: dto.bedrooms, beds: dto.beds, bathrooms: dto.bathrooms, images: { create: dto.imageUrls.map((url, sortOrder) => ({ url, sortOrder })) }, propertyAmenities: { create: dto.amenityCodes.map((code) => ({ amenity: { connect: { code } } })) } }, include: propertyInclude });
  }
  async update(user: AuthUser, id: string, dto: UpdatePropertyDto) {
    this.ensureActive(user); await this.owned(id, user.id); if (dto.amenityCodes) await this.ensureAmenities(dto.amenityCodes);
    const { imageUrls, amenityCodes, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (imageUrls) { await tx.propertyImage.deleteMany({ where: { propertyId: id } }); await tx.propertyImage.createMany({ data: imageUrls.map((url, sortOrder) => ({ propertyId: id, url, sortOrder })) }); }
      if (amenityCodes) { await tx.propertyAmenity.deleteMany({ where: { propertyId: id } }); const rows = await tx.amenity.findMany({ where: { code: { in: amenityCodes } } }); await tx.propertyAmenity.createMany({ data: rows.map((a) => ({ propertyId: id, amenityId: a.id })) }); }
      return tx.property.update({ where: { id }, data, include: propertyInclude });
    });
  }
  async status(user: AuthUser, id: string, status: PropertyStatus) { this.ensureActive(user); await this.owned(id, user.id); return this.prisma.property.update({ where: { id }, data: { status }, include: propertyInclude }); }
  private ensureActive(user: AuthUser) { if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Tài khoản chủ nhà của bạn chưa được phê duyệt.'); }
  private async owned(id: string, hostId: string) { if (!await this.prisma.property.findFirst({ where: { id, hostId }, select: { id: true } })) throw new NotFoundException('Không tìm thấy chỗ nghỉ thuộc tài khoản của bạn.'); }
  private async ensureAmenities(codes: string[]) { if ((await this.prisma.amenity.count({ where: { code: { in: [...new Set(codes)] } } })) !== new Set(codes).size) throw new NotFoundException('Có tiện ích không hợp lệ.'); }
}
