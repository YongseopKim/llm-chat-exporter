# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LLM Chat Exporter** is a Chrome Extension (Manifest V3) that exports conversations from ChatGPT, Claude, and Gemini web UIs to JSONL format using DOM parsing. The project preserves the full context of web UI conversations locally without using APIs.

### Core Value Proposition
- **Context Preservation**: Captures conversations as they appear in the web UI, including service-optimized system prompts
- **Local-First**: All processing happens in the browser, no external server communication
- **Data Ownership**: Users own their conversation data permanently

### Project Status
🚀 Phase 5 Complete - Extension ready for use with 156 passing tests

**Completed Phases**:
- ✅ Phase 0: Architecture & Planning
- ✅ Phase 1: DOM Selector Validation (2025-11-29)
- ✅ Phase 2: Extension Skeleton (2025-11-29)
- ✅ Phase 2.5: Test Environment Setup (2025-11-29)
- ✅ Phase 3: Core Utilities (2025-11-29)
- ✅ Phase 4: Platform Parsers (ChatGPT, Claude, Gemini) (2025-11-29)
- ✅ Phase 4D: Factory Integration (2025-11-29)
- ✅ Phase 5: Integration & Testing (2025-11-29)
- ⏳ Phase 6: Documentation & Deployment (next)

## Development Commands

### Build System

```bash
# Install dependencies
npm install

# Build extension (TypeScript → JavaScript via esbuild)
npm run build

# Run all tests (162 tests)
npm test

# Run tests with coverage
npm run test:coverage

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
  ├─ ClaudeParser (most complex: Artifacts + aggressive DOM virtualization)
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
├── src/
│   ├── background.ts          # Service Worker (101 lines)
│   ├── utils/
│   │   └── background-utils.ts
│   └── content/
│       ├── index.ts           # Content Script entry point (100+ lines)
│       ├── parsers/
│       │   ├── interface.ts   # ChatParser interface (127 lines)
│       │   ├── factory.ts     # ParserFactory (90 lines)
│       │   ├── chatgpt.ts     # ChatGPTParser (240 lines) ✅
│       │   ├── claude.ts      # ClaudeParser (322 lines) ✅
│       │   └── gemini.ts      # GeminiParser (270 lines) ✅
│       ├── scroller.ts        # Simplified fallback scroller (66 lines)
│       ├── serializer.ts      # JSONL builder (56 lines)
│       └── converter.ts       # HTML→Markdown with Turndown (80 lines)
├── tests/
│   ├── unit/                  # 11 test files
│   └── e2e/                   # E2E tests
├── dist/                      # Compiled output (esbuild)
│   ├── background.js
│   └── content.js
└── node_modules/
```

**Test Stats**: 156 tests passing

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

### 2. Unstable Selectors
**Problem**: All three platforms use CSS modules with obfuscated class names that change frequently.
**Strategy**:
- Prioritize `data-*` attributes (e.g., `data-message-author-role`)
- Use ARIA attributes (e.g., `role="article"`, `aria-label`)
- Use structural selectors as last resort
- Implement fallback selector chains

### 3. Claude Artifacts
**Problem**: Code/previews render in separate DOM tree from main chat.
**Approach**: Either include placeholder `[Artifact: {title}]` in content or parse artifact panel separately.

### 4. Gemini Shadow DOM
**Problem**: Gemini may use Web Components with Shadow DOM, making standard `querySelector` fail.
**Solution**: Implement recursive `queryShadowSelector()` utility.

### 5. Generating Responses
**Problem**: Exporting incomplete responses during generation.
**Solution**: Check for "Stop generating" button existence before export, throw error if generating.

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
- ✅ **ChatGPTParser**: Fallback selector chain (28 tests)
- ✅ **ClaudeParser**: Hybrid selectors + streaming detection (28 tests)
- ✅ **GeminiParser**: Custom element handling (28 tests)
- ✅ **Factory Integration**: 4 tests
- ✅ 162 total tests passing

### Phase 5: Integration & Edge Cases ⏳ NEXT
- End-to-end testing across all platforms
- Error handling (unsupported sites, generating responses, empty conversations)
- Long conversation testing (100+ messages)
- Rich content testing (code blocks, tables, LaTeX, images)

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

**Current Test Coverage** (Phase 4D):
- 162 tests passing across 11 test files
- Unit tests: Background utils (16), Content (6), Parsers (84), Utilities (48)
- E2E tests: Extension flow (6), Integration (2)
- Coverage: Core utilities 100%, Parsers 95%+

## Important Constraints

- **Browser**: Chrome desktop only (Manifest V3)
- **Platforms**: Only `chatgpt.com`, `claude.ai`, `gemini.google.com`
- **Scope**: Single conversation per export (no batch/history export)
- **Privacy**: No external network requests, all processing local
- **Images**: Store URLs/placeholders only, no binary download
- **Timestamps**: May fall back to export time if not available in DOM

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
- `docs/by_*.md`: Design proposals from different AI assistants (reference material)

## User Instructions

When implementing features:
1. **Always test first**: User preference is to reproduce issues with tests before fixing
2. **Validate selectors**: Before implementing parsers, validate all DOM selectors in browser console
3. **Preserve modularity**: Keep platform parsers completely isolated from each other
4. **Minimize dependencies**: Vanilla JavaScript/TypeScript preferred
5. **Stable selectors first**: Always prioritize data attributes and ARIA over class names
