'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  Heading,
  Text,
  VisuallyHidden,
} from '@/components/design-system/primitives';
import { useAnonymousIdentity } from '@/features/identity/identity-provider';

import { OnboardingService, type OnboardingSnapshot } from './service';
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  writeOnboardingDraft,
  type OnboardingDraft,
} from './storage';
import { createBrowserOnboardingService } from './supabase';
import {
  createBrowserOnboardingTelemetry,
  type OnboardingTelemetry,
} from './telemetry';
import {
  isTerminalOnboardingStatus,
  ONBOARDING_VERSION,
  OnboardingError,
  PREFERENCE_SET_VERSION,
  type OnboardingAction,
  type OnboardingPreference,
  type OnboardingStep,
} from './types';
import styles from './onboarding.module.css';

const routeByStep: Record<OnboardingStep, string> = {
  welcome: '/onboarding/welcome',
  style: '/onboarding/style',
  mood: '/onboarding/mood',
};

const pendingLoads = new Map<string, Promise<OnboardingSnapshot>>();

function preferenceImage(preference: OnboardingPreference) {
  const slug = preference.asset_id.split(':').at(-1)?.replaceAll('_', '-');
  return `/onboarding/${slug}.png`;
}

const viewedKeys = new Set<string>();

function quietCapture(
  telemetry: OnboardingTelemetry,
  event: Parameters<OnboardingTelemetry['capture']>[0],
) {
  void Promise.resolve()
    .then(() => telemetry.capture(event))
    .catch(() => undefined);
}

function useEntryData(
  service: OnboardingService,
  identityId: string | undefined,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<
    | { status: 'loading' }
    | { status: 'ready'; snapshot: OnboardingSnapshot }
    | { status: 'error'; error: OnboardingError }
  >({ status: 'loading' });

  useEffect(() => {
    if (!identityId) return;
    let active = true;
    const load =
      pendingLoads.get(identityId) ??
      service.load().finally(() => pendingLoads.delete(identityId));
    pendingLoads.set(identityId, load);
    void load
      .then((snapshot) => {
        if (active) setResult({ status: 'ready', snapshot });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResult({
          status: 'error',
          error:
            error instanceof OnboardingError
              ? error
              : new OnboardingError(
                  'query_unavailable',
                  true,
                  'We couldn’t restore your onboarding yet.',
                ),
        });
      });
    return () => {
      active = false;
    };
  }, [attempt, identityId, service]);

  const retry = useCallback(() => {
    setResult({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);
  return { result, retry };
}

function StatusScreen({
  kind,
  retry,
  scope = 'onboarding',
}: {
  kind: 'loading' | 'recoverable' | 'unrecoverable';
  retry?: () => void;
  scope?: 'identity' | 'onboarding';
}) {
  const loading = kind === 'loading';
  return (
    <main className={styles.statusScreen}>
      <div
        className={styles.statusCard}
        role={loading ? 'status' : 'alert'}
        aria-live={loading ? 'polite' : undefined}
      >
        <Text role="label" className={styles.wordmark}>
          A L T E R .
        </Text>
        <span className={styles.loadingMark} aria-hidden="true" />
        <Heading as="h1" role="display-md">
          {loading
            ? 'Finding your place'
            : kind === 'recoverable'
              ? scope === 'identity'
                ? 'We couldn’t restore your session.'
                : 'We couldn’t restore your choices.'
              : 'These choices can’t open yet.'}
        </Heading>
        <Text className={styles.supporting}>
          {loading
            ? 'Restoring your private onboarding state.'
            : kind === 'recoverable'
              ? scope === 'identity'
                ? 'Your saved activity has not been changed.'
                : 'Your saved choices have not been changed.'
              : 'The current preference set is incomplete or incompatible.'}
        </Text>
        {kind === 'recoverable' && retry ? (
          <Button onClick={retry}>Try again</Button>
        ) : null}
      </div>
    </main>
  );
}

function ChoiceCard({
  preference,
  selected,
  disabled,
  onToggle,
}: {
  preference: OnboardingPreference;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.choice}
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onToggle}
    >
      <Image
        src={preferenceImage(preference)}
        alt=""
        fill
        sizes={
          preference.preference_group === 'style'
            ? '(max-width: 767px) 50vw, 300px'
            : '(max-width: 767px) 100vw, 640px'
        }
        className={styles.choiceImage}
      />
      <span className={styles.choiceScrim} aria-hidden="true" />
      <span className={styles.choiceCopy}>
        <span className={styles.choiceLabel}>{preference.label}</span>
        {preference.description ? (
          <span className={styles.choiceDescription}>
            {preference.description}
          </span>
        ) : null}
        <span className={styles.selectedText}>
          {selected ? 'Selected' : 'Select'}
        </span>
      </span>
      {selected ? (
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function OnboardingExperience({
  forcedService,
  forcedTelemetry,
}: {
  forcedService?: OnboardingService;
  forcedTelemetry?: OnboardingTelemetry;
} = {}) {
  const router = useRouter();
  const identity = useAnonymousIdentity();
  const identityId =
    identity.state.status === 'ready'
      ? identity.state.anonymousUserId
      : undefined;
  const service = useMemo(
    () => forcedService ?? createBrowserOnboardingService(),
    [forcedService],
  );
  const telemetry = useMemo(
    () => forcedTelemetry ?? createBrowserOnboardingTelemetry(),
    [forcedTelemetry],
  );
  const { result, retry } = useEntryData(service, identityId);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [limitMessage, setLimitMessage] = useState('');
  const [submitting, setSubmitting] = useState<OnboardingAction | null>(null);
  const [mutationError, setMutationError] = useState<{
    action: OnboardingAction;
    error: OnboardingError;
  } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (identityId && result.status === 'ready' && !draft) {
      let active = true;
      const restored = readOnboardingDraft(identityId);
      const validIds = new Set(
        result.snapshot.preferences.map(
          (preference) => preference.preference_id,
        ),
      );
      const nextDraft = {
        ...restored,
        selectedPreferenceIds: restored.selectedPreferenceIds.filter((id) =>
          validIds.has(id),
        ),
      };
      queueMicrotask(() => {
        if (active) setDraft(nextDraft);
      });

      if (isTerminalOnboardingStatus(result.snapshot.state.status)) {
        clearOnboardingDraft(identityId);
        router.replace('/discover');
      } else {
        const targetRoute = routeByStep[nextDraft.step];
        if (pathname !== targetRoute) router.replace(targetRoute);
        const viewedKey = `${identityId}:${nextDraft.step}`;
        if (!viewedKeys.has(viewedKey)) {
          viewedKeys.add(viewedKey);
          quietCapture(telemetry, {
            event_name: 'onboarding_viewed',
            surface: 'onboarding',
            source_surface: null,
            properties: {
              onboarding_version: ONBOARDING_VERSION,
              step_id: nextDraft.step,
              step_index:
                nextDraft.step === 'welcome'
                  ? 1
                  : nextDraft.step === 'style'
                    ? 2
                    : 3,
              total_steps: 3,
            },
          });
        }
      }
      return () => {
        active = false;
      };
    }
    return undefined;
  }, [draft, identityId, pathname, result, router, telemetry]);

  useEffect(() => {
    document
      .getElementById('onboarding-heading')
      ?.focus({ preventScroll: true });
  }, [draft?.step]);

  useEffect(() => {
    if (mutationError) errorRef.current?.focus({ preventScroll: true });
  }, [mutationError]);

  const persistDraft = useCallback(
    (next: OnboardingDraft) => {
      if (!identityId) return;
      setDraft(next);
      writeOnboardingDraft(identityId, next);
    },
    [identityId],
  );

  const goTo = useCallback(
    (step: OnboardingStep) => {
      if (!draft) return;
      const next = { ...draft, step, revision: draft.revision + 1 };
      persistDraft(next);
      router.push(routeByStep[step]);
      if (step !== 'welcome') {
        quietCapture(telemetry, {
          event_name: 'onboarding_step_viewed',
          surface: 'onboarding',
          source_surface: null,
          properties: {
            onboarding_version: ONBOARDING_VERSION,
            step_id: step,
            step_index: step === 'style' ? 2 : 3,
          },
        });
      }
    },
    [draft, persistDraft, router, telemetry],
  );

  const toggle = useCallback(
    (preference: OnboardingPreference) => {
      if (!draft || submitting) return;
      const selected = draft.selectedPreferenceIds.includes(
        preference.preference_id,
      );
      const groupSelected =
        result.status === 'ready'
          ? result.snapshot.preferences.filter(
              (candidate) =>
                candidate.preference_group === preference.preference_group &&
                draft.selectedPreferenceIds.includes(candidate.preference_id),
            )
          : [];
      if (
        !selected &&
        preference.max_selections !== null &&
        groupSelected.length >= preference.max_selections
      ) {
        setLimitMessage('Choose up to four. Remove one to add another.');
        return;
      }
      setLimitMessage('');
      const selectedPreferenceIds = selected
        ? draft.selectedPreferenceIds.filter(
            (id) => id !== preference.preference_id,
          )
        : [...draft.selectedPreferenceIds, preference.preference_id];
      persistDraft({
        ...draft,
        selectedPreferenceIds,
        revision: draft.revision + 1,
      });
      quietCapture(telemetry, {
        event_name: selected
          ? 'onboarding_preference_removed'
          : 'onboarding_preference_selected',
        surface: 'onboarding',
        source_surface: null,
        properties: {
          onboarding_version: ONBOARDING_VERSION,
          preference_id: preference.preference_id,
          preference_set_version: PREFERENCE_SET_VERSION,
        },
      });
    },
    [draft, persistDraft, result, submitting, telemetry],
  );

  const submit = useCallback(
    async (
      action: OnboardingAction,
      preferenceIds = draft?.selectedPreferenceIds ?? [],
      forceNewOperation = false,
    ) => {
      if (!draft || !identityId || submitting) return;
      const operationId =
        (!forceNewOperation ? draft.operations[action] : undefined) ??
        globalThis.crypto.randomUUID();
      const operations = { ...draft.operations, [action]: operationId };
      persistDraft({ ...draft, operations });
      setMutationError(null);
      setSubmitting(action);
      try {
        const response =
          action === 'skip'
            ? await service.skip(operationId)
            : await service.complete(operationId, preferenceIds);
        if (action === 'skip') {
          quietCapture(telemetry, {
            event_name: 'onboarding_skipped',
            surface: 'onboarding',
            source_surface: null,
            properties: {
              onboarding_version: ONBOARDING_VERSION,
              step_id: draft.step,
              selected_preference_count_before_skip:
                draft.selectedPreferenceIds.length,
              operation_id: operationId,
            },
          });
        } else {
          quietCapture(telemetry, {
            event_name: 'onboarding_completed',
            surface: 'onboarding',
            source_surface: null,
            properties: {
              onboarding_version: ONBOARDING_VERSION,
              selected_preference_ids: [...preferenceIds].sort(),
              preference_count: preferenceIds.length,
              completion_type:
                response.data.status === 'completed_with_preferences'
                  ? 'with_preferences'
                  : 'without_preferences',
              operation_id: operationId,
            },
          });
        }
        clearOnboardingDraft(identityId);
        router.replace('/discover');
      } catch (error) {
        const mapped =
          error instanceof OnboardingError
            ? error
            : new OnboardingError(
                'mutation_unavailable',
                true,
                'We couldn’t save your choices.',
              );
        setMutationError({ action, error: mapped });
        quietCapture(telemetry, {
          event_name: 'onboarding_persistence_failed',
          surface: 'onboarding',
          source_surface: null,
          properties: {
            attempted_action: action,
            operation_id: operationId,
            error_class:
              mapped.code === 'operation_conflict' ? 'conflict' : 'persistence',
            error_code: mapped.code,
            retryable: mapped.retryable,
          },
        });
      } finally {
        setSubmitting(null);
      }
    },
    [draft, identityId, persistDraft, service, submitting, telemetry, router],
  );

  if (
    identity.state.status === 'idle' ||
    identity.state.status === 'loading' ||
    result.status === 'loading' ||
    (result.status === 'ready' && !draft)
  ) {
    return <StatusScreen kind="loading" />;
  }
  if (
    identity.state.status === 'recoverable_error' ||
    (result.status === 'error' && result.error.retryable)
  ) {
    return (
      <StatusScreen
        kind="recoverable"
        retry={
          identity.state.status === 'recoverable_error' ? identity.retry : retry
        }
      />
    );
  }
  if (
    identity.state.status === 'unrecoverable_error' ||
    result.status === 'error'
  ) {
    return <StatusScreen kind="unrecoverable" />;
  }
  if (identity.state.status !== 'ready') return <StatusScreen kind="loading" />;
  if (!draft) return <StatusScreen kind="loading" />;

  const preferences = result.snapshot.preferences;
  const currentPreferences = preferences.filter(
    (preference) => preference.preference_group === draft.step,
  );
  const progress = draft.step === 'style' ? 1 : 2;

  return (
    <main className={styles.frame}>
      <div className={styles.brand}>A L T E R .</div>
      {draft.step === 'welcome' ? (
        <section className={styles.welcome}>
          <div className={styles.hero}>
            <Image
              src="/onboarding/welcome.png"
              alt=""
              fill
              priority
              sizes="(max-width: 1199px) 100vw, 55vw"
              className={styles.heroImage}
            />
          </div>
          <div className={styles.welcomeCopy}>
            <Heading
              id="onboarding-heading"
              tabIndex={-1}
              as="h1"
              role="display-xl"
            >
              Find the pieces that feel like you.
            </Heading>
            <Text role="body-lg" className={styles.supporting}>
              Explore, save, and build a look without the pressure to buy.
            </Text>
            <div className={styles.welcomeActions}>
              <Button onClick={() => goTo('style')}>Start</Button>
              <button
                className={styles.quietAction}
                type="button"
                disabled={submitting !== null || mutationError !== null}
                onClick={() => void submit('skip')}
              >
                {submitting === 'skip' ? 'Continuing…' : 'Skip for now'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.step}>
          <header className={styles.stepHeader}>
            <Text role="micro" className={styles.progressText}>
              {progress} of 2
            </Text>
            <div
              className={styles.progress}
              role="progressbar"
              aria-label={`Onboarding preference step ${progress} of 2`}
              aria-valuemin={1}
              aria-valuemax={2}
              aria-valuenow={progress}
            >
              <span className={styles.progressActive} />
              <span className={progress === 2 ? styles.progressActive : ''} />
            </div>
            <Heading
              id="onboarding-heading"
              tabIndex={-1}
              as="h1"
              role="display-md"
            >
              {draft.step === 'style'
                ? 'What pulls you in?'
                : 'What are you dressing for lately?'}
            </Heading>
            <Text className={styles.supporting}>
              {draft.step === 'style'
                ? 'Choose up to four.'
                : 'Choose any that fit.'}
            </Text>
          </header>
          <div
            className={
              draft.step === 'style' ? styles.styleGrid : styles.moodList
            }
            aria-describedby={limitMessage ? 'selection-limit' : undefined}
          >
            {currentPreferences.map((preference) => (
              <ChoiceCard
                key={preference.preference_id}
                preference={preference}
                selected={draft.selectedPreferenceIds.includes(
                  preference.preference_id,
                )}
                disabled={submitting !== null || mutationError !== null}
                onToggle={() => toggle(preference)}
              />
            ))}
          </div>
          <p
            id="selection-limit"
            className={styles.limitMessage}
            role="status"
            aria-live="polite"
          >
            {limitMessage}
          </p>
          <div className={styles.controls}>
            <button
              className={styles.backAction}
              type="button"
              disabled={submitting !== null || mutationError !== null}
              onClick={() => goTo(draft.step === 'style' ? 'welcome' : 'style')}
            >
              Back
            </button>
            <Button
              disabled={submitting !== null || mutationError !== null}
              onClick={() =>
                draft.step === 'style' ? goTo('mood') : void submit('complete')
              }
            >
              {draft.step === 'style'
                ? 'Continue'
                : submitting === 'complete'
                  ? 'Saving choices…'
                  : 'Show my feed'}
            </Button>
            {draft.step === 'mood' ? (
              <button
                className={styles.quietAction}
                type="button"
                disabled={submitting !== null || mutationError !== null}
                onClick={() => void submit('skip')}
              >
                {submitting === 'skip' ? 'Continuing…' : 'Skip choices'}
              </button>
            ) : null}
          </div>
        </section>
      )}
      {mutationError ? (
        <div ref={errorRef} tabIndex={-1} className={styles.error} role="alert">
          <Heading as="h2" role="heading-md">
            We couldn’t save your choices.
          </Heading>
          <Text>Your choices are still here.</Text>
          <div className={styles.errorActions}>
            {mutationError.error.retryable ? (
              <Button onClick={() => void submit(mutationError.action)}>
                Try again
              </Button>
            ) : null}
            <button
              className={styles.quietAction}
              type="button"
              onClick={() => {
                void submit('complete', [], true);
              }}
            >
              Continue with default feed
            </button>
          </div>
        </div>
      ) : null}
      <VisuallyHidden aria-live="polite">
        {submitting ? 'Saving choices.' : ''}
      </VisuallyHidden>
    </main>
  );
}

export function ProductOnboardingGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const identity = useAnonymousIdentity();
  const identityId =
    identity.state.status === 'ready'
      ? identity.state.anonymousUserId
      : undefined;
  const service = useMemo(() => createBrowserOnboardingService(), []);
  const { result, retry } = useEntryData(service, identityId);

  useEffect(() => {
    if (
      identityId &&
      result.status === 'ready' &&
      !isTerminalOnboardingStatus(result.snapshot.state.status)
    ) {
      const draft = readOnboardingDraft(identityId);
      router.replace(routeByStep[draft.step]);
    }
  }, [identityId, result, router]);

  if (identity.state.status === 'loading' || identity.state.status === 'idle') {
    return <StatusScreen kind="loading" />;
  }
  if (identity.state.status === 'recoverable_error') {
    return (
      <StatusScreen
        kind="recoverable"
        retry={identity.retry}
        scope="identity"
      />
    );
  }
  if (identity.state.status === 'unrecoverable_error') {
    return <StatusScreen kind="unrecoverable" scope="identity" />;
  }
  if (result.status === 'loading') return <StatusScreen kind="loading" />;
  if (result.status === 'error') {
    return result.error.retryable ? (
      <StatusScreen kind="recoverable" retry={retry} />
    ) : (
      <StatusScreen kind="unrecoverable" />
    );
  }
  return isTerminalOnboardingStatus(result.snapshot.state.status) ? (
    children
  ) : (
    <StatusScreen kind="loading" />
  );
}
