/**
 * ChatGPTParser Edge Case Tests
 *
 * Uses real DevTools-captured conversation pages (samples/edges/chatgpt_*.html)
 * rather than hand-written fixtures, since a plain "Save Page As" doesn't
 * capture ChatGPT's virtualized message DOM (see samples/latest notes).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { inlineImages } from '../../../src/content/converter';
import { loadEdgeCaseHTML, createDOMFromHTML } from './shared/fixtures';

describe('ChatGPTParser - Edge Cases', () => {
  let parser: ChatGPTParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new ChatGPTParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  describe('chatgpt_000: Simple user/assistant pair with citation favicons', () => {
    it('should extract both messages with their real text content', () => {
      const html = loadEdgeCaseHTML('chatgpt', '000');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes.length).toBeGreaterThanOrEqual(2);

      const userNode = nodes.find((n) => n.getAttribute('data-message-author-role') === 'user');
      const assistantNode = nodes.find(
        (n) => n.getAttribute('data-message-author-role') === 'assistant'
      );
      expect(userNode).toBeTruthy();
      expect(assistantNode).toBeTruthy();

      if (userNode) {
        const parsed = parser.parseNode(userNode);
        expect(parsed.role).toBe('user');
        expect(parsed.contentHtml).toContain('프록시식 AI 회사를 차려라');
      }

      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);
        expect(parsed.role).toBe('assistant');
        expect(parsed.contentHtml).toContain('핵심 태도는 대체로 옳지만');
      }
    });
  });

  describe('chatgpt_001: Multi-turn conversation with many citation thumbnails', () => {
    it('should extract all messages across a long multi-turn conversation', () => {
      const html = loadEdgeCaseHTML('chatgpt', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const userNodes = nodes.filter(
        (n) => n.getAttribute('data-message-author-role') === 'user'
      );
      const assistantNodes = nodes.filter(
        (n) => n.getAttribute('data-message-author-role') === 'assistant'
      );

      expect(userNodes.length).toBe(3);
      expect(assistantNodes.length).toBe(4);

      const parsed = parser.parseNode(userNodes[0]);
      expect(parsed.contentHtml).toContain('반도체 수요에 비해 데이터센터가 부족하다고 들었음');
    });

    it('should never fetch the real cross-origin citation thumbnails when inlining images', async () => {
      const html = loadEdgeCaseHTML('chatgpt', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const assistantWithImages = nodes
        .filter((n) => n.getAttribute('data-message-author-role') === 'assistant')
        .map((n) => parser.parseNode(n))
        .find((m) => m.contentHtml.includes('<img'));
      expect(assistantWithImages).toBeTruthy();

      const fetchMock = vi.fn();
      const originalFetch = global.fetch;
      global.fetch = fetchMock as any;

      try {
        const result = await inlineImages(assistantWithImages!.contentHtml);
        // images.openai.com / reuters.com / google.com favicons are all
        // cross-origin from chatgpt.com — none should trigger a credentialed fetch
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toContain('images.openai.com');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('chatgpt_002: Text-only conversation (no images)', () => {
    it('should extract messages with no <img> in the content', () => {
      const html = loadEdgeCaseHTML('chatgpt', '002');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const userNode = nodes.find((n) => n.getAttribute('data-message-author-role') === 'user');
      expect(userNode).toBeTruthy();

      if (userNode) {
        const parsed = parser.parseNode(userNode);
        expect(parsed.contentHtml).toContain('이미지 만으로 된 PDF 파일');
      }
    });
  });
});
