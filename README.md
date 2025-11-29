# LLM Chat Exporter

A Chrome Extension that exports conversations from ChatGPT, Claude, and Gemini web UIs to JSONL format with a single keyboard shortcut.

## Introduction

**LLM Chat Exporter** extracts conversations from LLM web interfaces using DOM parsing—no API keys required. It preserves conversations exactly as they appear in the web UI, including service-optimized system prompts and rich formatting.

### Core Values

- **Context Preservation**: Captures the complete web UI experience, not just raw API responses
- **Local-First**: All processing happens in-browser with zero external network requests
- **Data Ownership**: Your conversations stay on your machine permanently

### Use Cases

- Build a local knowledge base from your LLM conversations
- Backup important conversations for archival
- Create training data for RAG (Retrieval-Augmented Generation) pipelines
- Analyze conversation patterns and learning materials

## Features

### Supported Platforms

| Platform | URL Pattern |
|----------|-------------|
| ChatGPT | `https://chatgpt.com/*` |
| Claude | `https://claude.ai/*` |
| Gemini | `https://gemini.google.com/*` |

### Key Features

- **Keyboard Shortcut**: `Ctrl+Shift+E` (Windows/Linux) or `Cmd+Shift+E` (Mac)
- **DOM Virtualization Handling**: Scrolls to load all messages before export
- **Markdown Conversion**: Code blocks, tables, lists preserved accurately
- **Timestamp Preservation**: Message timestamps when available in DOM
- **Configuration-Driven**: DOM selectors externalized for easy updates

## Installation

### From Source (Developer Mode)

```bash
# Clone the repository
git clone https://github.com/YongseopKim/llm-chat-exporter.git
cd llm-chat-exporter

# Install dependencies
npm install

# Build the extension
npm run build
```

Then load in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `llm-chat-exporter` folder

## Usage

1. Open a conversation on ChatGPT, Claude, or Gemini
2. Press `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac)
3. The extension scrolls to load all messages, then downloads a JSONL file
4. File is saved as `{platform}_{timestamp}.jsonl`

### Notifications

- **Success**: Shows message count and filename
- **Error**: Displays user-friendly message with detailed error file
- **Unsupported Site**: Warning when used on non-supported platforms

## Output Format

### JSONL Schema

First line contains metadata, subsequent lines contain individual messages:

```jsonl
{"_meta":true,"platform":"chatgpt","url":"https://chatgpt.com/c/...","exported_at":"2025-11-29T10:00:00Z"}
{"role":"user","content":"What is RWA tokenization?","timestamp":"2025-11-29T10:00:05Z"}
{"role":"assistant","content":"RWA (Real World Asset) tokenization involves...","timestamp":"2025-11-29T10:00:10Z"}
```

### Metadata Fields (Line 1)

| Field | Type | Description |
|-------|------|-------------|
| `_meta` | `true` | Metadata line identifier |
| `platform` | `"chatgpt"` \| `"claude"` \| `"gemini"` | Platform identifier |
| `url` | string | Full conversation URL |
| `exported_at` | ISO 8601 | Export timestamp |

### Message Fields (Lines 2+)

| Field | Type | Description |
|-------|------|-------------|
| `role` | `"user"` \| `"assistant"` | Normalized sender role |
| `content` | string | Markdown-converted message body |
| `timestamp` | ISO 8601 | Message time (or export time if unavailable) |

## Development

### Commands

```bash
npm install          # Install dependencies
npm run build        # Build extension (TypeScript → JavaScript)
npm run watch        # Build in watch mode
npm test             # Run all tests (203 tests)
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
npm run validate:selectors # Validate selector configuration
```

### Project Structure

```
llm-chat-exporter/
├── manifest.json              # Chrome Extension Manifest V3
├── config/
│   ├── selectors.json         # Centralized DOM selectors
│   └── README.md              # Selector update guide
├── src/
│   ├── background.ts          # Service Worker
│   ├── utils/
│   │   └── background-utils.ts
│   └── content/
│       ├── index.ts           # Content script entry
│       ├── converter.ts       # HTML → Markdown (Turndown)
│       ├── serializer.ts      # JSONL builder
│       ├── scroller.ts        # Scroll utility
│       └── parsers/
│           ├── interface.ts   # ChatParser interface
│           ├── factory.ts     # ParserFactory
│           ├── base-parser.ts # BaseParser (shared logic)
│           ├── config-loader.ts # Configuration singleton
│           ├── chatgpt.ts     # ChatGPTParser
│           ├── claude.ts      # ClaudeParser
│           └── gemini.ts      # GeminiParser
├── tests/
│   ├── unit/                  # Unit tests (12 files)
│   └── e2e/                   # E2E tests (2 files)
├── samples/                   # Sample HTML for testing
└── dist/                      # Build output
```

### Architecture

**Design Patterns**:
- **Strategy Pattern**: Platform-specific parsers implement `ChatParser` interface
- **Factory Pattern**: `ParserFactory` selects parser based on URL hostname
- **Configuration-Driven**: All DOM selectors in `config/selectors.json`

**Selector Strategies by Platform**:
- **ChatGPT**: Attribute-based (`data-message-author-role`, `data-turn`)
- **Claude**: Hybrid (`data-testid` + `data-is-streaming`)
- **Gemini**: Tag name-based (`user-query`, `model-response`)

### Testing

- **Framework**: Vitest with jsdom environment
- **Total Tests**: 203 tests passing
- **Coverage**: Core utilities 100%, Parsers 95%+

Test structure:
- `unit/background-utils.test.ts` - Background script utilities
- `unit/parsers/*.test.ts` - Platform-specific parser tests
- `unit/config-loader.test.ts` - Configuration system tests
- `unit/base-parser.test.ts` - Base parser logic tests
- `e2e/export-flow.test.ts` - End-to-end export tests

### Updating Selectors

When platform UIs change, update selectors without recompiling:

1. Edit `config/selectors.json`
2. Run `npm run validate:selectors`
3. Run `npm test`
4. Test manually in browser

See `config/README.md` for detailed selector update guide.

## Tech Stack

- **Chrome Extension Manifest V3**
- **TypeScript 5.9** + **esbuild**
- **Turndown** for HTML → Markdown
- **Vitest** for unit testing
- **Puppeteer** for E2E testing

## Known Limitations

- DOM structure changes may require selector updates
- Images are stored as URLs only (no binary download)
- Claude Artifacts have limited support
- Single conversation export only (no batch/history export)

## Contributing

Issues and improvement suggestions are welcome. Please report issues at the GitHub repository.

## License

MIT License

Copyright (c) 2025

This project is for personal use. Please comply with the terms of service of ChatGPT, Claude, and Gemini.

---

# 한국어 안내

## 프로젝트 소개

**LLM Chat Exporter**는 ChatGPT, Claude, Gemini 웹 인터페이스의 대화를 API 없이 DOM 파싱으로 추출하여 JSONL 파일로 저장하는 Chrome 확장 프로그램입니다.

### 핵심 가치

- **컨텍스트 보존**: 웹 UI 그대로의 대화 경험 보존
- **로컬 우선**: 모든 처리가 브라우저 내에서 완결
- **데이터 소유권**: 대화 내용을 로컬에 영구 보존

## 사용 방법

1. ChatGPT, Claude, 또는 Gemini에서 대화 페이지 열기
2. `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`) 누르기
3. JSONL 파일 자동 다운로드

## 사용 사례

- LLM 대화를 로컬 지식 베이스로 구축
- 중요한 대화 백업 및 아카이빙
- RAG 파이프라인 입력 데이터로 활용
- 대화 기록 분석 및 학습 자료 활용

## 개발 환경 구축

```bash
git clone https://github.com/YongseopKim/llm-chat-exporter.git
cd llm-chat-exporter
npm install
npm run build
npm test  # 203개 테스트 실행
```

---

**Made with care for preserving valuable AI conversations**
