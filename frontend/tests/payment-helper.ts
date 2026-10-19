import { expect, type Page } from '@playwright/test';
// Completes the customer flow against the isolated API.
export async function completeSimulatedPayment(page: Page) {
  await page
    .getByRole('button', { name: 'Tôi đã thanh toán', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Thanh toán thành công!', exact: true }),
  ).toBeVisible();
}
