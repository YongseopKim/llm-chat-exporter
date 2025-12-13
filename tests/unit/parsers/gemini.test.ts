/**
 * GeminiParser Unit Tests (TDD - RED Phase)
 *
 * These tests are written BEFORE implementation to define expected behavior.
 * Expected initial state: 0/20 tests passing (all FAIL)
 *
 * Gemini uses custom elements (<user-query>, <model-response>) for messages.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiParser } from '../../../src/content/parsers/gemini';
import { loadSampleHTML, createDOMFromHTML } from './shared/fixtures';

describe('GeminiParser', () => {
  let parser: GeminiParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new GeminiParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  // ============================================================
  // canHandle() - 5 tests
  // ============================================================

  describe('canHandle', () => {
    it('should return true for exact gemini.google.com hostname', () => {
      expect(parser.canHandle('gemini.google.com')).toBe(true);
    });

    it('should return true for gemini.google.com with subdomain', () => {
      expect(parser.canHandle('www.gemini.google.com')).toBe(true);
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
  // getMessageNodes() - 6 tests
  // ============================================================

  describe('getMessageNodes', () => {
    it('should extract 2+ messages from sample HTML', () => {
      const html = loadSampleHTML('gemini');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array when no messages exist', () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes).toEqual([]);
    });

    it('should find user-query and model-response custom elements', () => {
      const doc = createDOMFromHTML(`
        <user-query><div class="query-text">User question</div></user-query>
        <model-response><div class="response-container-content">AI answer</div></model-response>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBe(2);
      expect(nodes[0].tagName.toLowerCase()).toBe('user-query');
      expect(nodes[1].tagName.toLowerCase()).toBe('model-response');
    });

    it('should preserve message order (user then assistant alternating)', () => {
      const html = loadSampleHTML('gemini');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      if (nodes.length >= 2) {
        const firstTag = nodes[0].tagName.toLowerCase();
        expect(firstTag).toBe('user-query');
      }
    });

    it('should handle malformed DOM gracefully', () => {
      const doc = createDOMFromHTML(`
        <div>Not a custom element</div>
      `);
      global.document = doc as any;

      expect(() => parser.getMessageNodes()).not.toThrow();
    });

    it('should handle multiple messages from sample', () => {
      const html = loadSampleHTML('gemini');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      // Gemini sample has at least 2 messages
      // Note: Actual count may vary based on sample file structure
      expect(nodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // parseNode() - 7 tests
  // ============================================================

  describe('parseNode', () => {
    it('should parse user message from sample HTML', () => {
      const html = loadSampleHTML('gemini');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const userNode = nodes.find((n) => n.tagName.toLowerCase() === 'user-query');

      if (userNode) {
        const parsed = parser.parseNode(userNode);
        expect(parsed.role).toBe('user');
        expect(parsed.contentHtml).toBeTruthy();
        expect(parsed.contentHtml.length).toBeGreaterThan(0);
      } else {
        expect.fail('No user-query element found in sample HTML');
      }
    });

    it('should parse assistant message from sample HTML', () => {
      const html = loadSampleHTML('gemini');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const assistantNode = nodes.find((n) => n.tagName.toLowerCase() === 'model-response');

      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);
        expect(parsed.role).toBe('assistant');
        expect(parsed.contentHtml).toBeTruthy();
        expect(parsed.contentHtml.length).toBeGreaterThan(50);
      } else {
        expect.fail('No model-response element found in sample HTML');
      }
    });

    it('should detect user role from user-query tag name', () => {
      const doc = createDOMFromHTML(`
        <user-query><div class="query-text">Question</div></user-query>
      `);
      const userNode = doc.querySelector('user-query') as HTMLElement;

      const parsed = parser.parseNode(userNode);

      expect(parsed.role).toBe('user');
    });

    it('should detect assistant role from model-response tag name', () => {
      const doc = createDOMFromHTML(`
        <model-response><div class="response-container-content">Answer</div></model-response>
      `);
      const assistantNode = doc.querySelector('model-response') as HTMLElement;

      const parsed = parser.parseNode(assistantNode);

      expect(parsed.role).toBe('assistant');
    });

    it('should preserve HTML structure in content', () => {
      const doc = createDOMFromHTML(`
        <model-response>
          <div class="response-container-content">
            <p>Paragraph</p>
            <pre><code>Code block</code></pre>
          </div>
        </model-response>
      `);
      const node = doc.querySelector('model-response') as HTMLElement;

      const parsed = parser.parseNode(node);

      expect(parsed.contentHtml).toContain('<p>');
      expect(parsed.contentHtml).toContain('<pre>');
      expect(parsed.contentHtml).toContain('Code block');
    });

    it('should handle empty content gracefully', () => {
      const doc = createDOMFromHTML(`
        <user-query><div class="query-text"></div></user-query>
      `);
      const node = doc.querySelector('user-query') as HTMLElement;

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('user');
      expect(parsed.contentHtml).toBe('');
    });

    it('should throw error for unknown element type', () => {
      const doc = createDOMFromHTML(`
        <div>Not a custom element</div>
      `);
      const node = doc.querySelector('div') as HTMLElement;

      expect(() => parser.parseNode(node)).toThrow();
    });
  });

  // ============================================================
  // isGenerating() - 4 tests
  // ============================================================

  describe('isGenerating', () => {
    it('should return false when not generating', () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should return true when Stop button exists', () => {
      const doc = createDOMFromHTML('<button aria-label="Stop generating">Stop</button>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(true);
    });

    it('should return false for empty document', () => {
      const doc = createDOMFromHTML('');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should check aria-label contains "Stop"', () => {
      const doc = createDOMFromHTML('<button aria-label="Stop response generation">Stop</button>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(true);
    });
  });

  // ============================================================
  // loadAllMessages() - 3 tests
  // ============================================================

  describe('loadAllMessages', () => {
    it('should resolve without error when not generating', async () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      await expect(parser.loadAllMessages()).resolves.toBeUndefined();
    });

    it('should throw error when response is generating', async () => {
      const doc = createDOMFromHTML('<button aria-label="Stop generating">Stop</button>');
      global.document = doc as any;

      await expect(parser.loadAllMessages()).rejects.toThrow(/generating/i);
    });

    it('should call scrollToLoadAll utility', async () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      // Mock window.scrollTo
      global.window = { scrollTo: vi.fn() } as any;

      await parser.loadAllMessages();

      // Verify scrolling happened (indirect test via scroller utility)
      expect(global.window.scrollTo).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getTitle() - 2 tests
  // ============================================================

  describe('getTitle', () => {
    it('should extract title from DOM selector', () => {
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue({ textContent: 'My Gemini Chat' }),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('My Gemini Chat');
    });

    it('should return undefined when title element not found', () => {
      const mockDoc = {
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBeUndefined();
    });
  });
});
