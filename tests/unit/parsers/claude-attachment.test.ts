/**
 * ClaudeParser - user turns whose message is an attached file
 *
 * Measured on 2026-09-06 against a live conversation
 * (claude.ai/chat/029fb6d0-17e3-4dcb-ba7a-a14cc67d7748): a long pasted prompt
 * becomes an attachment, and the transcript row that holds it carries no
 * [data-testid="user-message"] at all - only a file thumbnail:
 *
 *   data-index=0  user-message=1  file=0   "You said: Monad 의 현재 트렌드를..."
 *   data-index=2  user-message=0  file=1   "같은 질문에 대한 다른 챗 서비스들의..."
 *   data-index=14 user-message=0  file=1   "마지막으로 한번 더 해보자. # ChatGPT..."
 *
 * The combined message selector never matched those rows, so both turns were
 * dropped from the export entirely - not exported empty, simply absent.
 *
 * The thumbnail holds a truncated preview (306 characters ending in "pasted"),
 * not the file, so the export names the attachment rather than pretending to
 * carry it. See the "Attachment-only messages export as a placeholder"
 * decision in CLAUDE.md.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { createDOMFromHTML } from './shared/fixtures';
import { htmlToMarkdown } from '../../../src/content/converter';

const ATTACHMENT_LABEL = 'Pasted text, pasted, 1,591 lines';
const TOTAL = 3;

function row(index: number, inner: string): string {
  return `
    <div data-testid="transcript-row" data-rs-index="${index}" data-index="${index}">
      <div role="article" aria-setsize="${TOTAL}" aria-posinset="${index + 1}"
           aria-label="Message ${index + 1} of ${TOTAL}">
        <div data-test-render-count="1">${inner}</div>
      </div>
    </div>`;
}

function thumbnailHtml(label = ATTACHMENT_LABEL): string {
  return `
    <div data-testid="file-thumbnail" class="group/thumbnail">
      <button aria-label="${label}">
        <p class="file-thumbnail-fade-in">마지막으로 한번 더 해보자. # ChatGPT 추가 답변과</p>
        <p class="uppercase truncate">pasted</p>
      </button>
    </div>`;
}

const USER_MESSAGE = '<div data-testid="user-message"><p class="whitespace-pre-wrap">Q0</p></div>';
const ASSISTANT_MESSAGE =
  '<div data-is-streaming="false"><div class="standard-markdown"><p>A1</p></div></div>';

describe('ClaudeParser - attachment-only user turn', () => {
  let parser: ClaudeParser;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    parser = new ClaudeParser();
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
      'https://claude.ai/chat/attachment'
    );
    global.document = doc as any;
    global.window = doc.defaultView as any;
  }

  const conversation =
    row(0, USER_MESSAGE) + row(1, ASSISTANT_MESSAGE) + row(2, thumbnailHtml());

  it('does not drop the turn that carries only an attachment', () => {
    install(conversation);

    expect(parser.getMessageNodes()).toHaveLength(TOTAL);
  });

  it('reads the attachment turn as a user message', () => {
    install(conversation);

    const roles = parser.getMessageNodes().map((node) => parser.parseNode(node).role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });

  it('names the attachment in the exported markdown', () => {
    install(conversation);

    const nodes = parser.getMessageNodes();
    const markdown = htmlToMarkdown(parser.parseNode(nodes[2]).contentHtml);

    expect(markdown).toContain(`[File: ${ATTACHMENT_LABEL}]`);
  });

  it('keeps a turn with both text and an attachment as a single message', () => {
    install(row(0, USER_MESSAGE + thumbnailHtml()));

    const nodes = parser.getMessageNodes();
    expect(nodes).toHaveLength(1);

    const markdown = htmlToMarkdown(parser.parseNode(nodes[0]).contentHtml);
    expect(markdown).toContain('Q0');
    expect(markdown).toContain(`[File: ${ATTACHMENT_LABEL}]`);
  });
});
