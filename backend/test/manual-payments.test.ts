import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/bookings/inventory.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { PaymentsService } from '../src/payments/payments.service';
import { FeedbackService } from '../src/feedback/feedback.module';
import { LoginDto } from '../src/auth/auth.dto';
import { demoAccounts } from '../prisma/demo-data';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  customerDestination,
  roleHome,
  roleRedirect,
} from '../../frontend/src/lib/role-routes';

test('short account aliases preserve emails and centralized role redirects never enter another workspace', () => {
  assert.deepEqual(
    demoAccounts.map((a) => a[1]),
    ['admin01', 'guest01', 'guest02', 'host01', 'host02', 'host03', 'host04'],
  );
  for (const [email, name] of demoAccounts) {
    const login = plainToInstance(LoginDto, {
      email: name,
      password: 'Synthetic-test-password-123',
    });
    assert.equal(login.email, email);
    assert.equal(validateSync(login).length, 0);
  }
  for (const role of ['ADMIN', 'HOST', 'GUEST'] as const) {
    assert.equal(
      roleRedirect({ role, status: 'ACTIVE' }, roleHome(role)),
      null,
    );
    for (const other of ['ADMIN', 'HOST', 'GUEST'] as const)
      if (role !== other)
        assert.ok(
          roleRedirect(
            { role, status: 'ACTIVE' },
            other === 'GUEST' ? '/bookings/example/payment' : roleHome(other),
          ),
        );
  }
  for (const value of [
    'https://evil.test',
    '//evil.test',
    '/admin',
    '/host',
    '/\\evil.test',
  ])
    assert.equal(customerDestination(value), '/properties');
  assert.equal(
    customerDestination('/bookings/abc/payment'),
    '/bookings/abc/payment',
  );
});

const url = process.env.INVENTORY_TEST_DATABASE_URL;
test(
  'manual MoMo claims, verified settlement, expiry, duplicates and public review integrity use real MySQL transactions',
  { skip: !url },
  async (t) => {
    assert.match(new URL(url!).pathname, /^\/stayhub_(inventory|seed)_test$/);
    const prisma = new PrismaService({ datasources: { db: { url } } });
    const inventory = new InventoryService(prisma),
      bookings = new BookingsService(prisma, inventory),
      payments = new PaymentsService(inventory, prisma),
      feedback = new FeedbackService(prisma, inventory);
    const users: string[] = [],
      properties: string[] = [];
    const config = {
      name: process.env.MOMO_RECEIVER_NAME,
      phone: process.env.MOMO_RECEIVER_PHONE,
      window: process.env.MOMO_VERIFICATION_WINDOW_MINUTES,
    };
    const user = async (role: 'HOST' | 'GUEST' | 'ADMIN') => {
      const row = await prisma.user.create({
        data: {
          email: randomUUID() + '@manual.test',
          fullName: role + ' fixture',
          phoneNumber: '0901234567',
          passwordHash: 'unused',
          role,
          status: 'ACTIVE',
        },
      });
      users.push(row.id);
      return row.id;
    };
    const host = await user('HOST'),
      admin = await user('ADMIN'),
      guest = await user('GUEST'),
      other = await user('GUEST');
    const p = await prisma.property.create({
      data: {
        hostId: host,
        type: 'HOTEL',
        name: 'Manual verification fixture',
        description: 'Synthetic test accommodation',
        district: 'Quận 1',
        address: 'Synthetic address',
        depositPercent: 30,
        roomTypes: {
          create: {
            name: 'Standard',
            description: 'Room',
            pricePerNight: 500000,
            totalUnits: 1,
            maxGuests: 2,
            bedrooms: 1,
            beds: 1,
            bathrooms: 1,
          },
        },
      },
      include: { roomTypes: true },
    });
    properties.push(p.id);
    const date = (n: number) =>
      new Date(Date.now() + (40 + n) * 86400000).toISOString().slice(0, 10);
    let slot = 0;
    const create = async (guestId = guest) => {
      slot += 3;
      return bookings.create(guestId, {
        roomTypeId: p.roomTypes[0].id,
        checkIn: date(slot),
        checkOut: date(slot + 2),
        quantity: 1,
        guestCount: 1,
      });
    };
    const ref = () => 'MT-' + randomUUID();
    try {
      await t.test(
        'missing recipient disables checkout and creates no fake payment',
        async () => {
          delete process.env.MOMO_RECEIVER_NAME;
          delete process.env.MOMO_RECEIVER_PHONE;
          const b = await create();
          assert.equal(
            (await payments.checkout(b.id, guest)).recipient.available,
            false,
          );
          await assert.rejects(
            payments.submit(b.id, guest, { transactionRef: ref() }),
            ServiceUnavailableException,
          );
          assert.equal(
            await prisma.paymentAttempt.count({ where: { bookingId: b.id } }),
            0,
          );
          await bookings.cancel(b.id, guest);
          process.env.MOMO_RECEIVER_NAME = 'Synthetic receiver';
          process.env.MOMO_RECEIVER_PHONE = '0900000009';
          process.env.MOMO_VERIFICATION_WINDOW_MINUTES = '5';
        },
      );
      await t.test(
        'claim is unpaid, bounded, idempotent and only Admin can verify a matching received transfer',
        async () => {
          const b = await create();
          const reference = ref();
          const pending = await payments.submit(b.id, guest, {
            transactionRef: reference,
            evidenceNote: 'Private reference note',
          });
          assert.equal(pending.status, 'PENDING_PAYMENT');
          assert.equal(pending.payment, null);
          assert.equal((await bookings.mine(guest)).length, 0);
          const claim = pending.paymentAttempts.at(-1)!;
          assert.equal(claim.status, 'SUBMITTED');
          assert.ok(
            claim.verificationDeadlineAt!.getTime() <= Date.now() + 5 * 60000,
          );
          assert.equal(
            (await payments.submit(b.id, guest, { transactionRef: reference }))
              .paymentAttempts.length,
            1,
          );
          await assert.rejects(
            payments.submit(b.id, guest, { transactionRef: ref() }),
            ConflictException,
          );
          const review = {
            decision: 'VERIFY' as const,
            receivedAmount: claim.amount,
            verifiedTransactionRef: reference,
          };
          await assert.rejects(
            payments.review(claim.id, host, review),
            ForbiddenException,
          );
          await assert.rejects(
            payments.review(claim.id, admin, { ...review, receivedAmount: 1 }),
            BadRequestException,
          );
          assert.equal(
            await prisma.payment.count({ where: { bookingId: b.id } }),
            0,
          );
          const [a, c] = await Promise.all([
            payments.review(claim.id, admin, review),
            payments.review(claim.id, admin, review),
          ]);
          assert.equal(a.payment!.id, c.payment!.id);
          assert.equal(a.status, 'CONFIRMED');
          assert.equal(a.payment!.method, 'MOMO_MANUAL');
          assert.equal(
            await prisma.payment.count({ where: { bookingId: b.id } }),
            1,
          );
          assert.equal(a.paymentAttempts[0].reviewedById, admin);
          const competitor = await bookings.availability(p.roomTypes[0].id, {
            checkIn: b.checkIn.toISOString().slice(0, 10),
            checkOut: b.checkOut.toISOString().slice(0, 10),
          });
          assert.equal(competitor.availableUnits, 0);
          const rival = await create(other);
          await assert.rejects(
            payments.submit(rival.id, other, { transactionRef: reference }),
            ConflictException,
          );
          await bookings.cancel(rival.id, other);
          await prisma.booking.update({
            where: { id: b.id },
            data: {
              checkIn: new Date('2020-01-01'),
              checkOut: new Date('2020-01-03'),
            },
          });
          await feedback.create(guest, b.id, {
            rating: 4,
            content: 'Verified completed stay fixture',
          });
          assert.equal((await feedback.recent(p.id)).count, 1);
        },
      );
      await t.test(
        'rejected reference remains in history and retry requires another reference',
        async () => {
          const b = await create();
          const pending = await payments.submit(b.id, guest, {
            transactionRef: ref(),
          });
          const claim = pending.paymentAttempts.at(-1)!;
          await payments.review(claim.id, admin, {
            decision: 'REJECT',
            reason: 'Reference not found in receiving account',
          });
          const retry = await payments.submit(b.id, guest, {
            transactionRef: ref(),
          });
          assert.deepEqual(retry.paymentAttempts.map((p) => p.status).sort(), [
            'FAILED',
            'SUBMITTED',
          ]);
          assert.equal(retry.payment, null);
          await bookings.cancel(b.id, guest);
          assert.equal(
            (await payments.checkout(b.id, guest)).booking.paymentAttempts.at(
              -1,
            )!.status,
            'RESOLUTION_REQUIRED',
          );
        },
      );
      await t.test(
        'expired submitted and late claims survive, release inventory and cannot confirm a competing reservation',
        async () => {
          const b = await create(),
            reference = ref();
          const pending = await payments.submit(b.id, guest, {
            transactionRef: reference,
          });
          const claim = pending.paymentAttempts.at(-1)!;
          await prisma.booking.update({
            where: { id: b.id },
            data: { paymentDeadlineAt: new Date(Date.now() - 1000) },
          });
          await inventory.sweep();
          await inventory.sweep();
          const expired = await payments.checkout(b.id, guest);
          assert.equal(expired.booking.status, 'EXPIRED');
          assert.equal(
            expired.booking.paymentAttempts[0].status,
            'RESOLUTION_REQUIRED',
          );
          const rival = await bookings.create(other, {
            roomTypeId: b.roomTypeId,
            checkIn: b.checkIn.toISOString().slice(0, 10),
            checkOut: b.checkOut.toISOString().slice(0, 10),
            quantity: 1,
            guestCount: 1,
          });
          const reviewed = await payments.review(claim.id, admin, {
            decision: 'VERIFY',
            receivedAmount: claim.amount,
            verifiedTransactionRef: reference,
          });
          assert.equal(reviewed.status, 'EXPIRED');
          assert.equal(reviewed.payment, null);
          assert.equal(
            reviewed.paymentAttempts[0].status,
            'RESOLUTION_REQUIRED',
          );
          const audit = reviewed.paymentAttempts[0];
          const repeated = await payments.review(claim.id, admin, {
            decision: 'RESOLUTION_REQUIRED',
            reason: 'Another request must preserve the original reason',
          });
          assert.equal(
            repeated.paymentAttempts[0].failureReason,
            audit.failureReason,
          );
          assert.equal(
            repeated.paymentAttempts[0].reviewedAt?.getTime(),
            audit.reviewedAt?.getTime(),
          );
          await assert.rejects(
            payments.review(claim.id, admin, {
              decision: 'REJECT',
              reason: 'Cannot overwrite the audited result',
            }),
            ConflictException,
          );
          assert.ok(
            (await bookings.pending(guest)).some((row) => row.id === b.id),
          );
          await bookings.cancel(rival.id, other);
          const late = await create();
          await prisma.booking.update({
            where: { id: late.id },
            data: { paymentDeadlineAt: new Date(Date.now() - 1000) },
          });
          const result = await payments.submit(late.id, guest, {
            transactionRef: ref(),
          });
          assert.equal(result.paymentAttempts[0].status, 'RESOLUTION_REQUIRED');
          assert.equal(result.payment, null);
        },
      );
      await t.test('synthetic payment reviews are never public', async () => {
        const b = await create();
        await prisma.booking.update({
          where: { id: b.id },
          data: {
            status: 'CONFIRMED',
            checkIn: new Date('2020-02-01'),
            checkOut: new Date('2020-02-02'),
            payment: {
              create: {
                amount: b.depositAmount,
                status: 'SUCCESS',
                method: 'FAKE',
                paidAt: new Date(),
              },
            },
          },
        });
        await assert.rejects(
          feedback.create(guest, b.id, {
            rating: 5,
            content: 'Synthetic should not be public',
          }),
          ConflictException,
        );
        await prisma.feedback.create({
          data: {
            bookingId: b.id,
            guestId: guest,
            propertyId: p.id,
            rating: 5,
            content: 'Old synthetic rating',
          },
        });
        assert.equal((await feedback.recent(p.id)).count, 1);
      });
    } finally {
      await prisma.feedback.deleteMany({ where: { guestId: { in: users } } });
      await prisma.payment.deleteMany({
        where: { booking: { guestId: { in: users } } },
      });
      await prisma.booking.deleteMany({ where: { guestId: { in: users } } });
      await prisma.roomType.deleteMany({
        where: { propertyId: { in: properties } },
      });
      await prisma.property.deleteMany({ where: { id: { in: properties } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.$disconnect();
      for (const [key, value] of Object.entries({
        MOMO_RECEIVER_NAME: config.name,
        MOMO_RECEIVER_PHONE: config.phone,
        MOMO_VERIFICATION_WINDOW_MINUTES: config.window,
      }))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
  },
);
