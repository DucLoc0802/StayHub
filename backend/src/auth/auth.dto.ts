import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';

const demoLoginEmails = new Map([
  ['admin', 'admin@stayhub.local'],
  ['host', 'host@stayhub.local'],
  ['guest', 'guest@stayhub.local'],
]);

export class LoginDto {
  @ApiProperty({
    example: 'guest',
    description: 'Email hoặc tên tài khoản demo: admin, host, guest',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (demoLoginEmails.get(value.trim().toLowerCase()) ??
        value.trim().toLowerCase())
      : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(191, { message: 'Email quá dài.' })
  email!: string;

  @ApiProperty({ example: 'guest', minLength: 1, maxLength: 72 })
  @IsString({ message: 'Mật khẩu không hợp lệ.' })
  @Length(1, 72, { message: 'Mật khẩu phải có từ 1 đến 72 ký tự.' })
  password!: string;
}
export class RegisterDto {
  @ApiProperty({ example: 'guest@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(191, { message: 'Email quá dài.' })
  email!: string;

  @ApiProperty({ example: 'StayHub123!', minLength: 8, maxLength: 72 })
  @IsString({ message: 'Mật khẩu không hợp lệ.' })
  @Length(8, 72, { message: 'Mật khẩu phải có từ 8 đến 72 ký tự.' })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Minh Anh' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Họ tên không hợp lệ.' })
  @Length(2, 100, { message: 'Họ tên phải có từ 2 đến 100 ký tự.' })
  fullName!: string;

  @ApiProperty({ enum: ['GUEST', 'HOST'] })
  @IsIn(['GUEST', 'HOST'], {
    message: 'Chỉ được đăng ký Khách thuê hoặc Người cho thuê.',
  })
  role!: 'GUEST' | 'HOST';
}
