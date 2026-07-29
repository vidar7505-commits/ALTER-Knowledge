import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const viewports = [
  { name: 'M320', width: 320, height: 700 },
  { name: 'M390', width: 390, height: 844 },
  { name: 'T768', width: 768, height: 1024 },
  { name: 'D1200', width: 1200, height: 900 },
  { name: 'D1440', width: 1440, height: 1024 },
] as const;

test('certifies populated Wardrobe layouts and remove states', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockAnonymousIdentity(page, { initialSavedProductCount: 2 });
  await page.goto('/wardrobe');
  await expect(page.getByText('2 saved')).toBeVisible();

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
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-wardrobe-populated.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', {
      name: /Remove Canonical Product With A Deliberately Long/,
    })
    .click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('M390-wardrobe-undo.png'),
    fullPage: true,
  });
});

test('captures loading, empty, error, image, unavailable, and remove failure', async ({
  context,
}, testInfo) => {
  test.setTimeout(120_000);

  async function capture(
    name: string,
    options: Parameters<typeof mockAnonymousIdentity>[1],
    ready: (page: import('@playwright/test').Page) => Promise<void>,
  ) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAnonymousIdentity(page, options);
    await page.goto('/wardrobe');
    await ready(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: false,
    });
    await page.close();
  }

  await capture(
    'M390-wardrobe-loading',
    { initialSavedProduct: true, wardrobeQueryDelayMs: 10_000 },
    async (page) => {
      await expect(
        page.getByRole('status', { name: 'Loading your Wardrobe' }),
      ).toBeVisible();
    },
  );
  await capture('M390-wardrobe-empty', {}, async (page) => {
    await expect(page.getByText('Your Wardrobe starts here.')).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('img[src*="welcome.png"]')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
  });
  await capture(
    'M390-wardrobe-query-error',
    { initialSavedProduct: true, wardrobeProductQueryError: true },
    async (page) => {
      await expect(
        page.getByText('We couldn’t load your Wardrobe.'),
      ).toBeVisible();
    },
  );
  await capture(
    'M390-wardrobe-image-error',
    { initialSavedProduct: true, productImageFailure: true },
    async (page) => {
      await expect(
        page.getByRole('img', {
          name: 'Fixture Studio Canonical Product 1, top.',
        }),
      ).toBeVisible();
    },
  );
  await capture(
    'M390-wardrobe-unavailable',
    { initialSavedProduct: true, unavailableSavedProduct: true },
    async (page) => {
      await expect(
        page.getByText('Unavailable', { exact: true }),
      ).toBeVisible();
    },
  );
  await capture(
    'M390-wardrobe-remove-error',
    { initialSavedProduct: true, mutationErrorOnce: true },
    async (page) => {
      await page
        .getByRole('button', {
          name: 'Remove Canonical Product 1 from Wardrobe',
        })
        .click();
      await expect(
        page.getByText("We couldn't remove that piece."),
      ).toBeVisible();
    },
  );
});
