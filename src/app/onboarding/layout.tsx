import type { ReactNode } from 'react';

import { OnboardingExperience } from '@/features/onboarding/onboarding-experience';

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <OnboardingExperience />
      <span hidden>{children}</span>
    </>
  );
}
