import { expect, type Page } from '@playwright/test';
import type { Booking, Session } from '../src/lib/types';

// Synthetic receiving account and isolated database only; never used by app code.
export async function submitAndVerifyTransfer(page: Page) {
  const api = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
  const reference = `BROWSER-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page
    .getByRole('button', { name: 'Thanh toán cọc', exact: true })
    .click();
  await page.getByLabel('Mã giao dịch MoMo *').fill(reference);
  await page
    .getByRole('button', { name: 'Tôi đã thanh toán', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Đang chờ đối chiếu thanh toán' }),
  ).toBeVisible();
  const token = await page.evaluate(() =>
    localStorage.getItem('stayhub.accessToken'),
  );
  const bookingId = new URL(page.url()).pathname.split('/')[2];
  const response = await page.request.get(`${api}/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const booking = (await response.json()) as Booking;
  expect(booking.status).toBe('PENDING_PAYMENT');
  expect(booking.payment).toBeNull();
  const adminResponse = await page.request.post(`${api}/auth/login`, {
    data: { email: 'admin01', password: process.env.DEMO_PASSWORD },
  });
  expect(adminResponse.status()).toBe(200);
  const admin = (await adminResponse.json()) as Session;
  const claim = booking.paymentAttempts!.find(
    (p) => p.transactionRef === reference.toUpperCase(),
  )!;
  const verified = await page.request.post(
    `${api}/admin/bookings/${booking.id}/payment-claims/${claim.id}/reconcile`,
    {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: {
        decision: 'VERIFY',
        receivedAmount: booking.depositAmount,
        verifiedTransactionRef: reference,
      },
    },
  );
  expect(verified.status()).toBe(201);
  await expect(
    page.getByRole('heading', {
      name: 'Thanh toán đã được xác nhận',
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
}
