import { describe, expect, it, vi } from 'vitest';

import type { TelemetryItemResult } from '@/features/telemetry/types';

import type { DiscoverTelemetry } from './telemetry';
import { QualifiedImpressionCoordinator } from './qualified-impression';
import type { DiscoverService } from './service';
import {
  discoverFeedId,
  discoverProductFixture,
  discoverSessionId,
} from './test-fixtures';
import { DiscoverError } from './types';

function acceptedTelemetry(): DiscoverTelemetry {
  const captureResult: TelemetryItemResult = {
    index: 0,
    event_id: 'd5000000-0000-4000-8000-000000000001',
    status: 'accepted',
    error_codes: [],
    received_at: '2026-07-25T10:00:00.000Z',
  };
  const qualifiedResult: TelemetryItemResult = {
    ...captureResult,
    event_id: 'd6000000-0000-4000-8000-000000000001',
  };
  return {
    capture: vi.fn(async () => captureResult) as DiscoverTelemetry['capture'],
    captureQualified: vi.fn(async () => qualifiedResult),
  };
}

describe('QualifiedImpressionCoordinator', () => {
  it('records depth only after telemetry accepts the canonical impression', async () => {
    const order: string[] = [];
    const telemetry = acceptedTelemetry();
    vi.mocked(telemetry.captureQualified).mockImplementation(async () => {
      order.push('telemetry');
      return {
        index: 0,
        event_id: 'd6000000-0000-4000-8000-000000000001',
        status: 'accepted',
        error_codes: [],
        received_at: '2026-07-25T10:00:00.000Z',
      };
    });
    const service = {
      recordDepth: vi.fn(async () => {
        order.push('depth');
        return {
          session_id: discoverSessionId,
          feed_instance_id: discoverFeedId,
          max_qualified_position: 1,
        };
      }),
    } as unknown as DiscoverService;
    const coordinator = new QualifiedImpressionCoordinator(
      service,
      telemetry,
      {
        sessionId: discoverSessionId,
        feedInstanceId: discoverFeedId,
        feedOrderVersion: 'lr001-catalog-order-v1',
      },
      () => false,
    );

    await coordinator.qualify(discoverProductFixture(1), 0.5);
    expect(order).toEqual(['telemetry', 'depth']);
    expect(coordinator.isComplete(discoverProductFixture(1).product_id)).toBe(
      true,
    );
  });

  it('retries depth without emitting a second impression', async () => {
    const telemetry = acceptedTelemetry();
    const recordDepth = vi
      .fn()
      .mockRejectedValueOnce(
        new DiscoverError('transport_unavailable', true, 'retry'),
      )
      .mockResolvedValueOnce({
        session_id: discoverSessionId,
        feed_instance_id: discoverFeedId,
        max_qualified_position: 1,
      });
    const coordinator = new QualifiedImpressionCoordinator(
      { recordDepth } as unknown as DiscoverService,
      telemetry,
      {
        sessionId: discoverSessionId,
        feedInstanceId: discoverFeedId,
        feedOrderVersion: 'lr001-catalog-order-v1',
      },
      () => false,
    );
    const product = discoverProductFixture(1);

    await expect(coordinator.qualify(product, 0.6)).rejects.toThrow('retry');
    await expect(coordinator.qualify(product, 0.6)).resolves.toBeUndefined();
    expect(telemetry.captureQualified).toHaveBeenCalledTimes(1);
    expect(recordDepth).toHaveBeenCalledTimes(2);
  });
});
