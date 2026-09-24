/**
 * ClaudeParser - reads the conversation from claude.ai's own conversation API
 *
 * The page's web app loads every conversation from
 *   /api/organizations/<org>/chat_conversations/<id>?tree=True&rendering_mode=messages&render_all_tools=true
 * and the parser reads the same endpoint instead of the rendered DOM. The DOM
 * approach broke repeatedly (virtualized rows, paginated history, collapsed
 * thinking detected from inline styles); on 2026-09-24 it exported every
 * assistant turn of seven live conversations as an empty string.
 *
 * The fixture below mirrors the response shape measured on 2026-09-24:
 * - `chat_messages` holds every branch; `current_leaf_message_uuid` names the
 *   branch the page shows, walked back through `parent_message_uuid`
 * - assistant `content` interleaves thinking, tool_use, tool_result and text
 * - text blocks carry `citations` with offsets into that block's text
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeParser } from '../../../src/content/parsers/claude';
import { createDOMFromHTML } from './shared/fixtures';

const ORG = 'org-1';
const CONVERSATION = '11111111-2222-4333-8444-555555555555';
const PROJECT = 'project-1';
const ROOT = '00000000-0000-4000-8000-000000000000';

type Json = Record<string, unknown>;

function message(overrides: Json): Json {
  return {
    uuid: 'm',
    text: '',
    content: [],
    sender: 'human',
    index: 0,
    created_at: '2026-09-24T01:00:00.000000Z',
    updated_at: '2026-09-24T01:00:00.000000Z',
    truncated: false,
    attachments: [],
    files: [],
    parent_message_uuid: ROOT,
    ...overrides,
  };
}

function text(value: string, citations: Json[] = []): Json {
  return { type: 'text', text: value, citations, citations_grouping_mode: 'paragraph_end' };
}

function citation(
  start: number,
  end: number,
  url: string,
  title: string,
  sources?: Array<{ url: string; title: string }>
): Json {
  return {
    start_index: start,
    end_index: end,
    url,
    title,
    origin_tool_name: 'web_search',
    sources: (sources ?? [{ url, title }]).map((s) => ({ ...s, source: 'site', uuid: 'u' })),
  };
}

function conversation(overrides: Json = {}): Json {
  return {
    uuid: CONVERSATION,
    name: 'Arc explained',
    project_uuid: null,
    current_leaf_message_uuid: 'a1',
    chat_messages: [
      message({ uuid: 'h0', index: 0, content: [text('What is Arc?')] }),
      message({
        uuid: 'a1',
        index: 1,
        sender: 'assistant',
        parent_message_uuid: 'h0',
        created_at: '2026-09-24T01:00:05.000000Z',
        content: [
          { type: 'thinking', thinking: 'private reasoning' },
          { type: 'tool_use', name: 'web_search', input: { query: 'arc' } },
          { type: 'tool_result', name: 'web_search', content: [{ type: 'text', text: 'raw results' }] },
          text('Arc is a layer-1 chain.'),
        ],
      }),
    ],
    ...overrides,
  };
}

interface FetchCall {
  url: string;
}

function mockFetch(routes: Record<string, { status: number; body?: unknown }>): FetchCall[] {
  const calls: FetchCall[] = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ url });
    const path = new URL(url).pathname;
    const route = routes[path] ?? { status: 404, body: { error: 'not found' } };
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: async () => route.body,
    } as Response;
  }) as typeof fetch;
  return calls;
}

const conversationPath = `/api/organizations/${ORG}/chat_conversations/${CONVERSATION}`;

describe('ClaudeParser', () => {
  let parser: ClaudeParser;
  let originalDocument: Document;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    parser = new ClaudeParser();
    originalDocument = global.document;
    originalFetch = global.fetch;
    const doc = createDOMFromHTML('<html><body></body></html>', `https://claude.ai/chat/${CONVERSATION}`);
    doc.cookie = `lastActiveOrg=${ORG}`;
    global.document = doc as any;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('canHandle', () => {
    it('handles claude.ai only', () => {
      expect(parser.canHandle('claude.ai')).toBe(true);
      expect(parser.canHandle('www.claude.ai')).toBe(true);
      expect(parser.canHandle('chatgpt.com')).toBe(false);
      expect(parser.canHandle('')).toBe(false);
    });
  });

  describe('isGenerating', () => {
    it('is true while a response is streaming', () => {
      global.document = createDOMFromHTML('<div data-is-streaming="true"></div>') as any;
      expect(parser.isGenerating()).toBe(true);
    });

    it('is false once streaming has finished', () => {
      global.document = createDOMFromHTML('<div data-is-streaming="false"></div>') as any;
      expect(parser.isGenerating()).toBe(false);
    });
  });

  describe('readConversation', () => {
    it('reads the conversation of the current URL from the active organization', async () => {
      const calls = mockFetch({ [conversationPath]: { status: 200, body: conversation() } });

      await parser.readConversation();

      const url = new URL(calls[0].url);
      expect(url.origin).toBe('https://claude.ai');
      expect(url.pathname).toBe(conversationPath);
      expect(url.searchParams.get('tree')).toBe('True');
      expect(url.searchParams.get('rendering_mode')).toBe('messages');
      expect(url.searchParams.get('render_all_tools')).toBe('true');
    });

    it('exports only the text the page shows, not thinking or tool traffic', async () => {
      mockFetch({ [conversationPath]: { status: 200, body: conversation() } });

      const { messages, title } = await parser.readConversation();

      expect(title).toBe('Arc explained');
      expect(messages).toEqual([
        { role: 'user', contentMarkdown: 'What is Arc?', timestamp: '2026-09-24T01:00:00.000000Z' },
        {
          role: 'assistant',
          contentMarkdown: 'Arc is a layer-1 chain.',
          timestamp: '2026-09-24T01:00:05.000000Z',
        },
      ]);
    });

    it('joins every text block of a turn, including interim notes between tool calls', async () => {
      mockFetch({
        [conversationPath]: {
          status: 200,
          body: conversation({
            chat_messages: [
              message({ uuid: 'h0', content: [text('Check it')] }),
              message({
                uuid: 'a1',
                sender: 'assistant',
                parent_message_uuid: 'h0',
                content: [
                  text('Let me fetch the terms.'),
                  { type: 'tool_use', name: 'web_fetch', input: {} },
                  { type: 'tool_result', name: 'web_fetch', content: [] },
                  text('## Answer\n\nFinal body.'),
                ],
              }),
            ],
          }),
        },
      });

      const { messages } = await parser.readConversation();

      expect(messages[1].contentMarkdown).toBe('Let me fetch the terms.\n\n## Answer\n\nFinal body.');
    });

    it('follows the branch the page shows when a message was edited or retried', async () => {
      mockFetch({
        [conversationPath]: {
          status: 200,
          body: conversation({
            current_leaf_message_uuid: 'a3b',
            chat_messages: [
              message({ uuid: 'h0', index: 0, content: [text('Q0')] }),
              message({ uuid: 'a1', index: 1, sender: 'assistant', parent_message_uuid: 'h0', content: [text('A1')] }),
              message({ uuid: 'h2a', index: 2, parent_message_uuid: 'a1', content: [text('Q2 first try')] }),
              message({ uuid: 'a3a', index: 3, sender: 'assistant', parent_message_uuid: 'h2a', content: [text('A3 first try')] }),
              message({ uuid: 'h2b', index: 2, parent_message_uuid: 'a1', content: [text('Q2 edited')] }),
              message({ uuid: 'a3b', index: 3, sender: 'assistant', parent_message_uuid: 'h2b', content: [text('A3 edited')] }),
            ],
          }),
        },
      });

      const { messages } = await parser.readConversation();

      expect(messages.map((m) => m.contentMarkdown)).toEqual(['Q0', 'A1', 'Q2 edited', 'A3 edited']);
    });

    /**
     * Markers are reference-style links: plain text reads as "[1]" with the
     * URL listed under the turn, and a Markdown viewer renders them as links.
     */
    it('marks each citation where it ends and lists its sources once', async () => {
      const body = 'Arc launched in 2026. Validators include banks.\n\nUSDC is the gas token.';
      const first = body.indexOf('.') + 1;
      const second = body.indexOf('banks.') + 'banks.'.length;
      const third = body.length;
      mockFetch({
        [conversationPath]: {
          status: 200,
          body: conversation({
            chat_messages: [
              message({ uuid: 'h0', content: [text('Q')] }),
              message({
                uuid: 'a1',
                sender: 'assistant',
                parent_message_uuid: 'h0',
                content: [
                  text(body, [
                    citation(0, first, 'https://news.example/arc', 'Arc launches'),
                    citation(first + 1, second, 'https://block.example/validators', 'Validators', [
                      { url: 'https://block.example/validators', title: 'Validators' },
                      { url: 'https://news.example/arc', title: 'Arc launches' },
                    ]),
                    citation(second + 2, third, 'https://docs.example/gas', 'Gas "fees"'),
                  ]),
                ],
              }),
            ],
          }),
        },
      });

      const { messages } = await parser.readConversation();

      expect(messages[1].contentMarkdown).toBe(
        'Arc launched in 2026. [1] Validators include banks. [2][1]\n\n' +
          'USDC is the gas token. [3]\n\n' +
          '[1]: https://news.example/arc "Arc launches"\n' +
          '[2]: https://block.example/validators "Validators"\n' +
          '[3]: https://docs.example/gas "Gas \\"fees\\""'
      );
    });

    it('names files attached to a user turn instead of copying their text', async () => {
      mockFetch({
        [conversationPath]: {
          status: 200,
          body: conversation({
            current_leaf_message_uuid: 'h0',
            chat_messages: [
              message({
                uuid: 'h0',
                content: [text('Summarize these')],
                attachments: [
                  { file_name: 'notes.md', file_type: 'text/markdown', extracted_content: 'secret body' },
                  { file_name: '', file_type: 'txt', extracted_content: 'pasted body' },
                ],
                files: [{ file_name: 'chart.png', file_kind: 'image' }],
              }),
            ],
          }),
        },
      });

      const { messages } = await parser.readConversation();

      expect(messages[0].contentMarkdown).toBe(
        'Summarize these\n\n[File: notes.md]\n\n[File: Pasted text]\n\n[File: chart.png]'
      );
    });

    it('marks a visualization where it was drawn', async () => {
      mockFetch({
        [conversationPath]: {
          status: 200,
          body: conversation({
            chat_messages: [
              message({ uuid: 'h0', content: [text('Draw it')] }),
              message({
                uuid: 'a1',
                sender: 'assistant',
                parent_message_uuid: 'h0',
                content: [
                  text('Here is the flow:'),
                  { type: 'tool_use', name: 'visualize', input: { title: 'Payment flow' } },
                  text('It settles in one block.'),
                ],
              }),
            ],
          }),
        },
      });

      const { messages } = await parser.readConversation();

      expect(messages[1].contentMarkdown).toBe(
        'Here is the flow:\n\n[Visualization omitted: Payment flow]\n\nIt settles in one block.'
      );
    });

    it('rebuilds the latest artifact from its create and update commands', async () => {
      mockFetch({
        [conversationPath]: {
          status: 200,
          body: conversation({
            current_leaf_message_uuid: 'a3',
            chat_messages: [
              message({ uuid: 'h0', content: [text('Write a doc')] }),
              message({
                uuid: 'a1',
                sender: 'assistant',
                parent_message_uuid: 'h0',
                content: [
                  {
                    type: 'tool_use',
                    name: 'artifacts',
                    input: { id: 'doc', command: 'create', title: 'Plan', content: '# Plan\n\nStep one' },
                  },
                  text('Created.'),
                ],
              }),
              message({ uuid: 'h2', parent_message_uuid: 'a1', content: [text('Add a step')] }),
              message({
                uuid: 'a3',
                sender: 'assistant',
                parent_message_uuid: 'h2',
                content: [
                  {
                    type: 'tool_use',
                    name: 'artifacts',
                    input: { id: 'doc', command: 'update', old_str: 'Step one', new_str: 'Step one\nStep two' },
                  },
                  text('Updated.'),
                ],
              }),
            ],
          }),
        },
      });

      const { messages, artifact } = await parser.readConversation();

      expect(messages[1].contentMarkdown).toBe('[Artifact: Plan]\n\nCreated.');
      expect(messages[3].contentMarkdown).toBe('[Artifact: Plan]\n\nUpdated.');
      expect(artifact).toEqual({ title: 'Plan', version: 'v2', content: '# Plan\n\nStep one\nStep two' });
    });

    it('reports no artifact when the conversation made none', async () => {
      mockFetch({ [conversationPath]: { status: 200, body: conversation() } });

      const { artifact } = await parser.readConversation();

      expect(artifact).toBeNull();
    });

    it('names the project the conversation belongs to', async () => {
      mockFetch({
        [conversationPath]: { status: 200, body: conversation({ project_uuid: PROJECT }) },
        [`/api/organizations/${ORG}/projects/${PROJECT}`]: {
          status: 200,
          body: { uuid: PROJECT, name: 'CIRCLE' },
        },
      });

      const { project } = await parser.readConversation();

      expect(project).toEqual({ id: PROJECT, name: 'CIRCLE' });
    });

    it('keeps the project id when its name cannot be read', async () => {
      mockFetch({ [conversationPath]: { status: 200, body: conversation({ project_uuid: PROJECT }) } });

      const { project } = await parser.readConversation();

      expect(project).toEqual({ id: PROJECT, name: PROJECT });
    });

    it('finds the organization holding the conversation when no active one is recorded', async () => {
      global.document.cookie = 'lastActiveOrg=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      mockFetch({
        '/api/organizations': { status: 200, body: [{ uuid: 'other' }, { uuid: ORG }] },
        [conversationPath]: { status: 200, body: conversation() },
      });

      const { messages } = await parser.readConversation();

      expect(messages).toHaveLength(2);
    });

    it('fails loudly instead of exporting a partial page when the API refuses', async () => {
      mockFetch({ [conversationPath]: { status: 403, body: {} } });

      await expect(parser.readConversation()).rejects.toThrow(/Claude: could not load .*HTTP 403/);
    });

    it('fails loudly outside a conversation page', async () => {
      global.document = createDOMFromHTML('<html></html>', 'https://claude.ai/new') as any;
      mockFetch({});

      await expect(parser.readConversation()).rejects.toThrow(/Claude: open a conversation/);
    });

    it('warns when the page lists a different number of messages than the export holds', async () => {
      global.document.body.innerHTML = '<div role="article" aria-setsize="4" aria-posinset="4"></div>';
      mockFetch({ [conversationPath]: { status: 200, body: conversation() } });

      const { warnings } = await parser.readConversation();

      expect(warnings).toEqual(['The page lists 4 messages but the export holds 2.']);
    });

    it('does not warn when the page agrees with the export', async () => {
      global.document.body.innerHTML = '<div role="article" aria-setsize="2" aria-posinset="2"></div>';
      mockFetch({ [conversationPath]: { status: 200, body: conversation() } });

      const { warnings } = await parser.readConversation();

      expect(warnings).toEqual([]);
    });
  });
});
