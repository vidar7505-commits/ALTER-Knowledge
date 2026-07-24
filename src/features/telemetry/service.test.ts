import { describe, expect, it, vi } from 'vitest';

import { BufferedTelemetryService } from './service';
import type { TelemetryTransport } from './types';

const session = {
  session_id: '20000000-0000-4000-8000-000000000001',
  platform: 'web_mobile' as const,
  entry_route: '/discover',
};

const context = () => ({
  timezone_offset_minutes: 180,
  locale: 'tr-TR',
  viewport_width: 390,
  viewport_height: 844,
  network_state: 'online' as const,
  experiment_assignments: {},
});

const capture = {
  event_name: 'session_started' as const,
  surface: 'app_boot' as const,
  properties: {
    session_number: 1,
    is_return_session: false,
    prior_session_ended_at: null,
    entry_route: '/discover',
  },
};

describe('BufferedTelemetryService', () => {
  it('generates immutable IDs and preserves input order for batches', async () => {
    const sent: string[][] = [];
    const transport: TelemetryTransport = {
      async send(request) {
        sent.push(request.events.map((event) => event.event_id));
        return {
          results: request.events.map((event, index) => ({
            index,
            event_id: event.event_id,
            status: 'accepted',
            error_codes: [],
            received_at: '2026-07-24T12:00:01.000Z',
          })),
        };
      },
    };
    const ids = [
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
    ];
    const service = new BufferedTelemetryService({
      session,
      context,
      transport,
      clock: () => new Date('2026-07-24T12:00:00.000Z'),
      createEventId: () => ids.shift()!,
    });

    const result = await service.captureBatch([capture, capture]);

    expect(sent[0]).toEqual([
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
    ]);
    expect(result.results.map((item) => item.index)).toEqual([0, 1]);
  });

  it('retains a failed batch and preserves event_id on retry', async () => {
    const send = vi
      .fn<TelemetryTransport['send']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async (request) => ({
        results: request.events.map((event, index) => ({
          index,
          event_id: event.event_id,
          status: 'accepted',
          error_codes: [],
          received_at: '2026-07-24T12:00:01.000Z',
        })),
      }));
    const service = new BufferedTelemetryService({
      session,
      context,
      transport: { send },
      clock: () => new Date('2026-07-24T12:00:00.000Z'),
      createEventId: () => '10000000-0000-4000-8000-000000000001',
    });

    await expect(service.capture(capture)).rejects.toMatchObject({
      code: 'transport_unavailable',
      retryable: true,
    });
    await expect(service.flush()).resolves.toMatchObject({
      results: [{ event_id: '10000000-0000-4000-8000-000000000001' }],
    });
    expect(send.mock.calls[0]?.[0].events[0]?.event_id).toBe(
      send.mock.calls[1]?.[0].events[0]?.event_id,
    );
  });

  it('enforces a bounded 100-event queue', async () => {
    const service = new BufferedTelemetryService({
      session,
      context,
      transport: {
        async send() {
          return { results: [] };
        },
      },
    });

    await expect(
      service.captureBatch(Array.from({ length: 101 }, () => capture)),
    ).rejects.toMatchObject({ code: 'queue_full' });
  });

  it('provides compile-time property mapping for event names', () => {
    const service = new BufferedTelemetryService({
      session,
      context,
      transport: {
        async send() {
          return { results: [] };
        },
      },
    });

    if (false) {
      void service.capture({
        event_name: 'wardrobe_viewed',
        surface: 'wardrobe',
        // @ts-expect-error wardrobe_viewed requires its canonical properties
        properties: {},
      });
    }

    expect(service).toBeInstanceOf(BufferedTelemetryService);
  });
});
