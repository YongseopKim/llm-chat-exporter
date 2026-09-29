import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollToLoadAll } from '../../src/content/scroller';
import { ChatGPTParser } from '../../src/content/parsers/chatgpt';
import { GrokParser } from '../../src/content/parsers/grok';
import { htmlToMarkdown } from '../../src/content/converter';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('walks negative scroll positions in a column-reverse conversation and restores the bottom', async () => {
  document.body.innerHTML = '<div id="chat" style="overflow-y:auto;display:flex;flex-direction:column-reverse"></div>';
  const chat = document.getElementById('chat')!;
  Object.defineProperty(chat, 'scrollHeight', { value: 2500 });
  Object.defineProperty(chat, 'clientHeight', { value: 500 });
  let top = 0;
  Object.defineProperty(chat, 'scrollTop', {
    get: () => top,
    set: (value) => { top = Math.max(-2000, Math.min(0, value)); },
  });
  const seen: number[] = [];
  await scrollToLoadAll({ stepDelay: 0, onStep: () => { seen.push(top); } });
  expect(Math.min(...seen)).toBe(-2000);
  expect(new Set(seen).size).toBeGreaterThan(3);
  expect(top).toBe(0);
});

it('waits for older history still loading at the top instead of exporting early', async () => {
  document.body.innerHTML = '<div id="chat" style="overflow-y:auto"><p>Newest</p></div>';
  const chat = document.getElementById('chat')!;
  Object.defineProperty(chat, 'scrollHeight', { value: 1000 });
  Object.defineProperty(chat, 'clientHeight', { value: 500 });
  let loading = true;
  const timer = setTimeout(() => { chat.insertAdjacentHTML('afterbegin', '<p>Oldest</p>'); loading = false; }, 40);
  const seen: string[] = [];
  try {
    await scrollToLoadAll({ stepDelay: 1, stableSteps: 1, isLoading: () => loading,
      loadTimeout: 200, onStep: () => { seen.push(chat.textContent!); } });
    expect(seen.some(text => text.includes('Oldest'))).toBe(true);
  } finally { clearTimeout(timer); }
});

describe('Grok virtualized message windows', () => {
  it('keeps all distinct message IDs, roles, bodies and links after restoring a smaller mounted window', async () => {
    document.body.innerHTML = '<div id="chat" style="overflow-y:auto"></div>';
    const chat = document.getElementById('chat')!;
    Object.defineProperty(chat, 'scrollHeight', { value: 3000 });
    Object.defineProperty(chat, 'clientHeight', { value: 500 });
    const message = (i: number) => `<div id="response-${i}"><div class="message-bubble" data-testid="${i % 2 ? 'assistant' : 'user'}-message"><p>${i % 2 ? 'Same answer' : 'Same prompt'}</p><a href="https://example.com/source-${i}">Source ${i}</a></div><button aria-label="${i % 2 ? 'Regenerate' : 'Edit'}"></button></div>`;
    let top = 2500;
    const mount = () => { const first = Math.min(4, Math.floor(top / 500)); chat.innerHTML = message(first) + message(first + 1); };
    Object.defineProperty(chat, 'scrollTop', {
      get: () => top,
      set: (value) => { top = Math.max(0, Math.min(2500, value)); mount(); },
    });
    mount();
    const parser = new GrokParser();
    await parser.loadAllMessages({ stepDelay: 0, quietPeriod: 0 });
    const messages = parser.getMessageNodes().map(node => parser.parseNode(node));
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
    messages.forEach((m, i) => expect(m.contentHtml).toContain(`https://example.com/source-${i}`));
    expect(top).toBe(2500);
  });
});

it('preserves source links and inline formatting inside Markdown table cells', () => {
  const html = '<table><tr><th>Person</th><th>Evidence</th></tr><tr><td><strong>Rajeev Date</strong></td><td>Left board <a href="https://example.com/filing.pdf">Filing</a><br>June | September</td></tr></table>';
  const md = htmlToMarkdown(html);
  expect(md).toContain('[Filing](https://example.com/filing.pdf)');
  expect(md).toContain('**Rajeev Date**');
  expect(md).toContain('June \\| September');
  expect(md).toContain('<br>');
});

it('captures every source of a grouped ChatGPT citation before the message is unmounted', async () => {
  // Reduced from the observed cirBTC citation and its paginated tooltip.
  document.body.innerHTML = `<div data-turn-key="stable-answer"><div data-content-search-unit-key="fallback-turn-0:2:assistant"><div data-markdown-text-style="assistant-message"><p>Wrapped BTC reserves <a data-testid="chatgpt-citation" aria-label="Circle: Product, https://example.com/product, 추가 출처 1개" href="https://example.com/product">Circle+1</a></p></div></div></div>`;
  const citation = document.querySelector('a')!;
  citation.addEventListener('mouseover', () => {
    const tooltip = document.createElement('div');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML = '<span>1/2</span><button aria-label="다음 출처"></button><a href="https://example.com/product" aria-label="Circle: Product, https://example.com/product">Product</a>';
    tooltip.querySelector('button')!.addEventListener('click', () => {
      tooltip.querySelector('span')!.textContent = '2/2';
      const link = tooltip.querySelector('a')!;
      link.href = 'https://example.com/reserves';
      link.textContent = 'Reserve standard';
      link.setAttribute('aria-label', 'Circle: Reserve standard, https://example.com/reserves');
    });
    document.body.appendChild(tooltip);
  });
  citation.addEventListener('blur', () => document.querySelector('[role="tooltip"]')?.remove());
  const parser = new ChatGPTParser();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  await parser.loadAllMessages({ timeout: 0 });
  const md = htmlToMarkdown(parser.parseNode(parser.getMessageNodes()[0]).contentHtml!);
  expect(md).toContain('https://example.com/product');
  expect(md).toContain('https://example.com/reserves');
  expect(md).toContain('Reserve standard');
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});

it('exports Grok search sources from collapsed drawers without including thinking or favicon URLs', async () => {
  document.body.innerHTML = '<div id="response-one"><div class="message-bubble" data-testid="assistant-message"><div class="thinking-container">Private thinking</div><p>Answer with a <a href="https://example.com/cited">citation</a>.</p><div role="button" aria-label="2 sources"><img src="https://example.com/favicon.png">2 sources</div></div><button aria-label="Regenerate"></button></div>';
  document.querySelector('[role="button"]')!.addEventListener('click', () => {
    const aside = document.createElement('aside');
    aside.innerHTML = '<button aria-label="닫기"></button><h3><button aria-controls="search-results" aria-expanded="false">Web search <span>2</span></button></h3><div id="search-results"></div>';
    aside.querySelector('h3 button')!.addEventListener('click', () => {
      aside.querySelector('h3 button')!.setAttribute('aria-expanded', 'true');
      aside.querySelector('#search-results')!.innerHTML = '<a href="https://example.com/cited">Cited</a><a href="https://example.com/extra">Extra source<p>Search snippet</p></a>';
    });
    aside.querySelector('[aria-label="닫기"]')!.addEventListener('click', () => aside.remove());
    document.body.append(aside);
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const parser = new GrokParser();
  await parser.loadAllMessages({ timeout: 0 });
  const md = htmlToMarkdown(parser.parseNode(parser.getMessageNodes()[0]).contentHtml!);
  expect(md).toContain('[Extra source](https://example.com/extra)');
  expect(md).toContain('Search sources');
  expect(md).not.toContain('Private thinking');
  expect(md).not.toContain('favicon');
  expect(document.querySelector('aside')).toBeNull();
});

it('reports a source tooltip failure in export metadata and preserves the visible citation', async () => {
  document.body.innerHTML = '<section data-turn="assistant" data-turn-id="missing-tooltip"><div class="markdown"><p>Answer <a data-testid="chatgpt-citation" aria-label="Example: Report, https://example.com/report, 추가 출처 1개" href="https://example.com/report">Example+1</a></p></div></section>';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const parser = new ChatGPTParser();
  vi.useFakeTimers();
  const conversationPromise = parser.readConversation();
  await vi.runAllTimersAsync();
  const conversation = await conversationPromise;
  vi.useRealTimers();
  expect(conversation.warnings).toEqual([expect.stringContaining('Could not collect every source')]);
  expect(conversation.messages[0].contentHtml).toContain('https://example.com/report');
});

it.each([1, 3])('recovers after %i unavailable popup openings without caching incomplete sources', async (unavailable) => {
  vi.useFakeTimers();
  try {
    const primary = 'https://www.sec.gov/Archives/edgar/data/1876042/000187604226000248/crcl-20260630.htm?utm_source=chatgpt.com';
    const secondary = 'https://www.sec.gov/Archives/edgar/data/1876042/000187604226000248/R9.htm?utm_source=chatgpt.com';
    document.body.innerHTML = `<section data-turn="assistant" data-turn-id="sec-retry"><div class="markdown"><p>ARC reserve evidence <a data-testid="chatgpt-citation" aria-label="SEC: crcl-20260630, ${primary}, 추가 출처 1개" href="${primary}">SEC+1</a></p></div></section>`;
    const citation = document.querySelector('a')!;
    let openings = 0;
    citation.addEventListener('mouseover', () => {
      if (++openings <= unavailable) return;
      const tip = document.createElement('div');
      tip.setAttribute('role', 'tooltip');
      tip.innerHTML = `<span>1/2</span><button aria-label="다음 출처"></button><a href="${primary}">Quarterly report</a>`;
      tip.querySelector('button')!.onclick = () => {
        tip.querySelector('span')!.textContent = '2/2';
        tip.querySelector('a')!.href = secondary;
        tip.querySelector('a')!.textContent = 'Reserve note';
      };
      document.body.append(tip);
    });
    citation.addEventListener('mouseout', () => document.querySelector('[role="tooltip"]')?.remove());
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const conversationPromise = new ChatGPTParser().readConversation();
    await vi.runAllTimersAsync();
    const conversation = await conversationPromise;
    const md = htmlToMarkdown(conversation.messages[0].contentHtml!);
    expect(md).toContain(secondary);
    expect(md).not.toContain('SEC+1');
    expect(conversation.warnings).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it('reads the new tooltip DOM when a source page replaces the previous popup', async () => {
  vi.useFakeTimers();
  try {
    document.body.innerHTML = '<section data-turn="assistant" data-turn-id="replaced-tooltip"><div class="markdown"><p>Evidence <a data-testid="chatgpt-citation" aria-label="Example: Primary, https://example.com/primary, 추가 출처 1개" href="https://example.com/primary">Example+1</a></p></div></section>';
    const citation = document.querySelector('a')!;
    citation.addEventListener('mouseover', () => {
      const tip = document.createElement('div');
      tip.id = 'source-tooltip';
      tip.setAttribute('role', 'tooltip');
      tip.innerHTML = '<span>1/2</span><button aria-label="다음 출처"></button><a href="https://example.com/primary">Primary</a>';
      tip.querySelector('button')!.onclick = () => {
        const next = tip.cloneNode(true) as HTMLElement;
        next.querySelector('span')!.textContent = '2/2';
        next.querySelector('a')!.href = 'https://example.com/secondary';
        next.querySelector('a')!.textContent = 'Secondary';
        tip.replaceWith(next);
      };
      document.body.append(tip);
    });
    citation.addEventListener('mouseout', () => document.querySelector('[role="tooltip"]')?.remove());
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const conversationPromise = new ChatGPTParser().readConversation();
    await vi.runAllTimersAsync();
    const conversation = await conversationPromise;
    expect(htmlToMarkdown(conversation.messages[0].contentHtml!)).toContain('https://example.com/secondary');
    expect(conversation.warnings).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});
