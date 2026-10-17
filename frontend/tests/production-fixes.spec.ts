import { test, expect, type Page } from '@playwright/test';
import type { Booking, Property, Session } from '../src/lib/types';
const api = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
async function mockedSession(page: Page, role: 'ADMIN' | 'GUEST') {
  await page.addInitScript(() =>
    localStorage.setItem('stayhub.accessToken', 'test-token'),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'actor',
        email: 'actor@example.test',
        fullName: role === 'ADMIN' ? 'admin01' : 'guest01',
        role,
        status: 'ACTIVE',
        phoneNumber: '0901234567',
      },
    }),
  );
}
test('real Admin accommodation data renders separate cards and read-only detail at all viewports', async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.INVENTORY_TEST_DATABASE_URL,
    'Requires isolated database',
  );
  const login = await request.post(api + '/auth/login', {
    data: { email: 'admin01', password: process.env.DEMO_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const session = (await login.json()) as Session;
  const result = await request.get(api + '/admin/properties', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(result.status()).toBe(200);
  const properties = (await result.json()).items as (Property & {
    host: { fullName: string };
  })[];
  expect(properties).toHaveLength(5);
  await page.addInitScript(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    session.accessToken,
  );
  await page.goto('/admin/properties');
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('article')).toHaveCount(properties.length);
    for (const property of properties) {
      const card = page.locator('article').filter({
        has: page.getByRole('heading', { name: property.name, exact: true }),
      });
      await expect(card).toContainText(property.host.fullName);
      await expect(card).toContainText(property.address);
      await expect(card).toContainText('Đang hoạt động');
      await expect(card).toHaveClass(/panel/);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../.local/production-fixed-properties-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page
    .locator('article')
    .first()
    .getByRole('link', { name: 'Chi tiết cơ sở', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Loại phòng và sức chứa' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Tra cứu đặt phòng tại cơ sở này' })
    .click();
  await expect(page.getByLabel('Cơ sở / chi nhánh')).not.toHaveValue('');
});
test('optional booking-filter failure preserves booking data and offers a separate retry', async ({
  page,
}) => {
  await mockedSession(page, 'ADMIN');
  const b = {
    id: '10000000-0000-4000-8000-000000000001',
    bookingCode: 'STB-OPTIONAL-123',
    status: 'PENDING_PAYMENT',
    createdAt: '2026-10-01',
    checkIn: '2027-10-01',
    checkOut: '2027-10-02',
    paymentDeadlineAt: '2027-09-01',
    checkInTimeSnapshot: '14:00',
    checkOutTimeSnapshot: '12:00',
    quantity: 1,
    guestCount: 1,
    roomTypeNameSnapshot: 'Phòng tiêu chuẩn',
    customerNameSnapshot: 'Guest',
    depositAmount: 100000,
    totalAmount: 300000,
    remainingAmount: 200000,
    property: { id: 'property', name: 'Cơ sở đã tải', type: 'HOTEL' },
    guest: { fullName: 'Guest' },
    payment: null,
  } as unknown as Booking;
  await page.route('**/api/admin/bookings?*', (route) =>
    route.fulfill({ json: { items: [b], total: 1, page: 1, limit: 20 } }),
  );
  await page.route('**/api/admin/booking-filters', (route) =>
    route.fulfill({
      status: 503,
      json: { code: 'DATABASE_UNAVAILABLE', message: 'Filter unavailable' },
    }),
  );
  await page.goto('/admin/bookings');
  await expect(
    page.getByRole('heading', { name: 'Cơ sở đã tải', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Tải lại bộ lọc' }),
  ).toBeVisible();
  await expect(page.getByLabel('Chủ cơ sở', { exact: true })).toBeDisabled();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
});
test('removed Admin modules redirect safely and review calls are not made', async ({
  page,
}) => {
  await mockedSession(page, 'ADMIN');
  await page.route('**/api/admin/bookings?*', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, limit: 20 } }),
  );
  await page.route('**/api/admin/booking-filters', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/admin/statistics', (route) =>
    route.fulfill({ json: {} }),
  );
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(admin\/)?feedback/.test(request.url()))
      requests.push(request.url());
  });
  await page.goto('/admin/payments');
  await expect(page).toHaveURL('/admin/bookings');
  await expect(
    page
      .getByRole('navigation', { name: 'Quản trị StayHub' })
      .getByRole('link', { name: 'Xác minh thanh toán', exact: true }),
  ).toHaveCount(0);
  await page.goto('/admin/feedback');
  await expect(page).toHaveURL('/admin');
  await expect(
    page
      .getByRole('navigation', { name: 'Quản trị StayHub' })
      .getByRole('link', { name: 'Đánh giá', exact: true }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
});
for (const scenario of [
  {
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    title: 'Không tìm thấy đặt phòng',
  },
  {
    status: 404,
    code: 'API_ROUTE_NOT_FOUND',
    title: 'Chưa thể tải thông tin thanh toán',
  },
  {
    status: 503,
    code: 'DATABASE_UNAVAILABLE',
    title: 'Chưa thể tải thông tin thanh toán',
  },
  {
    status: 400,
    code: 'INVALID_BOOKING_ID',
    title: 'Mã đặt phòng không hợp lệ',
  },
]) {
  test(`checkout distinguishes ${scenario.code} with a recovery action`, async ({
    page,
  }) => {
    await mockedSession(page, 'GUEST');
    await page.route('**/api/bookings/*/payment', (route) =>
      route.fulfill({
        status: scenario.status,
        json: {
          code: scenario.code,
          message: 'Vui lòng mở lại đơn hoặc thử lại sau.',
        },
      }),
    );
    await page.goto('/bookings/10000000-0000-4000-8000-000000000001/payment');
    await expect(
      page.getByRole('heading', { name: scenario.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Về danh sách đặt phòng', exact: true }),
    ).toBeVisible();
    expect(
      await page.getByRole('button', { name: 'Thử lại', exact: true }).count(),
    ).toBe(
      scenario.code === 'RESOURCE_NOT_FOUND' ||
        scenario.code === 'INVALID_BOOKING_ID'
        ? 0
        : 1,
    );
  });
}
