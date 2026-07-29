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

export interface ProductDetailTelemetry {
  capture<Name extends TelemetryEventName>(
    event: TelemetryCapture<Name>,
  ): Promise<TelemetryItemResult>;
}

type Platform = 'web_mobile' | 'web_desktop';

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

function transport() {
  return createFetchTelemetryTransport({
    async getAccessToken() {
      const { data } = await getBrowserSupabaseClient().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}

const services = new Map<string, BufferedTelemetryService>();

function createService(
  sessionId: string,
  platform: Platform,
  productId: string,
) {
  return new BufferedTelemetryService({
    session: {
      session_id: sessionId,
      platform,
      entry_route: `/product/${productId}`,
    },
    context,
    transport: transport(),
  });
}

export function createBrowserProductDetailTelemetry(
  sessionId: string,
  platform: Platform,
  productId: string,
): ProductDetailTelemetry {
  const key = `${sessionId}:${platform}:${productId}`;
  const service =
    services.get(key) ?? createService(sessionId, platform, productId);
  services.set(key, service);
  let captureChain = Promise.resolve();

  return {
    capture(event) {
      const result = captureChain.then(() => service.capture(event));
      captureChain = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export function quietDetailCapture(
  telemetry: ProductDetailTelemetry,
  event: Parameters<ProductDetailTelemetry['capture']>[0],
) {
  void telemetry.capture(event).catch(() => undefined);
}
