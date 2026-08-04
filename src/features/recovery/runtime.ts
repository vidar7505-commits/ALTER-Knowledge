import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

import {
  IndexedDbRecoveryPersistence,
  type RecoveryPersistence,
} from './persistence';
import {
  RECOVERY_MAX_ATTEMPTS,
  RECOVERY_QUEUE_LIMIT,
  RECOVERY_QUEUE_VERSION,
  RecoveryItemSchema,
  RecoveryPendingError,
  RecoveryStorageError,
  type RecoveryItem,
  type RecoveryMutationKind,
  type RecoverySnapshot,
} from './types';

type QueueInput = {
  kind: RecoveryMutationKind;
  operationId: string;
  sessionId?: string | null;
  payload: RecoveryItem['payload'];
};

type DatabaseError = { code?: string; message?: string };
type Listener = (snapshot: RecoverySnapshot) => void;

const retryDelays = [0, 1_000, 3_000] as const;

function isTerminal(error: DatabaseError) {
  return [
    '22023',
    '23514',
    '23505',
    '40001',
    'operation_conflict',
    'revision_mismatch',
    'validation_mismatch',
    'contract_invalid',
    'save_contract_invalid',
  ].includes(error.code ?? '');
}

function isAuthorization(error: DatabaseError) {
  return ['28000', '42501', 'PGRST301', 'unauthenticated'].includes(
    error.code ?? '',
  );
}

function isConflict(error: DatabaseError) {
  return ['22023', '23505', '40001', 'operation_conflict'].includes(
    error.code ?? '',
  );
}

function defaultSnapshot(): RecoverySnapshot {
  return { status: 'idle', pendingCount: 0, message: null };
}

export class RecoveryRuntime {
  private identityId: string | null = null;
  private generation = 0;
  private draining: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private snapshot = defaultSnapshot();
  private online = true;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly persistence: RecoveryPersistence,
    private readonly client: () => SupabaseClient,
    private readonly clock: () => Date = () => new Date(),
    private readonly schedule: (
      callback: () => void,
      delay: number,
    ) => ReturnType<typeof setTimeout> = (callback, delay) =>
      globalThis.setTimeout(callback, delay),
  ) {}

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  async setIdentity(identityId: string | null) {
    if (identityId === this.identityId) return;
    this.generation += 1;
    this.cancelTimer();
    this.identityId = identityId;
    this.draining = null;
    if (!identityId) {
      this.publish({
        status: 'blocked_identity',
        pendingCount: 0,
        message: null,
      });
      return;
    }
    await this.refresh();
    if (this.online) await this.drain();
  }

  setOnline(online: boolean) {
    this.online = online;
    if (!online) {
      this.publish({
        ...this.snapshot,
        status: 'blocked_offline',
        message:
          this.snapshot.pendingCount > 0
            ? 'You’re offline. Your pending change is retained.'
            : 'You’re offline. Loaded content remains available.',
      });
      return;
    }
    void this.drain();
  }

  async executeOrQueue<T>(input: QueueInput, execute: () => Promise<T>) {
    if (!this.identityId) return execute();
    if (
      !this.online ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    ) {
      await this.enqueue(input, 'blocked_offline');
      throw new RecoveryPendingError();
    }
    try {
      return await execute();
    } catch (error) {
      const databaseError = error as DatabaseError;
      if (isTerminal(databaseError) || isAuthorization(databaseError)) {
        throw error;
      }
      await this.enqueue(input, 'pending');
      void this.drain();
      throw new RecoveryPendingError();
    }
  }

  async enqueue(
    input: QueueInput,
    retryState: RecoveryItem['retryState'] = 'pending',
  ) {
    const identityId = this.identityId;
    if (!identityId) throw new RecoveryPendingError();
    try {
      const result = await this.persistence.read(identityId);
      const existing = result.document.items.find(
        (item) => item.operationId === input.operationId,
      );
      const candidate = RecoveryItemSchema.parse({
        version: RECOVERY_QUEUE_VERSION,
        identityId,
        sessionId: input.sessionId ?? null,
        operationId: input.operationId,
        sequence: existing?.sequence ?? result.document.nextSequence,
        createdAt: existing?.createdAt ?? this.clock().toISOString(),
        attemptCount: existing?.attemptCount ?? 0,
        lastAttemptAt: existing?.lastAttemptAt ?? null,
        retryState,
        kind: input.kind,
        payload: input.payload,
      });
      if (
        existing &&
        JSON.stringify(existing.payload) !== JSON.stringify(candidate.payload)
      ) {
        this.publish({
          status: 'conflict',
          pendingCount: result.document.items.length,
          message: 'A retained change conflicts with an earlier request.',
        });
        throw new RecoveryPendingError(
          'A retained change conflicts with an earlier request.',
        );
      }
      const items = existing
        ? result.document.items.map((item) =>
            item.operationId === candidate.operationId ? candidate : item,
          )
        : [...result.document.items, candidate];
      if (items.length > RECOVERY_QUEUE_LIMIT) {
        throw new RecoveryStorageError('The recovery queue is full.');
      }
      await this.persistence.write(identityId, {
        version: RECOVERY_QUEUE_VERSION,
        nextSequence: existing
          ? result.document.nextSequence
          : result.document.nextSequence + 1,
        items,
      });
      this.publish({
        status:
          retryState === 'blocked_offline' ? 'blocked_offline' : 'pending',
        pendingCount: items.length,
        message: 'Your change is retained and will retry safely.',
      });
    } catch (error) {
      if (error instanceof RecoveryPendingError) throw error;
      this.publish({
        status: 'storage_unavailable',
        pendingCount: 0,
        message: 'This browser cannot retain changes for retry.',
      });
      throw error;
    }
  }

  drain(): Promise<void> {
    if (this.draining) return this.draining;
    const identityId = this.identityId;
    if (!identityId || !this.online) return Promise.resolve();
    const generation = this.generation;
    this.draining = this.performDrain(identityId, generation).finally(() => {
      if (generation === this.generation) this.draining = null;
    });
    return this.draining;
  }

  async retry() {
    this.cancelTimer();
    if (this.identityId) {
      const current = await this.persistence.read(this.identityId);
      await this.persistence.write(this.identityId, {
        ...current.document,
        items: current.document.items.map((item) =>
          item.retryState === 'terminal'
            ? {
                ...item,
                attemptCount: 0,
                retryState: 'pending' as const,
              }
            : item,
        ),
      });
    }
    await this.drain();
  }

  dispose() {
    this.generation += 1;
    this.cancelTimer();
    this.listeners.clear();
  }

  private async performDrain(identityId: string, generation: number) {
    let read;
    try {
      read = await this.persistence.read(identityId);
    } catch {
      this.publish({
        status: 'storage_unavailable',
        pendingCount: 0,
        message: 'Recovery storage is unavailable.',
      });
      return;
    }
    if (read.recoveredCorruption) {
      await this.persistence.write(identityId, read.document);
      this.publish({
        status: 'corrupt_recovered',
        pendingCount: read.document.items.length,
        message: 'Invalid local recovery data was removed safely.',
      });
    }
    const items = [...read.document.items].sort(
      (left, right) => left.sequence - right.sequence,
    );
    for (const item of items) {
      if (
        generation !== this.generation ||
        identityId !== this.identityId ||
        !this.online
      ) {
        return;
      }
      if (item.identityId !== identityId) continue;
      if (item.attemptCount >= RECOVERY_MAX_ATTEMPTS) {
        this.publish({
          status: 'retry_available',
          pendingCount: items.length,
          message: 'A retained change needs a manual retry.',
        });
        return;
      }
      this.publish({
        status: 'dispatching',
        pendingCount: items.length,
        message: 'Retrying your retained change…',
      });
      try {
        await this.dispatch(item);
        if (generation !== this.generation) return;
        const current = await this.persistence.read(identityId);
        const remaining = current.document.items.filter(
          (candidate) => candidate.operationId !== item.operationId,
        );
        await this.persistence.write(identityId, {
          ...current.document,
          items: remaining,
        });
        if (remaining.length === 0) {
          this.publish({
            status: 'succeeded',
            pendingCount: 0,
            message: 'Your retained change is up to date.',
          });
        }
      } catch (error) {
        const databaseError = error as DatabaseError;
        const current = await this.persistence.read(identityId);
        if (
          databaseError.code === '40001' ||
          databaseError.code === 'revision_mismatch'
        ) {
          await this.persistence.write(identityId, {
            ...current.document,
            items: current.document.items.filter(
              (candidate) => candidate.operationId !== item.operationId,
            ),
          });
          this.publish({
            status: 'conflict',
            pendingCount: Math.max(0, current.document.items.length - 1),
            message: 'The Challenge changed and was refreshed.',
          });
          return;
        }
        const attemptCount = item.attemptCount + 1;
        const state: RecoveryItem['retryState'] = isAuthorization(databaseError)
          ? 'blocked_identity'
          : isConflict(databaseError)
            ? 'conflict'
            : isTerminal(databaseError)
              ? 'terminal'
              : attemptCount >= RECOVERY_MAX_ATTEMPTS
                ? 'terminal'
                : 'retry_scheduled';
        const updated = current.document.items.map((candidate) =>
          candidate.operationId === item.operationId
            ? {
                ...candidate,
                attemptCount,
                lastAttemptAt: this.clock().toISOString(),
                retryState: state,
              }
            : candidate,
        );
        await this.persistence.write(identityId, {
          ...current.document,
          items: updated,
        });
        if (state === 'retry_scheduled') {
          const delay =
            retryDelays[Math.min(attemptCount, retryDelays.length - 1)];
          this.publish({
            status: 'retry_scheduled',
            pendingCount: updated.length,
            message: 'Your change is retained for another retry.',
          });
          this.retryTimer = this.schedule(() => void this.drain(), delay);
        } else {
          this.publish({
            status:
              state === 'blocked_identity'
                ? 'blocked_identity'
                : state === 'conflict'
                  ? 'conflict'
                  : 'retry_available',
            pendingCount: updated.length,
            message:
              state === 'conflict'
                ? 'This change needs refreshed canonical state.'
                : 'A retained change needs a manual retry.',
          });
        }
        return;
      }
    }
    await this.refresh();
  }

  private async dispatch(item: RecoveryItem) {
    const client = this.client();
    let result: { data: unknown; error: DatabaseError | null };
    switch (item.kind) {
      case 'save_product':
        result = await client.rpc('save_product', {
          p_product_id: item.payload.productId,
          p_operation_id: item.operationId,
          p_source_surface: item.payload.sourceSurface,
        });
        break;
      case 'remove_product':
        result = await client.rpc('remove_product', {
          saved_product_id: item.payload.savedProductId,
          operation_id: item.operationId,
        });
        break;
      case 'start_challenge':
        result = await client.rpc('start_challenge', {
          p_challenge_id: item.payload.challengeId,
          p_operation_id: item.operationId,
        });
        break;
      case 'select_challenge_item':
        result = await client.rpc('select_challenge_item', {
          challenge_progress_id: item.payload.progressId,
          slot_id: item.payload.slotId,
          product_id: item.payload.productId,
          expected_state_revision: item.payload.expectedRevision,
          operation_id: item.operationId,
        });
        break;
      case 'remove_challenge_item':
        result = await client.rpc('remove_challenge_item', {
          challenge_progress_item_id: item.payload.progressItemId,
          expected_state_revision: item.payload.expectedRevision,
          operation_id: item.operationId,
        });
        break;
      case 'complete_challenge':
        result = await client.rpc('complete_challenge', {
          challenge_progress_id: item.payload.progressId,
          expected_state_revision: item.payload.expectedRevision,
          operation_id: item.operationId,
        });
        break;
    }
    if (result.error) throw result.error;
    const envelope = result.data as {
      ok?: unknown;
      operation_id?: unknown;
    } | null;
    if (
      !envelope ||
      envelope.ok !== true ||
      envelope.operation_id !== item.operationId
    ) {
      throw { code: 'contract_invalid', message: 'Malformed RPC contract.' };
    }
  }

  private async refresh() {
    const identityId = this.identityId;
    if (!identityId) return;
    try {
      const result = await this.persistence.read(identityId);
      this.publish({
        status:
          result.document.items.length === 0
            ? this.online
              ? 'idle'
              : 'blocked_offline'
            : this.online
              ? 'pending'
              : 'blocked_offline',
        pendingCount: result.document.items.length,
        message:
          result.document.items.length === 0
            ? this.online
              ? null
              : 'You’re offline. Loaded content remains available.'
            : 'Your pending change is retained.',
      });
    } catch {
      this.publish({
        status: 'storage_unavailable',
        pendingCount: 0,
        message: 'Recovery storage is unavailable.',
      });
    }
  }

  private publish(snapshot: RecoverySnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private cancelTimer() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}

export const browserRecoveryRuntime = new RecoveryRuntime(
  new IndexedDbRecoveryPersistence(),
  getBrowserSupabaseClient,
);

export function executeRecoverableMutation<T>(
  input: QueueInput,
  execute: () => Promise<T>,
) {
  return browserRecoveryRuntime.executeOrQueue(input, execute);
}
