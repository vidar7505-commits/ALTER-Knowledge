import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

import {
  DiscoverService,
  type DiscoverDataSource,
  type EnsureSessionInput,
} from './service';
import { DiscoverError } from './types';

type RpcError = { code?: string; message: string };

function mapError(error: RpcError): DiscoverError {
  if (
    error.code === '22023' &&
    error.message.toLowerCase().includes('session has expired')
  ) {
    return new DiscoverError(
      'session_expired',
      true,
      'The previous session has ended.',
      { cause: error },
    );
  }
  if (error.code === '22023' || error.code === '23514') {
    return new DiscoverError(
      'operation_conflict',
      false,
      'The request no longer matches canonical feed state.',
      { cause: error },
    );
  }
  return new DiscoverError(
    'transport_unavailable',
    true,
    'The Discover service is temporarily unavailable.',
    { cause: error },
  );
}

export class SupabaseDiscoverDataSource implements DiscoverDataSource {
  constructor(private readonly client: SupabaseClient) {}

  ensureSession(input: EnsureSessionInput) {
    return this.rpc('ensure_session', {
      p_session_id: input.sessionId,
      p_app_version: input.appVersion,
      p_platform: input.platform,
      p_entry_route: input.entryRoute,
      p_traffic_source: null,
      p_cohort_id: null,
    });
  }

  ensureFeed(sessionId: string) {
    return this.rpc('ensure_feed_instance', { p_session_id: sessionId });
  }

  appendBatch(input: {
    feedInstanceId: string;
    cursor: string | null;
    limit: number;
  }) {
    return this.rpc('append_feed_batch', {
      p_feed_instance_id: input.feedInstanceId,
      p_cursor: input.cursor,
      p_limit: input.limit,
    });
  }

  recordDepth(input: {
    sessionId: string;
    feedInstanceId: string;
    productId: string;
    position: number;
  }) {
    return this.rpc('record_qualified_feed_position', {
      p_session_id: input.sessionId,
      p_feed_instance_id: input.feedInstanceId,
      p_product_id: input.productId,
      p_position: input.position,
    });
  }

  async readSavedProducts(): Promise<unknown> {
    const { data, error } = await this.client
      .from('saved_products')
      .select('id,product_id')
      .is('removed_at', null);
    if (error) throw mapError(error);
    return data;
  }

  saveProduct(input: {
    productId: string;
    operationId: string;
    sourceSurface: 'discover';
  }) {
    return this.rpc('save_product', {
      p_product_id: input.productId,
      p_operation_id: input.operationId,
      p_source_surface: input.sourceSurface,
    });
  }

  removeProduct(input: { savedProductId: string; operationId: string }) {
    return this.rpc('remove_product', {
      saved_product_id: input.savedProductId,
      operation_id: input.operationId,
    });
  }

  private async rpc(name: string, parameters: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) throw mapError(error);
    return data;
  }
}

let browserService: DiscoverService | undefined;

export function createBrowserDiscoverService() {
  browserService ??= new DiscoverService(
    new SupabaseDiscoverDataSource(getBrowserSupabaseClient()),
  );
  return browserService;
}
