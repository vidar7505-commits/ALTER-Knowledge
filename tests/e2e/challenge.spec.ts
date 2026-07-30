import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

test.describe('P14 Challenge', () => {
  test('starts, recovers, selects, replaces, removes, and completes immutably', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const mocks = await mockAnonymousIdentity(page, {
      initialSavedProductCount: 8,
      initialChallengeStatus: 'unstarted',
    });
    await page.goto('/challenge');

    await expect(
      page.getByRole('heading', { level: 1, name: 'After Dark' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Start challenge' })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
    await expect(page.getByText('0 of 4 pieces')).toBeVisible();
    await page.reload();
    await expect(page.getByText('0 of 4 pieces')).toBeVisible();

    const labels = await page
      .getByRole('button', { name: /required$/i })
      .allTextContents();
    expect(labels).toEqual([
      '+Add TopRequired',
      '+Add BottomRequired',
      '+Add ShoesRequired',
      '+Add Layer or AccessoryRequired',
    ]);
    await expect(
      page.getByRole('button', { name: 'Complete look' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Add Top, required' }).click();
    await page
      .getByRole('button', { name: /Canonical Product 1.*Choose/ })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('1 of 4 pieces')).toBeVisible();

    await page.getByRole('button', { name: 'Replace Top' }).click();
    await page
      .getByRole('button', { name: /Canonical Product 6.*Choose/ })
      .click();
    await expect(
      page.getByText('Canonical Product 6', { exact: true }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Remove Canonical Product 6' })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
    await expect(page.getByText('0 of 4 pieces')).toBeVisible();

    for (const slot of [
      'Top',
      'Bottom',
      'Shoes',
      'Layer or Accessory',
    ] as const) {
      await page.getByRole('button', { name: `Add ${slot}, required` }).click();
      await page
        .getByRole('list', { name: 'Eligible products' })
        .getByRole('button')
        .first()
        .click();
    }

    await expect(page.getByText('4 of 4 pieces')).toBeVisible();
    const detailLink = page
      .getByRole('link')
      .filter({ hasText: 'Canonical Product 1' });
    await expect(detailLink).toHaveAttribute(
      'href',
      /\/product\/c0800000-0000-4000-8000-000000000001\?from=challenge/,
    );
    await detailLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/from=challenge/, { timeout: 90_000 });
    await page.getByRole('button', { name: /Go back to challenge/i }).click();
    await expect(page).toHaveURL(/\/challenge$/);
    await expect(page.getByText('4 of 4 pieces')).toBeVisible();

    await page
      .getByRole('button', { name: 'Complete look' })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Look complete.' }),
    ).toBeVisible();
    await expect
      .poll(
        () =>
          mocks
            .getTelemetryEvents()
            .filter((event) => event.event_name === 'challenge_completed')
            .length,
      )
      .toBe(1);
    await expect(page.getByRole('button', { name: /remove/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /replace/i })).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Look complete.' }),
    ).toBeVisible();
  });

  test('refreshes instead of replaying a stale selection', async ({ page }) => {
    await mockAnonymousIdentity(page, {
      initialSavedProductCount: 4,
      initialChallengeStatus: 'active',
      challengeRevisionMismatchOnce: true,
    });
    await page.goto('/challenge');
    await page.getByRole('button', { name: 'Add Top, required' }).click();
    await page
      .getByRole('button', { name: /Canonical Product 1.*Choose/ })
      .click();
    await expect(
      page.getByText('The Challenge changed elsewhere, so we refreshed it.'),
    ).toBeVisible();
    await expect(
      page.getByText('Canonical Product 1', { exact: true }),
    ).toHaveCount(0);
  });

  test('recovers load and slot-list failures without leaking raw errors', async ({
    page,
  }) => {
    const mocks = await mockAnonymousIdentity(page, {
      initialSavedProductCount: 4,
      initialChallengeStatus: 'active',
      challengeLoadErrorOnce: true,
      challengeProductErrorOnce: true,
    });
    await page.goto('/challenge');
    await expect(page.getByText('We couldn’t open the Challenge.')).toBeVisible(
      { timeout: 15_000 },
    );
    mocks.resolveChallengeLoadError();
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('button', { name: 'Add Top, required' }).click();
    await expect(
      page.getByText('We couldn’t load pieces for this slot.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(
      page.getByRole('button', { name: /Canonical Product 1.*Choose/ }),
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
      await mockAnonymousIdentity(page, {
        initialSavedProductCount: 4,
        initialChallengeStatus: 'active',
      });
      await page.goto('/challenge');
      await expect(page.getByText('0 of 4 pieces')).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  }
});
