import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { RecoveryBannerView } from './recovery-banner';
import type { RecoveryPublicStatus } from './types';

const states: Array<[RecoveryPublicStatus, string]> = [
  ['pending', 'Your pending change is retained.'],
  ['dispatching', 'Retrying your retained change…'],
  ['blocked_offline', 'You’re offline. Loaded content remains available.'],
  ['blocked_identity', 'Restore your private session to retry.'],
  ['retry_scheduled', 'Your change is retained for another retry.'],
  ['retry_available', 'A retained change needs a manual retry.'],
  ['conflict', 'This change needs refreshed canonical state.'],
  ['corrupt_recovered', 'Invalid local recovery data was removed safely.'],
  ['storage_unavailable', 'Recovery storage is unavailable.'],
  ['succeeded', 'Your retained change is up to date.'],
];

describe('RecoveryBannerView', () => {
  it.each(states)(
    'renders the %s state with an accessible text equivalent',
    (status, message) => {
      render(
        <RecoveryBannerView
          snapshot={{
            status,
            pendingCount: status === 'succeeded' ? 0 : 1,
            message,
          }}
          onRetry={vi.fn()}
        />,
      );

      const role = [
        'conflict',
        'corrupt_recovered',
        'storage_unavailable',
      ].includes(status)
        ? 'alert'
        : 'status';
      expect(
        screen.getByRole(role, { name: 'Recovery status' }),
      ).toHaveTextContent(message);
    },
  );

  it('exposes a keyboard-native 44px retry control for recoverable terminal state', () => {
    const retry = vi.fn();
    render(
      <RecoveryBannerView
        snapshot={{
          status: 'retry_available',
          pendingCount: 1,
          message: 'A retained change needs a manual retry.',
        }}
        onRetry={retry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('has no automated accessibility violations', async () => {
    const { container } = render(
      <RecoveryBannerView
        snapshot={{
          status: 'conflict',
          pendingCount: 1,
          message: 'This change needs refreshed canonical state.',
        }}
        onRetry={vi.fn()}
      />,
    );

    expect((await axe.run(container)).violations).toEqual([]);
  });
});
