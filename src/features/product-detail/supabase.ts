import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';
import {
  RemoveEnvelopeSchema,
  SaveEnvelopeSchema,
} from '@/features/discover/types';
import { DiscoverError } from '@/features/discover/types';

type RpcError = { code?: string; message: string };

function mapError(error: RpcError): DiscoverError {
  if (error.code === '22023' || error.code === '23514') {
    return new DiscoverError(
      'operation_conflict',
      false,
      'The request no longer matches canonical state.',
      { cause: error },
    );
  }
  return new DiscoverError(
    'transport_unavailable',
    true,
    'The product-detail service is temporarily unavailable.',
    { cause: error },
  );
}

export class SupabaseProductDetailDataSource {
  constructor(private readonly client: SupabaseClient) {}

  async readSavedProducts(): Promise<unknown> {
    const { data, error } = await this.client
      .from('saved_products')
      .select('id,product_id')
      .is('removed_at', null);
    if (error) throw mapError(error);
    return data;
  }

  async saveProduct(input: {
    productId: string;
    operationId: string;
  }): Promise<unknown> {
    return this.rpc('save_product', {
      p_product_id: input.productId,
      p_operation_id: input.operationId,
      p_source_surface: 'product_detail',
    });
  }

  async removeProduct(input: {
    savedProductId: string;
    operationId: string;
  }): Promise<unknown> {
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

export type SavedProductEntry = { savedProductId: string; productId: string };

export async function readSavedProductsFromSource(
  source: SupabaseProductDetailDataSource,
): Promise<SavedProductEntry[]> {
  const value = await source.readSavedProducts();
  if (!Array.isArray(value)) {
    throw new DiscoverError(
      'save_contract_invalid',
      false,
      'Saved product state is not compatible with this build.',
    );
  }
  return value.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.id !== 'string' ||
      typeof row.product_id !== 'string'
    ) {
      throw new DiscoverError(
        'save_contract_invalid',
        false,
        'Saved product state is not compatible with this build.',
      );
    }
    return {
      savedProductId: row.id as string,
      productId: row.product_id as string,
    };
  });
}

export async function saveProductFromSource(
  source: SupabaseProductDetailDataSource,
  productId: string,
  operationId: string,
) {
  const raw = await source.saveProduct({ productId, operationId });
  const parsed = SaveEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiscoverError(
      'save_contract_invalid',
      false,
      'The save response is not compatible with this build.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export async function removeProductFromSource(
  source: SupabaseProductDetailDataSource,
  savedProductId: string,
  operationId: string,
) {
  const raw = await source.removeProduct({ savedProductId, operationId });
  const parsed = RemoveEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiscoverError(
      'save_contract_invalid',
      false,
      'The remove response is not compatible with this build.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

let browserSource: SupabaseProductDetailDataSource | undefined;

export function createBrowserProductDetailSource(): SupabaseProductDetailDataSource {
  browserSource ??= new SupabaseProductDetailDataSource(
    getBrowserSupabaseClient(),
  );
  return browserSource;
}
