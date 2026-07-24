import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('keeps entry routing neutral until onboarding status exists', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Entry routing arrives with onboarding.',
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/P10 will resolve onboarding status/i),
    ).toBeVisible();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('has no detectable accessibility violations', async () => {
    render(<HomePage />);

    const results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
