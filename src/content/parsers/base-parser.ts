/**
 * BaseParser - Abstract Base Class for Platform Parsers
 *
 * Provides common implementation for all platform parsers using
 * configuration-driven selectors. Each concrete parser (ChatGPT, Claude, Gemini)
 * extends this class and benefits from shared logic.
 *
 * Design Pattern: Template Method Pattern
 * - Common methods implemented here (getMessageNodes, parseNode, etc.)
 * - Platform-specific behavior via configuration (selectors.json)
 * - Override points available for custom behavior if needed
 */

import type { ChatParser, ParsedMessage } from './interface';
import type { PlatformSelectors, PlatformKey, TitleConfig } from './config-types';
import { ConfigLoader } from './config-loader';
import { scrollToLoadAll } from '../scroller';

/**
 * Abstract base class for all platform parsers
 *
 * Implements ChatParser interface with configuration-driven selectors.
 * Concrete parsers need only extend and call super('platformKey').
 */
export abstract class BaseParser implements ChatParser {
  /** Platform identifier (chatgpt, claude, gemini) */
  protected readonly platformKey: PlatformKey;

  /** Platform display name for error messages */
  protected readonly platformName: string;

  /** Hostname pattern for canHandle() */
  protected readonly hostname: string;

  /** Selector configuration for this platform */
  protected readonly selectors: PlatformSelectors;

  /**
   * Create a new parser instance
   *
   * @param platformKey - Platform identifier (chatgpt, claude, gemini)
   */
  constructor(platformKey: PlatformKey) {
    this.platformKey = platformKey;

    const loader = ConfigLoader.getInstance();
    const config = loader.getPlatformConfig(platformKey);

    this.hostname = config.hostname;
    this.selectors = config.selectors;

    // Generate display name (capitalize first letter)
    this.platformName =
      platformKey === 'chatgpt'
        ? 'ChatGPT'
        : platformKey.charAt(0).toUpperCase() + platformKey.slice(1);
  }

  /**
   * Check if this parser can handle the given hostname
   *
   * Uses configured hostname pattern for matching.
   *
   * @param hostname - The hostname to check
   * @returns true if hostname matches this platform
   */
  canHandle(hostname: string): boolean {
    if (!hostname) {
      return false;
    }
    const normalizedHostname = hostname.toLowerCase();
    return normalizedHostname.includes(this.hostname);
  }

  /**
   * Load all messages into DOM
   *
   * Scrolls to ensure all messages are loaded (handles virtualization).
   * Throws error if response is currently being generated.
   */
  async loadAllMessages(): Promise<void> {
    if (this.isGenerating()) {
      throw new Error(
        `${this.platformName}: Cannot export while response is generating. ` +
          'Please wait until generation completes or click "Stop generating".'
      );
    }

    await scrollToLoadAll();
  }

  /**
   * Get all message DOM nodes from the page
   *
   * Uses configuration-driven selectors with fallback support.
   *
   * @returns Array of message HTMLElements
   */
  getMessageNodes(): HTMLElement[] {
    return this.getNodesWithFallback();
  }

  /**
   * Parse a single message node into structured data
   *
   * Extracts role and content using configuration-driven strategies.
   *
   * @param node - HTMLElement representing a single message
   * @returns ParsedMessage with role and contentHtml
   */
  parseNode(node: HTMLElement): ParsedMessage {
    const role = this.extractRole(node);
    const contentHtml = this.extractContent(node, role);

    return {
      role,
      contentHtml,
      // Timestamps not available in DOM for any platform
      timestamp: undefined,
    };
  }

  /**
   * Check if response is currently being generated
   *
   * Uses configured generation selector.
   *
   * @returns true if generation in progress
   */
  isGenerating(): boolean {
    const element = document.querySelector(this.selectors.generation);
    return element !== null;
  }

  /**
   * Get message nodes using fallback selector chain
   *
   * Tries combined selector first, then primary with fallbacks.
   *
   * @protected
   * @returns Array of message HTMLElements
   */
  protected getNodesWithFallback(): HTMLElement[] {
    const { messages } = this.selectors;

    // Use combined selector if available (Claude, Gemini)
    if (messages.combined) {
      const nodes = document.querySelectorAll(messages.combined);
      return Array.from(nodes) as HTMLElement[];
    }

    // Use primary + fallback chain (ChatGPT)
    if (messages.primary) {
      const nodes = document.querySelectorAll(messages.primary);
      if (nodes.length > 0) {
        return Array.from(nodes) as HTMLElement[];
      }

      // Try fallbacks
      for (const fallback of messages.fallbacks || []) {
        const fallbackNodes = document.querySelectorAll(fallback);
        if (fallbackNodes.length > 0) {
          return Array.from(fallbackNodes) as HTMLElement[];
        }
      }
    }

    return [];
  }

  /**
   * Extract role from message node
   *
   * Dispatches to appropriate strategy based on configuration.
   *
   * @protected
   * @param node - Message HTMLElement
   * @returns 'user' or 'assistant'
   * @throws Error if role cannot be determined
   */
  protected extractRole(node: HTMLElement): 'user' | 'assistant' {
    const { role } = this.selectors;

    switch (role.strategy) {
      case 'attribute':
        return this.extractRoleByAttribute(node);
      case 'hybrid':
        return this.extractRoleByHybrid(node);
      case 'tagname':
        return this.extractRoleByTagName(node);
      default:
        throw new Error(
          `${this.platformName}: Unknown role strategy '${role.strategy}'`
        );
    }
  }

  /**
   * Extract role using attribute strategy (ChatGPT)
   *
   * Checks configured attributes for 'user' or 'assistant' value.
   *
   * @private
   * @param node - Message HTMLElement
   * @returns 'user' or 'assistant'
   * @throws Error if no valid role attribute found
   */
  private extractRoleByAttribute(node: HTMLElement): 'user' | 'assistant' {
    const attributes = this.selectors.role.attributes || [];

    for (const attr of attributes) {
      const value = node.getAttribute(attr);
      if (value === 'user' || value === 'assistant') {
        return value;
      }
    }

    // Provide helpful error message
    const availableAttrs = Array.from(node.attributes)
      .map((attr) => `${attr.name}="${attr.value}"`)
      .join(', ');

    throw new Error(
      `${this.platformName}: Cannot determine message role. ` +
        `Expected attribute ${attributes.join(' or ')} with value 'user' or 'assistant'. ` +
        `Found attributes: ${availableAttrs || 'none'}`
    );
  }

  /**
   * Extract role using hybrid strategy (Claude)
   *
   * Checks data-testid first, then streaming attribute presence.
   *
   * @private
   * @param node - Message HTMLElement
   * @returns 'user' or 'assistant'
   * @throws Error if role cannot be determined
   */
  private extractRoleByHybrid(node: HTMLElement): 'user' | 'assistant' {
    const { userTestId, assistantTestId, streamingAttribute } = this.selectors.role;
    const testId = node.getAttribute('data-testid');

    // Priority 1: Check user testid
    if (testId === userTestId) {
      return 'user';
    }

    // Priority 2: Check assistant testid (legacy/fallback)
    if (testId === assistantTestId) {
      return 'assistant';
    }

    // Priority 3: Check streaming attribute presence
    if (streamingAttribute && node.hasAttribute(streamingAttribute)) {
      return 'assistant';
    }

    // Provide detailed error for debugging
    const nodeInfo = {
      testId: testId || 'none',
      hasStreaming: streamingAttribute ? node.hasAttribute(streamingAttribute) : false,
      id: node.id || 'none',
      classes: node.className || 'none',
      innerHTML: node.innerHTML.substring(0, 100) + '...',
    };

    throw new Error(
      `${this.platformName}: Cannot determine message role. ` +
        `Expected data-testid='${userTestId}'/'${assistantTestId}' or ${streamingAttribute} attribute. ` +
        `Found: data-testid='${nodeInfo.testId}', ${streamingAttribute}=${nodeInfo.hasStreaming}, ` +
        `id='${nodeInfo.id}', classes='${nodeInfo.classes}'. ` +
        `Content preview: ${nodeInfo.innerHTML}`
    );
  }

  /**
   * Extract role using tagname strategy (Gemini)
   *
   * Determines role from element tag name.
   *
   * @private
   * @param node - Message HTMLElement
   * @returns 'user' or 'assistant'
   * @throws Error if tag name is not recognized
   */
  private extractRoleByTagName(node: HTMLElement): 'user' | 'assistant' {
    const { userTag, assistantTag } = this.selectors.role;
    const tagName = node.tagName.toLowerCase();

    if (tagName === userTag?.toLowerCase()) {
      return 'user';
    }

    if (tagName === assistantTag?.toLowerCase()) {
      return 'assistant';
    }

    // Provide detailed error for debugging
    const nodeInfo = {
      tagName,
      id: node.id || 'none',
      classes: node.className || 'none',
      innerHTML: node.innerHTML.substring(0, 100) + '...',
    };

    throw new Error(
      `${this.platformName}: Cannot determine message role. ` +
        `Expected tag name '${userTag}' or '${assistantTag}'. ` +
        `Found: tagName='${tagName}', id='${nodeInfo.id}', classes='${nodeInfo.classes}'. ` +
        `Content preview: ${nodeInfo.innerHTML}`
    );
  }

  /**
   * Extract content HTML from message node
   *
   * Uses role-specific selector from configuration.
   *
   * @protected
   * @param node - Message HTMLElement
   * @param role - Message role (determines which selector to use)
   * @returns HTML content string, or empty string if not found
   */
  protected extractContent(node: HTMLElement, role: 'user' | 'assistant'): string {
    const selector = this.selectors.content[role];
    const contentElement = node.querySelector(selector);
    return contentElement?.innerHTML || '';
  }

  /**
   * Get conversation title using configured strategy
   *
   * Dispatches to appropriate extraction method based on configuration.
   * Returns undefined if title cannot be extracted or config not provided.
   *
   * @returns Title string or undefined
   */
  getTitle(): string | undefined {
    const titleConfig = this.selectors.title;

    // No title configuration - return undefined
    if (!titleConfig) {
      return undefined;
    }

    try {
      switch (titleConfig.strategy) {
        case 'document-title':
          return this.extractTitleFromDocument(titleConfig);
        case 'selector':
          return this.extractTitleFromSelector(titleConfig);
        default:
          console.warn(
            `${this.platformName}: Unknown title strategy '${(titleConfig as TitleConfig).strategy}'`
          );
          return undefined;
      }
    } catch (error) {
      // Log error but don't throw - title is optional
      console.warn(`${this.platformName}: Failed to extract title`, error);
      return undefined;
    }
  }

  /**
   * Extract title from document.title with pattern cleaning
   *
   * Process:
   * 1. Get document.title
   * 2. Remove prefix (e.g., "ChatGPT - ")
   * 3. Remove leading emoji
   * 4. Trim whitespace
   *
   * @private
   * @param config - Title configuration
   * @returns Cleaned title or undefined
   */
  private extractTitleFromDocument(config: TitleConfig): string | undefined {
    let title = document.title;

    if (!title || title.trim() === '') {
      return undefined;
    }

    // Remove prefix (e.g., "ChatGPT - ")
    if (config.prefixPattern) {
      const prefixRegex = new RegExp(config.prefixPattern, 'u');
      title = title.replace(prefixRegex, '');
    }

    // Remove suffix (e.g., " - Grok")
    if (config.suffixPattern) {
      const suffixRegex = new RegExp(config.suffixPattern, 'u');
      title = title.replace(suffixRegex, '');
    }

    // Remove leading emoji
    if (config.emojiPattern) {
      const emojiRegex = new RegExp(config.emojiPattern, 'u');
      title = title.replace(emojiRegex, '');
    }

    title = title.trim();

    return title || undefined;
  }

  /**
   * Extract title from DOM element using selector
   *
   * @private
   * @param config - Title configuration
   * @returns Title text or undefined
   */
  private extractTitleFromSelector(config: TitleConfig): string | undefined {
    if (!config.selector) {
      return undefined;
    }

    const element = document.querySelector(config.selector);

    if (!element) {
      return undefined;
    }

    let title = element.textContent?.trim();

    if (!title) {
      return undefined;
    }

    // Remove leading emoji if pattern provided
    if (config.emojiPattern) {
      const emojiRegex = new RegExp(config.emojiPattern, 'u');
      title = title.replace(emojiRegex, '').trim();
    }

    return title || undefined;
  }
}
