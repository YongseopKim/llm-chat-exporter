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

      const parsed = parser.getMessageNodes().map((n) => parser.parseNode(n));
      expect(parsed.length).toBeGreaterThanOrEqual(2);

      const user = parsed.find((m) => m.role === 'user');
      const assistant = parsed.find((m) => m.role === 'assistant');
      expect(user).toBeTruthy();
      expect(assistant).toBeTruthy();

      expect(user!.contentHtml).toContain('프록시식 AI 회사를 차려라');
      expect(assistant!.contentHtml).toContain('핵심 태도는 대체로 옳지만');
    });
  });

  describe('chatgpt_001: Multi-turn conversation with many citation thumbnails', () => {
    it('should extract all messages across a long multi-turn conversation', () => {
      const html = loadEdgeCaseHTML('chatgpt', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const parsed = parser.getMessageNodes().map((n) => parser.parseNode(n));

      expect(parsed.filter((m) => m.role === 'user').length).toBe(3);
      expect(parsed.filter((m) => m.role === 'assistant').length).toBe(4);

      expect(parsed[0].contentHtml).toContain('반도체 수요에 비해 데이터센터가 부족하다고 들었음');
    });

    it('should never fetch the real cross-origin citation thumbnails when inlining images', async () => {
      const html = loadEdgeCaseHTML('chatgpt', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const assistantWithImages = parser
        .getMessageNodes()
        .map((n) => parser.parseNode(n))
        .find((m) => m.role === 'assistant' && m.contentHtml.includes('<img'));
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

  describe('chatgpt_003: Image-generation turn', () => {
    // Image-generation responses render in a <section data-turn="assistant">
    // that contains NO [data-message-author-role] descendant, so the old
    // primary-only selector chain dropped the entire turn from the export.
    it('should collect the image-generation assistant turn', () => {
      const html = loadEdgeCaseHTML('chatgpt', '003');
      const doc = createDOMFromHTML(`<html><body>${html}</body></html>`);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const roles = nodes.map((n) => parser.parseNode(n).role);

      expect(roles).toEqual(['user', 'assistant']);
    });

    it('should extract the generated image, deduplicated to one <img> per src', () => {
      const html = loadEdgeCaseHTML('chatgpt', '003');
      const doc = createDOMFromHTML(`<html><body>${html}</body></html>`);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const assistant = parser.parseNode(nodes[1]);

      expect(assistant.role).toBe('assistant');
      // The DOM layers 3 <img> elements over each other, all with the same src
      expect(assistant.contentHtml.match(/<img/g)?.length).toBe(1);
      expect(assistant.contentHtml).toContain('backend-api/estuary/content');
      expect(assistant.contentHtml).toContain('생성된 이미지');
    });

    it('should skip assistant turns that have neither content nor images', () => {
      const html = loadEdgeCaseHTML('chatgpt', '003');
      const doc = createDOMFromHTML(`<html><body>${html}</body></html>`);
      global.document = doc as any;

      // The fixture ends with a scaffold turn whose only text is the
      // sr-only "ChatGPT의 말:" heading — that is not a message.
      expect(parser.getMessageNodes().length).toBe(2);
    });

    it('should not double-count turns that do contain a role node', () => {
      const html = loadEdgeCaseHTML('chatgpt', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const roles = nodes.map((n) => parser.parseNode(n).role);

      // 3 user + 4 assistant real messages; the 8th turn is an empty scaffold
      expect(roles.filter((r) => r === 'user').length).toBe(3);
      expect(roles.filter((r) => r === 'assistant').length).toBe(4);
    });
  });

  describe('chatgpt_002: Text-only conversation (no images)', () => {
    it('should extract messages with no <img> in the content', () => {
      const html = loadEdgeCaseHTML('chatgpt', '002');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const user = parser
        .getMessageNodes()
        .map((n) => parser.parseNode(n))
        .find((m) => m.role === 'user');
      expect(user).toBeTruthy();
      expect(user!.contentHtml).toContain('이미지 만으로 된 PDF 파일');
    });
  });
});
