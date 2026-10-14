import type { ArtifactData } from './interface';
import { waitForDom } from './dom-wait';

interface Call { name?: string; input?: Record<string, unknown>; }
const normalize = (title: string) => title.replace(/^visualize:\s*/i, '').replace(/[_\s]+/g, ' ').trim().toLowerCase();

/** Capture only displayed widget bodies. Conversation text still comes from the API. */
export async function readClaudeVisualizations(calls: Call[]): Promise<{
  markers: Map<Call, string>; artifacts: ArtifactData[]; warnings: string[];
}> {
  const markers = new Map<Call, string>();
  const artifacts: ArtifactData[] = [];
  const warnings: string[] = [];
  const originalUrl = document.location.href;
  const assertConversation = () => {
    if (document.location.href !== originalUrl) throw new Error('Claude: the conversation changed during visualization export.');
  };
  const frames = () => Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[title^="visualize:"]'));
  const signature = () => Array.from(document.querySelectorAll('[role="article"][aria-posinset]')).map(e => e.getAttribute('aria-posinset')).join(',');
  const scrolls = Array.from(document.querySelectorAll<HTMLElement>('div')).filter(e => e.scrollHeight > e.clientHeight && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(element => ({ element, top: element.scrollTop }));
  const previousFocus = document.activeElement as HTMLElement | null;
  const names = new Set<string>();
  try {
    for (const call of calls.filter(c => c.name?.startsWith('visualize') && !/read_me$/.test(c.name))) {
      assertConversation();
      const title = typeof call.input?.title === 'string' ? call.input.title : '';
      let frame: HTMLIFrameElement | undefined;
      try {
        // A mounted visualization can be above the viewport. Older pages have
        // explicit pagination controls; do not expand any thinking/tool panels.
        for (let step = 0; step < 100; step++) {
          assertConversation();
          const matches = frames().filter(e => normalize(e.title) === normalize(title));
          if (matches.length > 1) throw new Error('multiple visualizations have the same title');
          if (matches.length === 1) { frame = matches[0]; break; }
          const control = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
            .find(e => /^(?:Load earlier messages|Load later messages)$/.test(e.textContent?.trim() || ''));
          if (!control || !title) break;
          const previous = signature();
          // Claude mounts the adjacent range on focus, including its sr-only
          // pagination controls. HTMLElement.click() alone does not focus.
          control.focus({ preventScroll: true });
          // In an inactive browser window Chrome changes activeElement without
          // delivering focus events. Notify the virtual list in that case too.
          if (!document.hasFocus() && control.isConnected) {
            control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
          }
          control.click();
          await waitForDom(() => signature() !== previous || frames().some(e => normalize(e.title) === normalize(title)) ? true : null);
        }
        if (!frame) throw new Error('the displayed visualization frame is unavailable');
        const name = `llm-export-visualization-${crypto.randomUUID()}`;
        const target = frame;
        const signal = () => target.contentWindow?.postMessage({ type: 'LLM_EXPORT_VISUALIZATION', token: name }, new URL(target.src).origin);
        let timer: ReturnType<typeof setInterval> | undefined;
        let html: string;
        try {
          frame.scrollIntoView?.({ block: 'center' });
          // Route the nonce to this window only. The proxy reader accepts it
          // only from the claude.ai parent; it never reads tool inputs/thinking.
          timer = setInterval(signal, 50);
          signal();
          const response = await chrome.runtime.sendMessage({ type: 'READ_CLAUDE_VISUALIZATION', frameName: name, frameUrl: frame.src });
          if (!response?.success || typeof response.html !== 'string' || !response.html.trim()) throw new Error(response?.error || 'empty visualization');
          html = response.html;
        } finally {
          if (timer !== undefined) clearInterval(timer);
        }
        assertConversation();
        const stem = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'visualization';
        let filename = `${stem}.html`;
        for (let number = 2; names.has(filename); number++) filename = `${stem}-${number}.html`;
        names.add(filename);
        artifacts.push({ title: filename, version: 'rendered', content: html });
        markers.set(call, `[Artifact: ${filename}]`);
      } catch (error) {
        assertConversation();
        markers.set(call, `[Visualization unavailable: ${title || 'Untitled'}]`);
        warnings.push(`Claude: could not preserve visualization "${title || 'Untitled'}": ${(error as Error).message}`);
      }
    }
  } finally {
    if (document.location.href === originalUrl) {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      scrolls.forEach(({ element, top }) => { if (element.isConnected) element.scrollTop = top; });
    }
  }
  return { markers, artifacts, warnings };
}
