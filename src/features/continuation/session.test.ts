import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureCanonicalSession } from './session';

describe('ensureCanonicalSession', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('keeps the canonical server session ID', async () => {
    const ensure = vi.fn().mockResolvedValue({
      session_id: '30000000-0000-4000-8000-000000000001',
    });
    await ensureCanonicalSession(ensure, () => false);
    expect(window.sessionStorage.getItem('alter:telemetry:session-id')).toBe(
      '30000000-0000-4000-8000-000000000001',
    );
  });

  it('rotates an expired candidate exactly once for a strict return session', async () => {
    window.sessionStorage.setItem(
      'alter:telemetry:session-id',
      '30000000-0000-4000-8000-000000000001',
    );
    const expired = new Error('expired');
    const ensure = vi
      .fn()
      .mockRejectedValueOnce(expired)
      .mockResolvedValueOnce({
        session_id: '30000000-0000-4000-8000-000000000002',
      });
    await ensureCanonicalSession(ensure, (error) => error === expired);
    expect(ensure).toHaveBeenCalledTimes(2);
    expect(ensure.mock.calls[1]?.[0]).not.toBe(ensure.mock.calls[0]?.[0]);
    expect(window.sessionStorage.getItem('alter:telemetry:session-id')).toBe(
      '30000000-0000-4000-8000-000000000002',
    );
  });
});
