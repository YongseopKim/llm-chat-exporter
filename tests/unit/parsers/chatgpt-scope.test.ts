import { afterEach, expect, it, vi } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { readCitationSources } from '../../../src/content/parsers/chatgpt-citations';

const message = (id: string, text: string) => `<section data-turn="assistant" data-turn-id="${id}"><div class="markdown">${text}</div></section>`;
const badge = '<a data-testid="chatgpt-citation" href="https://example.com/primary" aria-label="Example: Primary, https://example.com/primary, 추가 출처 1개">Example+1</a>';

function tooltip(id = 'source-popup') {
  const tip = document.createElement('div');
  tip.id = id;
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = '<span>1/2</span><button aria-label="Next source"></button><a href="https://example.com/primary">Primary</a>';
  tip.querySelector('button')!.onclick = () => {
    tip.querySelector('span')!.textContent = '2/2';
    tip.querySelector('a')!.href = 'https://example.com/secondary';
    tip.querySelector('a')!.textContent = 'Secondary';
  };
  document.body.append(tip);
  return tip;
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.useRealTimers(); });

it.each(['hidden', 'inert', 'aria-hidden="true"', 'style="display:none"'])('ignores another conversation hidden by %s without opening its sources', async (hidden) => {
  document.body.innerHTML = `<aside ${hidden}><div class="thread-scroll-container">${message('other', badge)}</div></aside><main><div class="thread-scroll-container">${message('current', 'Current answer')}</div></main>`;
  const hover = vi.fn();
  document.querySelector('a')!.addEventListener('mouseover', hover);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.useFakeTimers();
  const result = new ChatGPTParser().readConversation();
  await vi.runAllTimersAsync();
  const conversation = await result;
  expect(conversation.messages.map(m => m.contentHtml)).toEqual(['Current answer']);
  expect(hover).not.toHaveBeenCalled();
  expect(conversation.warnings).toEqual([]);
});

it('refuses to choose between unrelated visible conversation roots', () => {
  document.body.innerHTML = `<div class="thread-scroll-container">${message('one', 'One')}</div><div class="thread-scroll-container">${message('two', 'Two')}</div>`;
  expect(() => new ChatGPTParser().getMessageNodes()).toThrow(/multiple.*conversation/i);
});

it('stops instead of merging another conversation after navigation', async () => {
  document.body.innerHTML = `<main>${message('one', 'First')}</main>`;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const previous = window.location.href;
  try {
    await expect(new ChatGPTParser().loadAllMessages({timeout:0, onStep: () => {
      window.history.replaceState(null, '', '/c/changed');
    }})).rejects.toThrow(/conversation.*changed/i);
  } finally { window.history.replaceState(null, '', previous); }
});

it('opens a tooltip that requires a pointer move, as a real hover does', async () => {
  document.body.innerHTML = badge;
  const citation = document.querySelector('a')!;
  citation.addEventListener('pointermove', () => { if (!document.getElementById('source-popup')) tooltip(); });
  vi.useFakeTimers();
  const result = readCitationSources(citation).catch(error => error);
  await vi.runAllTimersAsync();
  expect(await result).toEqual([
    {url:'https://example.com/primary',title:'Primary'}, {url:'https://example.com/secondary',title:'Secondary'},
  ]);
});

it('reads the matching popup even when an unrelated tooltip precedes it', async () => {
  document.body.innerHTML = '<div role="tooltip"><a href="https://example.com/unrelated">Other</a></div>' + badge;
  const citation = document.querySelector<HTMLAnchorElement>('[data-testid]')!;
  citation.addEventListener('mouseover', () => tooltip());
  vi.useFakeTimers();
  const result = readCitationSources(citation).catch(error => error);
  await vi.runAllTimersAsync();
  expect(await result).toHaveLength(2);
});

it('does not repeatedly retry a popup with no source navigation control', async () => {
  document.body.innerHTML = message('one', badge);
  const citation = document.querySelector('a')!;
  const open = vi.fn(() => {
    const tip = tooltip(); tip.querySelector('button')!.remove();
  });
  citation.addEventListener('mouseover', open);
  citation.addEventListener('mouseout', () => document.getElementById('source-popup')?.remove());
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.useFakeTimers();
  const result = new ChatGPTParser().readConversation();
  await vi.runAllTimersAsync();
  const conversation = await result;
  expect(open).toHaveBeenCalledTimes(1);
  expect(conversation.warnings).toEqual([expect.stringContaining('next-source control')]);
  expect(conversation.messages[0].contentHtml).toContain('https://example.com/primary');
});


it('limits unavailable source openings across every snapshot and preserves the original link', async () => {
  document.body.innerHTML = message('one', badge);
  const open = vi.fn();
  document.querySelector('a')!.addEventListener('mouseover', open);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.useFakeTimers();
  const result = new ChatGPTParser().readConversation();
  await vi.runAllTimersAsync();
  const conversation = await result;
  expect(open).toHaveBeenCalledTimes(4);
  expect(conversation.warnings).toHaveLength(1);
  expect(conversation.messages[0].contentHtml).toContain('https://example.com/primary');
});

it('walks the selected thread even when a hidden thread has a larger scroll range', async () => {
  document.body.innerHTML = `<aside hidden><div id="other" class="thread-scroll-container" style="overflow-y:auto">${message('other', 'Other')}</div></aside><main><div id="current" class="thread-scroll-container" style="overflow-y:auto">${message('current', 'Current')}</div></main>`;
  const current = document.getElementById('current')!;
  const other = document.getElementById('other')!;
  Object.defineProperty(current, 'scrollHeight', {value:1000});
  Object.defineProperty(current, 'clientHeight', {value:500});
  Object.defineProperty(other, 'scrollHeight', {value:10000});
  Object.defineProperty(other, 'clientHeight', {value:500});
  current.scrollTop = 500;
  other.scrollTop = 9000;
  const positions: number[] = [];
  await new ChatGPTParser().loadAllMessages({stepDelay:0, onStep:() => { positions.push(current.scrollTop); }});
  expect(positions).toContain(0);
  expect(current.scrollTop).toBe(500);
  expect(other.scrollTop).toBe(9000);
});

it('uses the citation-associated tooltip when two popups show the same primary URL', async () => {
  document.body.innerHTML = badge;
  const citation = document.querySelector('a')!;
  tooltip('unrelated-popup');
  citation.setAttribute('aria-describedby', 'source-popup');
  citation.addEventListener('mouseover', () => tooltip());
  const result = await readCitationSources(citation);
  expect(result.map(s => s.url)).toEqual(['https://example.com/primary', 'https://example.com/secondary']);
});


it('ignores a generating indicator in a hidden conversation', () => {
  document.body.innerHTML = `<aside style="display:none"><div class="thread-scroll-container"><button aria-label="Stop generating"></button></div></aside><main><div class="thread-scroll-container">${message('current', 'Ready')}</div></main>`;
  expect(new ChatGPTParser().isGenerating()).toBe(false);
});

it('recovers a citation after its original node unmounts during a failed opening', async () => {
  document.body.innerHTML = `<main>${message('one', badge)}</main>`;
  const first = document.querySelector('a')!;
  first.addEventListener('mouseover', () => {
    const replacement = first.cloneNode(true) as HTMLAnchorElement;
    replacement.addEventListener('mouseover', () => tooltip());
    replacement.addEventListener('mouseout', () => document.getElementById('source-popup')?.remove());
    first.replaceWith(replacement);
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.useFakeTimers();
  const result = new ChatGPTParser().readConversation();
  await vi.runAllTimersAsync();
  const conversation = await result;
  expect(conversation.messages[0].contentHtml).toContain('https://example.com/secondary');
  expect(conversation.warnings).toEqual([]);
});
