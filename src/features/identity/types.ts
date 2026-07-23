export type IdentityClientError = {
  code?: string;
  message: string;
};

export type IdentitySession = {
  user: {
    id: string;
    isAnonymous: boolean;
  };
};

type IdentityClientResult<T> = Promise<{
  data: T;
  error: IdentityClientError | null;
}>;

export interface IdentityBootstrapClient {
  auth: {
    getSession(): IdentityClientResult<{
      session: IdentitySession | null;
    }>;
    refreshSession(): IdentityClientResult<{
      session: IdentitySession | null;
    }>;
    signInAnonymously(): IdentityClientResult<{
      session: IdentitySession | null;
    }>;
    signOut(options: {
      scope: 'local';
    }): Promise<{ error: IdentityClientError | null }>;
  };
  ensureAnonymousIdentity(): IdentityClientResult<unknown>;
}

export type IdentitySessionDisposition = 'reused' | 'created' | 'replaced';

export type IdentityRecoveryStatus =
  'canonical' | 'refreshed' | 'identity_replaced';

export type AnonymousIdentity = {
  anonymousUserId: string;
  wardrobeId: string;
};

export type IdentityBootstrapResult = AnonymousIdentity & {
  sessionDisposition: IdentitySessionDisposition;
  recoveryStatus: IdentityRecoveryStatus;
};

export type IdentityErrorCode =
  | 'configuration_missing'
  | 'auth_unavailable'
  | 'anonymous_sign_in_disabled'
  | 'session_recovery_failed'
  | 'unsupported_auth_identity'
  | 'bootstrap_unavailable'
  | 'bootstrap_contract_invalid';

export type IdentityPublicError = {
  code: IdentityErrorCode;
  message: string;
};

export type IdentityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'ready' } & IdentityBootstrapResult)
  | {
      status: 'recoverable_error';
      error: IdentityPublicError;
    }
  | {
      status: 'unrecoverable_error';
      error: IdentityPublicError;
    };
