import { describe, expect, it } from 'vitest';

import {
  CatalogService,
  decodeCatalogCursor,
  encodeCatalogCursor,
} from './service';
import { InMemoryCatalogDataSource } from './test-double';
import {
  catalogChallengeId,
  catalogProductFixture,
  catalogProductFixtures,
} from './test-fixtures';
import { CatalogError } from './types';

function createService(count = 8) {
  const dataSource = new InMemoryCatalogDataSource(
    catalogProductFixtures(count),
    catalogChallengeId,
  );
  return { dataSource, service: new CatalogService(dataSource) };
}

describe('CatalogService', () => {
  it('returns active products in stable canonical order', async () => {
    const products = catalogProductFixtures(6).toReversed();
    const service = new CatalogService(
      new InMemoryCatalogDataSource(products, catalogChallengeId),
    );

    const page = await service.listProducts({ limit: 6 });

    expect(page.items.map((product) => product.id)).toEqual(
      catalogProductFixtures(6).map((product) => product.id),
    );
    expect(page.nextCursor).toBeNull();
  });

  it('supports category and subcategory filtering with stable empty results', async () => {
    const { service } = createService();

    await expect(
      service.listProducts({ category: 'top', limit: 8 }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({ category: 'top' }),
        expect.objectContaining({ category: 'top' }),
      ],
      nextCursor: null,
    });

    await expect(
      service.listProducts({
        subcategory: 'missing-subcategory',
        limit: 8,
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('returns canonical product detail and a typed not-found result', async () => {
    const { service } = createService();
    const productId = catalogProductFixture(2).id;
    const unknownId = 'c0800000-0000-4000-8000-000000000099';

    await expect(service.getProduct(productId)).resolves.toMatchObject({
      status: 'found',
      product: { id: productId },
    });
    await expect(service.getProduct(unknownId)).resolves.toEqual({
      status: 'not_found',
      productId: unknownId,
    });
  });

  it('filters products through the canonical Challenge slot boundary', async () => {
    const { service } = createService();

    const page = await service.listProductsForChallengeSlot({
      challengeId: catalogChallengeId,
      slotId: 'shoes',
      limit: 8,
    });

    expect(page.items).toHaveLength(2);
    expect(
      page.items.every((product) => product.slot_eligibility.includes('shoes')),
    ).toBe(true);
  });

  it('paginates without duplicates or skipped products', async () => {
    const { service } = createService(11);
    const seen: string[] = [];
    let cursor: string | undefined;

    do {
      const page = await service.listProducts({
        cursor,
        limit: 4,
      });
      seen.push(...page.items.map((product) => product.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toEqual(
      catalogProductFixtures(11).map((product) => product.id),
    );
    expect(new Set(seen).size).toBe(11);
  });

  it('uses a versioned, secrets-free cursor and rejects invalid cursors', () => {
    const productId = catalogProductFixture(1).id;
    const cursor = encodeCatalogCursor(productId);

    expect(cursor).toBe(`catalog-v1:${productId}`);
    expect(decodeCatalogCursor(cursor)).toBe(productId);
    expect(() => decodeCatalogCursor('catalog-v2:secret')).toThrowError(
      expect.objectContaining({ code: 'invalid_cursor' }),
    );
  });

  it('rejects invalid request bounds before querying the data source', async () => {
    const { dataSource, service } = createService();

    await expect(service.listProducts({ limit: 0 })).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(service.getProduct('not-a-uuid')).rejects.toMatchObject({
      code: 'invalid_request',
    });
    expect(dataSource.operations).toEqual([]);
  });

  it('rejects inactive or malformed rows instead of leaking them', async () => {
    const product = catalogProductFixture(1);
    const service = new CatalogService({
      async listProducts() {
        return [{ ...product, is_active: false }];
      },
      async getProduct() {
        return [];
      },
      async listProductsForChallengeSlot() {
        return [];
      },
    });

    await expect(service.listProducts()).rejects.toBeInstanceOf(CatalogError);
    await expect(service.listProducts()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('exposes read operations only through its injected data source', async () => {
    const { dataSource, service } = createService();

    await service.listProducts({ limit: 2 });
    await service.getProduct(catalogProductFixture(1).id);
    await service.listProductsForChallengeSlot({
      challengeId: catalogChallengeId,
      slotId: 'top',
      limit: 2,
    });

    expect(dataSource.operations).toEqual([
      'list',
      'get',
      'list_for_challenge_slot',
    ]);
  });
});
