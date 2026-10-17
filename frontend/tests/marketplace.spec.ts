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
  for (const width of [1440, 375]) {
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
test('seeded multi-property Host switches only its two branches and single owner needs no selector', async ({
  page,
  request,
}) => {
  await login(page, request, 'host04');
  await page.goto('/host');
  await expect(
    page.getByLabel('Cơ sở đang quản lý').locator('option'),
  ).toHaveCount(2);
  await page
    .getByLabel('Cơ sở đang quản lý')
    .selectOption('71000000-0000-4000-8000-000000000004');
  await expect(
    page.getByRole('heading', { name: 'Khách sạn Hoàng Thành 1', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Cơ sở đang quản lý')
    .selectOption('71000000-0000-4000-8000-000000000005');
  await page.getByRole('link', { name: 'Đặt phòng', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Khách sạn Hoàng Thành 2', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Khách sạn Hoàng Thành 1', exact: true }),
  ).toHaveCount(0);
  await capture(page, 'host01');
  await page
    .getByRole('link', { name: 'Chỗ nghỉ của tôi', exact: true })
    .click();
  await page.getByRole('link', { name: 'Phòng & giá' }).click();
  await expect(page).toHaveURL(
    '/host/properties/71000000-0000-4000-8000-000000000005/edit',
  );
  await page
    .getByLabel('Cơ sở đang quản lý')
    .selectOption('71000000-0000-4000-8000-000000000004');
  await expect(page).toHaveURL(
    '/host/properties/71000000-0000-4000-8000-000000000004/edit',
  );
  await expect(page.getByLabel('Tên chỗ nghỉ', { exact: true })).toHaveValue(
    'Khách sạn Hoàng Thành 1',
  );
  await page.evaluate(() => localStorage.clear());
  await login(page, request, 'host01');
  await page.goto('/host');
  await expect(page.getByLabel('Cơ sở đang quản lý')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Homestay An Nhiên', exact: true }),
  ).toBeVisible();
});
