import { z } from 'zod';

import {
  CatalogProductSchema,
  catalogSlotIds,
  type CatalogProduct,
  type CatalogSlotId,
} from '@/features/catalog/types';

export const CHALLENGE_ID = 'c0810000-0000-4000-8000-000000000001';
export const CHALLENGE_VERSION = 'challenge-evening-v1';

export const ChallengeSlotSchema = z.strictObject({
  slot_id: z.enum(catalogSlotIds),
  label: z.string().trim().min(1).max(80),
  display_order: z.int().positive(),
});

export const ChallengeDefinitionSchema = z.strictObject({
  id: z.uuid(),
  version: z.literal(CHALLENGE_VERSION),
  title: z.literal('After Dark'),
  context_copy: z.literal('Build a look for an evening out.'),
  required_slots: z.array(ChallengeSlotSchema).length(4),
  completion_rules: z.strictObject({
    required_slot_count: z.literal(4),
    unique_products: z.literal(true),
    explicit_confirmation: z.literal(true),
  }),
  is_active: z.literal(true),
});

export const ChallengeStatusSchema = z.enum([
  'in_progress',
  'ready_to_complete',
  'completed',
  'invalidated',
]);

export const ChallengeProgressSchema = z.strictObject({
  id: z.uuid(),
  challenge_id: z.uuid(),
  status: ChallengeStatusSchema,
  started_at: z.iso.datetime({ offset: true }),
  state_revision: z.int().nonnegative(),
});

export const ChallengeProgressItemSchema = z.strictObject({
  id: z.uuid(),
  challenge_progress_id: z.uuid(),
  slot_id: z.enum(catalogSlotIds),
  product_id: z.uuid(),
  selected_at: z.iso.datetime({ offset: true }),
});

export const ChallengeCompletionSchema = z.strictObject({
  id: z.uuid(),
  challenge_progress_id: z.uuid(),
  completed_at: z.iso.datetime({ offset: true }),
  selected_products_snapshot: z.strictObject({
    items: z.array(
      z.strictObject({
        slot_id: z.enum(catalogSlotIds),
        product_id: z.uuid(),
        name: z.string().trim().min(1),
        brand: z.string().trim().min(1),
        category: z.string().trim().min(1),
        image_urls: z.array(z.url()).min(1),
      }),
    ),
  }),
});

const MutationBaseSchema = z.strictObject({
  ok: z.literal(true),
  operation_id: z.uuid(),
  state_revision: z.int().nonnegative(),
});

export const StartChallengeEnvelopeSchema = MutationBaseSchema.extend({
  data: z.strictObject({
    challenge_progress_id: z.uuid(),
    status: ChallengeStatusSchema,
  }),
});

export const SelectChallengeEnvelopeSchema = MutationBaseSchema.extend({
  data: z.strictObject({
    challenge_progress_item_id: z.uuid(),
    slot_id: z.enum(catalogSlotIds),
    product_id: z.uuid(),
    status: ChallengeStatusSchema,
  }),
});

export const RemoveChallengeEnvelopeSchema = MutationBaseSchema.extend({
  data: z.strictObject({
    challenge_progress_item_id: z.uuid(),
    slot_id: z.enum(catalogSlotIds),
    product_id: z.uuid(),
    removed_at: z.iso.datetime({ offset: true }),
    status: ChallengeStatusSchema,
  }),
});

export const CompleteChallengeEnvelopeSchema = MutationBaseSchema.extend({
  data: z.strictObject({
    challenge_completion_id: z.uuid(),
    completed_at: z.iso.datetime({ offset: true }),
  }),
});

export type ChallengeDefinition = z.infer<typeof ChallengeDefinitionSchema>;
export type ChallengeProgress = z.infer<typeof ChallengeProgressSchema>;
export type ChallengeProgressItem = z.infer<typeof ChallengeProgressItemSchema>;
export type ChallengeCompletion = z.infer<typeof ChallengeCompletionSchema>;

export type ChallengeSelection = {
  progressItemId: string;
  slotId: CatalogSlotId;
  productId: string;
  product: Pick<
    CatalogProduct,
    'id' | 'name' | 'brand' | 'category' | 'image_urls' | 'image_metadata'
  >;
};

export type ChallengeSnapshot = {
  definition: ChallengeDefinition;
  progress: ChallengeProgress | null;
  selections: ChallengeSelection[];
  completion: ChallengeCompletion | null;
  wardrobeProductIds: Set<string>;
};

export type ChallengeErrorCode =
  | 'transport_unavailable'
  | 'contract_invalid'
  | 'revision_mismatch'
  | 'operation_conflict'
  | 'validation_mismatch'
  | 'inactive_product';

export class ChallengeError extends Error {
  constructor(
    readonly code: ChallengeErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ChallengeError';
  }
}

export type MutationTask = {
  operationId: string;
  expectedRevision: number;
  busy: boolean;
  error: ChallengeError | null;
};

export type ChallengeViewState =
  | { status: 'resolving_identity' | 'loading' }
  | { status: 'unstarted'; snapshot: ChallengeSnapshot }
  | {
      status: 'active' | 'selecting' | 'removing' | 'completing' | 'completed';
      snapshot: ChallengeSnapshot;
    }
  | {
      status: 'recoverable_load_error' | 'contract_error';
      error: ChallengeError;
    };

export { CatalogProductSchema, type CatalogProduct, type CatalogSlotId };
