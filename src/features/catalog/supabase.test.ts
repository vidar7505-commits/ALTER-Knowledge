import { describe, expect, it, vi } from 'vitest';

import { SupabaseCatalogDataSource } from './supabase';
import { catalogChallengeId, catalogProductFixture } from './test-fixtures';
import type { CatalogRpcClient } from './supabase';

function createClient(
  data: unknown = [catalogProductFixture(1)],
): CatalogRpcClient & { rpc: ReturnType<typeof vi.fn> } {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('SupabaseCatalogDataSource', () => {
  it('uses only the narrow active-product read RPC', async () => {
    const client = createClient();
    const source = new SupabaseCatalogDataSource(client);

    await source.listProducts({
      category: 'top',
      subcategory: 'shirt',
      slotId: 'top',
      afterId: null,
      limit: 21,
    });

    expect(client.rpc).toHaveBeenCalledWith('list_catalog_products', {
      p_category: 'top',
      p_subcategory: 'shirt',
      p_slot_id: 'top',
      p_after_id: null,
      p_limit: 21,
    });
  });

  it('uses narrow product-detail and Challenge-slot read RPCs', async () => {
    const product = catalogProductFixture(1);
    const client = createClient();
    const source = new SupabaseCatalogDataSource(client);

    await source.getProduct(product.id);
    await source.listProductsForChallengeSlot({
      challengeId: catalogChallengeId,
      slotId: 'top',
      afterId: product.id,
      limit: 6,
    });

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'get_catalog_product', {
      p_product_id: product.id,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(
      2,
      'list_products_for_challenge_slot',
      {
        p_challenge_id: catalogChallengeId,
        p_slot_id: 'top',
        p_after_id: product.id,
        p_limit: 6,
      },
    );
  });

  it('maps database errors without requiring service-role configuration', async () => {
    const client = createClient();
    client.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST001', message: 'unavailable' },
    });
    const source = new SupabaseCatalogDataSource(client);

    await expect(
      source.getProduct(catalogProductFixture(1).id),
    ).rejects.toMatchObject({
      code: 'query_unavailable',
      retryable: true,
    });

    expect(Object.keys(client)).toEqual(['rpc']);
  });
});
