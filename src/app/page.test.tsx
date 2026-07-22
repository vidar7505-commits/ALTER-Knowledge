import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the product name', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        name: 'A L T E R . — LR-001 development environment',
      }),
    ).toBeVisible();
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
