import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  ConflictException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { publicUser, Roles } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  pending() {
    return this.prisma.user.findMany({
      where: { role: 'HOST', status: 'PENDING' },
      select: publicUser,
      orderBy: { createdAt: 'asc' },
    });
  }
  async decide(id: string, status: 'ACTIVE' | 'REJECTED') {
    const result = await this.prisma.user.updateMany({
      where: { id, role: 'HOST', status: 'PENDING' },
      data: { status },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Chỉ được xét duyệt tài khoản Người cho thuê đang chờ phê duyệt.',
      );
    return {
      message:
        status === 'ACTIVE'
          ? 'Đã phê duyệt tài khoản.'
          : 'Đã từ chối tài khoản.',
    };
  }
}
@ApiTags('Quản trị viên')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/hosts')
class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get() pending() {
    return this.admin.pending();
  }
  @Patch(':id/approve') approve(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.decide(id, 'ACTIVE');
  }
  @Patch(':id/reject') reject(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.decide(id, 'REJECTED');
  }
}
@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
