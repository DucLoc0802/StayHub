import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, PersonalBookings, Public, Roles, SessionUser } from '../common/security';
import { InventoryModule } from '../bookings/inventory.module';
import { InventoryService } from '../bookings/inventory.service';

export function checkoutPassed(
  booking: { checkOut: Date; checkOutTimeSnapshot: string },
  now = new Date(),
) {
  return (
    new Date(
      `${booking.checkOut.toISOString().slice(0, 10)}T${booking.checkOutTimeSnapshot}:00+07:00`,
    ) <= now
  );
}
export class FeedbackDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(5, 2000)
  content!: string;
}
@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}
  create(guestId: string, bookingId: string, dto: FeedbackDto) {
    return this.inventory.forGuest(guestId, async (tx, now) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, guestId },
        include: { roomType: true, feedback: true },
      });
      if (!booking)
        throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
      if (booking.status !== 'CONFIRMED' || !checkoutPassed(booking, now))
        throw new ConflictException(
          'Chỉ có thể đánh giá đơn đã xác nhận sau giờ trả phòng.',
        );
      if (booking.feedback)
        throw new ConflictException('Bạn đã đánh giá đơn này.');
      return tx.feedback.create({
        data: {
          bookingId,
          guestId,
          propertyId: booking.roomType.propertyId,
          rating: dto.rating,
          content: dto.content,
        },
      });
    });
  }
  async recent(propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!property) throw new NotFoundException('Không tìm thấy chỗ nghỉ.');
    const [summary, items] = await this.prisma.$transaction([
      this.prisma.feedback.aggregate({
        where: { propertyId },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.feedback.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          rating: true,
          content: true,
          createdAt: true,
          guest: { select: { fullName: true } },
        },
      }),
    ]);
    return { averageRating: summary._avg.rating, count: summary._count, items };
  }
}
@ApiTags('Đánh giá')
@Controller()
class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}
  @ApiBearerAuth() @PersonalBookings() @Roles('GUEST', 'HOST') @Post('bookings/:id/feedback') create(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.feedback.create(user.id, id, dto);
  }
  @Public() @Get('properties/:id/feedback') recent(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.feedback.recent(id);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
