import type { OnboardingAction, OnboardingStep } from './types';

export type OnboardingDraft = {
  step: OnboardingStep;
  selectedPreferenceIds: string[];
  operations: Partial<Record<OnboardingAction, string>>;
  revision: number;
};

const EMPTY_DRAFT: OnboardingDraft = {
  step: 'welcome',
  selectedPreferenceIds: [],
  operations: {},
  revision: 0,
};

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function key(identityId: string) {
  return `alter:onboarding:onboarding-style-v1:${identityId}`;
}

export function readOnboardingDraft(identityId: string): OnboardingDraft {
  try {
    const raw = storage()?.getItem(key(identityId));
    if (!raw) return EMPTY_DRAFT;
    const value = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (
      !['welcome', 'style', 'mood'].includes(value.step ?? '') ||
      !Array.isArray(value.selectedPreferenceIds) ||
      value.selectedPreferenceIds.some((id) => typeof id !== 'string')
    ) {
      return EMPTY_DRAFT;
    }
    const operations =
      value.operations && typeof value.operations === 'object'
        ? Object.fromEntries(
            Object.entries(value.operations).filter(
              ([action, operationId]) =>
                (action === 'complete' || action === 'skip') &&
                typeof operationId === 'string',
            ),
          )
        : {};
    return {
      step: value.step as OnboardingStep,
      selectedPreferenceIds: [...new Set(value.selectedPreferenceIds)],
      operations,
      revision: Number.isInteger(value.revision) ? (value.revision ?? 0) : 0,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeOnboardingDraft(
  identityId: string,
  draft: OnboardingDraft,
) {
  storage()?.setItem(key(identityId), JSON.stringify(draft));
}

export function clearOnboardingDraft(identityId: string) {
  storage()?.removeItem(key(identityId));
}
