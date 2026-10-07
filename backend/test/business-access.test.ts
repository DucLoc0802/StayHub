import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingScope,
  demoPaymentPayload,
} from '../src/bookings/booking-access.service';
import { checkoutPassed } from '../src/feedback/feedback.module';
import { SessionUser } from '../src/common/security';
test('booking access scopes guests, hosts and admins and QR carries only demo reference/deposit', () => {
  const user = { id: 'guest', role: 'GUEST', status: 'ACTIVE' } as SessionUser;
  assert.deepEqual(bookingScope(user), { guestId: 'guest' });
  assert.deepEqual(bookingScope({ ...user, role: 'HOST' }), {
    OR: [{ guestId: 'guest' }, { roomType: { property: { hostId: 'guest' } } }],
  });
  assert.deepEqual(bookingScope({ ...user, role: 'ADMIN' }), {});
  assert.deepEqual(bookingScope({ ...user, role: 'HOST', status: 'PENDING' }), { guestId: 'guest' });
  assert.deepEqual(
    demoPaymentPayload({ bookingCode: 'STB-TEST', depositAmount: 123456 }),
    {
      mode: 'DEMO',
      currency: 'VND',
      amount: 123456,
      reference: 'STB-TEST',
      description: 'STAYHUB STB-TEST',
    },
  );
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
