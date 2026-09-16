import { ApiProperty, PartialType } from '@nestjs/swagger';
import { PropertyStatus, PropertyType } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsString, IsUrl, Max, Min, MinLength } from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({ enum: PropertyType }) @IsEnum(PropertyType) type: PropertyType;
  @ApiProperty() @IsString() @MinLength(3) name: string;
  @ApiProperty() @IsString() @MinLength(20) description: string;
  @ApiProperty() @IsString() district: string;
  @ApiProperty() @IsString() @MinLength(5) address: string;
  @ApiProperty() @IsInt() @Min(1, { message: 'Giá mỗi đêm phải lớn hơn 0.' }) pricePerNight: number;
  @ApiProperty() @IsInt() @Min(1) @Max(100, { message: 'Phần trăm tiền cọc phải từ 1 đến 100.' }) depositPercent: number;
  @ApiProperty() @IsInt() @Min(1) maxGuests: number;
  @ApiProperty() @IsInt() @Min(0) bedrooms: number;
  @ApiProperty() @IsInt() @Min(1) beds: number;
  @ApiProperty() @IsInt() @Min(1) bathrooms: number;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUrl({}, { each: true }) imageUrls: string[];
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsString({ each: true }) amenityCodes: string[];
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class UpdatePropertyStatusDto {
  @ApiProperty({ enum: PropertyStatus }) @IsEnum(PropertyStatus) status: PropertyStatus;
}
