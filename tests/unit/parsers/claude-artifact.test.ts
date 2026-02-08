/**
 * Claude Artifact Export Tests
 *
 * Tests for extracting artifact content from Claude's artifact panel.
 * Artifacts are rendered in a separate DOM panel that requires clicking
 * a "Preview contents" button to load.
 *
 * Pattern: Similar to GrokParser's Mermaid auto-click in loadAllMessages()
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { createDOMFromHTML } from './shared/fixtures';

describe('ClaudeParser - Artifact Export', () => {
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
  // loadAllMessages() - artifact button clicking
  // ============================================================

  describe('loadAllMessages - artifact button clicking', () => {
    it('should click the last artifact block button during loadAllMessages', async () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div data-testid="user-message">
            <p class="whitespace-pre-wrap">Create a framework</p>
          </div>
          <div data-testid="assistant-message">
            <div class="standard-markdown"><p>Here is your framework</p></div>
            <div class="artifact-block-cell">
              <button aria-label="Preview contents" id="artifactBtn1">Preview v1</button>
            </div>
          </div>
          <div data-testid="user-message">
            <p class="whitespace-pre-wrap">Update it</p>
          </div>
          <div data-testid="assistant-message">
            <div class="standard-markdown"><p>Updated framework</p></div>
            <div class="artifact-block-cell">
              <button aria-label="Preview contents" id="artifactBtn2">Preview v2</button>
            </div>
          </div>
        </body></html>
      `);
      global.document = doc as any;
      global.window = { scrollTo: vi.fn() } as any;

      const btn1 = doc.querySelector('#artifactBtn1') as HTMLElement;
      const btn2 = doc.querySelector('#artifactBtn2') as HTMLElement;
      const click1 = vi.fn();
      const click2 = vi.fn();
      btn1.addEventListener('click', click1);
      btn2.addEventListener('click', click2);

      await parser.loadAllMessages();

      // Should click only the last artifact button (latest version)
      expect(click1).not.toHaveBeenCalled();
      expect(click2).toHaveBeenCalled();
    });

    it('should not fail when no artifact buttons exist', async () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div data-testid="user-message">
            <p class="whitespace-pre-wrap">Hello</p>
          </div>
          <div data-testid="assistant-message">
            <div class="standard-markdown"><p>Hi there!</p></div>
          </div>
        </body></html>
      `);
      global.document = doc as any;
      global.window = { scrollTo: vi.fn() } as any;

      await expect(parser.loadAllMessages()).resolves.toBeUndefined();
    });

    it('should still throw when generating even with artifact buttons', async () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div data-is-streaming="true">
            <div class="standard-markdown"><p>Generating...</p></div>
            <div class="artifact-block-cell">
              <button aria-label="Preview contents">Preview</button>
            </div>
          </div>
        </body></html>
      `);
      global.document = doc as any;

      await expect(parser.loadAllMessages()).rejects.toThrow(/generating/i);
    });
  });

  // ============================================================
  // getArtifact() - content extraction
  // ============================================================

  describe('getArtifact', () => {
    it('should extract artifact content from #markdown-artifact', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div class="artifact-block-cell">
            <button aria-label="Preview contents">삶의 선택 프레임워크 v0.3</button>
          </div>
          <div id="markdown-artifact">
            <div class="standard-markdown">
              <h1>삶의 선택 프레임워크 v0.3</h1>
              <p>Decision framework content here</p>
            </div>
          </div>
          <button data-testid="artifact-version-trigger">v3</button>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).not.toBeNull();
      expect(artifact!.contentHtml).toContain('삶의 선택 프레임워크 v0.3');
      expect(artifact!.contentHtml).toContain('Decision framework content here');
    });

    it('should extract title from the last artifact-block-cell', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div class="artifact-block-cell">
            <button aria-label="Preview contents">Old Version</button>
          </div>
          <div class="artifact-block-cell">
            <button aria-label="Preview contents">Latest Version Title</button>
          </div>
          <div id="markdown-artifact">
            <div class="standard-markdown"><p>Content</p></div>
          </div>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).not.toBeNull();
      expect(artifact!.title).toBe('Latest Version Title');
    });

    it('should extract version from artifact-version-trigger', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div class="artifact-block-cell">
            <button aria-label="Preview contents">Title</button>
          </div>
          <div id="markdown-artifact">
            <div class="standard-markdown"><p>Content</p></div>
          </div>
          <button data-testid="artifact-version-trigger">v5</button>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).not.toBeNull();
      expect(artifact!.version).toBe('v5');
    });

    it('should return null when #markdown-artifact does not exist', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div data-testid="user-message">
            <p class="whitespace-pre-wrap">Hello</p>
          </div>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).toBeNull();
    });

    it('should return null when #markdown-artifact has no .standard-markdown', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div id="markdown-artifact">
            <!-- empty panel -->
          </div>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).toBeNull();
    });

    it('should use fallback title when no artifact-block-cell exists', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div id="markdown-artifact">
            <div class="standard-markdown"><p>Some content</p></div>
          </div>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).not.toBeNull();
      expect(artifact!.title).toBe('Artifact');
    });

    it('should use fallback version when no version trigger exists', () => {
      const doc = createDOMFromHTML(`
        <html><body>
          <div class="artifact-block-cell">
            <button aria-label="Preview contents">My Title</button>
          </div>
          <div id="markdown-artifact">
            <div class="standard-markdown"><p>Content</p></div>
          </div>
        </body></html>
      `);
      global.document = doc as any;

      const artifact = parser.getArtifact();

      expect(artifact).not.toBeNull();
      expect(artifact!.version).toBe('v1');
    });
  });
});
