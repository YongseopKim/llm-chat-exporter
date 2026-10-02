import { BaseParser } from './base-parser';
import { reportHtml } from './report-html';

/** Surf uses one markdown renderer for each answer and left-aligned prompts. */
export class SurfParser extends BaseParser {
  constructor() { super('surf'); }

  override getMessageNodes(): HTMLElement[] {
    return super.getMessageNodes().filter(node =>
      !node.matches('[data-markdown-renderer]') || !node.closest('.justify-start'));
  }

  protected override extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    if (role === 'assistant') return reportHtml(node);
    const copy = node.cloneNode(true) as HTMLElement;
    const files: string[] = [];
    copy.querySelectorAll<HTMLElement>('[title]').forEach(tile => {
      const name = tile.getAttribute('title') || '';
      // Actual Surf file tiles label the full file name and display an
      // extension badge. The truncated preview is not the prompt's text.
      if (/\.[a-z0-9]{1,10}$/i.test(name)) {
        files.push(this.buildAttachmentPlaceholder(name));
        tile.remove();
      }
    });
    const body = reportHtml(copy);
    return [...files, ...(copy.textContent?.trim() ? [body] : [])].join('\n');
  }

  override isGenerating(): boolean {
    return !!document.querySelector('#surf-root button[aria-label="Stop"], #surf-root button[aria-label="Stop generating"]');
  }
}
