/** ChatGPT's component-rendered answers, observed on 2026-10-09. */
export const DIL_SELECTOR = '[data-dil-message-id]';
const STYLE_PROPERTIES = new Set([
  'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'max-width',
  'min-height', 'max-height', 'flex', 'flex-direction', 'flex-wrap', 'flex-shrink',
  'align-items', 'align-self', 'justify-content', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
  'color', 'background-color', 'font-family', 'font-size', 'font-weight',
  'font-style', 'line-height', 'text-align', 'white-space', 'fill', 'stroke',
  'stroke-width', 'vertical-align', 'border-collapse', 'table-layout',
]);

/** Normalize only rich answers; other platforms and legacy Markdown stay intact. */
export function normalizeDil(root: HTMLElement): void {
  root.querySelectorAll('[data-markdown-copy="code-block"]').forEach(block => {
    const code = block.querySelector('code');
    const language = block.querySelector('[data-markdown-copy="exclude"] .truncate')?.textContent?.trim();
    if (code && language && !/language-/.test(code.className) && /^[a-z0-9_+-]+$/i.test(language)) {
      code.classList.add(`language-${language}`);
    }
  });
  root.querySelectorAll('[data-d-component="favicon"], [data-d-component="button"], [data-markdown-copy="exclude"]').forEach(el => el.remove());
  root.querySelectorAll<HTMLElement>('[data-d-default-strong], [data-d-weight="bold"], [data-d-weight="semibold"]').forEach(el => {
    if (/^H[1-6]$/.test(el.tagName)) return;
    const strong = root.ownerDocument.createElement('strong');
    strong.append(...Array.from(el.childNodes));
    el.append(strong);
  });
  root.querySelectorAll<HTMLElement>('svg[data-d-component="icon"]').forEach(el => {
    const image = root.ownerDocument.createElement('img');
    image.alt = 'Diagram icon';
    image.src = 'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(el)).replace(/[()']/g, char => `%${char.charCodeAt(0).toString(16)}`);
    el.replaceWith(image);
  });
  root.querySelectorAll<HTMLElement>('[data-d-component="checkbox"]').forEach(el => {
    const row = el.parentElement;
    if (row?.querySelector('label')) {
      row.setAttribute('data-export-dil-task', el.getAttribute('aria-checked') === 'true' ? 'x' : ' ');
      el.remove();
    } else {
      el.textContent = el.getAttribute('aria-checked') === 'true' ? '[x]' : '[ ]';
      el.setAttribute('data-export-dil-check', '');
    }
  });
}

/**
 * Keep the rendered layout as a portable HTML document alongside Markdown.
 * Read computed styles before virtualization detaches the node. This preserves
 * the actual SVG paths and row/grid relationships rather than guessing arrows
 * from icon shapes. No JavaScript or page CSS is needed to open the document.
 */
export function captureDilHtml(source: HTMLElement): string {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...Array.from(source.querySelectorAll('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
  originals.forEach((el, index) => {
    const copy = copies[index] as HTMLElement;
    const computed = source.ownerDocument.defaultView?.getComputedStyle(el);
    copy.removeAttribute('class');
    copy.removeAttribute('style');
    if (computed) {
      for (let i = 0; i < computed.length; i++) {
        const name = computed.item(i);
        const value = computed.getPropertyValue(name);
        if (STYLE_PROPERTIES.has(name) && !/url\s*\(/i.test(value)) copy.style.setProperty(name, value);
      }
    }
    // Explicit component layout also makes reduced DOM fixtures portable.
    if (el.hasAttribute('data-d-direction') && !el.hasAttribute('data-d-inline')) {
      copy.style.display = 'flex';
      copy.style.flexDirection = el.getAttribute('data-d-direction') === 'row' ? 'row' : 'column';
    }
    if (el.getAttribute('data-d-component') === 'grid') copy.style.display = 'grid';
    for (const attr of Array.from(copy.attributes)) {
      if (/^on/i.test(attr.name) || /^(?:javascript|vbscript):/i.test(attr.value.trim())) copy.removeAttribute(attr.name);
    }
  });
  clone.querySelectorAll('script, iframe, object, embed, link, style, [data-d-component="favicon"], [data-d-component="button"], [data-markdown-copy="exclude"]').forEach(el => el.remove());
  clone.querySelectorAll('[data-d-component="checkbox"]').forEach(el => {
    el.textContent = el.getAttribute('aria-checked') === 'true' ? '[x]' : '[ ]';
    el.removeAttribute('role');
  });
  return '<!doctype html><html><head><meta charset="utf-8"><title>ChatGPT rendered answer</title></head><body>' + clone.outerHTML + '</body></html>';
}
