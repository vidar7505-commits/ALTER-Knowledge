import {
  TELEMETRY_MAX_BATCH_SIZE,
  validateTelemetryEvent,
  type AnyTelemetryEvent,
} from './contracts';
import type { TelemetryQueuePersistence } from './service';

const DATABASE_NAME = 'alter-telemetry-v1';
const STORE_NAME = 'session-queues';
const MAX_BYTES = 256 * 1024;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error());
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function request<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const result = action(transaction.objectStore(STORE_NAME));
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export function createBrowserTelemetryPersistence(
  sessionId: string,
): TelemetryQueuePersistence {
  return {
    async read() {
      try {
        const raw = await request('readonly', (store) => store.get(sessionId));
        if (typeof raw !== 'string' || raw.length > MAX_BYTES) return [];
        const value: unknown = JSON.parse(raw);
        if (!Array.isArray(value)) return [];
        return value.slice(0, TELEMETRY_MAX_BATCH_SIZE).flatMap((candidate) => {
          const parsed = validateTelemetryEvent(candidate, new Date());
          return parsed.success && parsed.event.session_id === sessionId
            ? [parsed.event]
            : [];
        });
      } catch {
        return [];
      }
    },
    async write(events: AnyTelemetryEvent[]) {
      const bounded = events.slice(0, TELEMETRY_MAX_BATCH_SIZE);
      const raw = JSON.stringify(bounded);
      if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return;
      try {
        await request('readwrite', (store) => store.put(raw, sessionId));
      } catch {
        // Telemetry remains non-blocking when browser persistence is unavailable.
      }
    },
  };
}
