import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, connect, Socket } from 'node:net';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/bookings/inventory.service';
import { BookingsService } from '../src/bookings/bookings.service';
import { PaymentsService } from '../src/payments/payments.service';

const database = process.env.INVENTORY_TEST_DATABASE_URL;
test(
  'payment completes over a slow database connection and persists one settlement',
  {
    skip: !database,
    timeout: 60000,
  },
  async () => {
    const url = new URL(database!);
    assert.match(url.pathname, /^\/stayhub_(inventory|seed)_test$/);
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
    const databasePort = Number(url.port || 3306),
      databaseHost = url.hostname;
    const prisma = new PrismaService({
      datasources: { db: { url: database } },
    });
    const users: string[] = [];
    let propertyId: string | undefined;
    let slow: PrismaService | undefined;
    const sockets = new Set<Socket>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const proxy = createServer((client) => {
      const upstream = connect(databasePort, databaseHost);
      for (const socket of [client, upstream]) {
        sockets.add(socket);
        socket.on('error', () => {
          client.destroy();
          upstream.destroy();
        });
        socket.on('close', () => sockets.delete(socket));
      }
      client.pipe(upstream);
      upstream.on('data', (data: Buffer) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!client.destroyed) client.write(data);
        }, 300);
        timers.add(timer);
      });
    });
    try {
      const user = async (role: 'GUEST' | 'HOST') => {
        const row = await prisma.user.create({
          data: {
            email: `${randomUUID()}@latency.test`,
            fullName: 'Latency fixture',
            phoneNumber: '0901234567',
            passwordHash: 'unused',
            role,
            status: 'ACTIVE',
          },
        });
        users.push(row.id);
        return row;
      };
      const guest = await user('GUEST'),
        host = await user('HOST');
      const property = await prisma.property.create({
        data: {
          hostId: host.id,
          name: 'Latency fixture',
          type: 'HOTEL',
          description: '',
          district: 'Quận 1',
          address: 'Synthetic address',
          depositPercent: 30,
          roomTypes: {
            create: {
              name: 'Room',
              description: '',
              pricePerNight: 760000,
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
      propertyId = property.id;
      const bookings = new BookingsService(
        prisma,
        new InventoryService(prisma),
      );
      const booking = await bookings.create(guest.id, {
        roomTypeId: property.roomTypes[0].id,
        quantity: 1,
        guestCount: 2,
        checkIn: new Date(Date.now() + 60 * 86400000)
          .toISOString()
          .slice(0, 10),
        checkOut: new Date(Date.now() + 61 * 86400000)
          .toISOString()
          .slice(0, 10),
      });
      await new Promise<void>((resolve) =>
        proxy.listen(0, '127.0.0.1', resolve),
      );
      const address = proxy.address();
      assert.ok(address && typeof address !== 'string');
      url.hostname = '127.0.0.1';
      url.port = String(address.port);
      slow = new PrismaService({
        datasources: { db: { url: url.toString() } },
      });
      await slow.$connect();
      const payments = new PaymentsService(new InventoryService(slow), slow);
      const paid = await payments.pay(booking.id, guest.id);
      assert.equal(paid.status, 'CONFIRMED');
      assert.equal(paid.payment?.amount, booking.depositAmount);
      assert.equal(paid.payment?.method, 'FAKE');
      const persisted = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { payment: true, paymentAttempts: true, events: true },
      });
      assert.equal(persisted.status, paid.status);
      assert.deepEqual(persisted.payment, paid.payment);
      assert.equal(persisted.paymentAttempts.length, 1);
      assert.equal(
        persisted.events.filter((event) => event.type === 'CONFIRMED').length,
        1,
      );
    } finally {
      await slow?.$disconnect();
      for (const timer of timers) clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      if (proxy.listening)
        await new Promise<void>((resolve) => proxy.close(() => resolve()));
      await prisma.payment.deleteMany({
        where: { booking: { guestId: { in: users } } },
      });
      await prisma.booking.deleteMany({ where: { guestId: { in: users } } });
      if (propertyId) {
        await prisma.roomType.deleteMany({ where: { propertyId } });
        await prisma.property.delete({ where: { id: propertyId } });
      }
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.$disconnect();
    }
  },
);
