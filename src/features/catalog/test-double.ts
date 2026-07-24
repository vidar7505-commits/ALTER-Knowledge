import type {
  CatalogChallengeSlotQuery,
  CatalogDataSource,
  CatalogListQuery,
} from './service';
import type { CatalogProduct } from './types';

export class InMemoryCatalogDataSource implements CatalogDataSource {
  readonly operations: string[] = [];

  constructor(
    private readonly products: CatalogProduct[],
    private readonly challengeId: string,
  ) {}

  async listProducts(query: CatalogListQuery): Promise<unknown> {
    this.operations.push('list');
    return this.select(query);
  }

  async getProduct(productId: string): Promise<unknown> {
    this.operations.push('get');
    return this.products.filter(
      (product) => product.is_active && product.id === productId,
    );
  }

  async listProductsForChallengeSlot(
    query: CatalogChallengeSlotQuery,
  ): Promise<unknown> {
    this.operations.push('list_for_challenge_slot');
    if (query.challengeId !== this.challengeId) {
      return [];
    }

    return this.select({
      category: null,
      subcategory: null,
      slotId: query.slotId,
      afterId: query.afterId,
      limit: query.limit,
    });
  }

  private select(query: CatalogListQuery): CatalogProduct[] {
    return this.products
      .filter(
        (product) =>
          product.is_active &&
          (query.category === null || product.category === query.category) &&
          (query.subcategory === null ||
            product.subcategory === query.subcategory) &&
          (query.slotId === null ||
            product.slot_eligibility.includes(query.slotId)) &&
          (query.afterId === null || product.id > query.afterId),
      )
      .toSorted((left, right) => left.id.localeCompare(right.id))
      .slice(0, query.limit);
  }
}
