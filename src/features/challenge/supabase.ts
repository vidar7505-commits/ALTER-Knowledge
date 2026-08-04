import type { SupabaseClient } from '@supabase/supabase-js';

import { createBrowserCatalogService } from '@/features/catalog/supabase';
import { createBrowserWardrobeService } from '@/features/wardrobe/supabase';
import { getBrowserSupabaseClient } from '@/lib/supabase/browser';
import { executeRecoverableMutation } from '@/features/recovery/runtime';

import { ChallengeService, type ChallengeDataSource } from './service';
import { ChallengeError } from './types';

type DatabaseError = { code?: string; message: string };

export function mapChallengeError(error: DatabaseError) {
  if (
    error.code === '40001' &&
    error.message.includes('challenge_revision_mismatch')
  ) {
    return new ChallengeError(
      'revision_mismatch',
      false,
      'The Challenge changed and has been refreshed.',
      { cause: error },
    );
  }
  if (
    (error.code === '22023' || error.code === '23505') &&
    error.message.toLowerCase().includes('operation')
  ) {
    return new ChallengeError(
      'operation_conflict',
      false,
      'That action conflicts with an earlier request.',
      { cause: error },
    );
  }
  if (error.code === '22023' || error.code === '23514') {
    return new ChallengeError(
      'validation_mismatch',
      false,
      'That piece no longer matches the current Challenge.',
      { cause: error },
    );
  }
  return new ChallengeError(
    'transport_unavailable',
    true,
    'The Challenge service is temporarily unavailable.',
    { cause: error },
  );
}

export class SupabaseChallengeDataSource implements ChallengeDataSource {
  constructor(private readonly client: SupabaseClient) {}

  readDefinition(challengeId: string) {
    return this.query(
      this.client
        .from('challenges')
        .select(
          'id,version,title,context_copy,required_slots,completion_rules,is_active',
        )
        .eq('id', challengeId),
    );
  }

  readProgress(challengeId: string) {
    return this.query(
      this.client
        .from('challenge_progress')
        .select('id,challenge_id,status,started_at,state_revision')
        .eq('challenge_id', challengeId),
    );
  }

  readProgressItems(progressId: string) {
    return this.query(
      this.client
        .from('challenge_progress_items')
        .select('id,challenge_progress_id,slot_id,product_id,selected_at')
        .eq('challenge_progress_id', progressId)
        .is('removed_at', null)
        .order('selected_at')
        .order('id'),
    );
  }

  readCompletion(progressId: string) {
    return this.query(
      this.client
        .from('challenge_completions')
        .select(
          'id,challenge_progress_id,completed_at,selected_products_snapshot',
        )
        .eq('challenge_progress_id', progressId),
    );
  }

  start(challengeId: string, operationId: string) {
    return executeRecoverableMutation(
      {
        kind: 'start_challenge',
        operationId,
        payload: { challengeId },
      },
      () =>
        this.rpc('start_challenge', {
          p_challenge_id: challengeId,
          p_operation_id: operationId,
        }),
    );
  }

  select(input: Parameters<ChallengeDataSource['select']>[0]) {
    return executeRecoverableMutation(
      {
        kind: 'select_challenge_item',
        operationId: input.operationId,
        payload: {
          progressId: input.progressId,
          slotId: input.slotId,
          productId: input.productId,
          expectedRevision: input.expectedRevision,
        },
      },
      () =>
        this.rpc('select_challenge_item', {
          challenge_progress_id: input.progressId,
          slot_id: input.slotId,
          product_id: input.productId,
          expected_state_revision: input.expectedRevision,
          operation_id: input.operationId,
        }),
    );
  }

  remove(input: Parameters<ChallengeDataSource['remove']>[0]) {
    return executeRecoverableMutation(
      {
        kind: 'remove_challenge_item',
        operationId: input.operationId,
        payload: {
          progressItemId: input.progressItemId,
          expectedRevision: input.expectedRevision,
        },
      },
      () =>
        this.rpc('remove_challenge_item', {
          challenge_progress_item_id: input.progressItemId,
          expected_state_revision: input.expectedRevision,
          operation_id: input.operationId,
        }),
    );
  }

  complete(input: Parameters<ChallengeDataSource['complete']>[0]) {
    return executeRecoverableMutation(
      {
        kind: 'complete_challenge',
        operationId: input.operationId,
        payload: {
          progressId: input.progressId,
          expectedRevision: input.expectedRevision,
        },
      },
      () =>
        this.rpc('complete_challenge', {
          challenge_progress_id: input.progressId,
          expected_state_revision: input.expectedRevision,
          operation_id: input.operationId,
        }),
    );
  }

  private async query(
    query: PromiseLike<{ data: unknown; error: DatabaseError | null }>,
  ) {
    const { data, error } = await query;
    if (error) throw mapChallengeError(error);
    return data;
  }

  private async rpc(name: string, parameters: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) throw mapChallengeError(error);
    return data;
  }
}

let browserService: ChallengeService | undefined;

export function createBrowserChallengeService() {
  browserService ??= new ChallengeService(
    new SupabaseChallengeDataSource(getBrowserSupabaseClient()),
    createBrowserCatalogService(),
    createBrowserWardrobeService(),
  );
  return browserService;
}
