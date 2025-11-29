/**
 * ChatGPTParser Unit Tests (TDD - RED Phase)
 *
 * These tests are written BEFORE implementation to define expected behavior.
 * Expected initial state: 0/20 tests passing (all FAIL)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { loadSampleHTML, createDOMFromHTML } from './shared/fixtures';
import {
  createMockChatGPTUserMessage,
  createMockChatGPTAssistantMessage,
  createMockGeneratingButton,
  createMockTitle,
  createMockEmptyMessage,
  createMockMessageWithCode,
  createMockMessageWithTable,
} from './shared/mocks';

describe('ChatGPTParser', () => {
  let parser: ChatGPTParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new ChatGPTParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  // ============================================================
  // canHandle() - 5 tests
  // ============================================================

  describe('canHandle', () => {
    it('should return true for exact chatgpt.com hostname', () => {
      expect(parser.canHandle('chatgpt.com')).toBe(true);
    });

    it('should return true for www.chatgpt.com hostname', () => {
      expect(parser.canHandle('www.chatgpt.com')).toBe(true);
    });

    it('should return false for claude.ai hostname', () => {
      expect(parser.canHandle('claude.ai')).toBe(false);
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
    it('should extract 2 messages from sample HTML', () => {
      const html = loadSampleHTML('chatgpt');
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

    it('should find messages using data-message-author-role selector', () => {
      const doc = createDOMFromHTML(`
        <div data-message-author-role="user">User message</div>
        <div data-message-author-role="assistant">AI message</div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBe(2);
    });

    it('should use fallback selector when primary fails', () => {
      const doc = createDOMFromHTML(`
        <article data-turn="user"><div>User</div></article>
        <article data-turn="assistant"><div>AI</div></article>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should preserve message order (user then assistant)', () => {
      const html = loadSampleHTML('chatgpt');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      if (nodes.length >= 2) {
        const firstRole = nodes[0].getAttribute('data-message-author-role') || nodes[0].getAttribute('data-turn');
        expect(firstRole).toBe('user');
      }
    });

    it('should handle malformed DOM gracefully', () => {
      const doc = createDOMFromHTML(`
        <div data-message-author-role="invalid-role">Bad</div>
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
      const html = loadSampleHTML('chatgpt');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const userNode = nodes.find(
        (n) => n.getAttribute('data-message-author-role') === 'user' || n.getAttribute('data-turn') === 'user'
      );

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
      const html = loadSampleHTML('chatgpt');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const assistantNode = nodes.find(
        (n) =>
          n.getAttribute('data-message-author-role') === 'assistant' || n.getAttribute('data-turn') === 'assistant'
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

    it('should preserve code block HTML structure', () => {
      const mockNode = createMockMessageWithCode('def hello():\\n    print("hi")', 'python');

      const parsed = parser.parseNode(mockNode);

      expect(parsed.contentHtml).toContain('<pre>');
      expect(parsed.contentHtml).toContain('language-python');
      expect(parsed.contentHtml).toContain('def hello()');
    });

    it('should preserve table HTML structure', () => {
      const tableHTML = '<table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table>';
      const mockNode = createMockMessageWithTable(tableHTML);

      const parsed = parser.parseNode(mockNode);

      expect(parsed.contentHtml).toContain('<table>');
      expect(parsed.contentHtml).toContain('Name');
      expect(parsed.contentHtml).toContain('Alice');
    });

    it('should handle empty content node', () => {
      const mockNode = createMockEmptyMessage();

      const parsed = parser.parseNode(mockNode);

      expect(parsed.role).toBe('user');
      expect(parsed.contentHtml).toBe('');
    });

    it('should throw error when role attribute is missing', () => {
      const doc = createDOMFromHTML('<div>No role attribute</div>');
      const mockNode = doc.querySelector('div') as HTMLElement;

      expect(() => parser.parseNode(mockNode)).toThrow();
    });

    it('should not include timestamp (ChatGPT has none in DOM)', () => {
      const mockNode = createMockChatGPTUserMessage('Hello');

      const parsed = parser.parseNode(mockNode);

      expect(parsed.timestamp).toBeUndefined();
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
      const button = createMockGeneratingButton();
      const doc = createDOMFromHTML('<html><body></body></html>');
      doc.body.appendChild(button);
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(true);
    });

    it('should return false for empty document', () => {
      const doc = createDOMFromHTML('');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should check aria-label contains "Stop"', () => {
      const doc = createDOMFromHTML('<button aria-label="Stop generating response">Stop</button>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(true);
    });
  });

  // ============================================================
  // getTitle() - 3 tests
  // ============================================================

  describe('getTitle', () => {
    it('should extract title when present', () => {
      const title = createMockTitle('My Conversation');
      const doc = createDOMFromHTML('<html><body></body></html>');
      doc.body.appendChild(title);
      global.document = doc as any;

      const result = parser.getTitle();

      expect(result).toBe('My Conversation');
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
      const button = createMockGeneratingButton();
      const doc = createDOMFromHTML('<html><body></body></html>');
      doc.body.appendChild(button);
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
