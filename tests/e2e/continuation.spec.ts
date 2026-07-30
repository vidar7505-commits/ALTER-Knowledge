import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.close({ runBeforeUnload: false });
});

for (const sessionMode of ['first', 'same', 'exact'] as const) {
  test(`${sessionMode} session does not show a continuation card`, async ({
    page,
  }) => {
    await mockAnonymousIdentity(page, {
      sessionMode,
      initialChallengeStatus: 'active',
      initialChallengeSelectionCount: 1,
      initialSavedProductCount: 1,
    });
    await page.goto('/discover');
    await expect(page.locator('[data-product-id]')).toHaveCount(24);
    await expect(page.getByTestId('continuation-card')).toHaveCount(0);
  });
}

test('a strict return selects active Challenge, consumes activation, and keeps a new feed', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page, {
    sessionMode: 'return',
    initialChallengeStatus: 'active',
    initialChallengeSelectionCount: 1,
    initialSavedProductCount: 2,
    lastMeaningfulDestination: 'wardrobe',
  });
  await page.goto('/discover');
  const card = page.getByTestId('continuation-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { name: 'After Dark' })).toBeVisible();
  await expect(card.getByText('1 of 4 pieces selected')).toBeVisible();
  await card
    .getByRole('button', { name: 'Continue' })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(page).toHaveURL(/\/challenge$/);
  await expect(page.getByText('1 of 4 pieces')).toBeVisible();
  await page.goto('/discover');
  await expect(page.getByTestId('continuation-card')).toHaveCount(0);
  expect(mock.getActiveSessionId()).toBe(
    '30000000-0000-4000-8000-000000000092',
  );
  expect(mock.getEnsureFeedCalls()).toBeGreaterThanOrEqual(1);
});

test('dismissal is keyboard accessible and remains consumed after reload', async ({
  page,
}) => {
  await mockAnonymousIdentity(page, {
    sessionMode: 'return',
    initialSavedProductCount: 1,
    lastMeaningfulDestination: 'wardrobe',
  });
  await page.goto('/discover');
  const dismiss = page.getByRole('button', {
    name: 'Dismiss Your Wardrobe continuation',
  });
  await dismiss.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('continuation-card')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Discover' }),
  ).toBeVisible();
  await expect(page.getByTestId('continuation-card')).toHaveCount(0);
});

test('latest completion is offered on its first later return session', async ({
  page,
}) => {
  await mockAnonymousIdentity(page, {
    sessionMode: 'return',
    initialChallengeStatus: 'completed',
    initialSavedProductCount: 4,
  });
  await page.goto('/discover');
  const card = page.getByTestId('continuation-card');
  await expect(card.getByText('Your latest look')).toBeVisible();
  await expect(card.getByRole('button', { name: 'View look' })).toBeVisible();
});

test('a higher-priority resolver failure shows retry and never silently falls through', async ({
  page,
}) => {
  const mock = await mockAnonymousIdentity(page, {
    sessionMode: 'return',
    continuationQueryErrorOnce: true,
    initialSavedProductCount: 1,
    lastMeaningfulDestination: 'wardrobe',
  });
  await page.goto('/discover');
  await expect.poll(() => mock.getContinuationRequests()).toBeGreaterThan(0);
  await expect(
    page.getByRole('heading', {
      name: 'We couldn’t restore your continuation.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your Wardrobe' }),
  ).toHaveCount(0);
  mock.resolveContinuationQueryError();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your Wardrobe' }),
  ).toBeVisible();
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
});

test('meaningful destinations record only qualified primary surfaces', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const mock = await mockAnonymousIdentity(page, {
    sessionMode: 'same',
    initialSavedProductCount: 1,
    initialChallengeStatus: 'active',
    initialChallengeSelectionCount: 1,
  });
  await page.goto('/discover');
  await expect
    .poll(() => mock.getDestinationWrites().map((item) => item.p_destination))
    .toContain('discover');
  await page.goto('/wardrobe');
  await expect
    .poll(() => mock.getDestinationWrites().map((item) => item.p_destination))
    .toContain('wardrobe');
  await page.goto('/challenge');
  await expect
    .poll(() => mock.getDestinationWrites().map((item) => item.p_destination))
    .toContain('challenge');
  await page.goto(
    '/product/c0800000-0000-4000-8000-000000000001?from=challenge',
  );
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(
    mock
      .getDestinationWrites()
      .map((item) => item.p_destination)
      .filter((destination) => destination === 'challenge'),
  ).toHaveLength(1);
});
