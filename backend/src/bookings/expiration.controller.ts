import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../common/security';
import { InventoryService } from './inventory.service';

@Public()
@Controller('internal/expire-bookings')
export class ExpirationController {
  constructor(private readonly inventory: InventoryService) {}
  @Get()
  async expire(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    const expected = Buffer.from(`Bearer ${secret ?? ''}`),
      actual = Buffer.from(authorization ?? '');
    if (
      !secret ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new UnauthorizedException();
    await this.inventory.sweep();
    return { ok: true };
  }
}
