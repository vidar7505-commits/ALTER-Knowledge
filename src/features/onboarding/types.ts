import { z } from 'zod';

export const ONBOARDING_VERSION = 'onboarding-style-v1' as const;
export const PREFERENCE_SET_VERSION = 'onboarding-style-v1' as const;

export const onboardingStatuses = [
  'not_started',
  'in_progress',
  'completed_with_preferences',
  'completed_without_preferences',
  'skipped',
  'recoverable_error',
] as const;

export type OnboardingStatus = (typeof onboardingStatuses)[number];
export type OnboardingStep = 'welcome' | 'style' | 'mood';
export type OnboardingAction = 'complete' | 'skip';

export const OnboardingStateSchema = z.strictObject({
  status: z.enum(onboardingStatuses),
  onboarding_version: z.string().trim().min(1).nullable(),
  preference_set_version: z.string().trim().min(1).nullable(),
  preference_ids: z.array(z.string().trim().min(1)),
  completion_operation_id: z.uuid().nullable(),
  skip_operation_id: z.uuid().nullable(),
  state_revision: z.coerce.number().int().nonnegative(),
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

export const OnboardingPreferenceSchema = z.strictObject({
  definition_version: z.literal(ONBOARDING_VERSION),
  preference_id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  preference_group: z.enum(['style', 'mood']),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable(),
  display_order: z.coerce.number().int().positive(),
  max_selections: z.coerce.number().int().positive().nullable(),
  asset_id: z.string().trim().min(1),
  is_active: z.literal(true),
});

export type OnboardingPreference = z.infer<typeof OnboardingPreferenceSchema>;

export const OnboardingMutationResultSchema = z.strictObject({
  ok: z.literal(true),
  operation_id: z.uuid(),
  state_revision: z.coerce.number().int().nonnegative(),
  data: z.strictObject({
    status: z.enum([
      'completed_with_preferences',
      'completed_without_preferences',
      'skipped',
    ]),
    preference_ids: z.array(z.string()).optional(),
  }),
});

export type OnboardingMutationResult = z.infer<
  typeof OnboardingMutationResultSchema
>;

export type OnboardingErrorCode =
  | 'query_unavailable'
  | 'mutation_unavailable'
  | 'operation_conflict'
  | 'contract_invalid'
  | 'taxonomy_unavailable'
  | 'storage_unavailable';

export class OnboardingError extends Error {
  constructor(
    readonly code: OnboardingErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'OnboardingError';
  }
}

export function isTerminalOnboardingStatus(status: OnboardingStatus) {
  return (
    status === 'completed_with_preferences' ||
    status === 'completed_without_preferences' ||
    status === 'skipped'
  );
}
