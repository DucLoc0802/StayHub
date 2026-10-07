import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
test('public pages render without horizontal overflow on desktop, tablet and mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  fs.mkdirSync(path.resolve('../docs/screenshots'), { recursive: true });
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/properties', '/login', '/register']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: /Chỗ nghỉ vừa ý,\s*chuyến đi trọn vẹn/,
      }),
    ).toBeVisible();
    await expect(page.locator('.property-card').first()).toBeVisible();
    await page.screenshot({
      path: `../docs/screenshots/home-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  expect(errors).toEqual([]);
});
test('search and mobile filter navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await page.getByLabel('Bạn muốn nghỉ ở đâu?').fill('Quận 1');
  await page.getByRole('button', { name: 'Tìm chỗ nghỉ' }).click();
  await expect(page).toHaveURL(/q=/);
  await page.getByRole('button', { name: 'Bộ lọc' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .locator('input[name="minPrice"]')
    .fill('500000');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Áp dụng bộ lọc' })
    .click();
  await expect(page).toHaveURL(/minPrice=500000/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('guest login, property detail calendar, booking, fake deposit and cancellation', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Tài khoản hoặc email', { exact: true }).fill('guest');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('guest');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/properties/10000000-0000-4000-8000-000000000001');
  await expect(
    page.getByRole('heading', { name: 'Cam Giấy · Căn hộ ban công' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/properties\/cam-giay/);
  await expect(page.locator('.gallery-image')).toHaveCount(3);
  await expect
    .poll(
      () =>
        page
          .locator('main img')
          .evaluateAll(
            (images) =>
              images.length >= 3 &&
              images.every(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              ),
          ),
      { timeout: 30000 },
    )
    .toBe(true);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../docs/screenshots/detail-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.getByRole('button', { name: 'Tháng sau' }).click();
  const nextMonth = new Date();
  nextMonth.setDate(1);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const month = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
  const roomTypeId = await page
    .getByLabel(
      'Lo' +
        String.fromCharCode(0x1ea1) +
        'i ph' +
        String.fromCharCode(0xf2) +
        'ng / ch' +
        String.fromCharCode(0x1ed7) +
        ' ' +
        String.fromCharCode(0x1edf),
    )
    .inputValue();
  const availability = await page.request.get(
    `${process.env.TEST_API_URL ?? 'http://localhost:4000/api'}/room-types/${roomTypeId}/availability?checkIn=${month}-01&checkOut=${month}-28`,
  );
  expect(availability.ok()).toBe(true);
  const { days }: { days: { date: string; availableUnits: number }[] } =
    await availability.json();
  const start = days.findIndex(
    (_, i) =>
      days.slice(i, i + 4).length === 4 &&
      days.slice(i, i + 4).every((day) => day.availableUnits > 0),
  );
  expect(start).toBeGreaterThanOrEqual(0);
  for (const date of [days[start].date, days[start + 3].date]) {
    await page
      .locator(`[data-day="${date}"]:not(.rdp-outside) .rdp-day_button`)
      .click();
  }
  await page.getByRole('button', { name: 'Đặt chỗ ngay' }).click();
  await expect(page).toHaveURL('/bookings');
  const card = page.locator('article').first();
  await expect(card.getByText('Chờ thanh toán', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Thanh toán cọc' }).click();
  await expect(page.getByRole('dialog')).toContainText('không thu tiền thật');
  await page.getByRole('button', { name: 'Tôi đã thanh toán' }).click();
  await expect(card.getByText('Đã xác nhận', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('mất khoản tiền cọc');
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(card.getByText('Đã hủy', { exact: true })).toBeVisible();
  await expect(
    card.getByText('Tiền cọc được giữ lại, không hoàn tiền.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL('/');
  expect(
    await page.evaluate(() => localStorage.getItem('stayhub.accessToken')),
  ).toBeNull();
});
test('role areas, host form validation and account states fit narrow screens', async ({
  page,
}) => {
  for (const [email, password, route, heading] of [
    ['host', 'host', '/host', 'Cùng đón những chuyến đi mới.'],
    [
      'pendinghost@stayhub.local',
      'StayHub123!',
      '/account',
      'Tài khoản của tôi',
    ],
    ['admin', 'admin', '/admin/hosts', 'Xét duyệt người cho thuê'],
  ]) {
    await page.goto('/login');
    await page.getByLabel('Tài khoản hoặc email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(route);
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    if (email === 'host') {
      await page.getByRole('link', { name: 'Thêm chỗ nghỉ' }).click();
      await page.getByLabel('Giá mỗi đêm (₫)').fill('850000');
      await page.getByRole('button', { name: 'Lưu chỗ nghỉ' }).click();
      await expect(page.getByText('Tên cần ít nhất 3 ký tự.')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.goto('/host/bookings');
      await expect(
        page.getByRole('heading', { name: 'Đặt phòng tại chỗ nghỉ của tôi' }),
      ).toBeVisible();
    }
    if (email.startsWith('pendinghost@'))
      await expect(
        page.getByRole('heading', {
          name: 'Tài khoản của bạn đang chờ phê duyệt.',
        }),
      ).toBeVisible();
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL('/');
  }
});
test('empty results, network errors and keyboard dialog dismissal', async ({
  page,
}) => {
  await page.goto('/properties?q=not-a-real-listing-9a39d1');
  await expect(
    page.getByText('Không tìm thấy chỗ nghỉ phù hợp.'),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Bộ lọc' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Bộ lọc' })).toBeFocused();
  await page.route('**/api/properties*', (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Không thể kết nối máy chủ.' }),
  ).toBeVisible({ timeout: 20000 });
});
