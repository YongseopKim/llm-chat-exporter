/**
 * ChatGPTParser virtualization regressions.
 *
 * The real failure captured on 2026-08-10 contained 14 turns, but ChatGPT
 * kept only the first two and newest turns mounted. It also rendered a long,
 * pasted user message with `.markdown` instead of `.whitespace-pre-wrap`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { createDOMFromHTML } from './shared/fixtures';

const TOTAL = 14;
const CLIENT_HEIGHT = 500;
const TURN_HEIGHT = 500;
const SCROLL_HEIGHT = TOTAL * TURN_HEIGHT;

function turnHtml(turn: number): string {
  const role = turn % 2 === 1 ? 'user' : 'assistant';
  const content =
    role === 'assistant'
      ? `<div class="markdown prose"><p>Assistant turn ${turn}</p></div>`
      : turn === 11
        ? `<div class="markdown prose"><p>Rich pasted user turn ${turn}</p><h2>Details</h2></div>`
        : `<div class="whitespace-pre-wrap">User turn ${turn}</div>`;

  return `
    <section data-turn="${role}" data-testid="conversation-turn-${turn}">
      <h4 class="sr-only">${role === 'user' ? '나의 말:' : 'ChatGPT의 말:'}</h4>
      ${content}
    </section>`;
}

/** Mount only two adjacent turns and replace them as the container scrolls. */
function createVirtualizedDocument(): { doc: Document; chat: HTMLElement } {
  const doc = createDOMFromHTML(
    '<html><body><div id="chat"></div></body></html>',
    'https://chatgpt.com/c/virtualized-regression'
  );
  const chat = doc.getElementById('chat') as HTMLElement;

  chat.style.overflowY = 'auto';
  Object.defineProperty(chat, 'scrollHeight', { value: SCROLL_HEIGHT, configurable: true });
  Object.defineProperty(chat, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true });

  const maxTop = SCROLL_HEIGHT - CLIENT_HEIGHT;
  const mount = (top: number) => {
    const first = Math.min(
      Math.max(Math.floor(top / TURN_HEIGHT) + 1, 1),
      TOTAL - 1
    );
    chat.innerHTML = turnHtml(first) + turnHtml(first + 1);
  };

  let top = maxTop;
  Object.defineProperty(chat, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, maxTop));
      mount(top);
    },
    configurable: true,
  });
  mount(top);

  return { doc, chat };
}

describe('ChatGPTParser - virtualized conversation', () => {
  let parser: ChatGPTParser;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    parser = new ChatGPTParser();
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

  it('collects and orders all 14 turns while ChatGPT swaps mounted windows', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    expect(parser.getMessageNodes()).toHaveLength(2);

    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0 });

    const nodes = parser.getMessageNodes();
    expect(nodes).toHaveLength(TOTAL);
    expect(nodes.map((node) => node.getAttribute('data-testid'))).toEqual(
      Array.from({ length: TOTAL }, (_, index) => `conversation-turn-${index + 1}`)
    );
    expect(nodes.map((node) => parser.parseNode(node).role)).toEqual(
      Array.from({ length: TOTAL }, (_, index) => (index % 2 === 0 ? 'user' : 'assistant'))
    );
  });

  it('extracts a rich pasted user turn rendered with .markdown', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0 });

    const turn11 = parser
      .getMessageNodes()
      .find((node) => node.getAttribute('data-testid') === 'conversation-turn-11');
    expect(turn11).toBeDefined();
    expect(parser.parseNode(turn11!).contentHtml).toContain('Rich pasted user turn 11');
    expect(parser.parseNode(turn11!).contentHtml).toContain('<h2>Details</h2>');
  });

  it('deduplicates overlapping windows and preserves the caller onStep hook', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);
    const onStep = vi.fn();

    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0, onStep });

    const ids = parser
      .getMessageNodes()
      .map((node) => node.getAttribute('data-testid'));
    expect(new Set(ids).size).toBe(TOTAL);
    expect(onStep).toHaveBeenCalled();
  });
});
