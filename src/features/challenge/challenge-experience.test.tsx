import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogProductFixture } from '@/features/catalog/test-fixtures';

import { ChallengeExperience } from './challenge-experience';
import { CHALLENGE_ID, ChallengeError, type ChallengeSnapshot } from './types';

vi.mock('@/features/identity/identity-provider', () => ({
  useAnonymousIdentity: () => ({
    state: {
      status: 'ready',
      anonymousUserId: '10000000-0000-4000-8000-000000000001',
    },
    retry: vi.fn(),
  }),
}));

vi.mock('@/features/discover/storage', () => ({
  getSessionCandidateId: () => '30000000-0000-4000-8000-000000000001',
}));

const definition = {
  id: CHALLENGE_ID,
  version: 'challenge-evening-v1' as const,
  title: 'After Dark' as const,
  context_copy: 'Build a look for an evening out.' as const,
  required_slots: [
    { slot_id: 'top' as const, label: 'Top', display_order: 1 },
    { slot_id: 'bottom' as const, label: 'Bottom', display_order: 2 },
    { slot_id: 'shoes' as const, label: 'Shoes', display_order: 3 },
    {
      slot_id: 'layer_or_accessory' as const,
      label: 'Layer or Accessory',
      display_order: 4,
    },
  ],
  completion_rules: {
    required_slot_count: 4 as const,
    unique_products: true as const,
    explicit_confirmation: true as const,
  },
  is_active: true as const,
};

function snapshot(
  selectedCount = 0,
  status: 'in_progress' | 'ready_to_complete' | 'completed' = 'in_progress',
): ChallengeSnapshot {
  const products = Array.from({ length: selectedCount }, (_, index) =>
    catalogProductFixture(index + 1),
  );
  return {
    definition,
    progress: {
      id: '60000000-0000-4000-8000-000000000001',
      challenge_id: CHALLENGE_ID,
      status,
      started_at: '2026-07-29T10:00:00.000Z',
      state_revision: selectedCount + 1,
    },
    selections: products.map((product, index) => ({
      progressItemId: `61000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      slotId: definition.required_slots[index]!.slot_id,
      productId: product.id,
      product,
    })),
    completion:
      status === 'completed'
        ? {
            id: '62000000-0000-4000-8000-000000000001',
            challenge_progress_id: '60000000-0000-4000-8000-000000000001',
            completed_at: '2026-07-29T12:00:00.000Z',
            selected_products_snapshot: {
              items: products.map((product, index) => ({
                slot_id: definition.required_slots[index]!.slot_id,
                product_id: product.id,
                name: product.name,
                brand: product.brand,
                category: product.category,
                image_urls: product.image_urls,
              })),
            },
          }
        : null,
    wardrobeProductIds: new Set(products.map((product) => product.id)),
  };
}

function setup(initial: ChallengeSnapshot | null, overrides = {}) {
  const unstarted: ChallengeSnapshot = {
    ...snapshot(),
    progress: null,
    selections: [],
    completion: null,
    wardrobeProductIds: new Set([catalogProductFixture(1).id]),
  };
  const service = {
    invalidate: vi.fn(),
    ensureSession: vi.fn().mockResolvedValue({
      session_id: '30000000-0000-4000-8000-000000000001',
      session_number: 1,
      is_return_session: false,
    }),
    recover: vi.fn().mockResolvedValue(initial ?? unstarted),
    start: vi.fn().mockResolvedValue({
      ok: true,
      operation_id: '80000000-0000-4000-8000-000000000001',
      state_revision: 1,
      data: {
        challenge_progress_id: '60000000-0000-4000-8000-000000000001',
        status: 'in_progress',
      },
    }),
    listProducts: vi.fn().mockResolvedValue({
      items: [catalogProductFixture(1)],
      nextCursor: null,
    }),
    select: vi.fn(),
    remove: vi.fn(),
    complete: vi.fn(),
    ...overrides,
  };
  const telemetry = {
    capture: vi.fn().mockResolvedValue({ status: 'accepted' }),
  };
  const result = render(
    <ChallengeExperience
      forcedService={service as never}
      forcedTelemetry={telemetry as never}
    />,
  );
  return { ...result, service, telemetry };
}

describe('ChallengeExperience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts through the canonical RPC and immediately guards duplicate input', async () => {
    const active = snapshot();
    const { service } = setup(null);
    service.recover
      .mockResolvedValueOnce({
        ...active,
        progress: null,
        wardrobeProductIds: new Set([catalogProductFixture(1).id]),
      })
      .mockResolvedValue(active);
    const button = await screen.findByRole('button', {
      name: 'Start challenge',
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(service.start).toHaveBeenCalledOnce());
    expect(service.start.mock.calls[0]?.[0]).toBe(CHALLENGE_ID);
    expect(service.start.mock.calls[0]?.[1]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('renders deterministic required-slot order and blocks incomplete completion', async () => {
    setup(snapshot(1));
    expect(
      await screen.findByRole('heading', { name: 'After Dark' }),
    ).toBeVisible();
    const buttons = screen.getAllByRole('button', { name: /required$/i });
    expect(buttons.map((button) => button.textContent)).toEqual([
      '+Add BottomRequired',
      '+Add ShoesRequired',
      '+Add Layer or AccessoryRequired',
    ]);
    expect(
      screen.getByRole('button', { name: 'Complete look' }),
    ).toBeDisabled();
  });

  it('selects with the current revision, stable operation ID, and no local success', async () => {
    const current = snapshot();
    const product = catalogProductFixture(1);
    current.wardrobeProductIds.add(product.id);
    let resolve!: (value: unknown) => void;
    const select = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { service } = setup(current, { select });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add Top, required' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Canonical Product 1/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Top, required' }));
    expect(select).toHaveBeenCalledOnce();
    const selectInput = (
      select.mock.calls as unknown as [[{ operationId: string }]]
    )[0][0];
    expect(selectInput).toMatchObject({
      progressId: current.progress!.id,
      slotId: 'top',
      productId: product.id,
      expectedRevision: 1,
    });
    expect(screen.queryByText(product.name)).not.toBeInTheDocument();
    resolve({
      ok: true,
      state_revision: 2,
      operation_id: selectInput.operationId,
      data: {},
    });
    await waitFor(() => expect(service.recover).toHaveBeenCalledTimes(2));
  });

  it('refreshes canonical truth on a typed revision mismatch without raw SQL', async () => {
    const current = snapshot();
    const product = catalogProductFixture(1);
    current.wardrobeProductIds.add(product.id);
    const refreshed = snapshot(1);
    const recover = vi
      .fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValue(refreshed);
    setup(current, {
      recover,
      select: vi
        .fn()
        .mockRejectedValue(
          new ChallengeError(
            'revision_mismatch',
            false,
            'challenge_revision_mismatch raw sql',
          ),
        ),
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add Top, required' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Canonical Product 1/ }),
    );
    expect(
      await screen.findByText(
        'The Challenge changed elsewhere, so we refreshed it.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/raw sql/i)).not.toBeInTheDocument();
  });

  it('keeps completed Challenge immutable and Product Detail source-aware', async () => {
    setup(snapshot(4, 'completed'));
    expect(await screen.findByText('Look complete.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /remove/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /replace/i }),
    ).not.toBeInTheDocument();
    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('from=challenge'));
    expect(links).toHaveLength(4);
  });

  it('has no automated accessibility violations in the active state', async () => {
    const { container } = setup(snapshot(2));
    await screen.findByRole('heading', { name: 'After Dark' });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
