import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '../src/common/security';
import {
  ManagementController,
  ManagementService,
  AdminQueryDto,
} from '../src/admin/management.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/bookings/inventory.service';
import {
  BookingsService,
  bookingResponse,
  bookingInclude,
} from '../src/bookings/bookings.service';
import { ExpirationController } from '../src/bookings/expiration.controller';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';

test('every Admin booking endpoint rejects Guest and Host sessions on the server', async () => {
  for (const role of ['GUEST', 'HOST']) {
    const guard = new AuthGuard(
      new Reflector(),
      { verifyAsync: async () => ({ sub: 'actor' }) } as unknown as JwtService,
      {
        user: {
          findUnique: async () => ({ id: 'actor', role, status: 'ACTIVE' }),
        },
      } as unknown as PrismaService,
    );
    for (const method of ['bookings', 'booking', 'filters'] as const) {
      const context = {
        getHandler: () => ManagementController.prototype[method],
        getClass: () => ManagementController,
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: 'Bearer token' } }),
        }),
      } as unknown as ExecutionContext;
      await assert.rejects(guard.canActivate(context), ForbiddenException);
    }
  }
});

test('paid history and resumable checkout query different persisted states', async () => {
  const where: Prisma.BookingWhereInput[] = [];
  const inventory = {
    forGuest: async (_id: string, fn: (tx: object, now: Date) => unknown) =>
      fn(
        {
          booking: {
            findMany: async (query: { where: Prisma.BookingWhereInput }) => {
              where.push(query.where);
              return [];
            },
          },
        },
        new Date(),
      ),
  } as unknown as InventoryService;
  const bookings = new BookingsService({} as PrismaService, inventory);
  await bookings.mine('customer');
  await bookings.pending('customer');
  assert.deepEqual(where[0], {
    guestId: 'customer',
    payment: { is: { status: 'SUCCESS' } },
  });
  assert.equal(where[1].guestId, 'customer');
  assert.equal(where[1].status, 'PENDING_PAYMENT');
  assert.ok(where[1].paymentDeadlineAt);
});

test('Host branch queries intersect ownership and reject foreign property IDs', async () => {
  let scope: Prisma.BookingWhereInput | undefined;
  const prisma = {
    property: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; hostId: string };
      }) =>
        where.hostId === 'owner' && where.id === 'branch'
          ? { id: 'branch' }
          : null,
    },
    booking: {
      findMany: async ({
        where,
        select,
      }: {
        where: Prisma.BookingWhereInput;
        select?: object;
      }) => {
        if (!select) scope = where;
        return [];
      },
    },
  } as unknown as PrismaService;
  const bookings = new BookingsService(prisma, {} as InventoryService);
  await bookings.host('owner', 'branch');
  assert.deepEqual(scope, {
    roomType: { propertyId: 'branch', property: { hostId: 'owner' } },
  });
  await assert.rejects(bookings.host('outsider', 'branch'), /Không tìm thấy/);
});

test('Admin search combines Host, property, payment status, pagination and historical dates', async () => {
  let query: Prisma.BookingFindManyArgs | undefined;
  const tx = {
    booking: {
      findMany: async (args: Prisma.BookingFindManyArgs) => {
        query = args;
        return [];
      },
      count: async () => 0,
    },
  };
  const prisma = {
    $transaction: async (fn: (tx: object) => unknown) => fn(tx),
  } as unknown as PrismaService;
  const service = new ManagementService(prisma, {
    sweep: async () => undefined,
  } as unknown as InventoryService);
  const page = await service.bookings(
    Object.assign(new AdminQueryDto(), {
      hostId: 'host',
      propertyId: 'property',
      paymentStatus: 'SUCCESS',
      q: 'An Nhiên',
      page: 2,
      limit: 10,
      from: '2020-01-01',
      to: '2020-02-01',
    }),
  );
  assert.equal(page.page, 2);
  assert.equal(query?.skip, 10);
  assert.equal(query?.take, 10);
  assert.deepEqual(query?.where?.roomType, {
    propertyId: 'property',
    property: { hostId: 'host' },
  });
  assert.deepEqual(query?.where?.payment, { is: { status: 'SUCCESS' } });
  assert.ok(query?.where?.OR?.length);
  assert.ok(query?.where?.checkIn);
});

test('historical timeline uses recorded evidence and never invents confirmation/completion', () => {
  const legacy = {
    id: 'booking',
    status: 'CONFIRMED',
    createdAt: new Date('2020-01-01'),
    cancelledAt: null,
    expiredAt: null,
    roomType: { property: { name: 'An Nhiên' } },
    payment: {
      id: 'payment',
      status: 'SUCCESS',
      paidAt: new Date('2020-01-02'),
      createdAt: new Date('2020-01-02'),
      amount: 100,
    },
    events: [],
    paymentAttempts: [],
  } as unknown as Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
  assert.deepEqual(
    bookingResponse(legacy).timeline.map((e) => e.type),
    ['CREATED', 'PAYMENT_SUCCESS'],
  );
  const recorded = {
    ...legacy,
    events: [
      {
        id: 'confirmed',
        type: 'CONFIRMED',
        status: 'CONFIRMED',
        createdAt: new Date('2020-01-02'),
        bookingId: 'booking',
      },
    ],
  } as typeof legacy;
  assert.deepEqual(
    bookingResponse(recorded).timeline.map((e) => e.type),
    ['CREATED', 'PAYMENT_SUCCESS', 'CONFIRMED'],
  );
});

test('expiration job requires its own secret and rejects missing or invalid credentials', async () => {
  const saved = process.env.CRON_SECRET;
  let calls = 0;
  const controller = new ExpirationController({
    sweep: async () => {
      calls++;
    },
  } as unknown as InventoryService);
  try {
    delete process.env.CRON_SECRET;
    await assert.rejects(controller.expire(), UnauthorizedException);
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    await assert.rejects(
      controller.expire('Bearer wrong'),
      UnauthorizedException,
    );
    assert.deepEqual(await controller.expire('Bearer synthetic-cron-secret'), {
      ok: true,
    });
    assert.equal(calls, 1);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});
