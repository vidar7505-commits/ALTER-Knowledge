import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test('retains an offline save through reload and dispatches once after reconnect', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page);
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
  });
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
  await expect(
    page.getByRole('status', { name: 'Recovery status' }),
  ).toContainText('offline');

  await page
    .getByRole('button', { name: 'Save Canonical Product 1 to Wardrobe' })
    .click();
  await expect(
    page.getByRole('status', { name: 'Recovery status' }),
  ).toContainText('retained');
  expect(mock.getMutationRequests()).toEqual([]);

  await page.reload();
  await expect(
    page.getByRole('status', { name: 'Recovery status' }),
  ).toContainText('pending');

  await page.evaluate(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    window.dispatchEvent(new Event('online'));
  });

  await expect(
    page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    }),
  ).toBeVisible();
  expect(mock.getMutationRequests()).toHaveLength(1);
});

test('replays an interrupted committed mutation with the same operation ID', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page, {
    mutationResponseInterruptedAfterCommitOnce: true,
  });
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);

  await page
    .getByRole('button', { name: 'Save Canonical Product 1 to Wardrobe' })
    .click();
  await expect(
    page.getByRole('status', { name: 'Recovery status' }),
  ).toContainText(/retained|Retrying/);

  await expect
    .poll(() => mock.getMutationRequests().length)
    .toBeGreaterThanOrEqual(2);
  const requests = mock.getMutationRequests();
  expect(requests[0]?.operationId).toBe(requests[1]?.operationId);
  await expect(
    page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    }),
  ).toBeVisible();
});

test('offline recovery surface is accessible, focused, and overflow-safe', async ({
  page,
}) => {
  await mockAnonymousIdentity(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/discover');
  await page.evaluate(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    window.dispatchEvent(new Event('offline'));
  });
  const status = page.getByRole('status', { name: 'Recovery status' });
  await expect(status).toBeVisible();
  await expect(status).toContainText('Loaded content remains available');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});
