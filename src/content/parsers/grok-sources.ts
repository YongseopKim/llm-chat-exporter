import { waitForDom } from './dom-wait';

/** Read the search-result URLs in the source drawer, without exporting thinking. */
export async function readGrokSources(node: HTMLElement): Promise<string> {
  const trigger = node.querySelector<HTMLElement>('[role="button"][aria-label$=" sources"], [role="button"][aria-label$=" source"]');
  if (!trigger) return '';
  const doc = node.ownerDocument;
  let drawer: HTMLElement | null = null;
  try {
    trigger.click();
    drawer = await waitForDom(() => Array.from(doc.querySelectorAll<HTMLElement>('aside'))
      .find(aside => aside.querySelector('button[aria-label="닫기"], button[aria-label="Close"]') && aside.querySelector('h3 button[aria-controls]')) || null);
    const sources = new Map<string, string>();
    for (const button of Array.from(drawer.querySelectorAll<HTMLButtonElement>('h3 button[aria-controls]'))) {
      const id = button.getAttribute('aria-controls')!;
      if (button.getAttribute('aria-expanded') !== 'true') button.click();
      const panel = await waitForDom(() => {
        const region = doc.getElementById(id);
        return region?.querySelector('a[href]') ? region : null;
      });
      for (const link of Array.from(panel.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
        if (!/^https?:/.test(link.href)) continue;
        const copy = link.cloneNode(true) as HTMLAnchorElement;
        copy.querySelectorAll('p, img, svg').forEach(child => child.remove());
        const title = copy.textContent?.trim() || link.href;
        if (!sources.has(link.href)) sources.set(link.href, title);
      }
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
      link.textContent = title;
      item.append(link);
      list.append(item);
    }
    section.append(list);
    return sources.size ? section.outerHTML : '';
  } finally {
    drawer?.querySelector<HTMLButtonElement>('button[aria-label="닫기"], button[aria-label="Close"]')?.click();
  }
}
