'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getBrowserIdentityClient } from '@/lib/supabase/browser';

import { bootstrapAnonymousIdentity, toIdentityErrorState } from './bootstrap';
import type { IdentityBootstrapClient, IdentityState } from './types';

type IdentityContextValue = {
  state: IdentityState;
  retry: () => void;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({
  children,
  client,
}: {
  children: ReactNode;
  client?: IdentityBootstrapClient;
}) {
  const [state, setState] = useState<IdentityState>({
    status: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.resolve()
      .then(() => client ?? getBrowserIdentityClient())
      .then((identityClient) => bootstrapAnonymousIdentity(identityClient))
      .then((result) => {
        if (active) {
          setState({ status: 'ready', ...result });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState(toIdentityErrorState(error));
        }
      });

    return () => {
      active = false;
    };
  }, [attempt, client]);

  const value = useMemo(() => ({ state, retry }), [retry, state]);

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useAnonymousIdentity(): IdentityContextValue {
  const context = useContext(IdentityContext);

  if (!context) {
    throw new Error(
      'useAnonymousIdentity must be used inside IdentityProvider.',
    );
  }

  return context;
}
