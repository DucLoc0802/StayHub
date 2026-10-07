import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { demoAccommodations } from '../prisma/demo-data';
const url =
  process.env.SEED_TEST_DATABASE_URL ?? process.env.INVENTORY_TEST_DATABASE_URL;
test(
  'seed is idempotent and preserves host edits, room inventory and booking history',
  { skip: !url },
  async () => {
    assert.match(new URL(url!).pathname, /^\/stayhub_(inventory|seed)_test$/);
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const ids = demoAccommodations.map((p) => p.id);
    const snapshot = () =>
      prisma.property.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
        include: {
          roomTypes: { orderBy: { id: 'asc' } },
          images: { orderBy: { sortOrder: 'asc' } },
          amenities: { orderBy: { amenityId: 'asc' } },
        },
      });
    const seed = () => {
      const result = spawnSync(process.execPath, ['dist/seed/prisma/seed.js'], {
        env: { ...process.env, DATABASE_URL: url },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    };
    try {
      const before = await snapshot();
      assert.equal(before.length, 38);
      assert.equal(before.flatMap((p) => p.roomTypes).length, 62);
      const history = await prisma.booking.findMany({
        where: {
          roomTypeId: {
            in: before.flatMap((p) => p.roomTypes.map((r) => r.id)),
          },
        },
        orderBy: { id: 'asc' },
      });
      seed();
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(
        await prisma.booking.findMany({
          where: { id: { in: history.map((b) => b.id) } },
          orderBy: { id: 'asc' },
        }),
        history,
      );
      const p = before[0],
        r = p.roomTypes[0];
      try {
        await prisma.property.update({
          where: { id: p.id },
          data: {
            name: p.name + ' edited',
            status: 'INACTIVE',
            paymentWindowHours: 12,
          },
        });
        await prisma.roomType.update({
          where: { id: r.id },
          data: {
            name: 'Host edited inventory',
            pricePerNight: 123456,
            status: 'INACTIVE',
          },
        });
        const edited = await snapshot();
        seed();
        assert.deepEqual(await snapshot(), edited);
      } finally {
        await prisma.property.update({
          where: { id: p.id },
          data: {
            name: p.name,
            status: p.status,
            paymentWindowHours: p.paymentWindowHours,
          },
        });
        await prisma.roomType.update({
          where: { id: r.id },
          data: {
            name: r.name,
            pricePerNight: r.pricePerNight,
            status: r.status,
          },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  },
);
