import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  pendingHosts() { return this.prisma.user.findMany({ where: { role: Role.HOST, status: AccountStatus.PENDING }, select: { id: true, email: true, fullName: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' } }); }
  async setStatus(id: string, status: AccountStatus) {
    const result = await this.prisma.user.updateMany({ where: { id, role: Role.HOST, status: AccountStatus.PENDING }, data: { status } });
    if (!result.count) throw new NotFoundException('Không tìm thấy tài khoản chủ nhà đang chờ duyệt.');
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, fullName: true, status: true } });
  }
}
