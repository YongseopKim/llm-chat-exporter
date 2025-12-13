/**
 * BaseParser Unit Tests
 *
 * Tests for the abstract BaseParser class.
 * Uses a concrete test implementation to test abstract class behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseParser } from '../../src/content/parsers/base-parser';
import { ConfigLoader } from '../../src/content/parsers/config-loader';
import type { PlatformKey } from '../../src/content/parsers/config-types';

// Test implementation of BaseParser
class TestParser extends BaseParser {
  constructor(platformKey: PlatformKey) {
    super(platformKey);
  }
}

describe('BaseParser', () => {
  let originalDocument: Document;

  beforeEach(() => {
    ConfigLoader.resetInstance();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
    ConfigLoader.resetInstance();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create parser for chatgpt platform', () => {
      const parser = new TestParser('chatgpt');
      expect(parser.canHandle('chatgpt.com')).toBe(true);
    });

    it('should create parser for claude platform', () => {
      const parser = new TestParser('claude');
      expect(parser.canHandle('claude.ai')).toBe(true);
    });

    it('should create parser for gemini platform', () => {
      const parser = new TestParser('gemini');
      expect(parser.canHandle('gemini.google.com')).toBe(true);
    });
  });

  describe('canHandle', () => {
    it('should return true for matching hostname (chatgpt)', () => {
      const parser = new TestParser('chatgpt');
      expect(parser.canHandle('chatgpt.com')).toBe(true);
      expect(parser.canHandle('www.chatgpt.com')).toBe(true);
      expect(parser.canHandle('CHATGPT.COM')).toBe(true);
    });

    it('should return true for matching hostname (claude)', () => {
      const parser = new TestParser('claude');
      expect(parser.canHandle('claude.ai')).toBe(true);
      expect(parser.canHandle('www.claude.ai')).toBe(true);
    });

    it('should return true for matching hostname (gemini)', () => {
      const parser = new TestParser('gemini');
      expect(parser.canHandle('gemini.google.com')).toBe(true);
    });

    it('should return false for non-matching hostname', () => {
      const parser = new TestParser('chatgpt');
      expect(parser.canHandle('claude.ai')).toBe(false);
      expect(parser.canHandle('gemini.google.com')).toBe(false);
    });

    it('should return false for empty hostname', () => {
      const parser = new TestParser('chatgpt');
      expect(parser.canHandle('')).toBe(false);
    });
  });

  describe('getMessageNodes', () => {
    it('should return empty array when no messages found', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes).toEqual([]);
    });

    it('should use primary selector for ChatGPT (fallback chain)', () => {
      const parser = new TestParser('chatgpt');
      const mockNodes = [
        { getAttribute: vi.fn().mockReturnValue('user') },
        { getAttribute: vi.fn().mockReturnValue('assistant') },
      ];
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue(mockNodes),
      };
      global.document = mockDoc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes).toHaveLength(2);
      expect(mockDoc.querySelectorAll).toHaveBeenCalledWith('[data-message-author-role]');
    });

    it('should use combined selector for Claude', () => {
      const parser = new TestParser('claude');
      const mockNodes = [{ tagName: 'div' }];
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue(mockNodes),
      };
      global.document = mockDoc as any;

      parser.getMessageNodes();
      expect(mockDoc.querySelectorAll).toHaveBeenCalledWith(
        '[data-testid="user-message"], [data-is-streaming], [data-testid="assistant-message"]'
      );
    });

    it('should use combined selector for Gemini', () => {
      const parser = new TestParser('gemini');
      const mockNodes = [{ tagName: 'user-query' }];
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue(mockNodes),
      };
      global.document = mockDoc as any;

      parser.getMessageNodes();
      expect(mockDoc.querySelectorAll).toHaveBeenCalledWith('user-query, model-response');
    });

    it('should try fallback selectors when primary returns empty (ChatGPT)', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        querySelectorAll: vi
          .fn()
          .mockReturnValueOnce([]) // primary fails
          .mockReturnValueOnce([{ tagName: 'div' }]), // first fallback succeeds
      };
      global.document = mockDoc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes).toHaveLength(1);
      expect(mockDoc.querySelectorAll).toHaveBeenCalledTimes(2);
      expect(mockDoc.querySelectorAll).toHaveBeenNthCalledWith(2, '[data-turn]');
    });
  });

  describe('parseNode - attribute strategy (ChatGPT)', () => {
    it('should parse user message with data-message-author-role', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-message-author-role') return 'user';
          return null;
        }),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Hello</p>' }),
        attributes: [],
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('user');
      expect(result.contentHtml).toBe('<p>Hello</p>');
    });

    it('should parse assistant message with data-message-author-role', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-message-author-role') return 'assistant';
          return null;
        }),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Hi there</p>' }),
        attributes: [],
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('assistant');
      expect(result.contentHtml).toBe('<p>Hi there</p>');
    });

    it('should use fallback attribute (data-turn) when primary missing', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-turn') return 'user';
          return null;
        }),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Test</p>' }),
        attributes: [],
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('user');
    });

    it('should throw error when role cannot be determined', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn().mockReturnValue(null),
        querySelector: vi.fn().mockReturnValue(null),
        attributes: [],
      } as any;

      expect(() => parser.parseNode(mockNode)).toThrow(/Cannot determine message role/);
    });
  });

  describe('parseNode - hybrid strategy (Claude)', () => {
    it('should parse user message with data-testid', () => {
      const parser = new TestParser('claude');
      const mockNode = {
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-testid') return 'user-message';
          return null;
        }),
        hasAttribute: vi.fn().mockReturnValue(false),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>User text</p>' }),
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('user');
    });

    it('should parse assistant message with data-testid', () => {
      const parser = new TestParser('claude');
      const mockNode = {
        getAttribute: vi.fn((attr) => {
          if (attr === 'data-testid') return 'assistant-message';
          return null;
        }),
        hasAttribute: vi.fn().mockReturnValue(false),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Assistant text</p>' }),
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('assistant');
    });

    it('should detect assistant via streaming attribute presence', () => {
      const parser = new TestParser('claude');
      const mockNode = {
        getAttribute: vi.fn().mockReturnValue(null),
        hasAttribute: vi.fn((attr) => attr === 'data-is-streaming'),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Streaming</p>' }),
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('assistant');
    });
  });

  describe('parseNode - tagname strategy (Gemini)', () => {
    it('should parse user-query element as user', () => {
      const parser = new TestParser('gemini');
      const mockNode = {
        tagName: 'USER-QUERY',
        getAttribute: vi.fn().mockReturnValue(null),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Query</p>' }),
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('user');
    });

    it('should parse model-response element as assistant', () => {
      const parser = new TestParser('gemini');
      const mockNode = {
        tagName: 'MODEL-RESPONSE',
        getAttribute: vi.fn().mockReturnValue(null),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Response</p>' }),
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.role).toBe('assistant');
    });

    it('should throw error for unknown tag name', () => {
      const parser = new TestParser('gemini');
      const mockNode = {
        tagName: 'UNKNOWN-ELEMENT',
        getAttribute: vi.fn().mockReturnValue(null),
        querySelector: vi.fn().mockReturnValue(null),
        id: '',
        className: '',
        innerHTML: 'test',
      } as any;

      expect(() => parser.parseNode(mockNode)).toThrow(/Cannot determine message role/);
    });
  });

  describe('isGenerating', () => {
    it('should return true when generation selector matches (ChatGPT)', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue({ tagName: 'button' }),
      };
      global.document = mockDoc as any;

      expect(parser.isGenerating()).toBe(true);
      expect(mockDoc.querySelector).toHaveBeenCalledWith('button[aria-label*="Stop"]');
    });

    it('should return false when generation selector does not match', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(null),
      };
      global.document = mockDoc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should use attribute-based detection for Claude', () => {
      const parser = new TestParser('claude');
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue({ tagName: 'div' }),
      };
      global.document = mockDoc as any;

      expect(parser.isGenerating()).toBe(true);
      expect(mockDoc.querySelector).toHaveBeenCalledWith('[data-is-streaming="true"]');
    });
  });

  describe('loadAllMessages', () => {
    it('should throw error when generating', async () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue({ tagName: 'button' }),
      };
      global.document = mockDoc as any;

      await expect(parser.loadAllMessages()).rejects.toThrow(
        /Cannot export while response is generating/
      );
    });

    it('should resolve when not generating', async () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(null),
      };
      global.document = mockDoc as any;

      // Mock window.scrollTo
      global.window = { scrollTo: vi.fn() } as any;

      await expect(parser.loadAllMessages()).resolves.toBeUndefined();
    });
  });

  describe('getTitle - document-title strategy', () => {
    it('should extract title from document.title for ChatGPT', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        title: 'ChatGPT - My Test Conversation',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('My Test Conversation');
    });

    it('should remove emoji from title', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        title: 'ChatGPT - 🚀 My Test Conversation',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('My Test Conversation');
    });

    it('should handle title with suffix pattern (Grok)', () => {
      const parser = new TestParser('grok');
      const mockDoc = {
        title: 'AI Discussion - Grok',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('AI Discussion');
    });

    it('should return undefined for empty document.title', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        title: '',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBeUndefined();
    });

    it('should return undefined for title with only prefix', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        title: 'ChatGPT - ',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBeUndefined();
    });

    it('should handle different dash characters', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        title: 'ChatGPT – Test with en-dash',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('Test with en-dash');
    });

    it('should handle em-dash in prefix (ChatGPT)', () => {
      const parser = new TestParser('chatgpt');
      const mockDoc = {
        title: 'ChatGPT—Test with em-dash',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('Test with em-dash');
    });

    it('should handle em-dash in suffix (Grok)', () => {
      const parser = new TestParser('grok');
      const mockDoc = {
        title: 'Test with em-dash—Grok',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('Test with em-dash');
    });
  });

  describe('getTitle - selector strategy', () => {
    it('should extract title from DOM element for Claude', () => {
      const parser = new TestParser('claude');
      const mockElement = {
        textContent: 'My Claude Chat',
      };
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(mockElement),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('My Claude Chat');
    });

    it('should return undefined when selector finds no element', () => {
      const parser = new TestParser('claude');
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBeUndefined();
    });

    it('should return undefined when element has empty text', () => {
      const parser = new TestParser('gemini');
      const mockElement = {
        textContent: '   ',
      };
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(mockElement),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBeUndefined();
    });

    it('should trim whitespace from selector result', () => {
      const parser = new TestParser('claude');
      const mockElement = {
        textContent: '  Title with spaces  ',
      };
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(mockElement),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('Title with spaces');
    });

    it('should remove emoji from selector result when emojiPattern provided (Claude)', () => {
      const parser = new TestParser('claude');
      const mockElement = {
        textContent: '☑️Zcash',
      };
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(mockElement),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('Zcash');
    });

    it('should remove emoji from selector result when emojiPattern provided (Gemini)', () => {
      const parser = new TestParser('gemini');
      const mockElement = {
        textContent: '🎯 Tech Discussion',
      };
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(mockElement),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const title = parser.getTitle();
      expect(title).toBe('Tech Discussion');
    });
  });

  describe('getTitle - error handling', () => {
    it('should log warning but not throw on selector error', () => {
      const parser = new TestParser('claude');
      const mockDoc = {
        querySelector: vi.fn().mockImplementation(() => {
          throw new Error('Selector error');
        }),
        querySelectorAll: vi.fn(),
      };
      global.document = mockDoc as any;

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const title = parser.getTitle();
      expect(title).toBeUndefined();
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });

    // This test must be last in this describe block since it modifies global.document in a way
    // that cannot be fully restored by afterEach
    it('should return undefined on document.title access error', () => {
      const parser = new TestParser('chatgpt');
      const savedDocument = global.document;

      Object.defineProperty(global, 'document', {
        get: () => {
          throw new Error('Document not accessible');
        },
        configurable: true,
      });

      const title = parser.getTitle();
      expect(title).toBeUndefined();

      // Restore document for other tests
      Object.defineProperty(global, 'document', {
        value: savedDocument,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('content extraction', () => {
    it('should use correct content selector for user (ChatGPT)', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn((attr) =>
          attr === 'data-message-author-role' ? 'user' : null
        ),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Content</p>' }),
        attributes: [],
      } as any;

      parser.parseNode(mockNode);
      expect(mockNode.querySelector).toHaveBeenCalledWith('.whitespace-pre-wrap');
    });

    it('should use correct content selector for assistant (ChatGPT)', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn((attr) =>
          attr === 'data-message-author-role' ? 'assistant' : null
        ),
        querySelector: vi.fn().mockReturnValue({ innerHTML: '<p>Content</p>' }),
        attributes: [],
      } as any;

      parser.parseNode(mockNode);
      expect(mockNode.querySelector).toHaveBeenCalledWith('.markdown');
    });

    it('should return empty string when content element not found', () => {
      const parser = new TestParser('chatgpt');
      const mockNode = {
        getAttribute: vi.fn((attr) =>
          attr === 'data-message-author-role' ? 'user' : null
        ),
        querySelector: vi.fn().mockReturnValue(null),
        attributes: [],
      } as any;

      const result = parser.parseNode(mockNode);
      expect(result.contentHtml).toBe('');
    });
  });
});
