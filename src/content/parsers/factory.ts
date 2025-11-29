/**
 * Parser Factory
 *
 * Implements Factory Pattern to select appropriate parser based on URL hostname.
 *
 * Design Pattern: Factory
 * - Creates parser instances based on platform (ChatGPT, Claude, Gemini)
 * - Phase 3: Returns null (parsers not implemented yet)
 * - Phase 4: Will instantiate and return actual parser instances
 *
 * Usage:
 * const parser = ParserFactory.getParser(window.location.href);
 * if (!parser) throw new Error('Unsupported platform');
 */

import type { ChatParser } from './interface';

/**
 * Parser Factory - Platform-based parser selection
 */
export class ParserFactory {
  /**
   * Get appropriate parser for the given URL
   *
   * @param url - Full URL of the conversation page
   * @returns Parser instance or null if unsupported/not implemented
   *
   * @example
   * const parser = ParserFactory.getParser('https://chatgpt.com/c/abc123');
   * // Phase 3: returns null
   * // Phase 4: returns ChatGPTParser instance
   */
  static getParser(url: string): ChatParser | null {
    try {
      // Parse URL and normalize hostname
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Platform detection by hostname
      if (hostname.includes('chatgpt.com')) {
        // Phase 4: return new ChatGPTParser();
        return null;
      }

      if (hostname.includes('claude.ai')) {
        // Phase 4: return new ClaudeParser();
        return null;
      }

      if (hostname.includes('gemini.google.com')) {
        // Phase 4: return new GeminiParser();
        return null;
      }

      // Unsupported platform
      return null;

    } catch (error) {
      // Invalid URL or parsing error
      console.error('ParserFactory: Invalid URL', error);
      return null;
    }
  }

  /**
   * Check if a URL is supported (has a parser)
   *
   * @param url - URL to check
   * @returns true if supported
   *
   * @example
   * if (ParserFactory.isSupported(window.location.href)) {
   *   // Can export conversation
   * }
   */
  static isSupported(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      return (
        hostname.includes('chatgpt.com') ||
        hostname.includes('claude.ai') ||
        hostname.includes('gemini.google.com')
      );
    } catch {
      return false;
    }
  }
}
