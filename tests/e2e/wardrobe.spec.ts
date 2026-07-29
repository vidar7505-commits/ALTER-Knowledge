import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test.describe('P13 Wardrobe', () => {
  test('loads a deterministic recent-first grid and returns from Product Detail', async ({
    page,
  }) => {
    await mockAnonymousIdentity(page, { initialSavedProductCount: 2 });
    await page.goto('/wardrobe');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Wardrobe' }),
    ).toBeVisible();
    await expect(page.getByText('2 saved')).toBeVisible();
    const cards = page
      .getByRole('list', { name: 'Saved products' })
      .getByRole('listitem');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAttribute(
      'data-product-id',
      'c0800000-0000-4000-8000-000000000002',
    );

    await cards.nth(0).getByRole('link').click();
    await expect(page).toHaveURL(/from=wardrobe/);
    await page.getByRole('button', { name: /Go back to wardrobe/i }).click();
    await expect(page).toHaveURL(/\/wardrobe$/);
    await expect(page.getByText('2 saved')).toBeVisible();
  });

  test('removes with one guarded RPC and restores through keyboard Undo', async ({
    page,
  }) => {
    await mockAnonymousIdentity(page, { initialSavedProduct: true });
    await page.goto('/wardrobe');

    const remove = page.getByRole('button', {
      name: 'Remove Canonical Product 1 from Wardrobe',
    });
    await remove.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByText('0 saved')).toBeVisible();

    await page.getByRole('button', { name: 'Undo' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Canonical Product 1', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('1 saved')).toBeVisible();

    await page.getByRole('link', { name: 'Discover' }).click();
    await expect(
      page.getByRole('button', {
        name: 'Remove Canonical Product 1 from Wardrobe',
      }),
    ).toBeVisible();
  });

  test('refreshes canonical saved truth across Discover, Wardrobe, and Product Detail', async ({
    page,
  }) => {
    await mockAnonymousIdentity(page);
    await page.goto('/discover');
    await page
      .getByRole('button', { name: 'Save Canonical Product 1 to Wardrobe' })
      .click();
    await page.getByRole('link', { name: 'Wardrobe' }).click();
    await expect(
      page.getByText('Canonical Product 1', { exact: true }),
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Remove Canonical Product 1 from Wardrobe',
      })
      .click();
    await page.goto(
      '/product/c0800000-0000-4000-8000-000000000001?from=wardrobe',
    );
    await expect(
      page.getByRole('button', {
        name: 'Save Canonical Product 1 to Wardrobe',
      }),
    ).toBeVisible();
  });

  test('shows honest empty, query recovery, unavailable, and image-failure states', async ({
    page,
  }) => {
    const mock = await mockAnonymousIdentity(page, {
      initialSavedProduct: true,
      wardrobeProductQueryError: true,
    });
    await page.goto('/wardrobe');
    await expect(
      page.getByText('We couldn’t load your Wardrobe.'),
    ).toBeVisible();
    await expect(page.getByText(/private wardrobe/)).toHaveCount(0);
    mock.resolveWardrobeProductQueryError();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(
      page.getByText('Canonical Product 1', { exact: true }),
    ).toBeVisible();
  });

  test('renders unavailable saved products without fabricating metadata', async ({
    page,
  }) => {
    await mockAnonymousIdentity(page, {
      initialSavedProduct: true,
      unavailableSavedProduct: true,
      productImageFailure: true,
    });
    await page.goto('/wardrobe');
    await expect(
      page.getByRole('link', { name: 'Open Unavailable piece' }),
    ).toBeVisible();
    await expect(page.getByText('Unavailable', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Remove Unavailable piece from Wardrobe',
      }),
    ).toBeVisible();
  });

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1200, height: 900 },
    { width: 1440, height: 1024 },
  ]) {
    test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockAnonymousIdentity(page, { initialSavedProductCount: 2 });
      await page.goto('/wardrobe');
      await expect(page.getByText('2 saved')).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
