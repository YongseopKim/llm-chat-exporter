# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LLM Chat Exporter** is a Chrome Extension (Manifest V3) that exports conversations from ChatGPT, Claude, Gemini, and Grok web UIs to JSONL format. ChatGPT, Gemini, Grok and Perplexity are parsed from the DOM; Claude is read from the conversation API claude.ai's own page loads (see "Claude Exports From The Conversation API"). No API keys, no third-party servers.

### Core Value Proposition
- **Context Preservation**: Captures conversations as they appear in the web UI, including service-optimized system prompts
- **Local-First**: All processing happens in the browser, no external server communication
- **Data Ownership**: Users own their conversation data permanently

### Project Status
🚀 Phase 7 Complete - Configuration-Driven Architecture with 388 passing tests

**Completed Phases**:
- ✅ Phase 0: Architecture & Planning
- ✅ Phase 1: DOM Selector Validation (2025-11-29)
- ✅ Phase 2: Extension Skeleton (2025-11-29)
- ✅ Phase 2.5: Test Environment Setup (2025-11-29)
- ✅ Phase 3: Core Utilities (2025-11-29)
- ✅ Phase 4: Platform Parsers (ChatGPT, Claude, Gemini) (2025-11-29)
- ✅ Phase 4D: Factory Integration (2025-11-29)
- ✅ Phase 5: Integration & Testing (2025-11-29)
- ✅ Phase 7: Configuration-Driven Architecture (2025-11-29)
- ⏳ Phase 6: Documentation & Deployment (optional)

## Version Up

Automatically bump versions when a task makes a clear bug fix, adds a feature, or makes a major structural change. Do not wait for a separate version-up request:

- Bug fix: **patch**
- New feature: **minor**
- Major structural or architectural change: **major**

When a task includes more than one category, use the highest level and bump once for that task. An explicit version or level requested by the user takes precedence. A standalone "version up" (버전 업) request defaults to patch.

1. `npm version <patch|minor|major> --no-git-tag-version` (updates `package.json` + `package-lock.json`)
2. Bump `"version"` in `manifest.json` by the same level (the version Chrome shows)
3. `npm install && npm run build && npm test`
4. Tell the user to reload the extension at `chrome://extensions/`

Note: `manifest.json` (0.x) and `package.json` (1.x) have separate version lines; bump each by the selected level. When the user names a version (e.g. 0.2.0), it is the `manifest.json` version; bump `package.json` by the same level (minor -> 1.1.0).

## Development Commands

### Build System

```bash
# Install dependencies
npm install

# Build extension (TypeScript → JavaScript via esbuild)
npm run build

# Run all tests (388 tests)
npm test

# Validate selector configuration
npm run validate:selectors

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Build in watch mode (auto-rebuild on changes)
npm run watch

# Load extension in Chrome
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked extension"
# 4. Select the project root directory
```

**Output**: `dist/background.js`, `dist/content.js`

## Architecture Overview

### Strategy Pattern Implementation
The project uses Strategy Pattern to handle three different platforms (ChatGPT, Claude, Gemini), each with different DOM structures:

```
[User Shortcut Ctrl+Shift+E]
         ↓
[Background Script (Service Worker)]
  - Listens for keyboard shortcut
  - Checks current tab URL
  - Determines if supported site
  - Sends message to Content Script
         ↓
[Content Script]
  - Identifies platform from URL
  - Instantiates appropriate Parser
  - Executes scroll logic (full conversation loading)
  - Parses DOM → ParsedMessage[]
  - Converts HTML → Markdown
  - Serializes to JSONL
  - Returns result to Background
         ↓
[Parser Strategy Layer]
  ├─ ChatGPTParser
  ├─ ClaudeParser (no DOM: reads the page's conversation API)
  └─ GeminiParser (Shadow DOM handling)
```

### Key Design Patterns
- **Strategy Pattern**: Platform-specific parsers implement common `ChatParser` interface
- **Factory Pattern**: `ParserFactory` selects appropriate parser based on URL hostname
- **Adapter Pattern**: Turndown library wrapped for HTML→Markdown conversion

### File Structure (Implemented)
```
llm-chat-exporter/
├── manifest.json              # Extension config (Manifest V3)
├── config/
│   ├── selectors.json         # Centralized selector configuration
│   └── README.md              # Selector update guide
├── src/
│   ├── background.ts          # Service Worker (101 lines)
│   ├── utils/
│   │   └── background-utils.ts
│   └── content/
│       ├── index.ts           # Content Script entry point
│       ├── parsers/
│       │   ├── interface.ts   # ChatParser interface
│       │   ├── factory.ts     # ParserFactory
│       │   ├── base-parser.ts # BaseParser abstract class (280 lines)
│       │   ├── config-types.ts # TypeScript types for config
│       │   ├── config-loader.ts # Configuration loader singleton
│       │   ├── chatgpt.ts     # ChatGPTParser (31 lines, extends BaseParser)
│       │   ├── claude.ts      # ClaudeParser (conversation API; does not extend BaseParser)
│       │   └── gemini.ts      # GeminiParser (36 lines, extends BaseParser)
│       ├── scroller.ts        # Scroll utility
│       ├── serializer.ts      # JSONL builder
│       └── converter.ts       # HTML→Markdown with Turndown
├── scripts/
│   └── validate-selectors.js  # CLI selector validation
├── tests/
│   ├── unit/                  # 14 test files
│   └── e2e/                   # E2E tests
├── dist/                      # Compiled output (esbuild)
│   ├── background.js
│   └── content.js
└── node_modules/
```

**Test Stats**: 388 tests passing (includes Mermaid compatibility tests)

## Parser Interface Contract

Every platform parser must implement:

```typescript
interface ChatParser {
  canHandle(hostname: string): boolean;           // Platform identification
  loadAllMessages(): Promise<void>;                // DOM virtualization handling
  getMessageNodes(): HTMLElement[];                // Collect message DOM nodes
  parseNode(node: HTMLElement): ParsedMessage;     // Extract role + content HTML
  isGenerating(): boolean;                         // Check if response in progress
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  contentHtml: string;
  timestamp?: string;
}
```

## Output Schema

JSONL format with metadata line followed by message lines:

```jsonl
{"_meta":true,"platform":"chatgpt","url":"https://chatgpt.com/c/...","exported_at":"2025-11-29T10:00:00Z"}
{"role":"user","content":"Hello","timestamp":"2025-11-29T10:00:05Z"}
{"role":"assistant","content":"Hi there! How can I help?","timestamp":"2025-11-29T10:00:10Z"}
```

### Metadata (First Line)
- `_meta`: Always `true` (identifies this as metadata line)
- `platform`: `"chatgpt"` | `"claude"` | `"gemini"`
- `url`: Full conversation page URL
- `exported_at`: ISO 8601 timestamp when export was performed

### Message Fields (Lines 2+)
- `role`: `"user"` | `"assistant"` (normalized across platforms)
- `content`: Markdown-converted message body
- `timestamp`: ISO 8601 datetime (message time or export time if unavailable)

## Critical Technical Challenges

### 1. DOM Virtualization
**Problem**: ChatGPT unmounts messages outside the viewport in long conversations.
**Solution**: Walk the scroll container upward, snapshot mounted messages at every step (`onStep`), merge by turn identity.

### 2. Unstable Selectors (Solved in Phase 7)
**Problem**: All three platforms use CSS modules with obfuscated class names that change frequently.
**Solution**: Configuration-Driven Architecture
- All selectors externalized to `config/selectors.json`
- Update time reduced from 30-60 minutes to 5-10 minutes
- No TypeScript recompilation needed for selector changes
- Validation via `npm run validate:selectors`

**Selector Strategies by Platform**:
- **ChatGPT**: Attribute strategy (`data-message-author-role`, `data-turn`)
- **Claude**: None - not parsed from the DOM
- **Gemini**: Tag name strategy (`user-query`, `model-response`)

### 3. Claude (Solved by leaving the DOM)
Virtualized rows, a paginated "Load earlier messages" button, thinking/tool steps told apart only by inline styles, artifacts in a separate panel, citations hidden in hover popups: see "Claude Exports From The Conversation API" below. From the API response:
- **Branch**: walk `current_leaf_message_uuid` back through `parent_message_uuid`
- **Body**: `text` blocks; `thinking`, `tool_use`, `tool_result` are skipped, except the two tools the page shows (see "Answers Keep What The Page Shows Outside The Text")
- **Citations**: ` [n]` after each cited span (`end_index`), `[n]: url "title"` definitions under the turn
- **Artifacts**: `[Artifact: title]` inline; the latest artifact is rebuilt by replaying its `create`/`update`/`rewrite` commands into the `_artifact` line
- **Visualizations**: `[Visualization omitted: title]` for `visualize*` tool calls

### 4. Silent Partial Exports
**Problem**: A selector that stops matching a message body exports an empty or truncated message with no error.
**Solution**: Every export is checked against the page and the result carries `warnings` (meta line + notification titled "Exported with warnings"):
- DOM parsers: a message (200+ characters) whose export holds under half of its element's text
- Claude: the page's `aria-setsize` differing from the exported message count

### 5. Gemini Shadow DOM
**Problem**: Gemini may use Web Components with Shadow DOM, making standard `querySelector` fail.
**Solution**: Implement recursive `queryShadowSelector()` utility.

### 6. Generating Responses
**Problem**: Exporting incomplete responses during generation.
**Solution**: Check for "Stop generating" button existence before export, throw error if generating.

### 7. Mermaid Diagram Rendering (Solved)
**Problem**: Browser extensions that render Mermaid diagrams replace `<pre><code class="language-mermaid">` with `<svg>`, losing the original source code.
**Solution**: `converter.ts` removes rendered elements while preserving original source:
```typescript
// In cleanCodeBlockHtml():
doc.querySelectorAll('.mpr-rendered').forEach((el) => el.remove());
doc.querySelectorAll('.mpr-toggle').forEach((el) => el.remove());
doc.querySelectorAll('svg').forEach((el) => el.remove());
```

**Companion Extension**: [Mermaid Preserving Renderer](https://github.com/YongseopKim/llm-chat-mermaid-renderer)
- Renders Mermaid diagrams while keeping original source hidden in DOM
- Structure: `.mpr-container` > `.mpr-source` (hidden original) + `.mpr-rendered` (SVG)
- LLM Chat Exporter extracts from `.mpr-source`, ignores rendered SVG

**Grok Mermaid Handling**: Grok renders Mermaid natively, but provides a "원본 보기" (View Source) button. GrokParser automatically clicks this button during export to convert SVG back to source code.

## Development Phases

### Phase 1: DOM Selector Validation ✅ COMPLETE (2025-11-29)
**Completion Criteria**: Successfully extract 10+ messages from each platform using console scripts.
- ✅ ChatGPT: 12 messages extracted
- ✅ Claude: 11 messages extracted
- ✅ Gemini: 12 messages extracted

### Phase 2: Extension Skeleton ✅ COMPLETE (2025-11-29)
- ✅ Shortcut → Background → Content Script message flow implemented
- ✅ Dummy JSONL download working

### Phase 3: Core Utilities ✅ COMPLETE (2025-11-29)
- ✅ Parser interface definition (ChatParser, ParsedMessage)
- ✅ Simplified scroller (timeout-based fallback)
- ✅ Turndown integration with custom rules
- ✅ JSONL serialization
- ✅ 82 tests passing

### Phase 4: Platform Parsers ✅ COMPLETE (2025-11-29)
- ✅ **ChatGPTParser**: Fallback selector chain (25 tests)
- ✅ **ClaudeParser**: Hybrid selectors + streaming detection (25 tests) + Edge cases (6 tests)
- ✅ **GeminiParser**: Custom element handling (25 tests)
- ✅ **Factory Integration**: 4 tests
- ✅ 162 total tests passing initially

### Phase 5: Integration & Edge Cases ✅ COMPLETE (2025-11-29)
- ✅ End-to-end testing integration ready
- ✅ Error handling (unsupported sites, generating responses, empty conversations)
- ✅ Chrome notifications system integrated
- ✅ Title functionality removed (unreliable DOM selectors across platforms)
- ✅ 156 tests passing
- ⏸️ Long conversation testing (100+ messages) - manual testing by user
- ⏸️ Rich content testing - manual testing by user

## Testing Strategy

**Pre-implementation validation** (Phase 1):
```javascript
// In browser console on ChatGPT/Claude/Gemini
const messages = document.querySelectorAll('[data-message-author-role]');
console.log('Message count:', messages.length);
console.log('First role:', messages[0]?.getAttribute('data-message-author-role'));
console.log('Content:', messages[0]?.querySelector('.markdown')?.textContent);
```

**Integration testing**:
- Test with conversations of varying lengths (short, medium, 100+)
- Test with rich content (code blocks in multiple languages, tables, nested lists)
- Test during response generation (should gracefully error)
- Test on empty conversations

**Current Test Coverage**:
- 388 tests passing across 20 test files
- Unit tests: Background utils (16), Content (6), Parsers (108 including Grok), Converter (33 including Mermaid), Utilities (48), ConfigLoader (16), BaseParser (31)
- E2E tests: Extension flow (6), Integration (2)
- Coverage: Core utilities 100%, Parsers 95%+, Config system 100%, Mermaid handling 100%

## Important Constraints

- **Browser**: Chrome desktop only (Manifest V3)
- **Platforms**: `chatgpt.com`, `claude.ai`, `gemini.google.com`, `grok.com`
- **Scope**: Single conversation per export (no batch/history export)
- **Privacy**: No third-party requests; the only requests go to the chat site itself (Claude's conversation and project APIs, Grok's project file API, same-origin images), with the user's own session, plus the signed storage URL Grok's API returns for a project file, fetched without cookies
- **Images**: Store URLs/placeholders only, no binary download
- **Timestamps**: Claude has real message times; DOM platforms fall back to export time
- **Title**: Not extracted (removed in Phase 5 - unstable selectors across platforms)
- **Mermaid on Grok**: Auto-converts via "원본 보기" button click during export

## Important Design Decisions

### Title Extraction (Removed in Phase 5)
**Decision**: Do not extract conversation titles
**Rationale**:
- Platform-specific title selectors are highly unstable (UI changes frequently)
- Generic `h1` selector produces incorrect results (e.g., Gemini sidebar "최근")
- Best-effort approach still lacks reliability
- Title is non-essential metadata for core export functionality
- Better to have no field than unreliable data

### Notification System (Added in Phase 5)
**Decision**: Use Chrome Notifications API for user feedback
**Implementation**:
- Success: Shows message count and filename
- Error: User-friendly messages + detailed error file download
- Unsupported site: Clear warning about supported platforms
- Empty conversation: Validation prevents empty exports

### Empty Assistant Messages Are Kept (2026-07-19)
**Decision**: Export empty assistant messages as `{"role":"assistant","content":""}` rather than skipping them
**Rationale**:
- An empty assistant turn is a real thing that happened in the conversation (interrupted or failed generation), not a parser failure
- Verified against a real export: Claude's UI itself showed only a status line with no body for that turn, so the empty content is faithful
- The export is a record of the conversation as it exists, so filtering would hide information the user may care about

**Do not "fix" this**: seeing `content: ""` in a JSONL is expected and does not by itself indicate a parsing bug.

### Attachment-Only Messages Export As A Placeholder (2026-09-06)
**Decision**: A message whose body is an attached file exports as `[File: <name>]`. The file's text is not recovered.
**Rationale**:
- Both ChatGPT and Claude turn a pasted prompt that is long enough into an attachment, and neither puts the file's text in the DOM. Measured 2026-09-06: a ChatGPT turn's whole `textContent` was 23 characters (`나의 말:붙여넣은 마크다운(1).md파일 `), with the content behind a download button; Claude's thumbnail held a 306-character preview ending in `pasted`.
- Reading the real text would mean downloading the file or opening a modal, which is outside what DOM parsing can promise.
- Emitting the truncated preview instead would read as the message body and misrepresent the conversation. Naming the attachment is the honest record.
- ChatGPT: the name comes from the file tile's `aria-label`, located through `content.attachment` in `config/selectors.json`. Claude: from the API's `file_name` (`Pasted text` when empty). The Claude API does carry the file's text (`extracted_content`), but it is still not exported, to keep one rule across platforms.

**Do not "fix" this**: seeing `[File: ...]` where a long prompt used to be is the expected, complete output - not a parser failure and not something to keep investigating.

### Claude Exports From The Conversation API (2026-09-24)
**Decision**: `ClaudeParser` reads `GET /api/organizations/<org>/chat_conversations/<id>?tree=True&rendering_mode=messages&render_all_tools=true` instead of parsing the DOM. The org comes from the `lastActiveOrg` cookie, else from `/api/organizations`.
**Rationale**:
- The DOM parser grew to 1,065 lines, 11 of its 20 commits were fixes, and every failure was silent. On 2026-09-24 an app-shell style (`--desktop-top-bar-row-height: 0px`) made the collapsed-block check drop every assistant turn: seven live conversations exported all assistant turns as `""`, and multi-paragraph prompts kept only their first paragraph.
- The API returns the exact branch the page shows, as the Markdown Claude wrote, with message times, title and project - nothing to scroll, wait for, or infer from styles. Verified on those seven conversations: message counts matched the page and every body was complete.
- It is the same request the page makes, to claude.ai, with the user's session: nothing leaves the browser.
- A failed request throws (`Claude: could not load this conversation (HTTP n)`) rather than exporting a partial page. There is no DOM fallback for conversation messages. If the API does not carry artifact source commands, the latest visible Markdown document card is opened and its document panel is exported as `_artifact` with `version: "rendered"` and a metadata warning. This artifact-only fallback never substitutes DOM message parsing for the conversation API.

**Unverified against a live conversation** (no example available on 2026-09-24): the `artifacts` tool input (`id`, `command`, `title`, `content`, `old_str`, `new_str`), the `visualize` tool name and its `title` input, and attachment `file_name` for pasted text. Check these first if an artifact, visualization or attachment exports wrongly.

### ChatGPT and Grok Preserve History and Sources (2026-09-29)

ChatGPT's current conversation scroller uses `flex-direction: column-reverse`: the bottom is `scrollTop = 0`, and older history is at negative positions. Wait for the "Loading earlier messages" status to finish before declaring the beginning reached. A history request that exceeds the timeout fails the export; reaching the scroll-step limit produces a metadata warning.

Both ChatGPT and Grok must snapshot mounted messages at each scroll stop, before virtualization removes them. Merge Grok windows by response ID or `data-plane-row`, never by body text: repeated messages are distinct turns.

Grok's source drawer has one section per agent step, opened one at a time. Steps other than web searches ("명령 실행함", "파일 작성함") have no links: read each section once it renders, whatever it holds. On 2026-10-03 waiting for a link in every section timed out on the first step and dropped all 45 sources. The button's count ("45 sources") is the sum of each section's distinct links; a different collected count produces a metadata warning.

ChatGPT's `+N` citation badge exposes additional URLs only in its hover tooltip. Collect each tooltip page while the original message is mounted, then write readable source links into its detached snapshot. Grok's collapsed source drawer exposes search-result links; append them under "Search sources" without exporting thinking. Retry transient ChatGPT tooltip failures and read the current popup DOM after each page change. Cache only complete citation groups; a failed group gets a bounded retry in a later mounted window, and metadata warnings include only groups still unresolved after the walk. Persistent source UI failures must produce metadata warnings while preserving the visible body and links. Markdown table cells must convert their inner HTML, because `textContent` discards source URLs.

### Typed Prompts Keep Their Text (2026-10-03)

ChatGPT shows a typed prompt unrendered in `.whitespace-pre-wrap`, splitting out only fenced code blocks. Its line breaks and Markdown characters are the prompt: `ChatGPTParser` wraps the body in `data-export-verbatim`, and the converter keeps its text as written and writes each code block back as a fence. Measured on 2026-10-03: a prompt's text held 670 line breaks, the export kept 87, and 26,801 characters after its code block became one escaped line. A rich pasted prompt (`.markdown`) converts as usual.

Grok renders a prompt's Markdown but keeps a paragraph's line breaks with `white-space: pre-wrap` and shows a typed `## Title` line as text. The snapshot marks elements whose live style keeps line breaks (`data-export-line-breaks`, see `line-breaks.ts`), and turns a prompt paragraph starting with `#{1,6} ` back into that heading, so the export reads `## Title`, not `\## Title`.

### Answers Keep What The Page Shows Outside The Text (2026-10-03)

Measured on the 2026-10-03 conversations; each was missing from their exports:
- **Claude AskUserQuestion**: the question and the option the user picked are a turn inside the assistant message. Exported where asked as `[Question: q]`, `- label: description` per option, and `[User answer: a]`. The answer is read from the result text `"<question>"="<answer>"`; if it cannot be picked out, the result text is kept as written.
- **Claude project files**: `Projects` with `method: "project_write"` and `present_to_user: true` shows a file card after the answer. The text is only in the project: `GET /api/organizations/<org>/projects/<project>/docs/<doc_uuid>` (doc_uuid from the tool result). Exported as `[Artifact: <path>]` after the answer's text and an `_artifact` line with `version: "file"`. Writes without `present_to_user` are working files and are not exported.
- **Grok file cards**: `[role=button]` labelled with the file name, holding an icon, name, size and a download button. The icon was inlined as 26 KB of base64 and the labels read as answer text. Replaced with `[Artifact: <name>]`; the file comes from `GET /rest/workspaces/<project>/files?recursive=true` (name to path), `GET /rest/workspaces/<project>/files/content?path=<path>` (`signedUrl`, `size`), then the signed URL without cookies. A download whose byte length differs from `size` is rejected.

Project files are read as stored at export time, so a later overwrite is what gets exported. An unreadable file keeps its marker and adds a metadata warning; the messages are complete without it. `Conversation.artifacts` holds every document, and each becomes one `_artifact` line after the messages.

**Do not "fix" this**: `[Question: ...]`/`[User answer: ...]` inside an assistant message, and several `_artifact` lines, are the expected output.

### ChatGPT Code Blocks Preserve Exact Whitespace (2026-09-29)

Current ChatGPT marks code-block divs with `data-markdown-copy="code-block"`, without a `pre` element. Normalize these wrappers to `pre/code` and discard their copy toolbar before Markdown conversion. Read the original code text when writing fences, preserving indentation, blank lines and literal Markdown. The fence must be longer than any embedded backtick run.

Verify each code block against the original DOM text, including whitespace, through JSONL serialization. Alphanumeric normalization checks cannot detect lost line breaks and must not establish format completeness.

### Deep Research and Surf (2026-10-02)

ChatGPT research runs in a cross-origin app frame that hosts an about:blank report frame. The background worker reads it through `chrome.scripting.executeScript`; the app can read its own child document. Attach the report to the assistant turn identified by its containing `data-turn-key`, preserve it across virtualization windows, and fail explicitly on missing report content. The manifest grants the app's `*.web-sandbox.oaiusercontent.com` origin, without using `<all_urls>`.

Gemini completed research cards open `deep-research-immersive-panel`; the report is outside `model-response`. Read its Markdown body and source links, associate it with the clicked card, and restore the original panel state. Inline KaTeX may store its source in `data-math` without a MathML annotation; preserve that source during conversion.

Claude's API artifact body can be complete while omitting the document's rendered citation URLs. Check the Markdown panel whose card title matches the reconstructed artifact, even when its API content is nonempty. Append missing URLs under "Research sources" while preserving the original API body and version. Do not use another artifact's panel; failed source verification must produce a metadata warning. The original downloaded example and measured comparison are recorded in `docs/research-surf-export-plan.md`.

Claude Docs uses `frame-card-open` and `/code/artifact/<id>`, rather than `artifact-card-open` and `#markdown-artifact`. Its `.ProseMirror[role="textbox"]` body is rendered at runtime inside a sandboxed srcdoc iframe under `<id>.frame.claudeusercontent.com`. Read it through the background worker's `chrome.scripting.executeScript`, matching both the editor's parent origin and its title. The srcdoc attribute itself contains only the editor bootstrap, so parsing that attribute does not recover the document. Missing document content must fail the export. Preserve the original panel state and record the artifact as `version: "rendered"` with the existing metadata warning.

Surf uses `#surf-root .justify-start` for prompts and `[data-markdown-renderer]` for answers. Exclude renderers nested inside a user prompt. File tiles use their full `title` as `[File: name]`; preserve report tables and links while dropping controls.

See `docs/research-surf-export-plan.md` for original observations, verification results, and live-download limitations.

### Configuration-Driven Architecture (Phase 7)
**Decision**: Externalize all DOM selectors to JSON configuration
**Benefits**:
- Selector update time: 30-60 min → 5-10 min (73% reduction)
- Parser code: 763 lines → 105 lines (86% reduction)
- No TypeScript recompilation for selector changes
- Automated validation via `npm run validate:selectors`

**Key Components**:
- `config/selectors.json`: Central selector configuration
- `BaseParser`: Abstract class with shared parsing logic
- `ConfigLoader`: Singleton for configuration access
- Role strategies: attribute (ChatGPT), tagname (Gemini), sibling-button (Grok), combined-selector (Perplexity)

**Updating Selectors**:
1. Edit `config/selectors.json`
2. Run `npm run validate:selectors`
3. Run `npm test`
4. Manual browser test

## Known Risks

1. **DOM Structure Changes**: All three services update frontends frequently
   - Mitigation: Stable selector strategy + modular parser isolation
2. **Server-Side Pagination**: Services might not load full history via scroll
   - Fallback: Warn user or limit to currently loaded messages
3. **Shadow DOM/Canvas Rendering**: DOM parsing becomes impossible
   - No mitigation available (fundamental limitation)

## Additional Documentation

- `README.md`: User-facing project overview and feature documentation
- `DESIGN.md`: Detailed architecture, implementation patterns, risk mitigation strategies
- `PLAN.md`: Phase-by-phase development roadmap with task breakdown
- `config/README.md`: Selector update guide and configuration reference
- `docs/by_*.md`: Design proposals from different AI assistants (reference material)

## User Instructions

When implementing features:
1. **Always test first**: User preference is to reproduce issues with tests before fixing
2. **Validate selectors**: Before implementing parsers, validate all DOM selectors in browser console
3. **Preserve modularity**: Keep platform parsers completely isolated from each other
4. **Minimize dependencies**: Vanilla JavaScript/TypeScript preferred
5. **Stable selectors first**: Always prioritize data attributes and ARIA over class names
