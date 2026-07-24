import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

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

async function captureViewport(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test.beforeEach(async ({ page }) => {
  await mockAnonymousIdentity(page);
});

test('mobile shell exposes the bottom navigation and stable route boundaries', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/discover');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Discover' }),
  ).toBeVisible();

  const bottomNavigation = page.locator(
    'nav[aria-label="Primary mobile navigation"][data-navigation="bottom"]',
  );
  const rail = page.locator(
    'nav[aria-label="Primary desktop navigation"][data-navigation="rail"]',
  );

  await expect(bottomNavigation).toBeVisible();
  await expect(rail).toBeHidden();
  await expect(
    bottomNavigation.getByRole('link', { name: 'Discover' }),
  ).toHaveAttribute('aria-current', 'page');

  for (const name of ['Discover', 'Wardrobe', 'Challenge']) {
    const link = bottomNavigation.getByRole('link', { name });
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
  }

  const mainPaddingBottom = await page
    .getByRole('main')
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingBottom),
    );
  const navHeight = await bottomNavigation.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(mainPaddingBottom).toBeGreaterThanOrEqual(navHeight);

  await bottomNavigation.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page).toHaveURL(/\/wardrobe$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wardrobe' }),
  ).toBeVisible();
  await expect(
    bottomNavigation.getByRole('link', { name: 'Wardrobe' }),
  ).toHaveAttribute('aria-current', 'page');

  await expectNoHorizontalOverflow(page);
  await captureViewport(page, testInfo, 'shell-narrow-mobile-320');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bottomNavigation).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureViewport(page, testInfo, 'shell-standard-mobile-390');

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(bottomNavigation).toBeVisible();
  await expect(rail).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await captureViewport(page, testInfo, 'shell-tablet-768');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(bottomNavigation).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(bottomNavigation).toBeVisible();
  await expect(rail).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test('desktop shell exposes the rail, keyboard path, and stable content offset', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto('/discover');

  const rail = page.locator(
    'nav[aria-label="Primary desktop navigation"][data-navigation="rail"]',
  );
  const bottomNavigation = page.locator(
    'nav[aria-label="Primary mobile navigation"][data-navigation="bottom"]',
  );

  await expect(rail).toBeVisible();
  await expect(bottomNavigation).toBeHidden();

  const railBox = await rail.boundingBox();
  const mainBox = await page.getByRole('main').boundingBox();
  expect(railBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(mainBox!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width);

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  const challengeLink = rail.getByRole('link', { name: 'Challenge' });
  await challengeLink.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(rail.getByRole('link', { name: 'Wardrobe' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/wardrobe$/);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Wardrobe' }),
  ).toBeVisible();
  await expect(rail.getByRole('link', { name: 'Wardrobe' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await expectNoHorizontalOverflow(page);
  await captureViewport(page, testInfo, 'shell-desktop-1440');

  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(rail).toBeVisible();
  await expect(bottomNavigation).toBeHidden();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1728, height: 1117 });
  await expect(rail).toBeVisible();
  await expect(bottomNavigation).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await captureViewport(page, testInfo, 'shell-wide-desktop-1728');
});

test('shell preserves navigation offline and respects reduced motion', async ({
  context,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/challenge');

  const challengeLink = page
    .locator('nav[data-navigation="bottom"]')
    .getByRole('link', { name: 'Challenge' });

  await expect(challengeLink).toHaveCSS('transition-duration', '0.08s');

  await context.setOffline(true);
  const offlineStatus = page.getByText(
    'You’re offline. Loaded content remains available.',
    { exact: true },
  );
  await expect(offlineStatus).toBeVisible();
  await expect(challengeLink).toBeVisible();

  await context.setOffline(false);
  const restoredStatus = page.getByText('Back online.', { exact: true });
  await expect(restoredStatus).toBeVisible();
  await expect(restoredStatus).toHaveCount(0, { timeout: 4000 });
});

test('identity loading and recoverable error states remain stable', async ({
  page,
}, testInfo) => {
  let releaseRequest: (() => void) | undefined;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  await page.route('http://127.0.0.1:54321/auth/v1/signup', async (route) => {
    await requestGate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'request_timeout',
        message: 'Local deterministic network failure',
      }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Preparing your space' }),
  ).toBeVisible();
  await expect(page.getByText('A L T E R .', { exact: true })).toBeVisible();
  await captureViewport(page, testInfo, 'shell-identity-loading-390');

  releaseRequest?.();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'We couldn’t restore your session.',
    }),
  ).toBeVisible();
  await expect(page.getByText('A L T E R .', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await captureViewport(page, testInfo, 'shell-recoverable-error-390');
  await expectNoHorizontalOverflow(page);
});
