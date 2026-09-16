import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Amenities') @Controller('amenities')
export class AmenitiesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list() { return this.prisma.amenity.findMany({ orderBy: { nameVi: 'asc' } }); }
}
