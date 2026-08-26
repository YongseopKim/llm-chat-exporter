/**
 * Perplexity Parser
 *
 * Implements ChatParser interface for perplexity.ai platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure:
 * - User messages: main span.select-text (plain text)
 * - Assistant messages: main div.prose[data-renderer="lm"] (HTML)
 * - Citations: elements with data-pplx-citation (inline in assistant content)
 *
 * Role Strategy: combined-selector
 * - USER: node.matches("main span.select-text")
 * - ASSISTANT: node.matches("main div.prose[data-renderer='lm']")
 *
 * @see config/selectors.json for current selectors
 */

import { BaseParser } from './base-parser';

/**
 * Perplexity platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * Current Perplexity message selectors point directly at the content elements,
 * so extraction must include the node itself rather than descendants only.
 */
export class PerplexityParser extends BaseParser {
  constructor() {
    super('perplexity');
  }

  /**
   * Generation detection disabled for Perplexity
   * Perplexity has no reliable generation indicator in DOM.
   */
  override isGenerating(): boolean {
    return false;
  }

  /**
   * Content extraction with user message wrapping
   *
   * User messages in Perplexity are plain text in span.select-text.
   * We wrap the text in <p> tags for consistent HTML→Markdown conversion.
   * Assistant messages use the HTML inside div.prose[data-renderer="lm"].
   */
  protected override extractContent(
    node: HTMLElement,
    role: 'user' | 'assistant'
  ): string {
    const selector = this.selectors.content[role];
    const contentElement = node.matches(selector) ? node : node.querySelector(selector);

    if (role === 'user') {
      const text = contentElement?.textContent?.trim() || '';
      return text ? `<p>${text}</p>` : '';
    }

    return contentElement?.innerHTML || '';
  }
}
