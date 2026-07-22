import { expect, test } from '@playwright/test';

test('renders the development health page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'A L T E R . — LR-001 development environment',
    }),
  ).toBeVisible();
});
