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

When the user says "version up" (버전 업), bump the **patch** version by default unless they name minor/major:
1. `npm version patch --no-git-tag-version` (updates `package.json` + `package-lock.json`)
2. Bump the patch number of `"version"` in `manifest.json` (the version Chrome shows)
3. `npm install && npm run build && npm test`
4. Tell the user to reload the extension at `chrome://extensions/`

Note: `manifest.json` (0.x) and `package.json` (1.x) have separate version lines; bump each by one patch. When the user names a version (e.g. 0.2.0), it is the `manifest.json` version; bump `package.json` by the same level (minor → 1.1.0).

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
- **Body**: `text` blocks only; `thinking`, `tool_use`, `tool_result` are skipped
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
- **Privacy**: No third-party requests; the only requests go to the chat site itself (Claude's conversation API, same-origin images), with the user's own session
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
- A failed request throws (`Claude: could not load this conversation (HTTP n)`) rather than exporting a partial page. There is deliberately no DOM fallback - it would bring back the code that failed silently.

**Unverified against a live conversation** (no example available on 2026-09-24): the `artifacts` tool input (`id`, `command`, `title`, `content`, `old_str`, `new_str`), the `visualize` tool name and its `title` input, and attachment `file_name` for pasted text. Check these first if an artifact, visualization or attachment exports wrongly.

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
