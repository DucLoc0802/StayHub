import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import type { Session } from '../src/lib/types';
test.skip(
  !process.env.INVENTORY_TEST_DATABASE_URL || !process.env.DEMO_PASSWORD,
  'Requires isolated seeded marketplace database',
);
const api = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
async function login(page: Page, request: APIRequestContext, email: string) {
  const response = await request.post(`${api}/auth/login`, {
    data: { email, password: process.env.DEMO_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const session = (await response.json()) as Session;
  await page.goto('/login');
  await page.evaluate(
    (token) => localStorage.setItem('stayhub.accessToken', token),
    session.accessToken,
  );
  return session;
}
async function capture(page: Page, name: string) {
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../.local/marketplace-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
}
test('Admin reads cross-Host history, filters payment and property, and sees only recorded events', async ({
  page,
  request,
}) => {
  await login(page, request, 'admin01');
  await page.goto('/admin/bookings');
  await expect(
    page.getByRole('heading', { name: 'Tra cứu đặt phòng' }),
  ).toBeVisible();
  for (const name of [
    'Homestay An Nhiên',
    'Khách sạn Minh Châu',
    'Nhà nghỉ Bình An',
    'Khách sạn Hoàng Thành 1',
    'Khách sạn Hoàng Thành 2',
  ])
    await expect(
      page.getByRole('heading', { name, exact: true }).first(),
    ).toBeVisible();
  await capture(page, 'admin01');
  await page
    .getByLabel('Cơ sở / chi nhánh')
    .selectOption('71000000-0000-4000-8000-000000000003');
  await page
    .getByLabel('Thanh toán cọc', { exact: true })
    .selectOption('SUCCESS');
  await page
    .getByRole('link', { name: 'Xem đơn đặt phòng STB-DEMO-V2-3', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/bookings\//);
  await expect(
    page.getByRole('heading', { name: 'Lịch sử đặt phòng & thanh toán' }),
  ).toBeVisible();
  await expect(
    page.getByText('Giao dịch mô phỏng thành công', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Hủy đặt phòng', { exact: true })).toBeVisible();
  await expect(page.getByText('Hoàn tất lưu trú', { exact: true })).toHaveCount(
    0,
  );
  await capture(page, 'history');
});
test('five seeded Hosts each manage exactly one property', async ({
  page,
  request,
}) => {
  for (const [name, property] of [
    ['host01', 'Homestay An Nhiên'],
    ['host02', 'Khách sạn Minh Châu'],
    ['host03', 'Nhà nghỉ Bình An'],
    ['host04', 'Khách sạn Hoàng Thành 1'],
    ['host05', 'Khách sạn Hoàng Thành 2'],
  ]) {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await login(page, request, name);
    await page.goto('/host');
    await expect(page.getByLabel('Cơ sở đang quản lý')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: property, exact: true }),
    ).toBeVisible();
  }
});
