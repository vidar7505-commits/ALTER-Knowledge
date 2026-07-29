'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  Button,
  Heading,
  Text,
  VisuallyHidden,
} from '@/components/design-system/primitives';
import { getSessionCandidateId } from '@/features/discover/storage';
import { useAnonymousIdentity } from '@/features/identity/identity-provider';

import type { WardrobeService } from './service';
import { createBrowserWardrobeService } from './supabase';
import {
  createBrowserWardrobeTelemetry,
  quietWardrobeCapture,
  type WardrobeTelemetry,
} from './telemetry';
import {
  WardrobeError,
  type WardrobeItem,
  type WardrobeMutationTask,
  type WardrobeState,
} from './types';
import { WardrobeCard } from './wardrobe-card';
import styles from './wardrobe.module.css';

const viewedPageIds = new Set<string>();
const startedSessions = new Set<string>();

function asWardrobeError(error: unknown) {
  if (error instanceof WardrobeError) return error;
  return new WardrobeError(
    'transport_unavailable',
    true,
    'The Wardrobe service is temporarily unavailable.',
    { cause: error },
  );
}

function Skeleton() {
  return (
    <div
      className={styles.skeletonWrap}
      role="status"
      aria-live="polite"
      aria-label="Loading your Wardrobe"
    >
      <VisuallyHidden>Loading your Wardrobe</VisuallyHidden>
      <div className={styles.grid}>
        {Array.from({ length: 8 }, (_, index) => (
          <div className={styles.skeletonCard} aria-hidden="true" key={index}>
            <span className={styles.skeletonImage} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLineShort} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StateMessage({
  title,
  body,
  alert = false,
  headingRef,
  visual,
  children,
}: {
  title: string;
  body: string;
  alert?: boolean;
  headingRef?: React.Ref<HTMLHeadingElement>;
  visual?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={styles.stateMessage} role={alert ? 'alert' : undefined}>
      {visual}
      {headingRef ? (
        <h2 ref={headingRef} className={styles.stateHeading} tabIndex={-1}>
          {title}
        </h2>
      ) : (
        <Heading as="h2" role="heading-lg">
          {title}
        </Heading>
      )}
      <Text className={styles.stateBody}>{body}</Text>
      {children ? <div className={styles.stateActions}>{children}</div> : null}
    </section>
  );
}

export function WardrobeExperience({
  forcedService,
  forcedTelemetry,
}: {
  forcedService?: WardrobeService;
  forcedTelemetry?: WardrobeTelemetry;
} = {}) {
  const identity = useAnonymousIdentity();
  const identityId =
    identity.state.status === 'ready' ? identity.state.anonymousUserId : null;
  const service = useMemo(
    () => forcedService ?? createBrowserWardrobeService(),
    [forcedService],
  );
  const [state, setState] = useState<WardrobeState>({
    status: 'idle',
    items: [],
  });
  const [attempt, setAttempt] = useState(0);
  const [tasks, setTasks] = useState<Record<string, WardrobeMutationTask>>({});
  const [undoPaused, setUndoPaused] = useState(false);
  const telemetryRef = useRef<WardrobeTelemetry | null>(
    forcedTelemetry ?? null,
  );
  const pageViewId = useRef(globalThis.crypto.randomUUID());
  const requestVersion = useRef(0);
  const mounted = useRef(true);
  const mutationLocks = useRef(new Set<string>());
  const requestedTelemetry = useRef(new Set<string>());
  const undoRemaining = useRef(5000);
  const emptyHeadingRef = useRef<HTMLHeadingElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const stateRef = useRef(state);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const locks = mutationLocks.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      locks.clear();
    };
  }, []);

  useEffect(() => {
    if (!identityId) return;
    const version = ++requestVersion.current;
    let active = true;

    const run = async () => {
      await Promise.resolve();
      if (!active || version !== requestVersion.current) return;
      setState({ status: 'loading', items: [] });
      setTasks({});
      const platform = window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
      const session = await service.ensureSession({
        sessionId: getSessionCandidateId(),
        appVersion: '0.1.0',
        platform,
      });
      const items = await service.load(identityId);
      if (!active || version !== requestVersion.current) return;
      const telemetry =
        forcedTelemetry ??
        createBrowserWardrobeTelemetry(session.session_id, platform);
      telemetryRef.current = telemetry;

      if (!startedSessions.has(session.session_id)) {
        startedSessions.add(session.session_id);
        quietWardrobeCapture(telemetry, {
          event_name: 'session_started',
          surface: 'app_boot',
          source_surface: null,
          properties: {
            session_number: session.session_number,
            is_return_session: session.is_return_session,
            prior_session_ended_at: null,
            entry_route: '/wardrobe',
          },
        });
      }
      if (!viewedPageIds.has(pageViewId.current)) {
        viewedPageIds.add(pageViewId.current);
        quietWardrobeCapture(telemetry, {
          event_name: 'wardrobe_viewed',
          surface: 'wardrobe',
          source_surface: null,
          properties: {
            saved_product_count: items.length,
            entry_reason: 'primary_navigation',
            is_return_session: session.is_return_session,
          },
        });
        if (items.length === 0) {
          quietWardrobeCapture(telemetry, {
            event_name: 'wardrobe_empty_viewed',
            surface: 'wardrobe',
            source_surface: null,
            properties: { entry_reason: 'primary_navigation' },
          });
        }
      }
      setState(
        items.length > 0
          ? { status: 'ready', items }
          : { status: 'empty', items: [] },
      );
    };

    void run().catch((error: unknown) => {
      if (!active || version !== requestVersion.current) return;
      const mapped = asWardrobeError(error);
      setState({
        status: mapped.retryable ? 'recoverable_error' : 'unrecoverable_error',
        items: [],
        error: mapped,
      });
    });
    return () => {
      active = false;
    };
  }, [attempt, forcedTelemetry, identityId, service]);

  const focusAfterRemoval = useCallback(
    (items: WardrobeItem[], removedIndex: number) => {
      const target = items[removedIndex] ?? items[removedIndex - 1];
      requestAnimationFrame(() => {
        if (target) {
          cardRefs.current
            .get(target.productId)
            ?.querySelector<HTMLAnchorElement>('a')
            ?.focus();
        } else {
          emptyHeadingRef.current?.focus();
        }
      });
    },
    [],
  );

  const remove = useCallback(
    async (item: WardrobeItem) => {
      if (mutationLocks.current.has(item.productId)) return;
      const mutationVersion = requestVersion.current;
      const existing = tasks[item.productId];
      const operationId =
        existing?.action === 'remove' && existing.error
          ? existing.operationId
          : globalThis.crypto.randomUUID();
      mutationLocks.current.add(item.productId);
      setTasks((current) => ({
        ...current,
        [item.productId]: {
          action: 'remove',
          operationId,
          busy: true,
          error: false,
        },
      }));
      setState((current) => ({
        status: 'removing',
        items: current.items,
        productId: item.productId,
      }));
      const telemetry = telemetryRef.current;
      if (telemetry && !requestedTelemetry.current.has(operationId)) {
        requestedTelemetry.current.add(operationId);
        quietWardrobeCapture(telemetry, {
          event_name: 'product_remove_requested',
          surface: 'wardrobe',
          source_surface: 'wardrobe',
          properties: {
            product_id: item.productId,
            source_surface: 'wardrobe',
            prior_saved_state: true,
            operation_id: operationId,
            challenge_impact: 'none',
          },
        });
      }

      try {
        const result = await service.removeProduct(
          item.savedProductId,
          operationId,
        );
        if (!mounted.current || mutationVersion !== requestVersion.current)
          return;
        const currentItems = stateRef.current.items;
        const removedIndex = currentItems.findIndex(
          (candidate) => candidate.productId === item.productId,
        );
        const items = currentItems.filter(
          (candidate) => candidate.productId !== item.productId,
        );
        setTasks((current) => {
          const next = { ...current };
          delete next[item.productId];
          return next;
        });
        undoRemaining.current = 5000;
        setUndoPaused(false);
        setState({ status: 'undo_available', items, removedItem: item });
        if (telemetry) {
          quietWardrobeCapture(telemetry, {
            event_name: 'product_removed',
            surface: 'wardrobe',
            source_surface: 'wardrobe',
            properties: {
              product_id: result.data.product_id,
              source_surface: 'wardrobe',
              operation_id: operationId,
              challenge_resolution: 'none',
            },
          });
        }
        focusAfterRemoval(items, Math.max(0, removedIndex));
      } catch (error: unknown) {
        if (!mounted.current) return;
        setTasks((current) => ({
          ...current,
          [item.productId]: {
            action: 'remove',
            operationId,
            busy: false,
            error: true,
          },
        }));
        setState({ status: 'ready', items: stateRef.current.items });
        if (telemetry) {
          quietWardrobeCapture(telemetry, {
            event_name: 'product_save_failed',
            surface: 'wardrobe',
            source_surface: 'wardrobe',
            properties: {
              product_id: item.productId,
              attempted_action: 'remove',
              operation_id: operationId,
              error_class: 'persistence',
              error_code: asWardrobeError(error).code,
              retryable: asWardrobeError(error).retryable,
            },
          });
        }
      } finally {
        mutationLocks.current.delete(item.productId);
      }
    },
    [focusAfterRemoval, service, tasks],
  );

  const undo = useCallback(async () => {
    if (state.status !== 'undo_available') return;
    const item = state.removedItem;
    if (mutationLocks.current.has(item.productId)) return;
    const mutationVersion = requestVersion.current;
    const existing = tasks[item.productId];
    const operationId =
      existing?.action === 'undo'
        ? existing.operationId
        : globalThis.crypto.randomUUID();
    mutationLocks.current.add(item.productId);
    setUndoPaused(true);
    setTasks((current) => ({
      ...current,
      [item.productId]: {
        action: 'undo',
        operationId,
        busy: true,
        error: false,
      },
    }));
    const telemetry = telemetryRef.current;
    if (telemetry && !requestedTelemetry.current.has(operationId)) {
      requestedTelemetry.current.add(operationId);
      quietWardrobeCapture(telemetry, {
        event_name: 'product_save_requested',
        surface: 'wardrobe',
        source_surface: 'wardrobe',
        properties: {
          product_id: item.productId,
          source_surface: 'wardrobe',
          prior_saved_state: false,
          operation_id: operationId,
        },
      });
    }
    try {
      const result = await service.saveProduct(item.productId, operationId);
      if (
        !mounted.current ||
        mutationVersion !== requestVersion.current ||
        stateRef.current.status !== 'undo_available'
      )
        return;
      const restored = {
        ...item,
        savedProductId: result.data.saved_product_id,
        savedAt: result.data.saved_at,
      };
      const items = [restored, ...state.items].sort((left, right) => {
        const dateOrder = right.savedAt.localeCompare(left.savedAt);
        return (
          dateOrder || right.savedProductId.localeCompare(left.savedProductId)
        );
      });
      setTasks((current) => {
        const next = { ...current };
        delete next[item.productId];
        return next;
      });
      setState({ status: 'ready', items });
      if (telemetry) {
        quietWardrobeCapture(telemetry, {
          event_name: 'product_saved',
          surface: 'wardrobe',
          source_surface: 'wardrobe',
          properties: {
            product_id: item.productId,
            product_category: item.product?.category ?? 'unavailable',
            source_surface: 'wardrobe',
            operation_id: operationId,
            saved_product_id: result.data.saved_product_id,
          },
        });
      }
    } catch (error: unknown) {
      if (!mounted.current) return;
      setTasks((current) => ({
        ...current,
        [item.productId]: {
          action: 'undo',
          operationId,
          busy: false,
          error: true,
        },
      }));
      if (telemetry) {
        quietWardrobeCapture(telemetry, {
          event_name: 'product_save_failed',
          surface: 'wardrobe',
          source_surface: 'wardrobe',
          properties: {
            product_id: item.productId,
            attempted_action: 'save',
            operation_id: operationId,
            error_class: 'persistence',
            error_code: asWardrobeError(error).code,
            retryable: asWardrobeError(error).retryable,
          },
        });
      }
    } finally {
      mutationLocks.current.delete(item.productId);
    }
  }, [service, state, tasks]);

  useEffect(() => {
    if (state.status !== 'undo_available' || undoPaused) return;
    const started = performance.now();
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.status !== 'undo_available') return current;
        return current.items.length
          ? { status: 'ready', items: current.items }
          : { status: 'empty', items: [] };
      });
    }, undoRemaining.current);
    return () => {
      window.clearTimeout(timer);
      undoRemaining.current = Math.max(
        0,
        undoRemaining.current - (performance.now() - started),
      );
    };
  }, [state.status, undoPaused]);

  const items = state.items;
  const count = items.length;
  const undoTask =
    state.status === 'undo_available'
      ? tasks[state.removedItem.productId]
      : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Heading as="h1" role="display-md">
          Wardrobe
        </Heading>
        {state.status === 'loading' || state.status === 'idle' ? (
          <span className={styles.countSkeleton} aria-hidden="true" />
        ) : null}
        {state.status === 'ready' ||
        state.status === 'empty' ||
        state.status === 'removing' ||
        state.status === 'undo_available' ? (
          <Text role="body-sm" className={styles.count}>
            {count} saved
          </Text>
        ) : null}
      </header>

      {state.status === 'idle' || state.status === 'loading' ? (
        <Skeleton />
      ) : null}

      {state.status === 'recoverable_error' ? (
        <StateMessage
          title="We couldn’t load your Wardrobe."
          body="Your saved pieces have not been changed."
          alert
        >
          <Button
            onClick={() => {
              if (identityId) service.invalidate(identityId);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
          <Link href="/discover" className={styles.secondaryLink}>
            Open Discover
          </Link>
        </StateMessage>
      ) : null}

      {state.status === 'unrecoverable_error' ? (
        <StateMessage
          title="We couldn’t open your Wardrobe."
          body="This version can’t safely read the saved collection."
          alert
        >
          <Link href="/discover" className={styles.primaryLink}>
            Open Discover
          </Link>
        </StateMessage>
      ) : null}

      {state.status === 'empty' ||
      (state.status === 'undo_available' && items.length === 0) ? (
        <StateMessage
          title="Your Wardrobe starts here."
          body="Save pieces from Discover, then use them to build a look."
          headingRef={emptyHeadingRef}
          visual={
            <div className={styles.emptyVisual} aria-hidden="true">
              <Image
                src="/onboarding/welcome.png"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 34rem"
                className={styles.emptyImage}
                loading="eager"
              />
            </div>
          }
        >
          <Link href="/discover" className={styles.primaryLink}>
            Explore pieces
          </Link>
        </StateMessage>
      ) : null}

      {items.length > 0 ? (
        <ul className={styles.grid} aria-label="Saved products">
          {items.map((item) => (
            <WardrobeCard
              key={item.savedProductId}
              item={item}
              task={tasks[item.productId]}
              onRemove={() => void remove(item)}
              cardRef={(node) => {
                if (node) cardRefs.current.set(item.productId, node);
                else cardRefs.current.delete(item.productId);
              }}
            />
          ))}
        </ul>
      ) : null}

      {state.status === 'undo_available' ? (
        <div
          className={styles.undoToast}
          role="status"
          aria-live="polite"
          onFocusCapture={() => setUndoPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setUndoPaused(false);
            }
          }}
        >
          <div>
            <Text as="span" role="body-sm">
              Removed from Wardrobe.
            </Text>
            {undoTask?.error ? (
              <Text as="span" role="caption" className={styles.undoError}>
                We couldn&apos;t restore it. Try again.
              </Text>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.undoButton}
            aria-busy={undoTask?.busy ?? false}
            disabled={undoTask?.busy}
            onClick={() => void undo()}
          >
            {undoTask?.error ? 'Try again' : 'Undo'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
