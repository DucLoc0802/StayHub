import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import type { Booking, Session, Property } from '../src/lib/types';

const api = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
const database = process.env.INVENTORY_TEST_DATABASE_URL;
test.skip(
  !database || !process.env.DEMO_PASSWORD,
  'Requires isolated seeded database',
);
const guests: string[] = [];
const { PrismaClient } = createRequire(
  process.cwd() + '/../backend/package.json',
)('@prisma/client');
let prisma: InstanceType<typeof PrismaClient>;
test.beforeAll(() => {
  expect(new URL(database!).pathname).toMatch(
    /^\/stayhub_(inventory|seed)_test$/,
  );
  prisma = new PrismaClient({ datasources: { db: { url: database } } });
});
test.afterAll(async () => {
  if (!prisma) return;
  await prisma.payment.deleteMany({
    where: { booking: { guestId: { in: guests } } },
  });
  await prisma.booking.deleteMany({ where: { guestId: { in: guests } } });
  await prisma.user.deleteMany({ where: { id: { in: guests } } });
  await prisma.$disconnect();
});
async function capture(page: Page, name: string) {
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    const adminNav = page.getByRole('navigation', {
      name: 'Quản trị StayHub',
      exact: true,
    });
    if (await adminNav.count()) {
      const active = adminNav.locator('[aria-current="page"]');
      if (await active.count())
        await expect
          .poll(async () => {
            const navBox = await adminNav.boundingBox(),
              linkBox = await active.boundingBox();
            return (
              !!navBox &&
              !!linkBox &&
              linkBox.x >= navBox.x &&
              linkBox.x + linkBox.width <= navBox.x + navBox.width
            );
          })
          .toBe(true);
    }
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `../.local/payment-invoice-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
}
for (const name of [
  'admin01',
  'host01',
  'host02',
  'host03',
  'host04',
  'guest01',
  'host05',
]) {
  test(`${name} logs in and stays in its role on navigation and refresh`, async ({
    page,
  }) => {
    const area = name.startsWith('admin')
      ? '/admin'
      : name.startsWith('host')
        ? '/host'
        : '/properties';
    await page.goto('/login?next=%2Fbookings');
    await page.getByLabel('Tài khoản hoặc email', { exact: true }).fill(name);
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill(process.env.DEMO_PASSWORD!);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(name.startsWith('guest') ? '/bookings' : area);
    for (const route of name.startsWith('guest')
      ? ['/admin', '/host']
      : [
          '/bookings',
          '/account',
          '/properties',
          name.startsWith('admin') ? '/host' : '/admin',
        ]) {
      await page.goto(route);
      await expect(page).toHaveURL(area);
      await page.reload();
      await expect(page.locator('h1')).toBeVisible();
      if (!name.startsWith('guest')) {
        await expect(
          page
            .locator('header')
            .getByRole('link', { name: 'Tìm chỗ nghỉ', exact: true }),
        ).toHaveCount(0);
        await expect(
          page
            .locator('header')
            .getByRole('link', { name: 'Đặt phòng của tôi', exact: true }),
        ).toHaveCount(0);
        await expect(page.locator('footer')).toContainText('Khu vực');
        await expect(
          page
            .locator('footer')
            .getByRole('link', { name: 'Khám phá chỗ nghỉ', exact: true }),
        ).toHaveCount(0);
      }
    }
    if (['admin01', 'host01', 'guest01'].includes(name)) {
      if (name !== 'guest01')
        await capture(
          page,
          name.startsWith('admin') ? 'admin-overview' : 'host-overview',
        );
      await page.goto(
        name.startsWith('guest') ? '/account' : `${area}/account`,
      );
      if (name !== 'guest01')
        await expect(page.locator('main')).toContainText(
          'Cập nhật họ tên và số điện thoại để StayHub liên hệ khi cần.',
        );
      await expect(
        page.getByRole('heading', { name: 'Tài khoản của tôi', exact: true }),
      ).toBeVisible();
      await capture(page, `${name}-account`);
      if (name === 'host01') {
        await page.goto(
          '/host/properties/71000000-0000-4000-8000-000000000001/edit',
        );
        await expect(
          page.getByLabel('Tên chỗ nghỉ', { exact: true }),
        ).toBeVisible();
        await capture(page, 'host-property-form');
      }
    }
  });
}

test('one-click simulated payment, valid PDF, refresh and history agree with MySQL', async ({
  page,
  request,
}) => {
  const registration = await request.post(api + '/auth/register', {
    data: {
      email: 'simulated-browser-' + Date.now() + '@example.test',
      fullName: 'Nguyễn Thị Ánh',
      password: 'StayHub123!',
      role: 'GUEST',
    },
  });
  expect(registration.status()).toBe(201);
  const guest = (await registration.json()) as Session;
  guests.push(guest.user.id);
  const headers = { Authorization: 'Bearer ' + guest.accessToken };
  await request.patch(api + '/auth/profile', {
    headers,
    data: { fullName: guest.user.fullName, phoneNumber: '0901234567' },
  });
  const property = (await (
    await request.get(api + '/properties/71000000-0000-4000-8000-000000000002')
  ).json()) as Property;
  const date = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const response = await request.post(api + '/bookings', {
    headers,
    data: {
      roomTypeId: property.roomTypes[0].id,
      quantity: 1,
      guestCount: 1,
      checkIn: date(180),
      checkOut: date(182),
    },
  });
  expect(response.status()).toBe(201);
  const b = (await response.json()) as Booking;
  await page.addInitScript(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    guest.accessToken,
  );
  await page.goto('/bookings/' + b.id + '/payment');
  await expect(
    page.getByRole('heading', { name: 'Thanh toán đặt phòng' }),
  ).toBeVisible();
  await capture(page, 'checkout');
  const button = page.getByRole('button', {
    name: 'Tôi đã thanh toán',
    exact: true,
  });
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(
    page.getByRole('heading', { name: 'Thanh toán thành công!' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Thanh toán thành công!' }),
  ).toBeVisible();
  await capture(page, 'success');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Tải hóa đơn PDF', exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    'StayHub-' + b.bookingCode + '.pdf',
  );
  await page.getByRole('link', { name: 'Xem hóa đơn', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'PHIẾU XÁC NHẬN ĐẶT PHÒNG' }),
  ).toBeVisible();
  await expect(page.locator('.invoice-content')).toContainText(
    'Nguyễn Thị Ánh',
  );
  await capture(page, 'invoice');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.invoice-actions')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  const pdf = await request.get(api + '/bookings/' + b.id + '/invoice.pdf', {
    headers,
  });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await page.goto('/bookings');
  await expect(
    page.locator('article').filter({ hasText: b.bookingCode }),
  ).toContainText('Đã xác nhận');
  await page.goto('/bookings/' + b.id);
  await expect(
    page.getByRole('link', { name: 'Xem hóa đơn', exact: true }),
  ).toBeVisible();
  const detailDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Tải hóa đơn PDF', exact: true })
    .click();
  expect((await detailDownload).suggestedFilename()).toBe(
    'StayHub-' + b.bookingCode + '.pdf',
  );
  await request.patch(api + '/bookings/' + b.id + '/cancel', { headers });
  await page.goto('/bookings/' + b.id + '/invoice');
  await expect(page.locator('.invoice-content')).toContainText('Đã hủy');
  await expect(page.locator('.invoice-content')).toContainText(
    'Giữ nguyên lịch sử thanh toán',
  );
  expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(1);
});
