import { describe, expect, it } from 'vitest';

import { discoverReducer } from './reducer';
import {
  discoverBatchFixture,
  discoverFeedFixture,
  discoverSessionFixture,
} from './test-fixtures';
import { DiscoverError, initialDiscoverState } from './types';

describe('discoverReducer', () => {
  it('moves through the explicit initial state machine', () => {
    const resolving = discoverReducer(initialDiscoverState, {
      type: 'RESOLVE_SESSION',
    });
    expect(resolving.status).toBe('resolving_session');
    const session = discoverReducer(resolving, {
      type: 'SESSION_READY',
      session: discoverSessionFixture,
    });
    expect(session.status).toBe('resolving_feed');
    const feed = discoverReducer(session, {
      type: 'FEED_READY',
      feed: discoverFeedFixture,
      restoring: false,
    });
    expect(feed.status).toBe('loading_initial');
    const ready = discoverReducer(feed, {
      type: 'BATCH_READY',
      batch: discoverBatchFixture(),
      requestCursor: null,
    });
    expect(ready.status).toBe('ready');
    expect(ready.products.map((product) => product.position)).toEqual([
      1, 2, 3,
    ]);
  });

  it('preserves cards and cursor on pagination failure', () => {
    const loaded = discoverReducer(
      {
        ...initialDiscoverState,
        status: 'loading_more',
        feed: discoverFeedFixture,
        session: discoverSessionFixture,
        products: discoverBatchFixture().products,
        cursor: 'opaque-cursor',
      },
      {
        type: 'PAGINATION_ERROR',
        error: new DiscoverError(
          'transport_unavailable',
          true,
          'temporarily unavailable',
        ),
      },
    );
    expect(loaded.status).toBe('recoverable_pagination_error');
    expect(loaded.products).toHaveLength(3);
    expect(loaded.cursor).toBe('opaque-cursor');

    const retrying = discoverReducer(loaded, { type: 'LOAD_MORE' });
    expect(retrying.status).toBe('loading_more');
    expect(retrying.products).toHaveLength(3);
    expect(retrying.cursor).toBe('opaque-cursor');
  });
});
