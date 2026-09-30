import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.amenity.findMany({ orderBy: { code: 'asc' } });
  }
}
@ApiTags('Tiện ích')
@Public()
@Controller('amenities')
class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}
  @Get() list() {
    return this.amenities.list();
  }
}
@Module({ controllers: [AmenitiesController], providers: [AmenitiesService] })
export class AmenitiesModule {}
