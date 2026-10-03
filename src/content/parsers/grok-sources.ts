import { waitForDom } from './dom-wait';

export interface GrokSources {
  /** "Search sources" section, or '' when the drawer lists no links */
  html: string;
  /** Results counted the way the drawer button counts them */
  collected: number;
  /** The count the drawer button shows ("45 sources"), when it shows one */
  listed: number | null;
}

/**
 * Read the search-result URLs in the source drawer, without exporting thinking
 *
 * The drawer has one section per agent step. Web searches list their results
 * as links; other steps ("명령 실행함", "파일 작성함") list commands or paths and
 * have no links at all. Measured on 2026-10-03, waiting for a link in every
 * section timed out on such a step and dropped all 45 sources. A section is
 * read once it has rendered, whatever it holds.
 *
 * The button's count is the sum of each search's distinct results (a page can
 * appear in two searches), so `collected` counts the same way for comparison.
 */
export async function readGrokSources(node: HTMLElement): Promise<GrokSources> {
  const trigger = node.querySelector<HTMLElement>('[role="button"][aria-label$=" sources"], [role="button"][aria-label$=" source"]');
  if (!trigger) return { html: '', collected: 0, listed: null };
  const listed = Number(trigger.getAttribute('aria-label')!.match(/^(\d+) sources?$/)?.[1] ?? NaN);
  const doc = node.ownerDocument;
  let drawer: HTMLElement | null = null;
  try {
    trigger.click();
    drawer = await waitForDom(() => Array.from(doc.querySelectorAll<HTMLElement>('aside'))
      .find(aside => aside.querySelector('button[aria-label="닫기"], button[aria-label="Close"]') && aside.querySelector('h3 button[aria-controls]')) || null);
    const sources = new Map<string, string>();
    let collected = 0;
    for (const button of Array.from(drawer.querySelectorAll<HTMLButtonElement>('h3 button[aria-controls]'))) {
      const id = button.getAttribute('aria-controls')!;
      if (button.getAttribute('aria-expanded') !== 'true') button.click();
      const panel = await waitForDom(() => {
        const region = doc.getElementById(id);
        return region?.textContent?.trim() ? region : null;
      });
      const found = new Set<string>();
      for (const link of Array.from(panel.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
        if (!/^https?:/.test(link.href)) continue;
        found.add(link.href);
        const copy = link.cloneNode(true) as HTMLAnchorElement;
        copy.querySelectorAll('p, img, svg').forEach(child => child.remove());
        const title = copy.textContent?.trim();
        if (title && !sources.get(link.href)) sources.set(link.href, title);
        else if (!sources.has(link.href)) sources.set(link.href, '');
      }
      collected += found.size;
    }
    const section = doc.createElement('section');
    const heading = doc.createElement('h3');
    heading.textContent = 'Search sources';
    section.append(heading);
    const list = doc.createElement('ul');
    for (const [url, title] of sources) {
      const item = doc.createElement('li');
      const link = doc.createElement('a');
      link.href = url;
      link.textContent = title || url;
      item.append(link);
      list.append(item);
    }
    section.append(list);
    return { html: sources.size ? section.outerHTML : '', collected, listed: Number.isFinite(listed) ? listed : null };
  } finally {
    drawer?.querySelector<HTMLButtonElement>('button[aria-label="닫기"], button[aria-label="Close"]')?.click();
  }
}
