import { describe, expect, it, vi } from 'vitest';

import { ContinuationService, type ContinuationDataSource } from './service';

const currentSession = {
  session_id: '30000000-0000-4000-8000-000000000002',
  session_number: 2,
  is_return_session: true,
  started_at: '2026-07-30T10:31:00.000Z',
};

function source(
  overrides: Partial<ContinuationDataSource> = {},
): ContinuationDataSource {
  return {
    readActiveProgress: vi.fn().mockResolvedValue([]),
    readActiveProgressItems: vi.fn().mockResolvedValue([]),
    readActiveSavedProductIds: vi.fn().mockResolvedValue([]),
    readActiveProduct: vi.fn().mockResolvedValue([]),
    readLatestCompletion: vi.fn().mockResolvedValue([]),
    readReturnSessionsAfter: vi.fn().mockResolvedValue([]),
    readMeaningfulDestination: vi
      .fn()
      .mockResolvedValue([{ last_meaningful_destination: 'discover' }]),
    readActiveSavedRows: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('ContinuationService', () => {
  it('returns no candidate for an ordinary same session', async () => {
    const data = source();
    const result = await new ContinuationService(data).resolve({
      ...currentSession,
      session_number: 1,
      is_return_session: false,
    });
    expect(result).toBeNull();
    expect(data.readActiveProgress).not.toHaveBeenCalled();
  });

  it('selects an active incomplete Challenge with valid saved progress first', async () => {
    const data = source({
      readActiveProgress: vi.fn().mockResolvedValue([
        {
          id: '40000000-0000-4000-8000-000000000001',
          status: 'in_progress',
        },
      ]),
      readActiveProgressItems: vi.fn().mockResolvedValue([
        {
          slot_id: 'top',
          product_id: '50000000-0000-4000-8000-000000000001',
        },
      ]),
      readActiveSavedProductIds: vi
        .fn()
        .mockResolvedValue([
          { product_id: '50000000-0000-4000-8000-000000000001' },
        ]),
      readActiveProduct: vi.fn().mockResolvedValue([{ id: 'product' }]),
      readLatestCompletion: vi
        .fn()
        .mockRejectedValue(new Error('must not fall through')),
    });
    await expect(
      new ContinuationService(data).resolve(currentSession),
    ).resolves.toEqual({
      type: 'active_challenge',
      destination: '/challenge',
      progressCount: 1,
    });
    expect(data.readLatestCompletion).not.toHaveBeenCalled();
  });

  it('offers the latest completion only in its earliest later return session', async () => {
    const completion = {
      id: '60000000-0000-4000-8000-000000000001',
      challenge_progress_id: '40000000-0000-4000-8000-000000000001',
      completed_at: '2026-07-30T10:00:00.000Z',
    };
    const firstReturn = {
      id: currentSession.session_id,
      session_number: 2,
      started_at: currentSession.started_at,
      is_return_session: true,
    };
    const data = source({
      readLatestCompletion: vi.fn().mockResolvedValue([completion]),
      readReturnSessionsAfter: vi.fn().mockResolvedValue([firstReturn]),
    });
    await expect(
      new ContinuationService(data).resolve(currentSession),
    ).resolves.toEqual({
      type: 'completed_challenge',
      destination: '/challenge',
      progressCount: 4,
    });

    const later = source({
      readLatestCompletion: vi.fn().mockResolvedValue([completion]),
      readReturnSessionsAfter: vi.fn().mockResolvedValue([
        firstReturn,
        {
          id: '30000000-0000-4000-8000-000000000003',
          session_number: 3,
          started_at: '2026-07-30T11:02:00.000Z',
          is_return_session: true,
        },
      ]),
    });
    await expect(
      new ContinuationService(later).resolve({
        ...currentSession,
        session_id: '30000000-0000-4000-8000-000000000003',
        session_number: 3,
        started_at: '2026-07-30T11:02:00.000Z',
      }),
    ).resolves.toBeNull();
  });

  it('uses Wardrobe only when meaningful and non-empty, including unavailable rows', async () => {
    const data = source({
      readMeaningfulDestination: vi
        .fn()
        .mockResolvedValue([{ last_meaningful_destination: 'wardrobe' }]),
      readActiveSavedRows: vi
        .fn()
        .mockResolvedValue([{ id: '70000000-0000-4000-8000-000000000001' }]),
    });
    await expect(
      new ContinuationService(data).resolve(currentSession),
    ).resolves.toEqual({
      type: 'wardrobe',
      destination: '/wardrobe',
      savedCount: 1,
    });
  });

  it('never treats Discover as a continuation candidate', async () => {
    await expect(
      new ContinuationService(source()).resolve(currentSession),
    ).resolves.toBeNull();
  });

  it('does not silently fall through after a higher-priority query failure', async () => {
    const failure = new Error('challenge query failed');
    const data = source({
      readActiveProgress: vi.fn().mockRejectedValue(failure),
      readMeaningfulDestination: vi
        .fn()
        .mockResolvedValue([{ last_meaningful_destination: 'wardrobe' }]),
      readActiveSavedRows: vi
        .fn()
        .mockResolvedValue([{ id: '70000000-0000-4000-8000-000000000001' }]),
    });
    await expect(
      new ContinuationService(data).resolve(currentSession),
    ).rejects.toBe(failure);
    expect(data.readMeaningfulDestination).not.toHaveBeenCalled();
  });
});
