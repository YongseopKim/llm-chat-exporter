/**
 * Claude Parser
 *
 * Implements ChatParser interface for claude.ai platform.
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
 *
 * Differences from ChatGPT/Gemini:
 * - Uses data-is-streaming for assistant messages (unique to Claude)
 * - User messages use data-testid (stable)
 * - Unique streaming detection via data-is-streaming attribute
 * - Most aggressive DOM virtualization of all three platforms
 *
 * @see samples/README.md for validated selectors and DOM analysis
 */

import type { ChatParser, ParsedMessage } from './interface';
import { scrollToLoadAll } from '../scroller';

/**
 * Claude platform parser
 *
 * Parses conversations from claude.ai using validated DOM selectors.
 * Implements hybrid selector strategy combining data-testid and data-is-streaming.
 *
 * Implementation Strategy:
 * - User messages: data-testid="user-message" (stable)
 * - Assistant messages: data-is-streaming attribute (primary) OR data-testid="assistant-message" (fallback)
 * - Supports both current and legacy Claude UI structures for resilience
 * - Same pattern as other parsers for extractRole/extractContent decomposition
 *
 * Differences from ChatGPT/Gemini:
 * - Unique dual-selector approach for assistant messages (data-is-streaming + data-testid)
 * - Most stable generation detection via data-is-streaming attribute (vs button detection)
 * - Most aggressive DOM virtualization of all three platforms
 * - Assistant content uses .standard-markdown/.progressive-markdown (vs .markdown in ChatGPT)
 *
 * Why Hybrid Approach?
 * - data-is-streaming is present in current Claude UI (sample validated)
 * - data-testid="assistant-message" provides fallback for UI changes
 * - Both attributes provide semantic meaning (streaming state + role)
 * - More resilient than pure class-based detection
 */
export class ClaudeParser implements ChatParser {
  /**
   * Message selectors by role
   *
   * Claude uses hybrid approach for maximum stability:
   * - User: data-testid attribute (very stable)
   * - Assistant: data-is-streaming attribute (current UI) OR data-testid (legacy/fallback)
   *
   * The dual-selector strategy for assistant messages ensures compatibility
   * with both current and future Claude UI structures.
   */
  private static readonly MESSAGE_SELECTORS = {
    user: '[data-testid="user-message"]',
    assistant: '[data-is-streaming], [data-testid="assistant-message"]',
  } as const;

  /**
   * Combined selector for all message elements
   *
   * Queries user messages (data-testid) and assistant messages (data-is-streaming OR data-testid).
   * Supports both current and legacy Claude UI structures.
   *
   * Order: user-message, data-is-streaming, assistant-message
   * This ensures messages are retrieved in conversation order.
   */
  private static readonly ALL_MESSAGES_SELECTOR =
    '[data-testid="user-message"], [data-is-streaming], [data-testid="assistant-message"]' as const;

  /**
   * Content selectors by message role
   *
   * Claude uses different content wrapper classes than ChatGPT/Gemini:
   * - User: .whitespace-pre-wrap (same as ChatGPT)
   * - Assistant: .standard-markdown OR .progressive-markdown (unique to Claude)
   *
   * The dual assistant selector handles both complete and streaming responses.
   */
  private static readonly CONTENT_SELECTORS = {
    user: '.whitespace-pre-wrap',
    assistant: '.standard-markdown, .progressive-markdown',
  } as const;

  /**
   * Selector for detecting active generation
   *
   * Claude uses data-is-streaming attribute (more stable than button detection).
   * - "true" = actively generating response
   * - "false" = response complete
   *
   * This is more reliable than ChatGPT/Gemini's button-based detection.
   */
  private static readonly GENERATING_SELECTOR = '[data-is-streaming="true"]' as const;

  /**
   * Check if this parser can handle the given hostname
   *
   * @param hostname - The hostname to check (e.g., 'claude.ai', 'www.claude.ai')
   * @returns true if hostname contains 'claude.ai', false otherwise
   *
   * @example
   * parser.canHandle('claude.ai') // true
   * parser.canHandle('chatgpt.com') // false
   */
  canHandle(hostname: string): boolean {
    if (!hostname) {
      return false;
    }

    const normalizedHostname = hostname.toLowerCase();
    return normalizedHostname.includes('claude.ai');
  }

  /**
   * Load all messages into DOM
   *
   * Claude aggressively virtualizes messages in long conversations, unmounting
   * messages outside the viewport. Scroll to top to ensure all messages are loaded.
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
        'Claude: Cannot export while response is generating. Please wait until generation completes or click \"Stop generating\".'
      );
    }

    // Use shared scroller utility (scrolls to top + 1s wait)
    await scrollToLoadAll();
  }

  /**
   * Get all message DOM nodes from the page
   *
   * Claude uses hybrid selector approach:
   * - User messages: data-testid="user-message"
   * - Assistant messages: data-is-streaming (current) OR data-testid="assistant-message" (fallback)
   *
   * This dual-selector strategy is more stable than pure class-based approaches
   * and handles both current and legacy Claude UI structures.
   *
   * @returns Array of message HTMLElements, or empty array if no messages found
   *
   * @example
   * const nodes = parser.getMessageNodes();
   * console.log(`Found ${nodes.length} messages`);
   */
  getMessageNodes(): HTMLElement[] {
    // Query both user and assistant messages using hybrid selector
    // Supports both data-testid and data-is-streaming approaches
    const nodes = document.querySelectorAll(ClaudeParser.ALL_MESSAGES_SELECTOR);
    return Array.from(nodes) as HTMLElement[];
  }

  /**
   * Parse a single message node into structured data
   *
   * Extracts role (user/assistant) from hybrid attribute detection and content
   * from role-specific selectors. Preserves HTML structure for later Markdown conversion.
   *
   * @param node - HTMLElement representing a single message
   * @returns ParsedMessage with role, contentHtml, and optional timestamp
   * @throws {Error} If role cannot be determined from attributes
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
      // Claude doesn't have timestamps in DOM (validated in Phase 1)
      // Timestamp will be added by serializer using export time
      timestamp: undefined,
    };
  }

  /**
   * Check if response is currently being generated
   *
   * Detects if Claude is actively generating a response by checking for
   * the data-is-streaming="true" attribute.
   *
   * @returns true if generation in progress, false otherwise
   *
   * @example
   * if (parser.isGenerating()) {
   *   console.log('Please wait for response to complete');
   * }
   */
  isGenerating(): boolean {
    // Check for data-is-streaming="true" attribute
    const streamingElement = document.querySelector(ClaudeParser.GENERATING_SELECTOR);
    return streamingElement !== null;
  }

  /**
   * Extract conversation title if available
   *
   * Claude may display conversation title in an h1 element.
   * Returns null if no title element found or if title is empty.
   *
   * @returns Conversation title string, or null if not found
   *
   * @example
   * const title = parser.getTitle();
   * console.log(title ?? 'Untitled conversation');
   */
  getTitle(): string | null {
    // Claude may have title in h1 (similar to ChatGPT/Gemini)
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
   * Claude uses hybrid approach for role detection:
   * - [data-testid="user-message"] → 'user'
   * - [data-testid="assistant-message"] → 'assistant' (legacy/newer UI)
   * - [data-is-streaming] → 'assistant' (current UI, sample validated)
   *
   * Supports both current and legacy Claude UI structures.
   * The priority order ensures stable detection across UI changes.
   *
   * @private
   * @param node - Message HTMLElement
   * @returns 'user' or 'assistant'
   * @throws {Error} If role cannot be determined from attributes
   */
  private extractRole(node: HTMLElement): 'user' | 'assistant' {
    const testId = node.getAttribute('data-testid');
    const isStreaming = node.getAttribute('data-is-streaming');

    // Priority 1: Check data-testid="user-message" (very stable)
    if (testId === 'user-message') {
      return 'user';
    }

    // Priority 2: Check data-testid="assistant-message" (legacy/newer UI fallback)
    if (testId === 'assistant-message') {
      return 'assistant';
    }

    // Priority 3: Check data-is-streaming attribute (current Claude UI)
    // Any value (true/false) indicates an assistant message container
    if (isStreaming !== null) {
      return 'assistant';
    }

    // No valid role attribute found - provide detailed error for debugging
    const nodeInfo = {
      testId: testId || 'none',
      isStreaming: isStreaming || 'none',
      id: node.id || 'none',
      classes: node.className || 'none',
      innerHTML: node.innerHTML.substring(0, 100) + '...',
    };

    throw new Error(
      `Claude: Cannot determine message role. Expected data-testid='user-message'/'assistant-message' or data-is-streaming attribute. ` +
        `Found: data-testid='${nodeInfo.testId}', data-is-streaming='${nodeInfo.isStreaming}', ` +
        `id='${nodeInfo.id}', classes='${nodeInfo.classes}'. ` +
        `Content preview: ${nodeInfo.innerHTML}`
    );
  }

  /**
   * Extract content HTML from message node
   *
   * Uses role-specific selectors to find content element:
   * - User messages: .whitespace-pre-wrap (same as ChatGPT)
   * - Assistant messages: .standard-markdown OR .progressive-markdown (unique to Claude)
   *
   * Pattern matches ChatGPTParser/GeminiParser but with different selectors.
   * The dual assistant selector handles both complete and streaming responses.
   *
   * @private
   * @param node - Message HTMLElement
   * @param role - Message role (determines which selector to use)
   * @returns HTML content string, or empty string if content element not found
   */
  private extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    // Get role-specific selector from constants
    const selector = ClaudeParser.CONTENT_SELECTORS[role];

    // Query for content element using role-specific selector
    // For assistant: tries .standard-markdown first, then .progressive-markdown
    const contentElement = node.querySelector(selector);

    // Return innerHTML or empty string if not found
    // Empty string is acceptable for messages with no text content
    return contentElement?.innerHTML || '';
  }
}
