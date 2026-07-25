import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close({ runBeforeUnload: false });
});

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

test('loads the deterministic feed and saves from the canonical card boundary', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Discover' }),
  ).toBeVisible();
  const cards = page.locator('[data-product-id]');
  await expect(cards).toHaveCount(24);
  await expect(cards.first()).toHaveAttribute('data-position', '1');
  await expect(cards.nth(23)).toHaveAttribute('data-position', '24');
  await expect(
    page.getByRole('link', {
      name: 'Open Fixture Studio Canonical Product 1',
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const save = page.getByRole('button', {
    name: 'Save Canonical Product 1 to Wardrobe',
  });
  await save.click();
  await expect(
    page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page
    .getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    })
    .click();
  await expect(page.getByText('Removed from Wardrobe.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(
    page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(mock.getEnsureFeedCalls()).toBeGreaterThanOrEqual(1);
});

test('paginates with the same opaque cursor, preserves cards, and exhausts', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page, {
    paginationErrorOnce: true,
  });
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);

  await page
    .getByRole('button', { name: 'Load more products' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(
    page.getByRole('heading', { name: 'More pieces didn’t load.' }),
  ).toBeVisible();
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('[data-product-id]')).toHaveCount(30);
  await expect(
    page.getByRole('heading', {
      name: 'You’ve reached the end for now.',
    }),
  ).toBeVisible();
  expect(mock.getAppendCursors().slice(-2)).toEqual([
    mock.nextCursor,
    mock.nextCursor,
  ]);
});

test('restores the same feed and scroll context after Product Detail back', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page);
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
  await page.locator('[data-product-id]').nth(12).scrollIntoViewIfNeeded();
  await expect(page.locator('[data-product-id]')).toHaveCount(30);
  const before = await page
    .locator('[data-product-id]')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-product-id')),
    );
  const priorScroll = await page.evaluate(() => window.scrollY);
  const detailLink = page.locator('[data-position="13"] a[href^="/product/"]');
  await expect(detailLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/product\//),
    detailLink.click({ noWaitAfter: true }),
  ]);
  await expect(page).toHaveURL(/\/product\//);
  await expect(
    page.getByRole('heading', { name: 'Product preview' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-product-id]')).toHaveCount(before.length);
  const after = await page
    .locator('[data-product-id]')
    .evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-product-id')),
    );
  expect(after).toEqual(before);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThanOrEqual(Math.max(0, priorScroll - 2));
  expect(mock.getEnsureFeedCalls()).toBeGreaterThanOrEqual(2);
});

test('qualifies an impression once after canonical visibility duration', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);

  await expect
    .poll(
      () =>
        mock
          .getTelemetryEvents()
          .filter((event) => event.event_name === 'product_impression').length,
      { timeout: 5000 },
    )
    .toBeGreaterThan(0);
  const impressions = mock
    .getTelemetryEvents()
    .filter((event) => event.event_name === 'product_impression');
  const firstId = impressions[0]?.event_id;
  await page.waitForTimeout(1200);
  expect(
    mock.getTelemetryEvents().filter((event) => event.event_id === firstId),
  ).toHaveLength(1);
  expect(mock.getQualifiedDepth()).toBeGreaterThan(0);
});

test('recovers the same logical feed after an initial failure', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page, {
    initialFeedErrorOnce: true,
  });
  await page.goto('/discover');
  await expect(
    page.getByRole('heading', { name: 'We couldn’t load your feed.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
  expect(mock.getAppendCursors().slice(0, 2)).toEqual([null, null]);
  expect(mock.getEnsureFeedCalls()).toBeGreaterThanOrEqual(2);
});
