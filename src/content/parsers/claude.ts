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
import { captureVisualizationIframe } from '../visualization-capture';

/** Selector for the project breadcrumb link shown above chats that belong to a project */
const PROJECT_LINK_SELECTOR = 'a[href^="/cowork/project/"]';

/**
 * How many times the conversation may be walked before giving up
 *
 * A single walk can come up short when the list renders more slowly than the
 * walk moves, and `aria-setsize` is what makes that detectable rather than
 * silent. Retrying is bounded because a message that never mounts will not
 * start mounting on the fifth attempt, and each pass re-scrolls the whole
 * conversation.
 */
const MAX_COLLECTION_PASSES = 3;

/**
 * Selector for visualization iframes embedded in an assistant message.
 * Scoped to the message node at query time, so page-level iframes
 * (analytics and similar) are never matched.
 */
const VISUALIZATION_SELECTOR = 'iframe[title]';
const PENDING_VISUALIZATION_TEXT = 'Connecting to visualize...';
const PENDING_VISUALIZATION_TIMEOUT_MS = 120000;
const EXPORT_PLACEHOLDER_SELECTOR = '[data-export-placeholder]';

/** Claude renders the extra URLs for labels such as "Source + 2" in a portal popup */
const GROUPED_CITATION_PATTERN = /\+\s*\d+\b/;

/** Portal element created while a grouped citation has keyboard focus or pointer hover */
const CITATION_POPUP_SELECTOR = '[role="presentation"][data-open]';

/** A grouped citation popup normally mounts immediately; this only bounds UI drift */
const CITATION_POPUP_TIMEOUT_MS = 500;

interface CitationSource {
  href: string;
  title: string;
}

interface CitationGroup {
  triggerHref: string;
  triggerText: string;
  sources: CitationSource[];
}

export type VisualizationCapture = (iframe: HTMLIFrameElement) => Promise<string | null>;
export type PendingVisualizationWaitResult = 'iframe' | 'resolved' | 'timeout';
export type PendingVisualizationWait = (
  node: HTMLElement
) => Promise<PendingVisualizationWaitResult>;

/** Find Claude's visible pre-iframe connection row without matching its ancestors. */
function findPendingVisualizationLabel(node: HTMLElement): HTMLElement | null {
  return (
    Array.from(node.querySelectorAll<HTMLElement>('*')).find(
      (element) =>
        element.childElementCount === 0 &&
        (element.textContent || '').trim() === PENDING_VISUALIZATION_TEXT
    ) || null
  );
}

/** Wait once for Claude to replace its connection row with a visualization iframe. */
export function waitForPendingVisualization(
  node: HTMLElement,
  timeoutMs = PENDING_VISUALIZATION_TIMEOUT_MS
): Promise<PendingVisualizationWaitResult> {
  if (node.querySelector(VISUALIZATION_SELECTOR)) {
    return Promise.resolve('iframe');
  }
  if (!findPendingVisualizationLabel(node)) {
    return Promise.resolve('resolved');
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PendingVisualizationWaitResult) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(result);
    };
    const observer = new MutationObserver(() => {
      if (node.querySelector(VISUALIZATION_SELECTOR)) {
        finish('iframe');
      } else if (!findPendingVisualizationLabel(node)) {
        finish('resolved');
      }
    });
    const timer = window.setTimeout(() => finish('timeout'), timeoutMs);
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  });
}

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

  /** Grouped citation data captured while its message was mounted */
  private readonly citationGroupsByIndex = new Map<number, CitationGroup[]>();

  /** Citation data for non-virtualized DOM shapes that carry no list index */
  private citationGroupsByNode = new WeakMap<HTMLElement, CitationGroup[]>();

  /** Preserve a collected clone's original list index without changing its HTML */
  private collectedIndices = new WeakMap<HTMLElement, number>();

  /** Captured PNG data URIs, in iframe order, for indexed messages. */
  private readonly visualizationCapturesByIndex = new Map<number, string[]>();

  /** Captured PNG data URIs for non-virtualized messages without list indices. */
  private visualizationCapturesByNode = new WeakMap<HTMLElement, string[]>();

  /** Positions already attempted, including failures, so scroll steps cannot retry forever. */
  private readonly visualizationAttemptsByIndex = new Map<number, Set<number>>();
  private visualizationAttemptsByNode = new WeakMap<HTMLElement, Set<number>>();

  /** Messages whose pre-iframe connection row has already been awaited. */
  private readonly pendingVisualizationWaitsByIndex = new Set<number>();
  private pendingVisualizationWaitsByNode = new WeakSet<HTMLElement>();

  constructor(
    private readonly captureVisualization: VisualizationCapture = captureVisualizationIframe,
    private readonly waitForPending: PendingVisualizationWait = waitForPendingVisualization
  ) {
    super('claude');
  }

  /**
   * Load all messages, collecting them as the conversation scrolls past
   *
   * Overrides base to:
   * 1. Snapshot the mounted messages at every scroll stop (virtualization)
   * 2. Walk the list again while it still holds messages that were missed
   * 3. Click the last "Preview contents" button, which loads the artifact panel
   */
  override async loadAllMessages(options: ScrollOptions = {}): Promise<void> {
    this.collected.clear();
    this.citationGroupsByIndex.clear();
    this.visualizationCapturesByIndex.clear();
    this.visualizationAttemptsByIndex.clear();
    this.pendingVisualizationWaitsByIndex.clear();
    this.citationGroupsByNode = new WeakMap();
    this.visualizationCapturesByNode = new WeakMap();
    this.visualizationAttemptsByNode = new WeakMap();
    this.pendingVisualizationWaitsByNode = new WeakSet();
    this.collectedIndices = new WeakMap();

    for (let pass = 0; pass < MAX_COLLECTION_PASSES; pass += 1) {
      const before = this.collected.size;

      await super.loadAllMessages({
        ...options,
        onStep: async () => {
          await this.captureMountedGroupedCitations();
          await this.captureMountedVisualizations();
          this.snapshotMountedMessages();
          await options.onStep?.();
        },
      });

      const expected = this.getAdvertisedLength();
      if (expected === null || this.collected.size >= expected) {
        break;
      }
      // A pass that gained nothing will gain nothing next time either; stopping
      // here keeps a genuinely unreachable message from costing another walk.
      if (this.collected.size === before) {
        break;
      }
    }

    this.warnIfIncomplete();
    await this.openLatestArtifact();
  }

  /**
   * How many messages the list says the conversation holds
   *
   * Claude publishes the conversation's true length on every message
   * (`aria-setsize`), which is the only signal that distinguishes a short
   * conversation from a long one that failed to load.
   *
   * @private
   * @returns The advertised length, or null when the DOM does not carry one
   */
  private getAdvertisedLength(): number | null {
    const sizes = Array.from(document.querySelectorAll('[aria-setsize]'), (el) =>
      Number(el.getAttribute('aria-setsize'))
    ).filter((n) => Number.isFinite(n) && n > 0);

    return sizes.length === 0 ? null : Math.max(...sizes);
  }

  /** Capture each mounted visualization before virtualization can unmount it. */
  private async captureMountedVisualizations(): Promise<void> {
    for (const node of super.getMessageNodes()) {
      if (node.getAttribute('data-testid') === 'user-message') {
        continue;
      }

      let iframes = Array.from(
        node.querySelectorAll<HTMLIFrameElement>(VISUALIZATION_SELECTOR)
      );
      const index = this.getListIndex(node);

      if (
        iframes.length === 0 &&
        findPendingVisualizationLabel(node) &&
        !this.hasWaitedForPendingVisualization(node, index)
      ) {
        this.markPendingVisualizationWaited(node, index);
        const result = await this.waitForPending(node);
        if (result === 'timeout') {
          this.markPendingVisualizationTimedOut(node);
        }
        iframes = Array.from(
          node.querySelectorAll<HTMLIFrameElement>(VISUALIZATION_SELECTOR)
        );
      }

      if (iframes.length === 0) {
        continue;
      }

      const captures =
        index === null
          ? this.visualizationCapturesByNode.get(node) || []
          : this.visualizationCapturesByIndex.get(index) || [];
      const attempts =
        index === null
          ? this.visualizationAttemptsByNode.get(node) || new Set<number>()
          : this.visualizationAttemptsByIndex.get(index) || new Set<number>();

      for (let position = 0; position < iframes.length; position += 1) {
        if (attempts.has(position)) {
          continue;
        }
        attempts.add(position);
        const png = await this.captureVisualization(iframes[position]);
        if (png) {
          captures[position] = png;
        }
      }

      if (index === null) {
        this.visualizationCapturesByNode.set(node, captures);
        this.visualizationAttemptsByNode.set(node, attempts);
      } else {
        this.visualizationCapturesByIndex.set(index, captures);
        this.visualizationAttemptsByIndex.set(index, attempts);
      }
    }
  }

  private hasWaitedForPendingVisualization(
    node: HTMLElement,
    index: number | null
  ): boolean {
    return index === null
      ? this.pendingVisualizationWaitsByNode.has(node)
      : this.pendingVisualizationWaitsByIndex.has(index);
  }

  private markPendingVisualizationWaited(node: HTMLElement, index: number | null): void {
    if (index === null) {
      this.pendingVisualizationWaitsByNode.add(node);
    } else {
      this.pendingVisualizationWaitsByIndex.add(index);
    }
  }

  private markPendingVisualizationTimedOut(node: HTMLElement): void {
    const label = findPendingVisualizationLabel(node);
    if (!label) return;
    label.setAttribute('data-export-placeholder', '');
    label.textContent = '[Visualization: loading timed out]';
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
      if (index === null) {
        continue;
      }
      const existing = this.collected.get(index);
      if (existing) {
        const existingVisualizations = existing.querySelectorAll(VISUALIZATION_SELECTOR).length;
        const liveVisualizations = node.querySelectorAll(VISUALIZATION_SELECTOR).length;
        if (liveVisualizations <= existingVisualizations) {
          continue;
        }
      }
      const clone = node.cloneNode(true) as HTMLElement;
      this.collectedIndices.set(clone, index);
      this.collected.set(index, clone);
    }
  }

  /**
   * Open each mounted "Source + N" citation and retain every URL from its
   * portal popup before virtualization unmounts the message.
   *
   * Claude keeps only the first URL inside the message. The remaining links
   * live under #portal-root and exist only while the trigger is active, so
   * cloning the message alone can never preserve them.
   */
  private async captureMountedGroupedCitations(): Promise<void> {
    for (const node of super.getMessageNodes()) {
      if (node.getAttribute('data-testid') === 'user-message') {
        continue;
      }

      const groupedLinks = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
        (anchor) => GROUPED_CITATION_PATTERN.test(anchor.textContent || '')
      );

      if (groupedLinks.length === 0) {
        continue;
      }

      const index = this.getListIndex(node);
      const groups = this.getStoredCitationGroups(node, index);
      const captured = new Set(groups.map((group) => this.citationGroupKey(group)));

      for (const anchor of groupedLinks) {
        const triggerHref = this.normalizeCitationUrl(anchor.getAttribute('href'));
        const triggerText = (anchor.textContent || '').trim().replace(/\s+/g, ' ');
        if (!triggerHref || !triggerText) {
          continue;
        }

        const key = `${triggerHref}\n${triggerText}`;
        if (captured.has(key)) {
          continue;
        }

        const sources = await this.readGroupedCitationPopup(anchor, triggerHref);
        if (sources.length === 0) {
          continue;
        }

        groups.push({ triggerHref, triggerText, sources });
        captured.add(key);
      }

      this.storeCitationGroups(node, index, groups);
    }
  }

  /** Read one grouped citation popup without following any of its links. */
  private async readGroupedCitationPopup(
    anchor: HTMLAnchorElement,
    triggerHref: string
  ): Promise<CitationSource[]> {
    this.dispatchCitationHover(anchor, true);
    anchor.focus({ preventScroll: true });
    const popup = await this.waitForCitationPopup(triggerHref);

    const sources = popup
      ? Array.from(popup.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .map((source) => {
            const href = this.normalizeCitationUrl(source.getAttribute('href'));
            const title = (
              source.querySelector('h3')?.textContent ||
              source.textContent ||
              href ||
              ''
            )
              .trim()
              .replace(/\s+/g, ' ');
            return href && title ? { href, title } : null;
          })
          .filter((source): source is CitationSource => source !== null)
      : [];

    anchor.blur();
    this.dispatchCitationHover(anchor, false);
    return Array.from(new Map(sources.map((source) => [source.href, source])).values());
  }

  /**
   * Reproduce the pointer boundary events Claude uses to mount preview cards.
   * These do not click the anchor or follow its URL.
   */
  private dispatchCitationHover(anchor: HTMLAnchorElement, entering: boolean): void {
    const eventTypes = entering
      ? ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']
      : ['pointerout', 'pointerleave', 'mouseout', 'mouseleave'];

    for (const type of eventTypes) {
      anchor.dispatchEvent(
        new MouseEvent(type, {
          bubbles: type.endsWith('over') || type.endsWith('out'),
          cancelable: true,
          composed: true,
        })
      );
    }
  }

  /** Wait until the portal popup containing the trigger's primary URL is mounted. */
  private waitForCitationPopup(triggerHref: string): Promise<HTMLElement | null> {
    const findPopup = (): HTMLElement | null => {
      for (const candidate of document.querySelectorAll<HTMLElement>(CITATION_POPUP_SELECTOR)) {
        const containsTrigger = Array.from(
          candidate.querySelectorAll<HTMLAnchorElement>('a[href]')
        ).some((link) => this.normalizeCitationUrl(link.getAttribute('href')) === triggerHref);
        if (containsTrigger) {
          return candidate;
        }
      }
      return null;
    };

    const immediate = findPopup();
    if (immediate) {
      return Promise.resolve(immediate);
    }

    return new Promise((resolve) => {
      let finished = false;
      const finish = (popup: HTMLElement | null) => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timer);
        observer.disconnect();
        resolve(popup);
      };
      const observer = new MutationObserver(() => {
        const popup = findPopup();
        if (popup) {
          finish(popup);
        }
      });
      const timer = setTimeout(() => finish(null), CITATION_POPUP_TIMEOUT_MS);

      observer.observe(document.body, { childList: true, subtree: true, attributes: true });

      const popup = findPopup();
      if (popup) {
        finish(popup);
      }
    });
  }

  /** Convert a citation href to a comparable absolute HTTP(S) URL. */
  private normalizeCitationUrl(raw: string | null): string | null {
    if (!raw) {
      return null;
    }

    try {
      const url = new URL(raw, document.baseURI);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  private citationGroupKey(group: CitationGroup): string {
    return `${group.triggerHref}\n${group.triggerText}`;
  }

  private getStoredCitationGroups(
    node: HTMLElement,
    index: number | null
  ): CitationGroup[] {
    return index === null
      ? [...(this.citationGroupsByNode.get(node) || [])]
      : [...(this.citationGroupsByIndex.get(index) || [])];
  }

  private storeCitationGroups(
    node: HTMLElement,
    index: number | null,
    groups: CitationGroup[]
  ): void {
    if (index === null) {
      this.citationGroupsByNode.set(node, groups);
    } else {
      this.citationGroupsByIndex.set(index, groups);
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
    const expected = this.getAdvertisedLength();
    if (expected === null) {
      return;
    }

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
   * Live nodes normally take precedence over their snapshots because they are
   * still attached. A snapshot with more visualization iframes is retained,
   * since Claude can unmount an iframe without unmounting its message. Everything
   * is ordered by list index rather than by collection order.
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
      const snapshot = merged.get(index);
      if (
        snapshot &&
        snapshot.querySelectorAll(VISUALIZATION_SELECTOR).length >
          node.querySelectorAll(VISUALIZATION_SELECTOR).length
      ) {
        continue;
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
    const elements = node.querySelectorAll(
      `${selector}, ${VISUALIZATION_SELECTOR}, ${EXPORT_PLACEHOLDER_SELECTOR}`
    );

    const visibleContent: string[] = [];
    for (const el of elements) {
      if (this.isInCollapsedBlock(el as HTMLElement)) {
        continue;
      }
      if (el.tagName === 'IFRAME') {
        visibleContent.push(this.buildVisualizationContent(node, el as HTMLIFrameElement));
      } else if ((el as HTMLElement).matches(EXPORT_PLACEHOLDER_SELECTOR)) {
        visibleContent.push((el as HTMLElement).outerHTML);
      } else {
        visibleContent.push(el.innerHTML);
      }
    }

    const additionalCitations = this.getAdditionalCitationSources(node);
    if (additionalCitations.length > 0) {
      visibleContent.push(this.buildAdditionalCitationSources(additionalCitations));
    }

    return visibleContent.join('\n');
  }

  /** Emit the captured PNG when available, otherwise retain the explicit marker. */
  private buildVisualizationContent(node: HTMLElement, iframe: HTMLIFrameElement): string {
    const position = Array.from(node.querySelectorAll(VISUALIZATION_SELECTOR)).indexOf(iframe);
    const index = this.getListIndex(node) ?? this.collectedIndices.get(node) ?? null;
    const captures =
      index === null
        ? this.visualizationCapturesByNode.get(node)
        : this.visualizationCapturesByIndex.get(index);
    const png = position >= 0 ? captures?.[position] : undefined;
    if (!png) {
      return this.buildVisualizationPlaceholder(iframe);
    }

    const rawTitle = iframe.getAttribute('title')?.trim() || '';
    const title = rawTitle.replace(/^visualize:\s*/i, '') || 'Visualization';
    const image = document.createElement('img');
    image.setAttribute('src', png);
    image.setAttribute('alt', title);
    return image.outerHTML;
  }

  /** Return popup URLs that do not already exist anywhere in the message. */
  private getAdditionalCitationSources(node: HTMLElement): CitationSource[] {
    const index = this.getListIndex(node) ?? this.collectedIndices.get(node) ?? null;
    const groups =
      index === null
        ? this.citationGroupsByNode.get(node) || []
        : this.citationGroupsByIndex.get(index) || [];
    if (groups.length === 0) {
      return [];
    }

    const knownUrls = new Set(
      Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .map((anchor) => this.normalizeCitationUrl(anchor.getAttribute('href')))
        .filter((href): href is string => href !== null)
    );
    const additional: CitationSource[] = [];

    for (const group of groups) {
      for (const source of group.sources) {
        if (knownUrls.has(source.href)) {
          continue;
        }
        knownUrls.add(source.href);
        additional.push(source);
      }
    }

    return additional;
  }

  /** Build clearly labelled HTML for links recovered from Claude's portal. */
  private buildAdditionalCitationSources(sources: CitationSource[]): string {
    const section = document.createElement('div');
    section.setAttribute('data-export-additional-citations', '');

    const label = document.createElement('p');
    label.textContent = 'LLM Chat Exporter: additional citation sources hidden by Claude';
    section.appendChild(label);

    const list = document.createElement('ul');
    for (const source of sources) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = source.href;
      link.textContent = source.title;
      item.appendChild(link);
      list.appendChild(item);
    }
    section.appendChild(list);

    return section.outerHTML;
  }

  /**
   * Build a placeholder standing in for a visualization iframe
   *
   * Claude renders visualizations inside a sandboxed cross-origin iframe
   * (<hash>.claudemcpcontent.com), so `contentDocument` is null. The exporter
   * normally captures its rendered pixels through captureVisibleTab(). This
   * marker remains the honest fallback when the iframe is clipped, oversized,
   * still loading, or the active tab changes during export.
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
