'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Button,
  Heading,
  Text,
  VisuallyHidden,
} from '@/components/design-system/primitives';
import { getSessionCandidateId } from '@/features/discover/storage';
import { useAnonymousIdentity } from '@/features/identity/identity-provider';

import type { ChallengeService } from './service';
import { createBrowserChallengeService } from './supabase';
import {
  createBrowserChallengeTelemetry,
  quietChallengeCapture,
  type ChallengeTelemetry,
} from './telemetry';
import {
  CHALLENGE_ID,
  ChallengeError,
  type CatalogProduct,
  type CatalogSlotId,
  type ChallengeSnapshot,
  type ChallengeViewState,
  type MutationTask,
} from './types';
import styles from './challenge.module.css';

const viewedIds = new Set<string>();
const startedSessions = new Set<string>();

function errorFrom(value: unknown) {
  return value instanceof ChallengeError
    ? value
    : new ChallengeError(
        'transport_unavailable',
        true,
        'The Challenge service is temporarily unavailable.',
        { cause: value },
      );
}

function loadingState() {
  return (
    <section className={styles.loading} role="status" aria-live="polite">
      <VisuallyHidden>Loading the Challenge</VisuallyHidden>
      <div className={styles.heroSkeleton} aria-hidden="true" />
      <div className={styles.slotGrid} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.slotSkeleton} key={index} />
        ))}
      </div>
    </section>
  );
}

export function ChallengeExperience({
  forcedService,
  forcedTelemetry,
}: {
  forcedService?: ChallengeService;
  forcedTelemetry?: ChallengeTelemetry;
} = {}) {
  const identity = useAnonymousIdentity();
  const identityId =
    identity.state.status === 'ready' ? identity.state.anonymousUserId : null;
  const identityStatus = identity.state.status;
  const service = useMemo(
    () => forcedService ?? createBrowserChallengeService(),
    [forcedService],
  );
  const [state, setState] = useState<ChallengeViewState>({
    status: 'resolving_identity',
  });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState<{
    slotId: CatalogSlotId;
    status: 'loading' | 'ready' | 'empty' | 'error';
    products: CatalogProduct[];
  } | null>(null);
  const [tasks, setTasks] = useState<Record<string, MutationTask>>({});
  const stateRef = useRef(state);
  const requestVersion = useRef(0);
  const mutationLocks = useRef(new Set<string>());
  const telemetry = useRef<ChallengeTelemetry | null>(forcedTelemetry ?? null);
  const pageViewId = useRef(globalThis.crypto.randomUUID());
  const slotRefs = useRef(new Map<CatalogSlotId, HTMLButtonElement>());
  const noticeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(
    async (id: string, announce?: string) => {
      const version = ++requestVersion.current;
      service.invalidate(id, CHALLENGE_ID);
      await Promise.resolve();
      setState({ status: 'loading' });
      const platform = window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
      const session = await service.ensureSession({
        sessionId: getSessionCandidateId(),
        appVersion: '0.1.0',
        platform,
      });
      const snapshot = await service.recover(id, CHALLENGE_ID);
      if (version !== requestVersion.current) return;
      telemetry.current =
        forcedTelemetry ??
        createBrowserChallengeTelemetry(session.session_id, platform);
      if (!startedSessions.has(session.session_id)) {
        startedSessions.add(session.session_id);
        quietChallengeCapture(telemetry.current, {
          event_name: 'session_started',
          surface: 'app_boot',
          source_surface: null,
          properties: {
            session_number: session.session_number,
            is_return_session: session.is_return_session,
            prior_session_ended_at: null,
            entry_route: '/challenge',
          },
        });
      }
      if (!viewedIds.has(pageViewId.current)) {
        viewedIds.add(pageViewId.current);
        quietChallengeCapture(telemetry.current, {
          event_name: 'challenge_viewed',
          surface: 'challenge',
          source_surface: null,
          properties: {
            challenge_id: snapshot.definition.id,
            challenge_version: snapshot.definition.version,
            challenge_state: snapshot.progress?.status ?? 'not_started',
            filled_slot_count: snapshot.selections.length,
            required_slot_count: snapshot.definition.required_slots.length,
          },
        });
      }
      setTasks({});
      setState({
        status: snapshot.progress
          ? snapshot.progress.status === 'completed'
            ? 'completed'
            : 'active'
          : 'unstarted',
        snapshot,
      });
      if (announce) {
        setNotice(announce);
        requestAnimationFrame(() => noticeRef.current?.focus());
      }
    },
    [forcedTelemetry, service],
  );

  useEffect(() => {
    if (identityStatus === 'loading') return;
    if (!identityId) return;
    const locks = mutationLocks.current;
    void Promise.resolve()
      .then(() => load(identityId))
      .catch((error: unknown) => {
        const mapped = errorFrom(error);
        setState({
          status: mapped.retryable
            ? 'recoverable_load_error'
            : 'contract_error',
          error: mapped,
        });
      });
    return () => {
      requestVersion.current += 1;
      locks.clear();
    };
  }, [attempt, identityId, identityStatus, load]);

  const snapshot =
    'snapshot' in state ? (state.snapshot as ChallengeSnapshot) : null;

  const runMutation = useCallback(
    async (
      key: string,
      action: 'start' | 'select' | 'remove' | 'complete',
      perform: (task: MutationTask) => Promise<unknown>,
      successEvent?: (task: MutationTask, result: unknown) => void,
    ) => {
      if (!identityId || mutationLocks.current.has(key)) return;
      const existing = tasks[key];
      const revision = snapshot?.progress?.state_revision ?? 0;
      const task =
        existing?.error && existing.expectedRevision === revision
          ? existing
          : {
              operationId: globalThis.crypto.randomUUID(),
              expectedRevision: revision,
              busy: false,
              error: null,
            };
      mutationLocks.current.add(key);
      const version = requestVersion.current;
      setTasks((current) => ({
        ...current,
        [key]: { ...task, busy: true, error: null },
      }));
      if (snapshot) {
        setState({
          status:
            action === 'select'
              ? 'selecting'
              : action === 'remove'
                ? 'removing'
                : action === 'complete'
                  ? 'completing'
                  : state.status,
          snapshot,
        } as ChallengeViewState);
      }
      try {
        const result = await perform(task);
        if (version !== requestVersion.current) return;
        successEvent?.(task, result);
        await load(identityId);
      } catch (value: unknown) {
        if (version !== requestVersion.current) return;
        const error = errorFrom(value);
        quietChallengeCapture(telemetry.current, {
          event_name: 'challenge_operation_failed',
          surface: 'challenge',
          source_surface: 'challenge',
          properties: {
            challenge_id: CHALLENGE_ID,
            attempted_action: action,
            operation_id: task.operationId,
            error_class:
              error.code === 'revision_mismatch' ||
              error.code === 'operation_conflict'
                ? 'conflict'
                : error.code === 'contract_invalid'
                  ? 'schema'
                  : 'persistence',
            error_code: error.code,
            retryable: error.retryable,
          },
        });
        if (error.code === 'revision_mismatch') {
          await load(
            identityId,
            'The Challenge changed elsewhere, so we refreshed it.',
          );
        } else {
          setTasks((current) => ({
            ...current,
            [key]: { ...task, busy: false, error },
          }));
          if (snapshot) {
            setState({
              status:
                snapshot.progress?.status === 'completed'
                  ? 'completed'
                  : snapshot.progress
                    ? 'active'
                    : 'unstarted',
              snapshot,
            });
          }
        }
      } finally {
        mutationLocks.current.delete(key);
      }
    },
    [identityId, load, snapshot, state.status, tasks],
  );

  const start = () => {
    void runMutation(
      'start',
      'start',
      (task) => service.start(CHALLENGE_ID, task.operationId),
      (task) => {
        if (!snapshot) return;
        quietChallengeCapture(telemetry.current, {
          event_name: 'challenge_started',
          surface: 'challenge',
          source_surface: 'challenge',
          properties: {
            challenge_id: snapshot.definition.id,
            challenge_version: snapshot.definition.version,
            eligible_saved_count: snapshot.wardrobeProductIds.size,
            required_slot_count: snapshot.definition.required_slots.length,
            operation_id: task.operationId,
          },
        });
      },
    );
  };

  const openPicker = async (slotId: CatalogSlotId) => {
    if (!snapshot || snapshot.progress?.status === 'completed') return;
    const version = ++requestVersion.current;
    setPicker({ slotId, status: 'loading', products: [] });
    try {
      const page = await service.listProducts(snapshot.definition.id, slotId);
      if (version !== requestVersion.current) return;
      const products = page.items.filter((product) =>
        snapshot.wardrobeProductIds.has(product.id),
      );
      setPicker({
        slotId,
        status: products.length ? 'ready' : 'empty',
        products,
      });
      quietChallengeCapture(telemetry.current, {
        event_name: 'challenge_slot_opened',
        surface: 'challenge_picker',
        source_surface: 'challenge',
        properties: {
          challenge_id: snapshot.definition.id,
          slot_id: slotId,
          eligible_item_count: products.length,
          slot_state: snapshot.selections.some(
            (selection) => selection.slotId === slotId,
          )
            ? 'selected'
            : 'empty',
        },
      });
    } catch {
      if (version === requestVersion.current) {
        setPicker({ slotId, status: 'error', products: [] });
      }
    }
  };

  const closePicker = () => {
    const slotId = picker?.slotId;
    requestVersion.current += 1;
    setPicker(null);
    requestAnimationFrame(() => {
      if (slotId) slotRefs.current.get(slotId)?.focus();
    });
  };

  const select = (product: CatalogProduct) => {
    if (!picker || !snapshot?.progress) return;
    const slotId = picker.slotId;
    const prior = snapshot.selections.find(
      (selection) => selection.slotId === slotId,
    );
    const key = `select:${slotId}`;
    closePicker();
    void runMutation(
      key,
      'select',
      (task) =>
        service.select({
          progressId: snapshot.progress!.id,
          slotId,
          productId: product.id,
          expectedRevision: task.expectedRevision,
          operationId: task.operationId,
        }),
      (task) =>
        quietChallengeCapture(telemetry.current, {
          event_name: 'challenge_item_selected',
          surface: 'challenge',
          source_surface: 'challenge_picker',
          properties: {
            challenge_id: snapshot.definition.id,
            slot_id: slotId,
            product_id: product.id,
            operation_id: task.operationId,
            replaced_product_id: prior?.productId ?? null,
          },
        }),
    );
  };

  const remove = (slotId: CatalogSlotId) => {
    const selected = snapshot?.selections.find(
      (selection) => selection.slotId === slotId,
    );
    if (!selected || !snapshot?.progress) return;
    void runMutation(
      `remove:${selected.progressItemId}`,
      'remove',
      (task) =>
        service.remove({
          progressItemId: selected.progressItemId,
          expectedRevision: task.expectedRevision,
          operationId: task.operationId,
        }),
      (task) =>
        quietChallengeCapture(telemetry.current, {
          event_name: 'challenge_item_removed',
          surface: 'challenge',
          source_surface: 'challenge',
          properties: {
            challenge_id: snapshot.definition.id,
            slot_id: slotId,
            product_id: selected.productId,
            operation_id: task.operationId,
            removal_reason: 'user_removed',
          },
        }),
    );
  };

  const complete = () => {
    if (!snapshot?.progress) return;
    const valid =
      snapshot.progress.status === 'ready_to_complete' &&
      snapshot.selections.length === snapshot.definition.required_slots.length;
    quietChallengeCapture(telemetry.current, {
      event_name: 'challenge_completion_attempted',
      surface: 'challenge',
      source_surface: 'challenge',
      properties: {
        challenge_id: snapshot.definition.id,
        valid_slot_count: snapshot.selections.length,
        required_slot_count: snapshot.definition.required_slots.length,
        is_valid: valid,
      },
    });
    if (!valid) return;
    void runMutation(
      'complete',
      'complete',
      (task) =>
        service.complete({
          progressId: snapshot.progress!.id,
          expectedRevision: task.expectedRevision,
          operationId: task.operationId,
        }),
      (task, result) => {
        const response = result as {
          data: { challenge_completion_id: string };
        };
        quietChallengeCapture(telemetry.current, {
          event_name: 'challenge_completed',
          surface: 'challenge',
          source_surface: 'challenge',
          properties: {
            challenge_id: snapshot.definition.id,
            challenge_version: snapshot.definition.version,
            completion_id: response.data.challenge_completion_id,
            selected_product_ids_by_slot: Object.fromEntries(
              snapshot.selections.map((selection) => [
                selection.slotId,
                selection.productId,
              ]),
            ),
            duration_since_start_ms: Math.max(
              0,
              Date.now() - new Date(snapshot.progress!.started_at).getTime(),
            ),
            operation_id: task.operationId,
          },
        });
      },
    );
  };

  if (
    state.status === 'resolving_identity' ||
    identity.state.status === 'loading' ||
    state.status === 'loading'
  ) {
    return <main className={styles.page}>{loadingState()}</main>;
  }

  if (identity.state.status === 'recoverable_error') {
    return (
      <main className={styles.page}>
        <ErrorPanel
          title="We couldn’t identify this session."
          body="Your Challenge has not been changed."
          onRetry={identity.retry}
        />
      </main>
    );
  }

  if (
    state.status === 'recoverable_load_error' ||
    state.status === 'contract_error'
  ) {
    return (
      <main className={styles.page}>
        <ErrorPanel
          title="We couldn’t open the Challenge."
          body={
            state.status === 'recoverable_load_error'
              ? 'Your saved progress has not been changed.'
              : state.error.code === 'inactive_product'
                ? 'A selected piece is no longer available. Your Challenge has not been changed.'
                : 'This build cannot safely display the current Challenge.'
          }
          onRetry={
            state.status === 'recoverable_load_error'
              ? () => setAttempt((value) => value + 1)
              : undefined
          }
        />
      </main>
    );
  }

  if (!snapshot) return null;
  const orderedSlots = [...snapshot.definition.required_slots].sort(
    (left, right) => left.display_order - right.display_order,
  );
  const completed = state.status === 'completed';
  const remaining = orderedSlots.length - snapshot.selections.length;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <Text role="label" className={styles.eyebrow}>
          Outfit Challenge
        </Text>
        <Heading as="h1" role="display-lg">
          {completed ? 'Look complete.' : snapshot.definition.title}
        </Heading>
        <Text role="body-lg">{snapshot.definition.context_copy}</Text>
        <Text role="body-sm" className={styles.progress}>
          {snapshot.selections.length} of {orderedSlots.length} pieces
          {completed ? ' · Completed' : ''}
        </Text>
      </header>

      {notice ? (
        <div
          className={styles.notice}
          role="alert"
          tabIndex={-1}
          ref={noticeRef}
        >
          {notice}
        </div>
      ) : null}

      {state.status === 'unstarted' ? (
        <section className={styles.intro}>
          <Heading as="h2" role="heading-lg">
            Choose four saved pieces.
          </Heading>
          <Text>
            Fill every required slot, then explicitly complete your look.
          </Text>
          {snapshot.wardrobeProductIds.size === 0 ? (
            <Link href="/discover" className={styles.primaryLink}>
              Explore pieces
            </Link>
          ) : (
            <Button
              onClick={start}
              disabled={tasks.start?.busy}
              aria-busy={tasks.start?.busy}
            >
              {tasks.start?.busy ? 'Starting…' : 'Start challenge'}
            </Button>
          )}
          {tasks.start?.error ? (
            <MutationError task={tasks.start} retry={start} />
          ) : null}
        </section>
      ) : (
        <>
          <section aria-labelledby="required-slots-heading">
            <Heading
              as="h2"
              role="heading-lg"
              id="required-slots-heading"
              className={styles.sectionHeading}
            >
              {completed ? 'Your completed look' : 'Required pieces'}
            </Heading>
            <ul className={styles.slotGrid}>
              {orderedSlots.map((slot) => {
                const selected = snapshot.selections.find(
                  (selection) => selection.slotId === slot.slot_id,
                );
                const task =
                  tasks[`select:${slot.slot_id}`] ??
                  (selected
                    ? tasks[`remove:${selected.progressItemId}`]
                    : undefined);
                return (
                  <li className={styles.slot} key={slot.slot_id}>
                    {selected ? (
                      <>
                        <Link
                          href={`/product/${selected.productId}?from=challenge`}
                          className={styles.productLink}
                        >
                          <span className={styles.imageWrap}>
                            <Image
                              src={
                                selected.product.image_metadata.images[
                                  selected.product.image_metadata.primary_index
                                ]?.url ?? selected.product.image_urls[0]
                              }
                              alt={
                                selected.product.image_metadata.images[
                                  selected.product.image_metadata.primary_index
                                ]?.alt ??
                                `${selected.product.brand} ${selected.product.name}, ${selected.product.category}.`
                              }
                              fill
                              sizes="(max-width: 767px) 100vw, 32rem"
                              className={styles.productImage}
                            />
                          </span>
                          <strong>{slot.label}</strong>
                          <span>{selected.product.name}</span>
                          <span className={styles.selectedText}>
                            {completed ? 'Completed selection' : 'Selected'}
                          </span>
                        </Link>
                        {!completed ? (
                          <div className={styles.slotActions}>
                            <button
                              ref={(node) => {
                                if (node)
                                  slotRefs.current.set(slot.slot_id, node);
                                else slotRefs.current.delete(slot.slot_id);
                              }}
                              type="button"
                              onClick={() => void openPicker(slot.slot_id)}
                              disabled={task?.busy}
                            >
                              Replace {slot.label}
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(slot.slot_id)}
                              disabled={task?.busy}
                            >
                              Remove {selected.product.name}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <button
                        ref={(node) => {
                          if (node) slotRefs.current.set(slot.slot_id, node);
                          else slotRefs.current.delete(slot.slot_id);
                        }}
                        type="button"
                        className={styles.emptySlot}
                        onClick={() => void openPicker(slot.slot_id)}
                        disabled={completed || task?.busy}
                        aria-label={`Add ${slot.label}, required`}
                      >
                        <span aria-hidden="true">+</span>
                        <strong>Add {slot.label}</strong>
                        <small>Required</small>
                      </button>
                    )}
                    {task?.busy ? (
                      <span className={styles.slotStatus} role="status">
                        Updating {slot.label}…
                      </span>
                    ) : null}
                    {task?.error ? (
                      <MutationError
                        task={task}
                        retry={() =>
                          selected
                            ? remove(slot.slot_id)
                            : void openPicker(slot.slot_id)
                        }
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {completed ? (
            <div className={styles.completedActions}>
              <Link href="/discover" className={styles.primaryLink}>
                Back to Discover
              </Link>
              <Link href="/wardrobe" className={styles.secondaryLink}>
                View Wardrobe
              </Link>
            </div>
          ) : (
            <section className={styles.completionBar}>
              <Text role="body-sm" id="completion-requirement">
                {remaining
                  ? `Add ${remaining} more ${remaining === 1 ? 'piece' : 'pieces'} to finish.`
                  : 'All four required pieces are ready.'}
              </Text>
              <Button
                onClick={complete}
                disabled={
                  remaining > 0 ||
                  snapshot.progress?.status !== 'ready_to_complete' ||
                  tasks.complete?.busy
                }
                aria-describedby="completion-requirement"
                aria-busy={tasks.complete?.busy}
              >
                {tasks.complete?.busy ? 'Completing…' : 'Complete look'}
              </Button>
              {tasks.complete?.error ? (
                <MutationError task={tasks.complete} retry={complete} />
              ) : null}
            </section>
          )}
        </>
      )}

      {picker ? (
        <div className={styles.scrim} role="presentation">
          <section
            className={styles.picker}
            role="dialog"
            aria-modal="true"
            aria-labelledby="picker-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closePicker();
            }}
          >
            <div className={styles.pickerHeader}>
              <Heading as="h2" role="heading-lg" id="picker-title">
                Choose a{' '}
                {
                  orderedSlots.find((slot) => slot.slot_id === picker.slotId)
                    ?.label
                }
              </Heading>
              <button type="button" onClick={closePicker} autoFocus>
                Close
              </button>
            </div>
            {picker.status === 'loading' ? (
              <p role="status">Loading eligible saved pieces…</p>
            ) : null}
            {picker.status === 'error' ? (
              <div role="alert">
                <p>We couldn’t load pieces for this slot.</p>
                <Button onClick={() => void openPicker(picker.slotId)}>
                  Try again
                </Button>
              </div>
            ) : null}
            {picker.status === 'empty' ? (
              <div className={styles.pickerEmpty}>
                <p>No saved pieces match this slot yet.</p>
                <Link
                  href={`/discover?slot=${picker.slotId}`}
                  onClick={() => {
                    quietChallengeCapture(telemetry.current, {
                      event_name: 'challenge_discovery_redirected',
                      surface: 'challenge_picker',
                      source_surface: 'challenge',
                      properties: {
                        challenge_id: snapshot.definition.id,
                        slot_id: picker.slotId,
                        required_category: picker.slotId,
                      },
                    });
                  }}
                >
                  Find matching pieces
                </Link>
              </div>
            ) : null}
            {picker.status === 'ready' ? (
              <ul className={styles.pickerList} aria-label="Eligible products">
                {picker.products.map((product) => {
                  const selected = snapshot.selections.some(
                    (selection) =>
                      selection.slotId === picker.slotId &&
                      selection.productId === product.id,
                  );
                  return (
                    <li key={product.id} className={styles.pickerRow}>
                      <button
                        type="button"
                        onClick={() => select(product)}
                        aria-pressed={selected}
                      >
                        <span>{product.name}</span>
                        <small>{product.category}</small>
                        <strong>{selected ? 'Selected' : 'Choose'}</strong>
                      </button>
                      <Link href={`/product/${product.id}?from=challenge`}>
                        View details
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function MutationError({
  task,
  retry,
}: {
  task: MutationTask;
  retry: () => void;
}) {
  return (
    <div className={styles.mutationError} role="alert">
      <span>
        {task.error?.code === 'operation_conflict'
          ? 'This action conflicts with an earlier request.'
          : task.error?.code === 'validation_mismatch'
            ? 'That piece no longer matches the Challenge.'
            : 'We couldn’t save that change.'}
      </span>
      {task.error?.retryable ? (
        <button type="button" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

function ErrorPanel({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <section className={styles.errorPanel} role="alert">
      <Heading as="h1" role="display-md">
        {title}
      </Heading>
      <Text>{body}</Text>
      {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
      <Link href="/discover" className={styles.secondaryLink}>
        Open Discover
      </Link>
    </section>
  );
}
