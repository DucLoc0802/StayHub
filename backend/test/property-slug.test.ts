import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  propertyIdFromSlug,
  propertyLookup,
  propertySlug,
  withPropertySlug,
} from '../src/properties/property-slug';
import { PropertiesService } from '../src/properties/properties.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { propertyPath } from '../../frontend/src/lib/property-url';

const id = '123e4567-e89b-42d3-a456-426614174000';
function conflict(target: string | string[] = ['slug']) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.2',
    meta: { target },
  });
}

test('Vietnamese property names produce short paths without UUIDs', () => {
  assert.equal(propertySlug('  Đà Lạt — Phòng Đẹp!  '), 'da-lat-phong-dep');
  assert.equal(propertySlug('Lối Hoa Family Home'), 'loi-hoa-family-home');
  assert.equal(
    propertyPath({ name: 'Lối Hoa Family Home', slug: 'loi-hoa-family-home' }),
    '/properties/loi-hoa-family-home',
  );
  assert.equal(
    propertyPath({ name: '  Đà Lạt — Phòng Đẹp!  ' }),
    '/properties/da-lat-phong-dep',
  );
  assert.equal(propertySlug('!!!'), 'cho-nghi');
  assert.deepEqual(propertyLookup(propertySlug(id)), {
    slug: `cho-nghi-${id}`,
  });
});

test('stored paths remain stable after a host changes the name', () => {
  assert.equal(
    propertyPath({ name: 'Tên mới', slug: 'ten-cu' }),
    '/properties/ten-cu',
  );
});

test('short slugs, legacy IDs and old long paths resolve correctly', () => {
  assert.deepEqual(propertyLookup('loi-hoa-family-home'), {
    slug: 'loi-hoa-family-home',
  });
  assert.deepEqual(propertyLookup(id), { id });
  assert.deepEqual(propertyLookup(`old-name--${id}`), { id });
  assert.equal(propertyIdFromSlug(id), id);
  assert.equal(propertyIdFromSlug(`old-name--${id}`), id);
});

test('invalid property paths are rejected', () => {
  for (const slug of [
    '',
    `--${id}`,
    `bad_name--${id}`,
    'ten--not-a-uuid',
    'bad_name',
    '../room',
    'a'.repeat(192),
  ]) {
    assert.throws(() => propertyLookup(slug));
  }
});

test('duplicate and concurrent names get short numeric suffixes', async () => {
  const used = new Set(['cho-nghi', 'cho-nghi-2']);
  const save = async (slug: string) => {
    await Promise.resolve();
    if (used.has(slug)) throw conflict('Property_slug_key');
    used.add(slug);
    return slug;
  };
  const results = await Promise.all([
    withPropertySlug('Chỗ nghỉ', save),
    withPropertySlug('Chỗ nghỉ', save),
  ]);
  assert.deepEqual(results.sort(), ['cho-nghi-3', 'cho-nghi-4']);
});

test('slug retries never swallow other unique constraints or database failures', async () => {
  for (const error of [conflict(['id']), new Error('database unavailable')]) {
    await assert.rejects(
      () =>
        withPropertySlug('Chỗ nghỉ', async () => {
          throw error;
        }),
      (actual) => actual === error,
    );
  }
});

test('startup assigns unique slugs to all old records and preserves existing paths', async () => {
  const rows = [
    {
      id: '1',
      name: 'Lối Hoa Family Home',
      slug: 'loi-hoa-family-home' as string | null,
    },
    { id: '2', name: 'Lối Hoa Family Home', slug: null as string | null },
    { id: '3', name: 'Lối Hoa Family Home', slug: null as string | null },
    { id: '4', name: 'Chỗ nghỉ khác', slug: null as string | null },
  ];
  let writes = 0;
  const prisma = {
    property: {
      findMany: async () => rows.filter((p) => p.slug === null),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { slug: string };
      }) => {
        if (rows.some((p) => p.slug === data.slug)) throw conflict();
        const row = rows.find((p) => p.id === where.id && p.slug === null);
        if (!row) return { count: 0 };
        row.slug = data.slug;
        writes++;
        return { count: 1 };
      },
    },
  } as unknown as PrismaService;
  const service = new PropertiesService(prisma);
  await service.onModuleInit();
  assert.deepEqual(
    rows.map((p) => p.slug),
    [
      'loi-hoa-family-home',
      'loi-hoa-family-home-2',
      'loi-hoa-family-home-3',
      'cho-nghi-khac',
    ],
  );
  await service.onModuleInit();
  assert.equal(writes, 3);
});
