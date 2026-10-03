/**
 * Grok project answer - reduced from
 * grok.com/project/a13f5064-1f08-42bd-aca5-add7b4f772d4?chat=8f2107ca-e477-41f1-8944-786687fb53eb
 * as measured on 2026-10-03.
 *
 * The export of that conversation lost three things:
 * - all 45 search sources: the drawer's first section ("명령 실행함") lists
 *   commands and has no links, so waiting for a link timed out and the whole
 *   list was dropped with a warning
 * - the report the answer wrote to the project: the file card exported as a
 *   26 KB base64 icon plus its "문서 · 19.89 KB" and "다운로드" labels, and the
 *   file's text was missing
 * - the prompt's layout: Grok keeps a paragraph's line breaks with
 *   white-space: pre-wrap, and shows a typed "## Title" line as text rather
 *   than a heading, which came out as "\## Title"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrokParser } from '../../../src/content/parsers/grok';
import { htmlToMarkdown } from '../../../src/content/converter';

const WORKSPACE = 'ws-1';
const FILE = 'BASE-Base-report.md';
const REPORT = '# BASE - Base 심층 리포트\n\n기준일: 2026-10-02.\n\n| 상태 | 평가액 |\n| --- | --- |\n| 토큰 없음 | 없음 |\n';
const SIGNED_URL = `https://storage.googleapis.com/grok-terminal-artifacts-prod/projects/${WORKSPACE}/${FILE}?X-Goog-Signature=abc`;

function bytes(text: string): string {
  return String(new TextEncoder().encode(text).length);
}

function page(sourceCount: number): string {
  return `
    <div id="response-user-1">
      <div class="message-bubble" data-testid="user-message">
        <div class="response-content-markdown markdown"><p dir="auto" style="white-space: pre-wrap">맨 아래에 위치한 글 내용을 봐줘.
내가 원하는 건 "BASE" 이야.</p><hr><p dir="auto" style="white-space: pre-wrap">## 원하는 프레임워크 최종 템플릿</p><p dir="auto" style="white-space: pre-wrap">### 조건부 평가(==Valuation)</p></div>
      </div>
      <button aria-label="편집"></button>
    </div>
    <div id="response-answer-1">
      <div class="message-bubble" data-testid="assistant-message">
        <div class="thinking-container">3m 2s동안 작업함</div>
        <div class="response-content-markdown markdown"><p dir="auto">BASE는 기준일에 네트워크 토큰이 없습니다.</p><p dir="auto">전체 기록은 파일로 남겼습니다.</p><div><div role="button" tabindex="0" aria-label="${FILE} 열기"><img alt="" src="/assets/file-icon.png"><div><span>${FILE}</span><span>문서 · 19.89 KB</span></div><button data-slot="button" type="button" aria-label="${FILE} 다운로드"><svg></svg></button></div></div><h2>프로젝트가 해결하려는 문제</h2></div>
        <div role="button" aria-label="${sourceCount} sources"><img src="https://www.google.com/s2/favicons?domain=a.example">${sourceCount} sources</div>
      </div>
      <button aria-label="다시 생성"></button>
    </div>`;
}

/** Each result renders two links to the same page: its title and its snippet */
function result(url: string, title: string): string {
  return `<a href="${url}" target="_blank"><span>${title}</span><p>Snippet of ${title}</p></a><a href="${url}"><img src="https://www.google.com/s2/favicons?domain=x"></a>`;
}

/** The source drawer: one section open at a time, rendered on expansion */
function installSourceDrawer(): void {
  const sections = [
    { title: '명령 실행함', body: '<pre>cat /workspace/artifacts/AAVE-Aave-report.md</pre>' },
    { title: '웹 검색함 Base L2 TVL 2', body: result('https://a.example/tvl', 'Base L2 TVL') + result('https://b.example/q2', 'Coinbase Q2') },
    { title: '웹 검색함 Coinbase revenue 1', body: result('https://b.example/q2', 'Coinbase Q2') },
    { title: '파일 작성함 /artifacts/BASE-Base-report.md', body: '<p>/artifacts/BASE-Base-report.md</p>' },
  ];
  document.querySelector('[aria-label$=" sources"]')!.addEventListener('click', () => {
    const aside = document.createElement('aside');
    aside.innerHTML = '<button aria-label="닫기"></button><div>출처</div><div>Thinking about your request</div>' +
      sections.map((section, i) => `<h3><button aria-controls="step-${i}" aria-expanded="false">${section.title}</button></h3><div id="step-${i}"></div>`).join('');
    aside.querySelectorAll<HTMLButtonElement>('h3 button').forEach((button, i) => {
      button.addEventListener('click', () => {
        aside.querySelectorAll('h3 button').forEach((other) => other.setAttribute('aria-expanded', 'false'));
        aside.querySelectorAll('[id^="step-"]').forEach((region) => { region.innerHTML = ''; });
        button.setAttribute('aria-expanded', 'true');
        setTimeout(() => { aside.querySelector(`#step-${i}`)!.innerHTML = sections[i].body; }, 5);
      });
    });
    aside.querySelector('[aria-label="닫기"]')!.addEventListener('click', () => aside.remove());
    document.body.append(aside);
  });
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function mockProjectFiles(report = REPORT, size = bytes(REPORT)): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const { pathname, search } = new URL(url);
    const reply = (status: number, body: unknown) =>
      ({ ok: status === 200, status, json: async () => body, text: async () => String(body) }) as Response;
    if (pathname === `/rest/workspaces/${WORKSPACE}/files` && search === '?recursive=true') {
      return reply(200, {
        path: '/',
        files: [
          { path: '/.grok', name: '.grok', isDirectory: true, size: '0', mimeType: '' },
          { path: '/AAVE-Aave-report.md', name: 'AAVE-Aave-report.md', isDirectory: false, size: '10', mimeType: 'text/markdown' },
          { path: `/${FILE}`, name: FILE, isDirectory: false, size, mimeType: 'text/markdown' },
        ],
      });
    }
    if (pathname === `/rest/workspaces/${WORKSPACE}/files/content` && search === `?path=${encodeURIComponent(`/${FILE}`)}`) {
      return reply(200, { signedUrl: SIGNED_URL, expiresAt: '2026-10-03T12:00:00Z', mimeType: 'text/markdown', size });
    }
    if (url === SIGNED_URL) {
      return reply(200, report);
    }
    return reply(404, { error: 'not found' });
  }) as typeof fetch;
  return calls;
}

describe('GrokParser - project answer with a file and search sources', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    window.history.pushState({}, '', `/project/${WORKSPACE}?chat=chat-1`);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    global.fetch = originalFetch;
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('collects every source, skipping drawer sections that list no links', async () => {
    document.body.innerHTML = page(3);
    installSourceDrawer();
    mockProjectFiles();

    const conversation = await new GrokParser().readConversation();
    const answer = htmlToMarkdown(conversation.messages[1].contentHtml!);

    expect(conversation.warnings).toEqual([]);
    expect(answer).toContain('### Search sources');
    expect(answer).toContain('[Base L2 TVL](https://a.example/tvl)');
    expect(answer.match(/https:\/\/b\.example\/q2/g)).toHaveLength(1);
    expect(answer).not.toContain('cat /workspace');
    expect(answer).not.toContain('Snippet of');
    expect(document.querySelector('aside')).toBeNull();
  });

  it('warns when the drawer yields fewer sources than its button lists', async () => {
    document.body.innerHTML = page(4);
    installSourceDrawer();
    mockProjectFiles();

    const conversation = await new GrokParser().readConversation();

    expect(conversation.warnings).toEqual([
      'Grok: Collected 3 of the 4 sources listed for response-answer-1.',
    ]);
    expect(htmlToMarkdown(conversation.messages[1].contentHtml!)).toContain('https://a.example/tvl');
  });

  it('marks the file card in the answer and exports the file from the project', async () => {
    document.body.innerHTML = page(3);
    installSourceDrawer();
    const calls = mockProjectFiles();

    const conversation = await new GrokParser().readConversation();
    const answer = htmlToMarkdown(conversation.messages[1].contentHtml!);

    expect(answer.startsWith(
      'BASE는 기준일에 네트워크 토큰이 없습니다.\n\n전체 기록은 파일로 남겼습니다.\n\n' +
        `[Artifact: ${FILE}]\n\n## 프로젝트가 해결하려는 문제`
    )).toBe(true);
    expect(answer).not.toContain('문서 · 19.89 KB');
    expect(answer).not.toContain('다운로드');
    expect(answer).not.toContain('file-icon');
    expect(answer).not.toContain('3m 2s');
    expect(conversation.artifacts).toEqual([{ title: FILE, version: 'file', content: REPORT }]);
    expect(conversation.warnings).toEqual([]);
    // The signed storage URL carries its own authorization: no cookies go there.
    expect(calls.find((call) => call.url === SIGNED_URL)?.init?.credentials).not.toBe('include');
  });

  it('warns and keeps the marker when the file cannot be read', async () => {
    window.history.pushState({}, '', '/c/chat-1');
    document.body.innerHTML = page(3);
    installSourceDrawer();
    mockProjectFiles();

    const conversation = await new GrokParser().readConversation();

    expect(htmlToMarkdown(conversation.messages[1].contentHtml!)).toContain(`[Artifact: ${FILE}]`);
    expect(conversation.artifacts).toEqual([]);
    expect(conversation.warnings).toEqual([
      `Grok: could not read the file "${FILE}": this conversation is not in a project.`,
    ]);
  });

  it('warns rather than exporting a file whose download is incomplete', async () => {
    document.body.innerHTML = page(3);
    installSourceDrawer();
    mockProjectFiles(REPORT.slice(0, 20), bytes(REPORT));

    const conversation = await new GrokParser().readConversation();

    expect(conversation.artifacts).toEqual([]);
    expect(conversation.warnings).toEqual([
      `Grok: could not read the file "${FILE}": received ${bytes(REPORT.slice(0, 20))} of ${bytes(REPORT)} bytes.`,
    ]);
  });

  // Turndown already reads TeX whitespace as spaces ("a \\ b"); splitting the
  // annotation at its line break would instead run the lines together.
  it('leaves math source alone inside a paragraph that keeps its line breaks', async () => {
    document.body.innerHTML = `<div id="response-answer-2"><div class="message-bubble" data-testid="assistant-message"><p style="white-space: pre-wrap">Sum:
<span class="katex-display"><span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">a \\\\
b</annotation></semantics></math></span></span></span></p></div><button aria-label="다시 생성"></button></div>`;
    mockProjectFiles();

    const conversation = await new GrokParser().readConversation();

    expect(htmlToMarkdown(conversation.messages[0].contentHtml!)).toBe('Sum:\n$$a \\\\ b$$');
  });

  it("keeps the prompt's line breaks and its typed heading markers", async () => {
    document.body.innerHTML = page(3);
    installSourceDrawer();
    mockProjectFiles();

    const conversation = await new GrokParser().readConversation();

    expect(htmlToMarkdown(conversation.messages[0].contentHtml!)).toBe(
      '맨 아래에 위치한 글 내용을 봐줘.\n내가 원하는 건 "BASE" 이야.\n\n* * *\n\n' +
        '## 원하는 프레임워크 최종 템플릿\n\n### 조건부 평가(==Valuation)'
    );
  });
});
