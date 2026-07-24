import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/app-shell';
import { ProductOnboardingGuard } from '@/features/onboarding/onboarding-experience';

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <ProductOnboardingGuard>
      <AppShell>{children}</AppShell>
    </ProductOnboardingGuard>
  );
}
