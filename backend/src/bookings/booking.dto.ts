import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
export class AvailabilityQueryDto {
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut!: string;
}
export class QuoteQueryDto extends AvailabilityQueryDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity = 1;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(5000) guestCount = 1;
}
export class CreateBookingDto extends AvailabilityQueryDto {
  @ApiProperty() @IsUUID() roomTypeId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100) quantity!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(5000) guestCount!: number;
}
