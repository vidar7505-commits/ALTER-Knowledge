import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const viewports = [
  { name: 'M320', width: 320, height: 700 },
  { name: 'M390', width: 390, height: 844 },
  { name: 'T768', width: 768, height: 1024 },
  { name: 'D1200', width: 1200, height: 900 },
  { name: 'D1440', width: 1440, height: 1024 },
] as const;

type MockOptions = NonNullable<Parameters<typeof mockAnonymousIdentity>[1]>;

async function openDiscover(
  context: BrowserContext,
  options: MockOptions,
  reducedMotion = false,
) {
  const page = await context.newPage();
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = await mockAnonymousIdentity(page, options);
  await page.goto('/discover');
  await expect(page.locator('[data-product-id]')).toHaveCount(24);
  return { page, mock };
}

async function assertFrame(page: Page, cardExpected: boolean) {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Discover' }),
  ).toBeVisible();
  await expect(
    page.locator('nav[aria-label="Primary mobile navigation"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('nav[aria-label="Primary desktop navigation"]'),
  ).toHaveCount(1);
  await expect(page.getByTestId('continuation-card')).toHaveCount(
    cardExpected ? 1 : 0,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);

  const slot = page.locator('[class*="continuationSlot"]');
  if ((await slot.count()) > 0) {
    const slotBox = await slot.boundingBox();
    expect(slotBox?.height ?? 0).toBeGreaterThanOrEqual(176);
    for (const control of await slot.locator('button, a').all()) {
      const box = await control.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }

  if (!cardExpected) return;
  const card = page.getByTestId('continuation-card');
  await expect(card.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(
    card.locator('a a, a button, button a, button button'),
  ).toHaveCount(0);
  const cardBox = await card.boundingBox();
  const gridBox = await page
    .getByRole('list', { name: 'Discover products' })
    .boundingBox();
  expect(cardBox).not.toBeNull();
  expect(gridBox).not.toBeNull();
  expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(gridBox!.y);
}

async function captureMatrix(
  page: Page,
  testInfo: TestInfo,
  state: string,
  cardExpected: boolean,
  focus?: (page: Page) => Promise<void>,
) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    if (focus) await focus(page);
    await assertFrame(page, cardExpected);
    if (focus) {
      expect(
        await page.evaluate(() => {
          const active = document.activeElement;
          if (!(active instanceof HTMLElement)) return false;
          const style = getComputedStyle(active);
          return style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
        }),
      ).toBe(true);
    }
    await page.screenshot({
      path: testInfo.outputPath(`${state}-${viewport.name}.png`),
      fullPage: false,
    });
  }
}

test('certifies same-session, exact-threshold, and no-candidate Discover', async ({
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  for (const scenario of [
    { state: 'same-session-no-card', sessionMode: 'same' as const },
    { state: 'exact-30-minutes-no-card', sessionMode: 'exact' as const },
  ]) {
    const { page } = await openDiscover(context, {
      sessionMode: scenario.sessionMode,
      initialChallengeStatus: 'active',
      initialChallengeSelectionCount: 1,
      initialSavedProductCount: 1,
    });
    await captureMatrix(page, testInfo, scenario.state, false);
    await page.close();
  }

  const { page } = await openDiscover(context, {
    sessionMode: 'return',
    initialSavedProductCount: 0,
    lastMeaningfulDestination: 'discover',
  });
  await captureMatrix(page, testInfo, 'return-no-candidate', false);
  await page.close();
});

test('certifies active and completed Challenge continuation', async ({
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const active = await openDiscover(context, {
    sessionMode: 'return',
    initialChallengeStatus: 'active',
    initialChallengeSelectionCount: 1,
    initialSavedProductCount: 1,
  });
  await expect(active.page.getByText('1 of 4 pieces selected')).toBeVisible();
  await captureMatrix(active.page, testInfo, 'return-active-challenge', true);
  await active.page.close();

  const completed = await openDiscover(context, {
    sessionMode: 'return',
    initialChallengeStatus: 'completed',
    initialSavedProductCount: 4,
  });
  await expect(completed.page.getByText('Your latest look')).toBeVisible();
  await captureMatrix(
    completed.page,
    testInfo,
    'return-completed-challenge',
    true,
  );
  await completed.page.close();
});

test('certifies Wardrobe, long canonical copy, focus, and reduced motion', async ({
  context,
}, testInfo) => {
  test.setTimeout(240_000);
  const wardrobe = await openDiscover(context, {
    sessionMode: 'return',
    initialSavedProductCount: 24,
    lastMeaningfulDestination: 'wardrobe',
  });
  await expect(
    wardrobe.page.getByText('Pick up where you left off'),
  ).toBeVisible();
  await captureMatrix(
    wardrobe.page,
    testInfo,
    'return-wardrobe-long-copy',
    true,
  );
  await captureMatrix(
    wardrobe.page,
    testInfo,
    'focus-primary-action',
    true,
    async (page) => {
      await page.getByRole('button', { name: 'Open Wardrobe' }).focus();
    },
  );
  await captureMatrix(
    wardrobe.page,
    testInfo,
    'focus-dismiss-action',
    true,
    async (page) => {
      await page
        .getByRole('button', {
          name: 'Dismiss Your Wardrobe continuation',
        })
        .focus();
    },
  );
  await wardrobe.page.close();

  const reduced = await openDiscover(
    context,
    {
      sessionMode: 'return',
      initialSavedProductCount: 1,
      lastMeaningfulDestination: 'wardrobe',
    },
    true,
  );
  expect(
    await reduced.page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);
  expect(
    await reduced.page
      .getByTestId('continuation-card')
      .evaluate((node) =>
        [node, ...node.querySelectorAll('button')].every(
          (element) =>
            getComputedStyle(element).transitionDuration === '0s' &&
            getComputedStyle(element).animationName === 'none',
        ),
      ),
  ).toBe(true);
  await captureMatrix(reduced.page, testInfo, 'reduced-motion', true);
  await reduced.page.close();
});

test('certifies resolver error and visually quiet retry loading', async ({
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const { page, mock } = await openDiscover(context, {
    sessionMode: 'return',
    continuationQueryErrorOnce: true,
    initialSavedProductCount: 1,
    lastMeaningfulDestination: 'wardrobe',
  });
  await expect(
    page.getByRole('heading', {
      name: 'We couldn’t restore your continuation.',
    }),
  ).toBeVisible();
  await captureMatrix(page, testInfo, 'resolver-recoverable-error', false);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mock.resolveContinuationQueryError();
  await page.route(
    'http://127.0.0.1:54321/rest/v1/challenge_progress?**',
    async (route) => {
      await gate;
      await route.fallback();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'We couldn’t restore your continuation.',
    }),
  ).toHaveCount(0);
  await captureMatrix(page, testInfo, 'resolver-retry-loading', false);
  release();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Your Wardrobe' }),
  ).toBeVisible();
  await page.close();
});

test('certifies activation-pending without completing navigation', async ({
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const { page } = await openDiscover(context, {
    sessionMode: 'return',
    initialChallengeStatus: 'active',
    initialChallengeSelectionCount: 1,
    initialSavedProductCount: 1,
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/challenge?**', async (route) => {
    await gate;
    await route.abort();
  });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await captureMatrix(page, testInfo, 'activation-pending', true);
  release();
  await page.close();
});

test('certifies dismissed consumption and same-session reload stability', async ({
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  const { page } = await openDiscover(context, {
    sessionMode: 'return',
    initialSavedProductCount: 1,
    lastMeaningfulDestination: 'wardrobe',
  });
  await page
    .getByRole('button', {
      name: 'Dismiss Your Wardrobe continuation',
    })
    .click();
  await expect(page.getByTestId('continuation-card')).toHaveCount(0);
  await captureMatrix(page, testInfo, 'dismissed-consumed', false);

  await page.reload();
  await expect
    .poll(() => page.locator('[data-product-id]').count())
    .toBeGreaterThanOrEqual(24);
  await expect(page.getByTestId('continuation-card')).toHaveCount(0);
  await captureMatrix(
    page,
    testInfo,
    'same-session-reload-after-consumption',
    false,
  );
  await page.close();
});
