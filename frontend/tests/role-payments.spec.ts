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
      path: `../.local/momo-${name}-${width}.png`,
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

test('QR-free claim, Admin rejection, retry and verification keep all role views consistent', async ({
  page,
  request,
  browser,
}) => {
  const registration = await request.post(api + '/auth/register', {
    data: {
      email: `manual-browser-${Date.now()}@example.test`,
      fullName: 'Khách kiểm thử MoMo',
      password: 'StayHub123!',
      role: 'GUEST',
    },
  });
  expect(registration.status()).toBe(201);
  const guest = (await registration.json()) as Session;
  guests.push(guest.user.id);
  const headers = { Authorization: `Bearer ${guest.accessToken}` };
  await request.patch(api + '/auth/profile', {
    headers,
    data: { fullName: guest.user.fullName, phoneNumber: '0901234567' },
  });
  const property = (await (
    await request.get(api + '/properties/71000000-0000-4000-8000-000000000002')
  ).json()) as Property;
  const future = (offset: number) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const response = await request.post(api + '/bookings', {
    headers,
    data: {
      roomTypeId: property.roomTypes[0].id,
      quantity: 1,
      guestCount: 1,
      checkIn: future(180),
      checkOut: future(182),
    },
  });
  expect(response.status()).toBe(201);
  const booking = (await response.json()) as Booking;
  await page.addInitScript(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    guest.accessToken,
  );
  await page.goto(`/bookings/${booking.id}/payment`);
  await expect(
    page.getByRole('heading', { name: 'Thanh toán qua MoMo' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /QR/i })).toHaveCount(0);
  await capture(page, 'payment');
  const depositButton = await page
    .getByRole('button', { name: 'Thanh toán cọc', exact: true })
    .boundingBox();
  expect(depositButton!.height).toBeGreaterThanOrEqual(44);
  const adminSession = (await (
    await request.post(api + '/auth/login', {
      data: { email: 'admin01', password: process.env.DEMO_PASSWORD },
    })
  ).json()) as Session;
  const adminContext = await browser.newContext();
  await adminContext.addInitScript(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    adminSession.accessToken,
  );
  const admin = await adminContext.newPage();
  try {
    for (const rejected of [true, false]) {
      const ref = `UI-${Date.now()}-${rejected ? 'REJECT' : 'VERIFY'}`;
      await page
        .getByRole('button', {
          name: rejected ? 'Thanh toán cọc' : 'Gửi lại thông tin thanh toán',
          exact: true,
        })
        .click();
      await page.getByLabel('Mã giao dịch MoMo *').fill(ref);
      if (rejected) await capture(page, 'claim-dialog');
      await page
        .getByRole('button', { name: 'Tôi đã thanh toán', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Đang chờ đối chiếu thanh toán' }),
      ).toBeVisible();
      expect(
        (
          (await (
            await request.get(api + '/bookings/my', { headers })
          ).json()) as Booking[]
        ).some((b) => b.id === booking.id),
      ).toBe(false);
      await admin.goto(`/admin/bookings/${booking.id}`);
      const row = admin.locator('article').filter({ hasText: ref }).last();
      await expect(row).toContainText('Chờ xác minh');
      if (rejected) await capture(admin, 'booking-reconciliation');
      await row.getByRole('button', { name: 'Kiểm tra giao dịch' }).click();
      if (rejected) {
        await admin.getByLabel('Kết quả kiểm tra').selectOption('REJECT');
        await admin
          .getByLabel('Ghi chú / lý do', { exact: false })
          .fill('Không thấy giao dịch trong tài khoản nhận.');
      } else {
        await admin
          .getByLabel('Số tiền thực nhận (₫) *')
          .fill(String(booking.depositAmount));
        await admin.getByLabel('Mã giao dịch trong tài khoản nhận *').fill(ref);
        await admin
          .getByLabel('Tôi đã kiểm tra giao dịch trong tài khoản nhận tiền.')
          .check();
      }
      await admin.getByRole('button', { name: 'Lưu kết quả xác minh' }).click();
      await expect(admin.getByRole('dialog')).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole('heading', {
          name: rejected
            ? 'Chưa xác minh được khoản chuyển tiền'
            : 'Thanh toán đã được xác nhận',
          exact: true,
        }),
      ).toBeVisible();
      if (rejected) {
        await expect(page.getByRole('status').first()).toContainText(
          'Không thấy giao dịch',
        );
        await page
          .getByRole('link', {
            name: 'Kiểm tra và gửi lại thông tin',
            exact: true,
          })
          .click();
      }
    }
    await capture(page, 'verified-result');
    await admin.goto('/admin/properties');
    await expect(admin.locator('h1')).toBeVisible();
    await capture(admin, 'admin-properties');
    const final = (await (
      await request.get(`${api}/bookings/${booking.id}`, { headers })
    ).json()) as Booking;
    expect(final.status).toBe('CONFIRMED');
    expect(final.paymentAttempts!.map((p) => p.status)).toEqual([
      'FAILED',
      'SUCCESS',
    ]);
    expect(final.paymentAttempts!.at(-1)!.reviewedById).toBe(
      adminSession.user.id,
    );
  } finally {
    await adminContext.close();
  }
});
