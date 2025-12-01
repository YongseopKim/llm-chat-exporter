/**
 * Claude Parser
 *
 * Implements ChatParser interface for claude.ai platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure (from actual sample validation):
 * - User messages: [data-testid="user-message"]
 * - Assistant messages: [data-is-streaming] (current) OR [data-testid="assistant-message"] (fallback)
 * - User content: .whitespace-pre-wrap
 * - Assistant content: .standard-markdown or .progressive-markdown
 * - Generating: [data-is-streaming="true"]
 *
 * Key Characteristics:
 * - Hybrid selector approach (data-testid + data-is-streaming)
 * - Aggressive DOM virtualization in long conversations
 * - Streaming state via data-is-streaming attribute
 * - Most stable generation detection (attribute-based, not button-based)
 *
 * Role Strategy: hybrid (data-testid priority, then streaming attribute presence)
 *
 * @see config/selectors.json for current selectors
 * @see samples/README.md for validated selectors and DOM analysis
 */

import { BaseParser } from './base-parser';

/**
 * Claude platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * All parsing logic is inherited from BaseParser with claude configuration.
 *
 * Overrides:
 * - extractContent: Handles multiple .standard-markdown blocks and filters collapsed content
 */
export class ClaudeParser extends BaseParser {
  constructor() {
    super('claude');
  }

  /**
   * Extract content from assistant message node
   *
   * Claude UI may contain multiple .standard-markdown blocks:
   * - Collapsed thinking blocks (overflow-hidden with height: 0px)
   * - Short intermediate messages
   * - Collapsed web search results
   * - Main response content
   *
   * This override:
   * 1. Finds all content elements matching selector
   * 2. Filters out elements inside collapsed containers
   * 3. Concatenates visible content
   *
   * @override
   * @protected
   */
  protected override extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    // User messages don't have this complexity, use base implementation
    if (role === 'user') {
      return super.extractContent(node, role);
    }

    // For assistant messages, collect all visible markdown blocks
    const selector = this.selectors.content[role];
    const elements = node.querySelectorAll(selector);

    const visibleContent: string[] = [];
    for (const el of elements) {
      if (!this.isInCollapsedBlock(el as HTMLElement)) {
        visibleContent.push(el.innerHTML);
      }
    }

    return visibleContent.join('\n');
  }

  /**
   * Check if element is inside a collapsed block
   *
   * Collapsed blocks have:
   * - Class: overflow-hidden
   * - Style: height: 0px OR opacity: 0
   *
   * @private
   * @param el - Element to check
   * @returns true if element is inside collapsed block
   */
  private isInCollapsedBlock(el: HTMLElement): boolean {
    let parent = el.parentElement;
    while (parent) {
      // Check for collapsed overflow-hidden containers
      if (parent.classList.contains('overflow-hidden')) {
        const style = parent.getAttribute('style') || '';
        if (style.includes('height: 0px') || style.includes('opacity: 0')) {
          return true;
        }
      }
      parent = parent.parentElement;
    }
    return false;
  }
}
