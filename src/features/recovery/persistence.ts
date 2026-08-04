import {
  RECOVERY_ITEM_BYTES_LIMIT,
  RECOVERY_QUEUE_BYTES_LIMIT,
  RECOVERY_QUEUE_LIMIT,
  RECOVERY_QUEUE_VERSION,
  RecoveryDocumentSchema,
  RecoveryItemSchema,
  RecoveryStorageError,
  type RecoveryDocument,
  type RecoveryItem,
  type RecoveryReadResult,
} from './types';

const DATABASE_NAME = 'alter-recovery-v1';
const DATABASE_VERSION = 1;
const STORE_NAME = 'identity-queues';

export interface RecoveryPersistence {
  read(identityId: string): Promise<RecoveryReadResult>;
  write(identityId: string, document: RecoveryDocument): Promise<void>;
  clear(identityId: string): Promise<void>;
}

export function emptyRecoveryDocument(): RecoveryDocument {
  return { version: RECOVERY_QUEUE_VERSION, nextSequence: 0, items: [] };
}

function fingerprint(item: RecoveryItem) {
  return JSON.stringify({
    kind: item.kind,
    identityId: item.identityId,
    sessionId: item.sessionId,
    operationId: item.operationId,
    payload: item.payload,
  });
}

export function parseRecoveryDocument(
  raw: unknown,
  expectedIdentityId?: string,
): RecoveryReadResult {
  if (typeof raw !== 'string') {
    return {
      document: emptyRecoveryDocument(),
      recoveredCorruption: raw !== null && raw !== undefined,
      issues: raw === null || raw === undefined ? [] : ['queue_not_string'],
    };
  }

  if (new TextEncoder().encode(raw).byteLength > RECOVERY_QUEUE_BYTES_LIMIT) {
    return {
      document: emptyRecoveryDocument(),
      recoveredCorruption: true,
      issues: ['queue_oversized'],
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      document: emptyRecoveryDocument(),
      recoveredCorruption: true,
      issues: ['malformed_json'],
    };
  }

  const root = RecoveryDocumentSchema.safeParse(value);
  if (!root.success) {
    return {
      document: emptyRecoveryDocument(),
      recoveredCorruption: true,
      issues: ['unsupported_or_malformed_root'],
    };
  }

  const issues: string[] = [];
  const items: RecoveryItem[] = [];
  const operations = new Map<string, string>();
  const conflicted = new Set<string>();
  const sequences = new Set<number>();

  for (const candidate of root.data.items) {
    const parsed = RecoveryItemSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push('invalid_item');
      continue;
    }
    const item = parsed.data;
    if (expectedIdentityId && item.identityId !== expectedIdentityId) {
      issues.push('cross_identity_item');
      continue;
    }
    if (item.sessionId !== null) {
      issues.push('cross_session_item');
      continue;
    }
    const encoded = JSON.stringify(item);
    if (
      new TextEncoder().encode(encoded).byteLength > RECOVERY_ITEM_BYTES_LIMIT
    ) {
      issues.push('item_oversized');
      continue;
    }
    const prior = operations.get(item.operationId);
    const current = fingerprint(item);
    if (prior && prior !== current) {
      conflicted.add(item.operationId);
      issues.push('operation_id_conflict');
      continue;
    }
    if (prior === current) {
      issues.push('duplicate_identical');
      continue;
    }
    if (sequences.has(item.sequence)) {
      issues.push('duplicate_sequence');
      continue;
    }
    sequences.add(item.sequence);
    operations.set(item.operationId, current);
    items.push(item);
  }

  const safeItems = items
    .filter((item) => !conflicted.has(item.operationId))
    .sort((a, b) => a.sequence - b.sequence)
    .slice(0, RECOVERY_QUEUE_LIMIT);

  return {
    document: {
      version: RECOVERY_QUEUE_VERSION,
      nextSequence: Math.max(
        root.data.nextSequence,
        ...safeItems.map((item) => item.sequence + 1),
        0,
      ),
      items: safeItems,
    },
    recoveredCorruption: issues.length > 0,
    issues,
  };
}

export class MemoryRecoveryPersistence implements RecoveryPersistence {
  private readonly values = new Map<string, string>();
  readError: Error | null = null;
  writeError: Error | null = null;

  async read(identityId: string) {
    if (this.readError) throw this.readError;
    return parseRecoveryDocument(this.values.get(identityId), identityId);
  }

  async write(identityId: string, document: RecoveryDocument) {
    if (this.writeError) throw this.writeError;
    const raw = JSON.stringify(document);
    if (
      document.items.length > RECOVERY_QUEUE_LIMIT ||
      new TextEncoder().encode(raw).byteLength > RECOVERY_QUEUE_BYTES_LIMIT
    ) {
      throw new RecoveryStorageError('The recovery queue is full.');
    }
    this.values.set(identityId, raw);
  }

  async clear(identityId: string) {
    this.values.delete(identityId);
  }

  setRaw(identityId: string, raw: string) {
    this.values.set(identityId, raw);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new RecoveryStorageError('Browser recovery storage is unavailable.'),
    );
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new RecoveryStorageError('Browser recovery storage could not open.', {
          cause: request.error,
        }),
      );
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new RecoveryStorageError('Browser recovery storage failed.', {
          cause: request.error,
        }),
      );
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export class IndexedDbRecoveryPersistence implements RecoveryPersistence {
  async read(identityId: string) {
    const raw = await transact('readonly', (store) => store.get(identityId));
    return parseRecoveryDocument(raw, identityId);
  }

  async write(identityId: string, document: RecoveryDocument) {
    const raw = JSON.stringify(document);
    if (
      document.items.length > RECOVERY_QUEUE_LIMIT ||
      new TextEncoder().encode(raw).byteLength > RECOVERY_QUEUE_BYTES_LIMIT
    ) {
      throw new RecoveryStorageError('The recovery queue is full.');
    }
    await transact('readwrite', (store) => store.put(raw, identityId));
  }

  async clear(identityId: string) {
    await transact('readwrite', (store) => store.delete(identityId));
  }
}
