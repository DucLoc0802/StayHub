import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
export class SubmitTransferDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{3,99}$/)
  transactionRef!: string;
  @IsOptional() @IsString() @Length(0, 1000) evidenceNote?: string;
}
export class ReviewTransferDto {
  @IsIn(['VERIFY', 'REJECT', 'RESOLUTION_REQUIRED']) decision!:
    'VERIFY' | 'REJECT' | 'RESOLUTION_REQUIRED';
  @IsOptional() @IsString() @Length(5, 250) reason?: string;
  @ValidateIf((dto: ReviewTransferDto) => dto.decision === 'VERIFY')
  @IsInt()
  @Min(1)
  @Max(2147483647)
  receivedAmount?: number;
  @ValidateIf((dto: ReviewTransferDto) => dto.decision === 'VERIFY')
  @IsString()
  @Length(4, 100)
  verifiedTransactionRef?: string;
}
export class PaymentQueryDto {
  @IsOptional()
  @IsIn(['SUBMITTED', 'SUCCESS', 'FAILED', 'RESOLUTION_REQUIRED'])
  status?: 'SUBMITTED' | 'SUCCESS' | 'FAILED' | 'RESOLUTION_REQUIRED';
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
