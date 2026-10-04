import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto, RegisterDto } from '../src/auth/auth.dto';
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

test('demo login aliases accept short passwords while registration remains strict', async () => {
  for (const account of ['admin', 'host', 'guest']) {
    const login = plainToInstance(LoginDto, {
      email: ` ${account.toUpperCase()} `,
      password: account,
    });
    assert.equal(login.email, `${account}@stayhub.local`);
    assert.equal((await validate(login)).length, 0);
    const registration = plainToInstance(RegisterDto, {
      email: account,
      password: account,
      fullName: 'Tài khoản demo',
      role: 'GUEST',
    });
    const invalid = (await validate(registration)).map(
      (error) => error.property,
    );
    assert.ok(invalid.includes('email'));
    assert.ok(invalid.includes('password'));
  }
  assert.ok(
    (
      await validate(
        plainToInstance(LoginDto, { email: 'unknown', password: 'test' }),
      )
    ).length > 0,
  );
  assert.ok(
    (
      await validate(
        plainToInstance(LoginDto, { email: 'guest', password: '' }),
      )
    ).length > 0,
  );
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

test('host times require valid HH:mm and partial edits keep omitted times', async () => {
  for (const value of ['', '9:00', '24:00', '14:60', '14:00:00', null, 1400]) {
    const errors = await validate(
      plainToInstance(UpdatePropertyDto, {
        checkInTime: value,
        checkOutTime: value,
      }),
    );
    assert.ok(errors.some((e) => e.property === 'checkInTime'));
    assert.ok(errors.some((e) => e.property === 'checkOutTime'));
  }
  for (const value of ['00:00', '14:30', '23:59']) {
    assert.equal(
      (
        await validate(
          plainToInstance(UpdatePropertyDto, {
            checkInTime: value,
            checkOutTime: value,
          }),
        )
      ).length,
      0,
    );
  }
  const edit = plainToInstance(UpdatePropertyDto, { name: 'Tên chỗ nghỉ mới' });
  assert.equal(edit.checkInTime, undefined);
  assert.equal(edit.checkOutTime, undefined);
});
