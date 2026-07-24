import { describe, expect, it, vi } from 'vitest';

import { createFetchTelemetryTransport } from './transport';
import { validSessionStartedEvent } from './test-fixtures';

describe('browser telemetry transport', () => {
  it('sends only the user token and untrusted event/session fields', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              index: 0,
              event_id: '10000000-0000-4000-8000-000000000001',
              status: 'accepted',
              error_codes: [],
              received_at: '2026-07-24T12:00:01.000Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const transport = createFetchTelemetryTransport({
      getAccessToken: async () => 'anonymous-user-token',
      fetch,
    });

    await transport.send({
      session: {
        session_id: '20000000-0000-4000-8000-000000000001',
        platform: 'web_mobile',
        entry_route: '/discover',
      },
      events: [validSessionStartedEvent()],
    });

    const request = fetch.mock.calls[0]?.[1];
    expect(request?.headers).toEqual({
      authorization: 'Bearer anonymous-user-token',
      'content-type': 'application/json',
    });
    expect(request?.body).not.toContain('service_role');
    expect(request?.body).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(request?.body).not.toContain('anonymous_user_id');
    expect(request?.body).not.toContain('environment');
  });

  it('maps transient server failure to a typed retryable error', async () => {
    const transport = createFetchTelemetryTransport({
      getAccessToken: async () => 'anonymous-user-token',
      fetch: async () =>
        new Response(JSON.stringify({ error: 'database_unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
    });

    await expect(
      transport.send({
        session: {
          session_id: '20000000-0000-4000-8000-000000000001',
          platform: 'web_mobile',
          entry_route: '/discover',
        },
        events: [validSessionStartedEvent()],
      }),
    ).rejects.toMatchObject({
      code: 'database_unavailable',
      retryable: true,
    });
  });
});
