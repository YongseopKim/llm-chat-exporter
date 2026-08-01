/**
 * ClaudeParser - DOM Virtualization Tests
 *
 * Claude renders the conversation as a virtualized list: only the messages
 * near the viewport are mounted, and each mounted message sits inside a
 * wrapper carrying its position in the full list.
 *
 * Verified against a real DevTools capture (samples/edges/claude_001.html):
 *   <div data-rs-index="1" data-index="1" data-last-message="true">
 *     <div role="article" aria-setsize="2" aria-posinset="2" aria-label="Message 2 of 2">
 *       <div data-is-streaming="false"> ... </div>
 *
 * Reading the DOM once therefore captures only the currently mounted window.
 * The parser must collect messages while scrolling and merge them by index.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { createDOMFromHTML, loadEdgeCaseHTML } from './shared/fixtures';
import { htmlToMarkdown } from '../../../src/content/converter';

const TOTAL = 6;
const CLIENT_HEIGHT = 1000;
const SCROLL_HEIGHT = TOTAL * CLIENT_HEIGHT;

/** Build the markup for one message at the given list index */
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

/**
 * Create a document whose chat container mounts only two messages at a time,
 * swapping them as it is scrolled - the same behaviour as Claude's list.
 */
function createVirtualizedDocument(): { doc: Document; chat: HTMLElement } {
  const doc = createDOMFromHTML(
    '<html><body><div id="chat"></div></body></html>',
    'https://claude.ai/chat/abc'
  );
  const chat = doc.getElementById('chat') as HTMLElement;

  chat.style.overflowY = 'auto';
  Object.defineProperty(chat, 'scrollHeight', { value: SCROLL_HEIGHT, configurable: true });
  Object.defineProperty(chat, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true });

  const maxTop = SCROLL_HEIGHT - CLIENT_HEIGHT;
  const mount = (top: number) => {
    const first = Math.min(Math.max(Math.round(top / CLIENT_HEIGHT), 0), TOTAL - 2);
    chat.innerHTML = messageHtml(first) + messageHtml(first + 1);
  };

  let top = maxTop;
  Object.defineProperty(chat, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(v, maxTop));
      mount(top);
    },
    configurable: true,
  });
  mount(top);

  return { doc, chat };
}

describe('ClaudeParser - virtualized conversation', () => {
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

  it('mounts only part of the conversation before scrolling', () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    // Baseline: this is the state the old exporter read from
    expect(parser.getMessageNodes()).toHaveLength(2);
  });

  it('collects every message while scrolling through the list', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0 });

    expect(parser.getMessageNodes()).toHaveLength(TOTAL);
  });

  it('returns collected messages in list order, not collection order', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0 });

    const contents = parser.getMessageNodes().map((n) => parser.parseNode(n).contentHtml.trim());
    expect(contents).toEqual(['Q0', '<p>A1</p>', 'Q2', '<p>A3</p>', 'Q4', '<p>A5</p>']);
  });

  it('assigns the correct role to collected messages', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0 });

    const roles = parser.getMessageNodes().map((n) => parser.parseNode(n).role);
    expect(roles).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  });

  it('does not duplicate messages seen at several scroll positions', async () => {
    const { doc } = createVirtualizedDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0 });

    const keys = parser.getMessageNodes().map((n) => parser.parseNode(n).contentHtml.trim());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('warns when fewer messages were collected than the list advertises', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { doc, chat } = createVirtualizedDocument();
    install(doc);

    // Freeze the list: scrolling no longer mounts anything new
    Object.defineProperty(chat, 'scrollTop', {
      get: () => 0,
      set: () => {},
      configurable: true,
    });
    chat.innerHTML = messageHtml(0);

    await parser.loadAllMessages({ stepDelay: 0 });

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/1.*of.*6|6.*1/i));
  });

  it('falls back to live nodes when the DOM carries no list indices', async () => {
    const doc = createDOMFromHTML(
      `<html><body>
        <div data-testid="user-message"><p class="whitespace-pre-wrap">Hi</p></div>
        <div data-is-streaming="false"><div class="standard-markdown"><p>Hello</p></div></div>
      </body></html>`,
      'https://claude.ai/chat/abc'
    );
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0, timeout: 0 });

    expect(parser.getMessageNodes()).toHaveLength(2);
  });

  describe('against a real DevTools capture', () => {
    it('keeps every message and its citation links after collection', async () => {
      const doc = createDOMFromHTML(
        loadEdgeCaseHTML('claude', '001'),
        'https://claude.ai/chat/abc'
      );
      install(doc);

      await parser.loadAllMessages({ stepDelay: 0, timeout: 0 });
      const nodes = parser.getMessageNodes();

      // The capture holds one user turn and one assistant turn
      expect(nodes.map((n) => parser.parseNode(n).role)).toEqual(['user', 'assistant']);

      // ...and the assistant turn cites five sources
      const markdown = htmlToMarkdown(parser.parseNode(nodes[1]).contentHtml);
      expect(markdown.match(/\]\(https?:\/\//g) || []).toHaveLength(5);
    });

    it('does not warn when the whole conversation was captured', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const doc = createDOMFromHTML(
        loadEdgeCaseHTML('claude', '001'),
        'https://claude.ai/chat/abc'
      );
      install(doc);

      await parser.loadAllMessages({ stepDelay: 0, timeout: 0 });

      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('collected'));
    });
  });

  it('still refuses to export while a response is generating', async () => {
    const doc = createDOMFromHTML(
      '<html><body><div data-is-streaming="true"></div></body></html>',
      'https://claude.ai/chat/abc'
    );
    install(doc);

    await expect(parser.loadAllMessages({ stepDelay: 0 })).rejects.toThrow(/generating/i);
  });
});
