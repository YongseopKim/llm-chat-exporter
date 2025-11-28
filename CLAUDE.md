# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LLM Chat Exporter** is a Chrome Extension (Manifest V3) that exports conversations from ChatGPT, Claude, and Gemini web UIs to JSONL format using DOM parsing. The project preserves the full context of web UI conversations locally without using APIs.

### Core Value Proposition
- **Context Preservation**: Captures conversations as they appear in the web UI, including service-optimized system prompts
- **Local-First**: All processing happens in the browser, no external server communication
- **Data Ownership**: Users own their conversation data permanently

### Project Status
🚧 Currently in the design phase - no implementation yet. Architecture and planning are complete.

## Development Commands

This project has no build system yet. When implementation begins:

```bash
# Load extension in Chrome (during development)
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked extension"
# 4. Select the project directory

# No build/lint/test commands exist yet
```

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

### File Structure (Planned)
```
llm-chat-exporter/
├── manifest.json              # Extension config (Manifest V3)
├── background.js              # Service Worker (shortcut handler)
├── content/
│   ├── index.js              # Content Script entry point
│   ├── parsers/
│   │   ├── interface.ts      # ChatParser interface definition
│   │   ├── factory.ts        # ParserFactory
│   │   ├── chatgpt.ts        # ChatGPTParser
│   │   ├── claude.ts         # ClaudeParser (highest complexity)
│   │   └── gemini.ts         # GeminiParser
│   ├── scroller.ts           # DOM Virtualization scroll logic
│   ├── serializer.ts         # JSONL serialization
│   └── converter.ts          # HTML → Markdown (Turndown wrapper)
├── lib/
│   └── turndown.min.js       # Turndown library
└── utils/
    ├── dom.ts                # DOM utilities (Shadow DOM traversal)
    └── logger.ts             # Debug logging
```

## Parser Interface Contract

Every platform parser must implement:

```typescript
interface ChatParser {
  canHandle(hostname: string): boolean;           // Platform identification
  loadAllMessages(): Promise<void>;                // DOM virtualization handling
  getMessageNodes(): HTMLElement[];                // Collect message DOM nodes
  parseNode(node: HTMLElement): ParsedMessage;     // Extract role + content HTML
  isGenerating(): boolean;                         // Check if response in progress
  getTitle(): string | null;                       // Extract conversation title
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  contentHtml: string;
  timestamp?: string;
}
```

## Output Schema

JSONL format with one message per line:

```jsonl
{"role": "user", "content": "...", "timestamp": "2025-11-28T10:00:00Z"}
{"role": "assistant", "content": "...", "timestamp": "2025-11-28T10:00:05Z"}
```

### Fields
- `role`: `"user"` | `"assistant"` (normalized across platforms)
- `content`: Markdown-converted message body
- `timestamp`: ISO 8601 datetime

### Optional Metadata (future extension)
- `platform`: `"chatgpt"` | `"claude"` | `"gemini"`
- `url`: Conversation page URL
- `title`: Conversation title (if parsable)
- `message_index`: Sequential message number

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

### Phase 1: DOM Selector Validation (HIGHEST PRIORITY)
**Completion Criteria**: Successfully extract 10+ messages from each platform using console scripts.

Validate on each platform:
1. Message container selectors
2. Role differentiation mechanism
3. Content area extraction
4. Generation state detection

### Phase 2: Extension Skeleton
Implement shortcut → Background → Content Script message flow with dummy text download.

### Phase 3: Core Utilities
- Parser interface definition
- Scroll loading logic with MutationObserver
- Turndown integration for Markdown conversion
- JSONL serialization
- Shadow DOM traversal utility

### Phase 4: Platform Parsers
- **ChatGPTParser**: Simplest structure (start here)
- **ClaudeParser**: Most complex (Artifacts + aggressive virtualization)
- **GeminiParser**: Shadow DOM handling

### Phase 5: Integration & Edge Cases
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
