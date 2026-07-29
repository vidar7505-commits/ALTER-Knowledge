import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const productId = 'c0800000-0000-4000-8000-000000000001';
const viewports = [
  { name: 'M320', width: 320, height: 700 },
  { name: 'M390', width: 390, height: 844 },
  { name: 'T768', width: 768, height: 1024 },
  { name: 'D1200', width: 1200, height: 900 },
  { name: 'D1440', width: 1440, height: 1024 },
] as const;

test('certifies canonical Product Detail layouts and core states', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockAnonymousIdentity(page, { multipleProductImages: true });
  await page.goto(`/product/${productId}?from=discover&position=1`);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Canonical Product 1',
    }),
  ).toBeVisible();

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
      path: testInfo.outputPath(`${viewport.name}-product-detail-loaded.png`),
      fullPage: true,
    });
  }

  await page
    .getByRole('button', {
      name: 'Save Canonical Product 1 to Wardrobe',
    })
    .click();
  await page.screenshot({
    path: testInfo.outputPath('M390-product-detail-saved.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    })
    .click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('M390-product-detail-undo.png'),
    fullPage: true,
  });
});

test('captures Product Detail recovery, source, partial, and image states', async ({
  context,
}, testInfo) => {
  test.setTimeout(120_000);

  async function captureState(
    name: string,
    options: Parameters<typeof mockAnonymousIdentity>[1],
    route: string,
    ready: (page: import('@playwright/test').Page) => Promise<void>,
  ) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAnonymousIdentity(page, options);
    await page.goto(route);
    await ready(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
    await page.close();
  }

  await captureState(
    'M390-product-detail-direct',
    {},
    `/product/${productId}`,
    async (page) => {
      await expect(
        page.getByRole('heading', {
          name: 'Canonical Product 1',
        }),
      ).toBeVisible();
    },
  );
  await captureState(
    'M390-product-detail-saved-initial',
    { initialSavedProduct: true },
    `/product/${productId}?from=wardrobe`,
    async (page) => {
      await expect(
        page.getByRole('button', {
          name: 'Remove Canonical Product 1 from Wardrobe',
        }),
      ).toBeVisible();
    },
  );
  await captureState(
    'M390-product-detail-partial',
    { partialProductMetadata: true },
    `/product/${productId}?from=challenge`,
    async (page) => {
      await expect(
        page.getByRole('heading', {
          name: 'Canonical Product 1',
        }),
      ).toBeVisible();
    },
  );
  await captureState(
    'M390-product-detail-image-error',
    { productImageFailure: true },
    `/product/${productId}?from=discover&position=1`,
    async (page) => {
      await expect(
        page.getByRole('img', {
          name: 'Fixture Studio Canonical Product 1',
        }),
      ).toBeVisible();
    },
  );
  await captureState(
    'M390-product-detail-load-error',
    { productDetailErrorOnce: true },
    `/product/${productId}`,
    async (page) => {
      await expect(
        page.getByRole('heading', {
          name: "We couldn't load this product.",
        }),
      ).toBeVisible();
    },
  );
  await captureState(
    'M390-product-detail-not-found',
    {},
    '/product/c0800000-0000-4000-8000-999999999999',
    async (page) => {
      await expect(
        page.getByRole('heading', {
          name: 'Product not found',
        }),
      ).toBeVisible();
    },
  );
  await captureState(
    'M390-product-detail-mutation-error',
    { mutationErrorOnce: true },
    `/product/${productId}`,
    async (page) => {
      await page
        .getByRole('button', {
          name: 'Save Canonical Product 1 to Wardrobe',
        })
        .click();
      await expect(page.getByText('Save failed. Try again.')).toBeVisible();
    },
  );
});
