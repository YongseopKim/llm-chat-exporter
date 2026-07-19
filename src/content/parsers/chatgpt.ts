/**
 * ChatGPT Parser
 *
 * Implements ChatParser interface for chatgpt.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure (from samples/README.md):
 * - Messages: [data-message-author-role] or [data-turn]
 * - User content: .whitespace-pre-wrap
 * - Assistant content: .markdown
 * - Generating: button[aria-label*="Stop"]
 *
 * Role Strategy: attribute (data-message-author-role, data-turn)
 *
 * @see config/selectors.json for current selectors
 * @see samples/README.md for validated selectors and DOM analysis
 */

import { BaseParser } from './base-parser';
import type { ProjectInfo } from './interface';

/**
 * Matches ChatGPT project chat URLs. The trailing name slug is optional —
 * both /g/g-p-<hash>-<slug>/c/<uuid> and /g/g-p-<hash>/c/<uuid> occur in
 * practice (the latter is what the app serves when navigating in-app).
 */
const PROJECT_PATH_PATTERN = /^\/g\/(g-p-[0-9a-f]+)(?:-([^/]+))?\//;

/**
 * ChatGPT platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * All parsing logic is inherited from BaseParser with chatgpt configuration.
 */
export class ChatGPTParser extends BaseParser {
  constructor() {
    super('chatgpt');
  }

  /**
   * Get project info for the current conversation
   *
   * ChatGPT project chats live under /g/g-p-<hash>/c/<uuid> (optionally with
   * a -<slug> after the hash), unlike regular chats (/c/<uuid>). The project
   * id comes from the URL. The exact display name isn't exposed anywhere in
   * the DOM (sidebar project entries are buttons with no href), so it's read
   * from document.title, which the app renders as "{ProjectName} -
   * {ChatTitle}" once hydrated. If the title hasn't updated yet, falls back
   * to the URL slug (lossy, ASCII-only) or finally the id itself.
   *
   * @returns ProjectInfo if this conversation belongs to a project, null otherwise
   */
  getProjectInfo(): ProjectInfo | null {
    const match = document.location.pathname.match(PROJECT_PATH_PATTERN);
    if (!match) {
      return null;
    }

    const [, id, slug] = match;
    const separatorIndex = document.title.indexOf(' - ');
    const name =
      separatorIndex > 0 ? document.title.slice(0, separatorIndex).trim() : slug || id;

    return { id, name };
  }

  /**
   * Get message nodes, dropping turns that carry no message at all
   *
   * Selecting by [data-turn] (needed to catch image-generation turns, which
   * have no [data-message-author-role] descendant) also picks up scaffold
   * sections whose only text is the sr-only "ChatGPT의 말:" heading. Those
   * aren't messages, so they're filtered out here.
   *
   * Note this only drops turns with no content element AND no image — a turn
   * that has an empty .markdown is still exported as an empty message, per
   * the project's "keep empty assistant messages" decision.
   */
  override getMessageNodes(): HTMLElement[] {
    return super.getMessageNodes().filter((node) => this.hasExportableContent(node));
  }

  /**
   * Extract content, falling back to generated images
   *
   * Image-generation turns contain no .markdown element, so the base
   * implementation returns ''. In that case the generated <img> elements are
   * the message content.
   *
   * @override
   * @protected
   */
  protected override extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    return super.extractContent(node, role) || this.extractImagesHtml(node);
  }

  /**
   * Check whether a turn holds anything worth exporting
   *
   * Deliberately does NOT test for the configured content selectors: if
   * ChatGPT renamed those classes this would filter out every message and
   * silently produce an empty export. Instead it asks the weaker, more
   * durable question — is there any image, or any text that isn't
   * screen-reader-only scaffolding?
   *
   * @private
   */
  private hasExportableContent(node: HTMLElement): boolean {
    if (node.querySelector('img[src]')) {
      return true;
    }

    // Every ChatGPT turn carries an sr-only "ChatGPT의 말:" style heading;
    // a turn with nothing but that heading is scaffolding, not a message.
    const withoutScreenReaderText = node.cloneNode(true) as HTMLElement;
    withoutScreenReaderText.querySelectorAll('.sr-only').forEach((el) => el.remove());

    return (withoutScreenReaderText.textContent || '').trim() !== '';
  }

  /**
   * Build HTML holding one <img> per unique src found in the node
   *
   * ChatGPT layers several <img> elements with the same src over each other
   * (a scaled blur backdrop, the image itself, an overlay), so emitting them
   * as-is would embed the same picture multiple times. Only one is kept per
   * src, preferring the copy carrying the descriptive alt text.
   *
   * @private
   */
  private extractImagesHtml(node: HTMLElement): string {
    const altBySrc = new Map<string, string>();

    node.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) {
        return;
      }
      const alt = img.getAttribute('alt') || '';
      const existingAlt = altBySrc.get(src);
      if (existingAlt === undefined || alt.length > existingAlt.length) {
        altBySrc.set(src, alt);
      }
    });

    if (altBySrc.size === 0) {
      return '';
    }

    // Build via DOM so src/alt values are escaped correctly
    const container = document.createElement('div');
    for (const [src, alt] of altBySrc) {
      const img = document.createElement('img');
      img.setAttribute('src', src);
      if (alt) {
        img.setAttribute('alt', alt);
      }
      container.appendChild(img);
    }
    return container.innerHTML;
  }
}
