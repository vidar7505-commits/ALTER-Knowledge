import { describe, expect, it } from 'vitest';

import {
  ingestTelemetryRequest,
  parseTelemetryIngestionRequest,
  readTrustedTelemetryContext,
} from './server';
import { InMemoryTelemetryDatabase } from './test-double';
import { validSessionStartedEvent } from './test-fixtures';

const trusted = {
  environment: 'preview' as const,
  appVersion: 'sha-123',
  previewNamespace: 'preview-42',
};

const session = {
  session_id: '20000000-0000-4000-8000-000000000001',
  platform: 'web_mobile' as const,
  entry_route: '/discover',
};

const auth = {
  async verifyAccessToken(token: string) {
    return token === 'valid-token'
      ? '90000000-0000-4000-8000-000000000001'
      : null;
  },
};

describe('trusted telemetry server boundary', () => {
  it('verifies auth identity and derives trusted fields server-side', async () => {
    const database = new InMemoryTelemetryDatabase({
      clock: () => new Date('2026-07-24T12:00:01.000Z'),
      identityForAuthUser: () => '80000000-0000-4000-8000-000000000001',
    });

    const result = await ingestTelemetryRequest({
      accessToken: 'valid-token',
      body: { session, events: [validSessionStartedEvent()] },
      trusted,
      auth,
      database,
    });

    expect(result.results).toEqual([
      {
        index: 0,
        event_id: '10000000-0000-4000-8000-000000000001',
        status: 'accepted',
        error_codes: [],
        received_at: '2026-07-24T12:00:01.000Z',
      },
    ]);
    expect(
      database.acceptedEvents.get('10000000-0000-4000-8000-000000000001'),
    ).toMatchObject({
      anonymousUserId: '80000000-0000-4000-8000-000000000001',
      environment: 'preview',
      appVersion: 'sha-123',
      receivedAt: '2026-07-24T12:00:01.000Z',
    });
  });

  it('rejects unauthenticated requests before database access', async () => {
    const database = new InMemoryTelemetryDatabase();
    await expect(
      ingestTelemetryRequest({
        accessToken: 'invalid-token',
        body: { session, events: [validSessionStartedEvent()] },
        trusted,
        auth,
        database,
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated', status: 401 });
    expect(database.acceptedEvents.size).toBe(0);
  });

  it('is idempotent for equivalent replays and rejects conflicts', async () => {
    const database = new InMemoryTelemetryDatabase({
      clock: () => new Date('2026-07-24T12:00:01.000Z'),
    });
    const input = {
      accessToken: 'valid-token',
      body: { session, events: [validSessionStartedEvent()] },
      trusted,
      auth,
      database,
    };

    expect((await ingestTelemetryRequest(input)).results[0]?.status).toBe(
      'accepted',
    );
    expect((await ingestTelemetryRequest(input)).results[0]?.status).toBe(
      'duplicate',
    );

    const conflict = validSessionStartedEvent({
      properties: {
        session_number: 2,
        is_return_session: true,
        prior_session_ended_at: '2026-07-24T11:00:00.000Z',
        entry_route: '/wardrobe',
      },
    });
    const result = await ingestTelemetryRequest({
      ...input,
      body: { session, events: [conflict] },
    });

    expect(result.results[0]).toMatchObject({
      status: 'rejected',
      error_codes: ['event_id_conflict'],
    });
    expect(database.acceptedEvents.size).toBe(1);
  });

  it('preserves order and returns mixed per-item outcomes', async () => {
    const database = new InMemoryTelemetryDatabase({
      clock: () => new Date('2026-07-24T12:00:01.000Z'),
    });
    const invalid = {
      ...validSessionStartedEvent({
        event_id: '10000000-0000-4000-8000-000000000002',
      }),
      event_name: 'unknown_event',
    };

    const result = await ingestTelemetryRequest({
      accessToken: 'valid-token',
      body: {
        session,
        events: [validSessionStartedEvent(), invalid],
      },
      trusted,
      auth,
      database,
    });

    expect(result.results.map((item) => item.index)).toEqual([0, 1]);
    expect(result.results.map((item) => item.status)).toEqual([
      'accepted',
      'quarantined',
    ]);
    expect(result.results[1]?.error_codes).toEqual(['unknown_event_name']);
  });

  it('rejects caller-supplied trusted fields and quarantines a safe item', async () => {
    const database = new InMemoryTelemetryDatabase({
      clock: () => new Date('2026-07-24T12:00:01.000Z'),
    });
    const event = {
      ...validSessionStartedEvent(),
      anonymous_user_id: '70000000-0000-4000-8000-000000000001',
      authorization: 'Bearer secret',
    };
    const result = await ingestTelemetryRequest({
      accessToken: 'valid-token',
      body: { session, events: [event] },
      trusted,
      auth,
      database,
    });

    expect(result.results[0]).toMatchObject({
      status: 'rejected',
      error_codes: ['forbidden_trusted_field'],
    });
    expect(database.acceptedEvents.size).toBe(0);
  });

  it('blocks a second user from reusing a foreign session', async () => {
    const database = new InMemoryTelemetryDatabase({
      clock: () => new Date('2026-07-24T12:00:01.000Z'),
    });
    await database.ingest({
      authUserId: '90000000-0000-4000-8000-000000000001',
      session,
      events: [validSessionStartedEvent()],
      trusted,
    });
    const result = await database.ingest({
      authUserId: '90000000-0000-4000-8000-000000000002',
      session,
      events: [
        validSessionStartedEvent({
          event_id: '10000000-0000-4000-8000-000000000002',
        }),
      ],
      trusted,
    });

    expect(result.results[0]).toMatchObject({
      status: 'rejected',
      error_codes: ['session_owner_mismatch'],
    });
  });

  it('enforces the canonical maximum batch size', () => {
    expect(() =>
      parseTelemetryIngestionRequest({
        session,
        events: Array.from({ length: 101 }, () => ({})),
      }),
    ).toThrowError(expect.objectContaining({ code: 'batch_too_large' }));
  });

  it('derives local, preview, and production classifications from server state', () => {
    expect(readTrustedTelemetryContext({} as NodeJS.ProcessEnv)).toEqual({
      environment: 'local',
      appVersion: 'local',
      previewNamespace: null,
    });
    expect(
      readTrustedTelemetryContext({
        VERCEL_ENV: 'preview',
        VERCEL_URL: 'branch.example',
        VERCEL_GIT_COMMIT_SHA: 'abc',
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      environment: 'preview',
      appVersion: 'abc',
      previewNamespace: 'branch.example',
    });
  });
});
