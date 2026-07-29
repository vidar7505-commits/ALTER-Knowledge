'use client';

import type {
  TelemetryCapture,
  TelemetryContext,
  TelemetryEventName,
} from '@/features/telemetry/contracts';
import { BufferedTelemetryService } from '@/features/telemetry/service';
import { createFetchTelemetryTransport } from '@/features/telemetry/transport';
import type { TelemetryItemResult } from '@/features/telemetry/types';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

export interface WardrobeTelemetry {
  capture<Name extends TelemetryEventName>(
    event: TelemetryCapture<Name>,
  ): Promise<TelemetryItemResult>;
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

const services = new Map<string, BufferedTelemetryService>();

export function createBrowserWardrobeTelemetry(
  sessionId: string,
  platform: 'web_mobile' | 'web_desktop',
): WardrobeTelemetry {
  const key = `${sessionId}:${platform}`;
  let service = services.get(key);
  if (!service) {
    service = new BufferedTelemetryService({
      session: { session_id: sessionId, platform, entry_route: '/wardrobe' },
      context,
      transport: createFetchTelemetryTransport({
        async getAccessToken() {
          const { data } = await getBrowserSupabaseClient().auth.getSession();
          return data.session?.access_token ?? null;
        },
      }),
    });
    services.set(key, service);
  }
  let chain = Promise.resolve();
  return {
    capture(event) {
      const result = chain.then(() => service.capture(event));
      chain = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export function quietWardrobeCapture(
  telemetry: WardrobeTelemetry,
  event: Parameters<WardrobeTelemetry['capture']>[0],
) {
  void telemetry.capture(event).catch(() => undefined);
}
