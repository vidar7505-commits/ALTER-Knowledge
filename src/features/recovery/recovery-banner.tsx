'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/design-system/primitives';

import { browserRecoveryRuntime } from './runtime';
import type { RecoverySnapshot } from './types';
import styles from './recovery.module.css';

export function RecoveryBannerView({
  snapshot,
  onRetry,
}: {
  snapshot: RecoverySnapshot;
  onRetry: () => void;
}) {
  if (snapshot.status === 'idle' || snapshot.message === null) return null;

  const alert = [
    'conflict',
    'storage_unavailable',
    'corrupt_recovered',
  ].includes(snapshot.status);
  const retry = ['retry_available', 'conflict'].includes(snapshot.status);

  return (
    <section
      className={styles.banner}
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? 'assertive' : 'polite'}
      aria-label="Recovery status"
    >
      <span>{snapshot.message}</span>
      {snapshot.pendingCount > 0 ? (
        <span className={styles.count}>{snapshot.pendingCount} pending</span>
      ) : null}
      {retry ? (
        <Button className={styles.retry} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </section>
  );
}

export function RecoveryBanner({
  identityId,
  online,
  onCanonicalChange,
}: {
  identityId: string;
  online: boolean;
  onCanonicalChange: () => void;
}) {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot>(
    browserRecoveryRuntime.getSnapshot(),
  );

  useEffect(() => browserRecoveryRuntime.subscribe(setSnapshot), []);

  useEffect(() => {
    void browserRecoveryRuntime.setIdentity(identityId);
    return () => {
      void browserRecoveryRuntime.setIdentity(null);
    };
  }, [identityId]);

  useEffect(() => {
    browserRecoveryRuntime.setOnline(online);
  }, [online]);

  useEffect(() => {
    if (snapshot.status === 'succeeded' || snapshot.status === 'conflict') {
      onCanonicalChange();
    }
  }, [onCanonicalChange, snapshot.status]);

  return (
    <RecoveryBannerView
      snapshot={snapshot}
      onRetry={() => void browserRecoveryRuntime.retry()}
    />
  );
}
