import { describe, it, expect } from 'vitest';
import { ParserFactory } from '../../src/content/parsers/factory';
import { ChatGPTParser } from '../../src/content/parsers/chatgpt';
import { ClaudeParser } from '../../src/content/parsers/claude';
import { GeminiParser } from '../../src/content/parsers/gemini';
import { PerplexityParser } from '../../src/content/parsers/perplexity';

describe('ParserFactory', () => {
  // Platform detection tests
  it('should recognize ChatGPT URL', () => {
    const url = 'https://chatgpt.com/c/abc123';
    const parser = ParserFactory.getParser(url);

    // Phase 4: should return ChatGPTParser instance
    expect(parser).toBeInstanceOf(ChatGPTParser);
  });

  it('should recognize Claude URL', () => {
    const url = 'https://claude.ai/chat/xyz789';
    const parser = ParserFactory.getParser(url);

    // Phase 4: should return ClaudeParser instance
    expect(parser).toBeInstanceOf(ClaudeParser);
  });

  it('should recognize Gemini URL', () => {
    const url = 'https://gemini.google.com/app/conversation123';
    const parser = ParserFactory.getParser(url);

    // Phase 4: should return GeminiParser instance
    expect(parser).toBeInstanceOf(GeminiParser);
  });

  // Unsupported platforms
  it('should return null for unsupported URL', () => {
    const url = 'https://example.com/chat';
    const parser = ParserFactory.getParser(url);
    expect(parser).toBeNull();
  });

  it('should return null for completely different domain', () => {
    const url = 'https://github.com/repo/issues';
    const parser = ParserFactory.getParser(url);
    expect(parser).toBeNull();
  });

  // URL variations
  it('should handle ChatGPT URL with query params', () => {
    const url = 'https://chatgpt.com/c/abc123?model=gpt-4';
    const parser = ParserFactory.getParser(url);

    // Should still recognize as ChatGPT
    expect(parser).toBeInstanceOf(ChatGPTParser);
  });

  it('should handle URL with hash', () => {
    const url = 'https://claude.ai/chat/xyz789#message123';
    const parser = ParserFactory.getParser(url);

    // Should still recognize as Claude
    expect(parser).toBeInstanceOf(ClaudeParser);
  });

  it('should be case-insensitive for hostname', () => {
    const url1 = 'https://ChatGPT.com/c/abc';
    const url2 = 'https://CLAUDE.AI/chat/xyz';

    const parser1 = ParserFactory.getParser(url1);
    const parser2 = ParserFactory.getParser(url2);

    expect(parser1).toBeInstanceOf(ChatGPTParser);
    expect(parser2).toBeInstanceOf(ClaudeParser);
  });

  // Edge cases
  it('should handle invalid URL gracefully', () => {
    const invalidUrl = 'not-a-valid-url';
    const parser = ParserFactory.getParser(invalidUrl);

    expect(parser).toBeNull();
  });

  it('should handle empty string', () => {
    const parser = ParserFactory.getParser('');
    expect(parser).toBeNull();
  });

  it('should handle URL without protocol', () => {
    const url = 'chatgpt.com/c/abc123';
    const parser = ParserFactory.getParser(url);

    // May fail to parse without protocol, should return null
    expect(parser).toBeNull();
  });

  // Subdomain variations
  it('should recognize ChatGPT with www', () => {
    const url = 'https://www.chatgpt.com/c/abc123';
    const parser = ParserFactory.getParser(url);
    expect(parser).toBeInstanceOf(ChatGPTParser);
  });

  it('should recognize different ChatGPT paths', () => {
    const urls = [
      'https://chatgpt.com/c/conversation123',
      'https://chatgpt.com/chat/abc',
      'https://chatgpt.com/g/gpt-builder'
    ];

    urls.forEach(url => {
      const parser = ParserFactory.getParser(url);
      expect(parser).toBeInstanceOf(ChatGPTParser); // Phase 4, all should be recognized
    });
  });

  // Perplexity tests
  it('should recognize Perplexity URL', () => {
    const url = 'https://www.perplexity.ai/search/what-is-typescript';
    const parser = ParserFactory.getParser(url);
    expect(parser).toBeInstanceOf(PerplexityParser);
  });

  it('should recognize Perplexity URL without www', () => {
    const url = 'https://perplexity.ai/search/query123';
    const parser = ParserFactory.getParser(url);
    expect(parser).toBeInstanceOf(PerplexityParser);
  });

  it('should support Perplexity in isSupported()', () => {
    expect(ParserFactory.isSupported('https://www.perplexity.ai/search/abc')).toBe(true);
    expect(ParserFactory.isSupported('https://perplexity.ai/')).toBe(true);
  });
});
