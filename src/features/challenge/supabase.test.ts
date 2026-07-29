import { describe, expect, it, vi } from 'vitest';

import { SupabaseChallengeDataSource, mapChallengeError } from './supabase';

describe('SupabaseChallengeDataSource', () => {
  it('uses revision-safe mutation signatures without ownership parameters', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const source = new SupabaseChallengeDataSource({ rpc } as never);
    await source.start(
      'c0810000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000001',
    );
    await source.select({
      progressId: '60000000-0000-4000-8000-000000000001',
      slotId: 'top',
      productId: 'c0800000-0000-4000-8000-000000000001',
      expectedRevision: 7,
      operationId: '80000000-0000-4000-8000-000000000002',
    });
    await source.remove({
      progressItemId: '61000000-0000-4000-8000-000000000001',
      expectedRevision: 8,
      operationId: '80000000-0000-4000-8000-000000000003',
    });
    await source.complete({
      progressId: '60000000-0000-4000-8000-000000000001',
      expectedRevision: 9,
      operationId: '80000000-0000-4000-8000-000000000004',
    });

    expect(rpc.mock.calls).toEqual([
      [
        'start_challenge',
        {
          p_challenge_id: 'c0810000-0000-4000-8000-000000000001',
          p_operation_id: '80000000-0000-4000-8000-000000000001',
        },
      ],
      [
        'select_challenge_item',
        {
          challenge_progress_id: '60000000-0000-4000-8000-000000000001',
          slot_id: 'top',
          product_id: 'c0800000-0000-4000-8000-000000000001',
          expected_state_revision: 7,
          operation_id: '80000000-0000-4000-8000-000000000002',
        },
      ],
      [
        'remove_challenge_item',
        {
          challenge_progress_item_id: '61000000-0000-4000-8000-000000000001',
          expected_state_revision: 8,
          operation_id: '80000000-0000-4000-8000-000000000003',
        },
      ],
      [
        'complete_challenge',
        {
          challenge_progress_id: '60000000-0000-4000-8000-000000000001',
          expected_state_revision: 9,
          operation_id: '80000000-0000-4000-8000-000000000004',
        },
      ],
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(
      /owner|anonymous_user_id|user_id|service_role/,
    );
  });

  it('keeps revision mismatch and operation conflict typed and hides raw errors', () => {
    expect(
      mapChallengeError({
        code: '40001',
        message: 'challenge_revision_mismatch',
      }).code,
    ).toBe('revision_mismatch');
    expect(
      mapChallengeError({
        code: '22023',
        message: 'operation_id reused with a different fingerprint',
      }).code,
    ).toBe('operation_conflict');
  });
});
