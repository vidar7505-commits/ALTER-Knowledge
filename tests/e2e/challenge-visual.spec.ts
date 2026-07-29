import { expect, test } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const viewports = [
  { name: 'M320', width: 320, height: 700 },
  { name: 'M390', width: 390, height: 844 },
  { name: 'T768', width: 768, height: 1024 },
  { name: 'D1200', width: 1200, height: 900 },
  { name: 'D1440', width: 1440, height: 1024 },
] as const;

test('certifies active Challenge and picker layouts', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockAnonymousIdentity(page, {
    initialSavedProductCount: 4,
    initialChallengeStatus: 'active',
  });
  await page.goto('/challenge');
  await expect(page.getByText('0 of 4 pieces')).toBeVisible();

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
      path: testInfo.outputPath(`${viewport.name}-challenge-active.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add Top, required' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Choose a Top' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('M390-challenge-picker.png'),
    fullPage: false,
  });
});

test('certifies immutable completed Challenge layouts', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockAnonymousIdentity(page, {
    initialSavedProductCount: 4,
    initialChallengeStatus: 'completed',
  });
  await page.goto('/challenge');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Look complete.' }),
  ).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-challenge-completed.png`),
      fullPage: true,
    });
  }
});
