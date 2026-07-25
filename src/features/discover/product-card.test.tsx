import axe from 'axe-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProductCard } from './product-card';
import { discoverProductFixture } from './test-fixtures';

describe('ProductCard', () => {
  it('renders canonical fields with separate detail and save semantics', () => {
    const product = discoverProductFixture(1);
    const onSave = vi.fn();
    render(
      <ProductCard
        product={product}
        save={{ saved: false, busy: false, error: false }}
        onSave={onSave}
        onNavigate={vi.fn()}
        coordinator={null}
      />,
    );

    expect(screen.getByText(product.brand)).toBeVisible();
    expect(screen.getByText(product.name)).toBeVisible();
    expect(screen.getByText(product.subcategory!)).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: `Open ${product.brand} ${product.name}`,
      }),
    ).toHaveAttribute(
      'href',
      `/product/${product.product_id}?from=discover&position=1`,
    );
    const save = screen.getByRole('button', {
      name: `Save ${product.name} to Wardrobe`,
    });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('exposes saved, busy, and failure states accessibly', () => {
    const product = discoverProductFixture(2);
    render(
      <ProductCard
        product={product}
        save={{ saved: true, busy: true, error: true }}
        onSave={vi.fn()}
        onNavigate={vi.fn()}
        coordinator={null}
      />,
    );
    const remove = screen.getByRole('button', {
      name: `Remove ${product.name} from Wardrobe`,
    });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    expect(remove).toHaveAttribute('aria-busy', 'true');
    expect(remove).toBeDisabled();
    expect(screen.getByText('Save failed. Try again.')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('has no detectable structural accessibility violations', async () => {
    const product = discoverProductFixture(3);
    render(
      <main>
        <h1>Discover</h1>
        <ul>
          <ProductCard
            product={product}
            save={{ saved: false, busy: false, error: false }}
            onSave={vi.fn()}
            onNavigate={vi.fn()}
            coordinator={null}
          />
        </ul>
      </main>,
    );
    const results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});
