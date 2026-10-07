import { test, expect, type Page } from '@playwright/test';
import type { Booking, Property, Role, User } from '../src/lib/types';

const property: Property = {
  id: '10000000-0000-4000-8000-000000000001',
  hostId: 'host',
  slug: 'motion-check',
  name: 'Chỗ nghỉ kiểm tra giao diện',
  description: 'Một không gian ấm áp dành cho chuyến đi của bạn.',
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
  checkInTime: '14:00',
  checkOutTime: '11:30',
  status: 'ACTIVE',
  images: [0, 1, 2].map((i) => ({
    id: `image-${i}`,
    url: `/room-placeholder.svg?image=${i}`,
    sortOrder: i,
  })),
  amenities: [
    {
      amenityId: 'wifi',
      amenity: { id: 'wifi', code: 'WIFI', active: true, nameVi: 'Wi-Fi' },
    },
  ],
};
const propertyPath = `/properties/${property.slug}`;

// Browser-level fixtures keep visual verification independent of the database.
async function mockApi(page: Page, role?: Role) {
  const user: User = {
    id: 'test-user',
    fullName: 'Tài khoản kiểm tra',
    email: 'test@example.com',
    phoneNumber: '0901234567',
    role: role ?? 'GUEST',
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  };
  if (role)
    await page.addInitScript(() =>
      localStorage.setItem('stayhub.accessToken', 'test-session'),
    );
  let booking: Booking | undefined;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let json: unknown;
    if (url.pathname.endsWith('/auth/me')) json = user;
    else if (url.pathname.endsWith('/auth/login'))
      json = { accessToken: 'test-session', user };
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
    else if (url.pathname.endsWith('/admin/hosts'))
      json = [{ ...user, role: 'HOST', status: 'PENDING' }];
    else if (
      url.pathname.endsWith('/bookings') &&
      request.method() === 'POST'
    ) {
      const body = request.postDataJSON();
      const nights =
        (Date.parse(body.checkOut) - Date.parse(body.checkIn)) / 86400000;
      booking = {
        id: 'test-booking',
        bookingCode: 'STB-MOTIONTEST',
        customerNameSnapshot: user.fullName,
        customerEmailSnapshot: user.email,
        customerPhoneSnapshot: user.phoneNumber!,
        propertyNameSnapshot: property.name,
        propertyAddressSnapshot: property.address,
        feedback: null,
        roomType: property.roomTypes[0],
        roomTypeId: property.roomTypes[0].id,
        roomTypeNameSnapshot: property.roomTypes[0].name,
        quantity: body.quantity,
        paymentDeadlineAt: new Date(Date.now() + 3600000).toISOString(),
        expiredAt: null,
        cancelledAt: null,
        property,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        checkInTimeSnapshot: '14:00',
        checkOutTimeSnapshot: '11:30',
        guestCount: body.guestCount,
        totalNights: nights,
        nightlyPriceSnapshot: 850000,
        totalAmount: nights * 850000,
        depositPercentSnapshot: 30,
        depositAmount: nights * 255000,
        remainingAmount: nights * 595000,
        status: 'PENDING_PAYMENT',
        payment: null,
      };
      json = booking;
    } else if (
      url.pathname.endsWith('/bookings/my') ||
      url.pathname.endsWith('/host/bookings')
    )
      json = booking ? [booking] : [];
    else if (url.pathname.endsWith('/pay') && booking) {
      booking = {
        ...booking,
        status: 'CONFIRMED',
        payment: {
          id: 'payment',
          method: 'FAKE',
          amount: booking.depositAmount,
          status: 'SUCCESS',
          paidAt: '2026-10-04T08:00:00Z',
        },
      };
      json = booking;
    } else if (url.pathname.endsWith('/cancel') && booking) {
      booking = { ...booking, status: 'CANCELLED' };
      json = booking;
    } else if (url.pathname.endsWith('/feedback'))
      json = { averageRating: null, count: 0, items: [] };
    else if (url.pathname.endsWith('/payment-demo') && booking)
      json = {
        booking,
        payload: {
          mode: 'DEMO',
          currency: 'VND',
          amount: booking.depositAmount,
          reference: booking.bookingCode,
          description: 'STAYHUB ' + booking.bookingCode,
        },
        qrDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
        serverNow: new Date().toISOString(),
      };
    else if (url.pathname.includes('/properties/')) json = property;
    else {
      const count = url.searchParams.get('limit') === '4' ? 4 : 8;
      const items =
        url.searchParams.get('q') === 'empty'
          ? []
          : Array.from({ length: count }, (_, i) => ({
              ...property,
              id: i === 0 ? property.id : `property-${i}`,
              slug: i === 0 ? property.slug : `motion-check-${i}`,
            }));
      json = { items, total: items.length, page: 1, limit: 12, totalPages: 1 };
    }
    await route.fulfill({ json });
  });
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('home, listing, detail, auth and role areas remain usable at desktop, tablet and mobile sizes', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockApi(page);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/',
      '/properties',
      propertyPath,
      '/login',
      '/register',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      if (route === '/properties')
        await expect(page.locator('.property-card').first()).toBeVisible();
      if (route === propertyPath)
        await expect(page.locator('.stayhub-calendar')).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(
          `${route === '/' ? 'home' : route === propertyPath ? 'detail' : route.slice(1)}-${width}.png`,
        ),
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
  expect(errors).toEqual([]);
});

test('card hover, sticky header, focus feedback and section reveals do not change layout', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/');
  const card = page.locator('.property-card').first();
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  // Finish the initial entrance before comparing layout.
  await expect(card).toHaveCSS('animation-name', 'stayhub-enter');
  await page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (a) =>
          a.effect instanceof KeyframeEffect &&
          a.effect.target?.matches('.property-card'),
      )
      .forEach((a) => a.finish()),
  );
  const before = await card.boundingBox();
  await card.hover();
  await expect(card.locator('img')).toHaveCSS(
    'transform',
    'matrix(1.03, 0, 0, 1.03, 0, 0)',
  );
  const after = await card.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  await expect(page.locator('header')).toHaveAttribute('data-scrolled', 'true');
  await page.locator('#destination').focus();
  await expect(page.locator('.search-box')).toHaveCSS(
    'border-color',
    'rgb(209, 106, 50)',
  );
  await page.locator('footer').scrollIntoViewIfNeeded();
  const footer = page.locator('footer .section-reveal');
  await expect(footer).toHaveAttribute('data-revealed', 'true');
  await expect(footer).toHaveCSS('opacity', '1');
  await noOverflow(page);
});

test('mobile filters and account menu animate both directions and restore keyboard focus', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await mockApi(page);
  await page.goto('/properties');
  const trigger = page.getByRole('button', { name: 'Bộ lọc', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('animation-name', 'stayhub-sheet');
  await expect(dialog).toHaveCSS('animation-duration', '0.24s');
  await page.screenshot({
    path: testInfo.outputPath('mobile-filter.png'),
    animations: 'disabled',
  });
  await dialog.getByLabel('Khu vực', { exact: true }).selectOption('Quận 1');
  await dialog.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(page).toHaveURL(/district=/);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.motion-dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const menuTrigger = page.getByRole('button', { name: 'Mở menu tài khoản' });
  await menuTrigger.click();
  await expect(page.getByRole('menu')).toHaveCSS(
    'animation-name',
    'stayhub-overlay',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.motion-dropdown')).toHaveCount(0);
  await expect(menuTrigger).toBeFocused();
  await noOverflow(page);
});

test('gallery, calendar, booking totals, payment and cancellation work with motion enabled', async ({
  page,
}, testInfo) => {
  await mockApi(page, 'GUEST');
  await page.goto(propertyPath);
  const galleryTrigger = page.getByRole('button', {
    name: `Xem ảnh 1: ${property.name}`,
  });
  await galleryTrigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('animation-name', 'stayhub-overlay');
  await expect(dialog).toHaveCSS('transform', 'none');
  const size = await dialog.locator('img').boundingBox();
  await dialog.getByRole('button', { name: 'Ảnh 2', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Ảnh 2', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect((await dialog.locator('img').boundingBox())?.height).toBe(
    size?.height,
  );
  await page.screenshot({
    path: testInfo.outputPath('gallery.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(galleryTrigger).toBeFocused();
  const calendar = page.locator('.stayhub-calendar');
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(property.roomTypes[0].id);
  const height = (await calendar.boundingBox())?.height;
  await page.getByRole('button', { name: 'Tháng sau' }).click();
  await expect(calendar.locator('.rdp-weeks')).toHaveCount(1);
  const days = calendar.locator(
    '.rdp-day:not(.rdp-outside) .rdp-day_button:not([disabled])',
  );
  await days
    .filter({ has: page.locator('span').filter({ hasText: /^10$/ }) })
    .click();
  await days
    .filter({ has: page.locator('span').filter({ hasText: /^13$/ }) })
    .click();
  expect((await calendar.boundingBox())?.height).toBe(height);
  await expect(page.locator('aside dl')).toContainText('3 đêm');
  await expect(page.locator('aside dl')).toContainText('765.000');
  await expect(page.locator('aside dl')).toHaveCSS('opacity', '1');
  await page.getByLabel('Số khách', { exact: true }).fill('2');
  const request = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/bookings'),
  );
  await page.getByRole('button', { name: 'Đặt chỗ ngay' }).click();
  expect((await request).postDataJSON().guestCount).toBe(2);
  await expect(page).toHaveURL('/bookings');
  const toast = page.locator('[data-sonner-toast]').first();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS('transition-duration', '0.24s');
  await page
    .getByRole('button', { name: 'Thanh toán cọc', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Thanh toán cọc', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Thanh toán cọc', exact: true })
    .click();
  await page.getByRole('button', { name: 'Tôi đã thanh toán' }).click();
  await expect(page.locator('article')).toContainText('Đã xác nhận');
  await page.getByRole('button', { name: 'Hủy đặt chỗ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(page.locator('article')).toContainText('Đã hủy');
  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Tài khoản của tôi' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('account.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test.describe('touch interaction', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 900 },
  });
  test('search, cards, gallery and filters work without hover', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto('/');
    await page.getByLabel('Bạn muốn nghỉ ở đâu?').fill('Quận 1');
    await page.getByRole('button', { name: 'Tìm chỗ nghỉ' }).tap();
    await expect(page).toHaveURL(/q=/);
    const card = page.locator('.property-card').first();
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await expect(page).toHaveURL(propertyPath);
    await page
      .getByRole('button', { name: `Xem ảnh 1: ${property.name}` })
      .tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng', exact: true }).tap();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.goto('/properties');
    await page.getByRole('button', { name: 'Bộ lọc', exact: true }).tap();
    await page
      .getByRole('dialog')
      .getByLabel('Loại chỗ nghỉ')
      .selectOption('HOTEL');
    await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).tap();
    await expect(page).toHaveURL(/type=HOTEL/);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await noOverflow(page);
  });
});

test('loading cards, updated results, empty and error states remain accessible', async ({
  page,
}) => {
  await mockApi(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/properties(?:\?.*)?$/, async (route) => {
    await pending;
    await route.fallback();
  });
  await page.goto('/properties');
  await expect(
    page.getByRole('status', { name: 'Đang tải chỗ nghỉ' }),
  ).toBeVisible();
  await expect(page.locator('.skeleton').first()).toHaveCSS(
    'animation-name',
    'stayhub-skeleton',
  );
  const skeletonSize = await page
    .locator('[aria-hidden="true"] > .overflow-hidden')
    .first()
    .boundingBox();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.skeleton').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(page.locator('.skeleton').first()).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  release();
  await expect(page.locator('.property-card').first()).toBeVisible();
  expect(
    (await page.locator('.property-card').first().boundingBox())?.height,
  ).toBeCloseTo(skeletonSize!.height, 1);
  await expect(page.locator('.property-card').nth(7)).toHaveCSS(
    'animation-name',
    'none',
  );
  await page.getByLabel('Sắp xếp', { exact: true }).selectOption('price_asc');
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(page.locator('.property-card').first()).toBeVisible();
  await page.getByLabel('Bạn muốn nghỉ ở đâu?').fill('empty');
  await page.getByRole('button', { name: 'Tìm chỗ nghỉ' }).click();
  await expect(
    page.getByText('Không tìm thấy chỗ nghỉ phù hợp.'),
  ).toBeVisible();
  await page.route(/\/api\/properties(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 500, json: { message: 'Kiểm tra lỗi kết nối' } }),
  );
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Kiểm tra lỗi kết nối' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
});

test('reduced motion removes decorative effects and keeps filters, calendar and menus operational', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 900 });
  await mockApi(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.property-card').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(page.locator('footer .section-reveal')).toHaveCSS(
    'animation-name',
    'none',
  );
  await page.goto('/properties');
  await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS(
    'animation-duration',
    '1e-05s',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('.motion-dialog')).toHaveCount(0);
  await page.goto(propertyPath);
  await page.getByRole('button', { name: 'Tháng sau' }).click();
  await expect(
    page.locator('.stayhub-calendar [aria-hidden="true"] .rdp-month'),
  ).toHaveCount(0);
  await expect(page.locator('.stayhub-calendar .rdp-weeks')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.motion-dropdown')).toHaveCount(0);
  await noOverflow(page);
});

for (const role of ['HOST', 'ADMIN'] as const) {
  test(`${role} dashboard content and actions fit mobile`, async ({
    page,
  }, testInfo) => {
    await mockApi(page, role);
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(role === 'HOST' ? '/host' : '/admin/hosts');
      await expect(page.locator('article')).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`${role.toLowerCase()}-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
    if (role === 'ADMIN') {
      await page
        .getByRole('button', { name: 'Phê duyệt', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Phê duyệt', exact: true }),
      ).toBeFocused();
    } else {
      await page
        .getByRole('link', { name: 'Thêm chỗ nghỉ', exact: true })
        .click();
      await page.getByRole('button', { name: 'Lưu chỗ nghỉ' }).click();
      await expect(page.getByText('Tên cần ít nhất 3 ký tự.')).toBeVisible();
      await noOverflow(page);
    }
  });
}
