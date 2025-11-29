/**
 * ConfigLoader Unit Tests
 *
 * Tests for the configuration loader singleton.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigLoader } from '../../src/content/parsers/config-loader';

describe('ConfigLoader', () => {
  beforeEach(() => {
    // Reset singleton before each test
    ConfigLoader.resetInstance();
  });

  afterEach(() => {
    // Ensure clean state after each test
    ConfigLoader.resetInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConfigLoader.getInstance();
      const instance2 = ConfigLoader.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return valid ConfigLoader instance', () => {
      const instance = ConfigLoader.getInstance();
      expect(instance).toBeInstanceOf(ConfigLoader);
    });
  });

  describe('getConfig', () => {
    it('should return full configuration', () => {
      const config = ConfigLoader.getInstance().getConfig();
      expect(config).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.platforms).toBeDefined();
    });

    it('should have all three platforms', () => {
      const config = ConfigLoader.getInstance().getConfig();
      expect(config.platforms.chatgpt).toBeDefined();
      expect(config.platforms.claude).toBeDefined();
      expect(config.platforms.gemini).toBeDefined();
    });
  });

  describe('getPlatformConfig', () => {
    it('should return ChatGPT platform config', () => {
      const config = ConfigLoader.getInstance().getPlatformConfig('chatgpt');
      expect(config.hostname).toBe('chatgpt.com');
      expect(config.selectors).toBeDefined();
    });

    it('should return Claude platform config', () => {
      const config = ConfigLoader.getInstance().getPlatformConfig('claude');
      expect(config.hostname).toBe('claude.ai');
      expect(config.selectors).toBeDefined();
    });

    it('should return Gemini platform config', () => {
      const config = ConfigLoader.getInstance().getPlatformConfig('gemini');
      expect(config.hostname).toBe('gemini.google.com');
      expect(config.selectors).toBeDefined();
    });

    it('should throw for unknown platform', () => {
      expect(() =>
        ConfigLoader.getInstance().getPlatformConfig('unknown' as any)
      ).toThrow(/Unknown platform/);
    });
  });

  describe('getSelectors', () => {
    it('should return ChatGPT selectors with attribute strategy', () => {
      const selectors = ConfigLoader.getInstance().getSelectors('chatgpt');
      expect(selectors.role.strategy).toBe('attribute');
      expect(selectors.role.attributes).toContain('data-message-author-role');
      expect(selectors.generation).toBe('button[aria-label*="Stop"]');
    });

    it('should return Claude selectors with hybrid strategy', () => {
      const selectors = ConfigLoader.getInstance().getSelectors('claude');
      expect(selectors.role.strategy).toBe('hybrid');
      expect(selectors.role.userTestId).toBe('user-message');
      expect(selectors.role.streamingAttribute).toBe('data-is-streaming');
      expect(selectors.generation).toBe('[data-is-streaming="true"]');
    });

    it('should return Gemini selectors with tagname strategy', () => {
      const selectors = ConfigLoader.getInstance().getSelectors('gemini');
      expect(selectors.role.strategy).toBe('tagname');
      expect(selectors.role.userTag).toBe('user-query');
      expect(selectors.role.assistantTag).toBe('model-response');
    });

    it('should return message selectors for ChatGPT (primary with fallbacks)', () => {
      const selectors = ConfigLoader.getInstance().getSelectors('chatgpt');
      expect(selectors.messages.primary).toBe('[data-message-author-role]');
      expect(selectors.messages.fallbacks).toContain('[data-turn]');
    });

    it('should return message selectors for Claude (combined)', () => {
      const selectors = ConfigLoader.getInstance().getSelectors('claude');
      expect(selectors.messages.combined).toContain('[data-testid="user-message"]');
      expect(selectors.messages.combined).toContain('[data-is-streaming]');
    });

    it('should return message selectors for Gemini (combined)', () => {
      const selectors = ConfigLoader.getInstance().getSelectors('gemini');
      expect(selectors.messages.combined).toBe('user-query, model-response');
    });

    it('should return content selectors for all platforms', () => {
      const chatgpt = ConfigLoader.getInstance().getSelectors('chatgpt');
      const claude = ConfigLoader.getInstance().getSelectors('claude');
      const gemini = ConfigLoader.getInstance().getSelectors('gemini');

      expect(chatgpt.content.user).toBe('.whitespace-pre-wrap');
      expect(chatgpt.content.assistant).toBe('.markdown');

      expect(claude.content.user).toBe('.whitespace-pre-wrap');
      expect(claude.content.assistant).toBe('.standard-markdown, .progressive-markdown');

      expect(gemini.content.user).toBe('.query-text');
      expect(gemini.content.assistant).toBe('.response-container-content');
    });
  });

  describe('getHostname', () => {
    it('should return correct hostname for each platform', () => {
      const loader = ConfigLoader.getInstance();
      expect(loader.getHostname('chatgpt')).toBe('chatgpt.com');
      expect(loader.getHostname('claude')).toBe('claude.ai');
      expect(loader.getHostname('gemini')).toBe('gemini.google.com');
    });
  });
});
