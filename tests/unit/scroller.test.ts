import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToLoadAll } from '../../src/content/scroller';

describe('scrollToLoadAll', () => {
  beforeEach(() => {
    // Mock window.scrollTo
    vi.stubGlobal('scrollTo', vi.fn());

    // Mock setTimeout for fast tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should scroll to top initially', async () => {
    const scrollPromise = scrollToLoadAll();

    // Fast-forward timers
    vi.advanceTimersByTime(1000);

    await scrollPromise;

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should wait for stabilization period', async () => {
    let resolved = false;
    const scrollPromise = scrollToLoadAll().then(() => {
      resolved = true;
    });

    // Should not be resolved yet (haven't advanced timers)
    await Promise.resolve(); // Flush microtasks
    expect(resolved).toBe(false);

    // After advancing timers by timeout, should resolve
    vi.advanceTimersByTime(1000);
    await scrollPromise;

    expect(resolved).toBe(true);
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('should use default timeout of 1000ms', async () => {
    const scrollPromise = scrollToLoadAll();

    // Should resolve after 1000ms
    vi.advanceTimersByTime(999);
    let resolved = false;
    scrollPromise.then(() => { resolved = true; });

    await Promise.resolve(); // Allow microtasks to run
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await scrollPromise;
    expect(resolved).toBe(true);
  });

  it('should accept custom timeout option', async () => {
    const scrollPromise = scrollToLoadAll({ timeout: 2000 });

    // Should NOT resolve after 1000ms
    vi.advanceTimersByTime(1000);
    let resolved = false;
    scrollPromise.then(() => { resolved = true; });

    await Promise.resolve();
    expect(resolved).toBe(false);

    // Should resolve after 2000ms
    vi.advanceTimersByTime(1000);
    await scrollPromise;
    expect(resolved).toBe(true);
  });

  it('should handle empty options object', async () => {
    const scrollPromise = scrollToLoadAll({});

    vi.advanceTimersByTime(1000);
    await scrollPromise;

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should scroll to top exactly once', async () => {
    const scrollPromise = scrollToLoadAll();

    vi.advanceTimersByTime(1000);
    await scrollPromise;

    // Should call scrollTo only once (to top)
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should complete successfully', async () => {
    const scrollPromise = scrollToLoadAll();

    vi.advanceTimersByTime(1000);

    // Should not throw
    await expect(scrollPromise).resolves.toBeUndefined();
  });
});
