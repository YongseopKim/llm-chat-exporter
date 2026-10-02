/**
 * Claude Parser
 *
 * Reads the conversation from the API claude.ai's own web app loads it from,
 * not from the rendered page:
 *   GET /api/organizations/<org>/chat_conversations/<id>
 *       ?tree=True&rendering_mode=messages&render_all_tools=true
 *
 * WHY NOT THE DOM:
 * Claude renders a virtualized list behind a paginated "Load earlier
 * messages" button and hides thinking and tool steps in collapsed blocks that
 * only inline styles tell apart. Each of those had to be reverse-engineered
 * from the page and each broke silently: on 2026-09-24 a new app-shell style
 * (`--desktop-top-bar-row-height: 0px`) made every assistant turn of seven
 * live conversations export as an empty string. The API returns the same
 * conversation the page shows, as Markdown, with nothing to scroll or guess.
 *
 * The request goes to claude.ai itself with the user's own session - the
 * same request the page makes - so no data leaves the browser.
 *
 * Response shape measured on 2026-09-24:
 * - `chat_messages` holds every branch; the page shows the one ending at
 *   `current_leaf_message_uuid`, walked back through `parent_message_uuid`
 * - assistant `content` interleaves thinking, tool_use, tool_result and text
 *   blocks; only text is what the page shows as the answer
 * - text blocks carry `citations` whose offsets index into that block's text
 *
 * Two tool calls are part of what the page shows (measured 2026-10-03):
 * - AskUserQuestion: the question card and the option the user picked,
 *   which is a turn of the conversation inside the assistant message
 * - Projects `project_write` with `present_to_user`: a file card after the
 *   answer; the file's text is in the project, not in the conversation
 */

import type {
  ArtifactData,
  ChatParser,
  Conversation,
  ParsedMessage,
  ProjectInfo,
} from './interface';
import { htmlToMarkdown } from '../converter';
import { waitForDom } from './dom-wait';
import { reportHtml, sourceLinksHtml } from './report-html';

const HOSTNAME = 'claude.ai';

/** Present on the message being streamed; the API has no in-progress flag */
const GENERATING_SELECTOR = '[data-is-streaming="true"]';

const CONVERSATION_PATH = /^\/chat\/([^/?#]+)/;

/** Cookie in which claude.ai records the organization the page is using */
const ACTIVE_ORG_COOKIE = 'lastActiveOrg';

/** The query the web app uses: every branch, with content split into blocks */
const CONVERSATION_QUERY = 'tree=True&rendering_mode=messages&render_all_tools=true';

const ARTIFACT_TOOL = 'artifacts';

/** Visualizations render in a sandboxed iframe titled "visualize: <title>" */
const VISUALIZATION_TOOL_PREFIX = 'visualize';

const QUESTION_TOOL = 'AskUserQuestion';

const PROJECT_TOOL = 'Projects';

interface ApiSource {
  url?: string;
  title?: string;
}

interface ApiCitation extends ApiSource {
  end_index?: number;
  sources?: ApiSource[];
}

interface ApiBlock {
  type: string;
  text?: string;
  citations?: ApiCitation[];
  name?: string;
  input?: Record<string, unknown>;
  /** tool_use: its id; tool_result: the id of the call it answers */
  id?: string;
  tool_use_id?: string;
  /** tool_result output */
  content?: Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

interface ApiQuestion {
  question?: string;
  options?: Array<{ label?: string; description?: string }>;
}

/** A file written to the project and shown as a card */
interface ProjectFile {
  path: string;
  docId: string;
}

interface ApiFile {
  file_name?: string;
}

interface ApiMessage {
  uuid: string;
  parent_message_uuid?: string;
  sender: 'human' | 'assistant';
  created_at?: string;
  content?: ApiBlock[];
  attachments?: ApiFile[];
  files?: ApiFile[];
}

interface ApiConversation {
  name?: string;
  project_uuid?: string | null;
  current_leaf_message_uuid?: string;
  chat_messages: ApiMessage[];
}

function apiGet(path: string): Promise<Response> {
  return fetch(new URL(path, document.location.origin).href, { credentials: 'include' });
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

function stringField(input: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = input?.[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** The messages of the branch the page shows, oldest first */
function currentBranch(conversation: ApiConversation): ApiMessage[] {
  const byId = new Map(conversation.chat_messages.map((message) => [message.uuid, message]));
  const branch: ApiMessage[] = [];

  let message = byId.get(conversation.current_leaf_message_uuid ?? '');
  while (message && branch.length < byId.size) {
    branch.push(message);
    message = byId.get(message.parent_message_uuid ?? '');
  }

  return branch.reverse();
}

/**
 * Numbers a turn's cited sources by URL, in order of first citation
 *
 * Rendered as Markdown reference definitions, so plain text reads "[1]" with
 * the URL listed under the turn and a Markdown viewer turns markers into links.
 */
class SourceList {
  private readonly numbers = new Map<string, number>();
  private readonly definitions: string[] = [];

  number(source: ApiSource): number | null {
    if (!source.url) {
      return null;
    }
    const known = this.numbers.get(source.url);
    if (known !== undefined) {
      return known;
    }

    const next = this.numbers.size + 1;
    this.numbers.set(source.url, next);
    const title = (source.title || source.url).replace(/"/g, '\\"');
    this.definitions.push(`[${next}]: ${source.url} "${title}"`);
    return next;
  }

  render(): string {
    return this.definitions.join('\n');
  }
}

/** A text block with a marker after each cited span */
function citedText(block: ApiBlock, sources: SourceList): string {
  const text = block.text ?? '';
  const markers = new Map<number, Set<number>>();

  const citations = (block.citations ?? [])
    .filter((c) => typeof c.end_index === 'number' && c.end_index >= 0 && c.end_index <= text.length)
    .sort((a, b) => (a.end_index as number) - (b.end_index as number));

  for (const citation of citations) {
    const cited = citation.sources?.length ? citation.sources : [citation];
    for (const source of cited) {
      const number = sources.number(source);
      if (number !== null) {
        const at = citation.end_index as number;
        markers.set(at, (markers.get(at) ?? new Set()).add(number));
      }
    }
  }

  let result = '';
  let cursor = 0;
  for (const [at, numbers] of markers) {
    result += `${text.slice(cursor, at)} ${[...numbers].map((n) => `[${n}]`).join('')}`;
    cursor = at;
  }
  return result + text.slice(cursor);
}

/**
 * Replays artifact commands so the latest version can be exported whole
 *
 * `create` and `rewrite` carry the full content; `update` replaces one
 * string in the previous version.
 */
class ArtifactHistory {
  private readonly artifacts = new Map<string, { title: string; content: string; versions: number }>();
  private latestId: string | null = null;

  /** Apply one command and return the artifact's title */
  apply(input: Record<string, unknown> | undefined): string {
    const id = stringField(input, 'id') ?? 'artifact';
    const previous = this.artifacts.get(id);
    const title = stringField(input, 'title') ?? previous?.title ?? 'Artifact';

    let content = previous?.content ?? '';
    if (input?.command === 'update') {
      const oldText = stringField(input, 'old_str');
      const newText = typeof input.new_str === 'string' ? input.new_str : '';
      if (oldText) {
        content = content.replace(oldText, () => newText);
      }
    } else if (typeof input?.content === 'string') {
      content = input.content;
    }

    this.artifacts.set(id, { title, content, versions: (previous?.versions ?? 0) + 1 });
    this.latestId = id;
    return title;
  }

  latest(): ArtifactData | null {
    const artifact = this.latestId === null ? undefined : this.artifacts.get(this.latestId);
    return artifact
      ? { title: artifact.title, version: `v${artifact.versions}`, content: artifact.content }
      : null;
  }
}

function resultText(result: ApiBlock | undefined): string {
  return (result?.content ?? []).map((part) => part.text ?? '').join('\n').trim();
}

/**
 * The option picked for each question, read from AskUserQuestion's result
 *
 * The result reads: Your questions have been answered: "<question>"="<answer>",
 * "<question>"="<answer>". You can now continue ... An answer can hold quotes
 * and commas, so each one runs up to where the next question starts.
 */
function pickedAnswers(text: string, questions: string[]): Array<string | undefined> {
  const starts = questions.map((question) => text.indexOf(`"${question}"="`));
  return questions.map((question, index) => {
    if (starts[index] < 0) {
      return undefined;
    }
    const from = starts[index] + question.length + 4;
    const next = starts.slice(index + 1).find((start) => start > from);
    const answer =
      next === undefined
        ? text.slice(from, text.lastIndexOf('"'))
        : text.slice(from, next).replace(/",\s*$/, '');
    return answer || undefined;
  });
}

/**
 * A question Claude asked and the answer the user picked
 *
 * When the answer cannot be picked out, the tool's result is kept as written
 * rather than guessed at.
 */
function questionMarkdown(input: Record<string, unknown> | undefined, result: ApiBlock | undefined): string {
  const questions = (Array.isArray(input?.questions) ? input.questions : []) as ApiQuestion[];
  const text = resultText(result);
  const answers = pickedAnswers(text, questions.map((question) => question.question ?? ''));

  return questions
    .map((question, index) =>
      [
        `[Question: ${question.question ?? ''}]`,
        ...(question.options ?? []).map(
          (option) => `- ${option.label ?? ''}${option.description ? `: ${option.description}` : ''}`
        ),
        `[User answer: ${answers[index] ?? (text || 'no answer')}]`,
      ].join('\n')
    )
    .join('\n\n');
}

/** The project file a successful, presented `project_write` call wrote */
function presentedProjectFile(call: ApiBlock, result: ApiBlock | undefined): ProjectFile | null {
  if (call.input?.method !== 'project_write' || call.input?.present_to_user !== true || !result || result.is_error) {
    return null;
  }
  try {
    const written = JSON.parse(resultText(result)) as { path?: string; doc_uuid?: string };
    const path = written.path || stringField(call.input, 'path');
    return path && written.doc_uuid ? { path, docId: written.doc_uuid } : null;
  } catch {
    return null;
  }
}

function userMarkdown(message: ApiMessage): string {
  const parts = (message.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => (block.text ?? '').trim());

  // Only the file's name: see "Attachment-Only Messages Export As A
  // Placeholder" in CLAUDE.md
  for (const file of [...(message.attachments ?? []), ...(message.files ?? [])]) {
    parts.push(`[File: ${file.file_name || 'Pasted text'}]`);
  }

  return parts.filter((part) => part !== '').join('\n\n');
}

function assistantMarkdown(
  message: ApiMessage,
  artifacts: ArtifactHistory,
  projectFiles: ProjectFile[]
): string {
  const sources = new SourceList();
  const parts: string[] = [];
  const results = new Map(
    (message.content ?? [])
      .filter((block) => block.type === 'tool_result' && block.tool_use_id)
      .map((block) => [block.tool_use_id as string, block])
  );
  const presented: ProjectFile[] = [];

  for (const block of message.content ?? []) {
    if (block.type === 'text') {
      parts.push(citedText(block, sources).trim());
    } else if (block.type === 'tool_use' && block.name === ARTIFACT_TOOL) {
      parts.push(`[Artifact: ${artifacts.apply(block.input)}]`);
    } else if (block.type === 'tool_use' && block.name?.startsWith(VISUALIZATION_TOOL_PREFIX)) {
      const title = stringField(block.input, 'title');
      parts.push(title ? `[Visualization omitted: ${title}]` : '[Visualization omitted]');
    } else if (block.type === 'tool_use' && block.name === QUESTION_TOOL) {
      parts.push(questionMarkdown(block.input, results.get(block.id ?? '')));
    } else if (block.type === 'tool_use' && block.name === PROJECT_TOOL) {
      const file = presentedProjectFile(block, results.get(block.id ?? ''));
      if (file) presented.push(file);
    }
  }
  // The page shows presented files as cards after the answer's text
  parts.push(...presented.map((file) => `[Artifact: ${file.path}]`));
  projectFiles.push(...presented);
  parts.push(sources.render());

  return parts.filter((part) => part !== '').join('\n\n');
}

/**
 * Claude platform parser
 */
export class ClaudeParser implements ChatParser {
  canHandle(hostname: string): boolean {
    return hostname !== '' && hostname.toLowerCase().includes(HOSTNAME);
  }

  isGenerating(): boolean {
    return document.querySelector(GENERATING_SELECTOR) !== null;
  }

  async readConversation(): Promise<Conversation> {
    const conversationId = document.location.pathname.match(CONVERSATION_PATH)?.[1];
    if (!conversationId) {
      throw new Error('Claude: open a conversation (claude.ai/chat/...) before exporting.');
    }

    const { org, conversation } = await this.fetchConversation(conversationId);
    const artifacts = new ArtifactHistory();
    const projectFiles: ProjectFile[] = [];
    const messages: ParsedMessage[] = currentBranch(conversation).map((message) => ({
      role: message.sender === 'human' ? 'user' : 'assistant',
      contentMarkdown:
        message.sender === 'human'
          ? userMarkdown(message)
          : assistantMarkdown(message, artifacts, projectFiles),
      timestamp: message.created_at,
    }));
    const warnings = this.compareWithPage(messages.length);
    let artifact = artifacts.latest();
    if (!artifact?.content.trim()) {
      const rendered = await this.readRenderedDocument();
      if (rendered) {
        artifact = rendered;
        warnings.push('Claude: the document source was not available in the conversation API; exported the rendered Markdown document.');
      } else if (artifact) {
        throw new Error('Claude: the artifact source is empty and its document could not be read.');
      }
    } else {
      try {
        artifact = await this.readRenderedDocument(artifact) || artifact;
      } catch (error) {
        warnings.push(`Claude: could not verify the artifact's rendered source links: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      messages,
      title: conversation.name || undefined,
      project: await this.readProject(org, conversation.project_uuid),
      artifacts: [
        ...(artifact ? [artifact] : []),
        ...(await this.readProjectFiles(org, conversation.project_uuid, projectFiles, warnings)),
      ],
      warnings,
    };
  }

  /**
   * Read each presented project file as it is stored now
   *
   * A later write to the same path replaces the earlier one. A file that
   * cannot be read keeps its `[Artifact: path]` marker and adds a warning.
   */
  private async readProjectFiles(
    org: string,
    projectId: string | null | undefined,
    files: ProjectFile[],
    warnings: string[]
  ): Promise<ArtifactData[]> {
    const latest = new Map(files.map((file) => [file.path, file.docId]));
    const read: ArtifactData[] = [];

    for (const [path, docId] of latest) {
      let status = 'no project';
      try {
        if (projectId) {
          const response = await apiGet(`/api/organizations/${org}/projects/${projectId}/docs/${docId}`);
          status = `HTTP ${response.status}`;
          const doc = response.ok ? ((await response.json()) as { content?: unknown }) : null;
          if (typeof doc?.content === 'string') {
            read.push({ title: path, version: 'file', content: doc.content });
            continue;
          }
        }
      } catch (error) {
        status = error instanceof Error ? error.message : String(error);
      }
      warnings.push(`Claude: could not read the project file "${path}" (${status}).`);
    }

    return read;
  }

  /** Read missing document content or sources; keep API message and code text. */
  private async readRenderedDocument(existing?: ArtifactData): Promise<ArtifactData | null> {
    const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="artifact-card-open"], [data-testid="frame-card-open"]'));
    const cardTitle = (card: Element) => card.getAttribute('aria-label')?.replace(/^View /, '').trim();
    const card = existing ? cards.find(candidate => cardTitle(candidate) === existing.title) : cards[cards.length - 1];
    if (!card) return null;
    const title = cardTitle(card);
    if (!title) throw new Error('Claude: the document card has no title.');
    const initialPanel = document.querySelector('[role="region"][aria-label^="Artifact panel:"]');
    const initialLabel = initialPanel?.getAttribute('aria-label');
    const matchingPanel = () => Array.from(document.querySelectorAll('[role="region"]'))
      .find(panel => panel.getAttribute('aria-label') === `Artifact panel: ${title}`) || null;
    try {
      if (!matchingPanel()) card.click();
      let body: Element;
      if (card.getAttribute('data-testid') === 'frame-card-open') {
        const frame = await waitForDom(() => matchingPanel()?.querySelector<HTMLIFrameElement>('iframe') || null, 10000);
        const url = new URL(frame.src, document.location.origin);
        const artifactId = url.origin === document.location.origin ? url.pathname.match(/^\/code\/artifact\/([0-9a-f-]+)$/i)?.[1] : undefined;
        if (!artifactId) throw new Error('Claude: unexpected document panel frame.');
        const response = await chrome.runtime.sendMessage({ type: 'READ_CLAUDE_DOC', artifactId, title });
        if (!response?.success || typeof response.html !== 'string' || !response.html.trim()) {
          throw new Error(response?.error || `Claude: the document "${title}" is empty or inaccessible.`);
        }
        body = new DOMParser().parseFromString(response.html, 'text/html').body;
      } else {
        body = await waitForDom(() => {
          const content = matchingPanel()?.querySelector('#markdown-artifact .standard-markdown');
          return content?.textContent?.trim() ? content : null;
        }, 10000).catch(() => { throw new Error(`Claude: could not read the document "${title}". Open its Markdown document panel and export again.`); });
      }
      if (existing) {
        const sources = body.cloneNode(true) as Element;
        const original = existing.content.replace(/\\([()])/g, '$1');
        sources.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
          if (original.includes(link.href)) link.remove();
        });
        const added = htmlToMarkdown(sourceLinksHtml(sources));
        return added ? { ...existing, content: `${existing.content}\n\n${added}` } : existing;
      }
      return { title, version: 'rendered', content: htmlToMarkdown(reportHtml(body)) };
    } finally {
      if (!initialLabel) {
        const close = matchingPanel()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
          || document.querySelector<HTMLButtonElement>('button[aria-label="Close artifact"]');
        close?.click();
      } else if (matchingPanel()?.getAttribute('aria-label') !== initialLabel) {
        cards.find(candidate => `Artifact panel: ${candidate.getAttribute('aria-label')?.replace(/^View /, '')}` === initialLabel)?.click();
      }
    }
  }

  /**
   * Load the conversation from the organization the page is using, or from
   * whichever of the user's organizations holds it when none is recorded
   */
  private async fetchConversation(
    conversationId: string
  ): Promise<{ org: string; conversation: ApiConversation }> {
    const active = readCookie(ACTIVE_ORG_COOKIE);
    const orgs = active ? [active] : await this.listOrganizations();

    let status = 0;
    for (const org of orgs) {
      const response = await apiGet(
        `/api/organizations/${org}/chat_conversations/${conversationId}?${CONVERSATION_QUERY}`
      );
      if (response.ok) {
        return { org, conversation: (await response.json()) as ApiConversation };
      }
      status = response.status;
    }

    throw new Error(
      `Claude: could not load this conversation (HTTP ${status}). ` +
        'Reload the page, check that you are signed in, and export again.'
    );
  }

  private async listOrganizations(): Promise<string[]> {
    const response = await apiGet('/api/organizations');
    if (!response.ok) {
      return [];
    }
    const organizations = (await response.json()) as Array<{ uuid?: string }>;
    return organizations.map((org) => org.uuid).filter((uuid): uuid is string => !!uuid);
  }

  /** The project's name is optional metadata, so a failed lookup keeps the id */
  private async readProject(org: string, projectId?: string | null): Promise<ProjectInfo | null> {
    if (!projectId) {
      return null;
    }

    let name: string | undefined;
    try {
      const response = await apiGet(`/api/organizations/${org}/projects/${projectId}`);
      name = response.ok ? ((await response.json()) as { name?: string }).name : undefined;
    } catch {
      name = undefined;
    }
    return { id: projectId, name: name || projectId };
  }

  /**
   * The page's list advertises its length on every row (`aria-setsize`), so a
   * branch that came out longer or shorter than what the page shows is caught
   */
  private compareWithPage(exported: number): string[] {
    const listed = Math.max(
      0,
      ...Array.from(
        document.querySelectorAll('[aria-setsize]'),
        (el) => Number(el.getAttribute('aria-setsize')) || 0
      )
    );

    return listed > 0 && listed !== exported
      ? [`The page lists ${listed} messages but the export holds ${exported}.`]
      : [];
  }
}
