import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryRecoveryPersistence } from './persistence';
import { RecoveryRuntime } from './runtime';
import { RecoveryPendingError } from './types';

const identityA = '10000000-0000-4000-8000-000000000001';
const identityB = '10000000-0000-4000-8000-000000000002';
const operationId = '20000000-0000-4000-8000-000000000001';
const productId = '30000000-0000-4000-8000-000000000001';

function input(operation = operationId) {
  return {
    kind: 'save_product' as const,
    operationId: operation,
    payload: { productId, sourceSurface: 'discover' as const },
  };
}

function clientWith(rpc: ReturnType<typeof vi.fn>): () => SupabaseClient {
  return () => ({ rpc }) as unknown as SupabaseClient;
}

function success(operation = operationId) {
  return {
    data: { ok: true, operation_id: operation, data: {} },
    error: null,
  };
}

describe('RecoveryRuntime', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('retains an offline mutation without dispatch and preserves operation ID', async () => {
    const storage = new MemoryRecoveryPersistence();
    const rpc = vi.fn();
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    runtime.setOnline(false);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    await expect(
      runtime.executeOrQueue(input(), async () => 'impossible'),
    ).rejects.toBeInstanceOf(RecoveryPendingError);
    expect(rpc).not.toHaveBeenCalled();
    const queue = await storage.read(identityA);
    expect(queue.document.items[0]?.operationId).toBe(operationId);
    expect(queue.document.items[0]?.retryState).toBe('blocked_offline');
  });

  it('drains once after reconnect and removes exactly one successful item', async () => {
    const storage = new MemoryRecoveryPersistence();
    const rpc = vi.fn().mockResolvedValue(success());
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    runtime.setOnline(false);
    await runtime.enqueue(input(), 'blocked_offline');
    runtime.setOnline(true);
    await runtime.drain();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_operation_id: operationId,
    });
    expect((await storage.read(identityA)).document.items).toEqual([]);
  });

  it('coalesces concurrent drain triggers', async () => {
    const storage = new MemoryRecoveryPersistence();
    let resolve!: (value: ReturnType<typeof success>) => void;
    const rpc = vi.fn(
      () =>
        new Promise<ReturnType<typeof success>>((done) => {
          resolve = done;
        }),
    );
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    await runtime.enqueue(input());

    const first = runtime.drain();
    const second = runtime.drain();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    resolve(success());
    await first;
  });

  it('retains the same operation after an ambiguous network failure', async () => {
    const storage = new MemoryRecoveryPersistence();
    const rpc = vi.fn().mockResolvedValue(success());
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    const dispatch = vi.fn().mockRejectedValue(new TypeError('response lost'));

    await expect(
      runtime.executeOrQueue(input(), dispatch),
    ).rejects.toBeInstanceOf(RecoveryPendingError);
    await runtime.drain();

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_operation_id: operationId,
    });
    expect((await storage.read(identityA)).document.items).toEqual([]);
  });

  it('does not persist validation, authorization, or operation conflicts', async () => {
    for (const error of [
      { code: 'operation_conflict', message: 'conflict' },
      { code: 'validation_mismatch', message: 'invalid' },
      { code: 'unauthenticated', message: 'auth' },
    ]) {
      const storage = new MemoryRecoveryPersistence();
      const runtime = new RecoveryRuntime(storage, clientWith(vi.fn()));
      await runtime.setIdentity(identityA);
      await expect(
        runtime.executeOrQueue(input(), () => Promise.reject(error)),
      ).rejects.toBe(error);
      expect((await storage.read(identityA)).document.items).toEqual([]);
    }
  });

  it('rejects stale Challenge revision replay and discards it for canonical refresh', async () => {
    const storage = new MemoryRecoveryPersistence();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'challenge_revision_mismatch' },
    });
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    await runtime.enqueue({
      kind: 'complete_challenge',
      operationId,
      payload: { progressId: productId, expectedRevision: 4 },
    });
    await runtime.drain();

    expect(runtime.getSnapshot().status).toBe('conflict');
    expect((await storage.read(identityA)).document.items).toEqual([]);
  });

  it('never dispatches another identity queue', async () => {
    const storage = new MemoryRecoveryPersistence();
    const rpc = vi.fn().mockResolvedValue(success());
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    await runtime.enqueue(input());
    await runtime.setIdentity(identityB);
    await runtime.drain();

    expect(rpc).not.toHaveBeenCalled();
    expect((await storage.read(identityA)).document.items).toHaveLength(1);
  });

  it('preserves FIFO ordering for remove followed by save/Undo', async () => {
    const storage = new MemoryRecoveryPersistence();
    const firstOperation = '20000000-0000-4000-8000-000000000011';
    const secondOperation = '20000000-0000-4000-8000-000000000012';
    const rpc = vi.fn(async (_name: string, payload: Record<string, unknown>) =>
      success(String(payload.operation_id ?? payload.p_operation_id)),
    );
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    await runtime.enqueue({
      kind: 'remove_product',
      operationId: firstOperation,
      payload: { savedProductId: productId },
    });
    await runtime.enqueue(input(secondOperation));
    await runtime.drain();

    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'remove_product',
      'save_product',
    ]);
  });

  it('retains a failed transient item and exposes bounded manual retry', async () => {
    const storage = new MemoryRecoveryPersistence();
    const scheduled: Array<() => void> = [];
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '503', message: 'network' },
    });
    const runtime = new RecoveryRuntime(
      storage,
      clientWith(rpc),
      () => new Date('2026-07-30T10:00:00.000Z'),
      (callback) => {
        scheduled.push(callback);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
    );
    await runtime.setIdentity(identityA);
    await runtime.enqueue(input());
    await runtime.drain();
    scheduled.shift()?.();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    scheduled.shift()?.();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(3));

    expect(runtime.getSnapshot().status).toBe('retry_available');
    expect(
      (await storage.read(identityA)).document.items[0]?.attemptCount,
    ).toBe(3);
  });

  it('maps malformed canonical responses to terminal recovery', async () => {
    const storage = new MemoryRecoveryPersistence();
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const runtime = new RecoveryRuntime(storage, clientWith(rpc));
    await runtime.setIdentity(identityA);
    await runtime.enqueue(input());
    await runtime.drain();
    expect((await storage.read(identityA)).document.items[0]?.retryState).toBe(
      'terminal',
    );
  });

  it('uses a closed mutation allowlist and never persists function names', async () => {
    const storage = new MemoryRecoveryPersistence();
    const runtime = new RecoveryRuntime(storage, clientWith(vi.fn()));
    await runtime.setIdentity(identityA);
    await runtime.enqueue(input());
    const serialized = JSON.stringify((await storage.read(identityA)).document);
    expect(serialized).not.toContain('functionName');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('ownerId');
  });
});
