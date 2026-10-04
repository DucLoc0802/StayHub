import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  demoProperties,
  demoAccounts,
  demoPasswords,
  demoAmenities,
  legacySeedProperties,
} from '../prisma/demo-data';

test(
  'database seed repeats without duplicates and preserves edited demo records',
  { skip: !process.env.SEED_TEST_DATABASE_URL },
  async () => {
    const url = process.env.SEED_TEST_DATABASE_URL!;
    assert.equal(new URL(url).pathname, '/stayhub_seed_test');
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const seedIds = demoProperties.map((p) => p.id);
    const snapshot = () =>
      prisma.property.findMany({
        where: { id: { in: seedIds } },
        orderBy: { id: 'asc' },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          amenities: { orderBy: { amenityId: 'asc' } },
        },
      });
    function seedAgain(upgradedLegacy = 0) {
      const result = spawnSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'db', 'seed'],
        { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /"created": 0/);
      assert.match(
        result.stdout,
        new RegExp(`"preserved": ${38 - upgradedLegacy}`),
      );
      assert.match(
        result.stdout,
        new RegExp(`"upgradedLegacy": ${upgradedLegacy}`),
      );
    }
    try {
      const before = await snapshot();
      assert.equal(before.length, 38);
      assert.equal(await prisma.user.count(), demoAccounts.length);
      assert.equal(await prisma.amenity.count(), demoAmenities.length);
      assert.equal(await prisma.propertyImage.count(), 114);
      assert.equal(
        await prisma.propertyAmenity.count(),
        demoProperties.reduce((sum, p) => sum + p.codes.length, 0),
      );
      assert.equal(await prisma.booking.count(), 0);
      assert.equal(await prisma.payment.count(), 0);
      const demoUsers = await prisma.user.findMany({
        orderBy: { email: 'asc' },
      });
      for (const user of demoUsers) {
        assert.ok(
          await bcrypt.compare(
            demoPasswords[user.email] ?? 'StayHub123!',
            user.passwordHash,
          ),
        );
      }
      for (const actual of before) {
        const expected = demoProperties.find((p) => p.id === actual.id)!;
        assert.equal(actual.name, expected.name);
        assert.equal(actual.district, expected.district);
        assert.equal(actual.status, 'ACTIVE');
        assert.equal(actual.maxGuests, expected.maxGuests);
      }
      seedAgain();
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(
        await prisma.user.findMany({ orderBy: { email: 'asc' } }),
        demoUsers,
      );
      const first = before[0];
      const editedName = first.name + ' (đã sửa demo)';
      await prisma.property.update({
        where: { id: first.id },
        data: { name: editedName, status: 'INACTIVE' },
      });
      seedAgain();
      const preserved = await prisma.property.findUniqueOrThrow({
        where: { id: first.id },
      });
      assert.equal(preserved.name, editedName);
      assert.equal(preserved.status, 'INACTIVE');
      await prisma.property.update({
        where: { id: first.id },
        data: { name: first.name, status: first.status },
      });
      assert.equal(await prisma.propertyImage.count(), 114);
      const host = await prisma.user.findUniqueOrThrow({
        where: { email: 'host.east@stayhub.local' },
      });
      try {
        const editedHost = await prisma.user.update({
          where: { id: host.id },
          data: {
            fullName: 'Chủ nhà demo đã sửa',
            passwordHash: 'test-only-custom-hash',
            status: 'REJECTED',
          },
        });
        seedAgain();
        assert.deepEqual(
          await prisma.user.findUniqueOrThrow({ where: { id: host.id } }),
          editedHost,
        );
      } finally {
        await prisma.user.update({
          where: { id: host.id },
          data: {
            fullName: host.fullName,
            passwordHash: host.passwordHash,
            status: host.status,
          },
        });
      }
      const legacy = legacySeedProperties[0];
      const amenities = await prisma.amenity.findMany({
        where: { code: { in: legacy.codes } },
      });
      await prisma.property.update({
        where: { id: first.id },
        data: {
          ...legacy.data,
          maxGuests: 3,
          images: { deleteMany: {}, create: legacy.images },
          amenities: {
            deleteMany: {},
            create: amenities.map(({ id }) => ({ amenityId: id })),
          },
        },
      });
      seedAgain();
      assert.equal(
        (await prisma.property.findUniqueOrThrow({ where: { id: first.id } }))
          .maxGuests,
        3,
      );
      await prisma.property.update({
        where: { id: first.id },
        data: { maxGuests: legacy.data.maxGuests },
      });
      seedAgain(1);
      assert.equal(
        (await prisma.property.findUniqueOrThrow({ where: { id: first.id } }))
          .name,
        first.name,
      );
      assert.equal(await prisma.propertyImage.count(), 114);
    } finally {
      await prisma.$disconnect();
    }
  },
);
