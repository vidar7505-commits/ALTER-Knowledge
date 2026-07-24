import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdentityState } from '@/features/identity/types';

import { ApplicationShellView } from './app-shell';

let pathname = '/discover';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

const readyState: IdentityState = {
  status: 'ready',
  anonymousUserId: '10000000-0000-4000-8000-000000000051',
  wardrobeId: '20000000-0000-4000-8000-000000000051',
  sessionDisposition: 'reused',
  recoveryStatus: 'canonical',
};

function renderShell(
  state: IdentityState = readyState,
  options: {
    retry?: () => void;
    connectivity?: 'online' | 'offline' | 'restored';
  } = {},
) {
  return render(
    <ApplicationShellView
      state={state}
      retry={options.retry ?? vi.fn()}
      connectivity={options.connectivity}
    >
      <h1>Route content</h1>
    </ApplicationShellView>,
  );
}

describe('ApplicationShellView', () => {
  beforeEach(() => {
    pathname = '/discover';
  });

  it('renders both responsive navigation patterns from one accessible model', () => {
    renderShell();

    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');

    const navigationLandmarks = [
      screen.getByRole('navigation', {
        name: 'Primary mobile navigation',
      }),
      screen.getByRole('navigation', {
        name: 'Primary desktop navigation',
      }),
    ];
    expect(navigationLandmarks).toHaveLength(2);

    for (const landmark of navigationLandmarks) {
      const links = Array.from(landmark.querySelectorAll('ul a'));
      expect(links.map((link) => link.textContent)).toEqual([
        'Discover',
        'Wardrobe',
        'Challenge',
      ]);
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/discover',
        '/wardrobe',
        '/challenge',
      ]);
      expect(links[0]).toHaveAttribute('aria-current', 'page');
      expect(links[1]).not.toHaveAttribute('aria-current');
      expect(links[2]).not.toHaveAttribute('aria-current');
    }
  });

  it('applies current-page semantics to the matching route only', () => {
    pathname = '/challenge';
    renderShell();

    const currentLinks = screen
      .getAllByRole('link', { name: 'Challenge' })
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(currentLinks).toHaveLength(2);
    expect(
      screen
        .getAllByRole('link', { name: 'Discover' })
        .every((link) => !link.hasAttribute('aria-current')),
    ).toBe(true);
  });

  it('shows a screen-reader-safe loading state before navigation eligibility', () => {
    renderShell({ status: 'loading' });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Preparing your space',
    );
    expect(
      screen.queryByRole('navigation', { name: 'Primary navigation' }),
    ).toBeNull();
  });

  it('offers retry for a recoverable identity failure', () => {
    const retry = vi.fn();
    renderShell(
      {
        status: 'recoverable_error',
        error: { code: 'auth_unavailable', message: 'offline' },
      },
      { retry },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your activity has not been changed',
    );
  });

  it('does not expose an infinite retry control for unrecoverable setup', () => {
    renderShell({
      status: 'unrecoverable_error',
      error: {
        code: 'configuration_missing',
        message: 'internal configuration detail',
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The configuration must be corrected',
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('internal configuration detail')).toBeNull();
  });

  it('keeps the ready shell and navigation available while offline', () => {
    renderShell(readyState, { connectivity: 'offline' });

    expect(screen.getByRole('status')).toHaveTextContent('You’re offline');
    expect([
      screen.getByRole('navigation', {
        name: 'Primary mobile navigation',
      }),
      screen.getByRole('navigation', {
        name: 'Primary desktop navigation',
      }),
    ]).toHaveLength(2);
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'Route content' }),
    );
  });

  it('has no detectable structural accessibility violations', async () => {
    renderShell();

    const results = await axe.run(document.body, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
