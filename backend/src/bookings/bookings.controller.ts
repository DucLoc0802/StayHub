import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@ApiTags('Guest bookings') @ApiBearerAuth() @Controller('bookings') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles(Role.GUEST)
export class BookingsController {
  constructor(private readonly service: BookingsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) { return this.service.create(user, dto); }
  @Get('my') my(@CurrentUser() user: AuthUser) { return this.service.my(user); }
  @Post(':id/pay') pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.pay(user, id); }
  @Patch(':id/cancel') cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.service.cancel(user, id); }
}

@ApiTags('Host bookings') @ApiBearerAuth() @Controller('host/bookings') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles(Role.HOST)
export class HostBookingsController {
  constructor(private readonly service: BookingsService) {}
  @Get() list(@CurrentUser() user: AuthUser) { return this.service.host(user); }
}
