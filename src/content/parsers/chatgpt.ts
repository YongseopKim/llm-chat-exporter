/**
 * ChatGPT Parser
 *
 * Implements ChatParser interface for chatgpt.com platform.
 * Extends BaseParser with configuration-driven selectors.
 *
 * DOM Structure (legacy samples and current page):
 * - Messages: [data-turn], [data-message-author-role], or
 *   [data-content-search-unit-key] inside [data-turn-key]
 * - User content: .whitespace-pre-wrap, or .markdown for rich pasted content
 * - Assistant content: .markdown or [data-markdown-text-style="assistant-message"]
 * - Generating: button[aria-label*="Stop"]
 *
 * Role Strategy: attributes or the data-content-search-unit-key suffix
 *
 * @see config/selectors.json for current selectors
 * @see samples/README.md for validated selectors and DOM analysis
 */

import { BaseParser } from './base-parser';
import { mergeTurnOrder } from './message-order';
import { readCitationSources, writeCitationSources, type CitationSource } from './chatgpt-citations';
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

/** The container of a prompt the page shows as typed (see extractBodyHtml) */
const TYPED_PROMPT_SELECTOR = '.whitespace-pre-wrap';

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

  private readonly citationSources = new Map<string, CitationSource[]>();
  private readonly citationFailures = new Map<string, { attempts: number; warning: string }>();
  private readonly researchReports = new Map<string, string>();
  private readonly researchByTurn = new Map<string, string[]>();

  constructor() {
    super('chatgpt');
  }

  /** Use the selector that the current page actually renders while scrolling. */
  protected override getMessageSelector(): string | undefined {
    const { primary, fallbacks = [] } = this.selectors.messages;
    return (
      [primary, ...fallbacks].find((selector) => selector && document.querySelector(selector)) ||
      primary
    );
  }

  /** The current DOM stores each message's role at the end of its unit key. */
  protected override extractRole(node: HTMLElement): 'user' | 'assistant' {
    const unitKey = node.getAttribute('data-content-search-unit-key');
    if (unitKey) {
      const role = unitKey.match(/:(user|assistant)$/)?.[1];
      if (role === 'user' || role === 'assistant') {
        return role;
      }
    }
    return super.extractRole(node);
  }

  /**
   * Load and snapshot every mounted window of a virtualized conversation.
   */
  override async loadAllMessages(options: ScrollOptions = {}): Promise<void> {
    this.collected.clear();
    this.order = [];
    this.citationSources.clear();
    this.citationFailures.clear();
    this.researchReports.clear();
    this.researchByTurn.clear();

    await super.loadAllMessages({
      ...options,
      isLoading: options.isLoading || (() => Array.from(document.querySelectorAll('.thread-scroll-container [role="status"]'))
        .some(node => /이전 메시지 불러오는 중|loading (?:earlier|older|previous) messages/i.test(node.textContent || ''))),
      onStep: async () => {
        await this.snapshotMountedMessages();
        await options.onStep?.();
      },
    });
    // A later mounted window can recover a source popup that was unavailable
    // earlier. Report only failures still unresolved after the complete walk.
    this.loadingWarnings.push(...Array.from(this.citationFailures.values(), failure => failure.warning));
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
      if (!merged.has(key)) merged.set(key, node);
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
  private async snapshotMountedMessages(): Promise<void> {
    const keys: string[] = [];
    const live = this.getLiveMessageNodes();
    const researchByNode = new Map<HTMLElement, string[]>();
    const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[title="심층 리서치"], iframe[title="Deep research"], iframe[title="Deep Research"]'));
    const pending = frames.filter(frame => !this.researchReports.has(frame.src));
    if (pending.length) {
      let response;
      try {
        response = await chrome.runtime.sendMessage({ type: 'READ_RESEARCH_FRAMES', urls: pending.map(frame => frame.src) });
      } catch (error) {
        throw new Error(`ChatGPT: could not read the research report: ${(error as Error).message}`);
      }
      if (!response?.success) throw new Error(`ChatGPT: could not read the research report: ${response?.error || 'No frame response.'}`);
      for (const frame of pending) {
        const report = response.reports?.find((value: { frameUrl: string; html: string }) => value.frameUrl === frame.src);
        if (!report?.html?.trim()) throw new Error('ChatGPT: the research report is empty.');
        this.researchReports.set(frame.src, report.html);
      }
    }
    for (const frame of frames) {
      const scope = frame.closest('[data-turn-key], [data-turn-id], [data-turn]');
      const candidates = live.filter(node => scope?.contains(node) && this.extractRole(node) === 'assistant');
      const target = candidates[candidates.length - 1];
      if (!target) throw new Error('ChatGPT: could not associate the research report with its assistant turn.');
      const reports = researchByNode.get(target) || [];
      reports.push(this.researchReports.get(frame.src)!);
      researchByNode.set(target, reports);
    }
    for (const [node, reports] of researchByNode) {
      const key = this.getTurnKey(node);
      if (key === null) throw new Error('ChatGPT: the research report turn has no stable identity.');
      this.researchByTurn.set(key, reports);
    }

    for (const node of live) {
      const key = this.getTurnKey(node);
      if (key === null) {
        // Nothing identifies this window, so it cannot be merged into the
        // order; the live DOM is what getMessageNodes falls back to.
        return;
      }
      keys.push(key);
      const snapshot = node.cloneNode(true) as HTMLElement;
      const reports = this.researchByTurn.get(key);
      if (reports?.length) {
        const body = snapshot.querySelector(this.selectors.content.assistant);
        if (!body) throw new Error('ChatGPT: the research turn has no assistant content container.');
        body.insertAdjacentHTML('beforeend', reports.map(html => `<section data-export-research-report>${html}</section>`).join('\n'));
      }
      const citations = Array.from(node.querySelectorAll<HTMLAnchorElement>('[data-testid="chatgpt-citation"]'));
      const clonedCitations = Array.from(snapshot.querySelectorAll<HTMLAnchorElement>('[data-testid="chatgpt-citation"]'));
      for (const [index, citation] of citations.entries()) {
        const cacheKey = `${key}:citation:${index}:${citation.href}:${citation.getAttribute('aria-label')}`;
        const failure = this.citationFailures.get(cacheKey);
        // Keep successful results only. Allow another mounted-window attempt,
        // but bound persistent failures so a long scroll cannot retry forever.
        if (!this.citationSources.has(cacheKey) && (failure?.attempts || 0) < 2) {
          try {
            this.citationSources.set(cacheKey, await readCitationSources(citation));
            this.citationFailures.delete(cacheKey);
          } catch (error) {
            this.citationFailures.set(cacheKey, {
              attempts: (failure?.attempts || 0) + 1,
              warning: `ChatGPT: Could not collect every source for ${citation.href}: ${(error as Error).message}`,
            });
          }
        }
        const sources = this.citationSources.get(cacheKey) || [];
        if (sources.length) writeCitationSources(clonedCitations[index], sources);
      }
      this.collected.set(key, snapshot);
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
   * Older DOMs carry a stable `data-turn-id`. The current DOM wraps a user
   * and assistant message in one stable `data-turn-key`, so the unit's index
   * and role must be included to keep both messages. The old numeric turn
   * position remains a fallback when neither stable marker exists.
   *
   * @private
   * @returns A key, or null when the node cannot be identified
   */
  private getTurnKey(node: HTMLElement): string | null {
    const unitKey = node.getAttribute('data-content-search-unit-key');
    if (unitKey) {
      // One data-turn-key now wraps both messages. The unit's position and
      // role distinguish them without relying on its renumberable turn index.
      const turnKey = node.closest('[data-turn-key]')?.getAttribute('data-turn-key')?.trim();
      const unit = unitKey.match(/:(\d+):(user|assistant)$/)?.[0];
      return turnKey && unit ? `turn:${turnKey}:unit:${unit}` : null;
    }

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
    const parts = [this.extractAttachmentsHtml(node), this.extractBodyHtml(node, role)].filter(
      (part) => part !== ''
    );

    return parts.length > 0 ? parts.join('\n') : this.extractImagesHtml(node);
  }

  /**
   * Mark a typed prompt so its text is exported as written
   *
   * ChatGPT shows a typed prompt unrendered in `.whitespace-pre-wrap`: its
   * line breaks and Markdown characters are the prompt. Measured on
   * 2026-10-03, a prompt's text held 670 line breaks and the export kept 87,
   * because Markdown conversion collapsed them and escaped "##" and "[".
   * A rich pasted prompt renders as `.markdown` and converts as usual.
   *
   * @private
   */
  private extractBodyHtml(node: HTMLElement, role: 'user' | 'assistant'): string {
    const body = super.extractContent(node, role);
    const element = node.querySelector(this.selectors.content[role]);
    return role === 'user' && body && element?.matches(TYPED_PROMPT_SELECTOR)
      ? `<div data-export-verbatim="">${body}</div>`
      : body;
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
