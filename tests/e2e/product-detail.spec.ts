import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const productId = 'c0800000-0000-4000-8000-000000000001';
const missingId = 'c0800000-0000-4000-8000-999999999999';

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close({ runBeforeUnload: false });
});

test('opens from Discover, renders canonical data, and restores context', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
  const priorIds = await page
    .locator('[data-product-id]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-product-id')),
    );
  await page
    .getByRole('link', {
      name: 'Open Fixture Studio Canonical Product 1',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Canonical Product 1',
    }),
  ).toBeVisible();
  await expect(page.getByText('Curated catalog fixture 1.')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-product-id]')).toHaveCount(priorIds.length);
  expect(
    await page
      .locator('[data-product-id]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-product-id')),
      ),
  ).toEqual(priorIds);
  expect(
    mock
      .getTelemetryEvents()
      .filter((event) => event.event_name === 'product_detail_opened'),
  ).toHaveLength(1);
  await expect
    .poll(
      () =>
        mock
          .getTelemetryEvents()
          .filter((event) => event.event_name === 'product_detail_closed')
          .length,
    )
    .toBe(1);
});

test('supports direct entry without creating a feed instance', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page);
  await page.goto(`/product/${productId}`);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Canonical Product 1',
    }),
  ).toBeVisible();
  expect(mock.getEnsureFeedCalls()).toBe(0);
  await expect
    .poll(() => {
      const opened = mock
        .getTelemetryEvents()
        .find((event) => event.event_name === 'product_detail_opened');
      return opened?.source_surface;
    })
    .toBeNull();
  await page.getByRole('button', { name: 'Go back to Discover' }).click();
  await expect(page).toHaveURL(/\/discover$/);
});

test('renders missing product and recovers a transient load error', async ({
  page,
}) => {
  await mockAnonymousIdentity(page, { productDetailErrorOnce: true });
  await page.goto(`/product/${productId}`);
  await expect(
    page.getByRole('heading', {
      name: "We couldn't load this product.",
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Canonical Product 1',
    }),
  ).toBeVisible();
  await page.goto(`/product/${missingId}`);
  await expect(
    page.getByRole('heading', { name: 'Product not found' }),
  ).toBeVisible();
});

test('saves, removes, and restores with Undo using keyboard controls', async ({
  page,
}) => {
  await mockAnonymousIdentity(page);
  await page.goto(`/product/${productId}`);
  const save = page.getByRole('button', {
    name: 'Save Canonical Product 1 to Wardrobe',
  });
  await save.focus();
  await page.keyboard.press('Enter');
  const remove = page.getByRole('button', {
    name: 'Remove Canonical Product 1 from Wardrobe',
  });
  await expect(remove).toBeVisible();
  await remove.focus();
  await page.keyboard.press('Enter');
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeVisible();
  await undo.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    }),
  ).toBeVisible();
});

test('preserves canonical state after a mutation failure', async ({ page }) => {
  await mockAnonymousIdentity(page, { mutationErrorOnce: true });
  await page.goto(`/product/${productId}`);
  const save = page.getByRole('button', {
    name: 'Save Canonical Product 1 to Wardrobe',
  });
  await save.dblclick();
  await expect(page.getByText('Save failed. Try again.')).toBeVisible();
  await expect(save).toHaveAttribute('aria-pressed', 'false');
});

test('supports mobile swipe and desktop vertical thumbnail selection', async ({
  page,
}) => {
  await mockAnonymousIdentity(page, { multipleProductImages: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${productId}`);
  const gallery = page.getByLabel('Product image gallery');
  await expect(gallery).toBeVisible();
  await gallery.evaluate((element) => {
    element.scrollLeft = element.clientWidth;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('status')).toContainText('Image 2 of 2');
  await page.setViewportSize({ width: 1440, height: 1024 });
  const second = page.getByRole('tab', { name: 'Image 2 of 2' });
  await second.focus();
  await page.keyboard.press('Enter');
  await expect(second).toHaveAttribute('aria-selected', 'true');
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
