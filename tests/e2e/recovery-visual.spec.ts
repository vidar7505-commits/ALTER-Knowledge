import { expect, test, type Page } from '@playwright/test';

import { mockAnonymousIdentity } from './identity-mock';

const viewports = [
  { name: '320x700', width: 320, height: 700 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1200x900', width: 1200, height: 900 },
  { name: '1440x1024', width: 1440, height: 1024 },
] as const;

type RecoveryVisualState = {
  name: string;
  message: string | null;
  pendingCount: number;
  retry: boolean;
  alert: boolean;
  focusRetry?: boolean;
  reducedMotion?: boolean;
};

const states = [
  {
    name: 'online-normal',
    message: null,
    pendingCount: 0,
    retry: false,
    alert: false,
  },
  {
    name: 'offline',
    message: 'You’re offline. Loaded content remains available.',
    pendingCount: 0,
    retry: false,
    alert: false,
  },
  {
    name: 'pending-retained-mutation',
    message: 'Your pending change is retained.',
    pendingCount: 1,
    retry: false,
    alert: false,
  },
  {
    name: 'retrying',
    message: 'Retrying your retained change…',
    pendingCount: 1,
    retry: false,
    alert: false,
  },
  {
    name: 'retry-available',
    message: 'A retained change needs a manual retry.',
    pendingCount: 1,
    retry: true,
    alert: false,
  },
  {
    name: 'retry-exhausted',
    message: 'A retained change needs a manual retry.',
    pendingCount: 1,
    retry: true,
    alert: false,
  },
  {
    name: 'conflict-reconciliation',
    message: 'The Challenge changed and was refreshed.',
    pendingCount: 0,
    retry: true,
    alert: true,
  },
  {
    name: 'corrupt-state-recovery',
    message: 'Invalid local recovery data was removed safely.',
    pendingCount: 0,
    retry: false,
    alert: true,
  },
  {
    name: 'storage-unavailable',
    message: 'Recovery storage is unavailable.',
    pendingCount: 0,
    retry: false,
    alert: true,
  },
  {
    name: 'reconnect-success',
    message: 'Your retained change is up to date.',
    pendingCount: 0,
    retry: false,
    alert: false,
  },
  {
    name: 'long-canonical-copy',
    message:
      'Your pending Challenge selection is retained for this private session and will retry safely after the canonical identity and connection are restored.',
    pendingCount: 12,
    retry: true,
    alert: false,
  },
  {
    name: 'keyboard-focus-on-retry',
    message: 'A retained change needs a manual retry.',
    pendingCount: 1,
    retry: true,
    alert: false,
    focusRetry: true,
  },
  {
    name: 'reduced-motion',
    message: 'Retrying your retained change…',
    pendingCount: 1,
    retry: false,
    alert: false,
    reducedMotion: true,
  },
  {
    name: 'mobile-navigation-clearance',
    message: 'Your pending change is retained.',
    pendingCount: 1,
    retry: false,
    alert: false,
  },
  {
    name: 'desktop-rail-clearance',
    message: 'Your pending change is retained.',
    pendingCount: 1,
    retry: false,
    alert: false,
  },
] as const satisfies readonly RecoveryVisualState[];

async function installVisualState(page: Page, state: RecoveryVisualState) {
  await page.emulateMedia({
    reducedMotion: state.reducedMotion ? 'reduce' : 'no-preference',
  });
  await page.evaluate((nextState) => {
    const banner = document.querySelector<HTMLElement>(
      '[aria-label="Recovery status"]',
    );
    if (!banner) throw new Error('The canonical recovery banner is missing.');
    banner.hidden = nextState.message === null;
    if (nextState.message === null) return;

    banner.setAttribute('role', nextState.alert ? 'alert' : 'status');
    banner.setAttribute('aria-live', nextState.alert ? 'assertive' : 'polite');
    const message = banner.children.item(0);
    if (!message) throw new Error('The recovery message is missing.');
    message.textContent = nextState.message;

    const count = banner.querySelector<HTMLElement>('[data-visual-count]');
    if (!count) throw new Error('The recovery count fixture is missing.');
    count.hidden = nextState.pendingCount === 0;
    count.textContent = `${nextState.pendingCount} pending`;

    const retry = banner.querySelector<HTMLButtonElement>(
      '[data-visual-retry]',
    );
    if (!retry) throw new Error('The recovery retry fixture is missing.');
    retry.hidden = !nextState.retry;
    if (nextState.focusRetry) {
      retry.focus();
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.documentElement.style.overflowAnchor = 'none';
    document.body.style.overflowAnchor = 'none';
  }, state);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          window.scrollTo(0, 0);
          requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            resolve();
          });
        });
      }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function assertVisualContract(
  page: Page,
  state: RecoveryVisualState,
  width: number,
) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
          document.documentElement.clientWidth &&
        document.body.scrollWidth <= document.body.clientWidth,
    ),
  ).toBe(true);

  const visibleBottomNavigation = page.locator(
    '[data-navigation="bottom"]:visible',
  );
  const visibleDesktopRail = page.locator('[data-navigation="rail"]:visible');
  expect(
    (await visibleBottomNavigation.count()) +
      (await visibleDesktopRail.count()),
  ).toBe(1);

  if (state.message === null) {
    await expect(page.locator('[aria-label="Recovery status"]')).toBeHidden();
    return;
  }

  const banner = page.locator('[aria-label="Recovery status"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(state.message);
  await expect(
    page.locator('[aria-label="Recovery status"]:visible'),
  ).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const recovery = document.querySelector<HTMLElement>(
      '[aria-label="Recovery status"]',
    )!;
    const main = document.querySelector<HTMLElement>('#main-content')!;
    const navigation = document.querySelector<HTMLElement>(
      '[data-navigation="bottom"]',
    )!;
    const rail = document.querySelector<HTMLElement>(
      '[data-navigation="rail"]',
    )!;
    const recoveryBox = recovery.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    const navigationBox = navigation.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    const style = getComputedStyle(recovery);
    return {
      recovery: {
        left: recoveryBox.left,
        right: recoveryBox.right,
        bottom: recoveryBox.bottom,
      },
      main: { left: mainBox.left, top: mainBox.top },
      navigation: {
        display: getComputedStyle(navigation).display,
        top: navigationBox.top,
      },
      rail: {
        display: getComputedStyle(rail).display,
        right: railBox.right,
      },
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      scrollWidth: recovery.scrollWidth,
      clientWidth: recovery.clientWidth,
    };
  });

  expect(geometry.recovery.left).toBeGreaterThanOrEqual(0);
  expect(geometry.recovery.right).toBeLessThanOrEqual(width);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.main.top).toBeGreaterThanOrEqual(geometry.recovery.bottom);
  expect(geometry.fontSize).toBeGreaterThanOrEqual(12);
  expect(geometry.lineHeight).toBeGreaterThan(geometry.fontSize);

  if (geometry.navigation.display !== 'none') {
    expect(geometry.recovery.bottom).toBeLessThan(geometry.navigation.top);
  }
  if (geometry.rail.display !== 'none') {
    expect(geometry.recovery.left).toBeGreaterThanOrEqual(geometry.rail.right);
    expect(geometry.main.left).toBeGreaterThanOrEqual(geometry.rail.right);
  }

  const retry = page.locator('[data-visual-retry]');
  if (state.retry) {
    await expect(retry).toBeVisible();
    const box = await retry.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect(
      box ? box.x + box.width : Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(width);
  }
  if (state.focusRetry) {
    await expect(retry).toBeFocused();
    expect(
      await retry.evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe('none');
  }
  if (state.reducedMotion) {
    expect(
      await banner.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.animationDuration, style.transitionDuration];
      }),
    ).toEqual(['0s', '0s']);
  }
}

for (const viewport of viewports) {
  test(`certifies all recovery visual states at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await mockAnonymousIdentity(page);
    await page.goto('/discover');
    await expect
      .poll(() => page.locator('[data-product-id]').count())
      .toBeGreaterThanOrEqual(24);

    const focusedControl = page.getByRole('button', {
      name: 'Save Canonical Product 1 to Wardrobe',
    });
    await focusedControl.focus();
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event('offline'));
    });
    await expect(focusedControl).toBeFocused();

    await focusedControl.click();
    let banner = page.locator('[aria-label="Recovery status"]');
    await expect(banner).toContainText('retained');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('alter-recovery-v1', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const database = open.result;
            const transaction = database.transaction(
              'identity-queues',
              'readwrite',
            );
            const cursorRequest = transaction
              .objectStore('identity-queues')
              .openCursor();
            cursorRequest.onerror = () => reject(cursorRequest.error);
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) {
                reject(new Error('The recovery queue fixture is missing.'));
                return;
              }
              const document = JSON.parse(String(cursor.value)) as {
                items: Array<Record<string, unknown>>;
              };
              document.items = document.items.map((item) => ({
                ...item,
                attemptCount: 3,
                retryState: 'terminal',
              }));
              cursor.update(JSON.stringify(document));
            };
            transaction.oncomplete = () => {
              database.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        }),
    );
    await page.reload();
    banner = page.locator('[aria-label="Recovery status"]');
    await expect(banner).toContainText('manual retry');
    await expect
      .poll(() => page.locator('[data-product-id]').count())
      .toBeGreaterThanOrEqual(24);
    await banner.evaluate((element) => {
      const count = element.children.item(1) as HTMLElement | null;
      if (!count) throw new Error('The canonical pending count is missing.');
      count.dataset.visualCount = '';

      const retry = element.querySelector<HTMLButtonElement>('button');
      if (!retry) throw new Error('The canonical retry button is missing.');
      retry.dataset.visualRetry = '';
    });

    for (const state of states) {
      await installVisualState(page, state);
      await assertVisualContract(page, state, viewport.width);
      const screenshotPath = testInfo.outputPath(`${state.name}.png`);
      await page.screenshot({
        animations: 'disabled',
        path: screenshotPath,
      });
      await testInfo.attach(`${viewport.name}-${state.name}`, {
        path: screenshotPath,
        contentType: 'image/png',
      });
    }
  });
}
