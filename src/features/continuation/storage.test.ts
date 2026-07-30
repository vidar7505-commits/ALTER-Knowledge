import { beforeEach, describe, expect, it } from 'vitest';

import {
  consumeContinuation,
  markContinuationShown,
  readContinuationState,
} from './storage';

const identity = '10000000-0000-4000-8000-000000000001';
const session = '30000000-0000-4000-8000-000000000001';

describe('continuation storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('scopes shown and consumed state to identity and session', () => {
    markContinuationShown(identity, session);
    consumeContinuation(identity, session, 'dismissed');
    expect(readContinuationState(identity, session)).toMatchObject({
      shown: true,
      consumption: 'dismissed',
    });
    expect(
      readContinuationState('10000000-0000-4000-8000-000000000002', session),
    ).toMatchObject({ shown: false, consumption: null });
    expect(
      readContinuationState(identity, '30000000-0000-4000-8000-000000000002'),
    ).toMatchObject({ shown: false, consumption: null });
  });

  it('ignores malformed persisted state safely', () => {
    window.localStorage.setItem(
      `alter:continuation:v1:${identity}:${session}`,
      '{bad-json',
    );
    expect(readContinuationState(identity, session)).toMatchObject({
      shown: false,
      consumption: null,
    });
  });
});
