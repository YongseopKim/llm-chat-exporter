import { describe, it, expect, vi, afterEach } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { htmlToMarkdown } from '../../../src/content/converter';

// Reduced from the user's 6ac89493 conversation DOM, observed 2026-10-09.
const body = `<div data-dil-message-id="answer">
<h1 data-d-component="title">Report</h1>
<p data-d-component="text"><span data-d-default-strong data-d-inline>Legal rights</span> matter.</p>
<div data-d-component="box" data-d-direction="col"><p>Issuer</p>
<svg data-d-component="icon" viewBox="0 0 24 24"><path d="M12 6v12l5-5"/></svg>
<div data-d-component="grid"><p>Wallet A</p><p>Wallet B</p></div></div>
<div data-d-component="row"><button data-d-component="checkbox" role="checkbox" aria-checked="true" id="choice"></button><label for="choice"><p>Asset backing</p></label></div>
<button data-d-component="button">Copy checklist</button>
<div data-d-component="favicon"><img src="https://www.google.com/s2/favicons?domain=example.com"></div>
<table><tbody><tr><th>Model</th><th>Rights</th></tr><tr><td>Custody</td><td>Claim</td></tr></tbody></table>
</div>`;
function node() {
  document.body.innerHTML = `<div data-turn-key="turn"><div data-content-search-unit-key="fallback-turn-0:2:assistant"><div data-markdown-text-style="assistant-message">${body}</div></div></div>`;
  return document.querySelector<HTMLElement>('[data-content-search-unit-key]')!;
}

describe('ChatGPT rich response rendering', () => {
  afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });
  it('preserves emphasis and checked state, drops controls and favicons', () => {
    const parser = new ChatGPTParser();
    const md = htmlToMarkdown(parser.parseNode(node()).contentHtml!);
    expect(md).toContain('**Legal rights**');
    expect(md).toContain('- [x] Asset backing');
    expect(md).toContain('Asset backing');
    const svg = md.match(/data:image\/svg\+xml,([^)]*)/)?.[1];
    expect(decodeURIComponent(svg!)).toContain('M12 6v12l5-5');
    expect(md).not.toContain('Copy checklist');
    expect(md).not.toContain('favicons');
    expect(md).toContain('| Custody | Claim |');
  });

  it('keeps unchecked state and toolbar code language without changing the live answer', () => {
    const message = node();
    message.querySelector('[role="checkbox"]')!.setAttribute('aria-checked', 'false');
    message.querySelector('[data-dil-message-id]')!.insertAdjacentHTML('beforeend',
      '<div data-markdown-copy="code-block"><div data-markdown-copy="exclude"><div class="truncate">solidity</div><button>Copy</button></div><code>  mint(wallet, 1000);\n</code></div>');
    const before = message.outerHTML;
    const md = htmlToMarkdown(new ChatGPTParser().parseNode(message).contentHtml!);
    expect(md).toContain('- [ ] Asset backing');
    expect(md).toContain('```solidity\n  mint(wallet, 1000);\n');
    expect(message.outerHTML).toBe(before);
  });

  it('keeps diagram SVG and layout in a standalone HTML artifact through JSONL', async () => {
    node();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const parser = new ChatGPTParser();
    const result = await parser.readConversation();
    expect(result.artifacts).toHaveLength(1);
    const artifact = result.artifacts![0];
    expect(artifact.title).toMatch(/\.html$/);
    expect(artifact.content).toContain('<svg');
    expect(artifact.content).toContain('M12 6v12l5-5');
    expect(artifact.content).toContain('flex-direction: column');
    expect(artifact.content).toContain('Wallet A');
    expect(artifact.content).not.toContain('Copy checklist');
    expect(artifact.content).not.toContain('favicons');
    const { buildJsonl } = await import('../../../src/content/serializer');
    const lines = (await buildJsonl(result.messages, { platform: 'chatgpt', url: 'https://chatgpt.com/c/test', exported_at: '2026-10-09' }, result.artifacts)).split('\n').map(s => JSON.parse(s));
    expect(lines.at(-1).content).toBe(artifact.content);
    expect(lines[1].content).toContain(`[Artifact: ${artifact.title}]`);
  });
  it('writes popup source URLs into both the readable answer and its HTML artifact', async () => {
    const message = node();
    message.querySelector('[data-dil-message-id]')!.insertAdjacentHTML('beforeend',
      '<p>Evidence <span data-d-component="popover-trigger">SEC +1</span></p>');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true, groups: [[
      { title: 'Release', url: 'https://www.sec.gov/release' },
      { title: 'Statement', url: 'https://www.sec.gov/statement' },
    ]], warnings: [] });
    const result = await new ChatGPTParser().readConversation();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'READ_RICH_SOURCES', id: 'answer' });
    expect(result.messages[0].contentHtml).toContain('https://www.sec.gov/statement');
    expect(result.artifacts![0].content).toContain('<a href="https://www.sec.gov/statement">Statement</a>');
    expect(result.warnings).toEqual([]);
    expect(message.textContent).toContain('SEC +1');
  });

});
