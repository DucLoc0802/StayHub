import {
  Body, CanActivate, Controller, ExecutionContext, Injectable, ServiceUnavailableException,
  NotFoundException, Post, HttpException, HttpStatus, UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';

export class PublicLookupDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @Length(5, 40) bookingCode!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(191) email!: string;
}

@Injectable()
export class LookupRateLimit implements CanActivate {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    const body = request.body as Record<string, unknown> | undefined;
    const code = typeof body?.bookingCode === 'string' ? body.bookingCode.trim().toUpperCase().slice(0, 40) : '';
    const keys: [string, number][] = [[`ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`, 60000]];
    if (code) keys.push([`code:${createHash('sha256').update(code).digest('hex')}`, 15 * 60000]);
    if (this.attempts.size + keys.filter(([key]) => !this.attempts.has(key)).length > 10000 ||
      keys.some(([key]) => (this.attempts.get(key)?.count ?? 0) >= 5)) {
      throw new HttpException('Quá nhiều lần tra cứu. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS);
    }
    for (const [key, duration] of keys) {
      const bucket = this.attempts.get(key) ?? { count: 0, until: now + duration };
      bucket.count++;
      this.attempts.set(key, bucket);
    }
    return true;
  }
}

@Injectable()
export class PublicLookupService {
  constructor(private readonly prisma: PrismaService) {}
  async lookup(dto: PublicLookupDto) {
    const started = Date.now();
    const row = await this.prisma.booking.findUnique({
      where: { bookingCode: dto.bookingCode.trim().toUpperCase() },
      select: {
        bookingCode: true, customerEmailSnapshot: true, status: true,
        propertyNameSnapshot: true, roomTypeNameSnapshot: true,
        checkIn: true, checkOut: true, quantity: true, guestCount: true,
        paymentDeadlineAt: true, payment: { select: { status: true } },
      },
    }).catch(() => { throw new ServiceUnavailableException('Hệ thống đang bận. Vui lòng thử lại sau.'); });
    const digest = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest();
    const matches = timingSafeEqual(digest(row?.customerEmailSnapshot ?? ''), digest(dto.email));
    // Same query and minimum response delay for unknown codes and mismatched emails.
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 100 - (Date.now() - started))));
    if (!row || !matches) throw new NotFoundException('Không tìm thấy booking phù hợp với thông tin đã nhập.');
    const status = row.status === 'PENDING_PAYMENT' && row.paymentDeadlineAt <= new Date() ? 'EXPIRED' : row.status;
    return {
      bookingCode: row.bookingCode, status,
      propertyName: row.propertyNameSnapshot, roomTypeName: row.roomTypeNameSnapshot,
      checkIn: row.checkIn, checkOut: row.checkOut, quantity: row.quantity, guestCount: row.guestCount,
      paymentState: row.payment?.status === 'SUCCESS' ? 'PAID' : 'UNPAID',
      ...(status === 'PENDING_PAYMENT' ? { paymentDeadlineAt: row.paymentDeadlineAt } : {}),
    };
  }
}

@Public()
@Controller('booking-lookup')
@UseGuards(LookupRateLimit)
export class PublicLookupController {
  constructor(private readonly lookupService: PublicLookupService) {}
  @Post() lookup(@Body() dto: PublicLookupDto) { return this.lookupService.lookup(dto); }
}
