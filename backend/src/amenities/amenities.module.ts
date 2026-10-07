import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { Public, Roles } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.amenity.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
  }
  all() {
    return this.prisma.amenity.findMany({ orderBy: { code: 'asc' } });
  }
  create(dto: AmenityDto) {
    return this.prisma.amenity.create({ data: dto });
  }
  update(id: string, dto: UpdateAmenityDto) {
    return this.prisma.amenity.update({ where: { id }, data: dto });
  }
}
export class AmenityDto {
  @ApiProperty()
  @IsString()
  @Length(2, 50)
  @Matches(/^[A-Z][A-Z0-9_]+$/)
  code!: string;
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  nameVi!: string;
  @ApiProperty() @IsBoolean() active!: boolean;
}
export class UpdateAmenityDto extends PartialType(AmenityDto, {
  skipNullProperties: false,
}) {}
@ApiTags('Tiện ích')
@Public()
@Controller('amenities')
class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}
  @Get() list() {
    return this.amenities.list();
  }
}
@ApiTags('Quản lý tiện ích')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/amenities')
class AdminAmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}
  @Get() list() {
    return this.amenities.all();
  }
  @Post() create(@Body() dto: AmenityDto) {
    return this.amenities.create(dto);
  }
  @Patch(':id') update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAmenityDto,
  ) {
    return this.amenities.update(id, dto);
  }
}
@Module({
  controllers: [AmenitiesController, AdminAmenitiesController],
  providers: [AmenitiesService],
})
export class AmenitiesModule {}
