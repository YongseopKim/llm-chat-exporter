import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { GeminiParser } from '../../../src/content/parsers/gemini';
import { ParserFactory } from '../../../src/content/parsers/factory';
import { buildJsonl } from '../../../src/content/serializer';
import { BaseParser } from '../../../src/content/parsers/base-parser';

// Reduced from the supplied pages before the implementation change. Report
// titles/content are replaced, while their DOM containers stay the same.
const report = '<h1>Original report</h1><p>Last paragraph preserved.</p>' +
  '<table><thead><tr><th>Token</th><th>Source</th></tr></thead>' +
  '<tbody><tr><td>ABC</td><td><a href="https://example.org/source">Evidence</a></td></tr></tbody></table>';

describe('research report exports', () => {
  let original: string;
  beforeEach(() => { original = document.body.innerHTML; vi.clearAllMocks(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
  afterEach(() => { document.body.innerHTML = original; vi.restoreAllMocks(); });

  it('includes the ChatGPT iframe report in its assistant turn through JSONL', async () => {
    document.body.innerHTML = `<div data-turn-key="stable">
      <div data-content-search-unit-key="fallback-turn-0:0:user"><div class="whitespace-pre-wrap">Research this</div></div>
      <iframe title="심층 리서치" src="https://mcp-app-test.web-sandbox.oaiusercontent.com/?app=skybridge"></iframe>
      <div data-content-search-unit-key="fallback-turn-0:3:assistant"><div data-markdown-text-style="assistant-message">Research started.</div></div>
    </div>`;
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true, reports: [{
      frameUrl: 'https://mcp-app-test.web-sandbox.oaiusercontent.com/?app=skybridge', html: report,
    }] });
    const conversation = await new ChatGPTParser().readConversation();
    const lines = (await buildJsonl(conversation.messages, {
      platform: 'chatgpt', url: 'https://chatgpt.com/c/test', exported_at: '2026-10-02T00:00:00Z',
    })).split('\n').map(line => JSON.parse(line));
    expect(lines[2].role).toBe('assistant');
    expect(lines[2].content).toContain('# Original report');
    expect(lines[2].content).toContain('Last paragraph preserved.');
    expect(lines[2].content).toContain('https://example.org/source');
    expect(conversation.messages).toHaveLength(2);
  });

  it('does not report success when a ChatGPT research frame cannot be read', async () => {
    document.body.innerHTML = `<div data-turn-key="stable"><iframe title="Deep research" src="https://mcp-app-test.web-sandbox.oaiusercontent.com/"></iframe>
      <div data-content-search-unit-key="fallback-turn-0:3:assistant"><div class="markdown">Research started.</div></div></div>`;
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: false, error: 'Frame inaccessible' });
    await expect(new ChatGPTParser().readConversation()).rejects.toThrow(/research report/i);
  });

  it('retains the ChatGPT report when virtualization unmounts its iframe later', async () => {
    document.body.innerHTML = `<div data-turn-key="stable">
      <iframe title="Deep research" src="https://mcp-app-test.web-sandbox.oaiusercontent.com/"></iframe>
      <div data-content-search-unit-key="fallback-turn-0:3:assistant"><div class="markdown">Status</div></div></div>`;
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true, reports: [{
      frameUrl: 'https://mcp-app-test.web-sandbox.oaiusercontent.com/', html: report,
    }] });
    vi.spyOn(BaseParser.prototype, 'loadAllMessages').mockImplementation(async options => {
      await options?.onStep?.();
      document.querySelector('iframe')!.remove();
      await options?.onStep?.();
    });
    const conversation = await new ChatGPTParser().readConversation();
    expect(conversation.messages[0].contentHtml).toContain('Original report');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('opens the Gemini completed report, preserves sources, and closes its panel', async () => {
    document.body.innerHTML = `<user-query><div class="query-text">Research this</div></user-query>
      <model-response><div class="response-container-content"><deep-research-confirmation-widget>Plan</deep-research-confirmation-widget></div></model-response>
      <model-response><div class="response-container-content">Completed.
        <immersive-entry-chip><gem-processing-card class="completed"><div class="card-title">Report title</div><button aria-label="Canvas에서 Report title 열기">Open</button></gem-processing-card></immersive-entry-chip>
      </div></model-response>`;
    document.querySelector('gem-processing-card button')!.addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', `<deep-research-immersive-panel>
        <toolbar><h2 class="title-text">Report title</h2></toolbar><message-content><div class="markdown">${report}</div></message-content>
        <deep-research-source-lists><a href="https://example.org/extra">Extra source</a></deep-research-source-lists>
        <button aria-label="패널 닫기">Close</button></deep-research-immersive-panel>`);
      document.querySelector('button[aria-label="패널 닫기"]')!.addEventListener('click', () => document.querySelector('deep-research-immersive-panel')!.remove());
    });
    const parser = new GeminiParser();
    vi.spyOn(parser, 'loadAllMessages').mockResolvedValue();
    const conversation = await parser.readConversation();
    const jsonl = await buildJsonl(conversation.messages, {
      platform: 'gemini', url: 'https://gemini.google.com/app/test', exported_at: '2026-10-02T00:00:00Z',
    });
    expect(jsonl).toContain('Original report');
    expect(jsonl).toContain('https://example.org/source');
    expect(jsonl).toContain('https://example.org/extra');
    expect(document.querySelector('deep-research-immersive-panel')).toBeNull();
  });

  it('recognizes Surf and exports its file prompt and report tables without controls', async () => {
    document.body.innerHTML = `<main><div id="surf-root">
      <div class="justify-start"><div title="prompt.md"><span>prompt</span><span>MD</span></div></div>
      <div data-markdown-renderer>${report}<button aria-label="Download table as CSV">CSV</button><svg><text>icon</text></svg></div>
      <button aria-label="Send" disabled></button></div></main>`;
    const parser = ParserFactory.getParser('https://asksurf.ai/chat/test');
    expect(parser).not.toBeNull();
    const conversation = await parser!.readConversation();
    const jsonl = await buildJsonl(conversation.messages, {
      platform: 'surf' as any, url: 'https://asksurf.ai/chat/test', exported_at: '2026-10-02T00:00:00Z',
    });
    const lines = jsonl.split('\n').map(line => JSON.parse(line));
    expect(lines[1]).toMatchObject({ role: 'user', content: '[File: prompt.md]' });
    expect(lines[2].role).toBe('assistant');
    expect(lines[2].content).toContain('| ABC |');
    expect(lines[2].content).toContain('https://example.org/source');
    expect(lines[2].content).not.toContain('CSV');
    expect(lines[2].content).not.toContain('icon');
  });

  it('does not mistake Surf user markdown for another assistant answer', async () => {
    document.body.innerHTML = `<div id="surf-root"><div class="justify-start"><div data-markdown-renderer><p>User text</p></div></div>
      <div data-markdown-renderer><p>Actual answer</p></div></div>`;
    const parser = ParserFactory.getParser('https://asksurf.ai/chat/test')!;
    const conversation = await parser.readConversation();
    expect(conversation.messages.map(message => message.role)).toEqual(['user', 'assistant']);
  });
});
