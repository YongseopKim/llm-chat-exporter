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
import type { ArtifactData, Conversation } from './interface';
import { mergeTurnOrder } from './message-order';
import { readGrokSources } from './grok-sources';
import { readGrokFile } from './grok-files';
import { markLineBreaks } from './line-breaks';

/**
 * Name of the file a card in an answer stands for, or null for other buttons
 *
 * Measured on 2026-10-03: `<div role="button" aria-label="<name> 열기">` holding
 * an icon, `<span><name></span><span>문서 · 19.89 KB</span>`, and a
 * `<button aria-label="<name> 다운로드">`. The name is matched in both labels
 * rather than the words around it, which follow the UI language.
 */
function fileCardName(card: Element): string | null {
  const name = card.querySelector('span')?.textContent?.trim();
  if (!name || !(card.getAttribute('aria-label') || '').includes(name)) {
    return null;
  }
  const download = Array.from(card.querySelectorAll('button[aria-label]')).some((button) =>
    button.getAttribute('aria-label')!.includes(name)
  );
  return download ? name : null;
}

/**
 * Turn a prompt line Grok shows as "## Title" text back into the heading typed
 *
 * Grok renders a prompt's lists, tables and links, but leaves "## Title" as
 * plain text, which converted to "\## Title". The typed text is the record.
 */
function restoreTypedHeadings(prompt: HTMLElement): void {
  prompt.querySelectorAll('p').forEach((paragraph) => {
    const first = paragraph.firstChild;
    const marker = first?.nodeType === 3 ? first.textContent?.match(/^(#{1,6}) +/) : null;
    if (!first || !marker) {
      return;
    }
    first.textContent = first.textContent!.slice(marker[0].length);
    const heading = paragraph.ownerDocument.createElement(`h${marker[1].length}`);
    if (paragraph.hasAttribute('data-export-line-breaks')) {
      heading.setAttribute('data-export-line-breaks', '');
    }
    heading.append(...Array.from(paragraph.childNodes));
    paragraph.replaceWith(heading);
  });
}

/**
 * Grok platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * Overrides role extraction to use sibling-button strategy.
 */
export class GrokParser extends BaseParser {
  private readonly collected = new Map<string, HTMLElement>();
  private readonly sources = new Map<string, string>();
  /** Names of the files each message's cards stand for */
  private readonly files = new Map<string, string[]>();
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
    this.files.clear();
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

  /**
   * Read the conversation, then the files its answers wrote to the project
   *
   * A file that cannot be read keeps its `[Artifact: name]` marker and adds a
   * warning: the messages are complete without it.
   */
  override async readConversation(): Promise<Conversation> {
    const conversation = await super.readConversation();
    const artifacts: ArtifactData[] = [];
    const names = new Set(this.order.flatMap((key) => this.files.get(key) ?? []));
    for (const name of names) {
      try {
        artifacts.push(await readGrokFile(name));
      } catch (error) {
        conversation.warnings.push(`Grok: could not read the file "${name}": ${(error as Error).message}`);
      }
    }
    return { ...conversation, artifacts };
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
          const sources = await readGrokSources(node);
          if (sources.listed !== null && sources.collected !== sources.listed) {
            this.loadingWarnings.push(`Grok: Collected ${sources.collected} of the ${sources.listed} sources listed for ${key}.`);
          }
          this.sources.set(key, sources.html);
        } catch (error) {
          this.loadingWarnings.push(`Grok: Could not collect the source list for ${key}: ${(error as Error).message}`);
          this.sources.set(key, '');
        }
      }
      // Keep the parent too: legacy Grok roles are marked by sibling buttons.
      const parent = node.parentElement!.cloneNode(true) as HTMLElement;
      const snapshot = parent.querySelector<HTMLElement>('.message-bubble')!;
      markLineBreaks(node, snapshot);
      snapshot.querySelectorAll('.thinking-container, [role="button"][aria-label$=" sources"], [role="button"][aria-label$=" source"]').forEach(ui => ui.remove());
      this.files.set(key, this.replaceFileCards(snapshot));
      if (this.extractRole(node) === 'user') restoreTypedHeadings(snapshot);
      snapshot.insertAdjacentHTML('beforeend', this.sources.get(key)!);
      this.collected.set(key, snapshot);
    }
    this.order = mergeTurnOrder(this.order, keys);
  }

  /**
   * Replace each file card with an `[Artifact: name]` marker
   *
   * The card's icon is a same-origin image that was inlined as 26 KB of
   * base64, and its size and download labels read as part of the answer. The
   * file itself is exported as an `_artifact` line (see readConversation).
   *
   * @returns The names of the files, in page order
   */
  private replaceFileCards(snapshot: HTMLElement): string[] {
    const names: string[] = [];
    snapshot.querySelectorAll('[role="button"][aria-label]').forEach((card) => {
      const name = fileCardName(card);
      if (!name) return;
      const marker = snapshot.ownerDocument.createElement('span');
      marker.setAttribute('data-export-placeholder', '');
      marker.textContent = `[Artifact: ${name}]`;
      card.replaceWith(marker);
      names.push(name);
    });
    return names;
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
