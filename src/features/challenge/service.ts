import { z } from 'zod';

import type { CatalogService } from '@/features/catalog/service';
import type { WardrobeService } from '@/features/wardrobe/service';

import {
  ChallengeCompletionSchema,
  ChallengeDefinitionSchema,
  ChallengeError,
  ChallengeProgressItemSchema,
  ChallengeProgressSchema,
  CompleteChallengeEnvelopeSchema,
  RemoveChallengeEnvelopeSchema,
  SelectChallengeEnvelopeSchema,
  StartChallengeEnvelopeSchema,
  type ChallengeSnapshot,
  type CatalogSlotId,
} from './types';

export interface ChallengeDataSource {
  readDefinition(challengeId: string): Promise<unknown>;
  readProgress(challengeId: string): Promise<unknown>;
  readProgressItems(progressId: string): Promise<unknown>;
  readCompletion(progressId: string): Promise<unknown>;
  start(challengeId: string, operationId: string): Promise<unknown>;
  select(input: {
    progressId: string;
    slotId: CatalogSlotId;
    productId: string;
    expectedRevision: number;
    operationId: string;
  }): Promise<unknown>;
  remove(input: {
    progressItemId: string;
    expectedRevision: number;
    operationId: string;
  }): Promise<unknown>;
  complete(input: {
    progressId: string;
    expectedRevision: number;
    operationId: string;
  }): Promise<unknown>;
}

const loads = new Map<string, Promise<ChallengeSnapshot>>();

export class ChallengeService {
  constructor(
    private readonly source: ChallengeDataSource,
    private readonly catalog: CatalogService,
    private readonly wardrobe: WardrobeService,
  ) {}

  recover(identityId: string, challengeId: string) {
    const key = `${identityId}:${challengeId}`;
    const existing = loads.get(key);
    if (existing) return existing;
    const request = this.load(identityId, challengeId).finally(() => {
      globalThis.setTimeout(() => {
        if (loads.get(key) === request) loads.delete(key);
      }, 2_000);
    });
    loads.set(key, request);
    return request;
  }

  invalidate(identityId: string, challengeId: string) {
    loads.delete(`${identityId}:${challengeId}`);
    this.wardrobe.invalidate(identityId);
  }

  ensureSession(input: {
    sessionId: string;
    appVersion: string;
    platform: 'web_mobile' | 'web_desktop';
  }) {
    return this.wardrobe.ensureSession(input);
  }

  start(challengeId: string, operationId: string) {
    return this.parse(
      StartChallengeEnvelopeSchema,
      this.source.start(challengeId, operationId),
    );
  }

  select(input: Parameters<ChallengeDataSource['select']>[0]) {
    return this.parse(SelectChallengeEnvelopeSchema, this.source.select(input));
  }

  remove(input: Parameters<ChallengeDataSource['remove']>[0]) {
    return this.parse(RemoveChallengeEnvelopeSchema, this.source.remove(input));
  }

  complete(input: Parameters<ChallengeDataSource['complete']>[0]) {
    return this.parse(
      CompleteChallengeEnvelopeSchema,
      this.source.complete(input),
    );
  }

  listProducts(challengeId: string, slotId: CatalogSlotId) {
    return this.catalog.listProductsForChallengeSlot({
      challengeId,
      slotId,
      limit: 50,
    });
  }

  private async load(
    identityId: string,
    challengeId: string,
  ): Promise<ChallengeSnapshot> {
    const definition = this.one(
      ChallengeDefinitionSchema,
      await this.source.readDefinition(challengeId),
      true,
    );
    const progress = this.one(
      ChallengeProgressSchema,
      await this.source.readProgress(challengeId),
      false,
    );
    const wardrobe = await this.wardrobe.load(identityId);
    const wardrobeProductIds = new Set(
      wardrobe
        .filter((item) => item.product !== null)
        .map((item) => item.productId),
    );

    if (!progress) {
      return {
        definition,
        progress: null,
        selections: [],
        completion: null,
        wardrobeProductIds,
      };
    }

    const rows = this.many(
      ChallengeProgressItemSchema,
      await this.source.readProgressItems(progress.id),
    );
    const completion = this.one(
      ChallengeCompletionSchema,
      await this.source.readCompletion(progress.id),
      false,
    );
    const products = completion
      ? []
      : await Promise.all(
          rows.map((row) => this.catalog.getProduct(row.product_id)),
        );
    const selections = rows.map((row, index) => {
      const completedProduct =
        completion?.selected_products_snapshot.items.find(
          (item) =>
            item.slot_id === row.slot_id && item.product_id === row.product_id,
        );
      if (completedProduct) {
        return {
          progressItemId: row.id,
          slotId: row.slot_id,
          productId: row.product_id,
          product: {
            id: completedProduct.product_id,
            name: completedProduct.name,
            brand: completedProduct.brand,
            category: completedProduct.category as
              'top' | 'bottom' | 'shoes' | 'layer' | 'accessory',
            image_urls: completedProduct.image_urls,
            image_metadata: {
              primary_index: 0,
              images: completedProduct.image_urls.map((url) => ({
                url,
                width: 1,
                height: 1,
                aspect_ratio: 1,
                alt: `${completedProduct.brand} ${completedProduct.name}, ${completedProduct.category}.`,
              })),
            },
          },
        };
      }
      const result = products[index];
      if (!result || result.status !== 'found') {
        throw new ChallengeError(
          'inactive_product',
          false,
          'A selected piece is no longer available.',
        );
      }
      return {
        progressItemId: row.id,
        slotId: row.slot_id,
        productId: row.product_id,
        product: result.product,
      };
    });

    this.validate(definition.required_slots, selections);
    return {
      definition,
      progress,
      selections,
      completion,
      wardrobeProductIds,
    };
  }

  private validate(
    slots: Array<{ slot_id: CatalogSlotId; display_order: number }>,
    selections: Array<{ slotId: CatalogSlotId; productId: string }>,
  ) {
    const expected = ['top', 'bottom', 'shoes', 'layer_or_accessory'];
    const ordered = [...slots]
      .sort((a, b) => a.display_order - b.display_order)
      .map((slot) => slot.slot_id);
    if (
      ordered.some((slot, index) => slot !== expected[index]) ||
      new Set(selections.map((selection) => selection.slotId)).size !==
        selections.length ||
      new Set(selections.map((selection) => selection.productId)).size !==
        selections.length
    ) {
      throw new ChallengeError(
        'contract_invalid',
        false,
        'Challenge state does not match the canonical definition.',
      );
    }
  }

  private async parse<T>(
    schema: z.ZodType<T>,
    promise: Promise<unknown>,
  ): Promise<T> {
    const value = await promise;
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ChallengeError(
        'contract_invalid',
        false,
        'The Challenge response is not compatible with this build.',
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }

  private one<T>(schema: z.ZodType<T>, value: unknown, required: true): T;
  private one<T>(
    schema: z.ZodType<T>,
    value: unknown,
    required: false,
  ): T | null;
  private one<T>(
    schema: z.ZodType<T>,
    value: unknown,
    required: boolean,
  ): T | null {
    const parsed = z.array(schema).max(1).safeParse(value);
    if (!parsed.success || (required && parsed.data.length !== 1)) {
      throw new ChallengeError(
        'contract_invalid',
        false,
        'Challenge state is missing or malformed.',
        { cause: parsed.success ? undefined : parsed.error },
      );
    }
    return parsed.data[0] ?? null;
  }

  private many<T>(schema: z.ZodType<T>, value: unknown): T[] {
    const parsed = z.array(schema).safeParse(value);
    if (!parsed.success) {
      throw new ChallengeError(
        'contract_invalid',
        false,
        'Challenge selections are malformed.',
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }
}
