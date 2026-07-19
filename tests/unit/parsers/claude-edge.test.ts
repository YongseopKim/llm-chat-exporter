/**
 * ClaudeParser Edge Case Tests
 *
 * Tests for complex Claude UI patterns:
 * - Thinking blocks (collapsible reasoning)
 * - Web search results (collapsible search steps)
 * - Multiple .standard-markdown blocks in single message
 *
 * These tests verify that we extract visible content correctly,
 * not just the first .standard-markdown element.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { htmlToMarkdown, inlineImages } from '../../../src/content/converter';
import { loadEdgeCaseHTML, createDOMFromHTML } from './shared/fixtures';

describe('ClaudeParser - Edge Cases', () => {
  let parser: ClaudeParser;
  let originalDocument: Document;

  beforeEach(() => {
    parser = new ClaudeParser();
    originalDocument = global.document;
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  describe('claude_000: Thinking + Web Search + Main Response', () => {
    it('should extract all visible .standard-markdown content (not just first)', () => {
      const html = loadEdgeCaseHTML('claude', '000');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes.length).toBeGreaterThan(0);

      // Find the assistant message with data-is-streaming="false"
      const assistantNode = nodes.find((n) => n.hasAttribute('data-is-streaming'));
      expect(assistantNode).toBeTruthy();

      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);

        expect(parsed.role).toBe('assistant');
        expect(parsed.contentHtml).toBeTruthy();

        // The content should be long (main response, not just intermediate message)
        // Main response has 60+ lines with H2 headers and lists
        expect(parsed.contentHtml.length).toBeGreaterThan(500);

        // Should contain the main response headers
        expect(parsed.contentHtml).toContain('LLM/AI 에이전트 개발 포지션');
        expect(parsed.contentHtml).toContain('블록체인 개발 포지션');

        // Should NOT contain collapsed thinking content
        expect(parsed.contentHtml).not.toContain('검색 키워드는');
      }
    });

    it('should exclude content from collapsed blocks (overflow-hidden with height: 0px)', () => {
      const html = loadEdgeCaseHTML('claude', '000');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const assistantNode = nodes.find((n) => n.hasAttribute('data-is-streaming'));

      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);

        // Collapsed thinking block contains this text
        const collapsedText = '사용자가 현재 구인 시장에서 자신에게 적합한 일자리를 찾아달라고 요청했다';

        // Should NOT be in the parsed content (it's in collapsed block)
        expect(parsed.contentHtml).not.toContain(collapsedText);
      }
    });

    it('should handle messages with thinking blocks + web search', () => {
      const html = loadEdgeCaseHTML('claude', '000');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const assistantNode = nodes.find((n) => n.hasAttribute('data-is-streaming'));

      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);

        // Should extract the main response successfully
        expect(parsed.role).toBe('assistant');
        expect(parsed.contentHtml).toBeTruthy();

        // Verify we got the actual response, not thinking/search summary
        expect(parsed.contentHtml).toContain('셀타스퀘어');
        expect(parsed.contentHtml).toContain('SK텔레콤');
        expect(parsed.contentHtml).toContain('두나무');
      }
    });

    it('should maintain backward compatibility with simple messages', () => {
      // Test with a simple message (no thinking/search blocks)
      const doc = createDOMFromHTML(`
        <div data-is-streaming="false" class="group relative pb-8">
          <div class="font-claude-response">
            <div>
              <div class="grid-cols-1 grid gap-2.5 standard-markdown">
                <p class="font-claude-response-body">Simple response text</p>
              </div>
            </div>
          </div>
        </div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes.length).toBe(1);

      const parsed = parser.parseNode(nodes[0]);
      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('Simple response text');
    });
  });

  describe('Multiple visible .standard-markdown blocks', () => {
    it('should concatenate multiple visible content blocks', () => {
      const doc = createDOMFromHTML(`
        <div data-is-streaming="false" class="group relative pb-8">
          <div class="font-claude-response">
            <div>
              <div class="standard-markdown">
                <p>First block</p>
              </div>
            </div>
            <div>
              <div class="standard-markdown">
                <p>Second block</p>
              </div>
            </div>
          </div>
        </div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const parsed = parser.parseNode(nodes[0]);

      expect(parsed.contentHtml).toContain('First block');
      expect(parsed.contentHtml).toContain('Second block');
    });

    it('should skip collapsed blocks between visible ones', () => {
      const doc = createDOMFromHTML(`
        <div data-is-streaming="false" class="group relative pb-8">
          <div class="font-claude-response">
            <div>
              <div class="standard-markdown">
                <p>Visible first</p>
              </div>
            </div>
            <div class="overflow-hidden" style="height: 0px;">
              <div class="standard-markdown">
                <p>Hidden content</p>
              </div>
            </div>
            <div>
              <div class="standard-markdown">
                <p>Visible second</p>
              </div>
            </div>
          </div>
        </div>
      `);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      const parsed = parser.parseNode(nodes[0]);

      expect(parsed.contentHtml).toContain('Visible first');
      expect(parsed.contentHtml).toContain('Visible second');
      expect(parsed.contentHtml).not.toContain('Hidden content');
    });
  });

  describe('claude_002: Visualization rendered in a cross-origin iframe', () => {
    // Claude's "visualize" feature renders the picture inside a sandboxed
    // cross-origin iframe (<hash>.claudemcpcontent.com). contentDocument is
    // null from the page, so the content is unreachable by any content
    // script — the best we can do is record that it was there.
    it('should emit a placeholder carrying the visualization title', () => {
      const html = loadEdgeCaseHTML('claude', '002');
      const doc = createDOMFromHTML(`<html><body>${html}</body></html>`);
      global.document = doc as any;

      const node = parser.getMessageNodes()[0];
      const parsed = parser.parseNode(node);

      expect(parsed.role).toBe('assistant');
      expect(parsed.contentHtml).toContain('Inferred portrait night desk');
    });

    it('should keep the visualization in document order between the text blocks', () => {
      const html = loadEdgeCaseHTML('claude', '002');
      const doc = createDOMFromHTML(`<html><body>${html}</body></html>`);
      global.document = doc as any;

      const parsed = parser.parseNode(parser.getMessageNodes()[0]);

      const beforeText = parsed.contentHtml.indexOf('얼굴은 일부러 비웠다');
      const placeholder = parsed.contentHtml.indexOf('Inferred portrait night desk');
      const afterText = parsed.contentHtml.indexOf('맞았는지 빗나갔는지는');

      expect(beforeText).toBeGreaterThanOrEqual(0);
      expect(placeholder).toBeGreaterThan(beforeText);
      expect(afterText).toBeGreaterThan(placeholder);
    });

    it('should survive markdown conversion as readable text', async () => {
      const html = loadEdgeCaseHTML('claude', '002');
      const doc = createDOMFromHTML(`<html><body>${html}</body></html>`);
      global.document = doc as any;

      const parsed = parser.parseNode(parser.getMessageNodes()[0]);
      const md = htmlToMarkdown(await inlineImages(parsed.contentHtml));

      expect(md).toContain('Inferred portrait night desk');
      // The MCP tool-name prefix is noise, not part of the title
      expect(md).not.toContain('visualize: Inferred');
      // Brackets must survive unescaped so the marker stays greppable
      expect(md).toContain('[Visualization: Inferred portrait night desk]');
      expect(md).not.toContain('\\[Visualization');
    });

    it('should emit one placeholder per visualization in a multi-visualization message', () => {
      // claude_001 embeds three visualizations; before this change all three
      // vanished from the export without a trace.
      const html = loadEdgeCaseHTML('claude', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const assistant = parser
        .getMessageNodes()
        .map((n) => parser.parseNode(n))
        .find((m) => m.role === 'assistant');

      expect(assistant).toBeTruthy();
      expect(assistant!.contentHtml).toContain('[Visualization: Power plant to gpu voltage ladder]');
      expect(assistant!.contentHtml).toContain('[Visualization: Gpu cluster bandwidth hierarchy]');
      expect(assistant!.contentHtml).toContain('[Visualization: Training vs inference requirements]');
    });

    it('should not emit a placeholder for messages without a visualization', () => {
      const doc = createDOMFromHTML(`
        <div data-is-streaming="false">
          <div class="standard-markdown"><p>Plain answer</p></div>
        </div>
      `);
      global.document = doc as any;

      const parsed = parser.parseNode(parser.getMessageNodes()[0]);

      expect(parsed.contentHtml).toContain('Plain answer');
      expect(parsed.contentHtml).not.toContain('Visualization');
    });
  });

  describe('claude_001: Real captured project chat page', () => {
    it('should extract the user message and the long assistant response', () => {
      const html = loadEdgeCaseHTML('claude', '001');
      const doc = createDOMFromHTML(html);
      global.document = doc as any;

      const nodes = parser.getMessageNodes();
      expect(nodes.length).toBeGreaterThan(0);

      const userNode = nodes.find((n) => n.matches('[data-testid="user-message"]'));
      expect(userNode).toBeTruthy();
      if (userNode) {
        const parsed = parser.parseNode(userNode);
        expect(parsed.role).toBe('user');
        expect(parsed.contentHtml).toContain('전기의 생산부터');
      }

      const assistantNode = nodes.find((n) => n.hasAttribute('data-is-streaming'));
      expect(assistantNode).toBeTruthy();
      if (assistantNode) {
        const parsed = parser.parseNode(assistantNode);
        expect(parsed.role).toBe('assistant');
        expect(parsed.contentHtml).toContain('좋은 범위의 질문이라 말하고 싶지만');
      }
    });
  });
});
