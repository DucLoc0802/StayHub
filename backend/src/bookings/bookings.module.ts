import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PersonalBookings, Public, Roles, SessionUser } from '../common/security';
import { PaymentsService } from '../payments/payments.service';
import {
  AvailabilityQueryDto,
  CreateBookingDto,
  QuoteQueryDto,
} from './booking.dto';
import { InventoryModule } from './inventory.module';
import { publicBookingPolicy } from './booking-policy';
import { BookingsService } from './bookings.service';
import { BookingAccessService } from './booking-access.service';
import { LookupRateLimit, PublicLookupController, PublicLookupService } from './public-lookup';
@ApiTags('Đặt chỗ')
@ApiBearerAuth()
@Roles('GUEST')
@Controller('bookings')
class BookingsController {
  @Public() @Get('policy') policy() {
    return publicBookingPolicy();
  }
  @Get('eligibility') eligibility(@CurrentUser() user: SessionUser) {
    return this.bookings.eligibility(user.id);
  }
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
  @PersonalBookings() @Roles('GUEST', 'HOST', 'ADMIN') @Get('my') mine(@CurrentUser() user: SessionUser) {
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
@ApiTags('Tra cứu, thanh toán demo và hóa đơn')
@ApiBearerAuth()
@Roles('GUEST', 'HOST', 'ADMIN')
@PersonalBookings()
@Controller('bookings')
class BookingAccessController {
  constructor(private readonly access: BookingAccessService) {}
  @Get('lookup/:code') lookup(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
  ) {
    return this.access.find(user, { bookingCode: code.trim().toUpperCase() });
  }
  @Get(':id/invoice') invoice(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.access.invoice(user, id);
  }
  @Roles('GUEST') @Get(':id/payment-demo') payment(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.access.paymentDemo(user, id);
  }
  @Get(':id') detail(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.access.find(user, { id });
  }
}
@Public()
@ApiTags('Lịch phòng và báo giá')
@Controller('room-types')
class RoomAvailabilityController {
  constructor(private readonly bookings: BookingsService) {}
  @Get(':id/availability') availability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() dto: AvailabilityQueryDto,
  ) {
    return this.bookings.availability(id, dto);
  }
  @Get(':id/quote') quote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() dto: QuoteQueryDto,
  ) {
    return this.bookings.quote(id, dto);
  }
}
@Public()
@Controller('properties')
class PropertyCalendarController {
  constructor(private readonly bookings: BookingsService) {}
  @Get(':id/calendar') calendar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() dto: AvailabilityQueryDto,
  ) {
    return this.bookings.propertyCalendar(id, dto);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [
    BookingsController,
    HostBookingsController,
    RoomAvailabilityController,
    BookingAccessController,
    PropertyCalendarController,
    PublicLookupController,
  ],
  providers: [BookingsService, PaymentsService, BookingAccessService, PublicLookupService, LookupRateLimit],
})
export class BookingsModule {}
