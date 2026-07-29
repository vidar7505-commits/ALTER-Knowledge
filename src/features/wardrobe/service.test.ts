import { describe, expect, it, vi } from 'vitest';

import { catalogProductFixture } from '@/features/catalog/test-fixtures';

import { WardrobeService, type WardrobeDataSource } from './service';

const session = {
  session_id: '30000000-0000-4000-8000-000000000001',
  session_number: 1,
  is_return_session: false,
  started_at: '2026-07-29T10:00:00.000Z',
};
const savedOne = '70000000-0000-4000-8000-000000000001';
const savedTwo = '70000000-0000-4000-8000-000000000002';
const operation = '80000000-0000-4000-8000-000000000001';

function source(
  rows: unknown[] = [
    {
      id: savedTwo,
      product_id: catalogProductFixture(2).id,
      saved_at: '2026-07-29T12:00:00.000Z',
    },
    {
      id: savedOne,
      product_id: catalogProductFixture(1).id,
      saved_at: '2026-07-29T11:00:00.000Z',
    },
  ],
): WardrobeDataSource {
  return {
    ensureSession: vi.fn().mockResolvedValue(session),
    readSavedProducts: vi.fn().mockResolvedValue(rows),
    readProduct: vi.fn().mockImplementation((productId: string) => {
      const index = productId.endsWith('2') ? 2 : 1;
      return Promise.resolve([catalogProductFixture(index)]);
    }),
    removeProduct: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: operation,
      data: {
        saved_product_id: savedOne,
        product_id: catalogProductFixture(1).id,
        removed_at: '2026-07-29T12:30:00.000Z',
      },
    }),
    saveProduct: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: operation,
      data: {
        saved_product_id: savedOne,
        product_id: catalogProductFixture(1).id,
        saved_at: '2026-07-29T12:30:00.000Z',
      },
    }),
  };
}

describe('WardrobeService', () => {
  it('loads active saved rows in the canonical source order with product data', async () => {
    const result = await new WardrobeService(source()).load('identity-one');

    expect(result.map((item) => item.savedProductId)).toEqual([
      savedTwo,
      savedOne,
    ]);
    expect(result.map((item) => item.product?.name)).toEqual([
      'Canonical Product 2',
      'Canonical Product 1',
    ]);
  });

  it('represents inactive or unavailable product metadata honestly', async () => {
    const dataSource = source();
    vi.mocked(dataSource.readProduct).mockResolvedValue([]);

    const [item] = await new WardrobeService(dataSource).load('identity-two');
    expect(item?.product).toBeNull();
  });

  it('rejects duplicate active product rows rather than showing duplicates', async () => {
    const duplicate = {
      id: savedTwo,
      product_id: catalogProductFixture(1).id,
      saved_at: '2026-07-29T12:00:00.000Z',
    };
    await expect(
      new WardrobeService(
        source([
          duplicate,
          {
            ...duplicate,
            id: savedOne,
            saved_at: '2026-07-29T11:00:00.000Z',
          },
        ]),
      ).load('identity-three'),
    ).rejects.toMatchObject({
      code: 'duplicate_saved_product',
      retryable: false,
    });
  });

  it('rejects malformed saved and product contracts', async () => {
    await expect(
      new WardrobeService(source([{ product_id: 'raw' }])).load(
        'identity-four',
      ),
    ).rejects.toMatchObject({ code: 'query_contract_invalid' });

    const dataSource = source();
    vi.mocked(dataSource.readProduct).mockResolvedValue([{ id: 'raw' }]);
    await expect(
      new WardrobeService(dataSource).load('identity-five'),
    ).rejects.toMatchObject({ code: 'product_contract_invalid' });
  });

  it('uses saved_product_id for remove and a new save operation for Undo', async () => {
    const dataSource = source();
    const service = new WardrobeService(dataSource);
    await service.removeProduct(savedOne, operation);
    await service.saveProduct(catalogProductFixture(1).id, operation);

    expect(dataSource.removeProduct).toHaveBeenCalledWith({
      savedProductId: savedOne,
      operationId: operation,
    });
    expect(dataSource.saveProduct).toHaveBeenCalledWith({
      productId: catalogProductFixture(1).id,
      operationId: operation,
    });
  });
});
