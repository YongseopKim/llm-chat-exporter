import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildJsonl } from '../../src/content/serializer';

const url = 'https://images.openai.com/static-rsc-4/report?purpose=inline';
const data = 'data:image/png;base64,iVBORw0KGgo=';
const metadata = { platform: 'chatgpt' as const, url: 'https://chatgpt.com/c/test', exported_at: '2026-10-12' };

afterEach(() => vi.restoreAllMocks());

describe('images in a portable export', () => {
  it('embeds the same external image in Markdown and a complete HTML artifact, reading it once', async () => {
    const send = vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true, dataUri: data });
    const html = `<!doctype html><html><head><style>.box{display:grid}</style></head><body><div class="box"><img src="${url}" srcset="${url} 2x"><svg><path d="M0 0L1 1"/></svg></div></body></html>`;
    const rows = (await buildJsonl([{ role: 'assistant', contentHtml: `<img alt="report" src="${url}">` }], metadata,
      [{ title: 'answer.html', version: 'rendered', content: html }])).split('\n').map(JSON.parse);
    expect(rows[1].content).toContain(data);
    expect(rows[2].content).toContain(data);
    expect(rows[2].content).toContain('<style>.box{display:grid}</style>');
    expect(rows[2].content).toContain('M0 0L1 1');
    expect(rows[2].content).not.toContain(url);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps the URL and records a failed image once in metadata', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: false, error: 'HTTP 403' });
    const rows = (await buildJsonl([{ role: 'assistant', contentHtml: `<img src="${url}">` }], metadata,
      [{ title: 'answer.html', version: 'rendered', content: `<!doctype html><html><body><img src="${url}"></body></html>` }])).split('\n').map(JSON.parse);
    expect(rows[1].content).toContain(url);
    expect(rows[2].content).toContain(url);
    expect(rows[0].warnings).toHaveLength(1);
    expect(rows[0].warnings[0]).toContain('HTTP 403');
  });
});
