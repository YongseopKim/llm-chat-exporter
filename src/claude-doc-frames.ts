/** Serialized by chrome.scripting: this function must be self-contained. */
export function readClaudeDocFrame(artifactId: string, title: string): string | null {
  // Claude Docs renders its editor inside an opaque-origin srcdoc frame.
  // ancestorOrigins identifies the containing artifact even when referrer is empty.
  if (document.location.ancestorOrigins?.[0] !== `https://${artifactId}.frame.claudeusercontent.com`) {
    return null;
  }
  const bodies = Array.from(document.querySelectorAll<HTMLElement>('.ProseMirror[role="textbox"]'))
    .filter(body => {
      // Claude Docs can truncate or retain an old accessible label while its
      // first heading still carries the complete current document title.
      const matchesTitle = body.getAttribute('aria-label') === title
        || body.querySelector('h1')?.textContent?.trim() === title;
      return matchesTitle && body.textContent?.trim();
    });
  if (bodies.length !== 1) return null;
  const copy = bodies[0].cloneNode(true) as HTMLElement;
  copy.querySelectorAll('button, svg, script, style, nav, .ProseMirror-separator, .ProseMirror-trailingBreak')
    .forEach(node => node.remove());
  return copy.innerHTML;
}

export async function collectClaudeDoc(tabId: number, artifactId: string, title: string): Promise<string> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(artifactId) || !title.trim()) {
    throw new Error('Claude: invalid document frame request.');
  }
  const deadline = Date.now() + 10000;
  do {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true }, func: readClaudeDocFrame, args: [artifactId, title],
    });
    const bodies = results.flatMap(({ result }) => typeof result === 'string' && result.trim() ? [result] : []);
    if (bodies.length === 1) return bodies[0];
    if (bodies.length > 1) throw new Error('Claude: multiple matching document editors are open.');
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Claude: could not read the Claude Docs document "${title}". Open its document panel and export again.`);
}
