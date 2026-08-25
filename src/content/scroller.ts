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
 *
 * WHY EACH STEP WAITS ON MUTATIONOBSERVER, NOT A FIXED DELAY:
 * A fixed per-step delay has to assume the worst case content could ever take
 * to mount, and every step pays that cost even when the DOM settles almost
 * immediately - the wait time scales with the number of steps a long
 * conversation needs, which made exporting a long conversation slow. Each
 * step now waits only until the container goes quiet (see `waitForStable`),
 * so `stepDelay` is a safety cap rather than a delay every step pays in full.
 */

/** Minimum overflow (px) before an element counts as a real scroll container */
const MIN_OVERFLOW_PX = 50;

/** Fraction of a viewport to move per step; the overlap keeps items from being skipped */
const STEP_RATIO = 0.9;

/** Step size used when the container reports no height (jsdom, hidden panes) */
const FALLBACK_STEP_PX = 800;

export interface ScrollOptions {
  /**
   * Upper bound on how long a single scroll step may wait, in ms. Default: 400
   *
   * This is a cap, not a fixed delay: each step actually waits only until the
   * DOM stops mutating (see `quietPeriod`), so most steps finish well under
   * this. It only gets fully spent when content keeps mutating the whole time
   * (or in an environment with no MutationObserver signal at all).
   */
  stepDelay?: number;

  /**
   * How long the container must go without a mutation before a step is
   * considered settled, in ms. Default: 50
   *
   * Safe to keep low now that only message-boundary changes count as
   * meaningful (see `waitForStable`): this only needs to bridge the handful
   * of mutations a single genuine message mount produces, not survive
   * unrelated content still rendering elsewhere.
   */
  quietPeriod?: number;

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
   * conversation. Collect here instead. A returned promise is awaited before
   * scrolling can unmount the current window.
   */
  onStep?: () => void | Promise<void>;

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
 * Wait for a scroll step to settle: resolves once `target` has gone
 * `quietPeriod` ms without a *meaningful* mutation, or once `maxWait` ms
 * have passed in total, whichever comes first.
 *
 * A fixed delay has to assume the worst case (the slowest a long
 * conversation's history could ever take to mount) and pay that cost on
 * every single step. Watching the DOM instead means a step that settles
 * quickly returns quickly, and `maxWait` only gets fully spent by content
 * that is genuinely still mutating.
 *
 * WHY MEANINGFUL, NOT JUST ANY MUTATION:
 * Once a message is mounted, plenty of content inside it keeps mutating for
 * reasons that have nothing to do with more history loading - a syntax
 * highlighter wrapping code text in `<span>`s, an image's attributes
 * changing as it decodes, a diagram swapping a placeholder for its render.
 * Resetting the quiet timer for every one of those cosmetic changes means a
 * conversation with a few content-heavy messages pays close to `maxWait` on
 * nearly every step even though no new message ever needed to be captured.
 * When `selector` is given, only a change to the actual set of matching
 * elements (one joining or leaving) counts; content churn inside an
 * already-matched element is ignored, since the export only needs the
 * element to exist to capture it, not to have finished its own rendering.
 *
 * @param target - Node to observe for mutations (the scroll container)
 * @param quietPeriod - Ms of silence required before considering it settled
 * @param maxWait - Hard cap on total wait time, in case mutations never stop
 * @param selector - When given, scopes "meaningful" to changes in the set of
 *   elements matching this selector rather than any mutation at all
 */
export function waitForStable(
  target: Element,
  quietPeriod: number,
  maxWait: number,
  selector?: string
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let quietTimer: ReturnType<typeof setTimeout>;
    let lastMatched: Element[] = selector ? Array.from(target.querySelectorAll(selector)) : [];

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      observer.disconnect();
      resolve();
    };

    const isMeaningful = (): boolean => {
      if (!selector) {
        return true;
      }
      const current = Array.from(target.querySelectorAll(selector));
      const changed =
        current.length !== lastMatched.length || current.some((el, i) => el !== lastMatched[i]);
      lastMatched = current;
      return changed;
    };

    const maxTimer = setTimeout(finish, maxWait);
    const observer = new MutationObserver(() => {
      if (!isMeaningful()) {
        return;
      }
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietPeriod);
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    quietTimer = setTimeout(finish, quietPeriod);
  });
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
    quietPeriod = 50,
    maxSteps = 150,
    stableSteps = 2,
    onStep,
    timeout = 1000,
    contentSelector,
  } = options;

  const container = findScrollContainer(contentSelector);

  if (!container) {
    window.scrollTo(0, 0);
    await onStep?.();
    await wait(timeout);
    await onStep?.();
    return;
  }

  const originalTop = container.scrollTop;

  // Snapshot before moving: the newest messages are mounted right now, and
  // scrolling away can unmount them.
  await onStep?.();

  let stable = 0;
  let reachedTop = false;
  for (let step = 0; step < maxSteps; step++) {
    const previousTop = container.scrollTop;
    const previousHeight = container.scrollHeight;
    const pageSize = container.clientHeight || FALLBACK_STEP_PX;

    container.scrollTop = Math.max(0, previousTop - pageSize * STEP_RATIO);
    await waitForStable(container, quietPeriod, stepDelay, contentSelector);
    await onStep?.();

    const atTop = container.scrollTop <= 0;
    const grew = container.scrollHeight > previousHeight;

    // More history can still load while the top keeps receding
    if (atTop && !grew) {
      stable += 1;
      if (stable >= stableSteps) {
        reachedTop = true;
        break;
      }
    } else {
      stable = 0;
    }
  }

  // maxSteps exists to bound a page that lazily loads forever, but hitting it
  // is itself a bad sign: a conversation that never settles at the top may
  // not have finished loading, and platforms with no equivalent of Claude's
  // aria-setsize have no other way to detect that they came up short.
  if (!reachedTop) {
    console.warn(
      'scrollToLoadAll: hit the step limit before the conversation settled at the top. ' +
        'Some earlier messages may not have loaded - scroll to the top manually and export again.'
    );
  }

  container.scrollTop = originalTop;
  await waitForStable(container, quietPeriod, stepDelay, contentSelector);
  await onStep?.();
}
