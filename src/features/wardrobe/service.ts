import {
  CatalogProductSchema,
  RemoveEnvelopeSchema,
  SaveEnvelopeSchema,
  SessionResultSchema,
  WardrobeError,
  WardrobeSavedRowsSchema,
  type WardrobeItem,
} from './types';

export type EnsureWardrobeSessionInput = {
  sessionId: string;
  appVersion: string;
  platform: 'web_mobile' | 'web_desktop';
};

export interface WardrobeDataSource {
  ensureSession(input: EnsureWardrobeSessionInput): Promise<unknown>;
  readSavedProducts(): Promise<unknown>;
  readProduct(productId: string): Promise<unknown>;
  removeProduct(input: {
    savedProductId: string;
    operationId: string;
  }): Promise<unknown>;
  saveProduct(input: {
    productId: string;
    operationId: string;
  }): Promise<unknown>;
}

const inFlightLoads = new Map<string, Promise<WardrobeItem[]>>();

export class WardrobeService {
  constructor(private readonly source: WardrobeDataSource) {}

  async ensureSession(input: EnsureWardrobeSessionInput) {
    return this.parse(
      SessionResultSchema,
      await this.source.ensureSession(input),
      'session_contract_invalid',
      'The session response is not compatible with this build.',
    );
  }

  load(identityId: string): Promise<WardrobeItem[]> {
    const existing = inFlightLoads.get(identityId);
    if (existing) return existing;

    const request = this.loadCanonicalItems().finally(() => {
      globalThis.setTimeout(() => {
        if (inFlightLoads.get(identityId) === request) {
          inFlightLoads.delete(identityId);
        }
      }, 2_000);
    });
    inFlightLoads.set(identityId, request);
    return request;
  }

  invalidate(identityId: string) {
    inFlightLoads.delete(identityId);
  }

  async removeProduct(savedProductId: string, operationId: string) {
    return this.parse(
      RemoveEnvelopeSchema,
      await this.source.removeProduct({ savedProductId, operationId }),
      'mutation_contract_invalid',
      'The remove response is not compatible with this build.',
    );
  }

  async saveProduct(productId: string, operationId: string) {
    return this.parse(
      SaveEnvelopeSchema,
      await this.source.saveProduct({ productId, operationId }),
      'mutation_contract_invalid',
      'The save response is not compatible with this build.',
    );
  }

  private async loadCanonicalItems(): Promise<WardrobeItem[]> {
    const rows = this.parse(
      WardrobeSavedRowsSchema,
      await this.source.readSavedProducts(),
      'query_contract_invalid',
      'The Wardrobe response is not compatible with this build.',
    );
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.product_id)) {
        throw new WardrobeError(
          'duplicate_saved_product',
          false,
          'The Wardrobe contains duplicate active saved products.',
        );
      }
      seen.add(row.product_id);
    }

    const products = await Promise.all(
      rows.map(async (row) => {
        const raw = await this.source.readProduct(row.product_id);
        const parsed = CatalogProductSchema.array().safeParse(raw);
        if (!parsed.success || parsed.data.length > 1) {
          throw new WardrobeError(
            'product_contract_invalid',
            false,
            'Saved product metadata is not compatible with this build.',
            { cause: parsed.success ? undefined : parsed.error },
          );
        }
        return parsed.data[0] ?? null;
      }),
    );

    return rows.map((row, index) => ({
      savedProductId: row.id,
      productId: row.product_id,
      savedAt: row.saved_at,
      product: products[index] ?? null,
    }));
  }

  private parse<T>(
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false; error: unknown };
    },
    value: unknown,
    code:
      | 'query_contract_invalid'
      | 'session_contract_invalid'
      | 'mutation_contract_invalid',
    message: string,
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new WardrobeError(code, false, message, { cause: parsed.error });
    }
    return parsed.data;
  }
}
