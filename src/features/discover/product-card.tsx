'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { Text } from '@/components/design-system/primitives';

import type { QualifiedImpressionCoordinator } from './qualified-impression';
import type { DiscoverProduct } from './types';
import { useQualifiedImpression } from './use-qualified-impression';
import styles from './discover.module.css';

export type ProductSaveView = {
  saved: boolean;
  busy: boolean;
  error: boolean;
};

function Bookmark({ saved }: { saved: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={saved ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    >
      <path d="M6.5 4.5h11v15l-5.5-3-5.5 3z" />
    </svg>
  );
}

export function ProductCard({
  product,
  save,
  onSave,
  onNavigate,
  coordinator,
}: {
  product: DiscoverProduct;
  save: ProductSaveView;
  onSave: () => void;
  onNavigate: () => void;
  coordinator: QualifiedImpressionCoordinator | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const observerRef = useQualifiedImpression({
    disabled: coordinator === null,
    complete: coordinator?.isComplete(product.product_id) ?? false,
    onQualify: (visibleRatio) =>
      coordinator?.qualify(product, visibleRatio) ?? Promise.resolve(),
  });
  const image =
    product.image_metadata.images[product.image_metadata.primary_index];
  const alt = `${product.brand} ${product.name}, ${product.category}.`;
  const price =
    product.price_amount !== null && product.price_currency
      ? new Intl.NumberFormat('en', {
          style: 'currency',
          currency: product.price_currency,
          maximumFractionDigits: 2,
        }).format(product.price_amount)
      : null;

  return (
    <li
      ref={observerRef}
      id={`product-${product.product_id}`}
      className={styles.productCard}
      data-product-id={product.product_id}
      data-position={product.position}
    >
      <div
        className={styles.imageFrame}
        style={{ aspectRatio: image?.aspect_ratio ?? 0.8 }}
      >
        {image && !imageFailed ? (
          <Image
            src={image.url}
            alt={alt}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 20vw"
            className={styles.productImage}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.imageFailure} role="img" aria-label={alt}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 5h16v14H4zM8 11l2-2 6 6M14 11l2-2 4 4M3 3l18 18" />
            </svg>
            <span>{product.name}</span>
          </div>
        )}
        <button
          type="button"
          className={styles.saveButton}
          aria-label={
            save.saved
              ? `Remove ${product.name} from Wardrobe`
              : `Save ${product.name} to Wardrobe`
          }
          aria-pressed={save.saved}
          aria-busy={save.busy}
          disabled={save.busy}
          onClick={onSave}
        >
          <Bookmark saved={save.saved} />
        </button>
      </div>
      <Link
        href={`/product/${product.product_id}?from=discover&position=${product.position}`}
        className={styles.productLink}
        aria-label={`Open ${product.brand} ${product.name}`}
        onClick={onNavigate}
      >
        <Text as="span" role="micro" className={styles.brand}>
          {product.brand}
        </Text>
        <span className={styles.productName}>{product.name}</span>
        <span className={styles.productMeta}>
          <span>{product.subcategory ?? product.category}</span>
          {price ? <span>{price}</span> : null}
        </span>
      </Link>
      {save.error ? (
        <span className={styles.cardError} role="status">
          Save failed. Try again.
        </span>
      ) : null}
    </li>
  );
}
