import type {
  DiscoverBatch,
  DiscoverError,
  DiscoverFeed,
  DiscoverSession,
  DiscoverState,
  SavedProductState,
} from './types';
import { initialDiscoverState } from './types';

export type DiscoverAction =
  | { type: 'RESOLVE_SESSION' }
  | { type: 'SESSION_READY'; session: DiscoverSession }
  | { type: 'FEED_READY'; feed: DiscoverFeed; restoring: boolean }
  | { type: 'LOAD_INITIAL' }
  | { type: 'LOAD_MORE' }
  | { type: 'BATCH_READY'; batch: DiscoverBatch; requestCursor: string | null }
  | { type: 'SAVED_READY'; items: SavedProductState[] }
  | { type: 'SAVE_READY'; productId: string; savedProductId: string }
  | { type: 'REMOVE_READY'; productId: string }
  | { type: 'INITIAL_ERROR'; error: DiscoverError }
  | { type: 'PAGINATION_ERROR'; error: DiscoverError }
  | { type: 'RESET' };

export function discoverReducer(
  state: DiscoverState,
  action: DiscoverAction,
): DiscoverState {
  switch (action.type) {
    case 'RESOLVE_SESSION':
      return { ...initialDiscoverState, status: 'resolving_session' };
    case 'SESSION_READY':
      return {
        ...state,
        status: 'resolving_feed',
        session: action.session,
        error: null,
      };
    case 'FEED_READY':
      return {
        ...state,
        status: action.restoring
          ? 'restoring'
          : action.feed.is_exhausted
            ? 'exhausted'
            : 'loading_initial',
        feed: action.feed,
        cursor: action.feed.last_cursor,
        error: null,
      };
    case 'LOAD_INITIAL':
      return { ...state, status: 'loading_initial', error: null };
    case 'LOAD_MORE':
      if (
        state.status !== 'ready' &&
        state.status !== 'recoverable_pagination_error'
      ) {
        return state;
      }
      return { ...state, status: 'loading_more', error: null };
    case 'BATCH_READY': {
      const products = [...state.products, ...action.batch.products];
      return {
        ...state,
        status: action.batch.is_exhausted ? 'exhausted' : 'ready',
        products,
        cursor: action.batch.next_cursor,
        requestCursors: [...state.requestCursors, action.requestCursor],
        feed: state.feed
          ? {
              ...state.feed,
              last_cursor: action.batch.next_cursor,
              max_loaded_position:
                products.at(-1)?.position ?? state.feed.max_loaded_position,
              is_exhausted: action.batch.is_exhausted,
            }
          : null,
        error: null,
      };
    }
    case 'SAVED_READY':
      return {
        ...state,
        savedProducts: Object.fromEntries(
          action.items.map((item) => [item.productId, item.savedProductId]),
        ),
      };
    case 'SAVE_READY':
      return {
        ...state,
        savedProducts: {
          ...state.savedProducts,
          [action.productId]: action.savedProductId,
        },
      };
    case 'REMOVE_READY': {
      const savedProducts = { ...state.savedProducts };
      delete savedProducts[action.productId];
      return { ...state, savedProducts };
    }
    case 'INITIAL_ERROR':
      return {
        ...state,
        status: action.error.retryable
          ? 'recoverable_initial_error'
          : 'unrecoverable_error',
        error: action.error,
      };
    case 'PAGINATION_ERROR':
      return {
        ...state,
        status: action.error.retryable
          ? 'recoverable_pagination_error'
          : 'unrecoverable_error',
        error: action.error,
      };
    case 'RESET':
      return initialDiscoverState;
  }
}
