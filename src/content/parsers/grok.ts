/**
 * Grok Parser
 *
 * Implements ChatParser interface for grok.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * Role Strategy: sibling-button
 * - USER: parent has button[aria-label="Edit"] or button[aria-label="편집"]
 * - ASSISTANT: parent has button[aria-label="Regenerate"] or button[aria-label="다시 생성"]
 *
 * Mermaid Handling:
 * - Grok renders Mermaid natively to SVG, losing original source
 * - "원본 보기" button reveals the original Mermaid code
 * - This parser auto-clicks that button to extract source code
 *
 * @see config/selectors.json for current selectors
 */

import { BaseParser } from './base-parser';
import type { ScrollOptions } from '../scroller';
import { mergeTurnOrder } from './message-order';
import { readGrokSources } from './grok-sources';

/**
 * Grok platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * Overrides role extraction to use sibling-button strategy.
 */
export class GrokParser extends BaseParser {
  private readonly collected = new Map<string, HTMLElement>();
  private readonly sources = new Map<string, string>();
  private order: string[] = [];
  constructor() {
    super('grok');
  }

  /**
   * Grok role extraction: check parent for aria-label buttons
   * Supports both English and Korean (한국어) localized labels:
   * - USER: button[aria-label="Edit"] or button[aria-label="편집"]
   * - ASSISTANT: button[aria-label="Regenerate"] or button[aria-label="다시 생성"]
   */
  protected override extractRole(node: HTMLElement): 'user' | 'assistant' {
    const testId = node.getAttribute('data-testid');
    if (testId === 'user-message') return 'user';
    if (testId === 'assistant-message') return 'assistant';
    const parent = node.parentElement;
    if (!parent) return 'user';

    // Check for Regenerate button (assistant indicator) — English or Korean
    if (
      parent.querySelector('button[aria-label="Regenerate"]') ||
      parent.querySelector('button[aria-label="다시 생성"]')
    ) {
      return 'assistant';
    }

    // Check for Edit button (user indicator) — English or Korean
    if (
      parent.querySelector('button[aria-label="Edit"]') ||
      parent.querySelector('button[aria-label="편집"]')
    ) {
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
   * Load all messages and convert Mermaid SVGs to code blocks
   *
   * Overrides base to handle Mermaid conversion before parsing.
   * This ensures DOM changes from button clicks have time to complete.
   */
  override async loadAllMessages(options: ScrollOptions = {}): Promise<void> {
    this.collected.clear();
    this.sources.clear();
    this.order = [];
    await super.loadAllMessages({
      ...options,
      onStep: async () => {
        await this.convertAllMermaidToCodeBlocks();
        await this.snapshotMountedMessages();
        await options.onStep?.();
      },
    });
  }

  override getMessageNodes(): HTMLElement[] {
    return this.collected.size ? this.order.map(key => this.collected.get(key)!) : super.getMessageNodes();
  }

  private async snapshotMountedMessages(): Promise<void> {
    const keys: string[] = [];
    for (const node of super.getMessageNodes()) {
      // Both user and assistant rows have stable response-UUID IDs. Never
      // deduplicate by their text: repeated prompts and answers are real turns.
      const key = node.parentElement?.id || node.closest('[data-plane-row]')?.getAttribute('data-plane-row');
      if (!key) continue;
      keys.push(key);
      if (!this.sources.has(key)) {
        try {
          this.sources.set(key, await readGrokSources(node));
        } catch (error) {
          this.loadingWarnings.push(`Grok: Could not collect the source list for ${key}: ${(error as Error).message}`);
          this.sources.set(key, '');
        }
      }
      // Keep the parent too: legacy Grok roles are marked by sibling buttons.
      const parent = node.parentElement!.cloneNode(true) as HTMLElement;
      const snapshot = parent.querySelector<HTMLElement>('.message-bubble')!;
      snapshot.querySelectorAll('.thinking-container, [role="button"][aria-label$=" sources"], [role="button"][aria-label$=" source"]').forEach(ui => ui.remove());
      snapshot.insertAdjacentHTML('beforeend', this.sources.get(key)!);
      this.collected.set(key, snapshot);
    }
    this.order = mergeTurnOrder(this.order, keys);
  }

  /**
   * Convert all rendered Mermaid SVG diagrams to code blocks
   *
   * Grok renders Mermaid natively, replacing source with SVG.
   * Clicking "원본 보기" button reveals the original code.
   *
   * Waits for DOM changes to complete after clicking.
   */
  private async convertAllMermaidToCodeBlocks(): Promise<void> {
    // Find all rendered Mermaid containers on the page
    // Selector: .group\/mermaid (escaped for CSS, actual class is "group/mermaid")
    const mermaidContainers = document.querySelectorAll('.group\\/mermaid');

    if (mermaidContainers.length === 0) {
      return;
    }

    // Click all "원본 보기" buttons
    mermaidContainers.forEach((container) => {
      const viewSourceBtn = container.querySelector(
        'button[aria-label="원본 보기"]'
      ) as HTMLElement | null;

      if (viewSourceBtn) {
        viewSourceBtn.click();
      }
    });

    // Wait for React to update the DOM
    // A small delay is needed for state changes to propagate
    await new Promise((resolve) => setTimeout(resolve, 100));
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
