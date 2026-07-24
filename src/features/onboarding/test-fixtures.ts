import type {
  OnboardingMutationResult,
  OnboardingPreference,
  OnboardingState,
} from './types';

const labels = {
  minimal: ['style', 'Minimal', 'Clean lines, controlled palette.', 1, 4],
  relaxed: ['style', 'Relaxed', 'Soft layers, easy proportions.', 2, 4],
  tailored: ['style', 'Tailored', 'Precise structure, polished shape.', 3, 4],
  romantic: ['style', 'Romantic', 'Fluid form, delicate detail.', 4, 4],
  street: ['style', 'Street', 'Graphic pieces, strong silhouettes.', 5, 4],
  experimental: [
    'style',
    'Experimental',
    'Unexpected shape, contrast, texture.',
    6,
    4,
  ],
  everyday_ease: ['mood', 'Everyday ease', null, 1, null],
  work_and_meetings: ['mood', 'Work and meetings', null, 2, null],
  going_out: ['mood', 'Going out', null, 3, null],
  weekends_away: ['mood', 'Weekends away', null, 4, null],
  events_and_occasions: ['mood', 'Events and occasions', null, 5, null],
  trying_something_new: ['mood', 'Trying something new', null, 6, null],
} as const;

export function onboardingPreferences(): OnboardingPreference[] {
  return Object.entries(labels).map(
    ([preferenceId, [group, label, description, order, maximum]]) => ({
      definition_version: 'onboarding-style-v1',
      preference_id: preferenceId,
      preference_group: group,
      label,
      description,
      display_order: order,
      max_selections: maximum,
      asset_id: `onboarding-style-v1:${preferenceId}`,
      is_active: true,
    }),
  );
}

export const notStartedState: OnboardingState = {
  status: 'not_started',
  onboarding_version: null,
  preference_set_version: null,
  preference_ids: [],
  completion_operation_id: null,
  skip_operation_id: null,
  state_revision: 0,
};

export function mutationResult(
  operationId: string,
  status:
    | 'completed_with_preferences'
    | 'completed_without_preferences'
    | 'skipped' = 'completed_with_preferences',
): OnboardingMutationResult {
  return {
    ok: true,
    operation_id: operationId,
    state_revision: 2,
    data: {
      status,
      ...(status === 'completed_with_preferences'
        ? { preference_ids: ['minimal'] }
        : {}),
    },
  };
}
