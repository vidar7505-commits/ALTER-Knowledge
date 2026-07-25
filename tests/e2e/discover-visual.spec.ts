import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close({ runBeforeUnload: false });
});

const viewports = [
  { name: 'M320', width: 320, height: 700 },
  { name: 'M390', width: 390, height: 844 },
  { name: 'T768', width: 768, height: 1024 },
  { name: 'D1200', width: 1200, height: 900 },
  { name: 'D1440', width: 1440, height: 1024 },
] as const;

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test('certifies the loaded Discover grid at required viewports', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockAnonymousIdentity(page);
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Discover' }),
    ).toBeVisible();
    await capture(page, testInfo, `${viewport.name}-discover-loaded`);
  }
});

test('certifies initial, empty, and image-failure states', async ({
  context,
}, testInfo) => {
  test.setTimeout(120_000);

  const skeletonPage = await context.newPage();
  await skeletonPage.setViewportSize({ width: 390, height: 844 });
  await mockAnonymousIdentity(skeletonPage, { initialBatchDelayMs: 1500 });
  await skeletonPage.goto('/discover');
  await expect(
    skeletonPage.getByRole('status', { name: 'Loading products' }),
  ).toBeVisible();
  await capture(skeletonPage, testInfo, 'M390-discover-initial-skeleton');
  await skeletonPage.close();

  const errorPage = await context.newPage();
  await errorPage.setViewportSize({ width: 390, height: 844 });
  await mockAnonymousIdentity(errorPage, { initialFeedErrorOnce: true });
  await errorPage.goto('/discover');
  await expect(
    errorPage.getByRole('heading', {
      name: 'We couldn’t load your feed.',
    }),
  ).toBeVisible();
  await capture(errorPage, testInfo, 'M390-discover-initial-error');
  await errorPage.close();

  const emptyPage = await context.newPage();
  await emptyPage.setViewportSize({ width: 390, height: 844 });
  await mockAnonymousIdentity(emptyPage, { productCount: 0 });
  await emptyPage.goto('/discover');
  await expect(
    emptyPage.getByRole('heading', { name: 'Nothing to show yet.' }),
  ).toBeVisible();
  await capture(emptyPage, testInfo, 'M390-discover-empty');
  await emptyPage.close();

  const failedImagePage = await context.newPage();
  await failedImagePage.setViewportSize({ width: 390, height: 844 });
  await mockAnonymousIdentity(failedImagePage, {
    productCount: 24,
    productImageFailure: true,
  });
  await failedImagePage.goto('/discover');
  await expect(failedImagePage.locator('[data-product-id]')).toHaveCount(24);
  await expect(
    failedImagePage.getByRole('img', {
      name: 'Fixture Studio Canonical Product 1, top.',
      exact: true,
    }),
  ).toBeVisible();
  await capture(failedImagePage, testInfo, 'M390-discover-image-failure');
  await failedImagePage.close();
});

test('certifies pagination, save, Undo, restoration, and detail states', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAnonymousIdentity(page, {
    paginationDelayMs: 1000,
    paginationErrorOnce: true,
  });
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);

  const save = page.getByRole('button', {
    name: 'Save Canonical Product 1 to Wardrobe',
  });
  await save.click();
  await expect(
    page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    }),
  ).toBeVisible();
  await capture(page, testInfo, 'M390-discover-saved');

  await page
    .getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    })
    .click();
  const undo = page.getByRole('button', { name: 'Undo' });
  await undo.focus();
  await page.waitForTimeout(5100);
  await expect(undo).toBeVisible();
  await capture(page, testInfo, 'M390-discover-remove-undo-focused');
  await undo.click();

  await page
    .getByRole('button', { name: 'Load more products' })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(
    page.getByRole('status', { name: 'Loading products' }),
  ).toBeVisible();
  await capture(page, testInfo, 'M390-discover-loading-more');
  await expect(
    page.getByRole('heading', { name: 'More pieces didn’t load.' }),
  ).toBeVisible();
  await capture(page, testInfo, 'M390-discover-pagination-error');

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('[data-product-id]')).toHaveCount(30);
  await expect(
    page.getByRole('heading', {
      name: 'You’ve reached the end for now.',
    }),
  ).toBeVisible();
  await capture(page, testInfo, 'M390-discover-exhausted');

  const detailLink = page.locator('[data-position="13"] a[href^="/product/"]');
  await detailLink.scrollIntoViewIfNeeded();
  await detailLink.click();
  await expect(
    page.getByRole('heading', { name: 'Product preview' }),
  ).toBeVisible();
  await capture(page, testInfo, 'M390-product-detail-boundary');
  await page.goBack();
  await expect(page.locator('[data-product-id]')).toHaveCount(30);
  await capture(page, testInfo, 'M390-discover-restored');
});
