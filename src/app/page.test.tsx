import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('renders a non-product token verification surface and typography roles', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        name: 'A L T E R . visual foundation',
      }),
    ).toBeVisible();
    expect(screen.getByText(/token verification/i)).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Typography roles' }),
    ).toBeVisible();
    expect(screen.getByText(/Ğğ İı Şş Çç Öö Üü/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: /verify focus/i }),
    ).toHaveAttribute('type', 'button');

    expect(
      screen.queryByText(/add to cart|buy now|wardrobe|challenge/i),
    ).toBeNull();
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
