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
});
