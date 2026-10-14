import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { collectClaudeVisualization, readClaudeVisualizationFrame, prepareClaudeVisualizationFrame, clearClaudeVisualizationFrame } from '../../src/claude-visualization-frames';

const name = 'llm-export-visualization-test';
const url = 'https://test.claudemcpcontent.com/mcp_apps';
const originalDocument = global.document;
const originalWindow = global.window;
afterEach(() => { global.document = originalDocument; global.window = originalWindow; vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Claude visualization frames', () => {
  it('accepts only the parent Claude handshake and removes all temporary markers', async () => {
    vi.useFakeTimers();
    const dom = new JSDOM('<body></body>', { url });
    global.document = dom.window.document as any; global.window = dom.window as any;
    prepareClaudeVisualizationFrame(name, url);
    const event = (origin: string, token: string) => new dom.window.MessageEvent('message', { origin, source: dom.window.parent, data: { type: 'LLM_EXPORT_VISUALIZATION', token } });
    window.dispatchEvent(event('https://evil.test', name));
    window.dispatchEvent(event('https://claude.ai', 'other-token'));
    expect(document.documentElement.hasAttribute('data-llm-export-visualization')).toBe(false);
    window.dispatchEvent(event('https://claude.ai', name));
    expect(document.documentElement.getAttribute('data-llm-export-visualization')).toBe(name);
    clearClaudeVisualizationFrame(name);
    expect(document.documentElement.hasAttribute('data-llm-export-visualization')).toBe(false);
    prepareClaudeVisualizationFrame(name, url);
    await vi.advanceTimersByTimeAsync(5100);
    expect(document.documentElement.hasAttribute('data-llm-export-preparing')).toBe(false);
  });
  it('reads only the named proxy and retains SVG paths, text and global marker definitions', () => {
    const dom = new JSDOM('<body><svg><defs><marker id="arrow"><path d="M2 1L8 5L2 9"/></marker></defs></svg><div id="vis-container"><svg viewBox="0 0 680 400"><g onclick="sendPrompt()"><text>Original participant</text><line marker-end="url(#arrow)"/></g><script>unsafe()</script></svg></div><aside>Unrelated UI</aside></body>', { url });
    global.document = dom.window.document as any; global.window = dom.window as any; document.documentElement.setAttribute('data-llm-export-visualization', name);
    expect(readClaudeVisualizationFrame('different', url)).toBeNull();
    expect(readClaudeVisualizationFrame(name, 'https://other.claudemcpcontent.com/mcp_apps')).toBeNull();
    const html = readClaudeVisualizationFrame(name, url)!;
    expect(html).toContain('Original participant');
    expect(html).toContain('M2 1L8 5L2 9');
    expect(html).toContain('url(#arrow)');
    expect(html).not.toContain('Unrelated UI');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<script');
  });

  it.each(['https://evil.test/mcp_apps', 'https://test.claudemcpcontent.com.evil.test/mcp_apps', 'https://test.claudemcpcontent.com/other', 'http://test.claudemcpcontent.com/mcp_apps', 'https://user@test.claudemcpcontent.com/mcp_apps'])('rejects unsupported frame URLs before injection: %s', async frameUrl => {
    vi.mocked(chrome.scripting.executeScript).mockClear();
    await expect(collectClaudeVisualization(1, name, frameUrl)).rejects.toThrow('invalid');
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('retries loading frames, rejects ambiguous captures, and fails explicitly on missing content', async () => {
    vi.useFakeTimers();
    let reads = 0;
    vi.mocked(chrome.scripting.executeScript).mockImplementation(async options => options.func !== readClaudeVisualizationFrame ? [] : [{ frameId: 1, result: reads++ === 0 ? null : '<html>Diagram</html>' }]);
    const pending = collectClaudeVisualization(1, name, url);
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBe('<html>Diagram</html>');
    expect(reads).toBe(2);
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ frameId: 1, result: 'One' }, { frameId: 2, result: 'Two' }]);
    await expect(collectClaudeVisualization(1, name, url)).rejects.toThrow('ambiguous');
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([]);
    const failed = expect(collectClaudeVisualization(1, name, url)).rejects.toThrow('did not finish');
    await vi.advanceTimersByTimeAsync(5100);
    await failed;
  });
});
