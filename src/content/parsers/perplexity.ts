/**
 * Perplexity Parser
 *
 * Implements ChatParser interface for perplexity.ai platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure:
 * - User messages: h1.group/query with span.select-text (plain text)
 * - Assistant messages: div[id^="markdown-content-"] with div.prose (HTML)
 * - Citations: span.citation (inline in assistant content)
 *
 * Role Strategy: combined-selector
 * - USER: node.matches("h1.group\\/query")
 * - ASSISTANT: node.matches("div[id^='markdown-content-']")
 *
 * @see config/selectors.json for current selectors
 */

import { BaseParser } from './base-parser';

/**
 * Perplexity platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * Overrides content extraction for user messages (plain text → HTML wrapping).
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
   * User messages in Perplexity are plain text inside span.select-text.
   * We wrap the text in <p> tags for consistent HTML→Markdown conversion.
   * Assistant messages use the standard div.prose extraction from BaseParser.
   */
  protected override extractContent(
    node: HTMLElement,
    role: 'user' | 'assistant'
  ): string {
    if (role === 'user') {
      const selector = this.selectors.content.user;
      const contentElement = node.querySelector(selector);
      const text = contentElement?.textContent?.trim() || '';
      return text ? `<p>${text}</p>` : '';
    }

    // Assistant: use standard BaseParser extraction (div.prose innerHTML)
    return super.extractContent(node, role);
  }
}
