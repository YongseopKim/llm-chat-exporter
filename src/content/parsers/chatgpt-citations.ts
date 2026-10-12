import { waitForDom } from './dom-wait';

/** A loaded popup with an incompatible structure cannot recover by reopening it. */
export class CitationStructureError extends Error {}

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
export async function readCitationSources(citation: HTMLAnchorElement): Promise<CitationSource[]> {
  const extra = Number(citation.getAttribute('aria-label')?.match(/(?:추가 출처\s*(\d+)개|(?:and\s+)?(\d+)\s+(?:more|additional)\s+sources?)/i)?.slice(1).find(Boolean) || 0);
  if (!extra) return [sourceOf(citation)];

  const doc = citation.ownerDocument;
  const previousFocus = doc.activeElement as HTMLElement | null;
  try {
    citation.focus({ preventScroll: true });
    // The current page opens citations on pointer hover, not keyboard focus.
    const rect = citation.getBoundingClientRect();
    const init = { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2, relatedTarget: doc.body };
    const Pointer = doc.defaultView?.PointerEvent || MouseEvent;
    citation.dispatchEvent(new Pointer('pointerover', init));
    citation.dispatchEvent(new MouseEvent('mouseover', init));
    // Radix hover handling can open on movement rather than entry alone.
    citation.dispatchEvent(new Pointer('pointermove', init));
    citation.dispatchEvent(new MouseEvent('mousemove', init));
    let tooltip = await waitForDom(() => {
      const ids = `${citation.getAttribute('aria-describedby') || ''} ${citation.getAttribute('aria-controls') || ''}`.trim().split(/\s+/);
      const associated = ids.map(id => doc.getElementById(id)).filter((el): el is HTMLElement => !!el);
      const candidates = associated.length ? associated : Array.from(doc.querySelectorAll<HTMLElement>('[role="tooltip"]'));
      const matches = candidates.filter(node => node.querySelector<HTMLAnchorElement>('a[href]')?.href === citation.href);
      if (matches.length > 1) throw new CitationStructureError('The citation has multiple matching source popups.');
      return matches[0] || null;
    });
    const sources = [sourceOf(tooltip.querySelector<HTMLAnchorElement>('a[href]')!)];
    for (let index = 2; index <= extra + 1; index++) {
      const next = tooltip.querySelector<HTMLButtonElement>('button[aria-label="다음 출처"], button[aria-label="Next source"]');
      if (!next) throw new CitationStructureError('The citation has no next-source control.');
      next.click();
      const page = await waitForDom(() => {
        // React can replace the popup while changing source pages. A detached
        // reference never updates, even though the live popup is ready.
        const candidates = tooltip.id ? [doc.getElementById(tooltip.id)]
          : Array.from(doc.querySelectorAll<HTMLElement>('[role="tooltip"]')).filter(node => node === tooltip);
        const current = candidates.find(node => node?.textContent?.trimStart().startsWith(`${index}/${extra + 1}`));
        const link = current?.querySelector<HTMLAnchorElement>('a[href]');
        return current && link ? { tooltip: current, link } : null;
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
