import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToLoadAll, findScrollContainer } from '../../src/content/scroller';

/**
 * Make an element behave like a real scroll container inside jsdom.
 *
 * jsdom has no layout, so scrollHeight/clientHeight are always 0 and scrollTop
 * is not tracked. These are defined explicitly so the scroller's logic can be
 * exercised.
 */
function makeScrollable(
  el: HTMLElement,
  opts: { scrollHeight: number; clientHeight: number; scrollTop?: number; overflowY?: string }
): void {
  el.style.overflowY = opts.overflowY ?? 'auto';
  Object.defineProperty(el, 'scrollHeight', { value: opts.scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: opts.clientHeight, configurable: true });

  let top = opts.scrollTop ?? opts.scrollHeight - opts.clientHeight;
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(v, opts.scrollHeight - opts.clientHeight));
    },
    configurable: true,
  });
}

describe('findScrollContainer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no element scrolls', () => {
    document.body.innerHTML = '<div id="a"><p>plain</p></div>';
    expect(findScrollContainer()).toBeNull();
  });

  it('finds a nested overflow-y container (Claude puts the chat in one)', () => {
    document.body.innerHTML = '<div id="outer"><div id="chat"></div></div>';
    const chat = document.getElementById('chat') as HTMLElement;
    makeScrollable(chat, { scrollHeight: 8000, clientHeight: 800 });

    expect(findScrollContainer()).toBe(chat);
  });

  it('ignores containers that do not overflow', () => {
    document.body.innerHTML = '<div id="chat"></div>';
    const chat = document.getElementById('chat') as HTMLElement;
    makeScrollable(chat, { scrollHeight: 800, clientHeight: 800 });

    expect(findScrollContainer()).toBeNull();
  });

  it('ignores overflow-hidden containers', () => {
    document.body.innerHTML = '<div id="chat"></div>';
    const chat = document.getElementById('chat') as HTMLElement;
    makeScrollable(chat, { scrollHeight: 8000, clientHeight: 800, overflowY: 'hidden' });

    expect(findScrollContainer()).toBeNull();
  });

  it('picks the tallest scrollable element when several exist', () => {
    document.body.innerHTML = '<div id="side"></div><div id="chat"></div>';
    const side = document.getElementById('side') as HTMLElement;
    const chat = document.getElementById('chat') as HTMLElement;
    makeScrollable(side, { scrollHeight: 2000, clientHeight: 400 });
    makeScrollable(chat, { scrollHeight: 20000, clientHeight: 800 });

    expect(findScrollContainer()).toBe(chat);
  });

  it('prefers the container holding the messages over a taller unrelated one', () => {
    // A long chat-history sidebar can out-scroll the conversation itself
    document.body.innerHTML = `
      <div id="side"></div>
      <div id="chat"><div data-testid="user-message">Hi</div></div>`;
    const side = document.getElementById('side') as HTMLElement;
    const chat = document.getElementById('chat') as HTMLElement;
    makeScrollable(side, { scrollHeight: 90000, clientHeight: 800 });
    makeScrollable(chat, { scrollHeight: 9000, clientHeight: 800 });

    expect(findScrollContainer('[data-testid="user-message"]')).toBe(chat);
  });

  it('falls back to the tallest container when nothing matches the hint', () => {
    document.body.innerHTML = '<div id="chat"></div>';
    const chat = document.getElementById('chat') as HTMLElement;
    makeScrollable(chat, { scrollHeight: 9000, clientHeight: 800 });

    expect(findScrollContainer('[data-testid="user-message"]')).toBe(chat);
  });
});

describe('scrollToLoadAll', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when no scroll container exists (fallback)', () => {
    it('falls back to window.scrollTo', async () => {
      await scrollToLoadAll({ stepDelay: 0 });
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('still invokes onStep so callers can snapshot the DOM', async () => {
      const onStep = vi.fn();
      await scrollToLoadAll({ stepDelay: 0, onStep });
      expect(onStep).toHaveBeenCalled();
    });

    it('resolves without throwing', async () => {
      await expect(scrollToLoadAll({ stepDelay: 0 })).resolves.toBeUndefined();
    });
  });

  describe('when a scroll container exists', () => {
    let chat: HTMLElement;

    beforeEach(() => {
      document.body.innerHTML = '<div id="chat"></div>';
      chat = document.getElementById('chat') as HTMLElement;
      makeScrollable(chat, { scrollHeight: 8000, clientHeight: 800 });
    });

    it('scrolls the container, not the window', async () => {
      await scrollToLoadAll({ stepDelay: 0 });
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('reaches the top of the container', async () => {
      const reached: number[] = [];
      await scrollToLoadAll({ stepDelay: 0, onStep: () => reached.push(chat.scrollTop) });
      expect(Math.min(...reached)).toBe(0);
    });

    it('scrolls upward incrementally instead of jumping straight to 0', async () => {
      const seen: number[] = [];
      await scrollToLoadAll({ stepDelay: 0, onStep: () => seen.push(chat.scrollTop) });

      // 7200px of scroll range at ~720px per step needs multiple stops;
      // a single jump to 0 would never mount the messages in between.
      expect(new Set(seen).size).toBeGreaterThan(3);
    });

    it('snapshots the starting position before scrolling away from it', async () => {
      const seen: number[] = [];
      await scrollToLoadAll({ stepDelay: 0, onStep: () => seen.push(chat.scrollTop) });

      // The newest messages are mounted at the bottom; losing them while
      // scrolling up is exactly the failure this guards against.
      expect(seen[0]).toBe(7200);
    });

    it('restores the original scroll position when finished', async () => {
      await scrollToLoadAll({ stepDelay: 0 });
      expect(chat.scrollTop).toBe(7200);
    });

    it('stops once the top is reached and nothing new appears', async () => {
      const onStep = vi.fn();
      await scrollToLoadAll({ stepDelay: 0, maxSteps: 100, onStep });

      // ~10 steps to climb 7200px + stable rounds + restore; nowhere near maxSteps
      expect(onStep.mock.calls.length).toBeLessThan(20);
    });

    it('never exceeds maxSteps even if the container keeps growing', async () => {
      // Simulate infinite lazy loading: content grows every time it is measured
      let height = 8000;
      Object.defineProperty(chat, 'scrollHeight', {
        get: () => (height += 800),
        configurable: true,
      });

      const onStep = vi.fn();
      await scrollToLoadAll({ stepDelay: 0, maxSteps: 5, onStep });

      expect(onStep.mock.calls.length).toBeLessThanOrEqual(5 + 2);
    });
  });
});
