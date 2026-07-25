import type { Page } from '@playwright/test';

const authUserId = '00000000-0000-4000-8000-000000000091';
const anonymousUserId = '10000000-0000-4000-8000-000000000091';
const wardrobeId = '20000000-0000-4000-8000-000000000091';
const sessionId = '30000000-0000-4000-8000-000000000091';
const feedInstanceId = '50000000-0000-4000-8000-000000000091';
const now = '2026-07-24T12:00:00.000Z';
const nextCursor = `lr001-feed-cursor-v1.${'a'.repeat(64)}`;
const productImage =
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&h=1500&q=85';

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
    initialFeedErrorOnce?: boolean;
    paginationErrorOnce?: boolean;
    initialBatchDelayMs?: number;
    paginationDelayMs?: number;
    productCount?: number;
    productImageFailure?: boolean;
  } = {},
) {
  let onboardingStatus =
    options.onboardingStatus ?? 'completed_without_preferences';
  let operationId: string | null = null;
  let selectedPreferenceIds: string[] = [];
  let loadedCount = 0;
  let qualifiedDepth = 0;
  let ensureFeedCalls = 0;
  let initialFeedErrorRemaining = options.initialFeedErrorOnce ? 1 : 0;
  let paginationErrorRemaining = options.paginationErrorOnce ? 1 : 0;
  const appendCursors: Array<string | null> = [];
  const telemetryEvents: Array<Record<string, unknown>> = [];
  const savedProducts = new Map<string, string>();

  const productCount = options.productCount ?? 30;
  const discoverProducts = Array.from({ length: productCount }, (_, index) => {
    const position = index + 1;
    const suffix = position.toString().padStart(12, '0');
    const category = ['top', 'bottom', 'shoes', 'layer', 'accessory'][
      index % 5
    ];
    return {
      product_id: `c0800000-0000-4000-8000-${suffix}`,
      position,
      batch_number: position <= 24 ? 1 : 2,
      name:
        position === 2
          ? 'Canonical Product With A Deliberately Long Editorial Name That Must Wrap Safely'
          : `Canonical Product ${position}`,
      brand:
        position === 2
          ? 'A Very Long Editorial Fixture Studio'
          : 'Fixture Studio',
      category,
      subcategory: `${category}-fixture`,
      image_urls: [productImage],
      image_metadata: {
        primary_index: 0,
        images: [
          {
            url: productImage,
            width: 1200,
            height: 1500,
            aspect_ratio: 0.8,
            alt: `Fixture Studio Canonical Product ${position}, ${category}.`,
          },
        ],
      },
      price_amount: 100 + position,
      price_currency: 'EUR',
      catalog_version: 'lr001-catalog-v1',
    };
  });

  await page.route('**/api/telemetry', async (route) => {
    const request = (route.request().postDataJSON() ?? {}) as {
      events?: Array<Record<string, unknown>>;
    };
    const events = request.events ?? [];
    telemetryEvents.push(...events);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: events.map((event, index) => ({
          index,
          event_id: event.event_id,
          status: 'accepted',
          error_codes: [],
          received_at: now,
        })),
      }),
    });
  });

  await page.route('**/_next/image?**', async (route) => {
    const optimizedSource = new URL(route.request().url()).searchParams.get(
      'url',
    );
    if (!optimizedSource?.startsWith('https://images.unsplash.com/')) {
      await route.fallback();
      return;
    }
    if (options.productImageFailure) {
      await route.fulfill({ status: 503, body: 'fixture image failure' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLzGQAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
  });

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

    if (url.pathname === '/rest/v1/rpc/ensure_session') {
      const body = (route.request().postDataJSON() ?? {}) as {
        p_session_id?: string;
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_id: body.p_session_id ?? sessionId,
          session_number: 1,
          is_return_session: false,
          started_at: now,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/ensure_feed_instance') {
      ensureFeedCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          feed_instance_id: feedInstanceId,
          last_cursor:
            loadedCount > 0 && loadedCount < productCount ? nextCursor : null,
          max_loaded_position: loadedCount,
          max_qualified_position: qualifiedDepth,
          is_exhausted: loadedCount === productCount,
          feed_order_version: 'lr001-catalog-order-v1',
          onboarding_version: 'onboarding-style-v1',
          preference_ids: [],
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/append_feed_batch') {
      const body = (route.request().postDataJSON() ?? {}) as {
        p_cursor?: string | null;
      };
      const cursor = body.p_cursor ?? null;
      appendCursors.push(cursor);
      const isInitial = cursor === null;
      const delay = isInitial
        ? options.initialBatchDelayMs
        : options.paginationDelayMs;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      if (isInitial && initialFeedErrorRemaining > 0) {
        initialFeedErrorRemaining -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic initial failure' }),
        });
        return;
      }
      if (!isInitial && paginationErrorRemaining > 0) {
        paginationErrorRemaining -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'deterministic pagination failure',
          }),
        });
        return;
      }
      const products = isInitial
        ? discoverProducts.slice(0, 24)
        : discoverProducts.slice(24);
      loadedCount = isInitial
        ? Math.max(loadedCount, Math.min(24, productCount))
        : productCount;
      const isExhausted = loadedCount === productCount;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          feed_instance_id: feedInstanceId,
          batch_number: isInitial ? 1 : 2,
          returned_count: products.length,
          next_cursor: isExhausted ? null : nextCursor,
          is_exhausted: isExhausted,
          products,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/record_qualified_feed_position') {
      const body = (route.request().postDataJSON() ?? {}) as {
        p_session_id: string;
        p_position: number;
      };
      qualifiedDepth = Math.max(qualifiedDepth, body.p_position);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_id: body.p_session_id,
          feed_instance_id: feedInstanceId,
          max_qualified_position: qualifiedDepth,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/saved_products') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          [...savedProducts].map(([product_id, id]) => ({ id, product_id })),
        ),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/save_product') {
      const body = (route.request().postDataJSON() ?? {}) as {
        p_product_id: string;
        p_operation_id: string;
      };
      const savedProductId =
        savedProducts.get(body.p_product_id) ??
        `70000000-0000-4000-8000-${String(savedProducts.size + 1).padStart(12, '0')}`;
      savedProducts.set(body.p_product_id, savedProductId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          operation_id: body.p_operation_id,
          data: {
            saved_product_id: savedProductId,
            product_id: body.p_product_id,
            saved_at: now,
          },
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/remove_product') {
      const body = (route.request().postDataJSON() ?? {}) as {
        saved_product_id: string;
        operation_id: string;
      };
      const product = [...savedProducts].find(
        ([, id]) => id === body.saved_product_id,
      );
      if (product) savedProducts.delete(product[0]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          operation_id: body.operation_id,
          data: {
            saved_product_id: body.saved_product_id,
            product_id: product?.[0] ?? discoverProducts[0]?.product_id,
            removed_at: now,
          },
        }),
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

  return {
    getEnsureFeedCalls: () => ensureFeedCalls,
    getAppendCursors: () => [...appendCursors],
    getTelemetryEvents: () => [...telemetryEvents],
    getQualifiedDepth: () => qualifiedDepth,
    feedInstanceId,
    nextCursor,
  };
}
