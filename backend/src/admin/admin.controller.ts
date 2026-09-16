import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AccountStatus, Role } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin') @ApiBearerAuth() @Controller('admin/hosts') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get() list() { return this.service.pendingHosts(); }
  @Patch(':id/approve') approve(@Param('id', ParseUUIDPipe) id: string) { return this.service.setStatus(id, AccountStatus.ACTIVE); }
  @Patch(':id/reject') reject(@Param('id', ParseUUIDPipe) id: string) { return this.service.setStatus(id, AccountStatus.REJECTED); }
}
