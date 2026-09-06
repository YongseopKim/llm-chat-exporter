/**
 * ChatGPT Parser
 *
 * Implements ChatParser interface for chatgpt.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure (from samples/README.md):
 * - Messages: [data-message-author-role] or [data-turn]
 * - User content: .whitespace-pre-wrap, or .markdown for rich pasted content
 * - Assistant content: .markdown
 * - Generating: button[aria-label*="Stop"]
 *
 * Role Strategy: attribute (data-message-author-role, data-turn)
 *
 * @see config/selectors.json for current selectors
 * @see samples/README.md for validated selectors and DOM analysis
 */

import { BaseParser } from './base-parser';
import type { ScrollOptions } from '../scroller';
import type { ProjectInfo } from './interface';

/**
 * Matches ChatGPT project chat URLs. The trailing name slug is optional —
 * both /g/g-p-<hash>-<slug>/c/<uuid> and /g/g-p-<hash>/c/<uuid> occur in
 * practice (the latter is what the app serves when navigating in-app).
 */
const PROJECT_PATH_PATTERN = /^\/g\/(g-p-[0-9a-f]+)(?:-([^/]+))?\//;

/**
 * ChatGPT's one-based position marker for a visible conversation turn
 *
 * Only a position within what is currently loaded, NOT an identity: loading
 * older history renumbers every turn already on screen (see `getTurnKey`).
 */
const TURN_TEST_ID_PATTERN = /^conversation-turn-(\d+)$/;

/**
 * Merge a newly observed run of turn keys into the conversation order
 *
 * A virtualized walk never sees the whole conversation at once, and the
 * position markers it does see are not stable, so order has to be recovered
 * from how the mounted windows overlap: consecutive windows share turns, and
 * those shared turns pin the new ones into place. Keys that neither sequence
 * has in common are placed incoming-first, because the walk runs backwards
 * through the conversation and anything genuinely new is therefore older.
 *
 * @param existing - Order recovered so far, oldest first
 * @param incoming - Keys of one mounted window, in DOM order
 * @returns The merged order, with each key appearing once
 */
function mergeTurnOrder(existing: string[], incoming: string[]): string[] {
  if (existing.length === 0) {
    return [...incoming];
  }

  const known = new Set(existing);
  const merged: string[] = [];
  let i = 0;
  let j = 0;

  while (i < existing.length || j < incoming.length) {
    if (j >= incoming.length) {
      merged.push(existing[i]);
      i += 1;
    } else if (i >= existing.length || !known.has(incoming[j])) {
      merged.push(incoming[j]);
      j += 1;
    } else if (existing[i] === incoming[j]) {
      merged.push(existing[i]);
      i += 1;
      j += 1;
    } else {
      merged.push(existing[i]);
      i += 1;
    }
  }

  const seen = new Set<string>();
  return merged.filter((key) => {
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * ChatGPT platform parser
 *
 * Configuration-driven parser using BaseParser infrastructure.
 * All parsing logic is inherited from BaseParser with chatgpt configuration.
 */
export class ChatGPTParser extends BaseParser {
  /**
   * Turns captured while walking a virtualized conversation, keyed by an
   * identity that survives older history loading (see `getTurnKey`).
   *
   * ChatGPT keeps the first and newest turns mounted but unmounts long middle
   * stretches. Detached clones are therefore required: a final DOM read after
   * scrolling cannot recover the turns that disappeared again.
   */
  private readonly collected = new Map<string, HTMLElement>();

  /** Conversation order of every collected key, oldest first */
  private order: string[] = [];

  constructor() {
    super('chatgpt');
  }

  /**
   * Load and snapshot every mounted window of a virtualized conversation.
   */
  override async loadAllMessages(options: ScrollOptions = {}): Promise<void> {
    this.collected.clear();
    this.order = [];

    await super.loadAllMessages({
      ...options,
      onStep: async () => {
        this.snapshotMountedMessages();
        await options.onStep?.();
      },
    });
  }

  /**
   * Get project info for the current conversation
   *
   * ChatGPT project chats live under /g/g-p-<hash>/c/<uuid> (optionally with
   * a -<slug> after the hash), unlike regular chats (/c/<uuid>). The project
   * id comes from the URL. The exact display name isn't exposed anywhere in
   * the DOM (sidebar project entries are buttons with no href), so it's read
   * from document.title, which the app renders as "{ProjectName} -
   * {ChatTitle}" once hydrated. If the title hasn't updated yet, falls back
   * to the URL slug (lossy, ASCII-only) or finally the id itself.
   *
   * @returns ProjectInfo if this conversation belongs to a project, null otherwise
   */
  getProjectInfo(): ProjectInfo | null {
    const match = document.location.pathname.match(PROJECT_PATH_PATTERN);
    if (!match) {
      return null;
    }

    const [, id, slug] = match;
    const separatorIndex = document.title.indexOf(' - ');
    const name =
      separatorIndex > 0 ? document.title.slice(0, separatorIndex).trim() : slug || id;

    return { id, name };
  }

  /**
   * Get message nodes, dropping turns that carry no message at all
   *
   * Selecting by [data-turn] (needed to catch image-generation turns, which
   * have no [data-message-author-role] descendant) also picks up scaffold
   * sections whose only text is the sr-only "ChatGPT의 말:" heading. Those
   * aren't messages, so they're filtered out here.
   *
   * Note this only drops turns with no content element AND no image — a turn
   * that has an empty .markdown is still exported as an empty message, per
   * the project's "keep empty assistant messages" decision.
   */
  override getMessageNodes(): HTMLElement[] {
    const live = this.getLiveMessageNodes();
    if (this.collected.size === 0) {
      return live;
    }

    const merged = new Map(this.collected);
    const liveKeys: string[] = [];
    for (const node of live) {
      const key = this.getTurnKey(node);
      if (key === null) {
        // Unknown DOM shape: returning the live DOM is safer than guessing an
        // order that could silently interleave unrelated messages.
        return live;
      }
      liveKeys.push(key);
      merged.set(key, node);
    }

    return mergeTurnOrder(this.order, liveKeys)
      .map((key) => merged.get(key))
      .filter((node): node is HTMLElement => node !== undefined);
  }

  /** Return currently mounted, non-scaffold ChatGPT turns. */
  private getLiveMessageNodes(): HTMLElement[] {
    return super.getMessageNodes().filter((node) => this.hasExportableContent(node));
  }

  /** Clone newly mounted turns before ChatGPT unmounts them again. */
  private snapshotMountedMessages(): void {
    const keys: string[] = [];

    for (const node of this.getLiveMessageNodes()) {
      const key = this.getTurnKey(node);
      if (key === null) {
        // Nothing identifies this window, so it cannot be merged into the
        // order; the live DOM is what getMessageNodes falls back to.
        return;
      }
      keys.push(key);
      if (!this.collected.has(key)) {
        this.collected.set(key, node.cloneNode(true) as HTMLElement);
      }
    }

    this.order = mergeTurnOrder(this.order, keys);
  }

  /**
   * Identify a turn in a way that survives older history loading
   *
   * `conversation-turn-N` counts from the oldest turn currently loaded, so
   * paging in older history renumbers every turn already on screen. Measured
   * on 2026-09-06, one message moved from conversation-turn-1 to
   * conversation-turn-7 mid-export while a different message took over
   * conversation-turn-1 - keying snapshots on the number stored that message
   * twice and dropped whatever the old key had held.
   *
   * `data-turn-id` is a per-turn identifier that does not move, so it is
   * preferred. The position is kept only as a fallback for DOM shapes that
   * carry no id, where it behaves exactly as before.
   *
   * @private
   * @returns A stable key, or null when the node carries neither marker
   */
  private getTurnKey(node: HTMLElement): string | null {
    const id = node.closest('[data-turn-id]')?.getAttribute('data-turn-id')?.trim();
    if (id) {
      return `id:${id}`;
    }

    const index = this.getTurnIndex(node);
    return index === null ? null : `position:${index}`;
  }

  /** Read the numeric suffix from `data-testid="conversation-turn-N"`. */
  private getTurnIndex(node: HTMLElement): number | null {
    const turn = node.matches('[data-testid^="conversation-turn-"]')
      ? node
      : node.closest('[data-testid^="conversation-turn-"]');
    const match = turn?.getAttribute('data-testid')?.match(TURN_TEST_ID_PATTERN);
    if (!match) {
      return null;
    }

    const index = Number(match[1]);
    return Number.isSafeInteger(index) ? index : null;
  }

  /**
   * Extract content, adding attached files and falling back to images
   *
   * A user turn whose prompt was long enough to become an attachment holds
   * nothing the content selectors match — measured on 2026-09-06, such a turn
   * had a textContent of 23 characters that was just the file name, and all
   * five user turns in that conversation exported as content: "". The file
   * tile is listed ahead of the body, which is where the page shows it.
   *
   * Image-generation turns contain no .markdown element either. In that case
   * the generated <img> elements are the message content.
   *
   * @override
   * @protected
   */
  protected override extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    const parts = [this.extractAttachmentsHtml(node), super.extractContent(node, role)].filter(
      (part) => part !== ''
    );

    return parts.length > 0 ? parts.join('\n') : this.extractImagesHtml(node);
  }

  /**
   * Build one placeholder per file tile in the turn
   *
   * The tile carries the file name in `aria-label`, and the configured
   * selector points at the icon inside it, so the name is read from the
   * nearest labelled ancestor. Tiles are matched by element rather than by
   * name so two files that happen to share a name both survive.
   *
   * @private
   */
  private extractAttachmentsHtml(node: HTMLElement): string {
    const selector = this.selectors.content.attachment;
    if (!selector) {
      return '';
    }

    const tiles = new Set<Element>();
    node.querySelectorAll(selector).forEach((marker) => {
      const tile = marker.closest('[aria-label]');
      if (tile) {
        tiles.add(tile);
      }
    });

    return Array.from(tiles)
      .map((tile) =>
        this.buildAttachmentPlaceholder((tile.getAttribute('aria-label') || '').trim())
      )
      .join('\n');
  }

  /**
   * Check whether a turn holds anything worth exporting
   *
   * Deliberately does NOT test for the configured content selectors: if
   * ChatGPT renamed those classes this would filter out every message and
   * silently produce an empty export. Instead it asks the weaker, more
   * durable question — is there any image, any attached file, or any text
   * that isn't screen-reader-only scaffolding?
   *
   * @private
   */
  private hasExportableContent(node: HTMLElement): boolean {
    if (node.querySelector('img[src]')) {
      return true;
    }

    const attachment = this.selectors.content.attachment;
    if (attachment && node.querySelector(attachment)) {
      return true;
    }

    // Every ChatGPT turn carries an sr-only "ChatGPT의 말:" style heading;
    // a turn with nothing but that heading is scaffolding, not a message.
    const withoutScreenReaderText = node.cloneNode(true) as HTMLElement;
    withoutScreenReaderText.querySelectorAll('.sr-only').forEach((el) => el.remove());

    return (withoutScreenReaderText.textContent || '').trim() !== '';
  }

  /**
   * Build HTML holding one <img> per unique src found in the node
   *
   * ChatGPT layers several <img> elements with the same src over each other
   * (a scaled blur backdrop, the image itself, an overlay), so emitting them
   * as-is would embed the same picture multiple times. Only one is kept per
   * src, preferring the copy carrying the descriptive alt text.
   *
   * @private
   */
  private extractImagesHtml(node: HTMLElement): string {
    const altBySrc = new Map<string, string>();

    node.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) {
        return;
      }
      const alt = img.getAttribute('alt') || '';
      const existingAlt = altBySrc.get(src);
      if (existingAlt === undefined || alt.length > existingAlt.length) {
        altBySrc.set(src, alt);
      }
    });

    if (altBySrc.size === 0) {
      return '';
    }

    // Build via DOM so src/alt values are escaped correctly
    const container = document.createElement('div');
    for (const [src, alt] of altBySrc) {
      const img = document.createElement('img');
      img.setAttribute('src', src);
      if (alt) {
        img.setAttribute('alt', alt);
      }
      container.appendChild(img);
    }
    return container.innerHTML;
  }
}
