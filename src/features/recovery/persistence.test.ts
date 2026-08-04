import { describe, expect, it } from 'vitest';

import {
  emptyRecoveryDocument,
  MemoryRecoveryPersistence,
  parseRecoveryDocument,
} from './persistence';
import {
  RECOVERY_QUEUE_BYTES_LIMIT,
  RECOVERY_QUEUE_VERSION,
  type RecoveryItem,
} from './types';

const identityId = '10000000-0000-4000-8000-000000000001';
const operationId = '20000000-0000-4000-8000-000000000001';
const productId = '30000000-0000-4000-8000-000000000001';

function item(overrides: Partial<RecoveryItem> = {}): RecoveryItem {
  return {
    version: RECOVERY_QUEUE_VERSION,
    identityId,
    sessionId: null,
    operationId,
    sequence: 0,
    createdAt: '2026-07-30T10:00:00.000Z',
    attemptCount: 0,
    lastAttemptAt: null,
    retryState: 'pending',
    kind: 'save_product',
    payload: { productId, sourceSurface: 'discover' },
    ...overrides,
  } as RecoveryItem;
}

function raw(items: unknown[], nextSequence = 1) {
  return JSON.stringify({
    version: RECOVERY_QUEUE_VERSION,
    nextSequence,
    items,
  });
}

describe('recovery persistence parsing', () => {
  it('returns an empty queue for absent state', () => {
    expect(parseRecoveryDocument(undefined)).toEqual({
      document: emptyRecoveryDocument(),
      recoveredCorruption: false,
      issues: [],
    });
  });

  it('parses a valid versioned queue', () => {
    const result = parseRecoveryDocument(raw([item()]));
    expect(result.document.items).toHaveLength(1);
    expect(result.recoveredCorruption).toBe(false);
  });

  it.each([
    ['malformed JSON', '{', 'malformed_json'],
    ['non-object root', '[]', 'unsupported_or_malformed_root'],
    [
      'unsupported version',
      JSON.stringify({ version: 2, nextSequence: 0, items: [] }),
      'unsupported_or_malformed_root',
    ],
  ])('recovers %s safely', (_label, value, issue) => {
    const result = parseRecoveryDocument(value);
    expect(result.document.items).toEqual([]);
    expect(result.issues).toContain(issue);
  });

  it.each([
    ['unknown mutation kind', { ...item(), kind: 'arbitrary_rpc' }],
    ['missing required field', { ...item(), operationId: undefined }],
    ['invalid UUID', { ...item(), identityId: 'owner-controlled' }],
    [
      'invalid revision',
      {
        ...item(),
        kind: 'complete_challenge',
        payload: { progressId: productId, expectedRevision: -1 },
      },
    ],
    ['negative attempt count', { ...item(), attemptCount: -1 }],
  ])('isolates %s', (_label, candidate) => {
    const result = parseRecoveryDocument(raw([candidate]));
    expect(result.document.items).toEqual([]);
    expect(result.issues).toContain('invalid_item');
  });

  it('preserves valid independent items during partial corruption', () => {
    const result = parseRecoveryDocument(raw([{}, item()]));
    expect(result.document.items).toEqual([item()]);
    expect(result.recoveredCorruption).toBe(true);
  });

  it('rejects cross-identity, cross-session, and impossible ordering records', () => {
    const otherIdentity = '10000000-0000-4000-8000-000000000002';
    const sessionId = '40000000-0000-4000-8000-000000000001';
    const duplicateSequence = item({
      operationId: '20000000-0000-4000-8000-000000000002',
    });
    const result = parseRecoveryDocument(
      raw([
        item({ identityId: otherIdentity }),
        item({ sessionId }),
        item(),
        duplicateSequence,
      ]),
      identityId,
    );

    expect(result.document.items).toEqual([item()]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'cross_identity_item',
        'cross_session_item',
        'duplicate_sequence',
      ]),
    );
  });

  it('collapses identical duplicate operations', () => {
    const result = parseRecoveryDocument(raw([item(), item()]));
    expect(result.document.items).toHaveLength(1);
    expect(result.issues).toContain('duplicate_identical');
  });

  it('rejects conflicting payloads sharing an operation ID', () => {
    const conflict = item({
      payload: {
        productId: '30000000-0000-4000-8000-000000000002',
        sourceSurface: 'discover',
      },
    });
    const result = parseRecoveryDocument(raw([item(), conflict]));
    expect(result.document.items).toEqual([]);
    expect(result.issues).toContain('operation_id_conflict');
  });

  it('orders by creation sequence and advances the next sequence', () => {
    const later = item({
      operationId: '20000000-0000-4000-8000-000000000002',
      sequence: 2,
    });
    const result = parseRecoveryDocument(raw([later, item()], 0));
    expect(result.document.items.map((value) => value.sequence)).toEqual([
      0, 2,
    ]);
    expect(result.document.nextSequence).toBe(3);
  });

  it('rejects an oversized queue without rendering raw content', () => {
    const result = parseRecoveryDocument(
      'x'.repeat(RECOVERY_QUEUE_BYTES_LIMIT + 1),
    );
    expect(result.document.items).toEqual([]);
    expect(result.issues).toEqual(['queue_oversized']);
  });

  it('surfaces storage read, write, and quota-style failures', async () => {
    const storage = new MemoryRecoveryPersistence();
    storage.readError = new Error('read blocked');
    await expect(storage.read(identityId)).rejects.toThrow('read blocked');
    storage.readError = null;
    storage.writeError = new DOMException(
      'Quota exceeded',
      'QuotaExceededError',
    );
    await expect(
      storage.write(identityId, {
        version: 1,
        nextSequence: 0,
        items: [],
      }),
    ).rejects.toThrow('Quota exceeded');
  });
});
