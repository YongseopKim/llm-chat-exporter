/**
 * Background Utils 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { isSupportedUrl, getPlatformName, generateFilename, SUPPORTED_HOSTS } from '../../src/utils/background-utils';

describe('background-utils', () => {
  describe('SUPPORTED_HOSTS', () => {
    it('should contain three platforms', () => {
      expect(SUPPORTED_HOSTS).toHaveLength(3);
      expect(SUPPORTED_HOSTS).toContain('chatgpt.com');
      expect(SUPPORTED_HOSTS).toContain('claude.ai');
      expect(SUPPORTED_HOSTS).toContain('gemini.google.com');
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
  });
});
