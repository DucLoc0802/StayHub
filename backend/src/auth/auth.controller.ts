import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authentication') @Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) { return this.service.register(dto); }
  @Post('login') login(@Body() dto: LoginDto) { return this.service.login(dto); }
  @Get('me') @ApiBearerAuth() @UseGuards(AuthGuard('jwt')) me(@CurrentUser() user: AuthUser) { return user; }
}
