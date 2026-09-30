import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../src/auth/auth.dto';
import {
  CreatePropertyDto,
  SearchPropertyDto,
  UpdatePropertyDto,
} from '../src/properties/property.dto';
test('partial updates allow omitted values but reject explicit null', async () => {
  assert.equal(
    (
      await validate(
        plainToInstance(UpdatePropertyDto, { name: 'Tên chỗ nghỉ mới' }),
      )
    ).length,
    0,
  );
  assert.ok(
    (
      await validate(
        plainToInstance(UpdatePropertyDto, { pricePerNight: null }),
      )
    ).some((e) => e.property === 'pricePerNight'),
  );
});
test('public registration rejects ADMIN and normalizes email', async () => {
  const data = plainToInstance(RegisterDto, {
    fullName: 'Minh Anh',
    email: ' Guest@Example.com ',
    password: 'StayHub123!',
    role: 'ADMIN',
  });
  assert.equal(data.email, 'guest@example.com');
  assert.ok((await validate(data)).some((e) => e.property === 'role'));
  data.role = 'HOST';
  assert.equal((await validate(data)).length, 0);
});
test('property requires image, amenity, valid integer price/capacity/deposit', async () => {
  const data = plainToInstance(CreatePropertyDto, {
    type: 'HOTEL',
    name: 'Chỗ nghỉ',
    description: 'Không gian ấm áp và riêng tư dành cho bạn.',
    district: 'Quận 1',
    address: '18 Nguyễn Văn Thủ',
    pricePerNight: 0,
    depositPercent: 101,
    maxGuests: 0,
    bedrooms: 1,
    beds: 0,
    bathrooms: 1,
    images: [],
    amenityIds: [],
  });
  const keys = (await validate(data)).map((e) => e.property);
  for (const field of [
    'pricePerNight',
    'depositPercent',
    'maxGuests',
    'beds',
    'images',
    'amenityIds',
  ])
    assert.ok(keys.includes(field));
});
test('search parses numbers and comma-separated amenity ids', async () => {
  const data = plainToInstance(SearchPropertyDto, {
    page: '2',
    limit: '12',
    minPrice: '500000',
    amenities:
      '10000000-0000-4000-8000-000000000001,10000000-0000-4000-8000-000000000002',
  });
  assert.equal(data.page, 2);
  assert.equal(data.amenities?.length, 2);
  assert.equal((await validate(data)).length, 0);
});
