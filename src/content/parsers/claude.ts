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
import type { ScrollOptions } from '../scroller';
import type { ArtifactData, ProjectInfo } from './interface';

/** Selector for the project breadcrumb link shown above chats that belong to a project */
const PROJECT_LINK_SELECTOR = 'a[href^="/cowork/project/"]';

/**
 * Selector for visualization iframes embedded in an assistant message.
 * Scoped to the message node at query time, so page-level iframes
 * (analytics and similar) are never matched.
 */
const VISUALIZATION_SELECTOR = 'iframe[title]';

/** Parse a list-position attribute into a number, or null when it is not one */
function toIndex(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  /**
   * Messages captured while scrolling, keyed by their position in the list
   *
   * Cloned on capture: the live node is unmounted as soon as it leaves the
   * viewport, so only a detached copy survives to the end of the export.
   */
  private readonly collected = new Map<number, HTMLElement>();

  constructor() {
    super('claude');
  }

  /**
   * Load all messages, collecting them as the conversation scrolls past
   *
   * Overrides base to:
   * 1. Snapshot the mounted messages at every scroll stop (virtualization)
   * 2. Click the last "Preview contents" button, which loads the artifact panel
   */
  override async loadAllMessages(options: ScrollOptions = {}): Promise<void> {
    this.collected.clear();

    await super.loadAllMessages({
      ...options,
      onStep: () => {
        this.snapshotMountedMessages();
        options.onStep?.();
      },
    });

    this.warnIfIncomplete();
    await this.openLatestArtifact();
  }

  /**
   * Copy every currently mounted message into the collection
   *
   * Called at each scroll stop. Messages already collected are left alone, so
   * the first (most complete) capture of a message wins and re-visiting a
   * scroll position costs nothing.
   *
   * @private
   */
  private snapshotMountedMessages(): void {
    for (const node of super.getMessageNodes()) {
      const index = this.getListIndex(node);
      if (index === null || this.collected.has(index)) {
        continue;
      }
      this.collected.set(index, node.cloneNode(true) as HTMLElement);
    }
  }

  /**
   * Read a message's position in the virtualized list
   *
   * Claude wraps each message in the list machinery's own element:
   *   <div data-rs-index="1" data-index="1">
   *     <div role="article" aria-setsize="2" aria-posinset="2"> ... </div>
   *
   * `data-index` is preferred over `aria-posinset` so a document never mixes
   * 0-based and 1-based keys, which would interleave the merged order.
   *
   * @private
   * @returns The list index, or null when the DOM carries no position
   */
  private getListIndex(node: HTMLElement): number | null {
    const indexed = node.closest('[data-index], [data-rs-index]');
    if (indexed) {
      return toIndex(
        indexed.getAttribute('data-index') ?? indexed.getAttribute('data-rs-index')
      );
    }

    const article = node.closest('[aria-posinset]');
    return article ? toIndex(article.getAttribute('aria-posinset')) : null;
  }

  /**
   * Warn when the list says it holds more messages than were collected
   *
   * Claude publishes the conversation's true length on every message
   * (`aria-setsize`), which is the only way to tell a short conversation apart
   * from a long one that failed to load.
   *
   * @private
   */
  private warnIfIncomplete(): void {
    const sizes = Array.from(document.querySelectorAll('[aria-setsize]'), (el) =>
      Number(el.getAttribute('aria-setsize'))
    ).filter((n) => Number.isFinite(n) && n > 0);

    if (sizes.length === 0) {
      return;
    }

    const expected = Math.max(...sizes);
    const collected = this.getMessageNodes().length;

    if (collected < expected) {
      console.warn(
        `Claude: collected ${collected} of ${expected} messages. ` +
          'The rest never mounted while scrolling - scroll through the ' +
          'conversation manually and export again.'
      );
    }
  }

  /**
   * Get all message nodes, merging what was collected while scrolling
   *
   * Live nodes take precedence over their snapshots (same content, but still
   * attached), and everything is ordered by list index rather than by the
   * order it happened to be collected in.
   *
   * Falls back to the live nodes whenever the DOM carries no list indices, so
   * DOM shapes this parser does not recognise behave exactly as before.
   *
   * @override
   */
  override getMessageNodes(): HTMLElement[] {
    const live = super.getMessageNodes();
    if (this.collected.size === 0) {
      return live;
    }

    const merged = new Map(this.collected);
    for (const node of live) {
      const index = this.getListIndex(node);
      if (index === null) {
        // Unknown shape: reordering would be a guess, so return the DOM as-is
        return live;
      }
      merged.set(index, node);
    }

    return Array.from(merged.entries())
      .sort(([a], [b]) => a - b)
      .map(([, node]) => node);
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
   * Get project info for the current conversation
   *
   * Unlike ChatGPT, Claude project chats share the same /chat/<uuid> URL as
   * regular chats, so the only signal is a breadcrumb link
   * (`<a href="/cowork/project/<uuid>">Project Name</a>`) rendered above the
   * chat when it belongs to a project. Absent for regular chats.
   *
   * @returns ProjectInfo if this conversation belongs to a project, null otherwise
   */
  getProjectInfo(): ProjectInfo | null {
    const link = document.querySelector(PROJECT_LINK_SELECTOR);
    if (!link) {
      return null;
    }

    const href = link.getAttribute('href') || '';
    const id = href.replace('/cowork/project/', '').trim();
    const name = link.textContent?.trim();

    if (!id || !name) {
      return null;
    }

    return { id, name };
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
   * It may also contain a visualization rendered in an iframe.
   *
   * This override:
   * 1. Finds all content elements matching selector, plus visualization iframes
   * 2. Filters out elements inside collapsed containers
   * 3. Concatenates visible content in document order
   *
   * @override
   * @protected
   */
  protected override extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    // User messages don't have this complexity, use base implementation
    if (role === 'user') {
      return super.extractContent(node, role);
    }

    // Querying both in one call keeps them in document order, so a
    // visualization stays between the paragraphs it was rendered between.
    const selector = this.selectors.content[role];
    const elements = node.querySelectorAll(`${selector}, ${VISUALIZATION_SELECTOR}`);

    const visibleContent: string[] = [];
    for (const el of elements) {
      if (this.isInCollapsedBlock(el as HTMLElement)) {
        continue;
      }
      visibleContent.push(
        el.tagName === 'IFRAME'
          ? this.buildVisualizationPlaceholder(el as HTMLIFrameElement)
          : el.innerHTML
      );
    }

    return visibleContent.join('\n');
  }

  /**
   * Build a placeholder standing in for a visualization iframe
   *
   * Claude renders visualizations inside a sandboxed cross-origin iframe
   * (<hash>.claudemcpcontent.com), so `contentDocument` is null and the
   * rendered content cannot be read by a content script — this is a hard
   * browser security boundary, not something a better selector can solve.
   * The iframe's title is readable from the parent page, so the export at
   * least records that a visualization was present and what it depicted.
   *
   * @private
   */
  private buildVisualizationPlaceholder(iframe: HTMLIFrameElement): string {
    const rawTitle = iframe.getAttribute('title')?.trim() || '';
    // Titles arrive as "visualize: <description>"; the tool name is noise
    const title = rawTitle.replace(/^visualize:\s*/i, '');

    const p = document.createElement('p');
    // Marks this as a literal placeholder so the converter emits it verbatim
    // instead of escaping the brackets into \[Visualization: ...\]
    p.setAttribute('data-export-placeholder', '');
    p.textContent = title ? `[Visualization: ${title}]` : '[Visualization]';
    return p.outerHTML;
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
