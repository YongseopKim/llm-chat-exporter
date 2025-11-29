/**
 * ChatGPT Parser
 *
 * Implements ChatParser interface for chatgpt.com platform.
 *
 * DOM Structure (from samples/README.md):
 * - Messages: [data-message-author-role] or [data-turn]
 * - User content: .whitespace-pre-wrap
 * - Assistant content: .markdown
 * - Generating: button[aria-label*="Stop"]
 *
 * @see samples/README.md for validated selectors and DOM analysis
 */

import type { ChatParser, ParsedMessage } from './interface';
import { scrollToLoadAll } from '../scroller';

/**
 * ChatGPT platform parser
 *
 * Parses conversations from chatgpt.com using validated DOM selectors.
 * Implements fallback selector chains for resilience against DOM changes.
 */
export class ChatGPTParser implements ChatParser {
  /**
   * Selector priority chain for finding message nodes
   * Ordered from most stable to least stable
   */
  private static readonly MESSAGE_SELECTORS = [
    '[data-message-author-role]', // Primary: Most stable data attribute
    '[data-turn]', // Secondary: Also stable, alternative attribute
    'article[data-testid^="conversation"]', // Tertiary: Structural fallback
  ] as const;

  /**
   * Content selectors by message role
   */
  private static readonly CONTENT_SELECTORS = {
    user: '.whitespace-pre-wrap',
    assistant: '.markdown',
  } as const;

  /**
   * Selector for detecting active generation
   */
  private static readonly GENERATING_SELECTOR = 'button[aria-label*="Stop"]' as const;
  /**
   * Check if this parser can handle the given hostname
   *
   * @param hostname - The hostname to check (e.g., 'chatgpt.com', 'www.chatgpt.com')
   * @returns true if hostname contains 'chatgpt.com', false otherwise
   *
   * @example
   * parser.canHandle('chatgpt.com') // true
   * parser.canHandle('claude.ai') // false
   */
  canHandle(hostname: string): boolean {
    if (!hostname) {
      return false;
    }

    const normalizedHostname = hostname.toLowerCase();
    return normalizedHostname.includes('chatgpt.com');
  }

  /**
   * Load all messages into DOM
   *
   * ChatGPT doesn't aggressively virtualize messages, so simple scroll to top is sufficient.
   * Based on Phase 3 validation results showing no additional messages load via scrolling.
   *
   * @throws {Error} If response is currently being generated
   *
   * @example
   * await parser.loadAllMessages(); // Scrolls to top and waits
   */
  async loadAllMessages(): Promise<void> {
    // Check if response is still generating
    if (this.isGenerating()) {
      throw new Error(
        'ChatGPT: Cannot export while response is generating. Please wait until generation completes or click "Stop generating".'
      );
    }

    // Use shared scroller utility (scrolls to top + 1s wait)
    await scrollToLoadAll();
  }

  /**
   * Get all message DOM nodes from the page
   *
   * Uses fallback selector chain for resilience against DOM changes.
   * Tries selectors in priority order: data-message-author-role → data-turn → article[data-testid].
   *
   * @returns Array of message HTMLElements, or empty array if no messages found
   *
   * @example
   * const nodes = parser.getMessageNodes();
   * console.log(`Found ${nodes.length} messages`);
   */
  getMessageNodes(): HTMLElement[] {
    // Try each selector in priority order
    for (const selector of ChatGPTParser.MESSAGE_SELECTORS) {
      const nodes = document.querySelectorAll(selector);
      if (nodes.length > 0) {
        return Array.from(nodes) as HTMLElement[];
      }
    }

    // No messages found with any selector
    return [];
  }

  /**
   * Parse a single message node into structured data
   *
   * Extracts role (user/assistant) and HTML content from a message DOM node.
   * Preserves HTML structure for later Markdown conversion.
   *
   * @param node - HTMLElement representing a single message
   * @returns ParsedMessage with role, contentHtml, and optional timestamp
   * @throws {Error} If role cannot be determined from node attributes
   *
   * @example
   * const message = parser.parseNode(messageElement);
   * console.log(message.role); // 'user' or 'assistant'
   */
  parseNode(node: HTMLElement): ParsedMessage {
    const role = this.extractRole(node);
    const contentHtml = this.extractContent(node, role);

    return {
      role,
      contentHtml,
      // ChatGPT doesn't have timestamps in DOM (validated in Phase 1)
      // Timestamp will be added by serializer using export time
      timestamp: undefined,
    };
  }

  /**
   * Check if response is currently being generated
   *
   * Detects if ChatGPT is actively generating a response by checking for
   * the "Stop generating" button in the DOM.
   *
   * @returns true if generation in progress, false otherwise
   *
   * @example
   * if (parser.isGenerating()) {
   *   console.log('Please wait for response to complete');
   * }
   */
  isGenerating(): boolean {
    // Check for "Stop generating" button
    const stopButton = document.querySelector(ChatGPTParser.GENERATING_SELECTOR);
    return stopButton !== null;
  }

  /**
   * Extract conversation title if available
   *
   * ChatGPT typically displays the conversation title in an h1 element.
   * Returns null if no title element found or if title is empty.
   *
   * @returns Conversation title string, or null if not found
   *
   * @example
   * const title = parser.getTitle();
   * console.log(title ?? 'Untitled conversation');
   */
  getTitle(): string | null {
    // ChatGPT typically has title in h1
    const titleElement = document.querySelector('h1');

    if (!titleElement) {
      return null;
    }

    const title = titleElement.textContent?.trim();
    return title || null;
  }

  /**
   * Extract role from message node
   *
   * Tries data-message-author-role first, then data-turn as fallback.
   * Throws descriptive error if neither attribute contains valid role.
   *
   * @private
   * @param node - Message HTMLElement to extract role from
   * @returns 'user' or 'assistant'
   * @throws {Error} If no valid role attribute found
   */
  private extractRole(node: HTMLElement): 'user' | 'assistant' {
    // Try data-message-author-role first (primary selector)
    const roleAttr = node.getAttribute('data-message-author-role');
    if (roleAttr === 'user' || roleAttr === 'assistant') {
      return roleAttr;
    }

    // Try data-turn as fallback (secondary selector)
    const turnAttr = node.getAttribute('data-turn');
    if (turnAttr === 'user' || turnAttr === 'assistant') {
      return turnAttr;
    }

    // No valid role attribute found - provide helpful error message
    const availableAttrs = Array.from(node.attributes)
      .map((attr) => `${attr.name}="${attr.value}"`)
      .join(', ');

    throw new Error(
      `ChatGPT: Cannot determine message role. Expected data-message-author-role or data-turn attribute with value 'user' or 'assistant'. ` +
        `Found attributes: ${availableAttrs || 'none'}`
    );
  }

  /**
   * Extract content HTML from message node
   *
   * Uses role-specific selectors to find content element.
   * User messages: .whitespace-pre-wrap
   * Assistant messages: .markdown
   *
   * @private
   * @param node - Message HTMLElement to extract content from
   * @param role - Message role (determines which selector to use)
   * @returns HTML content string, or empty string if content element not found
   */
  private extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    // Get role-specific selector from constants
    const selector = ChatGPTParser.CONTENT_SELECTORS[role];
    const contentElement = node.querySelector(selector);

    // Return innerHTML or empty string if not found
    // Empty string is acceptable for messages with no text content
    return contentElement?.innerHTML || '';
  }
}
