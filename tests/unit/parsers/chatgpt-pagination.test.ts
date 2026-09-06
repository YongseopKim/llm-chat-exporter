/**
 * ChatGPTParser - turn numbers move when older history loads
 *
 * Measured on 2026-09-06 against a live conversation
 * (chatgpt.com/g/g-p-6a4dee60dc088191a997c4cb4e295db1/c/6a984181-2ad4-83e8-a5cd-88328f4305fa):
 * the page opened with seven turns mounted, and scrolling to the top loaded
 * older history and renumbered every `data-testid` already on screen.
 *
 *   message                     on load          after older history loaded
 *   "붙여넣은 마크다운(1)(1).md"   conversation-turn-1   conversation-turn-7
 *   "붙여넣은 마크다운(1)(2).md"   conversation-turn-5   conversation-turn-11
 *   last assistant answer        conversation-turn-10  conversation-turn-16
 *
 * The snapshot map was keyed on that number, so the same message was stored
 * under two keys while a different message took over the old one: the export
 * ended up with duplicates in a scrambled order.
 *
 * `data-turn-id` is the identity that survives, and it sits on the same
 * <section> as the testid:
 *   <section data-turn-id="a9ecc5db-..." data-testid="conversation-turn-1"
 *            data-turn="user">
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { createDOMFromHTML } from './shared/fixtures';

const CLIENT_HEIGHT = 500;
const TURN_HEIGHT = 500;

/** The whole conversation, oldest first. Only the tail is loaded at first. */
const ALL_TURNS = [
  { id: 'turn-a', role: 'user' },
  { id: 'turn-b', role: 'assistant' },
  { id: 'turn-c', role: 'user' },
  { id: 'turn-d', role: 'assistant' },
  { id: 'turn-e', role: 'user' },
  { id: 'turn-f', role: 'assistant' },
  { id: 'turn-g', role: 'user' },
  { id: 'turn-h', role: 'assistant' },
  { id: 'turn-i', role: 'user' },
] as const;

/** How many of the oldest turns are missing until the walk reaches the top */
const UNLOADED_AT_START = 2;

function turnHtml(turn: { id: string; role: string }, position: number): string {
  const content =
    turn.role === 'assistant'
      ? `<div class="markdown prose"><p>${turn.id}</p></div>`
      : `<div class="whitespace-pre-wrap">${turn.id}</div>`;

  return `
    <section data-turn="${turn.role}" data-turn-id="${turn.id}"
             data-testid="conversation-turn-${position}">
      <h4 class="sr-only">${turn.role === 'user' ? '나의 말:' : 'ChatGPT의 말:'}</h4>
      ${content}
    </section>`;
}

/**
 * A virtualized conversation that pages in older history at the top and
 * renumbers every mounted turn when it does.
 */
function createPaginatingDocument(): { doc: Document; chat: HTMLElement } {
  const doc = createDOMFromHTML(
    '<html><body><div id="chat"></div></body></html>',
    'https://chatgpt.com/c/paginating-regression'
  );
  const chat = doc.getElementById('chat') as HTMLElement;

  let unloaded = UNLOADED_AT_START;
  const loaded = () => ALL_TURNS.slice(unloaded);
  const scrollHeight = () => loaded().length * TURN_HEIGHT;

  chat.style.overflowY = 'auto';
  Object.defineProperty(chat, 'scrollHeight', { get: scrollHeight, configurable: true });
  Object.defineProperty(chat, 'clientHeight', { value: CLIENT_HEIGHT, configurable: true });

  const mount = () => {
    const list = loaded();
    const first = Math.min(Math.max(Math.round(top / TURN_HEIGHT), 0), list.length - 2);
    // Positions are 1-based and always counted from the oldest LOADED turn,
    // which is what makes them shift the moment more history arrives.
    chat.innerHTML = turnHtml(list[first], first + 1) + turnHtml(list[first + 1], first + 2);
  };

  let top = scrollHeight() - CLIENT_HEIGHT;
  Object.defineProperty(chat, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, scrollHeight() - CLIENT_HEIGHT));

      if (top === 0 && unloaded > 0) {
        const addedHeight = unloaded * TURN_HEIGHT;
        unloaded = 0;
        // Scroll anchoring keeps the turns already on screen where they are,
        // so the position jumps down by exactly what was prepended.
        top = addedHeight;
      }

      mount();
    },
    configurable: true,
  });
  mount();

  return { doc, chat };
}

describe('ChatGPTParser - conversation that pages in older history', () => {
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

  function exportedIds(): string[] {
    return parser.getMessageNodes().map((node) => node.getAttribute('data-turn-id') || '');
  }

  it('exports every turn once, even though their numbers changed mid-walk', async () => {
    const { doc } = createPaginatingDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0 });

    const ids = exportedIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(ALL_TURNS.length);
  });

  it('keeps the turns in conversation order across the renumbering', async () => {
    const { doc } = createPaginatingDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0 });

    expect(exportedIds()).toEqual(ALL_TURNS.map((turn) => turn.id));
  });

  it('keeps each turn paired with its own role and body', async () => {
    const { doc } = createPaginatingDocument();
    install(doc);

    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0 });

    const parsed = parser.getMessageNodes().map((node) => parser.parseNode(node));
    expect(parsed.map((message) => message.role)).toEqual(ALL_TURNS.map((turn) => turn.role));
    ALL_TURNS.forEach((turn, index) => {
      expect(parsed[index].contentHtml).toContain(turn.id);
    });
  });
});
