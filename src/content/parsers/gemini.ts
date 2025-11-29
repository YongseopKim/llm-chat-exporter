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
}
