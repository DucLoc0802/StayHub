import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
export class CreateBookingDto {
  @ApiProperty() @IsUUID() propertyId!: string;
  @ApiProperty({ example: '2027-10-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày nhận phòng phải có định dạng YYYY-MM-DD.',
  })
  checkIn!: string;
  @ApiProperty({ example: '2027-10-13' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày trả phòng phải có định dạng YYYY-MM-DD.',
  })
  checkOut!: string;
  @ApiProperty({ minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  guestCount!: number;
}
