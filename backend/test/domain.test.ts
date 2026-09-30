import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingDates,
  overlap,
  priceSnapshot,
  vietnamToday,
} from '../src/common/domain';
const now = new Date('2026-09-28T10:00:00Z');
test('booking dates use Vietnam calendar and exclusive checkout', () => {
  assert.equal(vietnamToday(new Date('2026-09-28T18:00:00Z')), '2026-09-29');
  assert.equal(bookingDates('2026-10-10', '2026-10-13', now).totalNights, 3);
  assert.equal(bookingDates('2028-02-28', '2028-03-01', now).totalNights, 2);
});
test('rejects invalid dates, equal/reversed dates, past days and overly long stays', () => {
  for (const [start, end] of [
    ['2027-02-29', '2027-03-02'],
    ['2026-10-10', '2026-10-10'],
    ['2026-10-10', '2026-10-09'],
    ['2026-09-27', '2026-09-30'],
    ['2026-10-01', '2028-10-01'],
    ['2026-10-01T10:00:00Z', '2026-10-03'],
  ])
    assert.throws(() => bookingDates(start, end, now));
});
test('deposit snapshot charges only host-defined percent, rounds up whole dong', () => {
  assert.deepEqual(priceSnapshot(1000000, 40, 3), {
    nightlyPriceSnapshot: 1000000,
    depositPercentSnapshot: 40,
    totalNights: 3,
    totalAmount: 3000000,
    depositAmount: 1200000,
    remainingAmount: 1800000,
  });
  assert.equal(priceSnapshot(999, 1, 1).depositAmount, 10);
  assert.equal(priceSnapshot(850000, 100, 2).remainingAmount, 0);
  assert.throws(() => priceSnapshot(50000000, 100, 365));
});
test('overlap predicate excludes pending bookings and allows adjacent stays', () => {
  const start = new Date('2026-10-10'),
    end = new Date('2026-10-15');
  const predicate = overlap('property', start, end);
  const matches = (a: string, b: string) =>
    new Date(a) < predicate.checkIn.lt && new Date(b) > predicate.checkOut.gt;
  assert.equal(predicate.status, 'CONFIRMED');
  assert.equal(matches('2026-10-15', '2026-10-18'), false);
  assert.equal(matches('2026-10-08', '2026-10-10'), false);
  assert.equal(matches('2026-10-14', '2026-10-18'), true);
  assert.equal(matches('2026-10-09', '2026-10-16'), true);
});
