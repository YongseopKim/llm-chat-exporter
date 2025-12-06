/**
 * Grok Parser
 *
 * Implements ChatParser interface for grok.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * Role Strategy: sibling-button
 * - USER: parent has button[aria-label="Edit"]
 * - ASSISTANT: parent has button[aria-label="Regenerate"]
 *
 * @see config/selectors.json for current selectors
 */

import { BaseParser } from './base-parser';

/**
 * Grok platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * Overrides role extraction to use sibling-button strategy.
 */
export class GrokParser extends BaseParser {
  constructor() {
    super('grok');
  }

  /**
   * Grok role extraction: check parent for aria-label buttons
   * - USER: button[aria-label="Edit"] exists
   * - ASSISTANT: button[aria-label="Regenerate"] exists
   */
  protected override extractRole(node: HTMLElement): 'user' | 'assistant' {
    const parent = node.parentElement;
    if (!parent) return 'user';

    // Check for Regenerate button (assistant indicator)
    if (parent.querySelector('button[aria-label="Regenerate"]')) {
      return 'assistant';
    }

    // Check for Edit button (user indicator)
    if (parent.querySelector('button[aria-label="Edit"]')) {
      return 'user';
    }

    // Default to user if no markers found
    return 'user';
  }

  /**
   * Generation detection disabled (user request)
   * Always returns false as user will only export after generation completes.
   */
  override isGenerating(): boolean {
    return false;
  }

  /**
   * Grok content extraction: use node's innerHTML directly
   * Unlike other platforms, Grok's .message-bubble is the content container itself,
   * not a wrapper around a content element.
   */
  protected override extractContent(
    node: HTMLElement,
    _role: 'user' | 'assistant'
  ): string {
    return node.innerHTML || '';
  }
}
