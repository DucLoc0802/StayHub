import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryPropertiesDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @Transform(({ value }: { value: string }) => value?.split(',').filter(Boolean)) amenities?: string[];
  @IsOptional() @IsIn(['price_asc', 'price_desc']) sort?: 'price_asc' | 'price_desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 12;
}
