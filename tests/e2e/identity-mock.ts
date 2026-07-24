import type { Page } from '@playwright/test';

const authUserId = '00000000-0000-4000-8000-000000000091';
const anonymousUserId = '10000000-0000-4000-8000-000000000091';
const wardrobeId = '20000000-0000-4000-8000-000000000091';
const now = '2026-07-24T12:00:00.000Z';

export async function mockAnonymousIdentity(page: Page) {
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/auth/v1/signup') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'local-e2e-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'local-e2e-refresh-token',
          user: {
            id: authUserId,
            aud: 'authenticated',
            role: 'authenticated',
            email: '',
            phone: '',
            is_anonymous: true,
            app_metadata: {
              provider: 'anonymous',
              providers: ['anonymous'],
            },
            user_metadata: {},
            identities: [],
            created_at: now,
            updated_at: now,
          },
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/ensure_anonymous_identity') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            anonymous_user_id: anonymousUserId,
            wardrobe_id: wardrobeId,
          },
        ]),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        message: `Unexpected local E2E route: ${url.pathname}`,
      }),
    });
  });
}
