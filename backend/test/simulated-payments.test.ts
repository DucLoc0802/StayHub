import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/bookings/inventory.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { PaymentsService } from '../src/payments/payments.service';
import { BookingAccessService } from '../src/bookings/booking-access.service';
import { LoginDto } from '../src/auth/auth.dto';
import { demoAccounts } from '../prisma/demo-data';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { NotFoundException } from '@nestjs/common';
import {
  customerDestination,
  roleHome,
  roleRedirect,
} from '../../frontend/src/lib/role-routes';

test('short account aliases preserve emails and centralized role redirects never enter another workspace', () => {
  assert.deepEqual(
    demoAccounts.map((a) => a[1]),
    ['admin01', 'guest01', 'host01', 'host02', 'host03', 'host04', 'host05'],
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
  'simulated payment uses real MySQL locks, preserves historical records and remains idempotent',
  { skip: !url },
  async (t) => {
    assert.match(new URL(url!).pathname, /^\/stayhub_(inventory|seed)_test$/);
    const prisma = new PrismaService({ datasources: { db: { url } } });
    const inventory = new InventoryService(prisma),
      payments = new PaymentsService(inventory, prisma),
      bookings = new BookingsService(prisma, inventory),
      access = new BookingAccessService(prisma, inventory);
    const users: string[] = [];
    const user = async (role: 'HOST' | 'ADMIN' | 'GUEST') => {
      const u = await prisma.user.create({
        data: {
          email: randomUUID() + '@simulated.test',
          fullName: 'Nguyễn Thị Ánh',
          phoneNumber: '0901234567',
          passwordHash: 'unused',
          role,
          status: 'ACTIVE',
        },
      });
      users.push(u.id);
      return u;
    };
    const host = await user('HOST'),
      admin = await user('ADMIN'),
      guest = await user('GUEST'),
      other = await user('GUEST');
    const property = await prisma.property.create({
      data: {
        hostId: host.id,
        name: 'Nhà nghỉ Ánh Dương',
        address: 'Đường Nguyễn Huệ',
        district: 'Quận 1',
        description: 'Synthetic fixture',
        type: 'HOTEL',
        depositPercent: 30,
        roomTypes: {
          create: {
            name: 'Phòng đôi',
            description: '',
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
    const room = property.roomTypes[0];
    let slot = 60;
    const create = async () => {
      slot += 3;
      return bookings.create(guest.id, {
        roomTypeId: room.id,
        checkIn: new Date(Date.now() + slot * 86400000)
          .toISOString()
          .slice(0, 10),
        checkOut: new Date(Date.now() + (slot + 2) * 86400000)
          .toISOString()
          .slice(0, 10),
        guestCount: 2,
        quantity: 1,
      });
    };
    try {
      await t.test(
        'concurrent clicks settle once; refresh and cancelled receipts keep persisted snapshots',
        async () => {
          const b = await create();
          await assert.rejects(access.invoice(guest, b.id), ConflictException);
          for (const u of [host, admin])
            await assert.rejects(payments.pay(b.id, u.id), ForbiddenException);
          await assert.rejects(payments.pay(b.id, other.id), NotFoundException);
          const history = await prisma.paymentAttempt.create({
            data: {
              bookingId: b.id,
              amount: 123,
              status: 'FAILED',
              method: 'MOMO_MANUAL',
              transactionRef: 'OLD-' + randomUUID(),
              failureReason: 'Historical failure',
            },
          });
          const [a, c] = await Promise.all([
            payments.pay(b.id, guest.id),
            payments.pay(b.id, guest.id),
          ]);
          assert.equal(a.status, 'CONFIRMED');
          assert.equal(a.payment!.id, c.payment!.id);
          assert.equal(a.payment!.method, 'FAKE');
          assert.equal(a.payment!.amount, b.depositAmount);
          assert.equal(
            await prisma.payment.count({ where: { bookingId: b.id } }),
            1,
          );
          assert.equal(
            await prisma.paymentAttempt.count({
              where: { bookingId: b.id, status: 'SUCCESS' },
            }),
            1,
          );
          assert.equal(
            await prisma.bookingEvent.count({
              where: { bookingId: b.id, type: 'CONFIRMED' },
            }),
            1,
          );
          assert.deepEqual(
            await prisma.paymentAttempt.findUnique({
              where: { id: history.id },
            }),
            history,
          );
          assert.equal(
            (await payments.checkout(b.id, guest.id)).booking.payment!.id,
            a.payment!.id,
          );
          assert.ok(
            (await bookings.mine(guest.id)).some((row) => row.id === b.id),
          );
          assert.equal(
            (
              await bookings.availability(room.id, {
                checkIn: b.checkIn.toISOString().slice(0, 10),
                checkOut: b.checkOut.toISOString().slice(0, 10),
              })
            ).availableUnits,
            0,
          );
          await prisma.property.update({
            where: { id: property.id },
            data: { name: 'Changed', address: 'Changed' },
          });
          await prisma.roomType.update({
            where: { id: room.id },
            data: { pricePerNight: 999999, name: 'Changed' },
          });
          const invoice = await access.invoice(guest, b.id);
          assert.equal(invoice.propertyNameSnapshot, property.name);
          assert.equal(invoice.nightlyPriceSnapshot, 500000);
          await assert.rejects(access.invoice(other, b.id), NotFoundException);
          await bookings.cancel(b.id, guest.id);
          const cancelled = await access.invoice(guest, b.id);
          assert.equal(cancelled.status, 'CANCELLED');
          assert.deepEqual(cancelled.payment, a.payment);
          assert.equal(
            (await payments.pay(b.id, guest.id)).status,
            'CANCELLED',
          );
        },
      );
      await t.test(
        'expired, cancelled, inactive and unavailable bookings create no settlement',
        async () => {
          const expired = await create();
          await prisma.booking.update({
            where: { id: expired.id },
            data: { paymentDeadlineAt: new Date(Date.now() - 1000) },
          });
          await assert.rejects(
            payments.pay(expired.id, guest.id),
            ConflictException,
          );
          assert.equal(
            (
              await prisma.booking.findUniqueOrThrow({
                where: { id: expired.id },
              })
            ).status,
            'EXPIRED',
          );
          const cancelled = await create();
          await bookings.cancel(cancelled.id, guest.id);
          await assert.rejects(
            payments.pay(cancelled.id, guest.id),
            ConflictException,
          );
          const inactive = await create();
          await prisma.roomType.update({
            where: { id: room.id },
            data: { status: 'INACTIVE' },
          });
          await assert.rejects(
            payments.pay(inactive.id, guest.id),
            ConflictException,
          );
          await prisma.roomType.update({
            where: { id: room.id },
            data: { status: 'ACTIVE' },
          });
          await bookings.cancel(inactive.id, guest.id);
          const unavailable = await create();
          // Deliberately inject legacy inconsistent inventory; payment must recheck it.
          const rival = await prisma.booking.create({
            data: {
              ...Object.fromEntries(
                Object.entries(unavailable).filter(
                  ([key]) =>
                    ![
                      'id',
                      'roomType',
                      'property',
                      'events',
                      'timeline',
                      'payment',
                      'paymentAttempts',
                      'feedback',
                    ].includes(key),
                ),
              ),
              guestId: other.id,
              bookingCode: 'STB-' + randomUUID(),
              status: 'CONFIRMED',
            } as Parameters<typeof prisma.booking.create>[0]['data'],
          });
          await assert.rejects(
            payments.pay(unavailable.id, guest.id),
            ConflictException,
          );
          await prisma.booking.delete({ where: { id: rival.id } });
          await bookings.cancel(unavailable.id, guest.id);
          assert.equal(
            await prisma.payment.count({
              where: {
                bookingId: {
                  in: [expired.id, cancelled.id, inactive.id, unavailable.id],
                },
              },
            }),
            0,
          );
        },
      );
      await t.test(
        'old MoMo settlement and attempts are returned unchanged',
        async () => {
          const b = await create();
          const old = await prisma.payment.create({
            data: {
              bookingId: b.id,
              amount: 123456,
              method: 'MOMO_MANUAL',
              status: 'SUCCESS',
              paidAt: new Date('2025-01-01'),
            },
          });
          await prisma.booking.update({
            where: { id: b.id },
            data: { status: 'CONFIRMED' },
          });
          const result = await payments.pay(b.id, guest.id);
          assert.deepEqual(result.payment, old);
          assert.equal(result.paymentAttempts.length, 0);
          assert.equal(
            (await access.invoice(guest, b.id)).payment!.amount,
            123456,
          );
        },
      );
    } finally {
      await prisma.payment.deleteMany({
        where: { booking: { guestId: { in: users } } },
      });
      await prisma.booking.deleteMany({ where: { guestId: { in: users } } });
      await prisma.roomType.deleteMany({ where: { propertyId: property.id } });
      await prisma.property.delete({ where: { id: property.id } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.$disconnect();
    }
  },
);
