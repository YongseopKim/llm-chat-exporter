# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LLM Chat Exporter** is a Chrome Extension (Manifest V3) that exports conversations from ChatGPT, Claude, Gemini, and Grok web UIs to JSONL format using DOM parsing. The project preserves the full context of web UI conversations locally without using APIs.

### Core Value Proposition
- **Context Preservation**: Captures conversations as they appear in the web UI, including service-optimized system prompts
- **Local-First**: All processing happens in the browser, no external server communication
- **Data Ownership**: Users own their conversation data permanently

### Project Status
🚀 Phase 7 Complete - Configuration-Driven Architecture with 294 passing tests

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

## Development Commands

### Build System

```bash
# Install dependencies
npm install

# Build extension (TypeScript → JavaScript via esbuild)
npm run build

# Run all tests (209 tests)
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
  ├─ ClaudeParser (most complex: Artifacts + aggressive DOM virtualization + Thinking blocks)
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
│       │   ├── claude.ts      # ClaudeParser (104 lines, extends BaseParser, handles edge cases)
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

**Test Stats**: 294 tests passing (includes Mermaid compatibility tests)

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
**Problem**: Claude aggressively unmounts messages outside viewport in long conversations.
**Solution**: Scroll to top, wait for stabilization using MutationObserver, collect all loaded messages.

### 2. Unstable Selectors (Solved in Phase 7)
**Problem**: All three platforms use CSS modules with obfuscated class names that change frequently.
**Solution**: Configuration-Driven Architecture
- All selectors externalized to `config/selectors.json`
- Update time reduced from 30-60 minutes to 5-10 minutes
- No TypeScript recompilation needed for selector changes
- Validation via `npm run validate:selectors`

**Selector Strategies by Platform**:
- **ChatGPT**: Attribute strategy (`data-message-author-role`, `data-turn`)
- **Claude**: Hybrid strategy (`data-testid` + `data-is-streaming`)
- **Gemini**: Tag name strategy (`user-query`, `model-response`)

### 3. Claude Artifacts
**Problem**: Code/previews render in separate DOM tree from main chat.
**Approach**: Either include placeholder `[Artifact: {title}]` in content or parse artifact panel separately.

### 4. Claude Thinking Blocks & Web Search (Solved)
**Problem**: Assistant messages may contain multiple `.standard-markdown` blocks (thinking, web search, main response). Using `querySelector()` extracts only the first block, missing the actual response.
**Solution**: Override `extractContent()` in ClaudeParser to:
- Find all `.standard-markdown` elements
- Filter out collapsed blocks (`overflow-hidden` with `height: 0px`)
- Concatenate visible content only

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

**Known Issue - Grok**: Grok renders Mermaid natively before Mermaid Preserving Renderer can intercept, resulting in loss of original source code.

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
- 294 tests passing across 15 test files
- Unit tests: Background utils (16), Content (6), Parsers (108 including Grok), Converter (33 including Mermaid), Utilities (48), ConfigLoader (16), BaseParser (31)
- E2E tests: Extension flow (6), Integration (2)
- Coverage: Core utilities 100%, Parsers 95%+, Config system 100%, Mermaid handling 100%

## Important Constraints

- **Browser**: Chrome desktop only (Manifest V3)
- **Platforms**: `chatgpt.com`, `claude.ai`, `gemini.google.com`, `grok.com`
- **Scope**: Single conversation per export (no batch/history export)
- **Privacy**: No external network requests, all processing local
- **Images**: Store URLs/placeholders only, no binary download
- **Timestamps**: May fall back to export time if not available in DOM
- **Title**: Not extracted (removed in Phase 5 - unstable selectors across platforms)
- **Mermaid on Grok**: Original source code lost due to Grok's native rendering

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
- Role strategies: attribute (ChatGPT), hybrid (Claude), tagname (Gemini)

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
