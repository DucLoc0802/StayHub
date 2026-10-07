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
import { CurrentUser, Public, Roles, SessionUser } from '../common/security';
import {
  CreatePropertyDto,
  PropertyStatusDto,
  SearchPropertyDto,
  UpdatePropertyDto,
} from './property.dto';
import { InventoryModule } from '../bookings/inventory.module';
import { PropertiesService } from './properties.service';
@ApiTags('Chỗ nghỉ')
@Public()
@Controller('properties')
class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}
  @Get() search(@Query() dto: SearchPropertyDto) {
    return this.properties.search(dto);
  }
  @Get(':slug') detail(@Param('slug') slug: string) {
    return this.properties.detail(slug);
  }
}
@ApiTags('Chỗ nghỉ của tôi')
@ApiBearerAuth()
@Roles('HOST')
@Controller('host/properties')
class HostPropertiesController {
  constructor(private readonly properties: PropertiesService) {}
  @Get() mine(@CurrentUser() user: SessionUser) {
    return this.properties.mine(user.id);
  }
  @Get(':id') detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.properties.owned(id, user.id);
  }
  @Post() create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.properties.create(user.id, dto);
  }
  @Patch(':id') update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(id, user.id, dto);
  }
  @Patch(':id/status') status(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: PropertyStatusDto,
  ) {
    return this.properties.status(id, user.id, dto.status);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [PropertiesController, HostPropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
