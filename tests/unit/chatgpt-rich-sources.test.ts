import { afterEach, expect, it, vi } from 'vitest';
import { readRichSources, collectRichSources } from '../../src/chatgpt-rich-sources';

// Schema observed in the user's conversation API on 2026-10-09. The source
// component's state.items carries titles and URLs absent from popup buttons.
const release = { title: 'SEC release', url: 'https://www.sec.gov/release?tracking=original' };
const statement = { title: 'SEC statement', url: 'https://www.sec.gov/statement' };
function fixture(groups = [[release, statement]]) {
  window.history.replaceState(null, '', '/c/conversation');
  document.body.innerHTML = '<div data-dil-message-id="answer"><span data-d-component="popover-trigger" aria-expanded="false">SEC +1</span></div>';
  const trigger = document.querySelector<HTMLElement>('span')!;
  const cardClick = vi.fn();
  trigger.onclick = () => {
    const old = document.getElementById('sources');
    if (old) { old.remove(); trigger.setAttribute('aria-expanded', 'false'); return; }
    trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', 'sources');
    const popup = document.createElement('div'); popup.id = 'sources'; popup.setAttribute('role', 'dialog');
    for (const source of [release, statement]) {
      const button = document.createElement('button'); button.dataset.dComponent = 'pressable';
      button.innerHTML = `<span data-d-weight="medium">${source.title}</span>`;
      button.onclick = cardClick; popup.append(button);
    }
    document.body.append(popup);
  };
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ accessToken: 'fixture-token' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ mapping: { answer: { message: { metadata: {
      model_dil_v2: { appData: { opGenui: { componentResults: Object.fromEntries(groups.map((items, i) => [i, { state: { items } }])) } } },
    } } } } }) });
  vi.stubGlobal('fetch', fetch);
  return { fetch, cardClick, trigger };
}
afterEach(() => { document.body.innerHTML = ''; window.history.replaceState(null, '', '/'); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('matches popup titles to this answer sources without clicking cards or returning credentials', async () => {
  const { fetch, cardClick, trigger } = fixture();
  const result = await readRichSources('answer');
  expect(result).toEqual({ groups: [[release, statement]], warnings: [] });
  expect(fetch).toHaveBeenNthCalledWith(2, '/backend-api/conversation/conversation', expect.objectContaining({
    credentials: 'include', headers: { Authorization: 'Bearer fixture-token' },
  }));
  expect(cardClick).not.toHaveBeenCalled();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(JSON.stringify(result)).not.toContain('fixture-token');
});

it('reports ambiguous titles rather than assigning an unrelated URL', async () => {
  fixture([[release, statement], [{ ...release, url: 'https://other.example/release' }, statement]]);
  const result = await readRichSources('answer');
  expect(result.groups).toEqual([[]]);
  expect(result.warnings.join(' ')).toMatch(/unique/);
});

it('rejects a missing answer and HTTP errors without leaking response bodies', async () => {
  const { fetch } = fixture();
  await expect(readRichSources('other-answer')).rejects.toThrow(/unavailable/);
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockReset().mockResolvedValue({ ok: false, status: 401, json: async () => ({ secret: 'never read' }) });
  await expect(readRichSources('answer')).rejects.toThrow('HTTP 401');
});

it('uses MAIN only for the requested tab and answer', async () => {
  vi.mocked(chrome.scripting.executeScript).mockResolvedValue([{ frameId: 0, result: { groups: [[release]], warnings: [] } }]);
  expect(await collectRichSources(7, 'answer')).toEqual({ groups: [[release]], warnings: [] });
  expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, world: 'MAIN', func: readRichSources, args: ['answer'] });
});
