import { describe, expect, it, vi } from 'vitest';

import { OnboardingService, type OnboardingDataSource } from './service';
import {
  mutationResult,
  notStartedState,
  onboardingPreferences,
} from './test-fixtures';
import { OnboardingError } from './types';

function source(
  overrides: Partial<OnboardingDataSource> = {},
): OnboardingDataSource {
  return {
    readState: vi.fn().mockResolvedValue(notStartedState),
    readPreferences: vi.fn().mockResolvedValue(onboardingPreferences()),
    complete: vi
      .fn()
      .mockImplementation(({ operationId }) =>
        Promise.resolve(mutationResult(operationId)),
      ),
    skip: vi
      .fn()
      .mockImplementation(({ operationId }) =>
        Promise.resolve(mutationResult(operationId, 'skipped')),
      ),
    ...overrides,
  };
}

describe('OnboardingService', () => {
  it('loads the canonical active taxonomy in explicit group and display order', async () => {
    const service = new OnboardingService(
      source({
        readPreferences: vi
          .fn()
          .mockResolvedValue(onboardingPreferences().reverse()),
      }),
    );

    const snapshot = await service.load();

    expect(snapshot.state.status).toBe('not_started');
    expect(snapshot.preferences.map((item) => item.preference_id)).toEqual([
      'minimal',
      'relaxed',
      'tailored',
      'romantic',
      'street',
      'experimental',
      'everyday_ease',
      'work_and_meetings',
      'going_out',
      'weekends_away',
      'events_and_occasions',
      'trying_something_new',
    ]);
  });

  it('maps a missing state row to canonical not_started', async () => {
    const service = new OnboardingService(
      source({ readState: vi.fn().mockResolvedValue(null) }),
    );
    await expect(service.load()).resolves.toMatchObject({
      state: { status: 'not_started', state_revision: 0 },
    });
  });

  it('rejects incomplete taxonomy rather than fabricating choices', async () => {
    const service = new OnboardingService(
      source({
        readPreferences: vi
          .fn()
          .mockResolvedValue(onboardingPreferences().slice(0, 11)),
      }),
    );
    await expect(service.load()).rejects.toMatchObject({
      code: 'taxonomy_unavailable',
      retryable: false,
    });
  });

  it('normalizes completion preferences and sends no owner identifiers', async () => {
    const complete = vi
      .fn()
      .mockImplementation(({ operationId }) =>
        Promise.resolve(mutationResult(operationId)),
      );
    const service = new OnboardingService(source({ complete }));

    await service.complete('a0000000-0000-4000-8000-000000000001', [
      'street',
      'minimal',
      'street',
    ]);

    expect(complete).toHaveBeenCalledWith({
      operationId: 'a0000000-0000-4000-8000-000000000001',
      onboardingVersion: 'onboarding-style-v1',
      preferenceSetVersion: 'onboarding-style-v1',
      preferenceIds: ['minimal', 'street'],
    });
    expect(JSON.stringify(complete.mock.calls[0])).not.toMatch(
      /anonymous|owner|userId|wardrobe/i,
    );
  });

  it('preserves completed_without_preferences as distinct from skip', async () => {
    const complete = vi
      .fn()
      .mockImplementation(({ operationId }) =>
        Promise.resolve(
          mutationResult(operationId, 'completed_without_preferences'),
        ),
      );
    const skip = vi
      .fn()
      .mockImplementation(({ operationId }) =>
        Promise.resolve(mutationResult(operationId, 'skipped')),
      );
    const service = new OnboardingService(source({ complete, skip }));

    const completed = await service.complete(
      'a0000000-0000-4000-8000-000000000002',
      [],
    );
    const skipped = await service.skip('a0000000-0000-4000-8000-000000000003');

    expect(completed.data.status).toBe('completed_without_preferences');
    expect(skipped.data.status).toBe('skipped');
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        preferenceSetVersion: null,
        preferenceIds: [],
      }),
    );
  });

  it('maps invalid mutation contracts without leaking database details', async () => {
    const service = new OnboardingService(
      source({
        complete: vi.fn().mockResolvedValue({ raw: 'postgres error' }),
      }),
    );
    await expect(
      service.complete('a0000000-0000-4000-8000-000000000004', []),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OnboardingError>>({
        code: 'contract_invalid',
        retryable: false,
        message: 'The onboarding response was not recognized.',
      }),
    );
  });
});
