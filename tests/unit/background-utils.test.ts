/**
 * Background Utils 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { isSupportedUrl, getPlatformName, generateFilename, sanitizeFilename, SUPPORTED_HOSTS } from '../../src/utils/background-utils';

describe('background-utils', () => {
  describe('SUPPORTED_HOSTS', () => {
    it('should contain five platforms', () => {
      expect(SUPPORTED_HOSTS).toHaveLength(5);
      expect(SUPPORTED_HOSTS).toContain('chatgpt.com');
      expect(SUPPORTED_HOSTS).toContain('claude.ai');
      expect(SUPPORTED_HOSTS).toContain('gemini.google.com');
      expect(SUPPORTED_HOSTS).toContain('grok.com');
      expect(SUPPORTED_HOSTS).toContain('perplexity.ai');
    });
  });

  describe('isSupportedUrl', () => {
    it('should return true for ChatGPT URL', () => {
      expect(isSupportedUrl('https://chatgpt.com/c/123')).toBe(true);
      expect(isSupportedUrl('https://chatgpt.com/')).toBe(true);
    });

    it('should return true for Claude URL', () => {
      expect(isSupportedUrl('https://claude.ai/chat/456')).toBe(true);
      expect(isSupportedUrl('https://claude.ai/')).toBe(true);
    });

    it('should return true for Gemini URL', () => {
      expect(isSupportedUrl('https://gemini.google.com/app/789')).toBe(true);
      expect(isSupportedUrl('https://gemini.google.com/')).toBe(true);
    });

    it('should return true for Grok URL', () => {
      expect(isSupportedUrl('https://grok.com/chat/123')).toBe(true);
      expect(isSupportedUrl('https://grok.com/')).toBe(true);
    });

    it('should return true for Perplexity URL', () => {
      expect(isSupportedUrl('https://www.perplexity.ai/search/abc')).toBe(true);
      expect(isSupportedUrl('https://perplexity.ai/')).toBe(true);
    });

    it('should return false for unsupported site', () => {
      expect(isSupportedUrl('https://example.com')).toBe(false);
      expect(isSupportedUrl('https://google.com')).toBe(false);
    });

    it('should return false for undefined URL', () => {
      expect(isSupportedUrl(undefined)).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(isSupportedUrl('not-a-url')).toBe(false);
      expect(isSupportedUrl('')).toBe(false);
    });
  });

  describe('getPlatformName', () => {
    it('should extract chatgpt platform name', () => {
      expect(getPlatformName('https://chatgpt.com/c/123')).toBe('chatgpt');
      expect(getPlatformName('https://chatgpt.com/')).toBe('chatgpt');
    });

    it('should extract claude platform name', () => {
      expect(getPlatformName('https://claude.ai/chat/456')).toBe('claude');
      expect(getPlatformName('https://claude.ai/')).toBe('claude');
    });

    it('should extract gemini platform name', () => {
      expect(getPlatformName('https://gemini.google.com/app/789')).toBe('gemini');
      expect(getPlatformName('https://gemini.google.com/')).toBe('gemini');
    });

    it('should extract grok platform name', () => {
      expect(getPlatformName('https://grok.com/chat/123')).toBe('grok');
      expect(getPlatformName('https://grok.com/')).toBe('grok');
    });

    it('should extract perplexity platform name', () => {
      expect(getPlatformName('https://www.perplexity.ai/search/abc')).toBe('perplexity');
      expect(getPlatformName('https://perplexity.ai/')).toBe('perplexity');
    });

    it('should return unknown for unsupported site', () => {
      expect(getPlatformName('https://example.com')).toBe('unknown');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with chatgpt prefix', () => {
      const filename = generateFilename('https://chatgpt.com/c/123');
      expect(filename).toMatch(/^chatgpt_\d{8}T\d{6}\.jsonl$/);
    });

    it('should generate filename with claude prefix', () => {
      const filename = generateFilename('https://claude.ai/chat/456');
      expect(filename).toMatch(/^claude_\d{8}T\d{6}\.jsonl$/);
    });

    it('should generate filename with gemini prefix', () => {
      const filename = generateFilename('https://gemini.google.com/app/789');
      expect(filename).toMatch(/^gemini_\d{8}T\d{6}\.jsonl$/);
    });

    it('should generate filename with grok prefix', () => {
      const filename = generateFilename('https://grok.com/chat/123');
      expect(filename).toMatch(/^grok_\d{8}T\d{6}\.jsonl$/);
    });

    it('should generate filename with perplexity prefix', () => {
      const filename = generateFilename('https://www.perplexity.ai/search/abc');
      expect(filename).toMatch(/^perplexity_\d{8}T\d{6}\.jsonl$/);
    });

    it('should generate filename with correct timestamp format', () => {
      const filename = generateFilename('https://chatgpt.com/c/123');
      // Format: chatgpt_20251129T103000.jsonl
      const parts = filename.split('_');
      expect(parts).toHaveLength(2);

      const timestamp = parts[1].replace('.jsonl', '');
      expect(timestamp).toMatch(/^\d{8}T\d{6}$/);

      // Check year is reasonable (2025-2030)
      const year = timestamp.substring(0, 4);
      expect(parseInt(year)).toBeGreaterThanOrEqual(2025);
      expect(parseInt(year)).toBeLessThan(2030);
    });

    it('should generate different timestamps for sequential calls', async () => {
      const filename1 = generateFilename('https://chatgpt.com/c/123');

      // Wait 1 second to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      const filename2 = generateFilename('https://chatgpt.com/c/123');

      expect(filename1).not.toBe(filename2);
    });

    it('should use title when provided', () => {
      const filename = generateFilename('https://chatgpt.com/c/123', 'My Conversation');
      expect(filename).toBe('chatgpt_My Conversation.jsonl');
    });

    it('should use title for all platforms', () => {
      expect(generateFilename('https://claude.ai/chat/456', 'Claude Talk')).toBe('claude_Claude Talk.jsonl');
      expect(generateFilename('https://gemini.google.com/app/789', 'Gemini Chat')).toBe('gemini_Gemini Chat.jsonl');
      expect(generateFilename('https://grok.com/chat/123', 'Grok Discussion')).toBe('grok_Grok Discussion.jsonl');
    });

    it('should sanitize title with special characters', () => {
      const filename = generateFilename('https://chatgpt.com/c/123', 'What is 2/3?');
      expect(filename).toBe('chatgpt_What is 2_3_.jsonl');
    });

    it('should fallback to timestamp when title is undefined', () => {
      const filename = generateFilename('https://chatgpt.com/c/123', undefined);
      expect(filename).toMatch(/^chatgpt_\d{8}T\d{6}\.jsonl$/);
    });

    it('should fallback to timestamp when title is empty string', () => {
      const filename = generateFilename('https://chatgpt.com/c/123', '');
      // Empty string is falsy, so should fallback to timestamp
      expect(filename).toMatch(/^chatgpt_\d{8}T\d{6}\.jsonl$/);
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace forward slash with underscore', () => {
      expect(sanitizeFilename('What is 2/3?')).toBe('What is 2_3_');
    });

    it('should replace backslash with underscore', () => {
      expect(sanitizeFilename('path\\to\\file')).toBe('path_to_file');
    });

    it('should replace colon with underscore', () => {
      expect(sanitizeFilename('Time: 10:30')).toBe('Time_ 10_30');
    });

    it('should replace asterisk with underscore', () => {
      expect(sanitizeFilename('test*wild')).toBe('test_wild');
    });

    it('should replace question mark with underscore', () => {
      expect(sanitizeFilename('Why?')).toBe('Why_');
    });

    it('should replace double quotes with underscore', () => {
      expect(sanitizeFilename('He said "hello"')).toBe('He said _hello_');
    });

    it('should replace angle brackets with underscore', () => {
      expect(sanitizeFilename('<html>')).toBe('_html_');
    });

    it('should replace pipe with underscore', () => {
      expect(sanitizeFilename('a | b')).toBe('a _ b');
    });

    it('should replace multiple special characters', () => {
      expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    });

    it('should keep normal characters unchanged', () => {
      expect(sanitizeFilename('Hello World 123')).toBe('Hello World 123');
    });

    it('should keep Korean characters unchanged', () => {
      expect(sanitizeFilename('안녕하세요')).toBe('안녕하세요');
    });

    it('should keep emoji unchanged', () => {
      expect(sanitizeFilename('Chat 🤖')).toBe('Chat 🤖');
    });
  });
});
