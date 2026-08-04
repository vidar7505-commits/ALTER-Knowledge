'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { Button, Heading, Text } from '@/components/design-system/primitives';
import { useAnonymousIdentity } from '@/features/identity/identity-provider';
import type { IdentityState } from '@/features/identity/types';
import { RecoveryBanner } from '@/features/recovery/recovery-banner';

import { BottomNavigation, DesktopRail } from './primary-navigation';
import styles from './shell.module.css';

export type ConnectivityState = 'online' | 'offline' | 'restored';

function useConnectivityState(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>('online');
  const wasOffline = useRef(false);

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;

    const showOffline = () => {
      wasOffline.current = true;
      setState('offline');
    };
    const showOnline = () => {
      if (wasOffline.current) {
        setState('restored');
        wasOffline.current = false;
        restoredTimer = setTimeout(() => setState('online'), 2000);
      } else {
        setState('online');
      }
    };

    if (!window.navigator.onLine) {
      showOffline();
    }

    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showOnline);

    return () => {
      window.removeEventListener('offline', showOffline);
      window.removeEventListener('online', showOnline);
      if (restoredTimer) {
        clearTimeout(restoredTimer);
      }
    };
  }, []);

  return state;
}

function RouteFocusManager() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      document.getElementById('main-content')?.focus({ preventScroll: true });
      previousPathname.current = pathname;
    }
  }, [pathname]);

  return null;
}

export function ConnectivityBanner({ state }: { state: ConnectivityState }) {
  if (state === 'online') {
    return null;
  }

  return (
    <div className={styles.connectivityBanner} role="status" aria-live="polite">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {state === 'offline' ? (
          <>
            <path d="M5 8.5a11 11 0 0 1 12.2-.7M2.5 5.5a15 15 0 0 1 17.7-.4M8.6 12a6 6 0 0 1 5.4-.5M12 17.5h.01M3 3l18 18" />
          </>
        ) : (
          <>
            <path d="m5 12 4 4L19 6" />
          </>
        )}
      </svg>
      <span>
        {state === 'offline'
          ? 'You’re offline. Loaded content remains available.'
          : 'Back online.'}
      </span>
    </div>
  );
}

function ShellGate({
  children,
  connectivity,
}: {
  children: ReactNode;
  connectivity: ConnectivityState;
}) {
  return (
    <div className={styles.gate}>
      <div className={styles.gateWordmark}>A L T E R .</div>
      <ConnectivityBanner state={connectivity} />
      <div className={styles.gateContent}>{children}</div>
    </div>
  );
}

export function ApplicationShellView({
  children,
  state,
  retry,
  connectivity = 'online',
}: {
  children: ReactNode;
  state: IdentityState;
  retry: () => void;
  connectivity?: ConnectivityState;
}) {
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const handleCanonicalChange = useCallback(
    () => setRecoveryRevision((revision) => revision + 1),
    [],
  );
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <ShellGate connectivity={connectivity}>
        <div className={styles.loadingState} role="status" aria-live="polite">
          <span className={styles.loadingMark} aria-hidden="true" />
          <Heading as="h1" role="display-md">
            Preparing your space
          </Heading>
          <Text className={styles.gateBody}>
            Restoring your private, anonymous session.
          </Text>
        </div>
      </ShellGate>
    );
  }

  if (state.status === 'recoverable_error') {
    return (
      <ShellGate connectivity={connectivity}>
        <div className={styles.errorState} role="alert">
          <Text role="label" className={styles.stateEyebrow}>
            Connection interrupted
          </Text>
          <Heading as="h1" role="display-md">
            We couldn’t restore your session.
          </Heading>
          <Text className={styles.gateBody}>
            Your activity has not been changed. Reconnect if needed, then try
            again.
          </Text>
          <Button onClick={retry}>Try again</Button>
        </div>
      </ShellGate>
    );
  }

  if (state.status === 'unrecoverable_error') {
    return (
      <ShellGate connectivity={connectivity}>
        <div className={styles.errorState} role="alert">
          <Text role="label" className={styles.stateEyebrow}>
            Setup required
          </Text>
          <Heading as="h1" role="display-md">
            This build can’t open yet.
          </Heading>
          <Text className={styles.gateBody}>
            Anonymous identity is unavailable in this environment. The
            configuration must be corrected before continuing.
          </Text>
        </div>
      </ShellGate>
    );
  }

  return (
    <div className={styles.applicationFrame}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      <DesktopRail />
      <BottomNavigation />
      <div className={styles.contentColumn}>
        <header className={styles.mobileHeader}>
          <span className={styles.mobileWordmark}>A L T E R .</span>
        </header>
        {connectivity === 'restored' ? (
          <ConnectivityBanner state={connectivity} />
        ) : null}
        <RecoveryBanner
          identityId={state.anonymousUserId}
          online={connectivity !== 'offline'}
          onCanonicalChange={handleCanonicalChange}
        />
        <RouteFocusManager />
        <main id="main-content" className={styles.mainContent} tabIndex={-1}>
          <div key={recoveryRevision}>{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, retry } = useAnonymousIdentity();
  const connectivity = useConnectivityState();

  return (
    <ApplicationShellView
      state={state}
      retry={retry}
      connectivity={connectivity}
    >
      {children}
    </ApplicationShellView>
  );
}
