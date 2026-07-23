import { describe, expect, it, vi } from 'vitest';

import { BrowserEnvironmentError } from '@/lib/environment/browser';

import {
  bootstrapAnonymousIdentity,
  IdentityBootstrapFailure,
  toIdentityErrorState,
} from './bootstrap';
import type {
  IdentityBootstrapClient,
  IdentityClientError,
  IdentitySession,
} from './types';

const authUserId = '00000000-0000-4000-8000-000000000051';
const replacementAuthUserId = '00000000-0000-4000-8000-000000000052';
const anonymousUserId = '10000000-0000-4000-8000-000000000051';
const wardrobeId = '20000000-0000-4000-8000-000000000051';

function session(userId = authUserId): IdentitySession {
  return { user: { id: userId, isAnonymous: true } };
}

function clientError(code: string, message = code): IdentityClientError {
  return { code, message };
}

function createClient(): IdentityBootstrapClient & {
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
        data: { session: session() },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: clientError('session_expired'),
      }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { session: session() },
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

describe('bootstrapAnonymousIdentity', () => {
  it('reuses an existing valid session and returns canonical identifiers', async () => {
    const client = createClient();

    await expect(bootstrapAnonymousIdentity(client)).resolves.toEqual({
      anonymousUserId,
      wardrobeId,
      sessionDisposition: 'reused',
      recoveryStatus: 'canonical',
    });

    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(client.ensureAnonymousIdentity).toHaveBeenCalledOnce();
  });

  it('rejects a permanent-account session because account upgrade is deferred', async () => {
    const client = createClient();
    client.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: authUserId, isAnonymous: false },
        },
      },
      error: null,
    });

    await expect(bootstrapAnonymousIdentity(client)).rejects.toMatchObject({
      code: 'unsupported_auth_identity',
      retryable: false,
    });

    expect(client.ensureAnonymousIdentity).not.toHaveBeenCalled();
  });

  it('creates an anonymous session when no local session exists', async () => {
    const client = createClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(bootstrapAnonymousIdentity(client)).resolves.toMatchObject({
      anonymousUserId,
      wardrobeId,
      sessionDisposition: 'created',
      recoveryStatus: 'canonical',
    });

    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('returns the same identity and Wardrobe across repeated bootstraps', async () => {
    const client = createClient();
    client.auth.getSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValue({
        data: { session: session() },
        error: null,
      });

    const first = await bootstrapAnonymousIdentity(client);
    const second = await bootstrapAnonymousIdentity(client);

    expect(first.anonymousUserId).toBe(second.anonymousUserId);
    expect(first.wardrobeId).toBe(second.wardrobeId);
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(client.ensureAnonymousIdentity).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight operation across concurrent callers', async () => {
    const client = createClient();
    let resolveSession:
      | ((value: {
          data: { session: IdentitySession | null };
          error: null;
        }) => void)
      | undefined;
    const pendingSession = new Promise<{
      data: { session: IdentitySession | null };
      error: null;
    }>((resolve) => {
      resolveSession = resolve;
    });

    client.auth.getSession.mockReturnValue(pendingSession);

    const first = bootstrapAnonymousIdentity(client);
    const second = bootstrapAnonymousIdentity(client);

    expect(first).toBe(second);
    resolveSession?.({ data: { session: null }, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ anonymousUserId, wardrobeId }),
      expect.objectContaining({ anonymousUserId, wardrobeId }),
    ]);
    expect(client.auth.getSession).toHaveBeenCalledOnce();
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(client.ensureAnonymousIdentity).toHaveBeenCalledOnce();
  });

  it('reuses the identity when an invalid local session refreshes', async () => {
    const client = createClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: clientError('session_expired'),
    });
    client.auth.refreshSession.mockResolvedValue({
      data: { session: session() },
      error: null,
    });

    await expect(bootstrapAnonymousIdentity(client)).resolves.toMatchObject({
      sessionDisposition: 'reused',
      recoveryStatus: 'refreshed',
    });

    expect(client.auth.refreshSession).toHaveBeenCalledOnce();
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('clears only invalid local auth state and reports identity replacement', async () => {
    const client = createClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: clientError('refresh_token_not_found'),
    });
    client.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: clientError('refresh_token_not_found'),
    });
    client.auth.signInAnonymously.mockResolvedValue({
      data: { session: session(replacementAuthUserId) },
      error: null,
    });

    await expect(bootstrapAnonymousIdentity(client)).resolves.toMatchObject({
      sessionDisposition: 'replaced',
      recoveryStatus: 'identity_replaced',
    });

    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('preserves local auth state for a recoverable session check failure', async () => {
    const client = createClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: clientError('request_timeout'),
    });

    await expect(bootstrapAnonymousIdentity(client)).rejects.toMatchObject({
      code: 'auth_unavailable',
      retryable: true,
    });

    expect(client.auth.refreshSession).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('represents a disabled anonymous provider as unrecoverable', async () => {
    const client = createClient();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: clientError('anonymous_provider_disabled'),
    });

    await expect(bootstrapAnonymousIdentity(client)).rejects.toMatchObject({
      code: 'anonymous_sign_in_disabled',
      retryable: false,
    });
  });

  it('represents transient RPC failures as recoverable', async () => {
    const client = createClient();
    client.ensureAnonymousIdentity.mockResolvedValue({
      data: null,
      error: clientError('request_timeout'),
    });

    await expect(bootstrapAnonymousIdentity(client)).rejects.toMatchObject({
      code: 'bootstrap_unavailable',
      retryable: true,
    });
  });

  it('represents missing RPC configuration as unrecoverable', async () => {
    const client = createClient();
    client.ensureAnonymousIdentity.mockResolvedValue({
      data: null,
      error: clientError('PGRST202'),
    });

    await expect(bootstrapAnonymousIdentity(client)).rejects.toMatchObject({
      code: 'bootstrap_unavailable',
      retryable: false,
    });
  });

  it('rejects an invalid provisioning contract without exposing session data', async () => {
    const client = createClient();
    client.ensureAnonymousIdentity.mockResolvedValue({
      data: [{ anonymous_user_id: 'invalid', wardrobe_id: wardrobeId }],
      error: null,
    });

    await expect(bootstrapAnonymousIdentity(client)).rejects.toMatchObject({
      code: 'bootstrap_contract_invalid',
      retryable: false,
    });
  });
});

describe('toIdentityErrorState', () => {
  it('maps recoverable and unrecoverable bootstrap errors explicitly', () => {
    expect(
      toIdentityErrorState(
        new IdentityBootstrapFailure('auth_unavailable', true, 'Try again.'),
      ),
    ).toEqual({
      status: 'recoverable_error',
      error: { code: 'auth_unavailable', message: 'Try again.' },
    });

    expect(toIdentityErrorState(new BrowserEnvironmentError())).toEqual({
      status: 'unrecoverable_error',
      error: {
        code: 'configuration_missing',
        message:
          'Anonymous identity requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
    });
  });
});
