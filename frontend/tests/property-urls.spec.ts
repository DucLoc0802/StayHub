import { test, expect } from '@playwright/test';
import type { Property } from '../src/lib/types';
import { propertyPath } from '../src/lib/property-url';

const apiUrl = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
const id = '10000000-0000-4000-8000-000000000038';
test('listing cards and direct links use the short property URL', async ({
  page,
  request,
}) => {
  const response = await request.get(`${apiUrl}/properties/${id}`);
  expect(response.ok()).toBe(true);
  const property = (await response.json()) as Property;
  expect(property.slug).toBe('loi-hoa-family-home');
  const path = propertyPath(property);
  await page.goto(`/properties?q=${encodeURIComponent(property.name)}`);
  const card = page
    .locator(`a[href="${path}"]`)
    .filter({ hasText: property.name });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(path);
  await expect(
    page.getByRole('heading', { name: property.name, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(path);
  await expect(
    page.getByRole('heading', { name: property.name, exact: true }),
  ).toBeVisible();
});

test('legacy long URLs and IDs open the correct listing and become short URLs', async ({
  page,
  request,
}) => {
  const response = await request.get(`${apiUrl}/properties/${id}`);
  const property = (await response.json()) as Property;
  for (const old of [`loi-hoa-family-home--${id}`, id]) {
    await page.goto(`/properties/${old}?ref=shared#main`);
    await expect(page).toHaveURL(`${propertyPath(property)}?ref=shared#main`);
    await expect(
      page.getByRole('heading', { name: property.name, exact: true }),
    ).toBeVisible();
  }
});
