import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectResearchFrames, readResearchFrame } from '../../src/research-frames';

describe('research frame acquisition', () => {
  let original: string;
  beforeEach(() => { original = document.body.innerHTML; vi.clearAllMocks(); });
  afterEach(() => { document.body.innerHTML = original; });

  it('reads the actual report container inside the app\'s about:blank child', () => {
    document.body.innerHTML = '<iframe id="root" src="about:blank"></iframe>';
    const child = document.querySelector('iframe')!.contentDocument!;
    child.body.innerHTML = '<button>Export</button><div class="_reportPage_16ou1_1"><h1>Report</h1><p>Full ending</p></div>';
    expect(readResearchFrame()?.html).toBe('<div class="_reportPage_16ou1_1"><h1>Report</h1><p>Full ending</p></div>');
  });

  it('rejects an unrelated origin before injecting', async () => {
    await expect(collectResearchFrames(1, ['https://example.org/'])).rejects.toThrow(/origin/);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('uses only results belonging to the requested frame and fails on absent reports', async () => {
    const url = 'https://mcp-app-fixture.web-sandbox.oaiusercontent.com/';
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ frameId: 1, result: {
      frameUrl: 'about:blank', html: '<h1>Wrong frame</h1>',
    } }]);
    await expect(collectResearchFrames(1, [url])).rejects.toThrow(/inaccessible/);
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ frameId: 2, result: {
      frameUrl: url, html: '<h1>Original report</h1>',
    } }]);
    await expect(collectResearchFrames(1, [url])).resolves.toEqual([{ frameUrl: url, html: '<h1>Original report</h1>' }]);
  });
});
