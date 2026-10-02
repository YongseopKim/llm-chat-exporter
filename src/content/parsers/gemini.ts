/**
 * Gemini Parser
 *
 * Implements ChatParser interface for gemini.google.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure (from samples/README.md):
 * - Messages: <user-query> and <model-response> custom elements
 * - User content: .query-text
 * - Assistant content: .response-container-content
 * - Generating: button[aria-label*="Stop"]
 *
 * Key Characteristics:
 * - Angular framework with custom elements
 * - No Shadow DOM (validated in Phase 3)
 * - Role determined by tag name (simplest strategy)
 *
 * Role Strategy: tagname (user-query, model-response)
 *
 * @see config/selectors.json for current selectors
 * @see samples/README.md for validated selectors and DOM analysis
 */

import { BaseParser } from './base-parser';
import type { Conversation } from './interface';
import { waitForDom } from './dom-wait';
import { reportHtml, sourceLinksHtml } from './report-html';

/**
 * Gemini platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * All parsing logic is inherited from BaseParser with gemini configuration.
 */
export class GeminiParser extends BaseParser {
  constructor() {
    super('gemini');
  }

  override async readConversation(): Promise<Conversation> {
    const conversation = await super.readConversation();
    if (!document.querySelector('deep-research-confirmation-widget, deep-research-immersive-panel')) return conversation;
    const initialTitle = document.querySelector('deep-research-immersive-panel toolbar .title-text')?.textContent?.trim();
    const nodes = this.getMessageNodes();
    try {
      for (const [index, node] of nodes.entries()) {
        const card = node.querySelector<HTMLElement>('immersive-entry-chip gem-processing-card.completed');
        if (!card) continue;
        const title = card.querySelector('.card-title')?.textContent?.trim();
        if (!title) throw new Error('Gemini: the research report card has no title.');
        const matchingPanel = () => {
          const panel = document.querySelector('deep-research-immersive-panel');
          return panel?.querySelector('toolbar .title-text')?.textContent?.trim() === title ? panel : null;
        };
        const button = card.querySelector<HTMLButtonElement>('button[aria-label]');
        const previousBody = document.querySelector('deep-research-immersive-panel message-content .markdown');
        const previousText = previousBody?.textContent;
        if (button) {
          button.click();
        } else if (!matchingPanel()) {
          throw new Error(`Gemini: could not open the research report "${title}".`);
        }
        const body = await waitForDom(() => {
          const content = matchingPanel()?.querySelector<HTMLElement>('message-content .markdown');
          // Two completed reports can share a title. An inactive card still
          // has an Open button; wait until its content replaces the old panel.
          if (button && previousBody && content === previousBody && content.textContent === previousText) return null;
          return content?.textContent?.trim() && content.getAttribute('aria-busy') !== 'true' ? content : null;
        }, 10000).catch(() => { throw new Error(`Gemini: the research report "${title}" did not finish loading.`); });
        const panel = matchingPanel()!;
        const sources = panel.querySelector('deep-research-source-lists');
        if (!sources) conversation.warnings.push(`Gemini: the source list for "${title}" is not available.`);
        const html = `${reportHtml(body)}\n${sources ? sourceLinksHtml(sources) : ''}`;
        conversation.messages[index].contentHtml += `\n<section data-export-research-report>${html}</section>`;
      }
      return conversation;
    } finally {
      const currentTitle = document.querySelector('deep-research-immersive-panel toolbar .title-text')?.textContent?.trim();
      if (!initialTitle && currentTitle) {
        document.querySelector<HTMLButtonElement>('button[aria-label="패널 닫기"], button[aria-label="Close panel"]')?.click();
      } else if (initialTitle && currentTitle !== initialTitle) {
        const originalCard = Array.from(document.querySelectorAll('gem-processing-card.completed'))
          .find(card => card.querySelector('.card-title')?.textContent?.trim() === initialTitle);
        originalCard?.querySelector<HTMLButtonElement>('button[aria-label]')?.click();
      }
    }
  }
}
