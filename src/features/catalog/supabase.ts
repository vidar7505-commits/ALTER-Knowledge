import type { SupabaseClient } from '@supabase/supabase-js';

import { getBrowserSupabaseClient } from '@/lib/supabase/browser';

import type {
  CatalogChallengeSlotQuery,
  CatalogDataSource,
  CatalogListQuery,
} from './service';
import { CatalogService } from './service';
import { CatalogError } from './types';

type CatalogRpcName =
  | 'list_catalog_products'
  | 'get_catalog_product'
  | 'list_products_for_challenge_slot';

type CatalogRpcError = {
  code?: string;
  message: string;
};

export interface CatalogRpcClient {
  rpc(
    name: CatalogRpcName,
    parameters: Record<string, unknown>,
  ): Promise<{ data: unknown; error: CatalogRpcError | null }>;
}

export class SupabaseCatalogDataSource implements CatalogDataSource {
  constructor(private readonly client: CatalogRpcClient) {}

  listProducts(query: CatalogListQuery): Promise<unknown> {
    return this.call('list_catalog_products', {
      p_category: query.category,
      p_subcategory: query.subcategory,
      p_slot_id: query.slotId,
      p_after_id: query.afterId,
      p_limit: query.limit,
    });
  }

  getProduct(productId: string): Promise<unknown> {
    return this.call('get_catalog_product', {
      p_product_id: productId,
    });
  }

  listProductsForChallengeSlot(
    query: CatalogChallengeSlotQuery,
  ): Promise<unknown> {
    return this.call('list_products_for_challenge_slot', {
      p_challenge_id: query.challengeId,
      p_slot_id: query.slotId,
      p_after_id: query.afterId,
      p_limit: query.limit,
    });
  }

  private async call(
    name: CatalogRpcName,
    parameters: Record<string, unknown>,
  ): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, parameters);

    if (error) {
      throw new CatalogError(
        'query_unavailable',
        true,
        'The catalog is temporarily unavailable.',
        { cause: error },
      );
    }

    return data;
  }
}

export function adaptCatalogRpcClient(
  client: SupabaseClient,
): CatalogRpcClient {
  return {
    async rpc(name, parameters) {
      const { data, error } = await client.rpc(name, parameters);
      return {
        data,
        error: error ? { code: error.code, message: error.message } : null,
      };
    },
  };
}

export function createBrowserCatalogService(): CatalogService {
  const client = adaptCatalogRpcClient(getBrowserSupabaseClient());
  return new CatalogService(new SupabaseCatalogDataSource(client));
}
