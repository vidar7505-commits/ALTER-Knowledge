import { describe, expect, it, vi } from 'vitest';

import {
  DiscoverService,
  type DiscoverDataSource,
  type EnsureSessionInput,
} from './service';
import {
  discoverBatchFixture,
  discoverFeedFixture,
  discoverFeedId,
  discoverProductFixture,
  discoverSessionFixture,
} from './test-fixtures';
import { DISCOVER_PAGE_SIZE } from './types';

function source(
  overrides: Partial<DiscoverDataSource> = {},
): DiscoverDataSource {
  return {
    ensureSession: vi.fn(async () => discoverSessionFixture),
    ensureFeed: vi.fn(async () => discoverFeedFixture),
    appendBatch: vi.fn(async () => discoverBatchFixture()),
    recordDepth: vi.fn(async (input) => ({
      session_id: input.sessionId,
      feed_instance_id: input.feedInstanceId,
      max_qualified_position: input.position,
    })),
    readSavedProducts: vi.fn(async () => []),
    saveProduct: vi.fn(async (input) => ({
      ok: true,
      operation_id: input.operationId,
      data: {
        saved_product_id: 'd3000000-0000-4000-8000-000000000001',
        product_id: input.productId,
        saved_at: '2026-07-25T10:00:00.000Z',
      },
    })),
    removeProduct: vi.fn(async (input) => ({
      ok: true,
      operation_id: input.operationId,
      data: {
        saved_product_id: input.savedProductId,
        product_id: discoverProductFixture(1).product_id,
        removed_at: '2026-07-25T10:00:00.000Z',
      },
    })),
    ...overrides,
  };
}

describe('DiscoverService', () => {
  it('ensures the session without ownership fields', async () => {
    const dataSource = source();
    const service = new DiscoverService(dataSource);
    const input: EnsureSessionInput = {
      sessionId: discoverSessionFixture.session_id,
      appVersion: '0.1.0',
      platform: 'web_mobile',
      entryRoute: '/discover',
    };

    await expect(service.ensureSession(input)).resolves.toEqual(
      discoverSessionFixture,
    );
    expect(dataSource.ensureSession).toHaveBeenCalledWith(input);
    expect(JSON.stringify(input)).not.toMatch(
      /anonymous_user_id|anonymousUserId|owner|environment|is_test/,
    );
  });

  it('requires the canonical feed version', async () => {
    const dataSource = source({
      ensureFeed: vi.fn(async () => ({
        ...discoverFeedFixture,
        feed_order_version: 'unsupported-v2',
      })),
    });
    await expect(
      new DiscoverService(dataSource).ensureFeed(
        discoverSessionFixture.session_id,
      ),
    ).rejects.toMatchObject({
      code: 'feed_contract_invalid',
      retryable: false,
    });
  });

  it('passes the opaque cursor unchanged with page size 24', async () => {
    const cursor = `lr001-feed-cursor-v1.${'b'.repeat(64)}`;
    const dataSource = source();
    await new DiscoverService(dataSource).loadBatch({
      feedInstanceId: discoverFeedId,
      cursor,
      existingProducts: [],
    });
    expect(dataSource.appendBatch).toHaveBeenCalledWith({
      feedInstanceId: discoverFeedId,
      cursor,
      limit: DISCOVER_PAGE_SIZE,
    });
  });

  it('deduplicates concurrent requests for one feed/cursor pair', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise<unknown>((done) => {
      resolve = done;
    });
    const dataSource = source({ appendBatch: vi.fn(() => pending) });
    const service = new DiscoverService(dataSource);
    const input = {
      feedInstanceId: discoverFeedId,
      cursor: `lr001-feed-cursor-v1.${'c'.repeat(64)}`,
      existingProducts: [],
    };
    const first = service.loadBatch(input);
    const second = service.loadBatch(input);
    resolve(discoverBatchFixture());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(dataSource.appendBatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'duplicate_product',
      discoverBatchFixture(2, 1, {
        products: [
          discoverProductFixture(2, {
            product_id: discoverProductFixture(1).product_id,
          }),
        ],
      }),
    ],
    [
      'duplicate_position',
      discoverBatchFixture(2, 1, {
        products: [discoverProductFixture(2, { position: 1 })],
      }),
    ],
    [
      'skipped_position',
      discoverBatchFixture(3, 1, {
        products: [discoverProductFixture(3)],
      }),
    ],
  ])('surfaces %s as a typed contract failure', async (code, batch) => {
    const service = new DiscoverService(
      source({ appendBatch: vi.fn(async () => batch) }),
    );
    await expect(
      service.loadBatch({
        feedInstanceId: discoverFeedId,
        cursor: `lr001-feed-cursor-v1.${code.padEnd(64, 'd')}`,
        existingProducts: [discoverProductFixture(1)],
      }),
    ).rejects.toMatchObject({ code, retryable: false });
  });

  it('parses canonical save and remove responses with stable operation IDs', async () => {
    const service = new DiscoverService(source());
    const operationId = 'd4000000-0000-4000-8000-000000000001';
    const productId = discoverProductFixture(1).product_id;
    const saved = await service.saveProduct(productId, operationId);
    expect(saved.operation_id).toBe(operationId);
    const removed = await service.removeProduct(
      saved.data.saved_product_id,
      operationId,
    );
    expect(removed.operation_id).toBe(operationId);
  });
});
