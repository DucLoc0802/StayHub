import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  demoAccounts,
  demoAmenities,
  demoProperties,
} from '../prisma/demo-data';
import {
  CreatePropertyDto,
  SearchPropertyDto,
} from '../src/properties/property.dto';

test('synthetic catalog has intended geographic concentration and distinct UUIDs', () => {
  assert.equal(demoProperties.length, 38);
  assert.equal(new Set(demoProperties.map((p) => p.id)).size, 38);
  assert.equal(new Set(demoProperties.map((p) => p.name)).size, 38);
  const counts: Record<string, number> = {};
  for (const p of demoProperties)
    counts[p.district] = (counts[p.district] ?? 0) + 1;
  assert.deepEqual(counts, {
    'Quận 1': 7,
    'Quận 3': 3,
    'Bình Thạnh': 6,
    'Thủ Đức': 7,
    'Quận 2': 6,
    'Quận 7': 5,
    'Gò Vấp': 2,
    'Phú Nhuận': 2,
  });
  assert.ok(demoProperties.some((p) => p.type === 'HOTEL'));
  assert.ok(demoProperties.some((p) => p.type === 'HOMESTAY'));
});

test('catalog matches app validation and sensible capacities and varied facilities', () => {
  const amenityIds = new Map(
    demoAmenities.map(([code], i) => [
      code,
      `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    ]),
  );
  for (const {
    id,
    hostEmail,
    codes,
    images,
    status,
    ...data
  } of demoProperties) {
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.ok(
      demoAccounts.some(
        ([email, , role, state]) =>
          email === hostEmail && role === 'HOST' && state === 'ACTIVE',
      ),
    );
    const dto = plainToInstance(CreatePropertyDto, {
      ...data,
      images: images.map((i) => i.url),
      amenityIds: codes.map((c) => amenityIds.get(c)),
    });
    assert.equal(validateSync(dto).length, 0, data.name);
    assert.equal(status, 'ACTIVE');
    assert.ok(data.maxGuests <= data.beds * 2);
    assert.ok(data.bedrooms <= data.beds);
    assert.ok(data.bathrooms >= 1);
    assert.match(data.description, /dữ liệu tổng hợp/);
    assert.match(data.address, /địa chỉ demo/);
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(images.length, 3);
  }
  assert.ok(new Set(demoProperties.map((p) => p.pricePerNight)).size > 25);
  assert.ok(new Set(demoProperties.map((p) => p.codes.join(','))).size >= 6);
});

test('Quận 2 and property type are supported search filters; invalid type rejected', () => {
  assert.equal(
    validateSync(
      plainToInstance(SearchPropertyDto, {
        district: 'Quận 2',
        type: 'HOTEL',
        page: 1,
        limit: 12,
      }),
    ).length,
    0,
  );
  assert.ok(
    validateSync(plainToInstance(SearchPropertyDto, { type: 'ROOM' })).length >
      0,
  );
});
