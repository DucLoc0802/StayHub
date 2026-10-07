import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma, Role, AccountStatus, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CurrentUser,
  publicUser,
  Roles,
  SessionUser,
} from '../common/security';
import { bookingInclude, bookingResponse } from '../bookings/bookings.service';
import { InventoryModule } from '../bookings/inventory.module';
import { InventoryService } from '../bookings/inventory.service';
import { dateRange } from '../bookings/availability';

export class AdminQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(191) q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['GUEST', 'HOST', 'ADMIN'])
  role?: Role;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'REJECTED'])
  accountStatus?: AccountStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED'])
  status?: BookingStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  bookingCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() propertyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() roomTypeId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit =
    20;
}
export class UserChangeDto {
  @ApiPropertyOptional({ enum: ['GUEST', 'HOST'] })
  @IsOptional()
  @IsIn(['GUEST', 'HOST'])
  role?: 'GUEST' | 'HOST';
  @ApiPropertyOptional({ enum: ['ACTIVE', 'REJECTED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'REJECTED'])
  status?: 'ACTIVE' | 'REJECTED';
}
@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}
  users(dto: AdminQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: dto.role,
      status: dto.accountStatus,
      ...(dto.q
        ? {
            OR: [
              { fullName: { contains: dto.q } },
              { email: { contains: dto.q } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => ({
      items: await tx.user.findMany({
        where,
        select: publicUser,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      total: await tx.user.count({ where }),
      page: dto.page,
      limit: dto.limit,
    }));
  }
  change(actorId: string, id: string, dto: UserChangeDto) {
    return this.prisma.serializable(async (tx) => {
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
      if (user.role === 'ADMIN' || actorId === id)
        throw new ForbiddenException('Tài khoản quản trị được bảo vệ.');
      if (user.role === 'HOST')
        throw new ConflictException(
          'Dùng quy trình xét duyệt Host; không đổi vai trò hoặc trạng thái Host tại đây.',
        );
      if (
        dto.role === 'HOST' &&
        (await tx.booking.count({
          where: {
            guestId: id,
            status: 'PENDING_PAYMENT',
            paymentDeadlineAt: { gt: new Date() },
          },
        }))
      )
        throw new ConflictException(
          'Khách cần xử lý đơn chờ thanh toán trước khi chuyển sang Host.',
        );
      if (dto.role === 'HOST')
        return tx.user.update({
          where: { id },
          data: { role: 'HOST', status: 'PENDING' },
          select: publicUser,
        });
      return tx.user.update({
        where: { id },
        data: { ...(dto.status ? { status: dto.status } : {}) },
        select: publicUser,
      });
    });
  }
  async statistics() {
    await this.inventory.sweep();
    return this.prisma.$transaction(async (tx) => {
      const [
        guests,
        hosts,
        properties,
        roomTypes,
        totalBookings,
        states,
        payments,
      ] = await Promise.all([
        tx.user.count({ where: { role: 'GUEST' } }),
        tx.user.count({ where: { role: 'HOST' } }),
        tx.property.count(),
        tx.roomType.count(),
        tx.booking.count(),
        tx.booking.groupBy({ by: ['status'], _count: true }),
        tx.payment.aggregate({
          where: { status: 'SUCCESS' },
          _sum: { amount: true },
        }),
      ]);
      return {
        guests,
        hosts,
        properties,
        roomTypes,
        totalBookings,
        confirmed: states.find((s) => s.status === 'CONFIRMED')?._count ?? 0,
        pending:
          states.find((s) => s.status === 'PENDING_PAYMENT')?._count ?? 0,
        expired: states.find((s) => s.status === 'EXPIRED')?._count ?? 0,
        cancelled: states.find((s) => s.status === 'CANCELLED')?._count ?? 0,
        successfulDepositAmount: payments._sum.amount ?? 0,
      };
    });
  }
  async customer(id: string) {
    await this.inventory.forGuest(id, async () => undefined);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, role: 'GUEST' },
        select: publicUser,
      });
      if (!user) throw new NotFoundException('Không tìm thấy khách thuê.');
      const [states, payments, recent] = await Promise.all([
        tx.booking.groupBy({
          by: ['status'],
          where: { guestId: id },
          _count: true,
        }),
        tx.payment.aggregate({
          where: { status: 'SUCCESS', booking: { guestId: id } },
          _sum: { amount: true },
        }),
        tx.booking.findMany({
          where: { guestId: id },
          include: bookingInclude,
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);
      return {
        user,
        totalBookings: states.reduce((n, s) => n + s._count, 0),
        confirmed: states.find((s) => s.status === 'CONFIRMED')?._count ?? 0,
        pending:
          states.find((s) => s.status === 'PENDING_PAYMENT')?._count ?? 0,
        expired: states.find((s) => s.status === 'EXPIRED')?._count ?? 0,
        cancelled: states.find((s) => s.status === 'CANCELLED')?._count ?? 0,
        successfulDepositAmount: payments._sum.amount ?? 0,
        recentBookings: recent.map(bookingResponse),
      };
    });
  }
  async bookings(dto: AdminQueryDto) {
    await this.inventory.sweep();
    const where: Prisma.BookingWhereInput = {
      status: dto.status,
      roomTypeId: dto.roomTypeId,
      ...(dto.propertyId ? { roomType: { propertyId: dto.propertyId } } : {}),
      ...(dto.bookingCode
        ? { bookingCode: dto.bookingCode.toUpperCase() }
        : {}),
    };
    if (dto.from || dto.to) {
      const parse = (value: string) => {
        const date = new Date(value + 'T00:00:00.000Z');
        if (!Number.isFinite(date.getTime()))
          throw new BadRequestException('Ngày không hợp lệ.');
        return dateRange(
          value,
          new Date(date.getTime() + 86400000).toISOString().slice(0, 10),
        ).checkIn;
      };
      const from = dto.from ? parse(dto.from) : undefined,
        to = dto.to ? parse(dto.to) : undefined;
      if (from && to && from > to)
        throw new ConflictException('Khoảng ngày không hợp lệ.');
      where.checkIn = { gte: from, lte: to };
    }
    if (dto.q)
      where.OR = [
        { bookingCode: { contains: dto.q } },
        { guest: { fullName: { contains: dto.q } } },
        { guest: { email: { contains: dto.q } } },
        { roomType: { name: { contains: dto.q } } },
        { roomType: { property: { name: { contains: dto.q } } } },
      ];
    return this.prisma.$transaction(async (tx) => ({
      items: (
        await tx.booking.findMany({
          where,
          include: { ...bookingInclude, guest: { select: publicUser } },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (dto.page - 1) * dto.limit,
          take: dto.limit,
        })
      ).map(bookingResponse),
      total: await tx.booking.count({ where }),
      page: dto.page,
      limit: dto.limit,
    }));
  }
  feedback() {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        guest: { select: publicUser },
        property: { select: { id: true, name: true } },
      },
    });
  }
}
@ApiTags('Quản trị người dùng và thống kê')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
class ManagementController {
  constructor(private readonly management: ManagementService) {}
  @Get('users') users(@Query() dto: AdminQueryDto) {
    return this.management.users(dto);
  }
  @Patch('users/:id') change(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UserChangeDto,
  ) {
    return this.management.change(user.id, id, dto);
  }
  @Get('customers/:id/history') customer(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.management.customer(id);
  }
  @Get('statistics') statistics() {
    return this.management.statistics();
  }
  @Get('bookings') bookings(@Query() dto: AdminQueryDto) {
    return this.management.bookings(dto);
  }
  @Get('feedback') feedback() {
    return this.management.feedback();
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [ManagementController],
  providers: [ManagementService],
})
export class ManagementModule {}
