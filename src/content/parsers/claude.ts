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
import type { ArtifactData } from './interface';

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
   * Load all messages and open the latest artifact panel
   *
   * Overrides base to click the last "Preview contents" button,
   * which loads the artifact panel DOM for extraction.
   */
  override async loadAllMessages(): Promise<void> {
    await super.loadAllMessages();
    await this.openLatestArtifact();
  }

  /**
   * Click the last artifact "Preview contents" button to load the panel
   *
   * Only the last button is clicked because the artifact panel always
   * shows the latest version when opened.
   */
  private async openLatestArtifact(): Promise<void> {
    const buttons = document.querySelectorAll('[aria-label="Preview contents"]');
    if (buttons.length === 0) {
      return;
    }

    const lastButton = buttons[buttons.length - 1] as HTMLElement;
    lastButton.click();

    // Wait for the artifact panel to render
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Extract artifact data from the artifact panel
   *
   * Reads content from #markdown-artifact .standard-markdown,
   * title from the last .artifact-block-cell button,
   * and version from [data-testid="artifact-version-trigger"].
   *
   * @returns ArtifactData if panel exists with content, null otherwise
   */
  getArtifact(): ArtifactData | null {
    const panel = document.querySelector('#markdown-artifact');
    if (!panel) {
      return null;
    }

    const contentEl = panel.querySelector('.standard-markdown');
    if (!contentEl) {
      return null;
    }

    const contentHtml = contentEl.innerHTML;

    // Extract title from the last artifact-block-cell's button
    const blockCells = document.querySelectorAll('.artifact-block-cell');
    let title = 'Artifact';
    if (blockCells.length > 0) {
      const lastCell = blockCells[blockCells.length - 1];
      const btn = lastCell.querySelector('[aria-label="Preview contents"]');
      title = btn?.textContent?.trim() || 'Artifact';
    }

    // Extract version from version trigger button
    const versionTrigger = document.querySelector('[data-testid="artifact-version-trigger"]');
    const version = versionTrigger?.textContent?.trim() || 'v1';

    return { title, version, contentHtml };
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
