import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { createDOMFromHTML } from './shared/fixtures';

// Reduced from the observed chatgpt.com/c/6ab8f152-73c4-83e9-9ed1-9e99736dc186 DOM.
// Its old data-turn, data-message-author-role, conversation-turn, and .markdown
// markers are absent. One data-turn-key contains both a user and assistant message.
function pair(key: string, position: number): string {
  return `
    <div data-turn-key="${key}">
      <div data-content-search-turn-key="fallback-turn-${position}">
        <div data-content-search-unit-key="fallback-turn-${position}:0:user">
          <div data-user-message-bubble="true">
            <div class="whitespace-pre-wrap">User ${position}</div>
          </div>
        </div>
        <div data-content-search-unit-key="fallback-turn-${position}:2:assistant"
             data-chatgpt-search-message-ids="answer-${position}">
          <h4 class="sr-only" data-conversation-role="assistant">ChatGPT answer:</h4>
          <div data-chatgpt-selection-message-id="answer-${position}">
            <div data-markdown-text-style="assistant-message">
              <p>Assistant ${position}</p><pre><code>code ${position}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

describe('ChatGPTParser - current ChatGPT DOM', () => {
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;
    const doc = createDOMFromHTML(
      `<html><body>${pair('stable-a', 0)}${pair('stable-b', 1)}</body></html>`,
      'https://chatgpt.com/c/current-dom-regression'
    );
    global.document = doc as any;
    global.window = doc.defaultView as any;
    global.window.scrollTo = () => {};
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
  });

  it('finds and reads each message in order with its full body', async () => {
    const parser = new ChatGPTParser();
    const conversation = await parser.readConversation();

    expect(conversation.messages.map((m) => m.role)).toEqual([
      'user', 'assistant', 'user', 'assistant',
    ]);
    expect(conversation.messages.map((m) => m.contentHtml.trim())).toEqual([
      'User 0', '<p>Assistant 0</p><pre><code>code 0</code></pre>',
      'User 1', '<p>Assistant 1</p><pre><code>code 1</code></pre>',
    ]);
    expect(conversation.warnings).toEqual([]);
  });

  it('walks the chat scroller and keeps both messages in each virtualized pair', async () => {
    const doc = createDOMFromHTML(
      '<html><body><div id="sidebar"></div><div id="chat"></div></body></html>',
      'https://chatgpt.com/c/current-dom-virtualized'
    );
    global.document = doc as any;
    global.window = doc.defaultView as any;

    const sidebar = doc.getElementById('sidebar') as HTMLElement;
    sidebar.style.overflowY = 'auto';
    Object.defineProperty(sidebar, 'scrollHeight', { value: 2000 });
    Object.defineProperty(sidebar, 'clientHeight', { value: 500 });

    const chat = doc.getElementById('chat') as HTMLElement;
    chat.style.overflowY = 'auto';
    Object.defineProperty(chat, 'scrollHeight', { value: 1000 });
    Object.defineProperty(chat, 'clientHeight', { value: 500 });
    let top = 500;
    Object.defineProperty(chat, 'scrollTop', {
      get: () => top,
      set: (value: number) => {
        top = value;
        chat.innerHTML = top > 250 ? pair('stable-b', 1) : pair('stable-a', 0);
      },
    });
    chat.innerHTML = pair('stable-b', 1);

    const parser = new ChatGPTParser();
    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0, stableSteps: 1 });

    expect(parser.getMessageNodes().map((node) => parser.parseNode(node).contentHtml.trim())).toEqual([
      'User 0', '<p>Assistant 0</p><pre><code>code 0</code></pre>',
      'User 1', '<p>Assistant 1</p><pre><code>code 1</code></pre>',
    ]);
    expect(top).toBe(500);
  });
});
