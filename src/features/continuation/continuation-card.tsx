'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Heading, Text } from '@/components/design-system/primitives';

import type { ContinuationService } from './service';
import {
  consumeContinuation,
  markContinuationShown,
  readContinuationState,
} from './storage';
import { createBrowserContinuationService } from './supabase';
import {
  createBrowserContinuationTelemetry,
  quietContinuationCapture,
  type ContinuationTelemetry,
} from './telemetry';
import {
  ContinuationError,
  type ContinuationCandidate,
  type ContinuationSession,
  type ContinuationState,
} from './types';
import styles from './continuation.module.css';

function copy(candidate: ContinuationCandidate) {
  if (candidate.type === 'active_challenge') {
    return {
      eyebrow: 'Continue your look',
      title: 'After Dark',
      status: `${candidate.progressCount} of 4 pieces selected`,
      action: 'Continue',
    };
  }
  if (candidate.type === 'completed_challenge') {
    return {
      eyebrow: 'Your latest look',
      title: 'After Dark',
      status: 'Completed',
      action: 'View look',
    };
  }
  return {
    eyebrow: 'Pick up where you left off',
    title: 'Your Wardrobe',
    status: `${candidate.savedCount} saved pieces`,
    action: 'Open Wardrobe',
  };
}

function cueType(candidate: ContinuationCandidate) {
  return candidate.type;
}

export function ContinuationCard({
  identityId,
  session,
  forcedService,
  forcedTelemetry,
}: {
  identityId: string;
  session: ContinuationSession;
  forcedService?: ContinuationService;
  forcedTelemetry?: ContinuationTelemetry;
}) {
  const router = useRouter();
  const service = useMemo(
    () => forcedService ?? createBrowserContinuationService(),
    [forcedService],
  );
  const telemetry = useMemo(
    () =>
      forcedTelemetry ??
      createBrowserContinuationTelemetry(
        session.session_id,
        typeof window !== 'undefined' && window.innerWidth < 768
          ? 'web_mobile'
          : 'web_desktop',
      ),
    [forcedTelemetry, session.session_id],
  );
  const [state, setState] = useState<ContinuationState>({
    status: 'resolving',
  });
  const [attempt, setAttempt] = useState(0);
  const requestVersion = useRef(0);
  const actionLock = useRef(false);

  useEffect(() => {
    const version = ++requestVersion.current;
    let active = true;
    actionLock.current = false;

    const run = async () => {
      await Promise.resolve();
      if (!active || version !== requestVersion.current) return;
      if (!session.is_return_session) {
        setState({ status: 'same_session' });
        return;
      }
      const persisted = readContinuationState(identityId, session.session_id);
      if (persisted.consumption) {
        setState({ status: 'consumed' });
        return;
      }
      setState({ status: 'resolving' });
      try {
        const candidate = await service.resolve(session);
        if (!active || version !== requestVersion.current) return;
        if (!candidate) {
          setState({ status: 'no_continuation' });
          return;
        }
        const current = readContinuationState(identityId, session.session_id);
        if (current.consumption) {
          setState({ status: 'consumed' });
          return;
        }
        setState({ status: 'ready', candidate });
        if (!current.shown) {
          markContinuationShown(identityId, session.session_id);
          quietContinuationCapture(telemetry, {
            event_name: 'continuation_cue_viewed',
            surface: 'continuation',
            source_surface: 'discover',
            properties: {
              cue_type: cueType(candidate),
              target_surface:
                candidate.destination === '/challenge'
                  ? 'challenge'
                  : 'wardrobe',
              challenge_progress_count:
                candidate.type === 'wardrobe' ? 0 : candidate.progressCount,
            },
          });
        }
      } catch (error: unknown) {
        if (!active || version !== requestVersion.current) return;
        const mapped =
          error instanceof ContinuationError
            ? error
            : new ContinuationError(
                'transport_unavailable',
                true,
                'We couldn’t restore your continuation.',
                { cause: error },
              );
        setState({
          status: mapped.retryable ? 'recoverable_error' : 'contract_error',
          error: mapped,
        });
      }
    };
    void run();
    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [attempt, identityId, service, session, telemetry]);

  const dismiss = useCallback(() => {
    if (actionLock.current || state.status !== 'ready') return;
    actionLock.current = true;
    consumeContinuation(identityId, session.session_id, 'dismissed');
    quietContinuationCapture(telemetry, {
      event_name: 'continuation_cue_dismissed',
      surface: 'continuation',
      source_surface: 'discover',
      properties: {
        cue_type: cueType(state.candidate),
        persistence_scope: 'identity_session_v1',
      },
    });
    setState({ status: 'consumed' });
  }, [identityId, session.session_id, state, telemetry]);

  const activate = useCallback(() => {
    if (actionLock.current || state.status !== 'ready') return;
    actionLock.current = true;
    const candidate = state.candidate;
    consumeContinuation(identityId, session.session_id, 'activated');
    setState({ status: 'navigating', candidate });
    quietContinuationCapture(telemetry, {
      event_name: 'continuation_action_selected',
      surface: 'continuation',
      source_surface: 'discover',
      properties: {
        cue_type: cueType(candidate),
        target_surface:
          candidate.destination === '/challenge' ? 'challenge' : 'wardrobe',
      },
    });
    router.push(candidate.destination);
  }, [identityId, router, session.session_id, state, telemetry]);

  if (
    state.status === 'same_session' ||
    state.status === 'no_continuation' ||
    state.status === 'consumed' ||
    state.status === 'resolving'
  ) {
    return null;
  }

  if (
    state.status === 'recoverable_error' ||
    state.status === 'contract_error'
  ) {
    return (
      <section
        className={styles.error}
        role="alert"
        aria-labelledby="continuation-error"
      >
        <Heading as="h2" role="heading-md" id="continuation-error">
          We couldn’t restore your continuation.
        </Heading>
        <Text>Your Discover feed is still available.</Text>
        {state.status === 'recoverable_error' ? (
          <Button
            onClick={() => {
              service.invalidate(session.session_id);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        ) : null}
      </section>
    );
  }

  if (state.status !== 'ready' && state.status !== 'navigating') return null;

  const candidate = state.candidate;
  const content = copy(candidate);
  return (
    <section
      className={styles.card}
      aria-labelledby="continuation-title"
      data-testid="continuation-card"
    >
      <div className={styles.copy}>
        <Text role="caption" className={styles.eyebrow}>
          {content.eyebrow}
        </Text>
        <Heading as="h2" role="heading-lg" id="continuation-title">
          {content.title}
        </Heading>
        <Text>{content.status}</Text>
      </div>
      <div className={styles.actions}>
        <Button
          onClick={activate}
          disabled={state.status === 'navigating'}
          aria-busy={state.status === 'navigating'}
        >
          {content.action}
        </Button>
        <button
          type="button"
          className={styles.dismiss}
          onClick={dismiss}
          disabled={state.status === 'navigating'}
          aria-label={`Dismiss ${content.title} continuation`}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
