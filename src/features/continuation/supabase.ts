import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

import { ContinuationService, type ContinuationDataSource } from './service';
import { ContinuationError } from './types';

type DatabaseError = { code?: string; message: string };

function mapError(error: DatabaseError) {
  if (
    error.code === '22023' &&
    error.message.toLowerCase().includes('session')
  ) {
    return new ContinuationError(
      'stale_session',
      true,
      'The return session changed. Refresh and try again.',
      { cause: error },
    );
  }
  return new ContinuationError(
    'transport_unavailable',
    true,
    'We couldn’t restore your continuation.',
    { cause: error },
  );
}

export class SupabaseContinuationDataSource implements ContinuationDataSource {
  constructor(private readonly client: SupabaseClient) {}

  readActiveProgress() {
    return this.query(
      this.client
        .from('challenge_progress')
        .select('id,status')
        .in('status', ['in_progress', 'ready_to_complete'])
        .order('updated_at', { ascending: false })
        .order('id')
        .limit(1),
    );
  }

  readActiveProgressItems(progressId: string) {
    return this.query(
      this.client
        .from('challenge_progress_items')
        .select('slot_id,product_id')
        .eq('challenge_progress_id', progressId)
        .is('removed_at', null)
        .order('selected_at')
        .order('id'),
    );
  }

  readActiveSavedProductIds() {
    return this.query(
      this.client
        .from('saved_products')
        .select('product_id')
        .is('removed_at', null),
    );
  }

  readActiveProduct(productId: string) {
    return this.rpc('get_catalog_product', { p_product_id: productId });
  }

  readLatestCompletion() {
    return this.query(
      this.client
        .from('challenge_completions')
        .select('id,challenge_progress_id,completed_at')
        .order('completed_at', { ascending: false })
        .order('id')
        .limit(1),
    );
  }

  readReturnSessionsAfter(completedAt: string) {
    return this.query(
      this.client
        .from('sessions')
        .select('id,session_number,started_at,is_return_session')
        .eq('is_return_session', true)
        .gt('started_at', completedAt)
        .order('session_number')
        .order('id'),
    );
  }

  readMeaningfulDestination() {
    return this.query(
      this.client
        .from('anonymous_users')
        .select('last_meaningful_destination')
        .limit(1),
    );
  }

  readActiveSavedRows() {
    return this.query(
      this.client
        .from('saved_products')
        .select('id')
        .is('removed_at', null)
        .order('saved_at', { ascending: false }),
    );
  }

  private async query(
    query: PromiseLike<{ data: unknown; error: DatabaseError | null }>,
  ) {
    const { data, error } = await query;
    if (error) throw mapError(error);
    return data;
  }

  private async rpc(name: string, parameters: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) throw mapError(error);
    return data;
  }
}

let browserService: ContinuationService | undefined;

export function createBrowserContinuationService() {
  browserService ??= new ContinuationService(
    new SupabaseContinuationDataSource(getBrowserSupabaseClient()),
  );
  return browserService;
}
