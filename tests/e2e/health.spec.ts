import { expect, test } from '@playwright/test';

test('renders the development token verification page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'A L T E R . visual foundation',
    }),
  ).toBeVisible();
  await expect(page.getByText(/token verification/i)).toBeVisible();
});
