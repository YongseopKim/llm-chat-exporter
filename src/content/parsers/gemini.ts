/**
 * Gemini Parser
 *
 * Implements ChatParser interface for gemini.google.com platform.
 *
 * DOM Structure (from samples/README.md):
 * - Messages: <user-query> and <model-response> custom elements
 * - User content: .query-text
 * - Assistant content: .response-container-content
 * - Generating: button[aria-label*="Stop"]
 *
 * Key Characteristics:
 * - Angular framework with custom elements
 * - No Shadow DOM (validated in Phase 3)
 * - Role determined by tag name (unlike ChatGPT which uses attributes)
 *
 * Differences from ChatGPTParser:
 * - Uses custom elements instead of data attributes for role detection
 * - Tag name determines role (simpler than attribute checking)
 * - Single selector for all messages (no fallback chain needed)
 *
 * @see samples/README.md for validated selectors and DOM analysis
 */

import type { ChatParser, ParsedMessage } from './interface';
import { scrollToLoadAll } from '../scroller';

/**
 * Gemini platform parser
 *
 * Parses conversations from gemini.google.com using custom elements.
 * Implements tag-based role detection for user-query and model-response elements.
 *
 * Implementation Strategy:
 * - Custom elements provide stable, semantic message detection
 * - Tag name alone determines role (simpler than attribute checking)
 * - No fallback selector chain needed (unlike ChatGPT)
 * - Same pattern as ChatGPTParser for extractRole/extractContent decomposition
 */
export class GeminiParser implements ChatParser {
  /**
   * Custom element tag names for messages
   *
   * Gemini uses Angular custom elements which are very stable.
   */
  private static readonly MESSAGE_ELEMENTS = {
    user: 'user-query',
    assistant: 'model-response',
  } as const;

  /**
   * Combined selector for all message elements
   *
   * Single selector works for all messages (no fallback needed).
   */
  private static readonly ALL_MESSAGES_SELECTOR = 'user-query, model-response' as const;

  /**
   * Content selectors by message role
   *
   * Different from ChatGPT but same pattern.
   */
  private static readonly CONTENT_SELECTORS = {
    user: '.query-text',
    assistant: '.response-container-content',
  } as const;

  /**
   * Selector for detecting active generation
   *
   * Same as ChatGPT (both use "Stop" button).
   */
  private static readonly GENERATING_SELECTOR = 'button[aria-label*="Stop"]' as const;

  /**
   * Check if this parser can handle the given hostname
   *
   * @param hostname - The hostname to check (e.g., 'gemini.google.com')
   * @returns true if hostname contains 'gemini.google.com', false otherwise
   *
   * @example
   * parser.canHandle('gemini.google.com') // true
   * parser.canHandle('chatgpt.com') // false
   */
  canHandle(hostname: string): boolean {
    if (!hostname) {
      return false;
    }

    const normalizedHostname = hostname.toLowerCase();
    return normalizedHostname.includes('gemini.google.com');
  }

  /**
   * Load all messages into DOM
   *
   * Gemini doesn't appear to aggressively virtualize messages based on Phase 3 validation.
   * Simple scroll to top should be sufficient.
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
        'Gemini: Cannot export while response is generating. Please wait until generation completes or click "Stop generating".'
      );
    }

    // Use shared scroller utility (scrolls to top + 1s wait)
    await scrollToLoadAll();
  }

  /**
   * Get all message DOM nodes from the page
   *
   * Gemini uses custom elements (<user-query>, <model-response>).
   * This makes message detection very stable and straightforward.
   * Unlike ChatGPT, no fallback selector chain is needed.
   *
   * @returns Array of message HTMLElements (custom elements), or empty array if no messages found
   *
   * @example
   * const nodes = parser.getMessageNodes();
   * console.log(`Found ${nodes.length} messages`);
   */
  getMessageNodes(): HTMLElement[] {
    // Query both user-query and model-response custom elements
    // Returns NodeList which we convert to array
    const nodes = document.querySelectorAll(GeminiParser.ALL_MESSAGES_SELECTOR);
    return Array.from(nodes) as HTMLElement[];
  }

  /**
   * Parse a single message node into structured data
   *
   * Extracts role (user/assistant) from tag name and content from role-specific selectors.
   * Preserves HTML structure for later Markdown conversion.
   *
   * @param node - HTMLElement representing a single message (user-query or model-response)
   * @returns ParsedMessage with role, contentHtml, and optional timestamp
   * @throws {Error} If node is not a recognized custom element
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
      // Gemini doesn't have timestamps in DOM (validated in Phase 1)
      // Timestamp will be added by serializer using export time
      timestamp: undefined,
    };
  }

  /**
   * Check if response is currently being generated
   *
   * Detects if Gemini is actively generating a response by checking for
   * the "Stop" button in the DOM.
   *
   * @returns true if generation in progress, false otherwise
   *
   * @example
   * if (parser.isGenerating()) {
   *   console.log('Please wait for response to complete');
   * }
   */
  isGenerating(): boolean {
    // Check for "Stop" button (similar to ChatGPT)
    const stopButton = document.querySelector(GeminiParser.GENERATING_SELECTOR);
    return stopButton !== null;
  }

  /**
   * Extract role from message node
   *
   * Gemini uses custom elements, so role is determined by tag name:
   * - <user-query> → 'user'
   * - <model-response> → 'assistant'
   *
   * This is simpler than ChatGPT's attribute-based approach.
   *
   * @private
   * @param node - Message HTMLElement (custom element)
   * @returns 'user' or 'assistant'
   * @throws {Error} If tag name is not recognized
   */
  private extractRole(node: HTMLElement): 'user' | 'assistant' {
    const tagName = node.tagName.toLowerCase();

    if (tagName === GeminiParser.MESSAGE_ELEMENTS.user) {
      return 'user';
    }

    if (tagName === GeminiParser.MESSAGE_ELEMENTS.assistant) {
      return 'assistant';
    }

    // Unknown custom element - provide detailed error for debugging
    const nodeInfo = {
      tagName,
      id: node.id || 'none',
      classes: node.className || 'none',
      innerHTML: node.innerHTML.substring(0, 100) + '...',
    };

    throw new Error(
      `Gemini: Cannot determine message role. Expected tag name 'user-query' or 'model-response'. ` +
        `Found: tagName='${tagName}', id='${nodeInfo.id}', classes='${nodeInfo.classes}'. ` +
        `Content preview: ${nodeInfo.innerHTML}`
    );
  }

  /**
   * Extract content HTML from message node
   *
   * Uses role-specific selectors to find content element.
   * User messages: .query-text
   * Assistant messages: .response-container-content
   *
   * Pattern matches ChatGPTParser but with different selectors.
   *
   * @private
   * @param node - Message HTMLElement (custom element)
   * @param role - Message role (determines which selector to use)
   * @returns HTML content string, or empty string if content element not found
   */
  private extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    // Get role-specific selector from constants
    const selector = GeminiParser.CONTENT_SELECTORS[role];
    const contentElement = node.querySelector(selector);

    // Return innerHTML or empty string if not found
    // Empty string is acceptable for messages with no text content
    return contentElement?.innerHTML || '';
  }
}
