import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/onboarding/onboarding-experience', () => ({
  OnboardingExperience: () => (
    <main>
      <h1>Onboarding entry</h1>
    </main>
  ),
}));

import HomePage from './page';

describe('HomePage', () => {
  it('replaces the neutral P09 boundary with onboarding status resolution', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'Onboarding entry' }),
    ).toBeVisible();
  });
});
