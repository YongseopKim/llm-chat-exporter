/**
 * GrokParser Unit Tests
 *
 * Grok uses .message-bubble class for messages with sibling-button role detection.
 * - USER: parent has button[aria-label="Edit"]
 * - ASSISTANT: parent has button[aria-label="Regenerate"]
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GrokParser } from '../../../src/content/parsers/grok';
import { loadSampleHTML, createDOMFromHTML } from './shared/fixtures';
import {
  createMockGrokUserMessage,
  createMockGrokAssistantMessage,
  createMockGrokMermaidRendered,
  createMockGrokCodeBlock,
} from './shared/mocks';

describe('GrokParser', () => {
  let parser: GrokParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new GrokParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  // ============================================================
  // canHandle() - 5 tests
  // ============================================================

  describe('canHandle', () => {
    it('should return true for exact grok.com hostname', () => {
      expect(parser.canHandle('grok.com')).toBe(true);
    });

    it('should return true for grok.com with subdomain', () => {
      expect(parser.canHandle('www.grok.com')).toBe(true);
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
    it('should extract 4 messages from sample HTML', () => {
      const html = loadSampleHTML('grok');
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

    it('should find .message-bubble elements', () => {
      const doc = createDOMFromHTML(`
        <div class="relative group">
          <div class="message-bubble">User message</div>
          <div class="action-buttons">
            <button aria-label="Edit">Edit</button>
          </div>
        </div>
        <div class="relative group">
          <div class="message-bubble">Assistant message</div>
          <div class="action-buttons">
            <button aria-label="Regenerate">Regenerate</button>
          </div>
        </div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBe(2);
      expect(nodes[0].classList.contains('message-bubble')).toBe(true);
    });

    it('should preserve message order', () => {
      const html = loadSampleHTML('grok');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      // First message should be user (has Edit button in parent)
      if (nodes.length >= 2) {
        const firstParent = nodes[0].parentElement;
        expect(firstParent?.querySelector('button[aria-label="Edit"]')).not.toBeNull();
      }
    });

    it('should handle malformed DOM gracefully', () => {
      const doc = createDOMFromHTML(`
        <div>Not a message bubble</div>
      `);
      global.document = doc as any;

      expect(() => parser.getMessageNodes()).not.toThrow();
    });

    it('should handle multiple messages from sample', () => {
      const html = loadSampleHTML('grok');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();

      expect(nodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // parseNode() - 7 tests
  // ============================================================

  describe('parseNode', () => {
    it('should parse user message from sample HTML', () => {
      const html = loadSampleHTML('grok');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      // First message should be user
      const userNode = nodes[0];

      const parsed = parser.parseNode(userNode);
      expect(parsed.role).toBe('user');
      expect(parsed.contentHtml).toBeTruthy();
      expect(parsed.contentHtml.length).toBeGreaterThan(0);
    });

    it('should parse assistant message from sample HTML', () => {
      const html = loadSampleHTML('grok');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      // Second message should be assistant
      const assistantNode = nodes[1];

      const parsed = parser.parseNode(assistantNode);
      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toBeTruthy();
      expect(parsed.contentHtml.length).toBeGreaterThan(50);
    });

    it('should detect user role from Edit button in parent', () => {
      const node = createMockGrokUserMessage('<p>User question</p>');

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('user');
    });

    it('should detect assistant role from Regenerate button in parent', () => {
      const node = createMockGrokAssistantMessage('<p>Assistant answer</p>');

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('assistant');
    });

    it('should preserve HTML structure in content', () => {
      const html = loadSampleHTML('grok');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      // Assistant message with list
      const assistantNode = nodes[1];

      const parsed = parser.parseNode(assistantNode);

      expect(parsed.contentHtml).toContain('<ul>');
      expect(parsed.contentHtml).toContain('<li>');
    });

    it('should handle code blocks in assistant messages', () => {
      const html = loadSampleHTML('grok');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      // Fourth message has code block
      const codeNode = nodes[3];

      const parsed = parser.parseNode(codeNode);

      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('<pre>');
      expect(parsed.contentHtml).toContain('<code');
    });

    it('should handle empty content gracefully', () => {
      const doc = createDOMFromHTML(`
        <div class="relative group">
          <div class="message-bubble"></div>
          <div class="action-buttons">
            <button aria-label="Edit">Edit</button>
          </div>
        </div>
      `);
      const node = doc.querySelector('.message-bubble') as HTMLElement;

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('user');
      expect(parsed.contentHtml).toBe('');
    });
  });

  // ============================================================
  // isGenerating() - 4 tests
  // ============================================================

  describe('isGenerating', () => {
    it('should always return false (disabled by user request)', () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should return false even with Stop button present', () => {
      const doc = createDOMFromHTML('<button aria-label="Stop generating">Stop</button>');
      global.document = doc as any;

      // Grok parser explicitly returns false for isGenerating
      expect(parser.isGenerating()).toBe(false);
    });

    it('should return false for empty document', () => {
      const doc = createDOMFromHTML('');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });

    it('should return false regardless of page state', () => {
      const doc = createDOMFromHTML('<div class="generating streaming loading">Loading...</div>');
      global.document = doc as any;

      expect(parser.isGenerating()).toBe(false);
    });
  });

  // ============================================================
  // loadAllMessages() - 3 tests
  // ============================================================

  describe('loadAllMessages', () => {
    it('should resolve without error', async () => {
      const doc = createDOMFromHTML('<html><body></body></html>');
      global.document = doc as any;

      await expect(parser.loadAllMessages()).resolves.toBeUndefined();
    });

    it('should not throw even with stop button (isGenerating always false)', async () => {
      const doc = createDOMFromHTML('<button aria-label="Stop generating">Stop</button>');
      global.document = doc as any;

      // Should not throw because isGenerating always returns false
      await expect(parser.loadAllMessages()).resolves.toBeUndefined();
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
    it('should extract title from document.title removing suffix', () => {
      const mockDoc = {
        title: 'AI Discussion - Grok',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('AI Discussion');
    });

    it('should handle suffix with en-dash', () => {
      const mockDoc = {
        title: 'Zcash – Grok',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('Zcash');
    });

    it('should remove emoji from title', () => {
      const mockDoc = {
        title: '🎯 Tech Talk - Grok',
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };
      global.document = mockDoc as any;

      expect(parser.getTitle()).toBe('Tech Talk');
    });
  });

  // ============================================================
  // Mermaid Handling - 5 tests
  // ============================================================

  describe('Mermaid handling', () => {
    it('should click "원본 보기" button during loadAllMessages', async () => {
      // Create a document with Mermaid container
      const doc = createDOMFromHTML(`
        <html><body>
          <div class="group/mermaid w-full relative">
            <div class="mermaid"><svg></svg></div>
            <button type="button" aria-label="원본 보기" id="viewSourceBtn"></button>
          </div>
        </body></html>
      `);
      global.document = doc as any;
      global.window = { scrollTo: vi.fn() } as any;

      // Add click spy to the button
      const viewSourceBtn = doc.querySelector('#viewSourceBtn') as HTMLElement;
      const clickSpy = vi.fn();
      viewSourceBtn.addEventListener('click', clickSpy);

      // loadAllMessages should trigger button click
      await parser.loadAllMessages();

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle message with already converted Mermaid code block', () => {
      const mermaidCode = 'flowchart TD\n    A --> B';
      const node = createMockGrokCodeBlock(mermaidCode);

      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('data-testid="code-block"');
      expect(parsed.contentHtml).toContain('mermaid');
    });

    it('should click multiple "원본 보기" buttons during loadAllMessages', async () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div class="group/mermaid w-full relative">
            <div class="mermaid"><svg></svg></div>
            <button type="button" aria-label="원본 보기" id="btn1"></button>
          </div>
          <div class="group/mermaid w-full relative">
            <div class="mermaid"><svg></svg></div>
            <button type="button" aria-label="원본 보기" id="btn2"></button>
          </div>
        </body></html>
      `);
      global.document = doc as any;
      global.window = { scrollTo: vi.fn() } as any;

      const btn1 = doc.querySelector('#btn1') as HTMLElement;
      const btn2 = doc.querySelector('#btn2') as HTMLElement;
      const click1 = vi.fn();
      const click2 = vi.fn();
      btn1.addEventListener('click', click1);
      btn2.addEventListener('click', click2);

      await parser.loadAllMessages();

      expect(click1).toHaveBeenCalled();
      expect(click2).toHaveBeenCalled();
    });

    it('should not fail when message has no Mermaid diagrams', () => {
      const node = createMockGrokAssistantMessage('<p>Simple text response</p>');

      expect(() => parser.parseNode(node)).not.toThrow();

      const parsed = parser.parseNode(node);
      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('Simple text response');
    });

    it('should preserve other content when converting Mermaid', () => {
      const mermaidSource = 'flowchart TD\n    A --> B';
      const node = createMockGrokMermaidRendered(mermaidSource);

      const parsed = parser.parseNode(node);

      // Should preserve the paragraph before the diagram
      expect(parsed.contentHtml).toContain('Here is a diagram');
    });
  });
});
