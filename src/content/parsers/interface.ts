/**
 * Parser Interface for LLM Chat Platforms
 *
 * This interface defines the contract that all platform-specific parsers
 * (ChatGPT, Claude, Gemini, Grok, Perplexity) must implement.
 *
 * Design Pattern: Strategy Pattern
 * - Interface: ChatParser
 * - Concrete Strategies: BaseParser subclasses (DOM) and ClaudeParser (API)
 * - Context: ParserFactory selects appropriate strategy
 */

/**
 * Platform-specific source of a conversation
 */
export interface ChatParser {
  /**
   * Check if this parser can handle the given hostname
   * @param hostname - The hostname to check (e.g., 'chatgpt.com')
   * @returns true if this parser supports the hostname
   */
  canHandle(hostname: string): boolean;

  /**
   * Check if a response is currently being generated
   * Used to prevent exporting incomplete conversations
   * @returns true if generation in progress
   */
  isGenerating(): boolean;

  /**
   * Read the whole conversation shown on the current page
   *
   * DOM parsers scroll the page and parse its message nodes; Claude reads the
   * conversation API the page itself loads from.
   *
   * @throws Error when the conversation cannot be read
   */
  readConversation(): Promise<Conversation>;
}

/**
 * Everything read from one conversation
 */
export interface Conversation {
  messages: ParsedMessage[];

  /** Conversation title, when the platform exposes one */
  title?: string;

  /** Project the conversation belongs to (ChatGPT/Claude) */
  project?: ProjectInfo | null;

  /** Latest artifact of the conversation (Claude) */
  artifact?: ArtifactData | null;

  /**
   * Signs that the export may not match the page, e.g. a message whose
   * exported text is much shorter than what the page shows. Recorded in the
   * export's metadata and shown in the completion notification.
   */
  warnings: string[];
}

/**
 * Project (ChatGPT "Projects" / Claude "Projects") info for a conversation
 */
export interface ProjectInfo {
  /** Project identifier extracted from the URL or DOM link */
  id: string;
  /** Human-readable project name */
  name: string;
}

/**
 * Claude artifact, rebuilt from the commands that created and edited it
 */
export interface ArtifactData {
  title: string;
  /** "v<n>", counting the commands that produced this version */
  version: string;
  /** The artifact's source as Claude wrote it (Markdown, code, ...) */
  content: string;
}

/**
 * Parsed message data structure
 *
 * Carries exactly one of `contentHtml` (read from the DOM, converted to
 * Markdown by the serializer) or `contentMarkdown` (supplied as Markdown by
 * the platform and written verbatim).
 */
export interface ParsedMessage {
  /**
   * Message role: user or assistant
   */
  role: 'user' | 'assistant';

  /**
   * Message content as HTML (will be converted to Markdown later)
   */
  contentHtml?: string;

  /**
   * Message content already in Markdown
   */
  contentMarkdown?: string;

  /**
   * ISO 8601 timestamp if the platform exposes one
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
  platform: 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity';

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

  /**
   * Project info if this conversation belongs to a project (optional)
   */
  project?: ProjectInfo | null;

  /**
   * Signs that the export may not match the page (optional, see Conversation)
   */
  warnings?: string[];
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
