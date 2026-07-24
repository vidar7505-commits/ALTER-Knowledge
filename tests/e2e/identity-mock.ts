import type { Page } from '@playwright/test';

const authUserId = '00000000-0000-4000-8000-000000000091';
const anonymousUserId = '10000000-0000-4000-8000-000000000091';
const wardrobeId = '20000000-0000-4000-8000-000000000091';
const now = '2026-07-24T12:00:00.000Z';

const onboardingPreferences = [
  ['minimal', 'style', 'Minimal', 'Clean lines, controlled palette.', 1, 4],
  ['relaxed', 'style', 'Relaxed', 'Soft layers, easy proportions.', 2, 4],
  ['tailored', 'style', 'Tailored', 'Precise structure, polished shape.', 3, 4],
  ['romantic', 'style', 'Romantic', 'Fluid form, delicate detail.', 4, 4],
  ['street', 'style', 'Street', 'Graphic pieces, strong silhouettes.', 5, 4],
  [
    'experimental',
    'style',
    'Experimental',
    'Unexpected shape, contrast, texture.',
    6,
    4,
  ],
  ['everyday_ease', 'mood', 'Everyday ease', null, 1, null],
  ['work_and_meetings', 'mood', 'Work and meetings', null, 2, null],
  ['going_out', 'mood', 'Going out', null, 3, null],
  ['weekends_away', 'mood', 'Weekends away', null, 4, null],
  ['events_and_occasions', 'mood', 'Events and occasions', null, 5, null],
  ['trying_something_new', 'mood', 'Trying something new', null, 6, null],
].map(
  ([
    preference_id,
    preference_group,
    label,
    description,
    display_order,
    max_selections,
  ]) => ({
    definition_version: 'onboarding-style-v1',
    preference_id,
    preference_group,
    label,
    description,
    display_order,
    max_selections,
    asset_id: `onboarding-style-v1:${preference_id}`,
    is_active: true,
  }),
);

export async function mockAnonymousIdentity(
  page: Page,
  options: {
    onboardingStatus?:
      | 'not_started'
      | 'completed_with_preferences'
      | 'completed_without_preferences'
      | 'skipped';
    onboardingQueryError?: boolean;
  } = {},
) {
  let onboardingStatus =
    options.onboardingStatus ?? 'completed_without_preferences';
  let operationId: string | null = null;
  let selectedPreferenceIds: string[] = [];

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

    if (url.pathname === '/rest/v1/onboarding_states') {
      if (options.onboardingQueryError) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic query failure' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            status: onboardingStatus,
            onboarding_version: 'onboarding-style-v1',
            preference_set_version:
              onboardingStatus === 'completed_with_preferences'
                ? 'onboarding-style-v1'
                : null,
            preference_ids: selectedPreferenceIds,
            completion_operation_id:
              onboardingStatus === 'completed_without_preferences' ||
              onboardingStatus === 'completed_with_preferences'
                ? (operationId ?? '30000000-0000-4000-8000-000000000091')
                : null,
            skip_operation_id:
              onboardingStatus === 'skipped'
                ? (operationId ?? '40000000-0000-4000-8000-000000000091')
                : null,
            state_revision: 2,
          },
        ]),
      });
      return;
    }

    if (
      url.pathname === '/rest/v1/rpc/complete_onboarding' ||
      url.pathname === '/rest/v1/rpc/skip_onboarding'
    ) {
      const body = (route.request().postDataJSON() ?? {}) as {
        operation_id?: string;
        preference_ids?: string[];
      };
      operationId = body.operation_id ?? null;
      if (url.pathname.endsWith('skip_onboarding')) {
        onboardingStatus = 'skipped';
        selectedPreferenceIds = [];
      } else {
        selectedPreferenceIds = body.preference_ids ?? [];
        onboardingStatus = selectedPreferenceIds.length
          ? 'completed_with_preferences'
          : 'completed_without_preferences';
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          operation_id: operationId,
          state_revision: 3,
          data: {
            status: onboardingStatus,
            ...(body.preference_ids?.length
              ? { preference_ids: body.preference_ids }
              : {}),
          },
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/onboarding_preferences') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(onboardingPreferences),
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
