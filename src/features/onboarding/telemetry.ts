import { BufferedTelemetryService } from '@/features/telemetry/service';
import { createBrowserTelemetryPersistence } from '@/features/telemetry/persistence';
import { createFetchTelemetryTransport } from '@/features/telemetry/transport';
import type {
  TelemetryCapture,
  TelemetryContext,
  TelemetryEventName,
} from '@/features/telemetry/contracts';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

export interface OnboardingTelemetry {
  capture<Name extends TelemetryEventName>(
    event: TelemetryCapture<Name>,
  ): Promise<unknown>;
}

let service: BufferedTelemetryService | undefined;

function sessionId() {
  const key = 'alter:telemetry:session-id';
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = globalThis.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function context(): TelemetryContext {
  return {
    timezone_offset_minutes: new Date().getTimezoneOffset(),
    locale: navigator.language,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    network_state: navigator.onLine ? 'online' : 'offline',
    traffic_source: null,
    cohort_id: null,
    experiment_assignments: {},
  };
}

export function createBrowserOnboardingTelemetry(): OnboardingTelemetry {
  if (typeof window === 'undefined') {
    return {
      capture: async () => undefined,
    };
  }

  const canonicalSessionId = sessionId();
  service ??= new BufferedTelemetryService({
    session: {
      session_id: canonicalSessionId,
      platform: window.innerWidth < 768 ? 'web_mobile' : 'web_desktop',
      entry_route: window.location.pathname,
    },
    context,
    transport: createFetchTelemetryTransport({
      async getAccessToken() {
        const { data } = await getBrowserSupabaseClient().auth.getSession();
        return data.session?.access_token ?? null;
      },
    }),
    persistence: createBrowserTelemetryPersistence(
      `${canonicalSessionId}:onboarding`,
    ),
  });
  return service;
}
