import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useQualifiedImpression } from './use-qualified-impression';

let observerCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '0px';
  thresholds = [0, 0.5, 1];
}

function Harness({
  onQualify,
}: {
  onQualify: (ratio: number) => Promise<void>;
}) {
  const ref = useQualifiedImpression({
    disabled: false,
    complete: false,
    onQualify,
  });
  return <article ref={ref}>Product</article>;
}

function intersect(ratio: number) {
  observerCallback(
    [{ intersectionRatio: ratio, isIntersecting: ratio > 0 } as never],
    {} as IntersectionObserver,
  );
}

describe('useQualifiedImpression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    observe.mockClear();
    disconnect.mockClear();
  });

  it('does not qualify below 50 percent or before 1000ms', async () => {
    const qualify = vi.fn(async () => undefined);
    render(<Harness onQualify={qualify} />);
    act(() => intersect(0.49));
    await vi.advanceTimersByTimeAsync(2000);
    expect(qualify).not.toHaveBeenCalled();
    act(() => intersect(0.5));
    await vi.advanceTimersByTimeAsync(999);
    expect(qualify).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(qualify).toHaveBeenCalledOnce();
  });

  it('cancels continuous visibility when the ratio drops', async () => {
    const qualify = vi.fn(async () => undefined);
    render(<Harness onQualify={qualify} />);
    act(() => intersect(0.6));
    await vi.advanceTimersByTimeAsync(700);
    act(() => intersect(0.2));
    await vi.advanceTimersByTimeAsync(700);
    expect(qualify).not.toHaveBeenCalled();
  });

  it('cancels when the document becomes hidden and cleans up', async () => {
    const qualify = vi.fn(async () => undefined);
    const view = render(<Harness onQualify={qualify} />);
    act(() => intersect(0.8));
    await vi.advanceTimersByTimeAsync(500);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await vi.advanceTimersByTimeAsync(1000);
    expect(qualify).not.toHaveBeenCalled();
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
