/**
 * ClaudeParser Unit Tests (TDD - RED Phase)
 *
 * These tests are written BEFORE implementation to define expected behavior.
 * Expected initial state: 0/28 tests passing (all FAIL)
 *
 * Claude uses a hybrid approach: data-testid attributes for user messages,
 * class-based detection for assistant messages (.font-claude-response).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { loadSampleHTML, createDOMFromHTML } from './shared/fixtures';

describe('ClaudeParser', () => {
  let parser: ClaudeParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new ClaudeParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  // ============================================================
  // canHandle() - 5 tests
  // ============================================================

  describe('canHandle', () => {
    it('should return true for exact claude.ai hostname', () => {
      expect(parser.canHandle('claude.ai')).toBe(true);
    });

    it('should return true for claude.ai with subdomain', () => {
      expect(parser.canHandle('www.claude.ai')).toBe(true);
    });

    it('should return false for chatgpt.com hostname', () => {
      expect(parser.canHandle('chatgpt.com')).toBe(false);
    });

    it('should return false for gemini.google.com hostname', () => {
      expect(parser.canHandle('gemini.google.com')).toBe(false);
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
      const html = loadSampleHTML('claude');
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

    it('should find user messages with data-testid="user-message"', () => {
      const doc = createDOMFromHTML(`
        <div data-testid="user-message" class="font-user-message">
          <p class="whitespace-pre-wrap">User question</p>
        </div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].getAttribute('data-testid')).toBe('user-message');
    });

    it('should find assistant messages with data-testid="assistant-message"', () => {
      const doc = createDOMFromHTML(`
        <div data-testid="assistant-message" class="font-claude-response">
          <div class="standard-markdown"><p>Answer</p></div>
        </div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].getAttribute('data-testid')).toBe('assistant-message');
    });

    it('should preserve message order (user then assistant alternating)', () => {
      const html = loadSampleHTML('claude');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      if (nodes.length >= 2) {
        const firstTestId = nodes[0].getAttribute('data-testid');
        expect(firstTestId).toBe('user-message');
      }
    });

    it('should handle malformed DOM gracefully', () => {
      const doc = createDOMFromHTML(`
        <div>Not a message element</div>
      `);
      global.document = doc as any;

      expect(() => parser.getMessageNodes()).not.toThrow();
    });
  });

  // ============================================================
  // parseNode() - 7 tests
  // ============================================================

  describe('parseNode', () => {
    it('should parse user message from sample HTML', () => {
      const html = loadSampleHTML('claude');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const userNode = nodes.find((n) => n.getAttribute('data-testid') === 'user-message');

      if (userNode) {
        const parsed = parser.parseNode(userNode);
        expect(parsed.role).toBe('user');
        expect(parsed.contentHtml).toBeTruthy();
        expect(parsed.contentHtml.length).toBeGreaterThan(0);
      } else {
        expect.fail('No user message found in sample HTML');
      }
    });

    it('should parse assistant message from sample HTML', () => {
      const html = loadSampleHTML('claude');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      // Support both data-testid="assistant-message" (newer UI) and data-is-streaming (current UI)
      const assistantNode = nodes.find(
        (n) => n.getAttribute('data-testid') === 'assistant-message' || n.hasAttribute('data-is-streaming')
      );

      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);
        expect(parsed.role).toBe('assistant');
        expect(parsed.contentHtml).toBeTruthy();
        expect(parsed.contentHtml.length).toBeGreaterThan(50);
      } else {
        expect.fail('No assistant message found in sample HTML');
      }
    });

    it('should detect user role from data-testid="user-message"', () => {
      const doc = createDOMFromHTML(`
        <div data-testid="user-message" class="font-user-message">
          <p class="whitespace-pre-wrap">Question</p>
        </div>
      `);
      const userNode = doc.querySelector('[data-testid="user-message"]') as HTMLElement;

      const parsed = parser.parseNode(userNode);

      expect(parsed.role).toBe('user');
    });

    it('should detect assistant role from data-testid="assistant-message"', () => {
      const doc = createDOMFromHTML(`
        <div data-testid="assistant-message" class="font-claude-response">
          <div class="standard-markdown"><p>Answer</p></div>
        </div>
      `);
      const assistantNode = doc.querySelector('[data-testid="assistant-message"]') as HTMLElement;

      const parsed = parser.parseNode(assistantNode);

      expect(parsed.role).toBe('assistant');
    });

    it('should preserve HTML structure in content', () => {
      const doc = createDOMFromHTML(`
        <div data-testid="assistant-message" class="font-claude-response">
          <div class="standard-markdown">
            <p>Paragraph</p>
            <pre><code>Code block</code></pre>
            <ul><li>List item</li></ul>
          </div>
        </div>
      `);
      const node = doc.querySelector('[data-testid="assistant-message"]') as HTMLElement;

      const parsed = parser.parseNode(node);

      expect(parsed.contentHtml).toContain('<p>');
      expect(parsed.contentHtml).toContain('<pre>');
      expect(parsed.contentHtml).toContain('<ul>');
      expect(parsed.contentHtml).toContain('Code block');
    });

    it('should handle empty content gracefully', () => {
      const doc = createDOMFromHTML(`
        <div data-testid="user-message" class="font-user-message">
          <p class="whitespace-pre-wrap"></p>
        </div>
      `);
      const node = doc.querySelector('[data-testid="user-message"]') as HTMLElement;

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('user');
      expect(parsed.contentHtml).toBe('');
    });

    it('should throw error for unknown element type', () => {
      const doc = createDOMFromHTML(`
        <div>Not a message element</div>
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

    it('should return true when data-is-streaming="true" exists', () => {
      const doc = createDOMFromHTML(`
        <div data-is-streaming="true" class="font-claude-response">
          <div class="standard-markdown"><p>Generating...</p></div>
        </div>
      `);
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(true);
    });

    it('should return false when data-is-streaming="false"', () => {
      const doc = createDOMFromHTML(`
        <div data-is-streaming="false" class="font-claude-response">
          <div class="standard-markdown"><p>Complete response</p></div>
        </div>
      `);
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
  // getTitle() - 3 tests
  // ============================================================

  describe('getTitle', () => {
    it('should extract title when present', () => {
      const doc = createDOMFromHTML('<h1>Claude Conversation</h1>');
      global.document = doc as any;

      const result = parser.getTitle();

      expect(result).toBe('Claude Conversation');
    });

    it('should return null when no title exists', () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      const result = parser.getTitle();

      expect(result).toBeNull();
    });

    it('should return null when title is empty', () => {
      const doc = createDOMFromHTML('<h1></h1>');
      global.document = doc as any;

      const result = parser.getTitle();

      expect(result).toBeNull();
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
      const doc = createDOMFromHTML(`
        <div data-is-streaming="true" class="font-claude-response">
          <div class="standard-markdown"><p>Generating...</p></div>
        </div>
      `);
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
});
