import { Module } from '@nestjs/common';
import { BookingsController, HostBookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({ controllers: [BookingsController, HostBookingsController], providers: [BookingsService] })
export class BookingsModule {}
