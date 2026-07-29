'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Heading,
  Text,
  VisuallyHidden,
} from '@/components/design-system/primitives';
import { createBrowserCatalogService } from '@/features/catalog/supabase';
import { CatalogError } from '@/features/catalog/types';
import { useAnonymousIdentity } from '@/features/identity/identity-provider';
import { DiscoverError } from '@/features/discover/types';
import { getSessionCandidateId } from '@/features/discover/storage';

import {
  createBrowserProductDetailSource,
  readSavedProductsFromSource,
  removeProductFromSource,
  saveProductFromSource,
} from './supabase';
import {
  createBrowserProductDetailTelemetry,
  quietDetailCapture,
} from './telemetry';
import type { ProductDetailState, SaveTask } from './types';
import type { ProductDetailSourceContext } from './types';
import styles from './product-detail-experience.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function BackArrow() {
  return (
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
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    >
      <path d="M6.5 4.5h11v15l-5.5-3-5.5 3z" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading product">
      <span className={styles.skeletonHero} />
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLineShort} />
      <span className={styles.skeletonBlock} />
    </div>
  );
}

function readSourceContext(
  searchParams: URLSearchParams,
): ProductDetailSourceContext {
  const source = searchParams.get('from');
  const sourceSurface =
    source === 'discover' || source === 'wardrobe' || source === 'challenge'
      ? source
      : null;
  const position = searchParams.get('position');
  return {
    sourceSurface,
    sourceFeedPosition:
      sourceSurface === 'discover' &&
      position !== null &&
      /^\d+$/.test(position)
        ? Number.parseInt(position, 10)
        : null,
    fallbackRoute:
      sourceSurface === 'wardrobe'
        ? '/wardrobe'
        : sourceSurface === 'challenge'
          ? '/challenge'
          : '/discover',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductDetailExperience({ productId }: { productId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identity = useAnonymousIdentity();

  const source = readSourceContext(searchParams);

  const [detailState, setDetailState] = useState<ProductDetailState>({
    status: 'loading',
  });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [saveTask, setSaveTask] = useState<SaveTask | null>(null);
  const [undoSavedProductId, setUndoSavedProductId] = useState<string | null>(
    null,
  );
  const [undoTimerPaused, setUndoTimerPaused] = useState(false);
  const undoRemainingMs = useRef(5000);
  const loadVersionRef = useRef(0);
  const mutationRef = useRef<{
    productId: string;
    operationId: string;
    expectedSavedProductId: string | null;
  } | null>(null);
  const undoBusyRef = useRef(false);
  const imageFailuresRef = useRef(new Set<number>());
  const [imageFailures, setImageFailures] = useState<Set<number>>(new Set());
  const telemetryRef = useRef<ReturnType<
    typeof createBrowserProductDetailTelemetry
  > | null>(null);
  const openedAtRef = useRef<number | null>(null);
  const openedFiredRef = useRef(false);
  const closedFiredRef = useRef(false);
  const readyStateRef = useRef<Extract<
    ProductDetailState,
    { status: 'ready' }
  > | null>(null);

  // Load product + saved state
  useEffect(() => {
    const version = ++loadVersionRef.current;
    let active = true;
    mutationRef.current = null;
    undoBusyRef.current = false;
    openedFiredRef.current = false;
    closedFiredRef.current = false;
    openedAtRef.current = null;
    telemetryRef.current = null;
    readyStateRef.current = null;
    imageFailuresRef.current = new Set();
    const catalogService = createBrowserCatalogService();
    const dataSource = createBrowserProductDetailSource();

    async function load() {
      try {
        const [productResult, savedEntries] = await Promise.all([
          catalogService.getProduct(productId),
          readSavedProductsFromSource(dataSource),
        ]);

        if (!active || loadVersionRef.current !== version) return;

        if (productResult.status === 'not_found') {
          setDetailState({ status: 'not_found', productId });

          // Fire product_detail_failed for not_found
          const identityState = identity.state;
          if (identityState.status === 'ready') {
            const platform =
              window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
            const telemetry = createBrowserProductDetailTelemetry(
              getSessionCandidateId(),
              platform,
              productId,
            );
            quietDetailCapture(telemetry, {
              event_name: 'product_detail_failed',
              surface: 'product_detail',
              source_surface: source.sourceSurface,
              properties: {
                product_id: productId,
                error_class: 'not_found',
                error_code: 'product_not_found',
                recovery_route: '/discover',
              },
            });
          }
          return;
        }

        const entry = savedEntries.find(
          (e) => e.productId === productResult.product.id,
        );
        const savedProductId = entry?.savedProductId ?? null;
        setDetailState({
          status: 'ready',
          product: productResult.product,
          savedProductId,
        });
        readyStateRef.current = {
          status: 'ready',
          product: productResult.product,
          savedProductId,
        };
        setActiveImageIndex(productResult.product.image_metadata.primary_index);

        // Fire product_detail_opened
        if (!openedFiredRef.current) {
          openedFiredRef.current = true;
          openedAtRef.current = performance.now();
          const platform =
            window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
          const telemetry = createBrowserProductDetailTelemetry(
            getSessionCandidateId(),
            platform,
            productId,
          );
          telemetryRef.current = telemetry;
          quietDetailCapture(telemetry, {
            event_name: 'product_detail_opened',
            surface: 'product_detail',
            source_surface: source.sourceSurface,
            properties: {
              product_id: productResult.product.id,
              product_category: productResult.product.category,
              source_surface: source.sourceSurface,
              source_feed_position: source.sourceFeedPosition,
              is_saved: savedProductId !== null,
            },
          });
        }
      } catch (error) {
        if (!active || loadVersionRef.current !== version) return;
        const errorCode =
          error instanceof CatalogError
            ? error.code
            : error instanceof DiscoverError
              ? error.code
              : 'transport_unavailable';
        const retryable =
          error instanceof CatalogError
            ? error.retryable
            : error instanceof DiscoverError
              ? error.retryable
              : true;
        setDetailState({ status: 'error', productId, errorCode, retryable });

        // Fire product_detail_failed
        const platform = window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
        const telemetry = createBrowserProductDetailTelemetry(
          getSessionCandidateId(),
          platform,
          productId,
        );
        quietDetailCapture(telemetry, {
          event_name: 'product_detail_failed',
          surface: 'product_detail',
          source_surface: source.sourceSurface,
          properties: {
            product_id: productId,
            error_class: retryable ? 'network' : 'schema',
            error_code: errorCode,
            recovery_route: source.fallbackRoute,
          },
        });
      }
    }

    void load();
    return () => {
      active = false;
      mutationRef.current = null;
      undoBusyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadAttempt,
    productId,
    source.fallbackRoute,
    source.sourceFeedPosition,
    source.sourceSurface,
  ]);

  useEffect(() => {
    if (detailState.status === 'ready') {
      readyStateRef.current = detailState;
    }
  }, [detailState]);

  const emitClose = useCallback(
    (closeMethod: string) => {
      if (closedFiredRef.current) return;
      const telemetry = telemetryRef.current;
      const state = readyStateRef.current;
      if (!telemetry || !state || openedAtRef.current === null) return;
      closedFiredRef.current = true;
      quietDetailCapture(telemetry, {
        event_name: 'product_detail_closed',
        surface: 'product_detail',
        source_surface: source.sourceSurface,
        properties: {
          product_id: state.product.id,
          close_method: closeMethod,
          dwell_ms: Math.max(
            0,
            Math.round(performance.now() - openedAtRef.current),
          ),
          resulting_saved_state: state.savedProductId !== null,
        },
      });
    },
    [source.sourceSurface],
  );

  useEffect(() => () => emitClose('route_leave'), [emitClose]);

  // Undo timer
  useEffect(() => {
    if (!undoSavedProductId) {
      undoRemainingMs.current = 5000;
      return;
    }
    if (undoTimerPaused) return;
    const startedAt = performance.now();
    const remaining = undoRemainingMs.current;
    const timer = window.setTimeout(() => {
      undoRemainingMs.current = 0;
      setUndoSavedProductId(null);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      undoRemainingMs.current = Math.max(
        0,
        remaining - (performance.now() - startedAt),
      );
    };
  }, [undoSavedProductId, undoTimerPaused]);

  // Back navigation
  const handleBack = useCallback(
    (closeMethod: string) => {
      emitClose(closeMethod);
      mutationRef.current = null;
      if (source.sourceSurface) router.back();
      else router.replace(source.fallbackRoute);
    },
    [emitClose, router, source.fallbackRoute, source.sourceSurface],
  );

  // Save / Remove
  const toggleSave = useCallback(async () => {
    if (detailState.status !== 'ready') return;
    if (mutationRef.current) return;

    const source = createBrowserProductDetailSource();
    const { product, savedProductId } = detailState;
    const action = savedProductId ? 'remove' : 'save';
    const operationId =
      saveTask?.action === action
        ? saveTask.operationId
        : globalThis.crypto.randomUUID();
    const mutation = {
      productId: product.id,
      operationId,
      expectedSavedProductId: savedProductId,
    };
    mutationRef.current = mutation;

    setSaveTask({ action, operationId, busy: true, error: false });

    const platform = window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
    const telemetry =
      telemetryRef.current ??
      createBrowserProductDetailTelemetry(
        getSessionCandidateId(),
        platform,
        productId,
      );

    quietDetailCapture(telemetry, {
      event_name:
        action === 'save'
          ? 'product_save_requested'
          : 'product_remove_requested',
      surface: 'product_detail',
      source_surface: 'product_detail',
      properties:
        action === 'save'
          ? {
              product_id: product.id,
              source_surface: 'product_detail',
              prior_saved_state: false,
              operation_id: operationId,
            }
          : {
              product_id: product.id,
              source_surface: 'product_detail',
              prior_saved_state: true,
              operation_id: operationId,
              challenge_impact: 'canonical_rpc_resolution',
            },
    });

    try {
      if (action === 'save') {
        const result = await saveProductFromSource(
          source,
          product.id,
          operationId,
        );
        if (mutationRef.current !== mutation) return;
        setDetailState((prev) =>
          prev.status === 'ready' &&
          prev.product.id === mutation.productId &&
          prev.savedProductId === mutation.expectedSavedProductId
            ? { ...prev, savedProductId: result.data.saved_product_id }
            : prev,
        );
        mutationRef.current = null;
        setSaveTask(null);
        quietDetailCapture(telemetry, {
          event_name: 'product_saved',
          surface: 'product_detail',
          source_surface: 'product_detail',
          properties: {
            product_id: product.id,
            product_category: product.category,
            source_surface: 'product_detail',
            operation_id: operationId,
            saved_product_id: result.data.saved_product_id,
          },
        });
      } else if (savedProductId) {
        await removeProductFromSource(source, savedProductId, operationId);
        if (mutationRef.current !== mutation) return;
        setDetailState((prev) =>
          prev.status === 'ready' &&
          prev.product.id === mutation.productId &&
          prev.savedProductId === mutation.expectedSavedProductId
            ? { ...prev, savedProductId: null }
            : prev,
        );
        mutationRef.current = null;
        setSaveTask(null);
        undoRemainingMs.current = 5000;
        setUndoTimerPaused(false);
        setUndoSavedProductId(savedProductId);
        quietDetailCapture(telemetry, {
          event_name: 'product_removed',
          surface: 'product_detail',
          source_surface: 'product_detail',
          properties: {
            product_id: product.id,
            source_surface: 'product_detail',
            operation_id: operationId,
            challenge_resolution: 'canonical_rpc_resolution',
          },
        });
      }
    } catch (error) {
      if (mutationRef.current !== mutation) return;
      mutationRef.current = null;
      const retryable = error instanceof DiscoverError ? error.retryable : true;
      const errorCode =
        error instanceof DiscoverError ? error.code : 'transport_unavailable';
      setSaveTask({ action, operationId, busy: false, error: true });
      quietDetailCapture(telemetry, {
        event_name: 'product_save_failed',
        surface: 'product_detail',
        source_surface: 'product_detail',
        properties: {
          product_id: product.id,
          attempted_action: action,
          operation_id: operationId,
          error_class: 'persistence',
          error_code: errorCode,
          retryable,
        },
      });
    }
  }, [detailState, saveTask, productId]);

  // Undo remove
  const handleUndo = useCallback(async () => {
    if (
      !undoSavedProductId ||
      detailState.status !== 'ready' ||
      undoBusyRef.current ||
      mutationRef.current
    )
      return;
    const source = createBrowserProductDetailSource();
    const { product } = detailState;
    const operationId = globalThis.crypto.randomUUID();
    const mutation = {
      productId: product.id,
      operationId,
      expectedSavedProductId: null,
    };
    undoBusyRef.current = true;
    mutationRef.current = mutation;
    setSaveTask({ action: 'save', operationId, busy: true, error: false });

    const platform = window.innerWidth < 768 ? 'web_mobile' : 'web_desktop';
    const telemetry =
      telemetryRef.current ??
      createBrowserProductDetailTelemetry(
        getSessionCandidateId(),
        platform,
        productId,
      );

    quietDetailCapture(telemetry, {
      event_name: 'product_save_requested',
      surface: 'product_detail',
      source_surface: 'product_detail',
      properties: {
        product_id: product.id,
        source_surface: 'product_detail',
        prior_saved_state: false,
        operation_id: operationId,
      },
    });

    try {
      const result = await saveProductFromSource(
        source,
        product.id,
        operationId,
      );
      if (mutationRef.current !== mutation) return;
      setDetailState((prev) =>
        prev.status === 'ready'
          ? { ...prev, savedProductId: result.data.saved_product_id }
          : prev,
      );
      setSaveTask(null);
      mutationRef.current = null;
      undoBusyRef.current = false;
      setUndoSavedProductId(null);
      quietDetailCapture(telemetry, {
        event_name: 'product_saved',
        surface: 'product_detail',
        source_surface: 'product_detail',
        properties: {
          product_id: product.id,
          product_category: product.category,
          source_surface: 'product_detail',
          operation_id: operationId,
          saved_product_id: result.data.saved_product_id,
        },
      });
    } catch (error) {
      if (mutationRef.current !== mutation) return;
      mutationRef.current = null;
      undoBusyRef.current = false;
      const retryable = error instanceof DiscoverError ? error.retryable : true;
      const errorCode =
        error instanceof DiscoverError ? error.code : 'transport_unavailable';
      setSaveTask({ action: 'save', operationId, busy: false, error: true });
      quietDetailCapture(telemetry, {
        event_name: 'product_save_failed',
        surface: 'product_detail',
        source_surface: 'product_detail',
        properties: {
          product_id: product.id,
          attempted_action: 'save',
          operation_id: operationId,
          error_class: 'persistence',
          error_code: errorCode,
          retryable,
        },
      });
    }
  }, [detailState, undoSavedProductId, productId]);

  // ─── Render: loading ──────────────────────────────────────────────────────

  const stateMatchesProduct =
    detailState.status === 'loading' ||
    (detailState.status === 'ready'
      ? detailState.product.id === productId
      : detailState.productId === productId);

  if (detailState.status === 'loading' || !stateMatchesProduct) {
    return (
      <main className={styles.page}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => handleBack('back_button')}
            aria-label="Go back"
          >
            <BackArrow />
            Back
          </button>
        </div>
        <LoadingSkeleton />
      </main>
    );
  }

  // ─── Render: not_found ────────────────────────────────────────────────────

  if (detailState.status === 'not_found') {
    return (
      <main className={styles.page}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => handleBack('back_button')}
            aria-label="Go back"
          >
            <BackArrow />
            Back
          </button>
        </div>
        <section className={styles.stateMessage} role="alert">
          <Heading as="h1" role="heading-lg">
            Product not found
          </Heading>
          <Text className={styles.stateBody}>
            This product is no longer available in the catalog.
          </Text>
          <div className={styles.stateActions}>
            <Link href="/discover" className={styles.secondaryAction}>
              Return to Discover
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ─── Render: error ────────────────────────────────────────────────────────

  if (detailState.status === 'error') {
    return (
      <main className={styles.page}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => handleBack('back_button')}
            aria-label="Go back"
          >
            <BackArrow />
            Back
          </button>
        </div>
        <section className={styles.stateMessage} role="alert">
          <Heading as="h1" role="heading-lg">
            {detailState.retryable
              ? "We couldn't load this product."
              : "This product can't be opened right now."}
          </Heading>
          <Text className={styles.stateBody}>
            {detailState.retryable
              ? 'Your Wardrobe and saved pieces are unchanged.'
              : 'The product data is not compatible with this build. Your saved pieces are unchanged.'}
          </Text>
          <div className={styles.stateActions}>
            {detailState.retryable ? (
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                Try again
              </button>
            ) : null}
            <Link href="/discover" className={styles.secondaryAction}>
              Return to Discover
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ─── Render: ready ────────────────────────────────────────────────────────

  const { product, savedProductId } = detailState;
  const images = product.image_metadata.images;
  const activeImage = images[activeImageIndex] ?? images[0];
  const isSaved = saveTask?.busy
    ? saveTask.action === 'save'
    : savedProductId !== null;
  const price =
    product.price_amount !== null && product.price_currency
      ? new Intl.NumberFormat('en', {
          style: 'currency',
          currency: product.price_currency,
          maximumFractionDigits: 2,
        }).format(product.price_amount)
      : null;

  return (
    <main className={styles.page}>
      {/* Top navigation bar */}
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.backButton}
          id="product-detail-back"
          onClick={() => handleBack('back_button')}
          aria-label={`Go back to ${source.sourceSurface ?? 'Discover'}`}
        >
          <BackArrow />
          Back
        </button>
      </div>

      <div className={styles.content}>
        {/* Image gallery */}
        <section
          className={styles.gallery}
          aria-label={`${product.brand} ${product.name} images`}
        >
          <div
            className={styles.primaryImageFrame}
            style={{ aspectRatio: activeImage?.aspect_ratio ?? 0.8 }}
          >
            {activeImage && !imageFailures.has(activeImageIndex) ? (
              <Image
                src={activeImage.url}
                alt={activeImage.alt}
                fill
                priority
                sizes="(max-width: 74.99rem) 100vw, 50vw"
                className={styles.primaryImage}
                onError={() => {
                  imageFailuresRef.current.add(activeImageIndex);
                  setImageFailures(new Set(imageFailuresRef.current));
                }}
              />
            ) : (
              <div
                className={styles.imageFailure}
                role="img"
                aria-label={`${product.brand} ${product.name}`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M4 5h16v14H4zM8 11l2-2 6 6M14 11l2-2 4 4M3 3l18 18" />
                </svg>
                <span>{product.name}</span>
              </div>
            )}
          </div>

          {/* Thumbnails — only if >1 image */}
          {images.length > 1 ? (
            <>
              <div
                className={styles.mobileGallery}
                aria-label="Product image gallery"
                onScroll={(event) => {
                  const width = event.currentTarget.clientWidth;
                  if (width > 0) {
                    setActiveImageIndex(
                      Math.round(event.currentTarget.scrollLeft / width),
                    );
                  }
                }}
              >
                {images.map((image, index) => (
                  <div className={styles.mobileSlide} key={image.url}>
                    {imageFailures.has(index) ? (
                      <div
                        className={styles.imageFailure}
                        role="img"
                        aria-label={`${product.name}, image unavailable`}
                      >
                        <span>{product.name}</span>
                      </div>
                    ) : (
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes="100vw"
                        className={styles.primaryImage}
                        onError={() => {
                          imageFailuresRef.current.add(index);
                          setImageFailures(new Set(imageFailuresRef.current));
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div
                className={styles.thumbnailRow}
                role="tablist"
                aria-label="Product images"
              >
                {images.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    role="tab"
                    className={styles.thumbnailButton}
                    aria-selected={index === activeImageIndex}
                    aria-label={`Image ${index + 1} of ${images.length}`}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <Image
                      src={image.url}
                      alt={image.alt}
                      width={80}
                      height={80}
                      className={styles.thumbnailImage}
                    />
                  </button>
                ))}
              </div>
              <span
                className={styles.galleryStatus}
                role="status"
                aria-live="polite"
              >
                Image {activeImageIndex + 1} of {images.length}
              </span>
            </>
          ) : null}
        </section>

        {/* Product information */}
        <section className={styles.info} aria-label="Product information">
          {/* Header: brand, name, save */}
          <div className={styles.header}>
            <Text role="micro" className={styles.eyebrow}>
              {product.brand}
            </Text>
            <div className={styles.nameRow}>
              <Heading as="h1" role="display-md" className={styles.productName}>
                {product.name}
              </Heading>
              <button
                id="product-detail-save"
                type="button"
                className={styles.saveButton}
                aria-label={
                  isSaved
                    ? `Remove ${product.name} from Wardrobe`
                    : `Save ${product.name} to Wardrobe`
                }
                aria-pressed={isSaved}
                aria-busy={saveTask?.busy ?? false}
                disabled={saveTask?.busy ?? false}
                onClick={() => void toggleSave()}
              >
                <BookmarkIcon filled={isSaved} />
              </button>
            </div>

            {price ? (
              <Text role="body-lg" className={styles.price}>
                {price}
              </Text>
            ) : null}

            {/* Category tags */}
            <div className={styles.categoryRow}>
              <span className={styles.tag}>{product.category}</span>
              {product.subcategory ? (
                <span className={styles.tag}>{product.subcategory}</span>
              ) : null}
            </div>
          </div>

          {/* Save error */}
          {saveTask?.error ? (
            <span className={styles.saveError} role="status">
              {saveTask.action === 'save'
                ? 'Save failed. Try again.'
                : 'Remove failed. Try again.'}
            </span>
          ) : null}

          {/* Description */}
          {product.description ? (
            <Text className={styles.description}>{product.description}</Text>
          ) : null}

          {/* Attributes */}
          <div className={styles.attributes} aria-label="Product attributes">
            {product.attributes.color ? (
              <div className={styles.attributeRow}>
                <span className={styles.attributeLabel}>Color</span>
                <span className={styles.attributeValue}>
                  {product.attributes.color}
                </span>
              </div>
            ) : null}
            {product.attributes.fit ? (
              <div className={styles.attributeRow}>
                <span className={styles.attributeLabel}>Fit</span>
                <span className={styles.attributeValue}>
                  {product.attributes.fit}
                </span>
              </div>
            ) : null}
            {product.attributes.materials.length ? (
              <div className={styles.attributeRow}>
                <span className={styles.attributeLabel}>Materials</span>
                <span className={styles.attributeValue}>
                  {product.attributes.materials.join(', ')}
                </span>
              </div>
            ) : null}
            {product.attributes.season.length ? (
              <div className={styles.attributeRow}>
                <span className={styles.attributeLabel}>Season</span>
                <span className={styles.attributeValue}>
                  {product.attributes.season.join(', ')}
                </span>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* Undo toast */}
      {undoSavedProductId ? (
        <div
          className={styles.undoToast}
          role="status"
          aria-live="polite"
          onFocusCapture={() => setUndoTimerPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setUndoTimerPaused(false);
            }
          }}
        >
          <span>Removed from Wardrobe.</span>
          <button type="button" onClick={() => void handleUndo()}>
            Undo
          </button>
        </div>
      ) : null}

      {/* SR-only busy announcement */}
      <VisuallyHidden aria-live="polite">
        {saveTask?.busy ? 'Updating your Wardrobe.' : ''}
      </VisuallyHidden>
    </main>
  );
}
