import { z } from 'zod';

import {
  CatalogProductSchema,
  type CatalogProduct,
} from '@/features/catalog/types';
import {
  RemoveEnvelopeSchema,
  SaveEnvelopeSchema,
  SessionResultSchema,
} from '@/features/discover/types';

const SavedRowSchema = z.strictObject({
  id: z.uuid(),
  product_id: z.uuid(),
  saved_at: z.iso.datetime({ offset: true }),
});

export const WardrobeSavedRowsSchema = z.array(SavedRowSchema);
export {
  CatalogProductSchema,
  RemoveEnvelopeSchema,
  SaveEnvelopeSchema,
  SessionResultSchema,
};

export type WardrobeItem = {
  savedProductId: string;
  productId: string;
  savedAt: string;
  product: CatalogProduct | null;
};

export type WardrobeErrorCode =
  | 'transport_unavailable'
  | 'session_expired'
  | 'query_contract_invalid'
  | 'product_contract_invalid'
  | 'session_contract_invalid'
  | 'mutation_contract_invalid'
  | 'duplicate_saved_product'
  | 'operation_conflict';

export class WardrobeError extends Error {
  constructor(
    readonly code: WardrobeErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WardrobeError';
  }
}

export type WardrobeState =
  | { status: 'idle' | 'loading'; items: WardrobeItem[] }
  | { status: 'ready'; items: WardrobeItem[] }
  | { status: 'empty'; items: [] }
  | { status: 'removing'; items: WardrobeItem[]; productId: string }
  | {
      status: 'undo_available';
      items: WardrobeItem[];
      removedItem: WardrobeItem;
    }
  | {
      status: 'recoverable_error' | 'unrecoverable_error';
      items: [];
      error: WardrobeError;
    };

export type WardrobeMutationTask = {
  action: 'remove' | 'undo';
  operationId: string;
  busy: boolean;
  error: boolean;
};
