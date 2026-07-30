import type { Page } from '@playwright/test';

const authUserId = '00000000-0000-4000-8000-000000000091';
const anonymousUserId = '10000000-0000-4000-8000-000000000091';
const wardrobeId = '20000000-0000-4000-8000-000000000091';
const sessionId = '30000000-0000-4000-8000-000000000091';
const feedInstanceId = '50000000-0000-4000-8000-000000000091';
const returnSessionId = '30000000-0000-4000-8000-000000000092';
const returnFeedInstanceId = '50000000-0000-4000-8000-000000000092';
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
    productDetailErrorOnce?: boolean;
    mutationErrorOnce?: boolean;
    multipleProductImages?: boolean;
    initialSavedProduct?: boolean;
    initialSavedProductCount?: number;
    partialProductMetadata?: boolean;
    wardrobeQueryErrorOnce?: boolean;
    wardrobeQueryDelayMs?: number;
    wardrobeProductQueryError?: boolean;
    unavailableSavedProduct?: boolean;
    initialChallengeStatus?: 'unstarted' | 'active' | 'completed';
    initialChallengeSelectionCount?: number;
    challengeLoadErrorOnce?: boolean;
    challengeProductErrorOnce?: boolean;
    challengeRevisionMismatchOnce?: boolean;
    challengeRevisionMismatchAction?: 'select' | 'remove' | 'complete';
    challengeOperationConflictOnce?: boolean;
    sessionMode?: 'first' | 'same' | 'exact' | 'return';
    lastMeaningfulDestination?: 'discover' | 'wardrobe' | 'challenge';
    continuationQueryErrorOnce?: boolean;
    destinationWriteErrorOnce?: boolean;
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
  let productDetailErrorRemaining = options.productDetailErrorOnce ? 1 : 0;
  let mutationErrorRemaining = options.mutationErrorOnce ? 1 : 0;
  let wardrobeQueryFailing = options.wardrobeQueryErrorOnce ?? false;
  let wardrobeProductQueryFailing = options.wardrobeProductQueryError ?? false;
  const appendCursors: Array<string | null> = [];
  const telemetryEvents: Array<Record<string, unknown>> = [];
  const savedProducts = new Map<string, string>();
  const savedAtByProduct = new Map<string, string>();
  const savedProductRequests: string[] = [];
  let wardrobeErrorsServed = 0;
  const challengeId = 'c0810000-0000-4000-8000-000000000001';
  const challengeProgressId = '60000000-0000-4000-8000-000000000091';
  const challengeCompletionId = '62000000-0000-4000-8000-000000000091';
  let challengeStatus = options.initialChallengeStatus ?? 'unstarted';
  let challengeRevision = challengeStatus === 'unstarted' ? 0 : 1;
  let challengeLoadFailing = options.challengeLoadErrorOnce ?? false;
  let challengeProductErrors = options.challengeProductErrorOnce ? 1 : 0;
  let challengeRevisionErrors = options.challengeRevisionMismatchOnce ? 1 : 0;
  let challengeConflictErrors = options.challengeOperationConflictOnce ? 1 : 0;
  let continuationQueryFailing = options.continuationQueryErrorOnce ?? false;
  let destinationWriteErrors = options.destinationWriteErrorOnce ? 1 : 0;
  let ensureSessionRequests = 0;
  let continuationRequests = 0;
  let activeSessionId = sessionId;
  const destinationWrites: Array<Record<string, unknown>> = [];
  const challengeSelections = new Map<
    string,
    { id: string; productId: string; selectedAt: string }
  >();

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
      image_urls: options.multipleProductImages
        ? [productImage, `${productImage}&ixid=secondary-${position}`]
        : [productImage],
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
          ...(options.multipleProductImages
            ? [
                {
                  url: `${productImage}&ixid=secondary-${position}`,
                  width: 1200,
                  height: 1500,
                  aspect_ratio: 0.8,
                  alt: `Fixture Studio Canonical Product ${position}, alternate view.`,
                },
              ]
            : []),
        ],
      },
      price_amount: 100 + position,
      price_currency: 'EUR',
      catalog_version: 'lr001-catalog-v1',
    };
  });
  const initialSavedCount =
    options.initialSavedProductCount ?? (options.initialSavedProduct ? 1 : 0);
  for (let index = 0; index < initialSavedCount; index += 1) {
    const product = discoverProducts[index];
    if (!product) break;
    savedProducts.set(
      product.product_id,
      `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    );
    savedAtByProduct.set(
      product.product_id,
      `2026-07-24T12:${String(index).padStart(2, '0')}:00.000Z`,
    );
  }
  const initialChallengeSelectionCount =
    challengeStatus === 'completed'
      ? 4
      : (options.initialChallengeSelectionCount ?? 0);
  if (challengeStatus !== 'unstarted') {
    ['top', 'bottom', 'shoes', 'layer_or_accessory']
      .slice(0, initialChallengeSelectionCount)
      .forEach((slotId, index) => {
        const product = discoverProducts[index];
        if (product) {
          challengeSelections.set(slotId, {
            id: `61000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            productId: product.product_id,
            selectedAt: now,
          });
        }
      });
    challengeRevision =
      1 +
      initialChallengeSelectionCount +
      (challengeStatus === 'completed' ? 1 : 0);
  }

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
      ensureSessionRequests += 1;
      const body = (route.request().postDataJSON() ?? {}) as {
        p_session_id?: string;
      };
      if (options.sessionMode === 'return' && ensureSessionRequests === 1) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '22023',
            message: 'session has expired',
          }),
        });
        return;
      }
      activeSessionId =
        options.sessionMode === 'return'
          ? returnSessionId
          : (body.p_session_id ?? sessionId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_id: activeSessionId,
          session_number: options.sessionMode === 'return' ? 2 : 1,
          is_return_session: options.sessionMode === 'return',
          started_at:
            options.sessionMode === 'return' ? '2026-07-24T12:31:00.000Z' : now,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/ensure_feed_instance') {
      ensureFeedCalls += 1;
      const activeFeedId =
        activeSessionId === returnSessionId
          ? returnFeedInstanceId
          : feedInstanceId;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          feed_instance_id: activeFeedId,
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
          feed_instance_id:
            activeSessionId === returnSessionId
              ? returnFeedInstanceId
              : feedInstanceId,
          batch_number: isInitial ? 1 : 2,
          returned_count: products.length,
          next_cursor: isExhausted ? null : nextCursor,
          is_exhausted: isExhausted,
          products,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/get_catalog_product') {
      if (wardrobeProductQueryFailing) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'private wardrobe product failure' }),
        });
        return;
      }
      if (productDetailErrorRemaining > 0) {
        productDetailErrorRemaining -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic detail failure' }),
        });
        return;
      }
      const body = (route.request().postDataJSON() ?? {}) as {
        p_product_id?: string;
      };
      const productId = body.p_product_id;
      const product = discoverProducts.find((p) => p.product_id === productId);
      const unavailable =
        options.unavailableSavedProduct &&
        productId === discoverProducts[0]?.product_id;
      const detailProduct =
        product && !unavailable
          ? {
              id: product.product_id,
              name: product.name,
              brand: product.brand,
              category: product.category,
              subcategory: options.partialProductMetadata
                ? null
                : product.subcategory,
              description: options.partialProductMetadata
                ? null
                : `Curated catalog fixture ${product.position}.`,
              image_urls: product.image_urls,
              image_metadata: product.image_metadata,
              price_amount: options.partialProductMetadata
                ? null
                : product.price_amount,
              price_currency: options.partialProductMetadata
                ? null
                : product.price_currency,
              attributes: {
                style_tags: ['minimal'],
                color: 'ink',
                season: ['all season'],
                fit: 'regular',
                occasion_tags: ['going_out'],
                materials: ['cotton'],
              },
              slot_eligibility: [
                product.category === 'accessory' || product.category === 'layer'
                  ? 'layer_or_accessory'
                  : product.category,
              ],
              is_active: true,
              catalog_version: product.catalog_version,
            }
          : null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detailProduct ? [detailProduct] : []),
      });
      return;
    }

    if (url.pathname === '/rest/v1/challenges') {
      if (challengeLoadFailing) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic challenge failure' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: challengeId,
            version: 'challenge-evening-v1',
            title: 'After Dark',
            context_copy: 'Build a look for an evening out.',
            required_slots: [
              { slot_id: 'top', label: 'Top', display_order: 1 },
              { slot_id: 'bottom', label: 'Bottom', display_order: 2 },
              { slot_id: 'shoes', label: 'Shoes', display_order: 3 },
              {
                slot_id: 'layer_or_accessory',
                label: 'Layer or Accessory',
                display_order: 4,
              },
            ],
            completion_rules: {
              required_slot_count: 4,
              unique_products: true,
              explicit_confirmation: true,
            },
            is_active: true,
          },
        ]),
      });
      return;
    }

    if (url.pathname === '/rest/v1/challenge_progress') {
      continuationRequests += 1;
      if (continuationQueryFailing) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'PGRST500',
            message: 'continuation resolver failure',
          }),
        });
        return;
      }
      const continuationShape = url.searchParams.get('select') === 'id,status';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          challengeStatus === 'unstarted' ||
            (continuationShape && challengeStatus === 'completed')
            ? []
            : [
                continuationShape
                  ? {
                      id: challengeProgressId,
                      status:
                        challengeStatus === 'completed'
                          ? 'completed'
                          : challengeSelections.size === 4
                            ? 'ready_to_complete'
                            : 'in_progress',
                    }
                  : {
                      id: challengeProgressId,
                      challenge_id: challengeId,
                      status:
                        challengeStatus === 'completed'
                          ? 'completed'
                          : challengeSelections.size === 4
                            ? 'ready_to_complete'
                            : 'in_progress',
                      started_at: now,
                      state_revision: challengeRevision,
                    },
              ],
        ),
      });
      return;
    }

    if (url.pathname === '/rest/v1/challenge_progress_items') {
      const continuationShape =
        url.searchParams.get('select') === 'slot_id,product_id';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          [...challengeSelections].map(([slot_id, item]) =>
            continuationShape
              ? { slot_id, product_id: item.productId }
              : {
                  id: item.id,
                  challenge_progress_id: challengeProgressId,
                  slot_id,
                  product_id: item.productId,
                  selected_at: item.selectedAt,
                },
          ),
        ),
      });
      return;
    }

    if (url.pathname === '/rest/v1/challenge_completions') {
      const continuationShape =
        url.searchParams.get('select') ===
        'id,challenge_progress_id,completed_at';
      const snapshotItems = [...challengeSelections].map(([slot_id, item]) => {
        const product = discoverProducts.find(
          (candidate) => candidate.product_id === item.productId,
        )!;
        return {
          slot_id,
          product_id: product.product_id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          image_urls: product.image_urls,
        };
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          challengeStatus === 'completed'
            ? [
                {
                  id: challengeCompletionId,
                  challenge_progress_id: challengeProgressId,
                  completed_at: '2026-07-24T12:00:00.000Z',
                  ...(continuationShape
                    ? {}
                    : { selected_products_snapshot: { items: snapshotItems } }),
                },
              ]
            : [],
        ),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/list_products_for_challenge_slot') {
      if (challengeProductErrors > 0) {
        challengeProductErrors -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic picker failure' }),
        });
        return;
      }
      const body = (route.request().postDataJSON() ?? {}) as {
        p_slot_id: string;
      };
      const rows = discoverProducts
        .filter((product) => {
          const eligibility =
            product.category === 'accessory' || product.category === 'layer'
              ? 'layer_or_accessory'
              : product.category;
          return eligibility === body.p_slot_id;
        })
        .map((product) => ({
          id: product.product_id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          subcategory: product.subcategory,
          description: `Curated catalog fixture ${product.position}.`,
          image_urls: product.image_urls,
          image_metadata: product.image_metadata,
          price_amount: product.price_amount,
          price_currency: product.price_currency,
          attributes: {
            style_tags: ['minimal'],
            color: 'ink',
            season: ['all season'],
            fit: 'regular',
            occasion_tags: ['going_out'],
            materials: ['cotton'],
          },
          slot_eligibility: [body.p_slot_id],
          is_active: true,
          catalog_version: product.catalog_version,
        }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/start_challenge') {
      const body = (route.request().postDataJSON() ?? {}) as {
        p_operation_id: string;
      };
      if (challengeStatus === 'unstarted') {
        challengeStatus = 'active';
        challengeRevision = 1;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          operation_id: body.p_operation_id,
          state_revision: challengeRevision,
          data: {
            challenge_progress_id: challengeProgressId,
            status:
              challengeStatus === 'completed' ? 'completed' : 'in_progress',
          },
        }),
      });
      return;
    }

    if (
      url.pathname === '/rest/v1/rpc/select_challenge_item' ||
      url.pathname === '/rest/v1/rpc/remove_challenge_item' ||
      url.pathname === '/rest/v1/rpc/complete_challenge'
    ) {
      const body = (route.request().postDataJSON() ?? {}) as Record<
        string,
        string | number
      >;
      const mutationAction = url.pathname.endsWith('select_challenge_item')
        ? 'select'
        : url.pathname.endsWith('remove_challenge_item')
          ? 'remove'
          : 'complete';
      if (
        challengeRevisionErrors > 0 &&
        (!options.challengeRevisionMismatchAction ||
          options.challengeRevisionMismatchAction === mutationAction)
      ) {
        challengeRevisionErrors -= 1;
        challengeRevision += 1;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '40001',
            message: 'challenge_revision_mismatch',
          }),
        });
        return;
      }
      if (challengeConflictErrors > 0) {
        challengeConflictErrors -= 1;
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '22023',
            message: 'operation_id reused with a different fingerprint',
          }),
        });
        return;
      }
      if (body.expected_state_revision !== challengeRevision) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '40001',
            message: 'challenge_revision_mismatch',
          }),
        });
        return;
      }
      if (url.pathname.endsWith('select_challenge_item')) {
        const slotId = String(body.slot_id);
        const productId = String(body.product_id);
        const prior = challengeSelections.get(slotId);
        const id =
          prior?.id ??
          `61000000-0000-4000-8000-${String(challengeSelections.size + 1).padStart(12, '0')}`;
        challengeSelections.set(slotId, {
          id,
          productId,
          selectedAt: now,
        });
        challengeRevision += prior?.productId === productId ? 0 : 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            operation_id: body.operation_id,
            state_revision: challengeRevision,
            data: {
              challenge_progress_item_id: id,
              slot_id: slotId,
              product_id: productId,
              status:
                challengeSelections.size === 4
                  ? 'ready_to_complete'
                  : 'in_progress',
            },
          }),
        });
        return;
      }
      if (url.pathname.endsWith('remove_challenge_item')) {
        const selected = [...challengeSelections].find(
          ([, item]) => item.id === String(body.challenge_progress_item_id),
        );
        if (selected) challengeSelections.delete(selected[0]);
        challengeRevision += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            operation_id: body.operation_id,
            state_revision: challengeRevision,
            data: {
              challenge_progress_item_id: body.challenge_progress_item_id,
              slot_id: selected?.[0] ?? 'top',
              product_id:
                selected?.[1].productId ?? discoverProducts[0]!.product_id,
              removed_at: now,
              status: 'in_progress',
            },
          }),
        });
        return;
      }
      challengeStatus = 'completed';
      challengeRevision += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          operation_id: body.operation_id,
          state_revision: challengeRevision,
          data: {
            challenge_completion_id: challengeCompletionId,
            completed_at: now,
          },
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
          feed_instance_id:
            activeSessionId === returnSessionId
              ? returnFeedInstanceId
              : feedInstanceId,
          max_qualified_position: qualifiedDepth,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/record_meaningful_destination') {
      const body = (route.request().postDataJSON() ?? {}) as {
        p_session_id: string;
        p_destination: string;
        p_operation_id: string;
      };
      destinationWrites.push(body);
      if (destinationWriteErrors > 0) {
        destinationWriteErrors -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'destination write failure' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          operation_id: body.p_operation_id,
          state_revision: destinationWrites.length,
          data: {
            destination: body.p_destination,
            session_id: body.p_session_id,
            recorded_at: now,
          },
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/anonymous_users') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            last_meaningful_destination:
              options.lastMeaningfulDestination ?? 'discover',
          },
        ]),
      });
      return;
    }

    if (url.pathname === '/rest/v1/sessions') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          challengeStatus === 'completed' && options.sessionMode === 'return'
            ? [
                {
                  id: returnSessionId,
                  session_number: 2,
                  started_at: '2026-07-24T12:31:00.000Z',
                  is_return_session: true,
                },
              ]
            : [],
        ),
      });
      return;
    }

    if (url.pathname === '/rest/v1/saved_products') {
      savedProductRequests.push(url.search);
      const selectedFields = url.searchParams.get('select');
      const requestsSavedAt = url.searchParams
        .get('select')
        ?.includes('saved_at');
      if (requestsSavedAt && options.wardrobeQueryDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.wardrobeQueryDelayMs),
        );
      }
      if (wardrobeQueryFailing) {
        wardrobeErrorsServed += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'private wardrobe query failure' }),
        });
        return;
      }
      const rows = [...savedProducts]
        .map(([product_id, id]) => ({
          id,
          product_id,
          saved_at: savedAtByProduct.get(product_id) ?? now,
        }))
        .sort(
          (left, right) =>
            right.saved_at.localeCompare(left.saved_at) ||
            right.id.localeCompare(left.id),
        );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          selectedFields === 'product_id'
            ? rows.map(({ product_id }) => ({ product_id }))
            : selectedFields === 'id'
              ? rows.map(({ id }) => ({ id }))
              : requestsSavedAt
                ? rows
                : rows.map(({ id, product_id }) => ({ id, product_id })),
        ),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/save_product') {
      if (mutationErrorRemaining > 0) {
        mutationErrorRemaining -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic mutation failure' }),
        });
        return;
      }
      const body = (route.request().postDataJSON() ?? {}) as {
        p_product_id: string;
        p_operation_id: string;
      };
      const savedProductId =
        savedProducts.get(body.p_product_id) ??
        `70000000-0000-4000-8000-${String(savedProducts.size + 1).padStart(12, '0')}`;
      savedProducts.set(body.p_product_id, savedProductId);
      savedAtByProduct.set(body.p_product_id, now);
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
      if (mutationErrorRemaining > 0) {
        mutationErrorRemaining -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'deterministic mutation failure' }),
        });
        return;
      }
      const body = (route.request().postDataJSON() ?? {}) as {
        saved_product_id: string;
        operation_id: string;
      };
      const product = [...savedProducts].find(
        ([, id]) => id === body.saved_product_id,
      );
      if (product) {
        savedProducts.delete(product[0]);
        savedAtByProduct.delete(product[0]);
      }
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
    getSavedProductRequests: () => [...savedProductRequests],
    getWardrobeErrorsServed: () => wardrobeErrorsServed,
    getDestinationWrites: () => [...destinationWrites],
    getActiveSessionId: () => activeSessionId,
    getContinuationRequests: () => continuationRequests,
    resolveWardrobeQueryError: () => {
      wardrobeQueryFailing = false;
    },
    resolveWardrobeProductQueryError: () => {
      wardrobeProductQueryFailing = false;
    },
    resolveChallengeLoadError: () => {
      challengeLoadFailing = false;
    },
    resolveContinuationQueryError: () => {
      continuationQueryFailing = false;
    },
    feedInstanceId,
    returnFeedInstanceId,
    nextCursor,
  };
}
