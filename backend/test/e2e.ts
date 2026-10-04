import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { priceSnapshot, vietnamToday } from '../src/common/domain';
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
  const data = {
    name: `Chỗ nghỉ ${runId}`,
    description: 'Một chỗ nghỉ để kiểm tra tất cả luồng nghiệp vụ.',
    type: 'HOMESTAY',
    district: 'Quận 1',
    address: '18 Nguyễn Văn Thủ, TP. Hồ Chí Minh',
    pricePerNight: 1000000,
    depositPercent: 40,
    maxGuests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    checkInTime: '15:30',
    checkOutTime: '11:00',
    images: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0'],
    amenityIds: amenities.slice(0, 2).map((a) => a.id),
  };
  for (const invalid of [
    { pricePerNight: 0 },
    { depositPercent: 101 },
    { maxGuests: 0 },
    { checkInTime: '24:00' },
    { checkOutTime: '11:60' },
    { images: [] },
    { amenityIds: [] },
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
  await request(
    'PATCH',
    `/host/properties/${property.id}`,
    host.accessToken,
    { pricePerNight: null },
    400,
  );
  const otherHost = await request<Session>('POST', '/auth/login', undefined, {
    email: 'host',
    password: 'host',
  });
  await request(
    'PATCH',
    `/host/properties/${property.id}`,
    otherHost.accessToken,
    { name: 'Không được phép' },
    404,
  );
  const search = await request<Page<Property>>(
    'GET',
    `/properties?q=${runId}&amenities=${data.amenityIds.join(',')}&minPrice=900000&maxPrice=1100000`,
  );
  assert.equal(search.total, 1);
  const all = await request<Page<Property>>(
    'GET',
    '/properties?sort=price_asc&limit=2',
  );
  assert.ok(all.items.length <= 2);
  assert.ok(
    all.items.every(
      (p, i) => i === 0 || p.pricePerNight >= all.items[i - 1].pricePerNight,
    ),
  );
  const q2 = await request<Page<Property>>(
    'GET',
    '/properties?district=Qu%E1%BA%ADn%202&limit=48',
  );
  assert.equal(q2.total, 6);
  assert.ok(q2.items.every((p) => p.district === 'Quận 2'));
  const hotels = await request<Page<Property>>(
    'GET',
    '/properties?type=HOTEL&sort=price_desc&limit=48',
  );
  assert.ok(hotels.total > 0);
  assert.ok(hotels.items.every((p) => p.type === 'HOTEL'));
  assert.ok(
    hotels.items.every(
      (p, i) => i === 0 || p.pricePerNight <= hotels.items[i - 1].pricePerNight,
    ),
  );
  await request('GET', '/properties?type=ROOM', undefined, undefined, 400);
  const none = await request<Page<Property>>(
    'GET',
    `/properties?q=${runId}&amenities=${amenities
      .slice(0, 3)
      .map((a) => a.id)
      .join(',')}`,
  );
  assert.equal(none.total, 0);
  const byId = await request<Property>('GET', '/properties/' + property.id);
  assert.ok(byId.slug);
  assert.equal(byId.slug, property.slug);
  const bySlug = await request<Property>('GET', '/properties/' + property.slug);
  assert.equal(bySlug.id, property.id);
  const byOldPath = await request<Property>(
    'GET',
    '/properties/old-name--' + property.id,
  );
  assert.equal(byOldPath.id, property.id);
  const bookingData = {
    propertyId: property.id,
    checkIn: day(40),
    checkOut: day(43),
    guestCount: 2,
  };
  // A property whose check-in is at midnight cannot accept today's booking.
  const today = vietnamToday();
  const tomorrow = new Date(new Date(today).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  await request('PATCH', '/host/properties/' + property.id, host.accessToken, {
    checkInTime: '00:00',
  });
  await request(
    'POST',
    '/bookings',
    guest.accessToken,
    {
      ...bookingData,
      checkIn: today,
      checkOut: tomorrow,
    },
    400,
  );
  const expired = await prisma.booking.create({
    data: {
      guestId: guest.user.id,
      propertyId: property.id,
      guestCount: 1,
      checkIn: new Date(today),
      checkOut: new Date(tomorrow),
      checkInTimeSnapshot: '00:00',
      checkOutTimeSnapshot: '11:00',
      ...priceSnapshot(property.pricePerNight, property.depositPercent, 1),
    },
  });
  await request(
    'POST',
    '/bookings/' + expired.id + '/pay',
    guest.accessToken,
    undefined,
    400,
  );
  assert.equal(
    await prisma.payment.count({ where: { bookingId: expired.id } }),
    0,
  );
  await request('PATCH', '/host/properties/' + property.id, host.accessToken, {
    checkInTime: '15:30',
  });
  for (const invalid of [
    { guestCount: 4 },
    { checkIn: day(-1) },
    { checkOut: bookingData.checkIn },
    { checkIn: '2030-02-30' },
    { totalAmount: 1 },
  ])
    await request(
      'POST',
      '/bookings',
      guest.accessToken,
      { ...bookingData, ...invalid },
      400,
    );
  await request('POST', '/bookings', host.accessToken, bookingData, 403);
  const booking = await request<Booking>(
    'POST',
    '/bookings',
    guest.accessToken,
    bookingData,
    201,
  );
  const competing = await request<Booking>(
    'POST',
    '/bookings',
    otherGuest.accessToken,
    bookingData,
    201,
  );
  assert.equal(booking.checkInTimeSnapshot, '15:30');
  assert.equal(booking.checkOutTimeSnapshot, '11:00');
  assert.equal(booking.status, 'PENDING_PAYMENT');
  assert.equal(booking.depositAmount, 1200000);
  assert.equal(booking.remainingAmount, 1800000);
  await request(
    'POST',
    `/bookings/${booking.id}/pay`,
    otherGuest.accessToken,
    undefined,
    404,
  );
  await request(
    'PATCH',
    `/bookings/${booking.id}/cancel`,
    otherGuest.accessToken,
    undefined,
    404,
  );
  const own = await request<Booking[]>(
    'GET',
    '/bookings/my',
    otherGuest.accessToken,
  );
  assert.ok(!own.some((b) => b.id === booking.id));
  await request('PATCH', `/host/properties/${property.id}`, host.accessToken, {
    checkInTime: '16:00',
    checkOutTime: '10:00',
    pricePerNight: 1500000,
    depositPercent: 50,
  });
  const confirmed = await request<Booking>(
    'POST',
    `/bookings/${booking.id}/pay`,
    guest.accessToken,
    undefined,
    201,
  );
  assert.equal(confirmed.payment?.amount, 1200000);
  assert.equal(confirmed.totalAmount, 3000000);
  assert.equal(confirmed.checkInTimeSnapshot, '15:30');
  assert.equal(confirmed.checkOutTimeSnapshot, '11:00');
  await request(
    'POST',
    `/bookings/${booking.id}/pay`,
    guest.accessToken,
    undefined,
    409,
  );
  await request(
    'POST',
    `/bookings/${competing.id}/pay`,
    otherGuest.accessToken,
    undefined,
    409,
  );
  assert.equal(
    await prisma.payment.count({ where: { bookingId: competing.id } }),
    0,
  );
  await request('POST', '/bookings', guest.accessToken, bookingData, 409);
  await request(
    'POST',
    '/bookings',
    guest.accessToken,
    { ...bookingData, checkIn: day(43), checkOut: day(45) },
    201,
  );
  const hostBookings = await request<Booking[]>(
    'GET',
    '/host/bookings',
    host.accessToken,
  );
  assert.ok(hostBookings.some((b) => b.id === booking.id));
  const hiddenBookings = await request<Booking[]>(
    'GET',
    '/host/bookings',
    otherHost.accessToken,
  );
  assert.ok(!hiddenBookings.some((b) => b.id === booking.id));
  const cancelled = await request<Booking>(
    'PATCH',
    `/bookings/${booking.id}/cancel`,
    guest.accessToken,
  );
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(cancelled.payment?.status, 'SUCCESS');
  await request(
    'PATCH',
    `/bookings/${booking.id}/cancel`,
    guest.accessToken,
    undefined,
    409,
  );
  await request(
    'POST',
    `/bookings/${competing.id}/pay`,
    otherGuest.accessToken,
    undefined,
    201,
  );
  await request(
    'PATCH',
    `/bookings/${competing.id}/cancel`,
    otherGuest.accessToken,
  );
  await request(
    'PATCH',
    `/host/properties/${property.id}/status`,
    host.accessToken,
    { status: 'INACTIVE' },
  );
  await request('GET', `/properties/${property.id}`, undefined, undefined, 404);
  await request('POST', '/bookings', guest.accessToken, bookingData, 404);
  await request(
    'PATCH',
    `/host/properties/${property.id}/status`,
    host.accessToken,
    { status: 'ACTIVE' },
  );
  // Genuine concurrent HTTP requests, not a mock of transaction behavior.
  for (let round = 0; round < 3; round++) {
    const dates = {
      ...bookingData,
      checkIn: day(60 + round * 5),
      checkOut: day(62 + round * 5),
    };
    const a = await request<Booking>(
      'POST',
      '/bookings',
      guest.accessToken,
      dates,
      201,
    );
    const b = await request<Booking>(
      'POST',
      '/bookings',
      otherGuest.accessToken,
      dates,
      201,
    );
    const results = await Promise.all(
      [
        { booking: a, session: guest },
        { booking: b, session: otherGuest },
      ].map(({ booking, session }) =>
        fetch(`${base}/bookings/${booking.id}/pay`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.accessToken}` },
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      await prisma.booking.count({
        where: { id: { in: [a.id, b.id] }, status: 'CONFIRMED' },
      }),
      1,
    );
    passed++;
  }
  const race = await request<Booking>(
    'POST',
    '/bookings',
    guest.accessToken,
    { ...bookingData, checkIn: day(90), checkOut: day(92) },
    201,
  );
  const raceResponses = await Promise.all([
    fetch(`${base}/bookings/${race.id}/pay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${guest.accessToken}` },
    }),
    fetch(`${base}/bookings/${race.id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${guest.accessToken}` },
    }),
  ]);
  assert.ok([201, 409].includes(raceResponses[0].status));
  assert.equal(raceResponses[1].status, 200);
  const raceResult = await prisma.booking.findUniqueOrThrow({
    where: { id: race.id },
    include: { payment: true },
  });
  assert.equal(raceResult.status, 'CANCELLED');
  assert.equal(
    raceResult.payment?.status === 'SUCCESS',
    raceResponses[0].status === 201,
  );
  assert.ok(
    (await prisma.payment.count({ where: { bookingId: race.id } })) <= 1,
  );
  passed++;
  await request(
    'POST',
    `/bookings/${race.id}/pay`,
    guest.accessToken,
    undefined,
    409,
  );
  const duplicate = await request<Booking>(
    'POST',
    '/bookings',
    guest.accessToken,
    { ...bookingData, checkIn: day(100), checkOut: day(102) },
    201,
  );
  const duplicateResults = await Promise.all(
    [0, 1].map(() =>
      fetch(`${base}/bookings/${duplicate.id}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${guest.accessToken}` },
      }),
    ),
  );
  assert.deepEqual(duplicateResults.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await prisma.payment.count({ where: { bookingId: duplicate.id } }),
    1,
  );
  passed++;
  const duplicateName = await request<Property>(
    'POST',
    '/host/properties',
    host.accessToken,
    data,
    201,
  );
  assert.equal(duplicateName.slug, property.slug + '-2');
  const simultaneous = await Promise.all(
    [0, 1].map(() =>
      request<Property>(
        'POST',
        '/host/properties',
        host.accessToken,
        data,
        201,
      ),
    ),
  );
  assert.deepEqual(simultaneous.map((p) => p.slug).sort(), [
    property.slug + '-3',
    property.slug + '-4',
  ]);
  const renamed = await request<Property>(
    'PATCH',
    '/host/properties/' + property.id,
    host.accessToken,
    { name: data.name + ' updated' },
  );
  assert.equal(renamed.slug, property.slug);
  const afterRename = await request<Property>(
    'GET',
    '/properties/' + property.slug,
  );
  assert.equal(afterRename.id, property.id);
  const otherSlug = await request<Property>(
    'GET',
    '/properties/' + duplicateName.slug,
  );
  assert.equal(otherSlug.id, duplicateName.id);
  const swagger = await fetch(`${base}/docs`);
  assert.equal(swagger.status, 200);
  passed++;
  console.info(`PASS: ${passed} API/concurrency checks.`);
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
      await tx.property.deleteMany({ where: { hostId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    await prisma.$disconnect();
  });
