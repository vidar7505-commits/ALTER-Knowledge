import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityBootstrapClient } from './types';
import { IdentityProvider, useAnonymousIdentity } from './identity-provider';

const anonymousUserId = '10000000-0000-4000-8000-000000000051';
const wardrobeId = '20000000-0000-4000-8000-000000000051';

function IdentityStatus() {
  const { state } = useAnonymousIdentity();

  return (
    <output>
      {state.status === 'ready'
        ? `${state.status}:${state.anonymousUserId}:${state.wardrobeId}:${state.sessionDisposition}`
        : state.status}
    </output>
  );
}

function createMissingSessionClient(): IdentityBootstrapClient & {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    signInAnonymously: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  ensureAnonymousIdentity: ReturnType<typeof vi.fn>;
} {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { code: 'session_expired', message: 'expired' },
      }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: '00000000-0000-4000-8000-000000000051',
              isAnonymous: true,
            },
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    ensureAnonymousIdentity: vi.fn().mockResolvedValue({
      data: [{ anonymous_user_id: anonymousUserId, wardrobe_id: wardrobeId }],
      error: null,
    }),
  };
}

describe('IdentityProvider', () => {
  it('exposes loading then ready without exposing tokens or session internals', async () => {
    const client = createMissingSessionClient();

    render(
      <IdentityProvider client={client}>
        <IdentityStatus />
      </IdentityProvider>,
    );

    expect(screen.getByText('loading')).toBeVisible();
    expect(
      await screen.findByText(`ready:${anonymousUserId}:${wardrobeId}:created`),
    ).toBeVisible();
  });

  it('converges Strict Mode duplicate effects on one anonymous sign-in', async () => {
    const client = createMissingSessionClient();

    render(
      <StrictMode>
        <IdentityProvider client={client}>
          <IdentityStatus />
        </IdentityProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText(/^ready:/)).toBeVisible();
    });

    expect(client.auth.getSession).toHaveBeenCalledOnce();
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(client.ensureAnonymousIdentity).toHaveBeenCalledOnce();
  });

  it('exposes recoverable auth failure as an explicit state', async () => {
    const client = createMissingSessionClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { code: 'request_timeout', message: 'offline' },
    });

    render(
      <IdentityProvider client={client}>
        <IdentityStatus />
      </IdentityProvider>,
    );

    expect(await screen.findByText('recoverable_error')).toBeVisible();
  });
});
