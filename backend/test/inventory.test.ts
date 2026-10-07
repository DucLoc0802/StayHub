import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/bookings/inventory.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { PaymentsService } from '../src/payments/payments.service';
import { PropertiesService } from '../src/properties/properties.service';
import { RoomTypeDto } from '../src/properties/property.dto';

const url = process.env.INVENTORY_TEST_DATABASE_URL;
test(
  'MySQL inventory, payment and anti-abuse transactions',
  { skip: !url },
  async (t) => {
    assert.match(new URL(url!).pathname, /^\/stayhub_(inventory|seed)_test$/);
    const prisma = new PrismaService({ datasources: { db: { url } } });
    const inventory = new InventoryService(prisma),
      bookings = new BookingsService(prisma, inventory),
      payments = new PaymentsService(inventory),
      properties = new PropertiesService(prisma, inventory);
    const guests: string[] = [],
      propertyIds: string[] = [];
    const guest = async () => {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@inventory.test`,
          fullName: 'Inventory test',
          phoneNumber: '0901234567',
          passwordHash: 'test',
          role: 'GUEST',
          status: 'ACTIVE',
        },
      });
      guests.push(user.id);
      return user.id;
    };
    const hostId = await guest();
    await prisma.user.update({ where: { id: hostId }, data: { role: 'HOST' } });
    const date = (n: number) =>
      new Date(Date.now() + (60 + n) * 86400000).toISOString().slice(0, 10);
    const dto = (roomTypeId: string, quantity = 1, from = 0, to = 3) => ({
      roomTypeId,
      quantity,
      guestCount: quantity,
      checkIn: date(from),
      checkOut: date(to),
    });
    const room = async (
      totalUnits = 10,
      type: 'HOTEL' | 'HOMESTAY' = 'HOTEL',
    ) => {
      const p = await prisma.property.create({
        data: {
          hostId,
          type,
          name: 'Inventory test property',
          description: 'Synthetic integration test accommodation',
          district: 'Quận 1',
          address: 'Synthetic address',
          depositPercent: 30,
          roomTypes: {
            create: {
              name: 'Phòng kiểm thử',
              description: '',
              pricePerNight: 600000,
              totalUnits,
              maxGuests: 2,
              bedrooms: 1,
              beds: 1,
              bathrooms: 1,
            },
          },
        },
        include: { roomTypes: true },
      });
      propertyIds.push(p.id);
      return p.roomTypes[0];
    };
    const conflict = async (work: Promise<unknown>, code = 409) =>
      assert.rejects(
        work,
        (error: unknown) =>
          error instanceof HttpException && error.getStatus() === code,
      );
    const expire = async (id: string) =>
      prisma.booking.update({
        where: { id },
        data: { paymentDeadlineAt: new Date(Date.now() - 1000) },
      });
    try {
      await t.test(
        '1: ten hotel units, five occupied, request five succeeds and snapshots quantity',
        async () => {
          const r = await room();
          const a = await bookings.create(await guest(), dto(r.id, 5));
          await payments.pay(a.id, a.guestId);
          const b = await bookings.create(await guest(), dto(r.id, 5));
          assert.equal(b.totalAmount, 600000 * 5 * 3);
          assert.equal(b.depositAmount, b.totalAmount * 0.3);
          assert.equal(
            (await bookings.availability(r.id, dto(r.id))).availableUnits,
            0,
          );
        },
      );
      await t.test('2: five occupied, request six returns 409', async () => {
        const r = await room();
        await bookings.create(await guest(), dto(r.id, 5));
        await conflict(bookings.create(await guest(), dto(r.id, 6)));
      });
      await t.test('3: each night has independent occupancy', async () => {
        const r = await room();
        await bookings.create(await guest(), dto(r.id, 2, 0, 3));
        await bookings.create(await guest(), dto(r.id, 3, 1, 4));
        assert.deepEqual(
          (await bookings.availability(r.id, dto(r.id, 1, 0, 5))).days.map(
            (d) => d.availableUnits,
          ),
          [8, 5, 5, 7, 10],
        );
      });
      await t.test(
        '4–7: hotel/homestay overlap rejected; adjacent checkout allowed',
        async () => {
          for (const type of ['HOTEL', 'HOMESTAY'] as const) {
            const r = await room(1, type);
            await bookings.create(await guest(), dto(r.id, 1, 0, 2));
            await conflict(bookings.create(await guest(), dto(r.id, 1, 0, 1)));
            await conflict(bookings.create(await guest(), dto(r.id, 1, 1, 4)));
            await bookings.create(await guest(), dto(r.id, 1, 2, 4));
          }
        },
      );
      await t.test(
        '8–9: pending holds inventory; scheduler sweep expires and releases it',
        async () => {
          const r = await room(1),
            g = await guest();
          const b = await bookings.create(g, dto(r.id));
          assert.equal(
            (await bookings.availability(r.id, dto(r.id))).availableUnits,
            0,
          );
          await expire(b.id);
          await inventory.sweep();
          const expired = await prisma.booking.findUniqueOrThrow({
            where: { id: b.id },
          });
          assert.equal(expired.status, 'EXPIRED');
          assert.equal(
            expired.expiredAt!.getTime(),
            expired.paymentDeadlineAt.getTime(),
          );
          assert.equal(
            (await bookings.availability(r.id, dto(r.id))).availableUnits,
            1,
          );
        },
      );
      await t.test(
        '10: late payment rejects and commits lazy expiry, with no payment record',
        async () => {
          const r = await room(1),
            g = await guest(),
            b = await bookings.create(g, dto(r.id));
          await expire(b.id);
          await conflict(payments.pay(b.id, g));
          assert.equal(
            (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }))
              .status,
            'EXPIRED',
          );
          assert.equal(
            await prisma.payment.count({ where: { bookingId: b.id } }),
            0,
          );
          await conflict(bookings.cancel(b.id, g));
        },
      );
      await t.test(
        '11–12: maximum two unpaid; confirmed does not count',
        async () => {
          const r = await room(),
            g = await guest();
          const a = await bookings.create(g, dto(r.id, 1, 0, 1));
          await bookings.create(g, dto(r.id, 1, 1, 2));
          await conflict(bookings.create(g, dto(r.id, 1, 2, 3)));
          await payments.pay(a.id, g);
          await bookings.create(g, dto(r.id, 1, 2, 3));
          assert.equal((await bookings.eligibility(g)).activeUnpaidBookings, 2);
        },
      );
      await t.test(
        '13: same guest cannot create overlapping holds on same room type',
        async () => {
          const r = await room(),
            g = await guest();
          await bookings.create(g, dto(r.id));
          await conflict(bookings.create(g, dto(r.id, 1, 2, 4)));
        },
      );
      await t.test(
        '14–15: three expirations block temporarily; elapsed block allows booking again',
        async () => {
          const r = await room(),
            g = await guest();
          for (let i = 0; i < 3; i++) {
            const b = await bookings.create(g, dto(r.id));
            await expire(b.id);
            await conflict(payments.pay(b.id, g));
          }
          const state = await bookings.eligibility(g);
          assert.ok(state.bookingBlockedUntil);
          await conflict(bookings.create(g, dto(r.id)), 403);
          await prisma.user.update({
            where: { id: g },
            data: { bookingBlockedUntil: new Date(Date.now() - 1) },
          });
          await bookings.create(g, dto(r.id));
          assert.equal(
            (await bookings.eligibility(g)).bookingBlockedUntil,
            null,
          );
        },
      );
      await t.test(
        '16: requests inside minimum lead time are rejected before creating a hold',
        async () => {
          const r = await room(),
            g = await guest();
          const arrival = new Date(
            Date.now() + 90 * 60000 + 7 * 3600000,
          ).toISOString();
          await prisma.property.update({
            where: { id: r.propertyId },
            data: { checkInTime: arrival.slice(11, 16) },
          });
          await conflict(
            bookings.create(g, {
              ...dto(r.id),
              checkIn: arrival.slice(0, 10),
              checkOut: new Date(
                new Date(arrival.slice(0, 10)).getTime() + 86400000,
              )
                .toISOString()
                .slice(0, 10),
            }),
            400,
          );
          assert.equal(
            await prisma.booking.count({ where: { guestId: g } }),
            0,
          );
        },
      );
      await t.test(
        '17: arrival within 24 hours caps host window at one hour',
        async () => {
          const r = await room(),
            g = await guest(),
            arrival = new Date(
              Date.now() + 12 * 3600000 + 7 * 3600000,
            ).toISOString();
          await prisma.property.update({
            where: { id: r.propertyId },
            data: {
              checkInTime: arrival.slice(11, 16),
              paymentWindowHours: 24,
            },
          });
          const b = await bookings.create(g, {
            ...dto(r.id),
            checkIn: arrival.slice(0, 10),
            checkOut: new Date(
              new Date(arrival.slice(0, 10)).getTime() + 86400000,
            )
              .toISOString()
              .slice(0, 10),
          });
          assert.ok(
            Math.abs(
              b.paymentDeadlineAt.getTime() - b.createdAt.getTime() - 3600000,
            ) < 2000,
          );
        },
      );
      await t.test(
        '18: timely payment confirms exactly once, preserves inventory and snapshots after host edit',
        async () => {
          const r = await room(1),
            g = await guest(),
            b = await bookings.create(g, dto(r.id));
          await prisma.roomType.update({
            where: { id: r.id },
            data: { name: 'Changed', pricePerNight: 999999 },
          });
          const paid = await payments.pay(b.id, g);
          assert.equal(paid.status, 'CONFIRMED');
          assert.equal(paid.payment!.amount, b.depositAmount);
          assert.equal(paid.roomTypeNameSnapshot, r.name);
          assert.equal(
            (await bookings.availability(r.id, dto(r.id))).availableUnits,
            0,
          );
          await conflict(payments.pay(b.id, g));
          await bookings.cancel(b.id, g);
          assert.equal(
            (await bookings.availability(r.id, dto(r.id))).availableUnits,
            1,
          );
          await conflict(payments.pay(b.id, g));
        },
      );
      await t.test(
        '19: concurrent guests compete for last unit, exactly one wins',
        async () => {
          const r = await room(1),
            a = await guest(),
            b = await guest();
          const results = await Promise.allSettled([
            bookings.create(a, dto(r.id)),
            bookings.create(b, dto(r.id)),
          ]);
          assert.equal(
            results.filter((result) => result.status === 'fulfilled').length,
            1,
          );
          const rejected = results.find(
            (result) => result.status === 'rejected',
          ) as PromiseRejectedResult;
          assert.equal((rejected.reason as HttpException).getStatus(), 409);
        },
      );
      await t.test(
        'concurrent requests across properties cannot bypass guest unpaid limit',
        async () => {
          const g = await guest(),
            rooms = await Promise.all([room(), room(), room()]);
          const results = await Promise.allSettled(
            rooms.map((r) => bookings.create(g, dto(r.id))),
          );
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            2,
          );
          assert.equal((await bookings.eligibility(g)).activeUnpaidBookings, 2);
        },
      );
      await t.test(
        'host ownership, homestay inventory, active status and occupied inventory validation',
        async () => {
          const r = await room(10),
            g = await guest();
          await bookings.create(g, dto(r.id, 5));
          const fields: RoomTypeDto = {
            id: r.id,
            name: r.name,
            description: r.description,
            totalUnits: 4,
            pricePerNight: r.pricePerNight,
            maxGuests: r.maxGuests,
            bedrooms: r.bedrooms,
            beds: r.beds,
            bathrooms: r.bathrooms,
            status: r.status,
          };
          await conflict(
            properties.update(r.propertyId, hostId, { roomTypes: [fields] }),
          );
          await conflict(
            properties.update(r.propertyId, g, { name: 'Not owned' }),
            404,
          );
          await conflict(
            properties.update(r.propertyId, hostId, { type: 'HOMESTAY' }),
            400,
          );
          await properties.update(r.propertyId, hostId, {
            roomTypes: [{ ...fields, totalUnits: 10, status: 'INACTIVE' }],
          });
          await conflict(bookings.create(await guest(), dto(r.id)), 404);
          const home = await room(1, 'HOMESTAY');
          await conflict(bookings.create(await guest(), dto(home.id, 2)), 400);
          await properties.status(home.propertyId, hostId, 'INACTIVE');
          await conflict(bookings.create(await guest(), dto(home.id)), 404);
        },
      );
      await t.test(
        'user cancellations never contribute expiration strikes',
        async () => {
          const r = await room(),
            g = await guest();
          for (let i = 0; i < 4; i++) {
            const b = await bookings.create(g, dto(r.id));
            await bookings.cancel(b.id, g);
          }
          assert.equal(
            (await bookings.eligibility(g)).bookingBlockedUntil,
            null,
          );
        },
      );
    } finally {
      await prisma.payment.deleteMany({
        where: { booking: { guestId: { in: guests } } },
      });
      await prisma.booking.deleteMany({ where: { guestId: { in: guests } } });
      await prisma.roomType.deleteMany({
        where: { propertyId: { in: propertyIds } },
      });
      await prisma.property.deleteMany({ where: { id: { in: propertyIds } } });
      await prisma.user.deleteMany({ where: { id: { in: guests } } });
      await prisma.$disconnect();
    }
  },
);
