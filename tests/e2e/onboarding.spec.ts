import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test('new identity completes the three-step onboarding flow with keyboard selection', async ({
  page,
}) => {
  await mockAnonymousIdentity(page, { onboardingStatus: 'not_started' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Find the pieces that feel like you.',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'What pulls you in?' }),
  ).toBeVisible();
  const firstChoice = page.getByRole('checkbox', { name: /Minimal/ });
  await firstChoice.focus();
  await page.keyboard.press('Space');
  await expect(firstChoice).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1 of 2')).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'What are you dressing for lately?',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('checkbox', { name: /Minimal/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Show my feed' }).click();

  await expect(page).toHaveURL(/\/discover$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Discover' }),
  ).toBeVisible();
  await expect(
    page.locator('nav[aria-label="Primary mobile navigation"]'),
  ).toBeVisible();
});

test('skip persists as a terminal path and bypasses onboarding on reload', async ({
  page,
}) => {
  await mockAnonymousIdentity(page, { onboardingStatus: 'not_started' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip for now' }).click();

  await expect(page).toHaveURL(/\/discover$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Discover' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Find the pieces that feel like you.',
    }),
  ).toHaveCount(0);
});
