/**
 * Scroller - DOM Virtualization Handler
 *
 * Simplified fallback version based on validation results.
 *
 * VALIDATION RESULT (2025-11-29):
 * - Claude scroller test FAILED
 * - Scrolling did not load additional messages
 * - Decision: Implement simple fallback (scroll to top + wait)
 *
 * Original complex implementation (MutationObserver, retry logic)
 * was planned but not needed based on actual platform behavior.
 *
 * Phase 4 Note: Individual parsers can override this behavior if needed.
 */

export interface ScrollOptions {
  /**
   * Timeout in milliseconds to wait for stabilization
   * Default: 1000ms
   */
  timeout?: number;
}

/**
 * Scroll to load all messages (simplified fallback version)
 *
 * Based on validation results, this implementation:
 * 1. Scrolls to top
 * 2. Waits briefly for DOM stabilization
 * 3. Returns
 *
 * This is sufficient for:
 * - ChatGPT: Messages already loaded
 * - Claude: Short conversations fully loaded
 * - Gemini: Messages already loaded
 *
 * For longer Claude conversations, users may need to manually scroll
 * before exporting (future enhancement: user notification).
 *
 * @param options - Scroll options
 * @returns Promise that resolves when scrolling is complete
 *
 * @example
 * await scrollToLoadAll(); // Default 1000ms wait
 * await scrollToLoadAll({ timeout: 2000 }); // Custom wait time
 */
export async function scrollToLoadAll(options: ScrollOptions = {}): Promise<void> {
  const { timeout = 1000 } = options;

  // Scroll to top of page
  window.scrollTo(0, 0);

  // Wait for DOM stabilization
  // This gives the browser time to:
  // - Render any pending updates
  // - Complete any in-flight lazy loading
  // - Stabilize virtualized DOM (if applicable)
  await new Promise<void>((resolve) => {
    setTimeout(resolve, timeout);
  });

  // Note: No retry logic or MutationObserver needed
  // based on validation showing scroll doesn't trigger loading
}
