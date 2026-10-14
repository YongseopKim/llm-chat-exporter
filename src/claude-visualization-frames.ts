/** A bounded handshake identifies a widget even when proxies share one URL. */
export function prepareClaudeVisualizationFrame(token: string, frameUrl: string): void {
  if (document.location.href !== frameUrl) return;
  const root = document.documentElement;
  if (root.getAttribute('data-llm-export-visualization') === token || root.getAttribute('data-llm-export-preparing') === token) return;
  root.setAttribute('data-llm-export-preparing', token);
  const receive = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== 'https://claude.ai'
        || event.data?.type !== 'LLM_EXPORT_VISUALIZATION' || event.data.token !== token) return;
    document.documentElement.setAttribute('data-llm-export-visualization', token);
    root.removeAttribute('data-llm-export-preparing');
    window.removeEventListener('message', receive);
  };
  window.addEventListener('message', receive);
  setTimeout(() => {
    window.removeEventListener('message', receive);
    if (root.getAttribute('data-llm-export-preparing') === token) root.removeAttribute('data-llm-export-preparing');
  }, 5000);
}

/** Runs inside the selected proxy, never in a tool/thinking panel. */
export function readClaudeVisualizationFrame(token: string, frameUrl: string): string | null {
  if (document.documentElement.getAttribute('data-llm-export-visualization') !== token || document.location.href !== frameUrl) return null;
  // The proxy renders the visible widget in a same-origin about:blank child.
  const docs = [document, ...Array.from(document.querySelectorAll('iframe')).flatMap(frame => {
    try { return frame.contentDocument ? [frame.contentDocument] : []; } catch { return []; }
  })];
  const roots = docs.flatMap(doc => Array.from(doc.querySelectorAll<HTMLElement>('#vis-container')));
  if (roots.length !== 1 || !roots[0].innerHTML.trim()) return null;
  const root = roots[0];
  const view = root.ownerDocument.defaultView!;
  const copy = root.cloneNode(true) as HTMLElement;
  const originals = [root, ...Array.from(root.querySelectorAll('*'))];
  const copies = [copy, ...Array.from(copy.querySelectorAll('*'))];
  const properties = ['display', 'position', 'width', 'height', 'max-width', 'min-height',
    'margin', 'padding', 'box-sizing', 'background-color', 'color', 'font-family',
    'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'white-space',
    'border', 'border-radius', 'flex', 'flex-direction', 'align-items', 'justify-content',
    'gap', 'grid-template-columns', 'fill', 'stroke', 'stroke-width', 'opacity',
    'text-anchor', 'dominant-baseline', 'visibility'];
  originals.forEach((element, index) => {
    const target = copies[index] as HTMLElement;
    target.removeAttribute('style');
    const style = view.getComputedStyle(element);
    for (const property of properties) {
      const value = style.getPropertyValue(property);
      if (value && !/url\s*\(/i.test(value)) target.style.setProperty(property, value);
    }
    for (const attr of Array.from(target.attributes)) {
      if (/^on/i.test(attr.name) || /^(?:javascript|vbscript):/i.test(attr.value.trim())) target.removeAttribute(attr.name);
    }
    if (element.tagName === 'CANVAS') {
      const image = root.ownerDocument.createElement('img');
      image.src = (element as HTMLCanvasElement).toDataURL('image/png');
      image.setAttribute('style', target.getAttribute('style') || '');
      target.replaceWith(image);
    }
  });
  copy.querySelectorAll('script,iframe,object,embed,link,style,button').forEach(node => node.remove());
  // Some widgets reference the shell's arrow definitions outside vis-container.
  const defs = Array.from(root.ownerDocument.querySelectorAll('body > svg defs')).map(node => node.outerHTML).join('');
  const shell = root.ownerDocument.implementation.createHTMLDocument('Claude visualization');
  shell.head.innerHTML = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">';
  shell.body.style.backgroundColor = view.getComputedStyle(root.ownerDocument.body).backgroundColor;
  if (defs) shell.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">${defs}</svg>`;
  shell.body.append(copy);
  // Definitions come from outside the cloned widget and need the same cleanup.
  shell.body.querySelectorAll('script,iframe,object,embed,link,style,button').forEach(node => node.remove());
  for (const element of Array.from(shell.body.querySelectorAll('*'))) {
    for (const attr of Array.from(element.attributes)) {
      if (/^on/i.test(attr.name) || /^(?:javascript|vbscript):/i.test(attr.value.trim())) element.removeAttribute(attr.name);
    }
  }
  return '<!doctype html>\n' + shell.documentElement.outerHTML;
}

export function clearClaudeVisualizationFrame(token: string): void {
  if (document.documentElement.getAttribute('data-llm-export-visualization') === token) document.documentElement.removeAttribute('data-llm-export-visualization');
  if (document.documentElement.getAttribute('data-llm-export-preparing') === token) document.documentElement.removeAttribute('data-llm-export-preparing');
}

export async function collectClaudeVisualization(tabId: number, frameName: string, frameUrl: string): Promise<string> {
  const url = new URL(frameUrl);
  if (!/^llm-export-visualization-[a-z0-9-]+$/i.test(frameName)
      || url.protocol !== 'https:' || !/^[a-z0-9]+\.claudemcpcontent\.com$/.test(url.hostname)
      || url.pathname !== '/mcp_apps' || url.port || url.username || url.password) {
    throw new Error('Claude: invalid visualization frame request.');
  }
  const deadline = Date.now() + 5000;
  try {
    // Install the short-lived listener in already loaded proxies. If the
    // requested proxy is still navigating, retry preparation after navigation.
    do {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: prepareClaudeVisualizationFrame, args: [frameName, frameUrl] });
      const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: readClaudeVisualizationFrame, args: [frameName, frameUrl] });
      const matches = results.flatMap(({ result }) => typeof result === 'string' && result.trim() ? [result] : []);
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) throw new Error('Claude: ambiguous visualization frames.');
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
  } finally {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: clearClaudeVisualizationFrame, args: [frameName] });
  }
  throw new Error('Claude: the visualization did not finish loading.');
}
