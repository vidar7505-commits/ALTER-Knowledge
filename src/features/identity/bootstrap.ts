import { z } from 'zod';

import { BrowserEnvironmentError } from '@/lib/environment/browser';

import type {
  IdentityBootstrapClient,
  IdentityBootstrapResult,
  IdentityClientError,
  IdentityErrorCode,
  IdentityPublicError,
  IdentityRecoveryStatus,
  IdentitySession,
  IdentitySessionDisposition,
  IdentityState,
} from './types';

const bootstrapRowSchema = z.object({
  anonymous_user_id: z.uuid(),
  wardrobe_id: z.uuid(),
});

const invalidSessionCodes = new Set([
  'bad_jwt',
  'invalid_credentials',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
]);

const inFlightBootstraps = new WeakMap<
  IdentityBootstrapClient,
  Promise<IdentityBootstrapResult>
>();

export class IdentityBootstrapFailure extends Error {
  constructor(
    readonly code: IdentityErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'IdentityBootstrapFailure';
  }
}

function isInvalidSessionError(error: IdentityClientError): boolean {
  return Boolean(error.code && invalidSessionCodes.has(error.code));
}

function authFailure(
  error: IdentityClientError,
  fallbackMessage: string,
): IdentityBootstrapFailure {
  if (error.code === 'anonymous_provider_disabled') {
    return new IdentityBootstrapFailure(
      'anonymous_sign_in_disabled',
      false,
      'Anonymous authentication is not enabled for this Supabase environment.',
      { cause: error },
    );
  }

  return new IdentityBootstrapFailure(
    'auth_unavailable',
    true,
    fallbackMessage,
    { cause: error },
  );
}

function requireAnonymousSession(session: IdentitySession): IdentitySession {
  if (!session.user.isAnonymous) {
    throw new IdentityBootstrapFailure(
      'unsupported_auth_identity',
      false,
      'P05 supports anonymous Supabase Auth sessions only.',
    );
  }

  return session;
}

async function createAnonymousSession(
  client: IdentityBootstrapClient,
  disposition: Extract<IdentitySessionDisposition, 'created' | 'replaced'>,
): Promise<{
  session: IdentitySession;
  sessionDisposition: IdentitySessionDisposition;
  recoveryStatus: IdentityRecoveryStatus;
}> {
  const { data, error } = await client.auth.signInAnonymously();

  if (error) {
    throw authFailure(
      error,
      'Anonymous authentication is temporarily unavailable.',
    );
  }

  if (!data.session) {
    throw new IdentityBootstrapFailure(
      'bootstrap_contract_invalid',
      false,
      'Anonymous sign-in completed without an authenticated session.',
    );
  }

  return {
    session: requireAnonymousSession(data.session),
    sessionDisposition: disposition,
    recoveryStatus:
      disposition === 'replaced' ? 'identity_replaced' : 'canonical',
  };
}

async function recoverSession(client: IdentityBootstrapClient): Promise<{
  session: IdentitySession;
  sessionDisposition: IdentitySessionDisposition;
  recoveryStatus: IdentityRecoveryStatus;
}> {
  const current = await client.auth.getSession();

  if (!current.error) {
    if (current.data.session) {
      return {
        session: requireAnonymousSession(current.data.session),
        sessionDisposition: 'reused',
        recoveryStatus: 'canonical',
      };
    }

    return createAnonymousSession(client, 'created');
  }

  if (!isInvalidSessionError(current.error)) {
    throw authFailure(
      current.error,
      'The existing anonymous session could not be checked.',
    );
  }

  const refreshed = await client.auth.refreshSession();

  if (!refreshed.error && refreshed.data.session) {
    return {
      session: requireAnonymousSession(refreshed.data.session),
      sessionDisposition: 'reused',
      recoveryStatus: 'refreshed',
    };
  }

  if (refreshed.error && !isInvalidSessionError(refreshed.error)) {
    throw new IdentityBootstrapFailure(
      'session_recovery_failed',
      true,
      'The anonymous session could not be refreshed safely.',
      { cause: refreshed.error },
    );
  }

  const signedOut = await client.auth.signOut({ scope: 'local' });

  if (signedOut.error && !isInvalidSessionError(signedOut.error)) {
    throw new IdentityBootstrapFailure(
      'session_recovery_failed',
      true,
      'Invalid local authentication state could not be cleared safely.',
      { cause: signedOut.error },
    );
  }

  return createAnonymousSession(client, 'replaced');
}

function parseBootstrapRow(data: unknown) {
  const candidate = Array.isArray(data) ? data[0] : data;
  const result = bootstrapRowSchema.safeParse(candidate);

  if (!result.success) {
    throw new IdentityBootstrapFailure(
      'bootstrap_contract_invalid',
      false,
      'Anonymous identity provisioning returned an invalid result.',
      { cause: result.error },
    );
  }

  return result.data;
}

async function runBootstrap(
  client: IdentityBootstrapClient,
): Promise<IdentityBootstrapResult> {
  const sessionResult = await recoverSession(client);
  const provisioned = await client.ensureAnonymousIdentity();

  if (provisioned.error) {
    const unrecoverable =
      provisioned.error.code === '42501' ||
      provisioned.error.code === 'PGRST202';

    throw new IdentityBootstrapFailure(
      'bootstrap_unavailable',
      !unrecoverable,
      unrecoverable
        ? 'The anonymous identity bootstrap database boundary is unavailable.'
        : 'Anonymous identity provisioning failed and can be retried.',
      { cause: provisioned.error },
    );
  }

  const row = parseBootstrapRow(provisioned.data);

  return {
    anonymousUserId: row.anonymous_user_id,
    wardrobeId: row.wardrobe_id,
    sessionDisposition: sessionResult.sessionDisposition,
    recoveryStatus: sessionResult.recoveryStatus,
  };
}

export function bootstrapAnonymousIdentity(
  client: IdentityBootstrapClient,
): Promise<IdentityBootstrapResult> {
  const existing = inFlightBootstraps.get(client);

  if (existing) {
    return existing;
  }

  const pending = runBootstrap(client).finally(() => {
    if (inFlightBootstraps.get(client) === pending) {
      inFlightBootstraps.delete(client);
    }
  });

  inFlightBootstraps.set(client, pending);

  return pending;
}

export function toIdentityErrorState(error: unknown): IdentityState {
  if (error instanceof BrowserEnvironmentError) {
    return {
      status: 'unrecoverable_error',
      error: {
        code: 'configuration_missing',
        message: error.message,
      },
    };
  }

  if (error instanceof IdentityBootstrapFailure) {
    const publicError: IdentityPublicError = {
      code: error.code,
      message: error.message,
    };

    return error.retryable
      ? { status: 'recoverable_error', error: publicError }
      : { status: 'unrecoverable_error', error: publicError };
  }

  return {
    status: 'unrecoverable_error',
    error: {
      code: 'bootstrap_contract_invalid',
      message: 'Anonymous identity bootstrap failed unexpectedly.',
    },
  };
}
