'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type RefCallback } from 'react';

import { Text } from '@/components/design-system/primitives';

import type { WardrobeItem, WardrobeMutationTask } from './types';
import styles from './wardrobe.module.css';

function Bookmark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    >
      <path d="M6.5 4.5h11v15l-5.5-3-5.5 3z" />
    </svg>
  );
}

export function WardrobeCard({
  item,
  task,
  onRemove,
  cardRef,
}: {
  item: WardrobeItem;
  task: WardrobeMutationTask | undefined;
  onRemove: () => void;
  cardRef: RefCallback<HTMLLIElement>;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const product = item.product;
  const name = product?.name ?? 'Unavailable piece';
  const brand = product?.brand ?? null;
  const category = product?.category ?? null;
  const image = product
    ? product.image_metadata.images[product.image_metadata.primary_index]
    : null;
  const alt = product
    ? `${product.brand} ${product.name}, ${product.category}.`
    : 'Unavailable saved piece.';

  return (
    <li ref={cardRef} className={styles.card} data-product-id={item.productId}>
      <Link
        href={`/product/${item.productId}?from=wardrobe`}
        className={styles.productLink}
        aria-label={`Open ${brand ? `${brand} ` : ''}${name}`}
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
              <span>{name}</span>
            </div>
          )}
          {!product ? (
            <span className={styles.unavailable}>Unavailable</span>
          ) : null}
        </div>
        <div className={styles.productMeta}>
          {brand ? (
            <Text as="span" role="caption" className={styles.brand}>
              {brand}
            </Text>
          ) : null}
          <Text as="span" role="body-sm" className={styles.productName}>
            {name}
          </Text>
          {category ? (
            <Text as="span" role="caption" className={styles.category}>
              {category}
            </Text>
          ) : (
            <Text as="span" role="caption" className={styles.category}>
              Saved item
            </Text>
          )}
        </div>
      </Link>
      <button
        type="button"
        className={styles.removeButton}
        aria-label={`Remove ${name} from Wardrobe`}
        aria-busy={task?.busy ?? false}
        disabled={task?.busy}
        onClick={onRemove}
      >
        <Bookmark />
      </button>
      {task?.error && task.action === 'remove' ? (
        <div className={styles.cardError} role="alert">
          <span>We couldn&apos;t remove that piece.</span>
          <button type="button" onClick={onRemove}>
            Try again
          </button>
        </div>
      ) : null}
    </li>
  );
}
