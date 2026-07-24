import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoutePlaceholder } from './route-placeholder';

describe('RoutePlaceholder', () => {
  it('labels deferred feature work without presenting fake completed state', () => {
    render(
      <RoutePlaceholder
        title="Wardrobe"
        packageName="P13 — Wardrobe"
        description="Saved-product behavior is deferred."
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Wardrobe' }),
    ).toBeVisible();
    expect(
      screen.getByText('Application shell · development boundary'),
    ).toBeVisible();
    expect(
      screen.getByText(/No feature data or completed product state/i),
    ).toBeVisible();
    expect(
      screen.queryByText(/saved products|complete look|buy now/i),
    ).toBeNull();
  });
});
