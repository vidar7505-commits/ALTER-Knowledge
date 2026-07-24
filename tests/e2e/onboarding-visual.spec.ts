import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const viewports = [
  { name: 'M320', width: 320, height: 700 },
  { name: 'M390', width: 390, height: 844 },
  { name: 'T768', width: 768, height: 1024 },
  { name: 'D1200', width: 1200, height: 900 },
  { name: 'D1440', width: 1440, height: 1024 },
] as const;

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectViewportGeometry(page: Page) {
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('nav')).toHaveCount(0);
}

async function expectProductGeometry(page: Page) {
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.locator('nav[aria-label="Primary mobile navigation"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('nav[aria-label="Primary desktop navigation"]'),
  ).toHaveCount(1);
}

async function expectOnboardingImagesLoaded(page: Page) {
  const images = page.locator('main img');
  await expect(images).not.toHaveCount(0);
  await images.evaluateAll((elements) => {
    for (const element of elements) {
      element.scrollIntoView({ block: 'center' });
    }
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.every(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
}

test.describe('P10 visual certification', () => {
  test('core onboarding states at every canonical viewport', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await mockAnonymousIdentity(page, { onboardingStatus: 'not_started' });
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Find the pieces that feel like you.',
      }),
    ).toBeVisible();
    await expectOnboardingImagesLoaded(page);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-welcome`);
    }

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'What pulls you in?' }),
    ).toBeVisible();
    await expectOnboardingImagesLoaded(page);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await expect(page.getByText('1 of 2')).toBeVisible();
      await capture(page, testInfo, `${viewport.name}-style-none`);
    }

    for (const label of ['Minimal', 'Relaxed', 'Tailored', 'Romantic']) {
      await page.getByRole('checkbox', { name: new RegExp(label) }).click();
    }
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-style-four`);
    }

    await page.getByRole('checkbox', { name: /Street/ }).click();
    await expect(
      page.getByText('Choose up to four. Remove one to add another.'),
    ).toBeVisible();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-style-limit`);
    }

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'What are you dressing for lately?',
      }),
    ).toBeVisible();
    await expectOnboardingImagesLoaded(page);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await expect(page.getByText('2 of 2')).toBeVisible();
      await capture(page, testInfo, `${viewport.name}-mood`);
    }

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(
      page.getByRole('checkbox', { name: /Minimal/ }),
    ).toHaveAttribute('aria-checked', 'true');
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-back-preserved`);
    }
  });

  test('loading and recoverable query states at every viewport', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await mockAnonymousIdentity(page, { onboardingStatus: 'not_started' });
    await page.route(
      'http://127.0.0.1:54321/auth/v1/signup',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        await route.fallback();
      },
      { times: 1 },
    );
    await page.goto('/');
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Finding your place' }),
      ).toBeVisible();
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-loading`);
    }
  });

  test('recoverable query error at every viewport', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await mockAnonymousIdentity(page, {
      onboardingStatus: 'not_started',
      onboardingQueryError: true,
    });
    await page.goto('/');
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'We couldn’t restore your choices.',
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Try again' }),
      ).toBeVisible();
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-query-error`);
    }
  });

  test('recoverable mutation, completion, and skip transitions', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await mockAnonymousIdentity(page, { onboardingStatus: 'not_started' });
    await page.route(
      'http://127.0.0.1:54321/rest/v1/rpc/complete_onboarding',
      async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic mutation failure' }),
        });
      },
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expectOnboardingImagesLoaded(page);
    await page.getByRole('button', { name: 'Show my feed' }).click();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'We couldn’t save your choices.',
      }),
    ).toBeVisible();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectViewportGeometry(page);
      await capture(page, testInfo, `${viewport.name}-mutation-error`);
    }

    await page.unroute(
      'http://127.0.0.1:54321/rest/v1/rpc/complete_onboarding',
    );
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page).toHaveURL(/\/discover$/);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectProductGeometry(page);
      await capture(page, testInfo, `${viewport.name}-completion`);
    }

    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Discover' }),
    ).toBeVisible();

    await mockAnonymousIdentity(page, { onboardingStatus: 'not_started' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/\/discover$/);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectProductGeometry(page);
      await capture(page, testInfo, `${viewport.name}-skip`);
    }
  });
});
