import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'new@stayhub.local' }) @IsEmail({}, { message: 'Email không hợp lệ.' }) email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' }) password: string;
  @ApiProperty({ example: 'Nguyễn An' }) @IsString() @MinLength(2) fullName: string;
  @ApiProperty({ enum: [Role.GUEST, Role.HOST] }) @IsEnum(Role) role: Role;
}
