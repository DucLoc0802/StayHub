import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const publicUser = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;
export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
};
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser =>
    ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user: SessionUser }>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token)
      throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục.');
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: publicUser,
    });
    if (!user) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    req.user = user;
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && (!roles.includes(user.role) || user.status !== 'ACTIVE')) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này hoặc tài khoản chưa được phê duyệt.',
      );
    }
    return true;
  }
}
