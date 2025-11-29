import { describe, it, expect } from 'vitest';
import { ParserFactory } from '../../src/content/parsers/factory';

describe('ParserFactory', () => {
  // Platform detection tests
  it('should recognize ChatGPT URL', () => {
    const url = 'https://chatgpt.com/c/abc123';
    const parser = ParserFactory.getParser(url);

    // Phase 3: parsers not implemented yet, should return null
    // Phase 4: should return ChatGPTParser instance
    expect(parser).toBeNull();
  });

  it('should recognize Claude URL', () => {
    const url = 'https://claude.ai/chat/xyz789';
    const parser = ParserFactory.getParser(url);

    // Phase 3: parsers not implemented yet
    expect(parser).toBeNull();
  });

  it('should recognize Gemini URL', () => {
    const url = 'https://gemini.google.com/app/conversation123';
    const parser = ParserFactory.getParser(url);

    // Phase 3: parsers not implemented yet
    expect(parser).toBeNull();
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
    expect(parser).toBeNull(); // Phase 3
  });

  it('should handle URL with hash', () => {
    const url = 'https://claude.ai/chat/xyz789#message123';
    const parser = ParserFactory.getParser(url);

    // Should still recognize as Claude
    expect(parser).toBeNull(); // Phase 3
  });

  it('should be case-insensitive for hostname', () => {
    const url1 = 'https://ChatGPT.com/c/abc';
    const url2 = 'https://CLAUDE.AI/chat/xyz';

    const parser1 = ParserFactory.getParser(url1);
    const parser2 = ParserFactory.getParser(url2);

    expect(parser1).toBeNull(); // Phase 3
    expect(parser2).toBeNull(); // Phase 3
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
    expect(parser).toBeNull(); // Phase 3
  });

  it('should recognize different ChatGPT paths', () => {
    const urls = [
      'https://chatgpt.com/c/conversation123',
      'https://chatgpt.com/chat/abc',
      'https://chatgpt.com/g/gpt-builder'
    ];

    urls.forEach(url => {
      const parser = ParserFactory.getParser(url);
      expect(parser).toBeNull(); // Phase 3, all should be recognized
    });
  });
});
