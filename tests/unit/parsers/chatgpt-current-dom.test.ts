import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { createDOMFromHTML } from './shared/fixtures';
import { buildJsonl } from '../../../src/content/serializer';

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
      '<div data-export-verbatim="">User 0</div>', '<p>Assistant 0</p><pre><code>code 0</code></pre>',
      '<div data-export-verbatim="">User 1</div>', '<p>Assistant 1</p><pre><code>code 1</code></pre>',
    ]);
    expect(conversation.warnings).toEqual([]);
  });

  // Reduced from chatgpt.com/g/g-p-6abfe4fae.../c/6ac0b518-62d0-83ec-8eb6-12d1a217baed
  // (2026-10-03). ChatGPT shows a typed prompt unrendered, with line breaks
  // kept by white-space: pre-wrap, and splits out only its fenced code block.
  // The prompt's text held 670 line breaks; the export kept 87, and the
  // 26,801 characters after the code block became a single escaped line.
  it('exports a typed prompt exactly as written, with its line breaks and Markdown characters', async () => {
    const before = [
      '맨 아래에 위치한 글 내용을 봐줘. ',
      '내가 원하는 건 "BASE" 이야.',
      '',
      '---',
      '',
      '## 원하는 프레임워크 최종 템플릿',
      '',
      '### 조건부 평가(==Valuation)',
      '',
      '---',
      '',
      '',
    ].join('\n');
    const code = "# Uptober 워치리스트\n\n| 티커 | 가격 |\n|---|---:|\n\n```sh\npython3 - <<'PY'\nprint(1)\nPY";
    const after = [
      '',
      '',
      '모델의 연환산액은 [저장본](../pages/defillama.md)과 *다르다*.',
      '',
      '| 티커 | 확인할 원문 |',
      '|---|---|',
      '| NMR | 매출_원문 \\| 공시 |',
      '',
      '## 개정에서 바뀐 판단',
      '',
      '1. 첫째',
      '   - 들여쓴 항목',
      '',
    ].join('\n');
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const doc = createDOMFromHTML(
      `<html><body><div data-turn-key="typed"><div data-content-search-turn-key="t">
        <div data-content-search-unit-key="t:0:user"><div data-user-message-bubble="true"><div class="whitespace-pre-wrap">${escape(before)}<div data-markdown-copy="code-block" data-theme="dark"><div data-markdown-copy="exclude"><div></div><div><div><span data-state="closed"><button type="button" aria-label="복사" inert="" aria-hidden="true"><svg></svg></button></span></div></div></div><div tabindex="0" dir="ltr" inert="" aria-hidden="true"><code><span>${escape(code)}</span></code></div></div>${escape(after)}\`\`\`</div></div></div>
        <div data-content-search-unit-key="t:2:assistant"><div data-markdown-text-style="assistant-message"><p>Answer</p></div></div>
      </div></div></body></html>`,
      'https://chatgpt.com/c/typed-prompt'
    );
    global.document = doc as any;
    global.window = doc.defaultView as any;
    global.window.scrollTo = () => {};

    const conversation = await new ChatGPTParser().readConversation();
    const jsonl = await buildJsonl(conversation.messages, {
      platform: 'chatgpt',
      url: 'https://chatgpt.com/c/typed-prompt',
      exported_at: '2026-10-03T10:39:10.841Z',
    });
    const prompt = JSON.parse(jsonl.split('\n')[1]).content;

    expect(prompt).toBe(before + '````\n' + code + '\n````' + after + '```');
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
      '<div data-export-verbatim="">User 0</div>', '<p>Assistant 0</p><pre><code>code 0</code></pre>',
      '<div data-export-verbatim="">User 1</div>', '<p>Assistant 1</p><pre><code>code 1</code></pre>',
    ]);
    expect(top).toBe(500);
  });
});
