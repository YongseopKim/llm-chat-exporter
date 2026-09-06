/**
 * ChatGPTParser - user turns whose message is an attached file
 *
 * Measured on 2026-09-06 against a live conversation
 * (chatgpt.com/g/g-p-6a4dee60dc088191a997c4cb4e295db1/c/6a984181-2ad4-83e8-a5cd-88328f4305fa):
 * a long pasted prompt is turned into an attachment, and the turn then holds
 * nothing but a file tile - no .markdown, no .whitespace-pre-wrap, and a
 * textContent of 23 characters that is just the file name. All five user
 * turns in that conversation exported as content: "".
 *
 * The file's text is not in the DOM at all (only a download button), so the
 * export records that an attachment was sent and names it. See the
 * "Attachment-only messages export as a placeholder" decision in CLAUDE.md.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChatGPTParser } from '../../../src/content/parsers/chatgpt';
import { createDOMFromHTML } from './shared/fixtures';
import { htmlToMarkdown } from '../../../src/content/converter';

const FILE_NAME = '붙여넣은 마크다운(1).md';

/** One user turn holding file tiles, as ChatGPT renders a pasted file. */
function attachmentTurnHtml(
  options: { files?: string[]; text?: string } = {}
): string {
  const { files = [FILE_NAME], text } = options;
  const tiles = files
    .map(
      (name) => `
          <div aria-label="${name}" class="relative flex group/file-tile">
            <div class="w-full p-2.5">
              <div data-testid="library-file-icon"></div>
            </div>
          </div>`
    )
    .join('');

  return `
    <section data-turn="user" data-turn-id="turn-a" data-testid="conversation-turn-1">
      <h4 class="sr-only">나의 말:</h4>
      <div class="flex w-full flex-col gap-1">
        <div class="flex gap-2 flex-wrap">${tiles}</div>
        ${text ? `<div class="whitespace-pre-wrap">${text}</div>` : ''}
      </div>
      <div class="z-0 flex justify-end">
        <button data-testid="download-files-turn-action-button" aria-label="1개 파일 다운로드"></button>
      </div>
    </section>`;
}

describe('ChatGPTParser - attachment-only user turn', () => {
  let parser: ChatGPTParser;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    parser = new ChatGPTParser();
    originalDocument = global.document;
    originalWindow = global.window;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
  });

  function install(html: string): void {
    const doc = createDOMFromHTML(
      `<html><body>${html}</body></html>`,
      'https://chatgpt.com/c/attachment'
    );
    global.document = doc as any;
    global.window = doc.defaultView as any;
  }

  it('keeps the turn as a message instead of exporting an empty one', () => {
    install(attachmentTurnHtml());

    const [node] = parser.getMessageNodes();
    expect(node).toBeDefined();
    expect(parser.parseNode(node).contentHtml).not.toBe('');
  });

  it('names the attachment in the exported markdown', () => {
    install(attachmentTurnHtml());

    const [node] = parser.getMessageNodes();
    const markdown = htmlToMarkdown(parser.parseNode(node).contentHtml);

    // Emitted verbatim, not escaped into \[File: ...\]
    expect(markdown).toContain(`[File: ${FILE_NAME}]`);
  });

  it('keeps typed text alongside the attachment when a turn has both', () => {
    install(attachmentTurnHtml({ text: '여기 자료 첨부합니다' }));

    const [node] = parser.getMessageNodes();
    const markdown = htmlToMarkdown(parser.parseNode(node).contentHtml);

    expect(markdown).toContain(`[File: ${FILE_NAME}]`);
    expect(markdown).toContain('여기 자료 첨부합니다');
  });

  it('records one placeholder per attached file', () => {
    install(attachmentTurnHtml({ files: [FILE_NAME, 'second.md'] }));

    const [node] = parser.getMessageNodes();
    const markdown = htmlToMarkdown(parser.parseNode(node).contentHtml);

    expect(markdown).toContain(`[File: ${FILE_NAME}]`);
    expect(markdown).toContain('[File: second.md]');
  });
});
