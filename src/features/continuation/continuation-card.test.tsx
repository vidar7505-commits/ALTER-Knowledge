import axe from 'axe-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContinuationCard } from './continuation-card';
import { ContinuationService } from './service';
import type { ContinuationTelemetry } from './telemetry';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const session = {
  session_id: '30000000-0000-4000-8000-000000000002',
  session_number: 2,
  is_return_session: true,
  started_at: '2026-07-30T10:31:00.000Z',
};

function service() {
  return new ContinuationService({
    readActiveProgress: vi.fn().mockResolvedValue([
      {
        id: '40000000-0000-4000-8000-000000000001',
        status: 'in_progress',
      },
    ]),
    readActiveProgressItems: vi.fn().mockResolvedValue([
      {
        slot_id: 'top',
        product_id: '50000000-0000-4000-8000-000000000001',
      },
    ]),
    readActiveSavedProductIds: vi
      .fn()
      .mockResolvedValue([
        { product_id: '50000000-0000-4000-8000-000000000001' },
      ]),
    readActiveProduct: vi.fn().mockResolvedValue([{ id: 'product' }]),
    readLatestCompletion: vi.fn().mockResolvedValue([]),
    readReturnSessionsAfter: vi.fn().mockResolvedValue([]),
    readMeaningfulDestination: vi.fn().mockResolvedValue([]),
    readActiveSavedRows: vi.fn().mockResolvedValue([]),
  });
}

function telemetry() {
  return {
    capture: vi.fn().mockResolvedValue({
      index: 0,
      event_id: '90000000-0000-4000-8000-000000000001',
      status: 'accepted',
      error_codes: [],
      received_at: '2026-07-30T10:31:00.000Z',
    }),
  } as unknown as ContinuationTelemetry;
}

describe('ContinuationCard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it('renders one accessible canonical action and consumes rapid activation once', async () => {
    const capture = telemetry();
    const { container } = render(
      <main>
        <h1>Discover</h1>
        <ContinuationCard
          identityId="10000000-0000-4000-8000-000000000001"
          session={session}
          forcedService={service()}
          forcedTelemetry={capture}
        />
      </main>,
    );
    const action = await screen.findByRole('button', { name: 'Continue' });
    expect(screen.getAllByTestId('continuation-card')).toHaveLength(1);
    fireEvent.click(action);
    fireEvent.click(action);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/challenge');
    await waitFor(() => {
      expect(capture.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'continuation_action_selected',
        }),
      );
    });
    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  }, 15_000);

  it('dismisses distinctly and does not render again in the same session', async () => {
    const props = {
      identityId: '10000000-0000-4000-8000-000000000001',
      session,
      forcedService: service(),
      forcedTelemetry: telemetry(),
    };
    const first = render(<ContinuationCard {...props} />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Dismiss After Dark continuation',
      }),
    );
    expect(screen.queryByTestId('continuation-card')).toBeNull();
    first.unmount();
    render(<ContinuationCard {...props} />);
    await waitFor(() => {
      expect(screen.queryByTestId('continuation-card')).toBeNull();
    });
  });
});
