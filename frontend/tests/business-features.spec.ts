import { test, expect, type Page } from '@playwright/test';
import type { Booking, Property, User } from '../src/lib/types';
const id = '10000000-0000-4000-8000-000000000099';
const property: Property = {
  id,
  hostId: 'host',
  slug: 'business-ui-demo',
  name: 'Khách sạn tổng hợp',
  description: 'Không gian tổng hợp để kiểm tra giao diện.',
  type: 'HOTEL',
  district: 'Quận 1',
  address: 'Địa chỉ tổng hợp',
  minPricePerNight: 600000,
  depositPercent: 30,
  paymentWindowHours: 6,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  status: 'ACTIVE',
  images: [{ id: 'image', url: '/room-placeholder.svg', sortOrder: 0 }],
  amenities: [],
  roomTypes: [
    {
      id,
      propertyId: id,
      name: 'Tiêu chuẩn',
      description: 'Phòng đôi',
      pricePerNight: 600000,
      totalUnits: 10,
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      status: 'ACTIVE',
    },
    {
      id: '30000000-0000-4000-8000-000000000099',
      propertyId: id,
      name: 'Cao cấp',
      description: 'Phòng cao cấp',
      pricePerNight: 900000,
      totalUnits: 6,
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      status: 'ACTIVE',
    },
  ],
};
const booking: Booking = {
  id: '50000000-0000-4000-8000-000000000099',
  guestId: 'guest',
  bookingCode: 'STB-BROWSERDEMO',
  customerNameSnapshot: 'Khách tổng hợp',
  customerPhoneSnapshot: '0901234567',
  customerEmailSnapshot: 'synthetic@example.test',
  propertyNameSnapshot: property.name,
  propertyAddressSnapshot: property.address,
  feedback: null,
  roomType: property.roomTypes[0],
  roomTypeId: id,
  roomTypeNameSnapshot: 'Tiêu chuẩn',
  quantity: 2,
  guestCount: 4,
  checkIn: '2027-10-09',
  checkOut: '2027-10-11',
  checkInTimeSnapshot: '14:00',
  checkOutTimeSnapshot: '12:00',
  paymentDeadlineAt: '2027-10-05T09:00:00Z',
  expiredAt: null,
  cancelledAt: null,
  nightlyPriceSnapshot: 600000,
  totalNights: 2,
  totalAmount: 2400000,
  depositPercentSnapshot: 30,
  depositAmount: 720000,
  remainingAmount: 1680000,
  status: 'PENDING_PAYMENT',
  payment: null,
  property,
};
async function mock(
  page: Page,
  role: User['role'] = 'GUEST',
  complete = true,
  scenario: 'hotel' | 'homestay' | 'completed' = 'hotel',
  accountStatus: User['status'] = 'ACTIVE',
) {
  await page.clock.install({ time: new Date('2027-10-05T03:00:00Z') });
  await page.addInitScript(() =>
    localStorage.setItem('stayhub.accessToken', 'synthetic-token'),
  );
  let user: User = {
      id: 'guest',
      fullName: 'Khách tổng hợp',
      email: 'synthetic@example.test',
      phoneNumber: complete ? '0901234567' : null,
      role,
      status: accountStatus,
      createdAt: '2026-10-01',
    },
    current: Booking = { ...booking };
  const listing: Property =
    scenario === 'homestay'
      ? {
          ...property,
          type: 'HOMESTAY',
          roomTypes: [{ ...property.roomTypes[0], totalUnits: 1 }],
        }
      : property;
  if (scenario === 'completed')
    current = {
      ...current,
      status: 'CONFIRMED',
      checkIn: '2027-10-01',
      checkOut: '2027-10-03',
      payment: {
        id: 'payment',
        method: 'FAKE',
        status: 'SUCCESS',
        amount: current.depositAmount,
        paidAt: '2027-09-30T03:00:00Z',
      },
    };
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    let data: unknown = {},
      status = 200;
    if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/auth/profile')) {
      user = { ...user, ...request.postDataJSON() };
      data = user;
    } else if (path.endsWith('/bookings/policy'))
      data = {
        minimumLeadTimeHours: 2,
        paymentWindowOptions: [1, 3, 6, 12, 24],
        defaultPaymentWindowHours: 6,
        maxActiveUnpaidBookings: 2,
        lastMinuteThresholdHours: 24,
        lastMinutePaymentWindowHours: 1,
      };
    else if (path.endsWith('/bookings/eligibility'))
      data = {
        canBook: true,
        activeUnpaidBookings: 0,
        maxActiveUnpaidBookings: 2,
        bookingBlockedUntil: null,
      };
    else if (path.endsWith('/calendar')) {
      const from = Date.parse(url.searchParams.get('checkIn')!);
      const to = Date.parse(url.searchParams.get('checkOut')!);
      data = {
        serverNow: '2027-10-05T03:00:00Z',
        days: Array.from({ length: (to - from) / 86400000 }, (_, i) => {
          const date = new Date(from + i * 86400000).toISOString().slice(0, 10);
          const values: Record<string, [number | null, number]> = {
            '2027-10-09': [900000, 3], '2027-10-10': [600000, 7],
            '2027-10-11': [600000, 4], '2027-10-12': [600000, 1],
            '2027-10-13': [null, 0],
          };
          const [pricePerNight, availableUnits] = values[date] ?? [600000, 10];
          return { date, pricePerNight, availableUnits };
        }),
      };
    }
    else if (path.endsWith('/availability')) {
      const from = Date.parse(url.searchParams.get('checkIn')!),
        to = Date.parse(url.searchParams.get('checkOut')!);
      const deluxe = path.includes('30000000');
      const days = Array.from({ length: (to - from) / 86400000 }, (_, i) => {
        const date = new Date(from + i * 86400000).toISOString().slice(0, 10);
        return {
          date,
          availableUnits:
            scenario === 'homestay'
              ? date === '2027-10-09'
                ? 0
                : 1
              : deluxe
                ? date === '2027-10-09'
                  ? 0
                  : 6
                : ((
                    {
                      '2027-10-09': 8,
                      '2027-10-10': 4,
                      '2027-10-11': 1,
                      '2027-10-12': 0,
                    } as Record<string, number>
                  )[date] ?? 10),
        };
      });
      data = {
        roomTypeId: deluxe ? property.roomTypes[1].id : id,
        totalUnits: scenario === 'homestay' ? 1 : deluxe ? 6 : 10,
        availableUnits: Math.min(...days.map((d) => d.availableUnits)),
        days,
        serverNow: '2027-10-05T03:00:00Z',
      };
    } else if (path.endsWith('/quote'))
      data = {
        ...current,
        availableUnits: 4,
        serverNow: '2027-10-05T03:00:00Z',
      };
    else if (path.endsWith('/payment-demo'))
      data = {
        booking: current,
        payload: {
          mode: 'DEMO',
          currency: 'VND',
          amount: current.depositAmount,
          reference: current.bookingCode,
          description: `STAYHUB ${current.bookingCode}`,
        },
        qrDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
        serverNow: '2027-10-05T03:00:00Z',
      };
    else if (path.endsWith('/pay')) {
      current = {
        ...current,
        status: 'CONFIRMED',
        payment: {
          id: 'payment',
          method: 'FAKE',
          status: 'SUCCESS',
          amount: current.depositAmount,
          paidAt: '2027-10-05T03:00:00Z',
        },
      };
      data = current;
      status = 201;
    } else if (path.endsWith('/invoice'))
      data = {
        ...current,
        status: 'CONFIRMED',
        payment: {
          id: 'payment',
          method: 'FAKE',
          status: 'SUCCESS',
          amount: current.depositAmount,
          paidAt: '2027-10-05T03:00:00Z',
        },
      };
    else if (path.endsWith('/bookings/my') || path.endsWith('/host/bookings'))
      data = [current];
    else if (path.includes('/bookings/lookup/')) data = current;
    else if (path === '/api/bookings' && request.method() === 'POST') {
      data = current;
      status = 201;
    } else if (path.endsWith('/admin/statistics'))
      data = {
        guests: 2,
        hosts: 4,
        properties: 38,
        roomTypes: 62,
        totalBookings: 8,
        confirmed: 7,
        pending: 1,
        expired: 0,
        cancelled: 0,
        successfulDepositAmount: 720000,
      };
    else if (path.endsWith('/admin/users'))
      data = {
        items: [{ ...user, role: 'GUEST' }],
        total: 1,
        page: 1,
        limit: 20,
      };
    else if (path.endsWith('/history'))
      data = {
        user,
        totalBookings: 1,
        confirmed: 1,
        pending: 0,
        expired: 0,
        cancelled: 0,
        successfulDepositAmount: 720000,
        recentBookings: [current],
      };
    else if (path.endsWith('/admin/bookings'))
      data = { items: [current], total: 1, page: 1, limit: 20 };
    else if (path.endsWith('/admin/amenities'))
      data = [{ id: 'amenity', code: 'WIFI', nameVi: 'Wi-Fi', active: true }];
    else if (path.endsWith('/admin/feedback')) data = [];
    else if (path.endsWith('/feedback') && request.method() === 'POST') {
      const feedback = {
        id: 'review',
        ...request.postDataJSON(),
        createdAt: '2027-10-05T03:00:00Z',
      };
      current = { ...current, feedback };
      data = feedback;
      status = 201;
    } else if (path.endsWith('/feedback'))
      data = {
        averageRating: 5,
        count: 1,
        items: [
          {
            id: 'review',
            rating: 5,
            content: 'Đánh giá tổng hợp rất rõ ràng.',
            createdAt: '2027-10-01',
            guest: { fullName: 'Khách tổng hợp' },
          },
        ],
      };
    else if (path.includes('/properties/')) data = listing;
    else if (path.includes('/bookings/')) data = current;
    await route.fulfill({ status, json: data });
  });
}
const day = (page: Page, value: string) =>
  page.locator(`[data-day="${value}"]:not(.rdp-outside) .rdp-day_button`);

test('profile accepts formatted Vietnamese phones, submits canonical digits and rejects invalid text', async ({ page }) => {
  await mock(page);
  await page.goto('/account');
  const phone = page.getByLabel('Số điện thoại *', { exact: true });
  for (const input of ['0901234567', '090 123 4567', '090-123-4567', '+84 90 123 4567']) {
    await phone.fill(input);
    const request = page.waitForRequest((req) => req.url().endsWith('/auth/profile') && req.method() === 'PATCH');
    await page.getByRole('button', { name: 'Lưu thông tin' }).click();
    expect((await request).postDataJSON().phoneNumber).toBe('0901234567');
    await expect(page.getByRole('link', { name: 'Tiếp tục đặt phòng' })).toBeVisible();
  }
  let submitted = false;
  page.on('request', (req) => { if (req.url().endsWith('/auth/profile')) submitted = true; });
  await phone.fill('not a phone');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  await expect(page.locator('#profile-phone-error')).toBeVisible();
  expect(submitted).toBe(false);
});

for (const status of ['PENDING', 'ACTIVE'] as const) {
  test(`converted ${status} Host can navigate personal history, invoice and feedback`, async ({ page }) => {
    await mock(page, 'HOST', true, 'completed', status);
    await page.goto('/bookings');
    await expect(page.getByText(`Mã đặt chỗ · ${booking.bookingCode}`)).toBeVisible();
    await expect(page.getByLabel('Điểm đánh giá', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mở menu tài khoản' }).click();
    await expect(page.getByRole('menuitem', { name: 'Đặt phòng của tôi' })).toBeVisible();
    if (status === 'PENDING') await expect(page.getByRole('menuitem', { name: 'Quản lý chỗ nghỉ' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Xem hóa đơn' }).click();
    await expect(page.getByRole('button', { name: 'In / Xuất PDF' })).toBeVisible();
    await expect(page.getByText(booking.bookingCode, { exact: true })).toBeVisible();
  });
}

for (const role of ['ANONYMOUS', 'GUEST', 'HOST', 'ADMIN'] as const) {
  test(`public lookup is visible and limited for ${role}`, async ({ page }) => {
    await mock(page, role === 'ANONYMOUS' ? 'GUEST' : role);
    if (role === 'ANONYMOUS') {
      await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { message: 'Vui lòng đăng nhập.' } }));
    }
    await page.route('**/api/booking-lookup', async (route) => {
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual(['bookingCode', 'email']);
      await route.fulfill(body.email === 'synthetic@example.test' ? {
        status: 201, json: { bookingCode: booking.bookingCode, status: 'CONFIRMED', propertyName: property.name,
          roomTypeName: 'Tiêu chuẩn', checkIn: booking.checkIn, checkOut: booking.checkOut,
          quantity: 2, guestCount: 4, paymentState: 'PAID' },
      } : { status: 404, json: { message: 'Không tìm thấy booking phù hợp với thông tin đã nhập.' } });
    });
    await page.goto('/booking-lookup');
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('header').getByRole('link', { name: 'Tra cứu booking', exact: true }).filter({ visible: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByLabel('Mã booking', { exact: true }).fill(booking.bookingCode.toLowerCase());
    await page.getByLabel('Email đặt phòng').fill('SYNTHETIC@example.test');
    await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
    await expect(page.getByRole('heading', { name: booking.bookingCode })).toBeVisible();
    await expect(page.getByText('Đã thanh toán cọc', { exact: true })).toBeVisible();
    await expect(page.getByText(booking.customerPhoneSnapshot, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Xem hóa đơn' })).toHaveCount(0);
    await page.getByLabel('Email đặt phòng').fill('wrong@example.test');
    await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('Không tìm thấy booking');
    await expect(page.getByRole('heading', { name: booking.bookingCode })).toHaveCount(0);
  });
}

test('property prices color only the price, include accessible labels, and quantity disables insufficient dates', async ({ page }) => {
  await mock(page);
  await page.goto('/properties/business-ui-demo');
  for (const [date, price, tone] of [
    ['09', '900k', 'yellow'], ['10', '600k', 'green'],
    ['11', '600k', 'yellow'], ['12', '600k', 'red'],
  ]) {
    const button = day(page, `2027-10-${date}`);
    await expect(button.locator('.calendar-price')).toContainText(price);
    await expect(button.locator('.calendar-price')).toHaveClass(new RegExp(`inventory-${tone}`));
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(button).toHaveAttribute('aria-label', /giá từ/);
    await expect(button).not.toHaveClass(/inventory-/);
  }
  await expect(day(page, '2027-10-13')).toBeDisabled();
  await expect(day(page, '2027-10-13').locator('.calendar-price')).toHaveText(/\s*/);
  await expect(day(page, '2027-10-13')).toHaveAttribute('aria-label', /Hết phòng/);
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(id);
  await page.getByLabel('Số phòng', { exact: true }).selectOption('3');
  await expect(day(page, '2027-10-11')).toBeDisabled();
  await page.getByLabel('Số phòng', { exact: true }).selectOption('2');
  await expect(day(page, '2027-10-11')).toBeDisabled();
  await page.getByLabel('Số phòng', { exact: true }).selectOption('1');
  await expect(day(page, '2027-10-11')).toBeEnabled();
  await day(page, '2027-10-09').click();
  await day(page, '2027-10-11').click();
  await expect(page.locator('aside').getByText('Còn 4 phòng trong toàn bộ kỳ lưu trú').first()).toBeVisible();
  await expect(day(page, '2027-10-10')).not.toHaveText(/\n4$/);
});

test('homestay occupied dates are disabled and free dates remain selectable', async ({
  page,
}) => {
  await mock(page, 'GUEST', true, 'homestay');
  await page.goto('/properties/business-ui-demo');
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(id);
  await expect(day(page, '2027-10-09')).toBeDisabled();
  await expect(day(page, '2027-10-10')).toBeEnabled();
  await expect(day(page, '2027-10-10')).toHaveAttribute(
    'data-availability',
    'red',
  );
});

test('completed stay accepts one feedback and replaces the form with its rating', async ({
  page,
}) => {
  await mock(page, 'GUEST', true, 'completed');
  await page.goto('/bookings');
  await page.getByLabel('Điểm đánh giá', { exact: true }).selectOption('4');
  await page
    .getByLabel('Nội dung', { exact: true })
    .fill('Phòng sạch và thời gian rõ ràng.');
  await page.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  await expect(
    page.getByText('Phòng sạch và thời gian rõ ràng.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Gửi đánh giá', exact: true }),
  ).toHaveCount(0);
});
test('calendar colors, labels, sold-out disabling and per-room-type switching', async ({
  page,
}) => {
  await mock(page);
  await page.goto('/properties/business-ui-demo');
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(id);
  await expect(day(page, '2027-10-09')).toHaveAttribute(
    'data-availability',
    'green',
  );
  await expect(day(page, '2027-10-10')).toHaveAttribute(
    'data-availability',
    'yellow',
  );
  await expect(day(page, '2027-10-11')).toHaveAttribute(
    'data-availability',
    'red',
  );
  await expect(day(page, '2027-10-12')).toBeDisabled();
  await expect(day(page, '2027-10-10')).toHaveAttribute(
    'aria-label',
    /Còn 3 đến 4 phòng/,
  );
  await expect(day(page, '2027-10-11')).toHaveAttribute(
    'aria-label',
    /Chỉ còn 1 đến 2 phòng/,
  );
  await expect(day(page, '2027-10-12')).toHaveAttribute(
    'aria-label',
    /Hết phòng/,
  );
  await day(page, '2027-10-09').click();
  await day(page, '2027-10-13').click();
  await expect(
    page.getByRole('button', { name: 'Đặt chỗ ngay' }),
  ).toBeDisabled();
  await page
    .getByLabel('Loại phòng / chỗ ở')
    .selectOption(property.roomTypes[1].id);
  await expect(day(page, '2027-10-09')).toBeDisabled();
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(id);
  await expect(day(page, '2027-10-09')).toBeEnabled();
});
test('incomplete guest browses, is prompted only when booking and completes profile', async ({
  page,
}) => {
  await mock(page, 'GUEST', false);
  await page.goto('/properties/business-ui-demo');
  await page.getByLabel('Loại phòng / chỗ ở').selectOption(id);
  await expect(
    page.getByRole('heading', { name: property.name }),
  ).toBeVisible();
  await day(page, '2027-10-09').click();
  await day(page, '2027-10-11').click();
  await page.getByRole('button', { name: 'Đặt chỗ ngay' }).click();
  await expect(page).toHaveURL(/\/account\?next=/);
  await page
    .getByLabel('Họ và tên *', { exact: true })
    .fill('Khách hoàn thiện');
  await page.getByLabel('Số điện thoại *', { exact: true }).fill('0901234567');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  await expect(
    page.getByRole('link', { name: 'Tiếp tục đặt phòng' }),
  ).toBeVisible();
});
test('QR payment, confirmation, invoice snapshots and print layout work at mobile size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await mock(page);
  await page.goto(`/bookings/${booking.id}/payment`);
  await expect(
    page.getByRole('img', { name: /QR demo STB-BROWSERDEMO/ }),
  ).toBeVisible();
  await expect(
    page.getByText('STAYHUB STB-BROWSERDEMO', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '../.local/business-payment-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Tôi đã thanh toán' }).click();
  await expect(page.getByRole('link', { name: 'Xem hóa đơn' })).toBeVisible();
  await page.getByRole('link', { name: 'Xem hóa đơn' }).click();
  await expect(page.getByText('0901234567', { exact: true })).toBeVisible();
  await expect(
    page.getByText('STB-BROWSERDEMO', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'In / Xuất PDF' }),
  ).toBeVisible();
  await page.screenshot({
    path: '../.local/business-invoice-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.invoice-content')).toBeVisible();
  await expect(page.locator('.invoice-actions')).toBeHidden();
});
test('booking lookup and public feedback render', async ({ page }) => {
  await mock(page);
  await page.goto('/bookings');
  await page.getByLabel('Tra cứu mã đặt chỗ').fill(booking.bookingCode);
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Xem đơn đặt phòng' }),
  ).toBeVisible();
  await page.goto('/properties/business-ui-demo');
  await expect(page.getByText('Đánh giá tổng hợp rất rõ ràng.')).toBeVisible();
});
test('admin statistics, users, customer history, search and amenities remain responsive', async ({
  page,
}) => {
  await mock(page, 'ADMIN');
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      '/admin',
      '/admin/users',
      '/admin/customers/guest',
      '/admin/bookings',
      '/admin/amenities',
      '/admin/feedback',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
