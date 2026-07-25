'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  Button,
  Heading,
  Text,
  VisuallyHidden,
} from '@/components/design-system/primitives';
import { useAnonymousIdentity } from '@/features/identity/identity-provider';
import { TelemetryError } from '@/features/telemetry/types';

import { ProductCard } from './product-card';
import { QualifiedImpressionCoordinator } from './qualified-impression';
import { discoverReducer } from './reducer';
import type { DiscoverService } from './service';
import {
  clearDiscoverRestoration,
  getSessionCandidateId,
  readDiscoverRestoration,
  writeDiscoverRestoration,
} from './storage';
import { createBrowserDiscoverService } from './supabase';
import {
  createBrowserDiscoverTelemetry,
  quietDiscoverCapture,
  type DiscoverTelemetry,
} from './telemetry';
import {
  DiscoverError,
  initialDiscoverState,
  type DiscoverProduct,
} from './types';
import styles from './discover.module.css';

const viewedFeeds = new Set<string>();
const startedSessions = new Set<string>();

function asDiscoverError(error: unknown): DiscoverError {
  if (error instanceof DiscoverError) return error;
  return new DiscoverError(
    'transport_unavailable',
    true,
    'The Discover service is temporarily unavailable.',
    { cause: error },
  );
}

function cursorHash(cursor: string | null) {
  if (!cursor) return 'initial';
  let hash = 2166136261;
  for (const character of cursor) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `cursor-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function FeedSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className={styles.skeletonGrid}
      role="status"
      aria-live="polite"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className={styles.skeletonCard} aria-hidden="true" key={index}>
          <span className={styles.skeletonImage} />
          <span className={styles.skeletonLine} />
          <span className={styles.skeletonLineShort} />
        </div>
      ))}
    </div>
  );
}

function StateMessage({
  title,
  body,
  alert = false,
  children,
}: {
  title: string;
  body: string;
  alert?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={styles.stateMessage} role={alert ? 'alert' : undefined}>
      <Heading as="h2" role="heading-lg">
        {title}
      </Heading>
      <Text className={styles.stateBody}>{body}</Text>
      {children ? <div className={styles.stateActions}>{children}</div> : null}
    </section>
  );
}

export function DiscoverExperience({
  forcedService,
  forcedTelemetry,
}: {
  forcedService?: DiscoverService;
  forcedTelemetry?: DiscoverTelemetry;
} = {}) {
  const identity = useAnonymousIdentity();
  const identityId =
    identity.state.status === 'ready' ? identity.state.anonymousUserId : null;
  const service = useMemo(
    () => forcedService ?? createBrowserDiscoverService(),
    [forcedService],
  );
  const [state, dispatch] = useReducer(discoverReducer, initialDiscoverState);
  const [attempt, setAttempt] = useState(0);
  const [saveTasks, setSaveTasks] = useState<
    Record<
      string,
      {
        action: 'save' | 'remove';
        operationId: string;
        busy: boolean;
        error: boolean;
      }
    >
  >({});
  const [undoProduct, setUndoProduct] = useState<DiscoverProduct | null>(null);
  const [undoTimerPaused, setUndoTimerPaused] = useState(false);
  const undoRemainingMs = useRef(5000);
  const telemetryRef = useRef<DiscoverTelemetry | null>(
    forcedTelemetry ?? null,
  );
  const [coordinator, setCoordinator] =
    useState<QualifiedImpressionCoordinator | null>(null);
  const requestGeneration = useRef(0);
  const paginationKey = useRef<string | null>(null);
  const stateRef = useRef(state);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persistRestoration = useCallback((anchor?: DiscoverProduct) => {
    const current = stateRef.current;
    if (!current.feed) return;
    writeDiscoverRestoration({
      feedInstanceId: current.feed.feed_instance_id,
      feedOrderVersion: current.feed.feed_order_version,
      requestCursors: current.requestCursors,
      anchorProductId: anchor?.product_id ?? null,
      anchorPosition: anchor?.position ?? null,
      scrollY: window.scrollY,
    });
  }, []);

  useEffect(() => {
    if (!identityId) return;
    const generation = ++requestGeneration.current;
    let active = true;

    const run = async () => {
      dispatch({ type: 'RESOLVE_SESSION' });
      const platform = window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
      const session = await service.ensureSession({
        sessionId: getSessionCandidateId(),
        appVersion: '0.1.0',
        platform,
        entryRoute: '/discover',
      });
      if (!active || generation !== requestGeneration.current) return;
      dispatch({ type: 'SESSION_READY', session });

      const telemetry =
        forcedTelemetry ??
        createBrowserDiscoverTelemetry(session.session_id, platform);
      telemetryRef.current = telemetry;
      if (!startedSessions.has(session.session_id)) {
        startedSessions.add(session.session_id);
        quietDiscoverCapture(telemetry, {
          event_name: 'session_started',
          surface: 'app_boot',
          source_surface: null,
          properties: {
            session_number: session.session_number,
            is_return_session: session.is_return_session,
            prior_session_ended_at: null,
            entry_route: '/discover',
          },
        });
      }

      const [feed, saved] = await Promise.all([
        service.ensureFeed(session.session_id),
        service.readSavedProducts(),
      ]);
      if (!active || generation !== requestGeneration.current) return;
      dispatch({ type: 'SAVED_READY', items: saved });
      const restoration = readDiscoverRestoration();
      const restoring =
        restoration?.feedInstanceId === feed.feed_instance_id &&
        restoration.feedOrderVersion === feed.feed_order_version &&
        restoration.requestCursors.length > 0;
      if (restoration && !restoring) {
        clearDiscoverRestoration();
        quietDiscoverCapture(telemetry, {
          event_name: 'app_state_restore_failed',
          surface: 'discover',
          source_surface: null,
          properties: {
            error_class: 'validation',
            error_code: 'feed_instance_mismatch',
            fallback_applied: true,
          },
        });
      }
      dispatch({ type: 'FEED_READY', feed, restoring });

      let products: DiscoverProduct[] = [];
      const requestCursors = restoring
        ? restoration.requestCursors
        : feed.is_exhausted
          ? []
          : [feed.max_loaded_position === 0 ? null : feed.last_cursor];

      for (const requestCursor of requestCursors) {
        if (!active || generation !== requestGeneration.current) return;
        const startedAt = performance.now();
        const batchNumber = products.at(-1)?.batch_number
          ? (products.at(-1)?.batch_number ?? 0) + 1
          : 1;
        quietDiscoverCapture(telemetry, {
          event_name: 'feed_batch_requested',
          surface: 'discover',
          source_surface: null,
          properties: {
            feed_instance_id: feed.feed_instance_id,
            batch_number: batchNumber,
            cursor_hash: cursorHash(requestCursor),
            requested_count: 24,
          },
        });
        const batch = await service.loadBatch({
          feedInstanceId: feed.feed_instance_id,
          cursor: requestCursor,
          existingProducts: products,
          allowPartialStart: !restoring && feed.max_loaded_position > 0,
        });
        if (!active || generation !== requestGeneration.current) return;
        products = [...products, ...batch.products];
        dispatch({ type: 'BATCH_READY', batch, requestCursor });
        quietDiscoverCapture(telemetry, {
          event_name: 'feed_batch_loaded',
          surface: 'discover',
          source_surface: null,
          properties: {
            feed_instance_id: feed.feed_instance_id,
            batch_number: batch.batch_number,
            returned_count: batch.returned_count,
            latency_ms: Math.max(0, Math.round(performance.now() - startedAt)),
            is_terminal: batch.is_exhausted,
          },
        });
      }

      setCoordinator(
        new QualifiedImpressionCoordinator(
          service,
          telemetry,
          {
            sessionId: session.session_id,
            feedInstanceId: feed.feed_instance_id,
            feedOrderVersion: feed.feed_order_version,
          },
          (productId) => Boolean(stateRef.current.savedProducts[productId]),
        ),
      );

      if (!viewedFeeds.has(feed.feed_instance_id)) {
        viewedFeeds.add(feed.feed_instance_id);
        quietDiscoverCapture(telemetry, {
          event_name: 'discover_viewed',
          surface: 'discover',
          source_surface: null,
          properties: {
            feed_instance_id: feed.feed_instance_id,
            feed_order_version: feed.feed_order_version,
            entry_reason: restoring ? 'restored' : 'onboarding_terminal',
          },
        });
      }
      if (restoring) {
        quietDiscoverCapture(telemetry, {
          event_name: 'app_state_restored',
          surface: 'discover',
          source_surface: null,
          properties: {
            restore_result: 'exact',
            restored_entities: ['feed_instance', 'loaded_batches', 'scroll'],
            state_revision: restoration.requestCursors.length,
          },
        });
        requestAnimationFrame(() => {
          window.scrollTo({ top: restoration.scrollY, behavior: 'auto' });
        });
      }
      if (feed.is_exhausted) {
        quietDiscoverCapture(telemetry, {
          event_name: 'feed_exhausted',
          surface: 'discover',
          source_surface: null,
          properties: {
            feed_instance_id: feed.feed_instance_id,
            max_qualified_position: feed.max_qualified_position,
          },
        });
      }
    };

    void run().catch((error: unknown) => {
      if (!active || generation !== requestGeneration.current) return;
      dispatch({ type: 'INITIAL_ERROR', error: asDiscoverError(error) });
    });
    return () => {
      active = false;
    };
  }, [attempt, forcedTelemetry, identityId, service]);

  useEffect(() => {
    const save = () => persistRestoration();
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
    };
  }, [persistRestoration]);

  useEffect(() => {
    if (state.feed && state.requestCursors.length > 0) persistRestoration();
  }, [persistRestoration, state.feed, state.requestCursors]);

  useEffect(() => {
    if (!undoProduct) {
      undoRemainingMs.current = 5000;
      return;
    }
    if (undoTimerPaused) return;
    const startedAt = performance.now();
    const remaining = undoRemainingMs.current;
    const timer = window.setTimeout(() => {
      undoRemainingMs.current = 0;
      setUndoProduct(null);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      undoRemainingMs.current = Math.max(
        0,
        remaining - (performance.now() - startedAt),
      );
    };
  }, [undoProduct, undoTimerPaused]);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (
      (current.status !== 'ready' &&
        current.status !== 'recoverable_pagination_error') ||
      !current.feed ||
      !current.session ||
      current.cursor === null
    ) {
      return;
    }
    const requestKey = `${current.feed.feed_instance_id}:${current.cursor}`;
    if (paginationKey.current === requestKey) return;
    paginationKey.current = requestKey;
    dispatch({ type: 'LOAD_MORE' });
    const telemetry = telemetryRef.current;
    const expectedBatch = (current.products.at(-1)?.batch_number ?? 0) + 1;
    const startedAt = performance.now();
    if (telemetry) {
      quietDiscoverCapture(telemetry, {
        event_name: 'feed_batch_requested',
        surface: 'discover',
        source_surface: null,
        properties: {
          feed_instance_id: current.feed.feed_instance_id,
          batch_number: expectedBatch,
          cursor_hash: cursorHash(current.cursor),
          requested_count: 24,
        },
      });
    }
    try {
      const batch = await service.loadBatch({
        feedInstanceId: current.feed.feed_instance_id,
        cursor: current.cursor,
        existingProducts: current.products,
      });
      if (
        stateRef.current.feed?.feed_instance_id !==
          current.feed.feed_instance_id ||
        stateRef.current.cursor !== current.cursor
      ) {
        return;
      }
      dispatch({
        type: 'BATCH_READY',
        batch,
        requestCursor: current.cursor,
      });
      if (telemetry) {
        quietDiscoverCapture(telemetry, {
          event_name: 'feed_batch_loaded',
          surface: 'discover',
          source_surface: null,
          properties: {
            feed_instance_id: current.feed.feed_instance_id,
            batch_number: batch.batch_number,
            returned_count: batch.returned_count,
            latency_ms: Math.max(0, Math.round(performance.now() - startedAt)),
            is_terminal: batch.is_exhausted,
          },
        });
        if (batch.is_exhausted) {
          quietDiscoverCapture(telemetry, {
            event_name: 'feed_exhausted',
            surface: 'discover',
            source_surface: null,
            properties: {
              feed_instance_id: current.feed.feed_instance_id,
              max_qualified_position: current.feed.max_qualified_position,
            },
          });
        }
      }
    } catch (error) {
      const mapped = asDiscoverError(error);
      dispatch({ type: 'PAGINATION_ERROR', error: mapped });
      if (telemetry) {
        quietDiscoverCapture(telemetry, {
          event_name: 'feed_batch_failed',
          surface: 'discover',
          source_surface: null,
          properties: {
            feed_instance_id: current.feed.feed_instance_id,
            batch_number: expectedBatch,
            error_class: mapped.retryable ? 'network' : 'schema',
            error_code: mapped.code,
            retryable: mapped.retryable,
          },
        });
      }
    } finally {
      if (paginationKey.current === requestKey) {
        paginationKey.current = null;
      }
    }
  }, [service]);

  const sentinelRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) void loadMore();
        },
        { rootMargin: '200% 0px' },
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [loadMore],
  );

  const toggleSave = useCallback(
    async (product: DiscoverProduct) => {
      const current = stateRef.current;
      const priorSavedId = current.savedProducts[product.product_id];
      const priorTask = saveTasks[product.product_id];
      if (priorTask?.busy) return;
      const action = priorSavedId ? 'remove' : 'save';
      const operationId =
        priorTask?.action === action
          ? priorTask.operationId
          : globalThis.crypto.randomUUID();
      setSaveTasks((tasks) => ({
        ...tasks,
        [product.product_id]: {
          action,
          operationId,
          busy: true,
          error: false,
        },
      }));
      const telemetry = telemetryRef.current;
      if (telemetry) {
        quietDiscoverCapture(telemetry, {
          event_name:
            action === 'save'
              ? 'product_save_requested'
              : 'product_remove_requested',
          surface: 'discover',
          source_surface: 'discover',
          properties:
            action === 'save'
              ? {
                  product_id: product.product_id,
                  source_surface: 'discover',
                  prior_saved_state: false,
                  operation_id: operationId,
                }
              : {
                  product_id: product.product_id,
                  source_surface: 'discover',
                  prior_saved_state: true,
                  operation_id: operationId,
                  challenge_impact: 'canonical_rpc_resolution',
                },
        });
      }
      try {
        if (action === 'save') {
          const result = await service.saveProduct(
            product.product_id,
            operationId,
          );
          dispatch({
            type: 'SAVE_READY',
            productId: product.product_id,
            savedProductId: result.data.saved_product_id,
          });
          if (telemetry) {
            quietDiscoverCapture(telemetry, {
              event_name: 'product_saved',
              surface: 'discover',
              source_surface: 'discover',
              properties: {
                product_id: product.product_id,
                product_category: product.category,
                source_surface: 'discover',
                operation_id: operationId,
                saved_product_id: result.data.saved_product_id,
              },
            });
          }
        } else if (priorSavedId) {
          await service.removeProduct(priorSavedId, operationId);
          dispatch({ type: 'REMOVE_READY', productId: product.product_id });
          undoRemainingMs.current = 5000;
          setUndoTimerPaused(false);
          setUndoProduct(product);
          if (telemetry) {
            quietDiscoverCapture(telemetry, {
              event_name: 'product_removed',
              surface: 'discover',
              source_surface: 'discover',
              properties: {
                product_id: product.product_id,
                source_surface: 'discover',
                operation_id: operationId,
                challenge_resolution: 'canonical_rpc_resolution',
              },
            });
          }
        }
        setSaveTasks((tasks) => {
          const next = { ...tasks };
          delete next[product.product_id];
          return next;
        });
      } catch (error) {
        const retryable =
          error instanceof DiscoverError
            ? error.retryable
            : error instanceof TelemetryError
              ? error.retryable
              : true;
        setSaveTasks((tasks) => ({
          ...tasks,
          [product.product_id]: {
            action,
            operationId,
            busy: false,
            error: true,
          },
        }));
        if (telemetry) {
          quietDiscoverCapture(telemetry, {
            event_name: 'product_save_failed',
            surface: 'discover',
            source_surface: 'discover',
            properties: {
              product_id: product.product_id,
              attempted_action: action,
              operation_id: operationId,
              error_class: 'persistence',
              error_code:
                error instanceof DiscoverError
                  ? error.code
                  : 'transport_unavailable',
              retryable,
            },
          });
        }
      }
    },
    [saveTasks, service],
  );

  const undoRemove = useCallback(async () => {
    const product = undoProduct;
    if (!product) return;
    const operationId = globalThis.crypto.randomUUID();
    setSaveTasks((tasks) => ({
      ...tasks,
      [product.product_id]: {
        action: 'save',
        operationId,
        busy: true,
        error: false,
      },
    }));
    const telemetry = telemetryRef.current;
    if (telemetry) {
      quietDiscoverCapture(telemetry, {
        event_name: 'product_save_requested',
        surface: 'discover',
        source_surface: 'discover',
        properties: {
          product_id: product.product_id,
          source_surface: 'discover',
          prior_saved_state: false,
          operation_id: operationId,
        },
      });
    }
    try {
      const result = await service.saveProduct(product.product_id, operationId);
      dispatch({
        type: 'SAVE_READY',
        productId: product.product_id,
        savedProductId: result.data.saved_product_id,
      });
      setUndoTimerPaused(false);
      setUndoProduct(null);
      setSaveTasks((tasks) => {
        const next = { ...tasks };
        delete next[product.product_id];
        return next;
      });
      if (telemetry) {
        quietDiscoverCapture(telemetry, {
          event_name: 'product_saved',
          surface: 'discover',
          source_surface: 'discover',
          properties: {
            product_id: product.product_id,
            product_category: product.category,
            source_surface: 'discover',
            operation_id: operationId,
            saved_product_id: result.data.saved_product_id,
          },
        });
      }
    } catch (error) {
      setSaveTasks((tasks) => ({
        ...tasks,
        [product.product_id]: {
          action: 'save',
          operationId,
          busy: false,
          error: true,
        },
      }));
      if (telemetry) {
        quietDiscoverCapture(telemetry, {
          event_name: 'product_save_failed',
          surface: 'discover',
          source_surface: 'discover',
          properties: {
            product_id: product.product_id,
            attempted_action: 'save',
            operation_id: operationId,
            error_class: 'persistence',
            error_code:
              error instanceof DiscoverError
                ? error.code
                : 'transport_unavailable',
            retryable:
              error instanceof DiscoverError
                ? error.retryable
                : error instanceof TelemetryError
                  ? error.retryable
                  : true,
          },
        });
      }
    }
  }, [service, undoProduct]);

  const initialLoading = [
    'idle',
    'resolving_session',
    'resolving_feed',
    'restoring',
    'loading_initial',
  ].includes(state.status);

  return (
    <article className={styles.discover}>
      <header className={styles.header}>
        <Text role="micro" className={styles.eyebrow}>
          LR-001 · deterministic catalog
        </Text>
        <Heading as="h1" role="display-lg">
          Discover
        </Heading>
        <Text className={styles.introduction}>
          Explore pieces at your own pace. Save what you want to revisit.
        </Text>
      </header>

      {initialLoading ? <FeedSkeleton /> : null}

      {state.status === 'recoverable_initial_error' ? (
        <StateMessage
          alert
          title="We couldn’t load your feed."
          body="Your saved pieces and feed state have not been changed."
        >
          <Button onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
          <Link href="/wardrobe" className={styles.secondaryAction}>
            Open Wardrobe
          </Link>
        </StateMessage>
      ) : null}

      {state.status === 'unrecoverable_error' ? (
        <StateMessage
          alert
          title="This feed can’t open yet."
          body="The returned feed data is not compatible with this build. Your saved pieces are unchanged."
        >
          <Link href="/wardrobe" className={styles.secondaryAction}>
            Open Wardrobe
          </Link>
        </StateMessage>
      ) : null}

      {!initialLoading &&
      state.products.length === 0 &&
      state.status === 'exhausted' ? (
        <StateMessage
          title="Nothing to show yet."
          body="The feed is unavailable right now. Your saved pieces are still here."
        >
          <Button onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
          {Object.keys(state.savedProducts).length > 0 ? (
            <Link href="/wardrobe" className={styles.secondaryAction}>
              Open Wardrobe
            </Link>
          ) : null}
        </StateMessage>
      ) : null}

      {state.products.length > 0 ? (
        <ul className={styles.productGrid} aria-label="Discover products">
          {state.products.map((product) => {
            const task = saveTasks[product.product_id];
            const canonicalSaved = Boolean(
              state.savedProducts[product.product_id],
            );
            const saved = task?.busy ? task.action === 'save' : canonicalSaved;
            return (
              <ProductCard
                key={product.product_id}
                product={product}
                save={{
                  saved,
                  busy: task?.busy ?? false,
                  error: task?.error ?? false,
                }}
                onSave={() => void toggleSave(product)}
                onNavigate={() => persistRestoration(product)}
                coordinator={coordinator}
              />
            );
          })}
        </ul>
      ) : null}

      {state.status === 'loading_more' ? (
        <div className={styles.paginationStatus}>
          <FeedSkeleton count={4} />
        </div>
      ) : null}

      {state.status === 'recoverable_pagination_error' ? (
        <StateMessage
          alert
          title="More pieces didn’t load."
          body="Everything already loaded is still here."
        >
          <Button onClick={() => void loadMore()}>Try again</Button>
        </StateMessage>
      ) : null}

      {state.status === 'ready' ? (
        <div ref={sentinelRef} className={styles.paginationBoundary}>
          <Button onClick={() => void loadMore()}>Load more products</Button>
        </div>
      ) : null}

      {state.status === 'exhausted' && state.products.length > 0 ? (
        <StateMessage
          title="You’ve reached the end for now."
          body="Come back to continue exploring."
        >
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to top
          </Button>
          <Link href="/wardrobe" className={styles.secondaryAction}>
            Open Wardrobe
          </Link>
        </StateMessage>
      ) : null}

      {undoProduct ? (
        <div
          className={styles.undoToast}
          role="status"
          aria-live="polite"
          onFocusCapture={() => setUndoTimerPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setUndoTimerPaused(false);
            }
          }}
        >
          <span>Removed from Wardrobe.</span>
          <button type="button" onClick={() => void undoRemove()}>
            Undo
          </button>
        </div>
      ) : null}

      <VisuallyHidden aria-live="polite">
        {Object.values(saveTasks).some((task) => task.busy)
          ? 'Updating your Wardrobe.'
          : ''}
      </VisuallyHidden>
    </article>
  );
}
