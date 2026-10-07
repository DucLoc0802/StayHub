import { Body, Controller, Get, HttpCode, Post, Patch } from '@nestjs/common';
import { ProfileDto } from './profile.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, SessionUser } from '../common/security';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
@ApiTags('Tài khoản')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @ApiBearerAuth() @Patch('profile') profile(
    @CurrentUser() user: SessionUser,
    @Body() dto: ProfileDto,
  ) {
    return this.auth.updateProfile(user.id, dto);
  }
  @Public() @Post('register') register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public() @Post('login') @HttpCode(200) login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
  @ApiBearerAuth() @Get('me') me(@CurrentUser() user: SessionUser) {
    return user;
  }
}
