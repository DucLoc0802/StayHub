import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsUUID, Min } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty() @IsUUID() propertyId: string;
  @ApiProperty({ example: '2026-10-10' }) @IsDateString({}, { message: 'Ngày nhận phòng không hợp lệ.' }) checkIn: string;
  @ApiProperty({ example: '2026-10-13' }) @IsDateString({}, { message: 'Ngày trả phòng không hợp lệ.' }) checkOut: string;
  @ApiProperty() @IsInt() @Min(1) guestCount: number;
}
