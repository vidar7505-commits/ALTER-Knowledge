import { z } from 'zod';

import { catalogSlotIds } from '@/features/catalog/types';

import {
  ContinuationError,
  type ContinuationCandidate,
  type ContinuationSession,
} from './types';

const ActiveProgressSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(['in_progress', 'ready_to_complete']),
});
const ProgressItemSchema = z.strictObject({
  slot_id: z.enum(catalogSlotIds),
  product_id: z.uuid(),
});
const CompletionSchema = z.strictObject({
  id: z.uuid(),
  challenge_progress_id: z.uuid(),
  completed_at: z.iso.datetime({ offset: true }),
});
const ReturnSessionSchema = z.strictObject({
  id: z.uuid(),
  session_number: z.int().positive(),
  started_at: z.iso.datetime({ offset: true }),
  is_return_session: z.literal(true),
});
const DestinationSchema = z.strictObject({
  last_meaningful_destination: z
    .enum(['discover', 'wardrobe', 'challenge'])
    .nullable(),
});
const SavedRowSchema = z.strictObject({ id: z.uuid() });

export interface ContinuationDataSource {
  readActiveProgress(): Promise<unknown>;
  readActiveProgressItems(progressId: string): Promise<unknown>;
  readActiveSavedProductIds(): Promise<unknown>;
  readActiveProduct(productId: string): Promise<unknown>;
  readLatestCompletion(): Promise<unknown>;
  readReturnSessionsAfter(completedAt: string): Promise<unknown>;
  readMeaningfulDestination(): Promise<unknown>;
  readActiveSavedRows(): Promise<unknown>;
}

function oneOrNone<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const parsed = z.array(schema).max(1).safeParse(value);
  if (!parsed.success) {
    throw new ContinuationError(
      'contract_invalid',
      true,
      'Continuation state is not compatible with this build.',
      { cause: parsed.error },
    );
  }
  return parsed.data[0] ?? null;
}

function many<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const parsed = z.array(schema).safeParse(value);
  if (!parsed.success) {
    throw new ContinuationError(
      'contract_invalid',
      true,
      'Continuation state is not compatible with this build.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export class ContinuationService {
  private readonly resolutions = new Map<
    string,
    Promise<ContinuationCandidate | null>
  >();

  constructor(private readonly source: ContinuationDataSource) {}

  resolve(session: ContinuationSession): Promise<ContinuationCandidate | null> {
    const existing = this.resolutions.get(session.session_id);
    if (existing) return existing;
    const request = this.resolveCanonical(session).finally(() => {
      globalThis.setTimeout(() => {
        if (this.resolutions.get(session.session_id) === request) {
          this.resolutions.delete(session.session_id);
        }
      }, 2_000);
    });
    this.resolutions.set(session.session_id, request);
    return request;
  }

  invalidate(sessionId: string) {
    this.resolutions.delete(sessionId);
  }

  private async resolveCanonical(
    session: ContinuationSession,
  ): Promise<ContinuationCandidate | null> {
    if (!session.is_return_session) return null;

    const active = oneOrNone(
      ActiveProgressSchema,
      await this.source.readActiveProgress(),
    );
    if (active) {
      const [items, savedRows] = await Promise.all([
        this.source.readActiveProgressItems(active.id),
        this.source.readActiveSavedProductIds(),
      ]);
      const progressItems = many(ProgressItemSchema, items);
      const savedIds = new Set(
        many(z.strictObject({ product_id: z.uuid() }), savedRows).map(
          (row) => row.product_id,
        ),
      );
      const structurallyValid = progressItems.filter((item) =>
        savedIds.has(item.product_id),
      );
      const activeProducts = await Promise.all(
        structurallyValid.map((item) =>
          this.source.readActiveProduct(item.product_id),
        ),
      );
      const validCount = activeProducts.filter((value) => {
        const parsed = z.array(z.unknown()).max(1).safeParse(value);
        if (!parsed.success) {
          throw new ContinuationError(
            'contract_invalid',
            true,
            'Challenge continuation state is malformed.',
          );
        }
        return parsed.data.length === 1;
      }).length;
      if (validCount > 0) {
        return {
          type: 'active_challenge',
          destination: '/challenge',
          progressCount: validCount,
        };
      }
    }

    const completion = oneOrNone(
      CompletionSchema,
      await this.source.readLatestCompletion(),
    );
    if (
      completion &&
      Date.parse(completion.completed_at) < Date.parse(session.started_at)
    ) {
      const returns = many(
        ReturnSessionSchema,
        await this.source.readReturnSessionsAfter(completion.completed_at),
      ).sort(
        (left, right) =>
          left.session_number - right.session_number ||
          left.id.localeCompare(right.id),
      );
      if (returns[0]?.id === session.session_id) {
        return {
          type: 'completed_challenge',
          destination: '/challenge',
          progressCount: 4,
        };
      }
    }

    const destination = oneOrNone(
      DestinationSchema,
      await this.source.readMeaningfulDestination(),
    );
    if (destination?.last_meaningful_destination === 'wardrobe') {
      const savedRows = many(
        SavedRowSchema,
        await this.source.readActiveSavedRows(),
      );
      if (savedRows.length > 0) {
        return {
          type: 'wardrobe',
          destination: '/wardrobe',
          savedCount: savedRows.length,
        };
      }
    }
    return null;
  }
}
