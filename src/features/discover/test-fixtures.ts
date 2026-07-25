import { catalogProductFixture } from '@/features/catalog/test-fixtures';

import type {
  DiscoverBatch,
  DiscoverFeed,
  DiscoverProduct,
  DiscoverSession,
} from './types';

export const discoverSessionId = 'd1000000-0000-4000-8000-000000000001';
export const discoverFeedId = 'd2000000-0000-4000-8000-000000000001';

export const discoverSessionFixture: DiscoverSession = {
  session_id: discoverSessionId,
  session_number: 1,
  is_return_session: false,
  started_at: '2026-07-25T10:00:00.000Z',
};

export const discoverFeedFixture: DiscoverFeed = {
  feed_instance_id: discoverFeedId,
  last_cursor: null,
  max_loaded_position: 0,
  max_qualified_position: 0,
  is_exhausted: false,
  feed_order_version: 'lr001-catalog-order-v1',
  onboarding_version: 'onboarding-style-v1',
  preference_ids: ['minimal'],
};

export function discoverProductFixture(
  position: number,
  overrides: Partial<DiscoverProduct> = {},
): DiscoverProduct {
  const catalog = catalogProductFixture(position);
  return {
    product_id: catalog.id,
    position,
    batch_number: Math.ceil(position / 24),
    name: catalog.name,
    brand: catalog.brand,
    category: catalog.category,
    subcategory: catalog.subcategory,
    image_urls: catalog.image_urls,
    image_metadata: catalog.image_metadata,
    price_amount: catalog.price_amount,
    price_currency: catalog.price_currency,
    catalog_version: catalog.catalog_version,
    ...overrides,
  };
}

export function discoverBatchFixture(
  start = 1,
  count = 3,
  overrides: Partial<DiscoverBatch> = {},
): DiscoverBatch {
  const products = Array.from({ length: count }, (_, index) =>
    discoverProductFixture(start + index),
  );
  return {
    feed_instance_id: discoverFeedId,
    batch_number: products[0]?.batch_number ?? 1,
    returned_count: count,
    next_cursor: count > 0 ? `lr001-feed-cursor-v1.${'a'.repeat(64)}` : null,
    is_exhausted: false,
    products,
    ...overrides,
  };
}
