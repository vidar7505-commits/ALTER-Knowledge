import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  readBrowserEnvironment,
  type BrowserEnvironment,
} from '@/lib/environment/browser';
import type {
  IdentityBootstrapClient,
  IdentityClientError,
  IdentitySession,
} from '@/features/identity/types';

let browserSupabaseClient: SupabaseClient | undefined;
let browserIdentityClient: IdentityBootstrapClient | undefined;

function toIdentitySession(
  session: {
    user: { id: string; is_anonymous?: boolean };
  } | null,
): IdentitySession | null {
  return session
    ? {
        user: {
          id: session.user.id,
          isAnonymous: session.user.is_anonymous === true,
        },
      }
    : null;
}

function toIdentityError(
  error: { code?: string; message: string } | null,
): IdentityClientError | null {
  return error
    ? {
        code: error.code,
        message: error.message,
      }
    : null;
}

function adaptSupabaseClient(
  supabase: SupabaseClient,
): IdentityBootstrapClient {
  return {
    auth: {
      async getSession() {
        const { data, error } = await supabase.auth.getSession();

        return {
          data: { session: toIdentitySession(data.session) },
          error: toIdentityError(error),
        };
      },
      async refreshSession() {
        const { data, error } = await supabase.auth.refreshSession();

        return {
          data: { session: toIdentitySession(data.session) },
          error: toIdentityError(error),
        };
      },
      async signInAnonymously() {
        const { data, error } = await supabase.auth.signInAnonymously();

        return {
          data: { session: toIdentitySession(data.session) },
          error: toIdentityError(error),
        };
      },
      async signOut(options) {
        const { error } = await supabase.auth.signOut(options);

        return { error: toIdentityError(error) };
      },
    },
    async ensureAnonymousIdentity() {
      const { data, error } = await supabase.rpc('ensure_anonymous_identity');

      return {
        data,
        error: toIdentityError(error),
      };
    },
  };
}

export function createBrowserIdentityClient(
  environment: BrowserEnvironment,
): IdentityBootstrapClient {
  return adaptSupabaseClient(createBrowserSupabaseClient(environment));
}

export function createBrowserSupabaseClient(
  environment: BrowserEnvironment,
): SupabaseClient {
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    },
  );
}

export function getBrowserSupabaseClient(): SupabaseClient {
  browserSupabaseClient ??= createBrowserSupabaseClient(
    readBrowserEnvironment(),
  );

  return browserSupabaseClient;
}

export function getBrowserIdentityClient(): IdentityBootstrapClient {
  browserIdentityClient ??= adaptSupabaseClient(getBrowserSupabaseClient());

  return browserIdentityClient;
}
