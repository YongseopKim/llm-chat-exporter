/** DOM-only reader serialized by chrome.scripting; keep dependencies inside it. */
export function readResearchFrame(): { frameUrl: string; html: string } | null {
  const visited = new Set<Document>();
  const read = (doc: Document): string | null => {
    if (visited.has(doc)) return null;
    visited.add(doc);
    const pages = Array.from(doc.querySelectorAll<HTMLElement>('[class*="_reportPage_"]'));
    if (pages.length && pages.some(page => page.textContent?.trim())) {
      return pages.map(page => {
        const copy = page.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('button, svg, script, style').forEach(node => node.remove());
        return copy.outerHTML;
      }).join('\n');
    }
    // The research app hosts its report in an about:blank child frame. Its
    // parent can read that child's inherited origin; the chat page cannot.
    for (const frame of Array.from(doc.querySelectorAll('iframe'))) {
      try {
        const child = frame.contentDocument;
        const html = child && read(child);
        if (html) return html;
      } catch { /* Cross-origin frames are read by their own injection. */ }
    }
    return null;
  };
  const html = read(document);
  return html ? { frameUrl: document.location.href, html } : null;
}

export async function collectResearchFrames(tabId: number, urls: string[]) {
  const expected = new Set(urls);
  for (const value of expected) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.web-sandbox.oaiusercontent.com')) {
      throw new Error('ChatGPT: unexpected research frame origin.');
    }
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true }, func: readResearchFrame,
  });
  const reports = results.flatMap(({ result }) => result && expected.has(result.frameUrl) ? [result] : []);
  for (const url of expected) {
    if (!reports.some(report => report.frameUrl === url)) {
      throw new Error('ChatGPT: the research report has not loaded or its frame is inaccessible.');
    }
  }
  return reports;
}
