import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingScope } from '../src/bookings/booking-access.service';
import { checkoutPassed } from '../src/feedback/feedback.module';
import { SessionUser } from '../src/common/security';
test('booking scope isolates guest history and Host property ownership', () => {
  const user = { id: 'actor', role: 'GUEST', status: 'ACTIVE' } as SessionUser;
  assert.deepEqual(bookingScope(user), { guestId: 'actor' });
  assert.deepEqual(bookingScope({ ...user, role: 'HOST' }), {
    roomType: { property: { hostId: 'actor' } },
  });
  assert.deepEqual(bookingScope({ ...user, role: 'ADMIN' }), {});
});
test('feedback eligibility uses the historical Vietnam checkout time', () => {
  const booking = {
    checkOut: new Date('2027-10-05'),
    checkOutTimeSnapshot: '12:00',
  };
  assert.equal(
    checkoutPassed(booking, new Date('2027-10-05T04:59:59Z')),
    false,
  );
  assert.equal(checkoutPassed(booking, new Date('2027-10-05T05:00:00Z')), true);
});
