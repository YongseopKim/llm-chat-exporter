import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectClaudeDoc, readClaudeDocFrame } from '../../src/claude-doc-frames';

const id = '22222222-2222-4222-8222-222222222222';
const originalAncestors = Object.getOwnPropertyDescriptor(document.location, 'ancestorOrigins');

afterEach(() => {
  document.body.innerHTML = '';
  if (originalAncestors) Object.defineProperty(document.location, 'ancestorOrigins', originalAncestors);
  else delete (document.location as any).ancestorOrigins;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Claude Docs frame acquisition', () => {
  it('reads only the matching editor in the requested artifact origin', () => {
    Object.defineProperty(document.location, 'ancestorOrigins', { configurable: true, value: [`https://${id}.frame.claudeusercontent.com`] });
    document.body.innerHTML = '<aside>Private comment</aside><div class="ProseMirror" role="textbox" aria-label="Report"><h1>Original body</h1><p>Ending.<svg></svg></p><img class="ProseMirror-separator"><br class="ProseMirror-trailingBreak"></div>';
    expect(readClaudeDocFrame(id, 'Other report')).toBeNull();
    expect(readClaudeDocFrame('wrong-id', 'Report')).toBeNull();
    expect(readClaudeDocFrame(id, 'Report')).toBe('<h1>Original body</h1><p>Ending.</p>');
  });

  it.each([
    ['AERO (Aerodrome / Aero) - 프로젝트의 실적과 토큰의 조건부 평가', ' Aero) - 프로젝트의 실적과 토큰의 조건부 평가'],
    ['Renamed report', 'Old report title'],
    ['Report without an accessible label', null],
  ])('reads the original heading when the accessible label differs: %s', (title, label) => {
    Object.defineProperty(document.location, 'ancestorOrigins', { configurable: true, value: [`https://${id}.frame.claudeusercontent.com`] });
    document.body.innerHTML = '<div class="ProseMirror" role="textbox"><h1></h1><p>Complete ending.</p></div>';
    const editor = document.querySelector('.ProseMirror')!;
    if (label !== null) editor.setAttribute('aria-label', label);
    editor.querySelector('h1')!.textContent = title;

    expect(readClaudeDocFrame(id, title)).toBe(editor.innerHTML);
    expect(readClaudeDocFrame('wrong-id', title)).toBeNull();
    expect(readClaudeDocFrame(id, 'Another report')).toBeNull();
  });

  it('keeps label-only documents and rejects empty or ambiguous matching editors', () => {
    Object.defineProperty(document.location, 'ancestorOrigins', { configurable: true, value: [`https://${id}.frame.claudeusercontent.com`] });
    document.body.innerHTML = '<div class="ProseMirror" role="textbox" aria-label="Report"><p>Original body.</p></div>';
    expect(readClaudeDocFrame(id, 'Report')).toBe('<p>Original body.</p>');
    document.body.innerHTML += '<div class="ProseMirror" role="textbox" aria-label="Stale label"><h1>Report</h1><p>Second body.</p></div>';
    expect(readClaudeDocFrame(id, 'Report')).toBeNull();
    document.body.innerHTML = '<div class="ProseMirror" role="textbox" aria-label="Report"><p> </p></div>';
    expect(readClaudeDocFrame(id, 'Report')).toBeNull();
  });

  it('does not use a later section heading to accept an unrelated document', () => {
    Object.defineProperty(document.location, 'ancestorOrigins', { configurable: true, value: [`https://${id}.frame.claudeusercontent.com`] });
    document.body.innerHTML = '<div class="ProseMirror" role="textbox" aria-label="Other report"><h1>Other report</h1><p>Other body.</p><h1>Report</h1></div>';
    expect(readClaudeDocFrame(id, 'Report')).toBeNull();
  });

  it('rejects an invalid artifact ID before injecting', async () => {
    vi.mocked(chrome.scripting.executeScript).mockClear();
    await expect(collectClaudeDoc(1, '../other', 'Report')).rejects.toThrow(/invalid/);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('waits for the editor to mount and fails explicitly if it never appears', async () => {
    vi.useFakeTimers();
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ frameId: 0, result: null }]);
    const pending = expect(collectClaudeDoc(1, id, 'Report')).rejects.toThrow(/could not read the Claude Docs document/);
    await vi.advanceTimersByTimeAsync(10100);
    await pending;
  });

  it('retries initial empty frames and rejects ambiguous editors', async () => {
    vi.useFakeTimers();
    vi.mocked(chrome.scripting.executeScript)
      .mockResolvedValueOnce([{ frameId: 0, result: null }])
      .mockResolvedValueOnce([{ frameId: 4, result: '<p>Original body</p>' }]);
    const pending = collectClaudeDoc(1, id, 'Report');
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBe('<p>Original body</p>');
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([
      { frameId: 4, result: '<p>One</p>' }, { frameId: 5, result: '<p>Two</p>' },
    ]);
    await expect(collectClaudeDoc(1, id, 'Report')).rejects.toThrow(/multiple matching/);
  });
});
