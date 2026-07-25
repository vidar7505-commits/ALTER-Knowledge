import { describe, expect, it, vi } from 'vitest';

import { SupabaseDiscoverDataSource } from './supabase';
import { discoverFeedId, discoverSessionId } from './test-fixtures';

describe('SupabaseDiscoverDataSource', () => {
  it('uses only canonical non-ownership session arguments', async () => {
    const rpc = vi.fn(
      async (name: string, parameters: Record<string, unknown>) => {
        void name;
        void parameters;
        return {
          data: {},
          error: null,
        };
      },
    );
    const source = new SupabaseDiscoverDataSource({ rpc } as never);
    await source.ensureSession({
      sessionId: discoverSessionId,
      appVersion: '0.1.0',
      platform: 'web_mobile',
      entryRoute: '/discover',
    });

    expect(rpc).toHaveBeenCalledWith('ensure_session', {
      p_session_id: discoverSessionId,
      p_app_version: '0.1.0',
      p_platform: 'web_mobile',
      p_entry_route: '/discover',
      p_traffic_source: null,
      p_cohort_id: null,
    });
    expect(JSON.stringify(rpc.mock.calls[0])).not.toMatch(
      /anonymous_user_id|owner_id|user_id|environment|service_role/,
    );
  });

  it('uses approved feed RPCs and preserves the opaque cursor', async () => {
    const rpc = vi.fn(
      async (name: string, parameters: Record<string, unknown>) => {
        void name;
        void parameters;
        return {
          data: {},
          error: null,
        };
      },
    );
    const source = new SupabaseDiscoverDataSource({ rpc } as never);
    const cursor = `lr001-feed-cursor-v1.${'a'.repeat(64)}`;
    await source.ensureFeed(discoverSessionId);
    await source.appendBatch({
      feedInstanceId: discoverFeedId,
      cursor,
      limit: 24,
    });
    await source.recordDepth({
      sessionId: discoverSessionId,
      feedInstanceId: discoverFeedId,
      productId: 'c0800000-0000-4000-8000-000000000001',
      position: 1,
    });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'ensure_feed_instance',
      'append_feed_batch',
      'record_qualified_feed_position',
    ]);
    expect(rpc.mock.calls[1]?.[1]).toEqual({
      p_feed_instance_id: discoverFeedId,
      p_cursor: cursor,
      p_limit: 24,
    });
  });

  it('uses RPCs for save mutations rather than table DML', async () => {
    const rpc = vi.fn(
      async (name: string, parameters: Record<string, unknown>) => {
        void name;
        void parameters;
        return {
          data: {},
          error: null,
        };
      },
    );
    const source = new SupabaseDiscoverDataSource({ rpc } as never);
    await source.saveProduct({
      productId: 'c0800000-0000-4000-8000-000000000001',
      operationId: 'd4000000-0000-4000-8000-000000000001',
      sourceSurface: 'discover',
    });
    await source.removeProduct({
      savedProductId: 'd3000000-0000-4000-8000-000000000001',
      operationId: 'd4000000-0000-4000-8000-000000000002',
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'save_product',
      'remove_product',
    ]);
  });
});
