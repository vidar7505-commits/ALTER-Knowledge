import {
  BatchResultSchema,
  DepthResultSchema,
  DISCOVER_FEED_ORDER_VERSION,
  DISCOVER_PAGE_SIZE,
  DiscoverError,
  FeedResultSchema,
  RemoveEnvelopeSchema,
  SaveEnvelopeSchema,
  SessionResultSchema,
  type DiscoverBatch,
  type DiscoverDepth,
  type DiscoverFeed,
  type DiscoverProduct,
  type DiscoverSession,
  type SavedProductState,
} from './types';

export type EnsureSessionInput = {
  sessionId: string;
  appVersion: string;
  platform: 'web_mobile' | 'web_desktop';
  entryRoute: string;
};

export interface DiscoverDataSource {
  ensureSession(input: EnsureSessionInput): Promise<unknown>;
  ensureFeed(sessionId: string): Promise<unknown>;
  appendBatch(input: {
    feedInstanceId: string;
    cursor: string | null;
    limit: number;
  }): Promise<unknown>;
  recordDepth(input: {
    sessionId: string;
    feedInstanceId: string;
    productId: string;
    position: number;
  }): Promise<unknown>;
  readSavedProducts(): Promise<unknown>;
  saveProduct(input: {
    productId: string;
    operationId: string;
    sourceSurface: 'discover';
  }): Promise<unknown>;
  removeProduct(input: {
    savedProductId: string;
    operationId: string;
  }): Promise<unknown>;
}

const inFlightBatches = new Map<string, Promise<DiscoverBatch>>();

export class DiscoverService {
  constructor(private readonly source: DiscoverDataSource) {}

  async ensureSession(input: EnsureSessionInput): Promise<DiscoverSession> {
    return this.parse(
      SessionResultSchema,
      await this.source.ensureSession(input),
      'session_contract_invalid',
      'The session response is not compatible with this build.',
    );
  }

  async ensureFeed(sessionId: string): Promise<DiscoverFeed> {
    const feed = this.parse(
      FeedResultSchema,
      await this.source.ensureFeed(sessionId),
      'feed_contract_invalid',
      'The feed response is not compatible with this build.',
    );
    if (feed.feed_order_version !== DISCOVER_FEED_ORDER_VERSION) {
      throw new DiscoverError(
        'unsupported_feed_version',
        false,
        'This feed version is not supported by the current build.',
      );
    }
    return feed;
  }

  loadBatch(input: {
    feedInstanceId: string;
    cursor: string | null;
    existingProducts: DiscoverProduct[];
    allowPartialStart?: boolean;
  }): Promise<DiscoverBatch> {
    const key = `${input.feedInstanceId}:${input.cursor ?? '__initial__'}`;
    const existing = inFlightBatches.get(key);
    if (existing) return existing;

    const request = this.source
      .appendBatch({
        feedInstanceId: input.feedInstanceId,
        cursor: input.cursor,
        limit: DISCOVER_PAGE_SIZE,
      })
      .then((value) => {
        const batch = this.parse(
          BatchResultSchema,
          value,
          'batch_contract_invalid',
          'The feed batch response is not compatible with this build.',
        );
        this.validateBatch(batch, input);
        return batch;
      })
      .finally(() => inFlightBatches.delete(key));

    inFlightBatches.set(key, request);
    return request;
  }

  async readSavedProducts(): Promise<SavedProductState[]> {
    const value = await this.source.readSavedProducts();
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
      return { savedProductId: row.id, productId: row.product_id };
    });
  }

  async saveProduct(productId: string, operationId: string) {
    return this.parse(
      SaveEnvelopeSchema,
      await this.source.saveProduct({
        productId,
        operationId,
        sourceSurface: 'discover',
      }),
      'save_contract_invalid',
      'The save response is not compatible with this build.',
    );
  }

  async removeProduct(savedProductId: string, operationId: string) {
    return this.parse(
      RemoveEnvelopeSchema,
      await this.source.removeProduct({ savedProductId, operationId }),
      'save_contract_invalid',
      'The remove response is not compatible with this build.',
    );
  }

  async recordDepth(input: {
    sessionId: string;
    feedInstanceId: string;
    productId: string;
    position: number;
  }): Promise<DiscoverDepth> {
    const result = this.parse(
      DepthResultSchema,
      await this.source.recordDepth(input),
      'depth_contract_invalid',
      'The feed depth response is not compatible with this build.',
    );
    if (
      result.session_id !== input.sessionId ||
      result.feed_instance_id !== input.feedInstanceId ||
      result.max_qualified_position < input.position
    ) {
      throw new DiscoverError(
        'depth_contract_invalid',
        false,
        'The feed depth response does not match the qualified product.',
      );
    }
    return result;
  }

  private validateBatch(
    batch: DiscoverBatch,
    input: {
      feedInstanceId: string;
      existingProducts: DiscoverProduct[];
      allowPartialStart?: boolean;
    },
  ) {
    if (
      batch.feed_instance_id !== input.feedInstanceId ||
      batch.returned_count !== batch.products.length
    ) {
      throw new DiscoverError(
        'feed_mismatch',
        false,
        'The returned batch does not belong to the active feed.',
      );
    }

    const existingIds = new Set(
      input.existingProducts.map((product) => product.product_id),
    );
    const existingPositions = new Set(
      input.existingProducts.map((product) => product.position),
    );
    const batchIds = new Set<string>();
    const batchPositions = new Set<number>();
    const expectedStart = (input.existingProducts.at(-1)?.position ?? 0) + 1;

    batch.products.forEach((product, index) => {
      if (
        existingIds.has(product.product_id) ||
        batchIds.has(product.product_id)
      ) {
        throw new DiscoverError(
          'duplicate_product',
          false,
          'The feed returned a duplicate product membership.',
        );
      }
      if (
        existingPositions.has(product.position) ||
        batchPositions.has(product.position)
      ) {
        throw new DiscoverError(
          'duplicate_position',
          false,
          'The feed returned a duplicate absolute position.',
        );
      }
      if (
        product.position !== expectedStart + index &&
        !(input.allowPartialStart && input.existingProducts.length === 0)
      ) {
        throw new DiscoverError(
          'skipped_position',
          false,
          'The feed returned a non-contiguous absolute position.',
        );
      }
      if (product.batch_number !== batch.batch_number) {
        throw new DiscoverError(
          'batch_contract_invalid',
          false,
          'The product batch number does not match its batch.',
        );
      }
      batchIds.add(product.product_id);
      batchPositions.add(product.position);
    });
  }

  private parse<T>(
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false; error: unknown };
    },
    value: unknown,
    code:
      | 'session_contract_invalid'
      | 'feed_contract_invalid'
      | 'batch_contract_invalid'
      | 'depth_contract_invalid'
      | 'save_contract_invalid',
    message: string,
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new DiscoverError(code, false, message, { cause: parsed.error });
    }
    return parsed.data;
  }
}
