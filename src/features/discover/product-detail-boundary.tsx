'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Heading, Text } from '@/components/design-system/primitives';

import styles from './product-detail-boundary.module.css';

export function ProductDetailBoundary({ productId }: { productId: string }) {
  const router = useRouter();
  return (
    <main className={styles.boundary}>
      <div className={styles.frame}>
        <button
          type="button"
          className={styles.back}
          onClick={() => router.back()}
        >
          <span aria-hidden="true">←</span>
          Back to Discover
        </button>
        <div className={styles.content}>
          <Text role="micro" className={styles.eyebrow}>
            Product Detail · P12 boundary
          </Text>
          <Heading as="h1" role="display-lg" tabIndex={-1}>
            Product preview
          </Heading>
          <Text role="body-lg" className={styles.copy}>
            Full Product Detail content is deferred to P12. Your Discover feed
            and exact scroll context remain preserved.
          </Text>
          <Text role="caption" className={styles.identifier}>
            Product reference: {productId}
          </Text>
          <Link href="/discover" className={styles.fallback}>
            Return to Discover
          </Link>
        </div>
      </div>
    </main>
  );
}
