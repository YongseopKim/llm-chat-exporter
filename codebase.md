# 코드베이스 분석 결과

## 프로젝트 개요
- **목적**: ChatGPT, Claude, Gemini, Grok 대화를 JSONL로 내보내는 Chrome 확장
- **상태**: Phase 7 완료 (Configuration-Driven Architecture), 303 테스트 통과
- **소스 코드**: 1,991줄 / **테스트 코드**: 4,043줄

## 핵심 아키텍처

```
[Ctrl+Shift+E] → Background Script → Content Script
                                         ↓
                                    ParserFactory
                               ↙    ↙     ↘     ↘
                         ChatGPT  Claude  Gemini  Grok
                               ↘    ↘     ↙     ↙
                              BaseParser (config-driven)
                                         ↓
                              converter → serializer → .jsonl
```

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `base-parser.ts` | 441줄 | 공통 파싱 로직, 설정 기반 역할/콘텐츠 추출 |
| `converter.ts` | 267줄 | HTML→Markdown 변환 (Turndown + 커스텀 규칙) |
| `config/selectors.json` | 102줄 | 4개 플랫폼 DOM 셀렉터 중앙 관리 |
| `claude.ts` | 104줄 | 가장 복잡 - Thinking/검색 블록 필터링 |
| `grok.ts` | 121줄 | Mermaid "원본 보기" 자동 클릭 처리 |

## 프로젝트 구조

```
llm-chat-exporter/
├── manifest.json              # Chrome 확장 설정 (Manifest V3)
├── config/
│   ├── selectors.json         # DOM 셀렉터 중앙 설정
│   └── README.md              # 셀렉터 업데이트 가이드
├── src/
│   ├── background.ts          # Service Worker (154줄)
│   ├── utils/
│   │   └── background-utils.ts # URL 검증, 파일명 생성 (55줄)
│   └── content/
│       ├── index.ts           # Content Script 진입점 (113줄)
│       ├── converter.ts       # HTML→Markdown 변환 (267줄)
│       ├── serializer.ts      # JSONL 빌더 (55줄)
│       ├── scroller.ts        # DOM 가상화 핸들러 (65줄)
│       └── parsers/
│           ├── interface.ts   # ChatParser 인터페이스 (127줄)
│           ├── factory.ts     # 파서 팩토리 (96줄)
│           ├── base-parser.ts # 추상 베이스 클래스 (441줄)
│           ├── config-types.ts # 설정 타입 (144줄)
│           ├── config-loader.ts # 설정 로더 싱글톤 (182줄)
│           ├── chatgpt.ts     # ChatGPT 파서 (31줄)
│           ├── claude.ts      # Claude 파서 (104줄)
│           ├── gemini.ts      # Gemini 파서 (36줄)
│           └── grok.ts        # Grok 파서 (121줄)
├── tests/
│   ├── setup.ts
│   ├── unit/                  # 14개 단위 테스트 파일
│   └── e2e/                   # E2E 테스트
├── dist/                      # 빌드 출력
│   ├── background.js
│   └── content.js
└── samples/                   # DOM 검증 샘플
```

## 플랫폼별 역할 감지 전략

| 플랫폼 | 전략 | 방식 |
|--------|------|------|
| ChatGPT | `attribute` | `data-message-author-role` 속성 읽기 |
| Claude | `hybrid` | `data-testid` + `data-is-streaming` |
| Gemini | `tagname` | `<user-query>`, `<model-response>` |
| Grok | `sibling-button` | Edit/Regenerate 버튼 존재 여부 |

## 핵심 인터페이스

```typescript
interface ChatParser {
  canHandle(hostname: string): boolean;
  loadAllMessages(): Promise<void>;
  getMessageNodes(): HTMLElement[];
  parseNode(node: HTMLElement): ParsedMessage;
  isGenerating(): boolean;
  getTitle(): string | undefined;
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  contentHtml: string;
  timestamp?: string;
}
```

## 출력 스키마 (JSONL)

```jsonl
{"_meta":true,"platform":"chatgpt","url":"https://chatgpt.com/c/...","exported_at":"2025-11-29T10:00:00Z"}
{"role":"user","content":"Hello","timestamp":"2025-11-29T10:00:05Z"}
{"role":"assistant","content":"Hi there!","timestamp":"2025-11-29T10:00:10Z"}
```

## 테스트 현황

- **303 테스트** / 15개 파일 / 6.24초
- 코어 유틸 100%, 파서 95%+ 커버리지

| 테스트 파일 | 테스트 수 | 줄 수 |
|------------|----------|-------|
| `converter.test.ts` | 100+ | 622 |
| `base-parser.test.ts` | 47 | 641 |
| `grok.test.ts` | 33 | 436 |
| `claude.test.ts` | 27 | 355 |
| `chatgpt.test.ts` | 28 | 332 |
| `gemini.test.ts` | 27 | 321 |
| `claude-edge.test.ts` | - | 186 |
| `serializer.test.ts` | - | 190 |
| `background-utils.test.ts` | 16 | 205 |
| `config-loader.test.ts` | 16 | 140 |
| `factory.test.ts` | 4 | 114 |
| `scroller.test.ts` | - | 108 |
| `content.test.ts` | 6 | 89 |

## 기술적 해결 과제

### 1. DOM 가상화 (Claude)
- **문제**: Claude가 뷰포트 밖의 메시지를 적극적으로 언마운트
- **해결**: 스크롤 후 안정화 대기 + 접힌 블록 필터링

### 2. 불안정한 셀렉터
- **문제**: CSS 모듈로 난독화된 클래스명이 자주 변경
- **해결**: JSON 설정 외부화 (업데이트 시간 73% 단축)

### 3. Claude Thinking 블록
- **문제**: 여러 `.standard-markdown` 블록 중 첫 번째만 추출됨
- **해결**: `extractContent()` 오버라이드로 접힌 블록 필터 후 가시 콘텐츠 합산

### 4. Mermaid 다이어그램
- **문제**: 브라우저 확장이 Mermaid를 SVG로 렌더링하면 원본 소스 손실
- **해결**: SVG 제거 + 원본 소스 보존, Grok은 "원본 보기" 자동 클릭

### 5. Grok Shiki 코드 블록
- **문제**: Shiki가 각 줄을 `<span class="line">`으로 감싸 줄바꿈 손실
- **해결**: `cleanCodeBlockHtml()`에서 줄바꿈 복원 처리

## 의존성

### 런타임
- `turndown` (^7.2.2): HTML→Markdown 변환

### 개발
- TypeScript (^5.9.3), esbuild (^0.27.0), Vitest (^2.0.0)
- jsdom (^25.0.0), puppeteer (^23.0.0)

## 개발 명령어

```bash
npm install              # 의존성 설치
npm run build           # 빌드 (TypeScript → JavaScript)
npm test                # 전체 테스트 실행
npm run validate:selectors  # 셀렉터 설정 검증
npm run watch           # 감시 모드 빌드
npm run test:watch     # 감시 모드 테스트
npm run test:coverage  # 커버리지 리포트
```

## 디자인 패턴

- **Strategy Pattern**: 플랫폼별 파서가 공통 `ChatParser` 인터페이스 구현
- **Factory Pattern**: `ParserFactory`가 URL 기반으로 파서 선택
- **Singleton Pattern**: `ConfigLoader`가 설정 1회 로드 후 캐싱
- **Template Method Pattern**: `BaseParser`가 파싱 파이프라인 정의, 구체 파서가 오버라이드
- **Adapter Pattern**: Turndown 라이브러리를 `htmlToMarkdown()`으로 래핑
