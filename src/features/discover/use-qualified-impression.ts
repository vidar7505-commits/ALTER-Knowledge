'use client';

import { useCallback, useEffect, useRef } from 'react';

import { DiscoverError } from './types';

export function useQualifiedImpression(options: {
  disabled: boolean;
  complete: boolean;
  onQualify: (visibleRatio: number) => Promise<void>;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratioRef = useRef(0);
  const attemptedRef = useRef(false);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || options.disabled || options.complete) return;

    function clearTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    function begin() {
      if (
        timerRef.current ||
        attemptedRef.current ||
        optionsRef.current.disabled ||
        optionsRef.current.complete ||
        document.visibilityState !== 'visible' ||
        ratioRef.current < 0.5
      ) {
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (
          document.visibilityState !== 'visible' ||
          ratioRef.current < 0.5 ||
          optionsRef.current.complete
        ) {
          return;
        }
        attemptedRef.current = true;
        void optionsRef.current
          .onQualify(ratioRef.current)
          .catch((error: unknown) => {
            const retryable =
              !(error instanceof DiscoverError) || error.retryable;
            if (retryable) {
              attemptedRef.current = false;
              begin();
            }
          });
      }, 1000);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        ratioRef.current = entry?.intersectionRatio ?? 0;
        if (ratioRef.current < 0.5) {
          clearTimer();
          return;
        }
        begin();
      },
      { threshold: [0, 0.5, 1] },
    );
    const onVisibility = () => {
      clearTimer();
      if (document.visibilityState === 'visible') begin();
    };
    observer.observe(element);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimer();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [options.complete, options.disabled]);

  return useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);
}
