import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { LookupRateLimit, PublicLookupDto, PublicLookupService } from '../src/bookings/public-lookup';
import { PrismaService } from '../src/prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

test('public lookup normalizes inputs, whitelists output and makes mismatches indistinguishable', async () => {
  const row = {
    bookingCode: 'STB-TEST1234', customerEmailSnapshot: 'Guest@Example.test', status: 'PENDING_PAYMENT',
    propertyNameSnapshot: 'Property', roomTypeNameSnapshot: 'Room', checkIn: new Date('2027-01-01'),
    checkOut: new Date('2027-01-02'), quantity: 1, guestCount: 2, paymentDeadlineAt: new Date(Date.now() + 3600000), payment: null,
    customerPhoneSnapshot: '0901234567', guestId: 'private', depositAmount: 200000,
  };
  const prisma = { booking: { findUnique: async ({ where }: { where: { bookingCode: string } }) => where.bookingCode === row.bookingCode ? row : null } } as unknown as PrismaService;
  const service = new PublicLookupService(prisma);
  const result = await service.lookup({ bookingCode: ' stb-test1234 ', email: ' GUEST@example.test ' });
  assert.deepEqual(Object.keys(result).sort(), ['bookingCode', 'status', 'propertyName', 'roomTypeName', 'checkIn', 'checkOut', 'quantity', 'guestCount', 'paymentState', 'paymentDeadlineAt'].sort());
  let first: unknown;
  await assert.rejects(service.lookup({ bookingCode: row.bookingCode, email: 'other@example.test' }), (error: unknown) => { first = (error as HttpException).getResponse(); return true; });
  await assert.rejects(service.lookup({ bookingCode: 'STB-NOTFOUND', email: 'guest@example.test' }), (error: unknown) => { assert.deepEqual((error as HttpException).getResponse(), first); return true; });
  row.paymentDeadlineAt = new Date(0);
  const expired = await service.lookup({ bookingCode: row.bookingCode, email: 'guest@example.test' });
  assert.equal(expired.status, 'EXPIRED');
  assert.equal('paymentDeadlineAt' in expired, false);
  assert.equal(row.status, 'PENDING_PAYMENT');
  assert.equal((await validate(plainToInstance(PublicLookupDto, { bookingCode: row.bookingCode }))).length > 0, true);
});

test('lookup limits normalized codes across IPs and recovers after cooldown', () => {
  const limiter = new LookupRateLimit();
  let time = 100000;
  const original = Date.now;
  Date.now = () => time;
  const context = (ip: string, bookingCode: string) => ({ switchToHttp: () => ({ getRequest: () => ({ ip, body: { bookingCode }, socket: {} }) }) }) as ExecutionContext;
  try {
    for (let i = 0; i < 5; i++) assert.equal(limiter.canActivate(context(`ip${i}`, ' stb-test ')), true);
    assert.throws(() => limiter.canActivate(context('new-ip', `${' '.repeat(250)}STB-TEST`)), (error: unknown) => (error as HttpException).getStatus() === 429);
    time += 15 * 60000;
    assert.equal(limiter.canActivate(context('new-ip', 'STB-TEST')), true);
    for (let i = 0; i < 4; i++) limiter.canActivate(context('new-ip', `STB-${i}`));
    assert.throws(() => limiter.canActivate(context('new-ip', 'STB-ANOTHER')));
    time += 60000;
    assert.equal(limiter.canActivate(context('new-ip', 'STB-ANOTHER')), true);
  } finally { Date.now = original; }
});
