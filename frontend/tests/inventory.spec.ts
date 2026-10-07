import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import { createRequire } from 'node:module';
import type { Booking, Property, Session } from '../src/lib/types';
const api = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
const database = process.env.INVENTORY_TEST_DATABASE_URL;
test.skip(!database, 'Requires isolated inventory test database');
// Database tooling is loaded only for local integration tests, not bundled with the frontend.
function testDatabase() {
  const { PrismaClient } = createRequire(
    process.cwd() + '/../backend/package.json',
  )('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: database } } });
}
let prisma: ReturnType<typeof testDatabase>;
const guests: string[] = [],
  properties: string[] = [];
const future = (offset: number) =>
  new Date(Date.now() + (100 + offset) * 86400000).toISOString().slice(0, 10);
const dates = { checkIn: future(0), checkOut: future(3) };
async function setup(request: APIRequestContext, page: Page) {
  const login = await request.post(api + '/auth/login', {
    data: { email: 'host', password: 'host' },
  });
  const host = (await login.json()) as Session;
  const registration = await request.post(api + '/auth/register', {
    data: {
      email: `browser-${Date.now()}-${Math.random().toString(16).slice(2)}@inventory.test`,
      fullName: 'Khách kiểm thử trình duyệt',
      password: 'StayHub123!',
      role: 'GUEST',
    },
  });
  expect(registration.status()).toBe(201);
  const guest = (await registration.json()) as Session;
  guests.push(guest.user.id);
  const profile = await request.patch(api + '/auth/profile', {
    headers: { Authorization: `Bearer ${guest.accessToken}` },
    data: { fullName: guest.user.fullName, phoneNumber: '0901234567' },
  });
  expect(profile.status()).toBe(200);
  const amenities = await (await request.get(api + '/amenities')).json();
  const room = {
    name: 'Phòng đôi tiêu chuẩn',
    description: 'Phòng riêng cho hai khách.',
    pricePerNight: 600000,
    totalUnits: 10,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    status: 'ACTIVE',
  };
  const result = await request.post(api + '/host/properties', {
    headers: { Authorization: `Bearer ${host.accessToken}` },
    data: {
      name: `Khách sạn kiểm thử ${Date.now()}`,
      type: 'HOTEL',
      description: 'Cơ sở lưu trú tổng hợp dùng riêng cho kiểm thử.',
      district: 'Quận 1',
      address: 'Địa chỉ kiểm thử tại TP. Hồ Chí Minh',
      depositPercent: 30,
      paymentWindowHours: 6,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      images: ['https://example.com/room.jpg'],
      amenityIds: [amenities[0].id],
      roomTypes: [
        room,
        {
          ...room,
          name: 'Phòng gia đình',
          maxGuests: 4,
          totalUnits: 3,
          beds: 2,
          pricePerNight: 1200000,
        },
      ],
    },
  });
  expect(result.status()).toBe(201);
  const property = (await result.json()) as Property;
  properties.push(property.id);
  await page.addInitScript(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    guest.accessToken,
  );
  return { property, guest, host };
}
async function chooseDates(page: Page) {
  for (
    let i = 0;
    i < 8 &&
    !(await page
      .locator(`[data-day="${dates.checkIn}"]:not(.rdp-outside)`)
      .count());
    i++
  )
    await page.getByRole('button', { name: 'Tháng sau' }).click();
  await page
    .locator(`[data-day="${dates.checkIn}"]:not(.rdp-outside) button`)
    .click();
  if (!(await page.locator(`[data-day="${dates.checkOut}"] button`).count()))
    await page.getByRole('button', { name: 'Tháng sau' }).click();
  await page.locator(`[data-day="${dates.checkOut}"] button`).first().click();
}
test.beforeAll(() => {
  expect(new URL(database!).pathname).toMatch(
    /^\/stayhub_(inventory|seed)_test$/,
  );
  prisma = testDatabase();
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.payment.deleteMany({
    where: { booking: { guestId: { in: guests } } },
  });
  await prisma.booking.deleteMany({ where: { guestId: { in: guests } } });
  await prisma.roomType.deleteMany({
    where: { propertyId: { in: properties } },
  });
  await prisma.property.deleteMany({ where: { id: { in: properties } } });
  await prisma.user.deleteMany({ where: { id: { in: guests } } });
  await prisma.$disconnect();
});
test('hotel room choice and quantity update quote; pending, paid and cancelled inventory agree', async ({
  page,
  request,
}) => {
  const { property } = await setup(request, page);
  await page.goto('/properties/' + property.slug);
  const card = page.locator('aside');
  await expect(
    card.getByText('Chọn loại phòng để đặt chỗ.'),
  ).toBeVisible();
  await card
    .getByLabel('Loại phòng / chỗ ở')
    .selectOption(property.roomTypes[1].id);
  await chooseDates(page);
  await expect(
    card.getByText('Còn 3 phòng trong toàn bộ kỳ lưu trú'),
  ).toBeVisible();
  await card.getByLabel('Số phòng', { exact: true }).selectOption('2');
  await expect(card.locator('dl')).toContainText('7.200.000');
  await expect(card.locator('dl')).toContainText('2.160.000');
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/bookings') && r.request().method() === 'POST',
  );
  await card.getByRole('button', { name: 'Đặt chỗ ngay' }).click();
  const booking = (await (await created).json()) as Booking;
  await expect(page).toHaveURL('/bookings');
  await expect(page.locator('article')).toContainText(
    'Phòng gia đình · 2 phòng',
  );
  await expect(page.locator('article')).toContainText('Hạn cọc:');
  const remaining = async () =>
    (
      await (
        await request.get(
          `${api}/room-types/${booking.roomTypeId}/availability`,
          { params: dates },
        )
      ).json()
    ).availableUnits;
  expect(await remaining()).toBe(1);
  await page
    .getByRole('button', { name: 'Thanh toán cọc', exact: true })
    .click();
  await page.getByRole('button', { name: 'Tôi đã thanh toán' }).click();
  await expect(page.locator('article')).toContainText('Đã xác nhận');
  expect(await remaining()).toBe(1);
  await page.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(page.locator('article')).toContainText('Đã hủy');
  expect(await remaining()).toBe(3);
});
test('expired booking refreshes history, disables payment and releases held units', async ({
  page,
  request,
}) => {
  const { property, guest } = await setup(request, page);
  const result = await request.post(api + '/bookings', {
    headers: { Authorization: `Bearer ${guest.accessToken}` },
    data: {
      roomTypeId: property.roomTypes[0].id,
      quantity: 1,
      guestCount: 1,
      ...dates,
    },
  });
  expect(result.status()).toBe(201);
  const booking = (await result.json()) as Booking;
  await page.goto('/bookings');
  await expect(
    page.getByRole('button', { name: 'Thanh toán cọc', exact: true }),
  ).toBeVisible();
  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentDeadlineAt: new Date(Date.now() - 1) },
  });
  await expect(page.locator('article')).toContainText('Hết hạn thanh toán', {
    timeout: 15000,
  });
  await expect(
    page.getByRole('button', { name: 'Thanh toán cọc', exact: true }),
  ).toHaveCount(0);
  const availability = await (
    await request.get(`${api}/room-types/${booking.roomTypeId}/availability`, {
      params: dates,
    })
  ).json();
  expect(availability.availableUnits).toBe(10);
});
test('host edits room inventory and payment window; guest sees the saved options', async ({
  page,
  request,
}) => {
  const { property, host } = await setup(request, page);
  await page.addInitScript(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    host.accessToken,
  );
  await page.goto(`/host/properties/${property.id}/edit`);
  await page.getByLabel('Thời hạn thanh toán cọc').selectOption('12');
  await page.getByLabel('Số đơn vị có thể bán').first().fill('8');
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' &&
      r.url().endsWith('/host/properties/' + property.id),
  );
  await page.getByRole('button', { name: 'Lưu chỗ nghỉ' }).click();
  expect((await saved).status()).toBe(200);
  await page.goto('/properties/' + property.slug);
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(property.roomTypes[0].id);
  await chooseDates(page);
  await expect(
    page.locator('aside').getByText('Còn 8 phòng trong toàn bộ kỳ lưu trú'),
  ).toBeVisible();
});
