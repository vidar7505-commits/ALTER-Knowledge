import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogProductFixture } from '@/features/catalog/test-fixtures';

import { WardrobeExperience } from './wardrobe-experience';

vi.mock('@/features/identity/identity-provider', () => ({
  useAnonymousIdentity: () => ({
    state: {
      status: 'ready',
      anonymousUserId: '10000000-0000-4000-8000-000000000001',
    },
  }),
}));

vi.mock('@/features/discover/storage', () => ({
  getSessionCandidateId: () => '30000000-0000-4000-8000-000000000001',
}));

const item = {
  savedProductId: '70000000-0000-4000-8000-000000000001',
  productId: catalogProductFixture(1).id,
  savedAt: '2026-07-29T12:00:00.000Z',
  product: catalogProductFixture(1),
};

function setup(overrides: Record<string, unknown> = {}) {
  const service = {
    ensureSession: vi.fn().mockResolvedValue({
      session_id: '30000000-0000-4000-8000-000000000001',
      session_number: 1,
      is_return_session: false,
      started_at: '2026-07-29T10:00:00.000Z',
    }),
    load: vi.fn().mockResolvedValue([item]),
    removeProduct: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: '80000000-0000-4000-8000-000000000001',
      data: {
        saved_product_id: item.savedProductId,
        product_id: item.productId,
        removed_at: '2026-07-29T12:30:00.000Z',
      },
    }),
    saveProduct: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: '80000000-0000-4000-8000-000000000002',
      data: {
        saved_product_id: '70000000-0000-4000-8000-000000000002',
        product_id: item.productId,
        saved_at: '2026-07-29T12:31:00.000Z',
      },
    }),
    ...overrides,
  };
  const telemetry = {
    capture: vi.fn().mockResolvedValue({ status: 'accepted' }),
  };
  render(
    <WardrobeExperience
      forcedService={service as never}
      forcedTelemetry={telemetry as never}
    />,
  );
  return { service, telemetry };
}

describe('WardrobeExperience', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows loading without flashing the empty state', async () => {
    let resolve!: (value: (typeof item)[]) => void;
    const load = vi.fn(
      () =>
        new Promise<(typeof item)[]>((done) => {
          resolve = done;
        }),
    );
    setup({ load });

    expect(
      await screen.findByRole('status', { name: 'Loading your Wardrobe' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Your Wardrobe starts here.'),
    ).not.toBeInTheDocument();
    resolve([item]);
    expect(await screen.findByText(item.product.name)).toBeInTheDocument();
  });

  it('renders canonical fields and a Wardrobe-source Product Detail link', async () => {
    setup();

    expect(await screen.findByText(item.product.name)).toBeInTheDocument();
    expect(screen.getByText(item.product.brand)).toBeInTheDocument();
    expect(screen.getByText(item.product.category)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: `Open ${item.product.brand} ${item.product.name}`,
      }),
    ).toHaveAttribute('href', `/product/${item.productId}?from=wardrobe`);
    expect(screen.getByText('1 saved')).toBeInTheDocument();
  });

  it('shows the canonical empty and recoverable query states', async () => {
    const { unmount } = render(
      <WardrobeExperience
        forcedService={
          {
            ensureSession: vi.fn().mockResolvedValue({
              session_id: '30000000-0000-4000-8000-000000000001',
              session_number: 1,
              is_return_session: false,
              started_at: '2026-07-29T10:00:00.000Z',
            }),
            load: vi.fn().mockResolvedValue([]),
          } as never
        }
        forcedTelemetry={
          {
            capture: vi.fn().mockResolvedValue({ status: 'accepted' }),
          } as never
        }
      />,
    );
    expect(
      await screen.findByText('Your Wardrobe starts here.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Explore pieces' }),
    ).toHaveAttribute('href', '/discover');
    unmount();

    setup({
      load: vi
        .fn()
        .mockRejectedValue(
          new Error('raw database detail that must never render'),
        ),
    });
    expect(
      await screen.findByText('We couldn’t load your Wardrobe.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.queryByText(/raw database detail/i)).not.toBeInTheDocument();
  });

  it('removes by saved-product ID and restores through canonical Undo', async () => {
    const { service } = setup();
    const remove = await screen.findByRole('button', {
      name: `Remove ${item.product.name} from Wardrobe`,
    });
    fireEvent.click(remove);
    fireEvent.click(remove);

    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(service.removeProduct).toHaveBeenCalledOnce();
    expect(service.removeProduct.mock.calls[0]?.[0]).toBe(item.savedProductId);
    expect(screen.queryByText(item.product.name)).not.toBeInTheDocument();

    fireEvent.click(undo);
    fireEvent.click(undo);
    await waitFor(() => {
      expect(screen.getByText(item.product.name)).toBeInTheDocument();
    });
    expect(service.saveProduct).toHaveBeenCalledOnce();
    expect(service.saveProduct.mock.calls[0]?.[0]).toBe(item.productId);
  });

  it('keeps the card on remove failure and keeps Undo honest on save failure', async () => {
    const removeProduct = vi.fn().mockRejectedValue(new Error('private'));
    setup({ removeProduct });
    fireEvent.click(
      await screen.findByRole('button', {
        name: `Remove ${item.product.name} from Wardrobe`,
      }),
    );
    expect(
      await screen.findByText("We couldn't remove that piece."),
    ).toBeInTheDocument();
    expect(screen.getByText(item.product.name)).toBeInTheDocument();
  });

  it('does not fabricate restoration when Undo fails', async () => {
    setup({ saveProduct: vi.fn().mockRejectedValue(new Error('private')) });
    fireEvent.click(
      await screen.findByRole('button', {
        name: `Remove ${item.product.name} from Wardrobe`,
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(
      await screen.findByText("We couldn't restore it. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(item.product.name, { selector: 'span' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('expires Undo after five seconds and pauses while focus is inside', async () => {
    vi.useFakeTimers();
    try {
      setup();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      fireEvent.click(
        screen.getByRole('button', {
          name: `Remove ${item.product.name} from Wardrobe`,
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      const undo = screen.getByRole('button', { name: 'Undo' });
      fireEvent.focus(undo);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });
      expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible();
      fireEvent.blur(undo);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_001);
      });
      expect(
        screen.queryByRole('button', { name: 'Undo' }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('has no detectable structural accessibility violations', async () => {
    const { container } = render(
      <WardrobeExperience
        forcedService={
          {
            ensureSession: vi.fn().mockResolvedValue({
              session_id: '30000000-0000-4000-8000-000000000001',
              session_number: 1,
              is_return_session: false,
              started_at: '2026-07-29T10:00:00.000Z',
            }),
            load: vi.fn().mockResolvedValue([item]),
          } as never
        }
        forcedTelemetry={
          {
            capture: vi.fn().mockResolvedValue({ status: 'accepted' }),
          } as never
        }
      />,
    );
    await screen.findByText(item.product.name);
    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});
