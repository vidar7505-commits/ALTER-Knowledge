import type { DiscoverTelemetry } from './telemetry';
import { DiscoverError, type DiscoverProduct } from './types';
import type { DiscoverService } from './service';

type QualificationContext = {
  sessionId: string;
  feedInstanceId: string;
  feedOrderVersion: string;
};

type TaskState = 'new' | 'telemetry_accepted' | 'complete';

const depthThresholds = [5, 10, 20, 30, 50, 75, 100] as const;

export class QualifiedImpressionCoordinator {
  private readonly states = new Map<string, TaskState>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly emittedDepths = new Set<number>();

  constructor(
    private readonly service: DiscoverService,
    private readonly telemetry: DiscoverTelemetry,
    private readonly context: QualificationContext,
    private readonly isSaved: (productId: string) => boolean,
  ) {}

  qualify(product: DiscoverProduct, visibleRatio: number): Promise<void> {
    const key = `${this.context.sessionId}:${this.context.feedInstanceId}:${product.product_id}`;
    if (this.states.get(key) === 'complete') return Promise.resolve();
    const existing = this.pending.get(key);
    if (existing) return existing;

    const request = this.run(key, product, visibleRatio).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }

  isComplete(productId: string) {
    const key = `${this.context.sessionId}:${this.context.feedInstanceId}:${productId}`;
    return this.states.get(key) === 'complete';
  }

  private async run(
    key: string,
    product: DiscoverProduct,
    visibleRatio: number,
  ) {
    if (this.states.get(key) !== 'telemetry_accepted') {
      const result = await this.telemetry.captureQualified(key, {
        event_name: 'product_impression',
        surface: 'discover',
        source_surface: null,
        properties: {
          product_id: product.product_id,
          product_category: product.category,
          feed_instance_id: this.context.feedInstanceId,
          feed_position: product.position,
          feed_order_version: this.context.feedOrderVersion,
          visible_ratio: Math.max(0.5, Math.min(1, visibleRatio)),
          visible_duration_ms: 1000,
          batch_number: product.batch_number,
          is_saved_at_impression: this.isSaved(product.product_id),
        },
      });
      if (result.status !== 'accepted' && result.status !== 'duplicate') {
        throw new DiscoverError(
          'transport_unavailable',
          result.status === 'quarantined',
          'The qualified impression was not accepted.',
        );
      }
      this.states.set(key, 'telemetry_accepted');
    }

    const depth = await this.service.recordDepth({
      sessionId: this.context.sessionId,
      feedInstanceId: this.context.feedInstanceId,
      productId: product.product_id,
      position: product.position,
    });
    this.states.set(key, 'complete');

    for (const threshold of depthThresholds) {
      if (
        depth.max_qualified_position >= threshold &&
        !this.emittedDepths.has(threshold)
      ) {
        this.emittedDepths.add(threshold);
        void this.telemetry
          .capture({
            event_name: 'feed_depth_reached',
            surface: 'discover',
            source_surface: null,
            properties: {
              feed_instance_id: this.context.feedInstanceId,
              depth_threshold: threshold,
              max_qualified_position: depth.max_qualified_position,
              feed_order_version: this.context.feedOrderVersion,
            },
          })
          .catch(() => {
            this.emittedDepths.delete(threshold);
          });
      }
    }
  }
}
