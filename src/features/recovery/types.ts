import { z } from 'zod';

export const RECOVERY_QUEUE_VERSION = 1 as const;
export const RECOVERY_QUEUE_LIMIT = 50;
export const RECOVERY_ITEM_BYTES_LIMIT = 16 * 1024;
export const RECOVERY_QUEUE_BYTES_LIMIT = 256 * 1024;
export const RECOVERY_MAX_ATTEMPTS = 3;

const uuid = z.uuid();

export const recoveryMutationKinds = [
  'save_product',
  'remove_product',
  'start_challenge',
  'select_challenge_item',
  'remove_challenge_item',
  'complete_challenge',
] as const;

export type RecoveryMutationKind = (typeof recoveryMutationKinds)[number];

const SavePayloadSchema = z.strictObject({
  productId: uuid,
  sourceSurface: z.enum(['discover', 'product_detail', 'wardrobe']),
});
const RemoveProductPayloadSchema = z.strictObject({
  savedProductId: uuid,
});
const StartChallengePayloadSchema = z.strictObject({
  challengeId: uuid,
});
const SelectChallengePayloadSchema = z.strictObject({
  progressId: uuid,
  slotId: z.enum(['top', 'bottom', 'shoes', 'layer_or_accessory']),
  productId: uuid,
  expectedRevision: z.int().nonnegative(),
});
const RemoveChallengePayloadSchema = z.strictObject({
  progressItemId: uuid,
  expectedRevision: z.int().nonnegative(),
});
const CompleteChallengePayloadSchema = z.strictObject({
  progressId: uuid,
  expectedRevision: z.int().nonnegative(),
});

export const RecoveryPayloadSchemas = {
  save_product: SavePayloadSchema,
  remove_product: RemoveProductPayloadSchema,
  start_challenge: StartChallengePayloadSchema,
  select_challenge_item: SelectChallengePayloadSchema,
  remove_challenge_item: RemoveChallengePayloadSchema,
  complete_challenge: CompleteChallengePayloadSchema,
} satisfies Record<RecoveryMutationKind, z.ZodType>;

const RecoveryItemBaseSchema = z.strictObject({
  version: z.literal(RECOVERY_QUEUE_VERSION),
  identityId: uuid,
  sessionId: uuid.nullable(),
  operationId: uuid,
  sequence: z.int().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
  attemptCount: z.int().nonnegative(),
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  retryState: z.enum([
    'pending',
    'dispatching',
    'retry_scheduled',
    'blocked_offline',
    'blocked_identity',
    'conflict',
    'terminal',
    'succeeded',
    'discarded',
  ]),
});

export const RecoveryItemSchema = z.discriminatedUnion('kind', [
  RecoveryItemBaseSchema.extend({
    kind: z.literal('save_product'),
    payload: SavePayloadSchema,
  }),
  RecoveryItemBaseSchema.extend({
    kind: z.literal('remove_product'),
    payload: RemoveProductPayloadSchema,
  }),
  RecoveryItemBaseSchema.extend({
    kind: z.literal('start_challenge'),
    payload: StartChallengePayloadSchema,
  }),
  RecoveryItemBaseSchema.extend({
    kind: z.literal('select_challenge_item'),
    payload: SelectChallengePayloadSchema,
  }),
  RecoveryItemBaseSchema.extend({
    kind: z.literal('remove_challenge_item'),
    payload: RemoveChallengePayloadSchema,
  }),
  RecoveryItemBaseSchema.extend({
    kind: z.literal('complete_challenge'),
    payload: CompleteChallengePayloadSchema,
  }),
]);

export type RecoveryItem = z.infer<typeof RecoveryItemSchema>;

export const RecoveryDocumentSchema = z.strictObject({
  version: z.literal(RECOVERY_QUEUE_VERSION),
  nextSequence: z.int().nonnegative(),
  items: z.array(z.unknown()).max(RECOVERY_QUEUE_LIMIT * 2),
});

export type RecoveryDocument = {
  version: typeof RECOVERY_QUEUE_VERSION;
  nextSequence: number;
  items: RecoveryItem[];
};

export type RecoveryReadResult = {
  document: RecoveryDocument;
  recoveredCorruption: boolean;
  issues: string[];
};

export type RecoveryPublicStatus =
  | 'idle'
  | 'pending'
  | 'dispatching'
  | 'blocked_offline'
  | 'blocked_identity'
  | 'retry_scheduled'
  | 'retry_available'
  | 'conflict'
  | 'corrupt_recovered'
  | 'storage_unavailable'
  | 'succeeded';

export type RecoverySnapshot = {
  status: RecoveryPublicStatus;
  pendingCount: number;
  message: string | null;
};

export class RecoveryPendingError extends Error {
  readonly code = 'recovery_pending';
  readonly retryable = true;

  constructor(
    message = 'This change is retained and will retry when possible.',
  ) {
    super(message);
    this.name = 'RecoveryPendingError';
  }
}

export class RecoveryStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RecoveryStorageError';
  }
}
