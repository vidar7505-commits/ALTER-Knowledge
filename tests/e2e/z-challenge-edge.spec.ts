import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test.describe('P14 Challenge edge contracts', () => {
  test('refreshes canonical truth after stale removal and completion', async ({
    context,
  }) => {
    const removalPage = await context.newPage();
    await mockAnonymousIdentity(removalPage, {
      initialSavedProductCount: 4,
      initialChallengeStatus: 'active',
      initialChallengeSelectionCount: 1,
      challengeRevisionMismatchOnce: true,
      challengeRevisionMismatchAction: 'remove',
    });
    await removalPage.goto('/challenge');
    await removalPage
      .getByRole('button', { name: 'Remove Canonical Product 1' })
      .click();
    await expect(
      removalPage.getByText(
        'The Challenge changed elsewhere, so we refreshed it.',
      ),
    ).toBeVisible();
    await expect(
      removalPage.getByText('Canonical Product 1', { exact: true }),
    ).toBeVisible();
    await removalPage.close();

    const completionPage = await context.newPage();
    await mockAnonymousIdentity(completionPage, {
      initialSavedProductCount: 4,
      initialChallengeStatus: 'active',
      initialChallengeSelectionCount: 4,
      challengeRevisionMismatchOnce: true,
      challengeRevisionMismatchAction: 'complete',
    });
    await completionPage.goto('/challenge');
    await completionPage.getByRole('button', { name: 'Complete look' }).click();
    await expect(
      completionPage.getByText(
        'The Challenge changed elsewhere, so we refreshed it.',
      ),
    ).toBeVisible();
    await expect(
      completionPage.getByRole('heading', { level: 1, name: 'After Dark' }),
    ).toBeVisible();
  });

  test('keeps operation conflict distinct and state unchanged', async ({
    page,
  }) => {
    await mockAnonymousIdentity(page, {
      initialSavedProductCount: 4,
      initialChallengeStatus: 'active',
      challengeOperationConflictOnce: true,
    });
    await page.goto('/challenge');
    await page.getByRole('button', { name: 'Add Top, required' }).click();
    await page
      .getByRole('button', { name: /Canonical Product 1.*Choose/ })
      .click();
    await expect(
      page.getByText('This action conflicts with an earlier request.'),
    ).toBeVisible();
    await expect(page.getByText('0 of 4 pieces')).toBeVisible();
  });

  test('separates no-valid-products and inactive-selection recovery', async ({
    context,
  }) => {
    const emptyPage = await context.newPage();
    await mockAnonymousIdentity(emptyPage, {
      initialChallengeStatus: 'active',
    });
    await emptyPage.goto('/challenge');
    await emptyPage.getByRole('button', { name: 'Add Top, required' }).click();
    await expect(
      emptyPage.getByText('No saved pieces match this slot yet.'),
    ).toBeVisible();
    await emptyPage.close();

    const inactivePage = await context.newPage();
    await mockAnonymousIdentity(inactivePage, {
      initialSavedProductCount: 1,
      initialChallengeStatus: 'active',
      initialChallengeSelectionCount: 1,
      unavailableSavedProduct: true,
    });
    await inactivePage.goto('/challenge');
    await expect(
      inactivePage.getByText(
        'A selected piece is no longer available. Your Challenge has not been changed.',
      ),
    ).toBeVisible();
  });
});
