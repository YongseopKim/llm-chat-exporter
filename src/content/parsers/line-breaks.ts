/** Page styles that show a text's "\n" characters as line breaks */
const KEEPS_LINE_BREAKS = new Set(['pre', 'pre-wrap', 'pre-line', 'break-spaces']);

/**
 * Text converted from its own source: code keeps its whitespace, and math
 * is written from its TeX annotation, whose line breaks must stay text
 */
const OWN_CONVERSION = 'pre, code, math, .katex, svg';

function hasLineBreakInText(element: Element): boolean {
  return Array.from(element.childNodes).some((child) => {
    const text = child.nodeType === 3 ? child.textContent || '' : '';
    return text.includes('\n') && /\S/.test(text);
  });
}

/**
 * Mark the elements of a detached copy whose live original shows line breaks
 *
 * Grok keeps a paragraph's line breaks with white-space: pre-wrap, and
 * Markdown conversion would collapse them into spaces. A copy no longer has
 * the page's styles, so the live element decides; the converter then keeps
 * each "\n" of a marked element (data-export-line-breaks). Code and math
 * keep their text through their own conversion and are left alone.
 *
 * @param live - Element on the page
 * @param copy - Deep clone of `live`, taken before either changed
 */
export function markLineBreaks(live: Element, copy: Element): void {
  const originals = [live, ...Array.from(live.querySelectorAll('*'))];
  const copies = [copy, ...Array.from(copy.querySelectorAll('*'))];
  if (originals.length !== copies.length) {
    return;
  }

  const view = live.ownerDocument.defaultView;
  originals.forEach((element, index) => {
    if (!hasLineBreakInText(element) || element.closest(OWN_CONVERSION)) {
      return;
    }
    if (KEEPS_LINE_BREAKS.has(view?.getComputedStyle(element).whiteSpace || '')) {
      copies[index].setAttribute('data-export-line-breaks', '');
    }
  });
}
