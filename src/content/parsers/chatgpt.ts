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
}
