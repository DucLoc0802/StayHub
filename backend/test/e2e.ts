import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

import type {
  Amenity,
  Booking,
  Page,
  Property,
  Session,
  User,
} from '../../frontend/src/lib/types';

// Runs against a running API and an isolated MySQL database. Test-created data is removed in finally.
const base = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
const prisma = new PrismaClient();
assert.match(
  new URL(process.env.DATABASE_URL!).pathname,
  /^\/stayhub_(inventory|seed)_test$/,
  'API tests require an isolated test database',
);
const runId = `e2e-${Date.now()}`;
const createdUsers: string[] = [];
let passed = 0;
async function request<T>(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
  expected = 200,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  passed++;
  return data as T;
}
async function register(role: 'GUEST' | 'HOST', suffix: string) {
  const session = await request<Session>(
    'POST',
    '/auth/register',
    undefined,
    {
      email: `${runId}-${suffix}@example.com`,
      fullName: `Kiểm thử ${suffix}`,
      password: 'StayHub123!',
      role,
    },
    201,
  );
  createdUsers.push(session.user.id);
  if (role === 'GUEST')
    await request('PATCH', '/auth/profile', session.accessToken, {
      fullName: session.user.fullName,
      phoneNumber: '0901234567',
    });
  assert.ok(session.accessToken);
  return session;
}
const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function main() {
  const guest = await register('GUEST', 'guest');
  const otherGuest = await register('GUEST', 'other');
  const host = await register('HOST', 'host');
  const rejected = await register('HOST', 'rejected');
  assert.equal(guest.user.status, 'ACTIVE');
  assert.equal(host.user.status, 'PENDING');
  await request(
    'POST',
    '/auth/register',
    undefined,
    {
      email: guest.user.email,
      fullName: 'Duplicate',
      password: 'StayHub123!',
      role: 'GUEST',
    },
    409,
  );
  await request(
    'POST',
    '/auth/register',
    undefined,
    {
      email: `${runId}-admin@example.com`,
      fullName: 'Admin',
      password: 'StayHub123!',
      role: 'ADMIN',
    },
    400,
  );
  await request(
    'POST',
    '/auth/register',
    undefined,
    {
      email: 'invalid',
      fullName: 'Invalid',
      password: 'StayHub123!',
      role: 'GUEST',
    },
    400,
  );
  await request(
    'POST',
    '/auth/login',
    undefined,
    { email: guest.user.email, password: 'wrong-password' },
    401,
  );
  await request('POST', '/auth/login', undefined, {
    email: guest.user.email,
    password: 'StayHub123!',
  });
  await request('GET', '/host/properties', host.accessToken, undefined, 403);
  await request('GET', '/host/properties', guest.accessToken, undefined, 403);
  await request('GET', '/bookings/my', undefined, undefined, 401);
  const admin = await request<Session>('POST', '/auth/login', undefined, {
    email: 'admin',
    password: 'admin',
  });
  const pending = await request<User[]>(
    'GET',
    '/admin/hosts',
    admin.accessToken,
  );
  assert.ok(pending.some((u) => u.id === host.user.id));
  await request(
    'PATCH',
    `/admin/hosts/${host.user.id}/approve`,
    guest.accessToken,
    undefined,
    403,
  );
  await request(
    'PATCH',
    `/admin/hosts/${host.user.id}/approve`,
    admin.accessToken,
  );
  await request(
    'PATCH',
    `/admin/hosts/${rejected.user.id}/reject`,
    admin.accessToken,
  );
  await request(
    'PATCH',
    `/admin/hosts/${rejected.user.id}/approve`,
    admin.accessToken,
    undefined,
    409,
  );
  const rejectedLogin = await request<Session>(
    'POST',
    '/auth/login',
    undefined,
    { email: rejected.user.email, password: 'StayHub123!' },
  );
  await request(
    'GET',
    '/host/properties',
    rejectedLogin.accessToken,
    undefined,
    403,
  );
  const current = await request<User>('GET', '/auth/me', host.accessToken);
  assert.equal(current.status, 'ACTIVE');
  const amenities = await request<Amenity[]>('GET', '/amenities');
  assert.ok(amenities.length >= 2);
  const room = {
    name: 'Phòng đôi tiêu chuẩn',
    description: 'Phòng riêng',
    pricePerNight: 600000,
    totalUnits: 10,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    status: 'ACTIVE',
  };
  const data = {
    name: 'Chỗ nghỉ ' + runId,
    description: 'Một chỗ nghỉ để kiểm tra tất cả luồng nghiệp vụ.',
    type: 'HOTEL',
    district: 'Quận 1',
    address: 'Địa chỉ tổng hợp tại TP. Hồ Chí Minh',
    depositPercent: 40,
    paymentWindowHours: 6,
    checkInTime: '15:30',
    checkOutTime: '11:00',
    images: ['https://example.com/room.jpg'],
    amenityIds: amenities.slice(0, 2).map((a) => a.id),
    roomTypes: [
      room,
      {
        ...room,
        name: 'Phòng gia đình',
        totalUnits: 3,
        maxGuests: 4,
        beds: 2,
        pricePerNight: 1200000,
      },
    ],
  };
  for (const invalid of [
    { depositPercent: 101 },
    { paymentWindowHours: 2 },
    { checkInTime: '24:00' },
    { images: [] },
    { amenityIds: [] },
    { roomTypes: [{ ...room, totalUnits: 0 }] },
    { type: 'HOMESTAY' },
    { pricePerNight: 1 },
  ])
    await request(
      'POST',
      '/host/properties',
      host.accessToken,
      { ...data, ...invalid },
      400,
    );
  const property = await request<Property>(
    'POST',
    '/host/properties',
    host.accessToken,
    data,
    201,
  );
  assert.equal(property.roomTypes.length, 2);
  assert.equal(property.minPricePerNight, 600000);
  assert.equal(
    (await request<Property>('GET', '/properties/' + property.slug)).id,
    property.id,
  );
  assert.equal(
    (await request<Property>('GET', '/properties/' + property.id)).id,
    property.id,
  );
  await request(
    'GET',
    '/host/properties/' + property.id,
    otherGuest.accessToken,
    undefined,
    403,
  );
  const rt = property.roomTypes[0];
  const dates = { checkIn: day(70), checkOut: day(73) };
  const query = new URLSearchParams(dates).toString();
  const quote = await request<{ totalAmount: number; availableUnits: number }>(
    'GET',
    '/room-types/' + rt.id + '/quote?' + query + '&quantity=2&guestCount=4',
  );
  assert.equal(quote.totalAmount, 3600000);
  assert.equal(quote.availableUnits, 10);
  const bookingData = {
    roomTypeId: rt.id,
    quantity: 2,
    guestCount: 4,
    ...dates,
  };
  await request('POST', '/bookings', undefined, bookingData, 401);
  await request('POST', '/bookings', host.accessToken, bookingData, 403);
  for (const invalid of [
    { quantity: 0 },
    { quantity: 11 },
    { guestCount: 5 },
    { checkOut: dates.checkIn },
    { propertyId: property.id },
  ])
    await request(
      'POST',
      '/bookings',
      guest.accessToken,
      { ...bookingData, ...invalid },
      400,
    );
  const booking = await request<Booking>(
    'POST',
    '/bookings',
    guest.accessToken,
    bookingData,
    201,
  );
  assert.equal(booking.quantity, 2);
  assert.equal(booking.depositAmount, 1440000);
  assert.equal(booking.checkInTimeSnapshot, '15:30');
  const availability = await request<{ availableUnits: number }>(
    'GET',
    '/room-types/' + rt.id + '/availability?' + query,
  );
  assert.equal(availability.availableUnits, 8);
  await request('POST', '/bookings', guest.accessToken, bookingData, 409);
  await request(
    'POST',
    '/bookings/' + booking.id + '/pay',
    otherGuest.accessToken,
    undefined,
    404,
  );
  const fields = property.roomTypes.map(
    ({
      id,
      name,
      description,
      pricePerNight,
      totalUnits,
      maxGuests,
      bedrooms,
      beds,
      bathrooms,
      status,
    }) => ({
      id,
      name,
      description,
      pricePerNight,
      totalUnits,
      maxGuests,
      bedrooms,
      beds,
      bathrooms,
      status,
    }),
  );
  await request('PATCH', '/host/properties/' + property.id, host.accessToken, {
    roomTypes: fields.map((r) => ({
      ...r,
      pricePerNight: r.pricePerNight + 100000,
    })),
  });
  const paid = await request<Booking>(
    'POST',
    '/bookings/' + booking.id + '/pay',
    guest.accessToken,
    undefined,
    201,
  );
  assert.equal(paid.status, 'CONFIRMED');
  assert.equal(paid.totalAmount, booking.totalAmount);
  assert.equal(paid.payment?.amount, booking.depositAmount);
  await request(
    'POST',
    '/bookings/' + booking.id + '/pay',
    guest.accessToken,
    undefined,
    409,
  );
  await request(
    'PATCH',
    '/bookings/' + booking.id + '/cancel',
    guest.accessToken,
  );
  await request(
    'POST',
    '/bookings/' + booking.id + '/pay',
    guest.accessToken,
    undefined,
    409,
  );
  const late = await request<Booking>(
    'POST',
    '/bookings',
    guest.accessToken,
    bookingData,
    201,
  );
  await prisma.booking.update({
    where: { id: late.id },
    data: { paymentDeadlineAt: new Date(Date.now() - 1000) },
  });
  await request(
    'POST',
    '/bookings/' + late.id + '/pay',
    guest.accessToken,
    undefined,
    409,
  );
  assert.equal(
    (await prisma.booking.findUniqueOrThrow({ where: { id: late.id } })).status,
    'EXPIRED',
  );
  assert.ok(
    (await request<Booking[]>('GET', '/bookings/my', guest.accessToken)).some(
      (b) => b.id === late.id && b.status === 'EXPIRED',
    ),
  );
  assert.ok(
    (await request<Booking[]>('GET', '/host/bookings', host.accessToken)).some(
      (b) => b.id === booking.id,
    ),
  );
  for (const sort of ['price_asc', 'price_desc']) {
    const listing = await request<Page<Property>>(
      'GET',
      '/properties?sort=' + sort + '&limit=48&minPrice=500000&maxPrice=1500000',
    );
    const prices = listing.items.map((p) => p.minPricePerNight!);
    assert.ok(prices.every((price) => price >= 500000 && price <= 1500000));
    assert.deepEqual(
      prices,
      [...prices].sort((a, b) => (sort === 'price_asc' ? a - b : b - a)),
    );
    for (const p of listing.items)
      assert.equal(
        p.minPricePerNight,
        Math.min(...p.roomTypes.map((r) => r.pricePerNight)),
      );
  }
  // Filter compares MIN(active price), not any higher priced room of a hotel.
  const excluded = await request<Page<Property>>(
    'GET',
    '/properties?q=' + encodeURIComponent(runId) + '&minPrice=1000000',
  );
  assert.equal(excluded.total, 0);
  const home = await request<Property>(
    'POST',
    '/host/properties',
    host.accessToken,
    {
      ...data,
      name: 'Nhà ' + runId,
      type: 'HOMESTAY',
      roomTypes: [{ ...room, totalUnits: 1 }],
    },
    201,
  );
  const homeData = {
    ...bookingData,
    roomTypeId: home.roomTypes[0].id,
    quantity: 1,
    guestCount: 1,
  };
  const results = await Promise.all(
    [guest, otherGuest].map(async (user) => {
      const result = await fetch(base + '/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + user.accessToken,
        },
        body: JSON.stringify(homeData),
      });
      return result.status;
    }),
  );
  assert.deepEqual(results.sort(), [201, 409]);
  passed++;
  const duplicate = await request<Property>(
    'POST',
    '/host/properties',
    host.accessToken,
    data,
    201,
  );
  assert.equal(duplicate.slug, property.slug + '-2');
  const renamed = await request<Property>(
    'PATCH',
    '/host/properties/' + property.id,
    host.accessToken,
    { name: data.name + ' updated' },
  );
  assert.equal(renamed.slug, property.slug);
  await request(
    'PATCH',
    '/host/properties/' + property.id + '/status',
    host.accessToken,
    { status: 'INACTIVE' },
  );
  await request(
    'GET',
    '/properties/' + property.slug,
    undefined,
    undefined,
    404,
  );
  await request('POST', '/bookings', guest.accessToken, bookingData, 404);
  assert.equal((await fetch(base + '/docs')).status, 200);
  console.info('PASS: ' + passed + ' API/concurrency checks.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const testUsers = await prisma.user.findMany({
      where: { email: { startsWith: runId } },
      select: { id: true },
    });
    const ids = [...new Set([...createdUsers, ...testUsers.map((u) => u.id)])];
    await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({
        where: { guestId: { in: ids } },
        select: { id: true },
      });
      await tx.payment.deleteMany({
        where: { bookingId: { in: bookings.map((b) => b.id) } },
      });
      await tx.booking.deleteMany({ where: { guestId: { in: ids } } });
      await tx.roomType.deleteMany({
        where: { property: { hostId: { in: ids } } },
      });
      await tx.property.deleteMany({ where: { hostId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    await prisma.$disconnect();
  });
