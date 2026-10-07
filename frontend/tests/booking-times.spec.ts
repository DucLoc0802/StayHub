import { test, expect, type Page } from '@playwright/test';
import type { Property } from '../src/lib/types';

// Exercise Vietnam cutoffs even when the browser is in a different timezone.
test.use({ timezoneId: 'America/Los_Angeles' });
const property: Property = {
  id: '10000000-0000-4000-8000-000000000001',
  hostId: 'host',
  slug: 'cho-nghi-kiem-thu-gio',
  name: 'Chỗ nghỉ kiểm thử giờ',
  description: 'Không gian riêng tư dành cho chuyến đi của bạn.',
  type: 'HOMESTAY',
  district: 'Quận 1',
  address: '18 Nguyễn Văn Thủ',
  minPricePerNight: 850000,
  paymentWindowHours: 6,
  roomTypes: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      propertyId: '10000000-0000-4000-8000-000000000001',
      name: 'Nguyên căn homestay',
      description: 'Toàn bộ chỗ ở',
      pricePerNight: 850000,
      totalUnits: 1,
      maxGuests: 3,
      bedrooms: 1,
      beds: 2,
      bathrooms: 1,
      status: 'ACTIVE',
    },
  ],
  depositPercent: 30,
  status: 'ACTIVE',
  checkInTime: '14:00',
  checkOutTime: '11:30',
  images: [],
  amenities: [
    {
      amenityId: '20000000-0000-4000-8000-000000000001',
      amenity: {
        id: '20000000-0000-4000-8000-000000000001',
        code: 'WIFI',
        active: true,
        nameVi: 'Wi-Fi',
      },
    },
  ],
};
const path = `/properties/${property.slug}`;

async function mockApi(page: Page, role: 'HOST' | 'GUEST' = 'GUEST') {
  await page.addInitScript(() =>
    localStorage.setItem('stayhub.accessToken', 'test-session'),
  );
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let json: unknown;
    if (url.pathname.endsWith('/auth/me'))
      json = {
        id: role.toLowerCase(),
        fullName: 'Tài khoản kiểm thử',
        email: 'test@example.com',
        phoneNumber: '0901234567',
        role,
        status: 'ACTIVE',
        createdAt: '2026-10-01T00:00:00Z',
      };
    else if (url.pathname.endsWith('/bookings/policy'))
      json = {
        minimumLeadTimeHours: 2,
        paymentWindowOptions: [1, 3, 6, 12, 24],
        defaultPaymentWindowHours: 6,
        maxActiveUnpaidBookings: 2,
        lastMinuteThresholdHours: 24,
        lastMinutePaymentWindowHours: 1,
      };
    else if (url.pathname.endsWith('/bookings/eligibility'))
      json = {
        canBook: true,
        activeUnpaidBookings: 0,
        maxActiveUnpaidBookings: 2,
        bookingBlockedUntil: null,
      };
    else if (url.pathname.endsWith('/calendar')) json = { serverNow: new Date().toISOString(), days: [] };
    else if (url.pathname.endsWith('/availability'))
      json = {
        roomTypeId: property.roomTypes[0].id,
        availableUnits: 1,
        totalUnits: 1,
        days: [],
        serverNow: new Date().toISOString(),
      };
    else if (url.pathname.endsWith('/quote')) {
      const nights =
        (Date.parse(url.searchParams.get('checkOut')!) -
          Date.parse(url.searchParams.get('checkIn')!)) /
        86400000;
      json = {
        roomTypeId: property.roomTypes[0].id,
        quantity: 1,
        totalNights: nights,
        nightlyPriceSnapshot: 850000,
        totalAmount: nights * 850000,
        depositPercentSnapshot: 30,
        depositAmount: nights * 255000,
        remainingAmount: nights * 595000,
        availableUnits: 1,
        paymentDeadlineAt: new Date(Date.now() + 3600000).toISOString(),
        serverNow: new Date().toISOString(),
      };
    } else if (url.pathname.endsWith('/amenities'))
      json = property.amenities.map((a) => a.amenity);
    else if (url.pathname.endsWith('/host/properties')) json = [property];
    else if (url.pathname.endsWith('/feedback'))
      json = { averageRating: null, count: 0, items: [] };
    else if (url.pathname.includes('/properties/')) json = property;
    else if (url.pathname.endsWith('/bookings/my')) json = [];
    else
      json = { items: [property], total: 1, page: 1, limit: 12, totalPages: 1 };
    await route.fulfill({ json });
  });
}

const day = (page: Page, value: string) =>
  page.locator(`[data-day="${value}"] .rdp-day_button`).first();

test('guests see host times and today becomes dimmed and disabled when the selected stay expires', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-04T04:50:00Z') });
  await mockApi(page);
  await page.goto(path);
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(property.roomTypes[0].id);
  const card = page.locator('aside');
  await expect(card.getByText('14:00', { exact: true })).toBeVisible();
  await expect(card.getByText('11:30', { exact: true })).toBeVisible();
  await expect(day(page, '2026-10-03')).toBeVisible();
  await expect(day(page, '2026-10-03')).toBeDisabled();
  await expect(day(page, '2026-10-03').locator('..')).toHaveCSS(
    'opacity',
    '0.5',
  );
  await day(page, '2026-10-04').click();
  await day(page, '2026-10-05').click();
  await expect(
    page.getByRole('button', { name: 'Đặt chỗ ngay' }),
  ).toBeEnabled();
  await page.clock.pauseAt(new Date('2026-10-04T04:59:56Z'));
  await page.clock.fastForward(5000);
  await page.clock.resume();
  await expect(day(page, '2026-10-04')).toBeVisible();
  await expect(day(page, '2026-10-04')).toBeDisabled();
  await expect(day(page, '2026-10-04').locator('..')).toHaveCSS(
    'opacity',
    '0.5',
  );
  await expect(
    page.getByRole('button', { name: 'Đặt chỗ ngay' }),
  ).toBeDisabled();
  await expect(card.getByRole('alert')).toContainText(
    'Thời gian nhận phòng quá gần',
  );
  await day(page, '2026-10-05').click();
  await day(page, '2026-10-06').click();
  await expect(
    page.getByRole('button', { name: 'Đặt chỗ ngay' }),
  ).toBeEnabled();
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('opening a listing after check-in keeps past days visible, dimmed and disabled', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T07:00:01Z'));
  await mockApi(page);
  await page.goto(path);
  await expect(day(page, '2026-10-04')).toBeVisible();
  await expect(day(page, '2026-10-04')).toBeDisabled();
  await expect(day(page, '2026-10-04').locator('..')).toHaveCSS(
    'opacity',
    '0.5',
  );
  await expect(day(page, '2026-10-05')).toBeEnabled();
});

test('host edits persist both times in the property request', async ({
  page,
}) => {
  await mockApi(page, 'HOST');
  await page.goto(`/host/properties/${property.id}/edit`);
  await expect(page.getByLabel('Giờ nhận phòng', { exact: true })).toHaveValue(
    '14:00',
  );
  await expect(page.getByLabel('Giờ trả phòng', { exact: true })).toHaveValue(
    '11:30',
  );
  await page.getByLabel('Giờ nhận phòng', { exact: true }).fill('16:45');
  await page.getByLabel('Giờ trả phòng', { exact: true }).fill('10:15');
  await page
    .getByLabel('Ảnh chỗ nghỉ', { exact: true })
    .fill('https://example.com/room.jpg');
  const request = page.waitForRequest(
    (r) =>
      r.method() === 'PATCH' &&
      r.url().endsWith(`/host/properties/${property.id}`),
  );
  await page.getByRole('button', { name: 'Lưu chỗ nghỉ' }).click();
  const body = (await request).postDataJSON();
  expect(body.checkInTime).toBe('16:45');
  expect(body.checkOutTime).toBe('10:15');
});
