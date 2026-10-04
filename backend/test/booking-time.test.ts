import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingDates } from '../src/common/domain';
import { BookingsService } from '../src/bookings/bookings.service';
import { PaymentsService } from '../src/payments/payments.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { earliestCheckInDate } from '../../frontend/src/lib/booking-time';
import { format } from '../../frontend/node_modules/date-fns';

const checkIn = '2026-10-04';
const checkOut = '2026-10-05';
const cutoff = new Date('2026-10-04T07:00:00Z');

test('Vietnam check-in cutoff agrees between API and calendar, including midnight and seconds', () => {
  for (const [time, instant, firstDay, allowed] of [
    ['14:00', '2026-10-04T06:59:59.999Z', checkIn, true],
    ['14:00', '2026-10-04T07:00:00.000Z', checkIn, true],
    ['14:00', '2026-10-04T07:00:00.001Z', checkOut, false],
    ['14:00', '2026-10-04T16:59:59.999Z', checkOut, false],
    ['14:00', '2026-10-04T17:00:00.000Z', checkOut, false],
    ['00:00', '2026-10-03T17:00:00.000Z', checkIn, true],
    ['00:00', '2026-10-03T17:00:00.001Z', checkOut, false],
    ['23:59', '2026-10-04T16:58:59.999Z', checkIn, true],
    ['23:59', '2026-10-04T16:59:00.001Z', checkOut, false],
  ] as const) {
    const now = new Date(instant);
    assert.equal(
      format(earliestCheckInDate(time, now), 'yyyy-MM-dd'),
      firstDay,
    );
    if (allowed)
      assert.equal(bookingDates(checkIn, checkOut, now, time).totalNights, 1);
    else assert.throws(() => bookingDates(checkIn, checkOut, now, time));
  }
  assert.equal(
    bookingDates(checkOut, '2026-10-06', cutoff, '00:00').totalNights,
    1,
  );
});

function fixture() {
  const property = {
    id: 'property',
    status: 'ACTIVE',
    maxGuests: 2,
    pricePerNight: 850000,
    depositPercent: 30,
    checkInTime: '14:00',
    checkOutTime: '11:30',
  };
  let saved: Record<string, unknown> | undefined;
  let paymentCreated = false;
  const tx = {
    property: { findFirst: async () => property },
    booking: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        saved = data;
        return data;
      },
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => saved,
    },
    payment: {
      create: async () => {
        paymentCreated = true;
      },
    },
  };
  const prisma = {
    serializable: async (work: (transaction: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  return {
    property,
    tx,
    prisma,
    saved: () => saved,
    paymentCreated: () => paymentCreated,
  };
}

test('booking API rejects expired same-day requests and snapshots host-defined times', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: cutoff });
  const f = fixture();
  const service = new BookingsService(f.prisma);
  const dto = { propertyId: 'property', checkIn, checkOut, guestCount: 2 };
  await service.create('guest', dto);
  assert.equal(f.saved()?.checkInTimeSnapshot, '14:00');
  assert.equal(f.saved()?.checkOutTimeSnapshot, '11:30');
  f.property.checkInTime = '15:00';
  assert.equal(f.saved()?.checkInTimeSnapshot, '14:00');
  t.mock.timers.setTime(new Date('2026-10-04T08:00:00.001Z').getTime());
  await assert.rejects(
    () => service.create('guest', dto),
    /Đã quá giờ nhận phòng/,
  );
  await service.create('guest', {
    ...dto,
    checkIn: checkOut,
    checkOut: '2026-10-06',
  });
});

test('deposit payment uses booked check-in time and rejects payment after its cutoff', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: cutoff });
  const f = fixture();
  const booking = {
    id: 'booking',
    guestId: 'guest',
    propertyId: 'property',
    property: f.property,
    status: 'PENDING_PAYMENT',
    payment: null,
    depositAmount: 255000,
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    checkInTimeSnapshot: '14:00',
    checkOutTimeSnapshot: '11:30',
  };
  f.property.checkInTime = '12:00';
  f.tx.booking.findFirst = async (...args: unknown[]) => {
    const input = args[0] as { where: { id?: string } };
    return input.where.id ? (booking as never) : null;
  };
  await new PaymentsService(f.prisma).pay('booking', 'guest');
  assert.equal(f.paymentCreated(), true);
  const expired = fixture();
  expired.property.checkInTime = '23:59';
  expired.tx.booking.findFirst = async () =>
    ({ ...booking, property: expired.property }) as never;
  t.mock.timers.setTime(cutoff.getTime() + 1);
  await assert.rejects(
    () => new PaymentsService(expired.prisma).pay('booking', 'guest'),
    /Đã quá giờ nhận phòng/,
  );
  assert.equal(expired.paymentCreated(), false);
});
