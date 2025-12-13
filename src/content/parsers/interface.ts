/**
 * Parser Interface for LLM Chat Platforms
 *
 * This interface defines the contract that all platform-specific parsers
 * (ChatGPT, Claude, Gemini) must implement.
 *
 * Design Pattern: Strategy Pattern
 * - Interface: ChatParser
 * - Concrete Strategies: ChatGPTParser, ClaudeParser, GeminiParser (Phase 4)
 * - Context: ParserFactory selects appropriate strategy
 */

/**
 * Platform-specific parser for extracting conversation data from DOM
 */
export interface ChatParser {
  /**
   * Check if this parser can handle the given hostname
   * @param hostname - The hostname to check (e.g., 'chatgpt.com')
   * @returns true if this parser supports the hostname
   */
  canHandle(hostname: string): boolean;

  /**
   * Load all messages into the DOM (handle virtualization)
   * Some platforms (e.g., Claude) aggressively unmount messages outside viewport.
   * This method should scroll/trigger to ensure all messages are in DOM.
   *
   * @throws Error if response is still generating
   */
  loadAllMessages(): Promise<void>;

  /**
   * Get all message DOM nodes from the current page
   * @returns Array of HTMLElements representing messages
   */
  getMessageNodes(): HTMLElement[];

  /**
   * Parse a single message node into structured data
   * @param node - The HTMLElement representing a message
   * @returns Parsed message with role and HTML content
   */
  parseNode(node: HTMLElement): ParsedMessage;

  /**
   * Check if a response is currently being generated
   * Used to prevent exporting incomplete conversations
   * @returns true if generation in progress
   */
  isGenerating(): boolean;

  /**
   * Get conversation title
   * @returns Title string or undefined if not available
   */
  getTitle(): string | undefined;
}

/**
 * Parsed message data structure
 * Extracted from DOM before conversion to Markdown
 */
export interface ParsedMessage {
  /**
   * Message role: user or assistant
   */
  role: 'user' | 'assistant';

  /**
   * Message content as HTML (will be converted to Markdown later)
   */
  contentHtml: string;

  /**
   * ISO 8601 timestamp if available from DOM
   * If not available, serializer will add export time
   */
  timestamp?: string;
}

/**
 * Metadata for the exported conversation
 * Included as first line in JSONL output
 */
export interface ExportMetadata {
  /**
   * Platform identifier
   */
  platform: 'chatgpt' | 'claude' | 'gemini' | 'grok';

  /**
   * Full URL of the conversation
   */
  url: string;

  /**
   * ISO 8601 timestamp when export was performed
   */
  exported_at: string;

  /**
   * Conversation title (optional)
   */
  title?: string;
}

/**
 * Final message format in JSONL output
 * After HTML→Markdown conversion
 */
export interface ExportedMessage {
  /**
   * Message role
   */
  role: 'user' | 'assistant';

  /**
   * Message content in Markdown format
   */
  content: string;

  /**
   * ISO 8601 timestamp
   */
  timestamp: string;
}
