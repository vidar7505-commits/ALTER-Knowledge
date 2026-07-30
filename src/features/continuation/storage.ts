import { z } from 'zod';

const VERSION = 1;
const PREFIX = 'alter:continuation:v1';

const StoredStateSchema = z.strictObject({
  version: z.literal(VERSION),
  identityId: z.uuid(),
  sessionId: z.uuid(),
  shown: z.boolean(),
  consumption: z.enum(['dismissed', 'activated']).nullable(),
});

export type ContinuationConsumption = 'dismissed' | 'activated';
export type StoredContinuationState = z.infer<typeof StoredStateSchema>;

function key(identityId: string, sessionId: string) {
  return `${PREFIX}:${identityId}:${sessionId}`;
}

export function readContinuationState(
  identityId: string,
  sessionId: string,
): StoredContinuationState {
  const fallback: StoredContinuationState = {
    version: VERSION,
    identityId,
    sessionId,
    shown: false,
    consumption: null,
  };
  try {
    const storageKey = key(identityId, sessionId);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = StoredStateSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.identityId !== identityId ||
      parsed.data.sessionId !== sessionId
    ) {
      window.localStorage.removeItem(storageKey);
      return fallback;
    }
    return parsed.data;
  } catch {
    return fallback;
  }
}

export function markContinuationShown(identityId: string, sessionId: string) {
  const current = readContinuationState(identityId, sessionId);
  window.localStorage.setItem(
    key(identityId, sessionId),
    JSON.stringify({ ...current, shown: true }),
  );
}

export function consumeContinuation(
  identityId: string,
  sessionId: string,
  consumption: ContinuationConsumption,
) {
  const current = readContinuationState(identityId, sessionId);
  window.localStorage.setItem(
    key(identityId, sessionId),
    JSON.stringify({ ...current, shown: true, consumption }),
  );
}
