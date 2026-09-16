import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async register(dto: RegisterDto) {
    if (dto.role === Role.ADMIN) throw new ConflictException('Không thể đăng ký tài khoản quản trị.');
    if (await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })) throw new ConflictException('Email này đã được sử dụng.');
    const user = await this.prisma.user.create({ data: { email: dto.email.toLowerCase(), fullName: dto.fullName.trim(), passwordHash: await bcrypt.hash(dto.password, 10), role: dto.role, status: dto.role === Role.GUEST ? AccountStatus.ACTIVE : AccountStatus.PENDING }, select: { id: true, email: true, fullName: true, role: true, status: true } });
    return this.issueToken(user);
  }
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    return this.issueToken({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status });
  }
  private async issueToken(user: { id: string; email: string; fullName: string; role: Role; status: AccountStatus }) {
    return { accessToken: await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, status: user.status }), user };
  }
}
