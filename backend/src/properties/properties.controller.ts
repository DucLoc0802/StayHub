import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreatePropertyDto, UpdatePropertyDto, UpdatePropertyStatusDto } from './dto/property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { PropertiesService } from './properties.service';

@ApiTags('Properties') @Controller('properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}
  @Get() list(@Query() query: QueryPropertiesDto) { return this.service.list(query); }
  @Get(':id') detail(@Param('id', ParseUUIDPipe) id: string) { return this.service.detail(id); }
}

@ApiTags('Host properties') @ApiBearerAuth() @Controller('host/properties') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles(Role.HOST)
export class HostPropertiesController {
  constructor(private readonly service: PropertiesService) {}
  @Get() list(@CurrentUser() user: AuthUser) { return this.service.hostList(user); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) { return this.service.create(user, dto); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyDto) { return this.service.update(user, id, dto); }
  @Patch(':id/status') status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropertyStatusDto) { return this.service.status(user, id, dto.status); }
}
