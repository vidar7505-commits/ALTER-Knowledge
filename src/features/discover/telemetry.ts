'use client';

import type {
  TelemetryCapture,
  TelemetryContext,
  TelemetryEventName,
} from '@/features/telemetry/contracts';
import { BufferedTelemetryService } from '@/features/telemetry/service';
import { createBrowserTelemetryPersistence } from '@/features/telemetry/persistence';
import { createFetchTelemetryTransport } from '@/features/telemetry/transport';
import {
  TelemetryError,
  type TelemetryItemResult,
} from '@/features/telemetry/types';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

export interface DiscoverTelemetry {
  capture<Name extends TelemetryEventName>(
    event: TelemetryCapture<Name>,
  ): Promise<TelemetryItemResult>;
  captureQualified(
    key: string,
    event: TelemetryCapture<'product_impression'>,
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

type StableTask = {
  service: BufferedTelemetryService;
  eventId: string;
  started: boolean;
};

const services = new Map<string, BufferedTelemetryService>();
const stableTasks = new Map<string, StableTask>();

function createService(
  sessionId: string,
  platform: Platform,
  eventId?: string,
) {
  return new BufferedTelemetryService({
    session: {
      session_id: sessionId,
      platform,
      entry_route: '/discover',
    },
    context,
    transport: transport(),
    createEventId: eventId ? () => eventId : undefined,
    persistence: createBrowserTelemetryPersistence(
      `${sessionId}:discover:${eventId ?? 'main'}`,
    ),
  });
}

export function createBrowserDiscoverTelemetry(
  sessionId: string,
  platform: Platform,
): DiscoverTelemetry {
  const serviceKey = `${sessionId}:${platform}`;
  const service =
    services.get(serviceKey) ?? createService(sessionId, platform);
  services.set(serviceKey, service);
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
    async captureQualified(key, event) {
      const taskKey = `${sessionId}:${key}`;
      let task = stableTasks.get(taskKey);
      if (!task) {
        const eventId = globalThis.crypto.randomUUID();
        task = {
          service: createService(sessionId, platform, eventId),
          eventId,
          started: false,
        };
        stableTasks.set(taskKey, task);
      }

      try {
        const result = task.started
          ? await task.service
              .flush()
              .then((batch) =>
                batch.results.find((item) => item.event_id === task?.eventId),
              )
          : await task.service.capture(event);
        task.started = true;
        if (!result) {
          throw new TelemetryError(
            'response_contract_invalid',
            false,
            'Qualified impression telemetry returned no matching result.',
          );
        }
        if (result.status === 'accepted' || result.status === 'duplicate') {
          task.service.dispose();
          stableTasks.delete(taskKey);
        }
        return result;
      } catch (error) {
        task.started = true;
        throw error;
      }
    },
  };
}

export function quietDiscoverCapture(
  telemetry: DiscoverTelemetry,
  event: Parameters<DiscoverTelemetry['capture']>[0],
) {
  void telemetry.capture(event).catch(() => undefined);
}
