# A L T E R . — LR-001 Telemetry Implementation

## 1. Canonical architecture

Client and server events are submitted to the Next.js `POST /api/events` endpoint. The endpoint validates typed contracts and calls PostgreSQL `ingest_events`. State-changing success events are inserted inside the relevant mutation RPC, not reconstructed by the browser.

## 2. Client event lifecycle

1. Create UUIDv4 `event_id`.
2. Capture `occurred_at`, monotonic `client_sequence`, surface, source surface, and strict event properties.
3. Place event in IndexedDB queue before network send.
4. Batch up to 50 events or 64 KB.
5. Retry with exponential backoff plus jitter: 1 s, 2 s, 5 s, 15 s, 60 s, then on connectivity/lifecycle signal.
6. Delete only IDs confirmed accepted or already present.
7. Preserve queue across reload and offline periods for 30 days.

Identity fields, server receive time, environment, release, app version, and test/internal flags are overwritten or derived server-side.

## 3. Session algorithm

```ts
interface SessionState {
  sessionId: string;
  sessionNumber: number;
  startedAt: string;
  lastActivityAt: string;
  isReturnSession: boolean;
}

const INACTIVITY_MS = 30 * 60 * 1000;

async function ensureSession(now: Date, entryRoute: string): Promise<SessionState> {
  const local = await sessionCache.get();
  if (!local || now.getTime() - Date.parse(local.lastActivityAt) > INACTIVITY_MS) {
    return serverEnsureSession({ occurredAt: now.toISOString(), entryRoute });
  }
  return local;
}
```

The server remains authoritative. Offline events retain original occurrence time and session ID when that session was already established. If no server session existed, the event is attached to the first valid session created after reconnect and flagged `offline_session_recovered=true`; analysis uses occurrence time but preserves server assignment.

D1, D3, and D7 are calculated as 24, 72, and 168 hours after first eligible session start. Production, non-test sessions only.

## 4. Event validation

Contracts are generated from the Data specification into discriminated TypeScript/Zod schemas. Unknown event names or unsupported versions are quarantined. Timestamp rules:
- future skew > 24 hours: reject;
- older than 30 days: quarantine unless approved replay;
- `received_at`: database time;
- sequence regression: accept with QA flag, not silent correction.

## 5. Deduplication

- `events.event_id` primary key.
- `product_impression` unique index on `(session_id, feed_instance_id, product_id, event_name)`.
- Success events use the mutation operation ID in properties and a unique event-operation constraint.
- Duplicate batches return per-event status: `inserted`, `duplicate`, `quarantined`, `rejected`.

## 6. Mutation telemetry

Each mutation RPC:
1. checks operation replay;
2. validates and persists state;
3. inserts canonical success or domain failure event where appropriate;
4. commits once;
5. returns the event ID.

UI intent events such as `challenge_completion_attempted` remain client observations. `product_saved`, `product_removed`, `challenge_started`, selections, removals, completion, onboarding completion, and skip are server-generated.

## 7. Failure reporting

Telemetry endpoint failures are sampled to observability without payload content. Queue age, queue size, batch rejection rate, quarantine rate, duplicate rate, and ingestion latency are operational metrics. Telemetry failure never changes mutation outcome.
