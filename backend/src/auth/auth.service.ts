import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { publicUser, SessionUser } from '../common/security';
import { LoginDto, RegisterDto } from './auth.dto';
import { ProfileDto } from './profile.dto';

@Injectable()
export class AuthService {
  updateProfile(id: string, dto: ProfileDto) {
    return this.prisma.user.update({
      where: { id },
      data: { fullName: dto.fullName, phoneNumber: dto.phoneNumber },
      select: publicUser,
    });
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  private async session(user: SessionUser) {
    return { user, accessToken: await this.jwt.signAsync({ sub: user.id }) };
  }
  async register(dto: RegisterDto) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException(
        'Mật khẩu không được vượt quá 72 byte UTF-8.',
      );
    if (await this.prisma.user.findUnique({ where: { email: dto.email } }))
      throw new ConflictException('Email đã được sử dụng.');
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        role: dto.role,
        status: dto.role === 'HOST' ? 'PENDING' : 'ACTIVE',
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      select: publicUser,
    });
    return this.session(user);
  }
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Compare against a valid dummy hash too, reducing account-enumeration timing differences.
    const valid = await bcrypt.compare(
      dto.password,
      user?.passwordHash ??
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxIiD4gb9SVqVY5iGmE3jD1vG7K',
    );
    if (!user || !valid || Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    const { passwordHash: _passwordHash, ...safeUser } = user;
    void _passwordHash;
    return this.session(safeUser);
  }
}
