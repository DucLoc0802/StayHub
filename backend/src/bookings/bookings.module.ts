import {
  Body,
  Controller,
  Get,
  Header,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoiceService } from './invoice.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles, SessionUser } from '../common/security';
import { PaymentsModule } from '../payments/payments.module';
import { bookingIdPipe } from '../common/validation';
import {
  AvailabilityQueryDto,
  CreateBookingDto,
  HostBookingQueryDto,
  QuoteQueryDto,
} from './booking.dto';
import { InventoryModule } from './inventory.module';
import { publicBookingPolicy } from './booking-policy';
import { BookingsService } from './bookings.service';
import { BookingAccessService } from './booking-access.service';
import {
  LookupRateLimit,
  PublicLookupController,
  PublicLookupService,
} from './public-lookup';
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
  constructor(private readonly bookings: BookingsService) {}
  @Post() create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.create(user.id, dto);
  }
  @Get('my') mine(@CurrentUser() user: SessionUser) {
    return this.bookings.mine(user.id);
  }
  @Patch(':id/cancel') cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.bookings.cancel(id, user.id);
  }
  @Get('pending-payments') pending(@CurrentUser() user: SessionUser) {
    return this.bookings.pending(user.id);
  }
}
@ApiTags('Đặt chỗ thuộc chỗ nghỉ của tôi')
@ApiBearerAuth()
@Roles('HOST')
@Controller('host/bookings')
class HostBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly access: BookingAccessService,
  ) {}
  @Get(':id') detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.access.find(user, { id });
  }
  @Get() list(
    @CurrentUser() user: SessionUser,
    @Query() dto: HostBookingQueryDto,
  ) {
    return this.bookings.host(user.id, dto.propertyId);
  }
}
@ApiTags('Thông tin đặt phòng và hóa đơn')
@ApiBearerAuth()
@Roles('GUEST')
@Controller('bookings')
export class BookingAccessController {
  constructor(
    private readonly access: BookingAccessService,
    private readonly invoices: InvoiceService,
  ) {}
  @Get(':id/invoice.pdf') async pdf(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { bytes, filename } = await this.invoices.pdf(user, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(bytes);
  }
  @Get('lookup/:code') lookup(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
  ) {
    return this.access.find(user, { bookingCode: code.trim().toUpperCase() });
  }
  @Get(':id/invoice')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  invoice(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.access.invoice(user, id);
  }
  @Get(':id') detail(
    @CurrentUser() user: SessionUser,
    @Param('id', bookingIdPipe()) id: string,
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
  imports: [InventoryModule, PaymentsModule],
  controllers: [
    BookingsController,
    HostBookingsController,
    RoomAvailabilityController,
    BookingAccessController,
    PropertyCalendarController,
    PublicLookupController,
  ],
  providers: [
    BookingsService,
    BookingAccessService,
    InvoiceService,
    PublicLookupService,
    LookupRateLimit,
  ],
})
export class BookingsModule {}
