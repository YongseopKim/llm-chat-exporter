/**
 * PerplexityParser Unit Tests
 *
 * Perplexity uses:
 * - User messages: h1.group/query with span.select-text (plain text)
 * - Assistant messages: div[id^="markdown-content-"] with div.prose (HTML)
 * - Role detection: combined-selector strategy (node.matches())
 * - No generation detection (always false)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerplexityParser } from '../../../src/content/parsers/perplexity';
import { loadSampleHTML, createDOMFromHTML } from './shared/fixtures';
import {
  createMockPerplexityUserMessage,
  createMockPerplexityAssistantMessage,
} from './shared/mocks';

describe('PerplexityParser', () => {
  let parser: PerplexityParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new PerplexityParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  // ============================================================
  // canHandle() - 5 tests
  // ============================================================

  describe('canHandle', () => {
    it('should return true for exact perplexity.ai hostname', () => {
      expect(parser.canHandle('perplexity.ai')).toBe(true);
    });

    it('should return true for www.perplexity.ai hostname', () => {
      expect(parser.canHandle('www.perplexity.ai')).toBe(true);
    });

    it('should return false for chatgpt.com hostname', () => {
      expect(parser.canHandle('chatgpt.com')).toBe(false);
    });

    it('should return false for claude.ai hostname', () => {
      expect(parser.canHandle('claude.ai')).toBe(false);
    });

    it('should return false for empty hostname', () => {
      expect(parser.canHandle('')).toBe(false);
    });
  });

  // ============================================================
  // getMessageNodes() - 5 tests
  // ============================================================

  describe('getMessageNodes', () => {
    it('should extract 4 messages from sample HTML', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBe(4);
    });

    it('should return empty array when no messages exist', () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes).toEqual([]);
    });

    it('should find both user queries and assistant responses', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      // First and third should be h1 (user), second and fourth should be div (assistant)
      expect(nodes[0].tagName.toLowerCase()).toBe('h1');
      expect(nodes[1].tagName.toLowerCase()).toBe('div');
      expect(nodes[2].tagName.toLowerCase()).toBe('h1');
      expect(nodes[3].tagName.toLowerCase()).toBe('div');
    });

    it('should preserve message order', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      // First message should be a user query
      expect(nodes[0].classList.contains('group/query')).toBe(true);
    });

    it('should handle malformed DOM gracefully', () => {
      const doc = createDOMFromHTML('<div>Not a message</div>');
      global.document = doc as any;

      expect(() => parser.getMessageNodes()).not.toThrow();
      expect(parser.getMessageNodes()).toEqual([]);
    });
  });

  // ============================================================
  // parseNode() - 7 tests
  // ============================================================

  describe('parseNode', () => {
    it('should parse user message from sample HTML', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const parsed = parser.parseNode(nodes[0]);

      expect(parsed.role).toBe('user');
      expect(parsed.contentHtml).toContain('What is TypeScript?');
    });

    it('should parse assistant message from sample HTML', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const parsed = parser.parseNode(nodes[1]);

      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('strongly typed programming language');
    });

    it('should detect user role from mock user message', () => {
      const node = createMockPerplexityUserMessage('What is TypeScript?');

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('user');
    });

    it('should detect assistant role from mock assistant message', () => {
      const node = createMockPerplexityAssistantMessage('<p>TypeScript is a language.</p>');

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('assistant');
    });

    it('should wrap user content in paragraph tags', () => {
      const node = createMockPerplexityUserMessage('Hello world');

      const parsed = parser.parseNode(node);

      expect(parsed.contentHtml).toBe('<p>Hello world</p>');
    });

    it('should preserve HTML structure in assistant content', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const parsed = parser.parseNode(nodes[1]);

      expect(parsed.contentHtml).toContain('<ul>');
      expect(parsed.contentHtml).toContain('<li>');
      expect(parsed.contentHtml).toContain('<strong>');
    });

    it('should handle assistant message with code block', () => {
      const html = loadSampleHTML('perplexity');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      // Fourth message (index 3) has a code block
      const parsed = parser.parseNode(nodes[3]);

      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('<pre>');
      expect(parsed.contentHtml).toContain('<code');
    });
  });

  // ============================================================
  // isGenerating() - 2 tests
  // ============================================================

  describe('isGenerating', () => {
    it('should always return false', () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should return false for empty document', () => {
      const doc = createDOMFromHTML('');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });
  });

  // ============================================================
  // loadAllMessages() - 2 tests
  // ============================================================

  describe('loadAllMessages', () => {
    it('should resolve without error', async () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      await expect(parser.loadAllMessages()).resolves.toBeUndefined();
    });

    it('should call scrollToLoadAll utility', async () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;
      global.window = { scrollTo: vi.fn() } as any;

      await parser.loadAllMessages();

      expect(global.window.scrollTo).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getTitle() - 3 tests
  // ============================================================

  describe('getTitle', () => {
    it('should extract title from document.title removing suffix', () => {
      const mockDoc = {
        title: 'What is TypeScript - Perplexity',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('What is TypeScript');
    });

    it('should handle title with en-dash', () => {
      const mockDoc = {
        title: 'React Hooks – Perplexity',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('React Hooks');
    });

    it('should remove emoji from title', () => {
      const mockDoc = {
        title: '🔍 Search Query - Perplexity',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('Search Query');
    });
  });
});
