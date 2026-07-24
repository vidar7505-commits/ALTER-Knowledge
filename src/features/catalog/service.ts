import { z } from 'zod';

import {
  CATALOG_CURSOR_VERSION,
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_MAX_PAGE_SIZE,
  CatalogError,
  CatalogProductSchema,
  catalogSlotIds,
  type CatalogCategory,
  type CatalogPage,
  type CatalogProduct,
  type CatalogProductResult,
  type CatalogSlotId,
} from './types';

const cursorPattern = new RegExp(
  `^${CATALOG_CURSOR_VERSION}:([0-9a-fA-F-]{36})$`,
);

export type CatalogListQuery = {
  category: CatalogCategory | null;
  subcategory: string | null;
  slotId: CatalogSlotId | null;
  afterId: string | null;
  limit: number;
};

export type CatalogChallengeSlotQuery = {
  challengeId: string;
  slotId: CatalogSlotId;
  afterId: string | null;
  limit: number;
};

export interface CatalogDataSource {
  listProducts(query: CatalogListQuery): Promise<unknown>;
  getProduct(productId: string): Promise<unknown>;
  listProductsForChallengeSlot(
    query: CatalogChallengeSlotQuery,
  ): Promise<unknown>;
}

export type ListProductsInput = {
  category?: CatalogCategory;
  subcategory?: string;
  slotId?: CatalogSlotId;
  cursor?: string;
  limit?: number;
};

export type ListChallengeProductsInput = {
  challengeId: string;
  slotId: CatalogSlotId;
  cursor?: string;
  limit?: number;
};

export class CatalogService {
  constructor(private readonly dataSource: CatalogDataSource) {}

  async listProducts(input: ListProductsInput = {}): Promise<CatalogPage> {
    const limit = parseLimit(input.limit);
    const products = await this.parseProducts(
      this.dataSource.listProducts({
        category: input.category ?? null,
        subcategory: parseOptionalFilter(input.subcategory),
        slotId: input.slotId ?? null,
        afterId: decodeCatalogCursor(input.cursor),
        limit: limit + 1,
      }),
    );

    return toPage(products, limit);
  }

  async getProduct(productId: string): Promise<CatalogProductResult> {
    if (!z.uuid().safeParse(productId).success) {
      throw new CatalogError(
        'invalid_request',
        false,
        'Product ID must be a UUID.',
      );
    }

    const products = await this.parseProducts(
      this.dataSource.getProduct(productId),
    );

    if (products.length > 1) {
      throw new CatalogError(
        'invalid_response',
        false,
        'Product detail returned more than one canonical product.',
      );
    }

    const product = products[0];
    return product
      ? { status: 'found', product }
      : { status: 'not_found', productId };
  }

  async listProductsForChallengeSlot(
    input: ListChallengeProductsInput,
  ): Promise<CatalogPage> {
    if (!z.uuid().safeParse(input.challengeId).success) {
      throw new CatalogError(
        'invalid_request',
        false,
        'Challenge ID must be a UUID.',
      );
    }

    if (!z.enum(catalogSlotIds).safeParse(input.slotId).success) {
      throw new CatalogError(
        'invalid_request',
        false,
        'Challenge slot is not supported.',
      );
    }

    const limit = parseLimit(input.limit);
    const products = await this.parseProducts(
      this.dataSource.listProductsForChallengeSlot({
        challengeId: input.challengeId,
        slotId: input.slotId,
        afterId: decodeCatalogCursor(input.cursor),
        limit: limit + 1,
      }),
    );

    if (
      products.some(
        (product) => !product.slot_eligibility.includes(input.slotId),
      )
    ) {
      throw new CatalogError(
        'invalid_response',
        false,
        'Challenge catalog returned an ineligible product.',
      );
    }

    return toPage(products, limit);
  }

  private async parseProducts(
    pendingRows: Promise<unknown>,
  ): Promise<CatalogProduct[]> {
    const rows = await pendingRows;
    const parsed = z.array(CatalogProductSchema).safeParse(rows);

    if (!parsed.success) {
      throw new CatalogError(
        'invalid_response',
        false,
        'Catalog query returned malformed product data.',
        { cause: parsed.error },
      );
    }

    for (let index = 1; index < parsed.data.length; index += 1) {
      const prior = parsed.data[index - 1];
      const current = parsed.data[index];
      if (!prior || !current || prior.id >= current.id) {
        throw new CatalogError(
          'invalid_response',
          false,
          'Catalog products must be strictly ordered by canonical ID.',
        );
      }
    }

    return parsed.data;
  }
}

export function encodeCatalogCursor(productId: string): string {
  if (!z.uuid().safeParse(productId).success) {
    throw new CatalogError(
      'invalid_request',
      false,
      'Cursor product ID must be a UUID.',
    );
  }

  return `${CATALOG_CURSOR_VERSION}:${productId}`;
}

export function decodeCatalogCursor(cursor?: string): string | null {
  if (cursor === undefined) {
    return null;
  }

  const match = cursorPattern.exec(cursor);
  const productId = match?.[1];
  if (!productId || !z.uuid().safeParse(productId).success) {
    throw new CatalogError(
      'invalid_cursor',
      false,
      'Catalog cursor is invalid or unsupported.',
    );
  }

  return productId;
}

function parseLimit(limit = CATALOG_DEFAULT_PAGE_SIZE): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > CATALOG_MAX_PAGE_SIZE) {
    throw new CatalogError(
      'invalid_request',
      false,
      `Catalog limit must be between 1 and ${CATALOG_MAX_PAGE_SIZE}.`,
    );
  }

  return limit;
}

function parseOptionalFilter(value?: string): string | null {
  if (value === undefined) {
    return null;
  }

  const parsed = z.string().trim().min(1).max(128).safeParse(value);
  if (!parsed.success) {
    throw new CatalogError(
      'invalid_request',
      false,
      'Catalog filter must be non-empty.',
    );
  }

  return parsed.data;
}

function toPage(products: CatalogProduct[], limit: number): CatalogPage {
  const hasNextPage = products.length > limit;
  const items = products.slice(0, limit);
  const finalProduct = items.at(-1);

  return {
    items,
    nextCursor:
      hasNextPage && finalProduct ? encodeCatalogCursor(finalProduct.id) : null,
  };
}
