import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { bookingPolicy } from '../bookings/booking-policy';
import { districts } from '../common/domain';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class RoomTypeDto {
  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID()
  id?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) name!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(0, 5000)
  description!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(50000000) pricePerNight!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(100) totalUnits!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(50) maxGuests!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(50) bedrooms!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(50) beds!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(50) bathrooms!: number;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
export class CreatePropertyDto {
  @ApiProperty({ enum: ['HOMESTAY', 'HOTEL'] })
  @IsIn(['HOMESTAY', 'HOTEL'], { message: 'Loại chỗ nghỉ không hợp lệ.' })
  type!: 'HOMESTAY' | 'HOTEL';
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 150, { message: 'Tên chỗ nghỉ phải có 3–150 ký tự.' })
  name!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(20, 10000, { message: 'Mô tả phải có 20–10.000 ký tự.' })
  description!: string;
  @ApiProperty({ enum: districts })
  @IsIn(districts, { message: 'Vui lòng chọn khu vực thuộc TP. Hồ Chí Minh.' })
  district!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 250, { message: 'Địa chỉ phải có 5–250 ký tự.' })
  address!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100) depositPercent!: number;
  @ApiPropertyOptional({
    enum: [...bookingPolicy.paymentWindowOptions],
    default: bookingPolicy.defaultPaymentWindowHours,
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsInt()
  @IsIn(bookingPolicy.paymentWindowOptions)
  paymentWindowHours?: number;
  @ApiProperty({ type: () => [RoomTypeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoomTypeDto)
  roomTypes!: RoomTypeDto[];
  @ApiProperty({ example: '14:00', description: 'Giờ nhận phòng (UTC+7)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ nhận phòng phải có định dạng HH:mm (00:00–23:59).',
  })
  checkInTime!: string;
  @ApiProperty({ example: '12:00', description: 'Giờ trả phòng (UTC+7)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ trả phòng phải có định dạng HH:mm (00:00–23:59).',
  })
  checkOutTime!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { each: true, message: 'Ảnh phải là URL HTTPS hợp lệ.' },
  )
  @MaxLength(2048, { each: true })
  images!: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  amenityIds!: string[];
}
export class UpdatePropertyDto extends PartialType(CreatePropertyDto, {
  skipNullProperties: false,
}) {}
export class PropertyStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'], {
    message: 'Trạng thái chỗ nghỉ không hợp lệ.',
  })
  status!: 'ACTIVE' | 'INACTIVE';
}
export class SearchPropertyDto {
  @ApiPropertyOptional({ enum: ['HOMESTAY', 'HOTEL'] })
  @IsOptional()
  @IsIn(['HOMESTAY', 'HOTEL'])
  type?: 'HOMESTAY' | 'HOTEL';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) q?: string;
  @ApiPropertyOptional({ enum: districts })
  @IsOptional()
  @IsIn(districts)
  district?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000000)
  minPrice?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50000000)
  maxPrice?: number;
  @ApiPropertyOptional({
    description: 'Danh sách UUID tiện ích, phân cách dấu phẩy',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  amenities?: string[];
  @ApiPropertyOptional({ enum: ['price_asc', 'price_desc'] })
  @IsOptional()
  @IsIn(['price_asc', 'price_desc'])
  sort?: 'price_asc' | 'price_desc';
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit = 12;
}
