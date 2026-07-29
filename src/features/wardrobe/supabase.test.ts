import { describe, expect, it, vi } from 'vitest';

import { SupabaseWardrobeDataSource } from './supabase';

describe('SupabaseWardrobeDataSource', () => {
  it('reads active rows with deterministic recent-first ordering', async () => {
    const order = vi.fn().mockReturnThis();
    const is = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ is });
    const from = vi.fn().mockReturnValue({ select });
    order
      .mockReturnValueOnce({ order })
      .mockResolvedValueOnce({ data: [], error: null });
    const source = new SupabaseWardrobeDataSource({ from } as never);

    await source.readSavedProducts();

    expect(from).toHaveBeenCalledWith('saved_products');
    expect(select).toHaveBeenCalledWith('id,product_id,saved_at');
    expect(is).toHaveBeenCalledWith('removed_at', null);
    expect(order).toHaveBeenNthCalledWith(1, 'saved_at', {
      ascending: false,
    });
    expect(order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
  });

  it('uses approved read and mutation RPCs without owner IDs or direct writes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const source = new SupabaseWardrobeDataSource({ rpc } as never);
    await source.ensureSession({
      sessionId: '30000000-0000-4000-8000-000000000001',
      appVersion: '0.1.0',
      platform: 'web_mobile',
    });
    await source.readProduct('c0800000-0000-4000-8000-000000000001');
    await source.removeProduct({
      savedProductId: '70000000-0000-4000-8000-000000000001',
      operationId: '80000000-0000-4000-8000-000000000001',
    });
    await source.saveProduct({
      productId: 'c0800000-0000-4000-8000-000000000001',
      operationId: '80000000-0000-4000-8000-000000000002',
    });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'ensure_session',
      'get_catalog_product',
      'remove_product',
      'save_product',
    ]);
    expect(rpc.mock.calls[2]?.[1]).toEqual({
      saved_product_id: '70000000-0000-4000-8000-000000000001',
      operation_id: '80000000-0000-4000-8000-000000000001',
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(
      /anonymous_user_id|owner_id|user_id|service_role/,
    );
  });
});
