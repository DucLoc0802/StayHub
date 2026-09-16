import { Module } from '@nestjs/common';
import { AmenitiesController } from './amenities.controller';

@Module({ controllers: [AmenitiesController] })
export class AmenitiesModule {}
