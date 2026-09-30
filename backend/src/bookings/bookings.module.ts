import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, SessionUser } from '../common/security';
import { PaymentsService } from '../payments/payments.service';
import { CreateBookingDto } from './booking.dto';
import { BookingsService } from './bookings.service';
@ApiTags('Đặt chỗ')
@ApiBearerAuth()
@Roles('GUEST')
@Controller('bookings')
class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
  ) {}
  @Post() create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.create(user.id, dto);
  }
  @Get('my') mine(@CurrentUser() user: SessionUser) {
    return this.bookings.mine(user.id);
  }
  @Post(':id/pay') pay(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.payments.pay(id, user.id);
  }
  @Patch(':id/cancel') cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.bookings.cancel(id, user.id);
  }
}
@ApiTags('Đặt chỗ thuộc chỗ nghỉ của tôi')
@ApiBearerAuth()
@Roles('HOST')
@Controller('host/bookings')
class HostBookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Get() list(@CurrentUser() user: SessionUser) {
    return this.bookings.host(user.id);
  }
}
@Module({
  controllers: [BookingsController, HostBookingsController],
  providers: [BookingsService, PaymentsService],
})
export class BookingsModule {}
