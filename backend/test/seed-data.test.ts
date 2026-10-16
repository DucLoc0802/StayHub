import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  demoAccounts,
  demoAmenities,
  demoAccommodations,
} from '../prisma/demo-data';
import {
  CreatePropertyDto,
  SearchPropertyDto,
} from '../src/properties/property.dto';

test('four independent Host accounts own five properties with only Hoàng Thành sharing a brand', () => {
  assert.equal(demoAccounts.filter((a) => a[2] === 'HOST').length, 4);
  assert.equal(demoAccommodations.length, 5);
  assert.equal(new Set(demoAccommodations.map((p) => p.id)).size, 5);
  assert.equal(new Set(demoAccommodations.map((p) => p.name)).size, 5);
  const ownership = new Map<string, typeof demoAccommodations>();
  for (const p of demoAccommodations)
    ownership.set(p.hostEmail, [...(ownership.get(p.hostEmail) ?? []), p]);
  assert.deepEqual(
    [...ownership.values()].map((p) => p.length).sort(),
    [1, 1, 1, 2],
  );
  const branches = [...ownership.values()].find((p) => p.length === 2)!;
  assert.deepEqual(
    branches.map((p) => p.name),
    ['Khách sạn Hoàng Thành 1', 'Khách sạn Hoàng Thành 2'],
  );
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
  } of demoAccommodations) {
    assert.match(id, /^[a-f0-9-]{36}$/);
    assert.ok(
      demoAccounts.some(
        ([email, , role, state]) =>
          email === hostEmail && role === 'HOST' && state === 'ACTIVE',
      ),
    );
    const dto = plainToInstance(CreatePropertyDto, {
      ...data,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      images: images.map((i) => i.url),
      amenityIds: codes.map((c) =>
        amenityIds.get(c as (typeof demoAmenities)[number][0]),
      ),
    });
    assert.equal(validateSync(dto).length, 0, data.name);
    assert.equal(status, 'ACTIVE');
    for (const room of data.roomTypes) {
      assert.ok(room.maxGuests <= room.beds * 2);
      assert.ok(room.bedrooms <= room.beds);
      assert.ok(room.bathrooms >= 1);
    }
    assert.equal(data.roomTypes.length, data.type === 'HOTEL' ? 3 : 1);
    if (data.type === 'HOMESTAY') assert.equal(data.roomTypes[0].totalUnits, 1);
    assert.match(data.description, /dữ liệu tổng hợp/);
    assert.match(data.address, /Khu vực đường .+, TP\. Hồ Chí Minh/);
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(images.length, 3);
  }
  assert.equal(demoAccommodations.flatMap((p) => p.roomTypes).length, 13);
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
