import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentDeadline, bookingPolicy } from '../src/bookings/booking-policy';
import { availabilityByNight } from '../src/bookings/availability';
import { earliestCheckInDate } from '../../frontend/src/lib/booking-time';
import { format } from '../../frontend/node_modules/date-fns';

test('lead time rejects check-in at/below two hours; calendar agrees in Vietnam time', () => {
  for (const [instant, allowed] of [
    ['2027-10-04T04:59:59.999Z', true],
    ['2027-10-04T05:00:00.000Z', false],
    ['2027-10-04T05:30:00Z', false],
  ] as const) {
    const now = new Date(instant);
    assert.equal(
      format(
        earliestCheckInDate('14:00', now, bookingPolicy.minimumLeadTimeHours),
        'yyyy-MM-dd',
      ),
      allowed ? '2027-10-04' : '2027-10-05',
    );
    if (allowed)
      assert.equal(
        paymentDeadline('2027-10-04', '14:00', 24, now).toISOString(),
        '2027-10-04T05:00:00.000Z',
      );
    else assert.throws(() => paymentDeadline('2027-10-04', '14:00', 24, now));
  }
});
test('24-hour boundary caps payment at one hour, earlier arrivals use host window', () => {
  const now = new Date('2027-10-04T07:00:00Z');
  assert.equal(
    paymentDeadline('2027-10-05', '14:00', 24, now).getTime() - now.getTime(),
    3600000,
  );
  assert.equal(
    paymentDeadline('2027-10-05', '14:01', 6, now).getTime() - now.getTime(),
    6 * 3600000,
  );
  assert.equal(
    paymentDeadline('2027-10-04', '16:30', 6, now).getTime() - now.getTime(),
    30 * 60000,
  );
  assert.throws(() => paymentDeadline('2027-10-06', '14:00', 48, now));
});
test('nightly occupancy uses peak overlap, not sum across disjoint nights', () => {
  const result = availabilityByNight(
    10,
    [
      {
        checkIn: new Date('2027-10-05'),
        checkOut: new Date('2027-10-08'),
        quantity: 2,
      },
      {
        checkIn: new Date('2027-10-06'),
        checkOut: new Date('2027-10-09'),
        quantity: 3,
      },
    ],
    new Date('2027-10-05'),
    new Date('2027-10-10'),
  );
  assert.deepEqual(
    result.days.map((d) => d.availableUnits),
    [8, 5, 5, 7, 10],
  );
  assert.equal(result.availableUnits, 5);
});
