import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';
import { executeRecoverableMutation } from '@/features/recovery/runtime';

import {
  WardrobeService,
  type EnsureWardrobeSessionInput,
  type WardrobeDataSource,
} from './service';
import { WardrobeError } from './types';

type DatabaseError = { code?: string; message: string };

function mapError(error: DatabaseError): WardrobeError {
  if (
    error.code === '22023' &&
    error.message.toLowerCase().includes('session has expired')
  ) {
    return new WardrobeError(
      'session_expired',
      true,
      'The previous session has ended.',
      { cause: error },
    );
  }
  if (error.code === '22023' || error.code === '23514') {
    return new WardrobeError(
      'operation_conflict',
      false,
      'The request no longer matches canonical Wardrobe state.',
      { cause: error },
    );
  }
  return new WardrobeError(
    'transport_unavailable',
    true,
    'The Wardrobe service is temporarily unavailable.',
    { cause: error },
  );
}

export class SupabaseWardrobeDataSource implements WardrobeDataSource {
  constructor(private readonly client: SupabaseClient) {}

  ensureSession(input: EnsureWardrobeSessionInput) {
    return this.rpc('ensure_session', {
      p_session_id: input.sessionId,
      p_app_version: input.appVersion,
      p_platform: input.platform,
      p_entry_route: '/wardrobe',
      p_traffic_source: null,
      p_cohort_id: null,
    });
  }

  async readSavedProducts() {
    const { data, error } = await this.client
      .from('saved_products')
      .select('id,product_id,saved_at')
      .is('removed_at', null)
      .order('saved_at', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw mapError(error);
    return data;
  }

  readProduct(productId: string) {
    return this.rpc('get_catalog_product', { p_product_id: productId });
  }

  removeProduct(input: { savedProductId: string; operationId: string }) {
    return executeRecoverableMutation(
      {
        kind: 'remove_product',
        operationId: input.operationId,
        payload: { savedProductId: input.savedProductId },
      },
      () =>
        this.rpc('remove_product', {
          saved_product_id: input.savedProductId,
          operation_id: input.operationId,
        }),
    );
  }

  saveProduct(input: { productId: string; operationId: string }) {
    return executeRecoverableMutation(
      {
        kind: 'save_product',
        operationId: input.operationId,
        payload: {
          productId: input.productId,
          sourceSurface: 'wardrobe',
        },
      },
      () =>
        this.rpc('save_product', {
          p_product_id: input.productId,
          p_operation_id: input.operationId,
          p_source_surface: 'wardrobe',
        }),
    );
  }

  private async rpc(name: string, parameters: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, parameters);
    if (error) throw mapError(error);
    return data;
  }
}

let browserService: WardrobeService | undefined;

export function createBrowserWardrobeService() {
  browserService ??= new WardrobeService(
    new SupabaseWardrobeDataSource(getBrowserSupabaseClient()),
  );
  return browserService;
}
