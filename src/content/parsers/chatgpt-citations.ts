import { waitForDom } from './dom-wait';

export interface CitationSource {
  url: string;
  title: string;
}

/** Read the title carried by a citation or its expanded tooltip link. */
function sourceOf(link: HTMLAnchorElement): CitationSource {
  const label = link.getAttribute('aria-label') || '';
  const title = label.split(/, https?:\/\//)[0].replace(/^[^:]+:\s*/, '').trim();
  return { url: link.href, title: title || link.textContent?.trim() || link.href };
}

/**
 * The visible +N anchor contains only one URL. Its hover tooltip exposes the
 * remaining sources through the Previous/Next source buttons. Read these
 * before taking a detached snapshot; no page requests or message edits occur.
 */
async function readCitationSourcesOnce(citation: HTMLAnchorElement): Promise<CitationSource[]> {
  const extra = Number(citation.getAttribute('aria-label')?.match(/(?:추가 출처\s*(\d+)개|(?:and\s+)?(\d+)\s+(?:more|additional)\s+sources?)/i)?.slice(1).find(Boolean) || 0);
  if (!extra) return [sourceOf(citation)];

  const doc = citation.ownerDocument;
  const previousFocus = doc.activeElement as HTMLElement | null;
  try {
    citation.focus({ preventScroll: true });
    // The current page opens citations on pointer hover, not keyboard focus.
    citation.dispatchEvent(new (doc.defaultView?.PointerEvent || MouseEvent)('pointerover', { bubbles: true, pointerType: 'mouse' }));
    citation.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    let tooltip = await waitForDom(() => {
      const node = doc.querySelector<HTMLElement>('[role="tooltip"]');
      const link = node?.querySelector<HTMLAnchorElement>('a[href]');
      return link?.href === citation.href ? node : null;
    });
    const sources = [sourceOf(tooltip.querySelector<HTMLAnchorElement>('a[href]')!)];
    for (let index = 2; index <= extra + 1; index++) {
      const next = tooltip.querySelector<HTMLButtonElement>('button[aria-label="다음 출처"], button[aria-label="Next source"]');
      if (!next) throw new Error('The citation has no next-source control.');
      next.click();
      const page = await waitForDom(() => {
        // React can replace the popup while changing source pages. A detached
        // reference never updates, even though the live popup is ready.
        const current = (tooltip.id && doc.getElementById(tooltip.id))
          || doc.querySelector<HTMLElement>('[role="tooltip"]');
        if (!current?.textContent?.trimStart().startsWith(`${index}/${extra + 1}`)) return null;
        const link = current.querySelector<HTMLAnchorElement>('a[href]');
        return link ? { tooltip: current, link } : null;
      });
      tooltip = page.tooltip;
      sources.push(sourceOf(page.link));
    }
    return sources;
  } finally {
    citation.dispatchEvent(new (doc.defaultView?.PointerEvent || MouseEvent)('pointerout', { bubbles: true, pointerType: 'mouse' }));
    citation.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    citation.blur();
    if (previousFocus?.isConnected && previousFocus !== doc.body) previousFocus.focus({ preventScroll: true });
  }
}

/** Reopen a transiently unavailable tooltip instead of caching an empty result. */
export async function readCitationSources(citation: HTMLAnchorElement): Promise<CitationSource[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await readCitationSourcesOnce(citation);
    } catch (error) {
      lastError = error;
      if (!citation.isConnected) break;
      // React's tooltip close and subsequent open are separate DOM updates.
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

/** Replace a snapshot's source badge with readable links at the cited span. */
export function writeCitationSources(citation: HTMLElement, sources: CitationSource[]): void {
  const links = sources.map(source => {
    const link = citation.ownerDocument.createElement('a');
    link.href = source.url;
    link.textContent = source.title;
    return link;
  });
  const span = citation.ownerDocument.createElement('span');
  links.forEach((link, index) => { if (index) span.append(' '); span.append(link); });
  citation.replaceWith(span);
}
