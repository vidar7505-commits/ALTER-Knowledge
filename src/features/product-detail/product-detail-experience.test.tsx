import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';

import { ProductDetailExperience } from './product-detail-experience';

const { sampleProduct } = vi.hoisted(() => ({
  sampleProduct: {
    id: 'c0800000-0000-4000-8000-000000000001',
    name: 'Canonical Product 1',
    brand: 'Fixture Studio',
    category: 'top' as const,
    subcategory: 'top-fixture',
    description: 'Curated catalog fixture 1.',
    image_urls: [
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&h=1500&q=85',
    ],
    image_metadata: {
      primary_index: 0,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&h=1500&q=85',
          width: 1200,
          height: 1500,
          aspect_ratio: 0.8,
          alt: 'Fixture Studio Canonical Product 1, top.',
        },
      ],
    },
    price_amount: 101,
    price_currency: 'EUR',
    attributes: {
      style_tags: ['minimal' as const],
      color: 'ink',
      season: ['all season'],
      fit: 'regular',
      occasion_tags: ['going_out' as const],
      materials: ['cotton'],
    },
    slot_eligibility: ['top' as const],
    is_active: true as const,
    catalog_version: 'lr001-catalog-v1' as const,
  },
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('from=discover&position=1'),
}));

// Mock Anonymous Identity
vi.mock('@/features/identity/identity-provider', () => ({
  useAnonymousIdentity: () => ({
    state: {
      status: 'ready',
      anonymousUserId: 'a0000000-0000-4000-8000-000000000001',
    },
  }),
}));

// Mock Catalog Service
vi.mock('@/features/catalog/supabase', () => ({
  createBrowserCatalogService: () => ({
    getProduct: vi.fn().mockImplementation((id: string) => {
      if (id === sampleProduct.id) {
        return Promise.resolve({ status: 'found', product: sampleProduct });
      }
      if (id === 'c0800000-0000-4000-8000-000000000999') {
        return Promise.resolve({ status: 'not_found', productId: id });
      }
      return Promise.reject(new Error('Network error'));
    }),
  }),
}));

// Mock Product Detail Source
vi.mock('./supabase', () => ({
  createBrowserProductDetailSource: () => ({
    readSavedProducts: vi.fn().mockResolvedValue([]),
    saveProduct: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: 'op-1',
      data: {
        saved_product_id: 'saved-1',
        product_id: sampleProduct.id,
        saved_at: '2026-07-26T00:00:00Z',
      },
    }),
    removeProduct: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: 'op-2',
      data: {
        saved_product_id: 'saved-1',
        product_id: sampleProduct.id,
        removed_at: '2026-07-26T00:00:00Z',
      },
    }),
  }),
  readSavedProductsFromSource: vi.fn().mockResolvedValue([]),
  saveProductFromSource: vi.fn().mockResolvedValue({
    ok: true,
    operation_id: 'op-1',
    data: {
      saved_product_id: 'saved-1',
      product_id: sampleProduct.id,
      saved_at: '2026-07-26T00:00:00Z',
    },
  }),
  removeProductFromSource: vi.fn().mockResolvedValue({
    ok: true,
    operation_id: 'op-2',
    data: {
      saved_product_id: 'saved-1',
      product_id: sampleProduct.id,
      removed_at: '2026-07-26T00:00:00Z',
    },
  }),
}));

// Mock Telemetry
vi.mock('./telemetry', () => ({
  createBrowserProductDetailTelemetry: () => ({
    capture: vi.fn().mockResolvedValue({ status: 'accepted' }),
  }),
  quietDetailCapture: vi.fn(),
}));

describe('ProductDetailExperience', () => {
  it('renders product details accessibly when product is found', async () => {
    render(<ProductDetailExperience productId={sampleProduct.id} />);

    expect(
      screen.getByRole('status', { name: 'Loading product' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: sampleProduct.name }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(sampleProduct.brand)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `Save ${sampleProduct.name} to Wardrobe`,
      }),
    ).toBeInTheDocument();
  });

  it('renders not found state when catalog returns not_found', async () => {
    render(
      <ProductDetailExperience productId="c0800000-0000-4000-8000-000000000999" />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Product not found' }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('link', { name: 'Return to Discover' }),
    ).toBeInTheDocument();
  });

  it('renders error state on query failure', async () => {
    render(<ProductDetailExperience productId="invalid-id" />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: "We couldn't load this product.",
        }),
      ).toBeInTheDocument();
    });
  });

  it('toggles save state when save button is clicked', async () => {
    render(<ProductDetailExperience productId={sampleProduct.id} />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: sampleProduct.name }),
      ).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', {
      name: `Save ${sampleProduct.name} to Wardrobe`,
    });
    expect(saveButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: `Remove ${sampleProduct.name} from Wardrobe`,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('removes a saved product and restores it through canonical Undo', async () => {
    render(<ProductDetailExperience productId={sampleProduct.id} />);

    await screen.findByRole('heading', {
      level: 1,
      name: sampleProduct.name,
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: `Save ${sampleProduct.name} to Wardrobe`,
      }),
    );
    const remove = await screen.findByRole('button', {
      name: `Remove ${sampleProduct.name} from Wardrobe`,
    });
    fireEvent.click(remove);
    const undo = await screen.findByRole('button', { name: 'Undo' });
    fireEvent.click(undo);
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: `Remove ${sampleProduct.name} from Wardrobe`,
        }),
      ).toBeInTheDocument();
    });
  });

  it('has no detectable structural accessibility violations', async () => {
    const { container } = render(
      <ProductDetailExperience productId={sampleProduct.id} />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: sampleProduct.name }),
      ).toBeInTheDocument();
    });

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});
