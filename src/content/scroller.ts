/**
 * Scroller - DOM Virtualization Handler
 *
 * Loads messages that are not currently mounted by scrolling the conversation
 * back through its history.
 *
 * WHY THIS IS NOT window.scrollTo:
 * The original implementation (2025-11-29) called `window.scrollTo(0, 0)` once
 * and waited a second. On claude.ai and the other supported sites the
 * conversation does not live in the document scroller - it lives in a nested
 * element with `overflow-y: auto`, so scrolling the window moves nothing.
 *
 * The validation that justified the simple version measured the same wrong
 * element: it recorded `Viewport = ScrollHeight: 782px` for a 32-message
 * conversation and read that as "everything fits on one screen" instead of
 * "the window never scrolls" (see validation-results.md). The conclusion
 * "DOM virtualization not working as expected, CONFIDENCE: HIGH" rests on a
 * scroll that never happened.
 *
 * This version finds the element that actually scrolls, walks it upward one
 * viewport at a time, and lets the caller snapshot the DOM at every stop via
 * `onStep` - which is what makes virtualized lists recoverable, since a
 * message unmounts again as soon as it leaves the viewport.
 */

/** Minimum overflow (px) before an element counts as a real scroll container */
const MIN_OVERFLOW_PX = 50;

/** Fraction of a viewport to move per step; the overlap keeps items from being skipped */
const STEP_RATIO = 0.9;

/** Step size used when the container reports no height (jsdom, hidden panes) */
const FALLBACK_STEP_PX = 800;

export interface ScrollOptions {
  /** Wait after each scroll step, in ms. Default: 400 */
  stepDelay?: number;

  /**
   * Hard cap on scroll steps, so a page that lazily loads forever cannot spin
   * forever. Default: 150 - a runaway guard, not a budget: scrolling normally
   * stops on reaching the top, and a long conversation is many viewports tall.
   */
  maxSteps?: number;

  /** Steps at the top with nothing new before stopping. Default: 2 */
  stableSteps?: number;

  /**
   * Called once before scrolling and after every step.
   *
   * Virtualized lists unmount messages as they leave the viewport, so a caller
   * that only reads the DOM at the end sees a single window of the
   * conversation. Collect here instead.
   */
  onStep?: () => void;

  /** Wait when no scroll container is found, in ms. Default: 1000 */
  timeout?: number;

  /**
   * Selector identifying content that lives inside the conversation's
   * scroll container - used to tell it apart from other scrollers on the page.
   */
  contentSelector?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read an element's computed overflow-y, tolerating foreign documents
 *
 * Tests (and content scripts running before layout) may hold elements whose
 * owning window differs from the global one, so the element's own view is
 * asked first and the inline style is used as a last resort.
 */
function readOverflowY(el: HTMLElement): string {
  const view = el.ownerDocument?.defaultView;
  if (view?.getComputedStyle) {
    try {
      return view.getComputedStyle(el).overflowY || '';
    } catch {
      // fall through to the inline style
    }
  }
  return el.style?.overflowY || '';
}

/**
 * Find the element the conversation actually scrolls in
 *
 * A container holding a message wins over every container that does not:
 * a long chat-history sidebar can easily out-scroll the conversation, and
 * scrolling it would load nothing. Size only breaks ties.
 *
 * @param contentSelector - Selector for content that must live in the container
 * @returns The scroll container, or null when the page scrolls in the window
 */
export function findScrollContainer(contentSelector?: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('div, main, section, article');

  let best: HTMLElement | null = null;
  let bestHoldsContent = false;

  for (const el of candidates) {
    if (!/^(auto|scroll|overlay)$/.test(readOverflowY(el))) {
      continue;
    }
    if (el.scrollHeight <= el.clientHeight + MIN_OVERFLOW_PX) {
      continue;
    }

    const holdsContent = contentSelector ? el.querySelector(contentSelector) !== null : false;

    if (!best || (holdsContent && !bestHoldsContent)) {
      best = el;
      bestHoldsContent = holdsContent;
      continue;
    }
    if (holdsContent === bestHoldsContent && el.scrollHeight > best.scrollHeight) {
      best = el;
    }
  }

  return best;
}

/**
 * Scroll the conversation back to its beginning so every message is loaded
 *
 * Walks the scroll container upward one viewport at a time, calling `onStep`
 * at each stop, and stops once the top is reached with nothing new appearing.
 * The original scroll position is restored afterwards.
 *
 * Falls back to the previous window-scroll behaviour when no scroll container
 * exists, so platforms that scroll the document keep working.
 *
 * @example
 * await scrollToLoadAll();                              // fire and forget
 * await scrollToLoadAll({ onStep: () => snapshot() });  // virtualized list
 */
export async function scrollToLoadAll(options: ScrollOptions = {}): Promise<void> {
  const {
    stepDelay = 400,
    maxSteps = 150,
    stableSteps = 2,
    onStep,
    timeout = 1000,
    contentSelector,
  } = options;

  const container = findScrollContainer(contentSelector);

  if (!container) {
    window.scrollTo(0, 0);
    onStep?.();
    await wait(timeout);
    onStep?.();
    return;
  }

  const originalTop = container.scrollTop;

  // Snapshot before moving: the newest messages are mounted right now, and
  // scrolling away can unmount them.
  onStep?.();

  let stable = 0;
  for (let step = 0; step < maxSteps; step++) {
    const previousTop = container.scrollTop;
    const previousHeight = container.scrollHeight;
    const pageSize = container.clientHeight || FALLBACK_STEP_PX;

    container.scrollTop = Math.max(0, previousTop - pageSize * STEP_RATIO);
    await wait(stepDelay);
    onStep?.();

    const atTop = container.scrollTop <= 0;
    const grew = container.scrollHeight > previousHeight;

    // More history can still load while the top keeps receding
    if (atTop && !grew) {
      stable += 1;
      if (stable >= stableSteps) {
        break;
      }
    } else {
      stable = 0;
    }
  }

  container.scrollTop = originalTop;
  await wait(stepDelay);
  onStep?.();
}
