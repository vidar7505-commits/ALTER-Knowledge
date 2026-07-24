import { z } from 'zod';

import {
  ONBOARDING_VERSION,
  OnboardingError,
  OnboardingMutationResultSchema,
  OnboardingPreferenceSchema,
  OnboardingStateSchema,
  PREFERENCE_SET_VERSION,
  type OnboardingMutationResult,
  type OnboardingPreference,
  type OnboardingState,
} from './types';

export interface OnboardingDataSource {
  readState(): Promise<unknown>;
  readPreferences(): Promise<unknown>;
  complete(input: {
    operationId: string;
    onboardingVersion: string;
    preferenceSetVersion: string | null;
    preferenceIds: string[];
  }): Promise<unknown>;
  skip(input: {
    operationId: string;
    onboardingVersion: string;
  }): Promise<unknown>;
}

const preferenceArraySchema = z.array(OnboardingPreferenceSchema).length(12);

export type OnboardingSnapshot = {
  state: OnboardingState;
  preferences: OnboardingPreference[];
};

export const NOT_STARTED_STATE: OnboardingState = {
  status: 'not_started',
  onboarding_version: null,
  preference_set_version: null,
  preference_ids: [],
  completion_operation_id: null,
  skip_operation_id: null,
  state_revision: 0,
};

export class OnboardingService {
  constructor(private readonly source: OnboardingDataSource) {}

  async load(): Promise<OnboardingSnapshot> {
    let rawState: unknown;
    let rawPreferences: unknown;

    try {
      [rawState, rawPreferences] = await Promise.all([
        this.source.readState(),
        this.source.readPreferences(),
      ]);
    } catch (error) {
      if (error instanceof OnboardingError) {
        throw error;
      }
      throw new OnboardingError(
        'query_unavailable',
        true,
        'We couldn’t restore your onboarding yet.',
        { cause: error },
      );
    }

    let state: OnboardingState;
    if (rawState === null) {
      state = NOT_STARTED_STATE;
    } else {
      const parsedState = OnboardingStateSchema.safeParse(rawState);
      if (!parsedState.success) {
        throw new OnboardingError(
          'contract_invalid',
          false,
          'The saved onboarding state is not compatible with this build.',
          { cause: parsedState.error },
        );
      }
      state = parsedState.data;
    }

    const preferences = preferenceArraySchema.safeParse(rawPreferences);
    if (!preferences.success) {
      throw new OnboardingError(
        'taxonomy_unavailable',
        false,
        'The current style choices are unavailable.',
        { cause: preferences.error },
      );
    }

    const groupOrder = { style: 0, mood: 1 } as const;
    const ordered = [...preferences.data].sort(
      (left, right) =>
        groupOrder[left.preference_group] -
          groupOrder[right.preference_group] ||
        left.display_order - right.display_order ||
        left.preference_id.localeCompare(right.preference_id),
    );
    const style = ordered.filter(
      (preference) => preference.preference_group === 'style',
    );
    const mood = ordered.filter(
      (preference) => preference.preference_group === 'mood',
    );
    if (
      style.length !== 6 ||
      mood.length !== 6 ||
      style.some((preference) => preference.max_selections !== 4) ||
      mood.some((preference) => preference.max_selections !== null) ||
      new Set(ordered.map((preference) => preference.preference_id)).size !==
        ordered.length
    ) {
      throw new OnboardingError(
        'taxonomy_unavailable',
        false,
        'The current style choices are incomplete.',
      );
    }

    const activeIds = new Set(
      ordered.map((preference) => preference.preference_id),
    );
    if (
      state.preference_ids.some(
        (preferenceId) => !activeIds.has(preferenceId),
      ) ||
      (state.status === 'completed_with_preferences' &&
        state.preference_set_version === null)
    ) {
      throw new OnboardingError(
        'contract_invalid',
        false,
        'The saved onboarding state is not compatible with this build.',
      );
    }

    return {
      state,
      preferences: ordered,
    };
  }

  async complete(
    operationId: string,
    preferenceIds: string[],
  ): Promise<OnboardingMutationResult> {
    const uniqueIds = [...new Set(preferenceIds)].sort();
    return this.parseMutation(
      await this.source.complete({
        operationId,
        onboardingVersion: ONBOARDING_VERSION,
        preferenceSetVersion:
          uniqueIds.length > 0 ? PREFERENCE_SET_VERSION : null,
        preferenceIds: uniqueIds,
      }),
    );
  }

  async skip(operationId: string): Promise<OnboardingMutationResult> {
    return this.parseMutation(
      await this.source.skip({
        operationId,
        onboardingVersion: ONBOARDING_VERSION,
      }),
    );
  }

  private parseMutation(value: unknown): OnboardingMutationResult {
    const parsed = OnboardingMutationResultSchema.safeParse(value);
    if (!parsed.success) {
      throw new OnboardingError(
        'contract_invalid',
        false,
        'The onboarding response was not recognized.',
        { cause: parsed.error },
      );
    }
    return parsed.data;
  }
}
