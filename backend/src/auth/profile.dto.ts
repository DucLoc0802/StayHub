import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { normalizeVietnamPhone, vietnamPhonePattern } from '../common/profile';
export class ProfileDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  fullName!: string;
  @ApiProperty({ example: '0901234567' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeVietnamPhone(value) : value,
  )
  @IsString()
  @Matches(vietnamPhonePattern, {
    message: 'Số điện thoại Việt Nam không hợp lệ.',
  })
  phoneNumber!: string;
}
