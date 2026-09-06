/**
 * ClaudeParser - messages that mount after the scroll step has moved on
 *
 * The failure this file pins down was measured on 2026-09-06 against a live
 * 16-message conversation (claude.ai/chat/029fb6d0): replaying the exporter's
 * own scroll loop in the page collected 2 of 16 messages. The walk reached the
 * top of the container in 36 steps without ever pausing long enough for the
 * transcript list to mount the window it had just scrolled to.
 *
 * Two things were wrong, and both are modelled here:
 *
 * 1. A scroll step settled on silence. `waitForStable` armed its quiet timer
 *    before anything had mutated, so a step ended `quietPeriod` ms after the
 *    scroll whether or not the list had rendered anything - and a message that
 *    mounts later is unmounted again by the next step, unseen.
 *
 * 2. A pass that came up short was only reported, never retried. Claude
 *    publishes the conversation's true length in `aria-setsize`, so the parser
 *    can tell that it missed messages and walk the list again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { createDOMFromHTML } from './shared/fixtures';

const TOTAL = 6;
const CLIENT_HEIGHT = 1000;
const SCROLL_HEIGHT = TOTAL * CLIENT_HEIGHT;

function messageHtml(index: number): string {
  const isUser = index % 2 === 0;
  const inner = isUser
    ? `<div data-testid="user-message"><p class="whitespace-pre-wrap">Q${index}</p></div>`
    : `<div data-is-streaming="false"><div class="standard-markdown"><p>A${index}</p></div></div>`;

  return `
    <div data-rs-index="${index}" data-index="${index}">
      <div role="article" aria-setsize="${TOTAL}" aria-posinset="${index + 1}"
           aria-label="Message ${index + 1} of ${TOTAL}">
        <div data-test-render-count="1">${inner}</div>
      </div>
    </div>`;
}

interface LateMountOptions {
  /** How long the list takes to render the window it was scrolled to, in ms */
  mountDelay: number;
  /** Delay to switch to once a full pass has finished and returned to the bottom */
  mountDelayAfterFirstPass?: number;
}

/**
 * A virtualized list that renders *asynchronously*, and only for the position
 * it is currently at.
 *
 * The existing virtualization fixtures re-render synchronously inside the
 * scrollTop setter, which no real list does and which hides the race entirely.
 * Here a scroll schedules a render and cancels any render still pending, so a
 * walk that does not wait long enough scrolls through the whole conversation
 * and renders only wherever it came to rest.
 */
function createLateMountingDocument(options: LateMountOptions): {
  doc: Document;
  chat: HTMLElement;
} {
  const doc = createDOMFromHTML(
    '<html><body><div id="chat"></div></body></html>',
    'https://claude.ai/chat/late-mount'
  );
  const chat = doc.getElementById('chat') as HTMLElement;

  chat.style.overflowY = 'auto';
  Object.defineProperty(chat, 'scrollHeight', { value: SCROLL_HEIGHT, configurable: true });
  Object.defineProperty(chat, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true });

  const maxTop = SCROLL_HEIGHT - CLIENT_HEIGHT;
  let delay = options.mountDelay;
  let top = maxTop;
  let pending: ReturnType<typeof setTimeout> | null = null;

  const render = () => {
    const first = Math.min(Math.max(Math.round(top / CLIENT_HEIGHT), 0), TOTAL - 2);
    chat.innerHTML = messageHtml(first) + messageHtml(first + 1);
  };

  const schedule = () => {
    if (pending) {
      clearTimeout(pending);
    }
    pending = setTimeout(() => {
      pending = null;
      render();
    }, delay);
  };

  Object.defineProperty(chat, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, maxTop));
      if (top === maxTop && options.mountDelayAfterFirstPass !== undefined) {
        // The walk restores the original position when a pass ends
        delay = options.mountDelayAfterFirstPass;
      }
      schedule();
    },
    configurable: true,
  });

  render();

  return { doc, chat };
}

describe('ClaudeParser - list that mounts after the step has moved on', () => {
  let parser: ClaudeParser;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    parser = new ClaudeParser();
    originalDocument = global.document;
    originalWindow = global.window;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  function install(doc: Document): void {
    global.document = doc as any;
    global.window = doc.defaultView as any;
  }

  it('collects every message when each window renders well after the scroll', async () => {
    const { doc } = createLateMountingDocument({ mountDelay: 80 });
    install(doc);

    // quietPeriod is deliberately far below the render delay: a step that
    // settles on silence sees none of these messages.
    await parser.loadAllMessages({ stepDelay: 400, quietPeriod: 10 });

    const contents = parser.getMessageNodes().map((n) => parser.parseNode(n).contentHtml.trim());
    expect(contents).toEqual(['Q0', '<p>A1</p>', 'Q2', '<p>A3</p>', 'Q4', '<p>A5</p>']);
  });

  it('walks the list again when a pass collected fewer messages than aria-setsize advertises', async () => {
    // The first pass is too slow to render anything while it runs; the second
    // one keeps up. Without a retry the export would silently ship 2 of 6.
    const { doc } = createLateMountingDocument({
      mountDelay: 400,
      mountDelayAfterFirstPass: 5,
    });
    install(doc);

    await parser.loadAllMessages({ stepDelay: 100, quietPeriod: 10 });

    expect(parser.getMessageNodes()).toHaveLength(TOTAL);
  });

  it('does not warn about an incomplete export once the retry has filled the gaps', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { doc } = createLateMountingDocument({
      mountDelay: 400,
      mountDelayAfterFirstPass: 5,
    });
    install(doc);

    await parser.loadAllMessages({ stepDelay: 100, quietPeriod: 10 });

    expect(warn).not.toHaveBeenCalled();
  });
});
