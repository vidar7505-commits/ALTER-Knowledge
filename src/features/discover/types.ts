import { z } from 'zod';

import {
  CatalogImageMetadataSchema,
  catalogCategories,
} from '@/features/catalog/types';

export const DISCOVER_FEED_ORDER_VERSION = 'lr001-catalog-order-v1' as const;
export const DISCOVER_PAGE_SIZE = 24;

const nonEmptyText = z.string().trim().min(1).max(320);
const nullablePrice = z
  .union([
    z.number().nonnegative().finite(),
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .transform(Number),
  ])
  .nullable();

export const DiscoverProductSchema = z
  .strictObject({
    product_id: z.uuid(),
    position: z.int().positive(),
    batch_number: z.int().positive(),
    name: nonEmptyText,
    brand: nonEmptyText,
    category: z.enum(catalogCategories),
    subcategory: nonEmptyText.nullable(),
    image_urls: z.array(z.url()).min(1),
    image_metadata: CatalogImageMetadataSchema,
    price_amount: nullablePrice,
    price_currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    catalog_version: z.literal('lr001-catalog-v1'),
  })
  .superRefine((product, context) => {
    if ((product.price_amount === null) !== (product.price_currency === null)) {
      context.addIssue({
        code: 'custom',
        message: 'price amount and currency must be present together',
      });
    }

    const primary =
      product.image_metadata.images[product.image_metadata.primary_index];
    if (
      !primary ||
      primary.url !== product.image_urls[product.image_metadata.primary_index]
    ) {
      context.addIssue({
        code: 'custom',
        message: 'primary product image is inconsistent',
      });
    }
  });

export type DiscoverProduct = z.infer<typeof DiscoverProductSchema>;

export const SessionResultSchema = z.strictObject({
  session_id: z.uuid(),
  session_number: z.int().positive(),
  is_return_session: z.boolean(),
  started_at: z.iso.datetime({ offset: true }),
});

export const FeedResultSchema = z.strictObject({
  feed_instance_id: z.uuid(),
  last_cursor: z.string().nullable(),
  max_loaded_position: z.int().min(0),
  max_qualified_position: z.int().min(0),
  is_exhausted: z.boolean(),
  feed_order_version: z.literal(DISCOVER_FEED_ORDER_VERSION),
  onboarding_version: nonEmptyText,
  preference_ids: z.array(nonEmptyText),
});

export const BatchResultSchema = z.strictObject({
  feed_instance_id: z.uuid(),
  batch_number: z.int().positive(),
  returned_count: z.int().min(0).max(DISCOVER_PAGE_SIZE),
  next_cursor: z.string().nullable(),
  is_exhausted: z.boolean(),
  products: z.array(DiscoverProductSchema).max(DISCOVER_PAGE_SIZE),
});

export const DepthResultSchema = z.strictObject({
  feed_instance_id: z.uuid(),
  session_id: z.uuid(),
  max_qualified_position: z.int().positive(),
});

const SaveEnvelopeSchema = z.strictObject({
  ok: z.literal(true),
  operation_id: z.uuid(),
  data: z.strictObject({
    saved_product_id: z.uuid(),
    product_id: z.uuid(),
    saved_at: z.iso.datetime({ offset: true }),
  }),
});

const RemoveEnvelopeSchema = z.strictObject({
  ok: z.literal(true),
  operation_id: z.uuid(),
  data: z.strictObject({
    saved_product_id: z.uuid(),
    product_id: z.uuid(),
    removed_at: z.iso.datetime({ offset: true }),
  }),
});

export { RemoveEnvelopeSchema, SaveEnvelopeSchema };

export type DiscoverSession = z.infer<typeof SessionResultSchema>;
export type DiscoverFeed = z.infer<typeof FeedResultSchema>;
export type DiscoverBatch = z.infer<typeof BatchResultSchema>;
export type DiscoverDepth = z.infer<typeof DepthResultSchema>;

export type SavedProductState = {
  savedProductId: string;
  productId: string;
};

export type DiscoverErrorCode =
  | 'transport_unavailable'
  | 'session_contract_invalid'
  | 'feed_contract_invalid'
  | 'batch_contract_invalid'
  | 'depth_contract_invalid'
  | 'save_contract_invalid'
  | 'unsupported_feed_version'
  | 'duplicate_product'
  | 'duplicate_position'
  | 'skipped_position'
  | 'feed_mismatch'
  | 'operation_conflict';

export class DiscoverError extends Error {
  constructor(
    readonly code: DiscoverErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DiscoverError';
  }
}

export type DiscoverStatus =
  | 'idle'
  | 'resolving_session'
  | 'resolving_feed'
  | 'restoring'
  | 'loading_initial'
  | 'ready'
  | 'loading_more'
  | 'exhausted'
  | 'recoverable_initial_error'
  | 'recoverable_pagination_error'
  | 'unrecoverable_error';

export type DiscoverState = {
  status: DiscoverStatus;
  session: DiscoverSession | null;
  feed: DiscoverFeed | null;
  products: DiscoverProduct[];
  savedProducts: Record<string, string>;
  cursor: string | null;
  requestCursors: Array<string | null>;
  error: DiscoverError | null;
};

export const initialDiscoverState: DiscoverState = {
  status: 'idle',
  session: null,
  feed: null,
  products: [],
  savedProducts: {},
  cursor: null,
  requestCursors: [],
  error: null,
};
