# 설계 문서 (DESIGN.md)

## 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [설계 패턴 - Strategy Pattern](#설계-패턴---strategy-pattern)
3. [파일 구조](#파일-구조)
4. [Parser 인터페이스 설계](#parser-인터페이스-설계)
5. [핵심 처리 로직](#핵심-처리-로직)
6. [기술적 리스크 및 대응 전략](#기술적-리스크-및-대응-전략)
7. [도메인별 파서 설계 방향](#도메인별-파서-설계-방향)

---

## 아키텍처 개요

### 전체 구조

Chrome Extension Manifest V3 기반으로 다음 세 가지 핵심 컴포넌트로 구성됩니다:

```
┌─────────────────┐
│  사용자 입력    │ (단축키: Ctrl+Shift+E)
└────────┬────────┘
         │
         v
┌─────────────────────────────────────┐
│   Background Script                 │
│   (Service Worker)                  │
│                                     │
│   - 단축키 이벤트 리스닝            │
│   - 현재 탭 URL 확인                │
│   - 지원 사이트 여부 판단           │
│   - Content Script에 메시지 전송    │
│   - JSONL 다운로드 트리거           │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│   Content Script                    │
│                                     │
│   - 플랫폼 판별 (URL 기반)          │
│   - 해당 Parser 인스턴스 생성       │
│   - 스크롤 로직 실행 (전체 로딩)    │
│   - DOM 파싱 → ParsedMessage[]      │
│   - HTML → Markdown 변환            │
│   - JSONL 직렬화                    │
│   - Background로 결과 반환          │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│   Parser Strategy                   │
│                                     │
│   ├─ ChatGPTParser                  │
│   ├─ ClaudeParser                   │
│   └─ GeminiParser                   │
│                                     │
│   각 파서는 공통 인터페이스 구현    │
└─────────────────────────────────────┘
```

### Manifest V3 설정

```json
{
  "manifest_version": 3,
  "name": "LLM Chat Exporter",
  "version": "0.1.0",
  "description": "ChatGPT, Claude, Gemini 대화를 JSONL로 저장",

  "permissions": [
    "activeTab",
    "scripting",
    "downloads"
  ],

  "host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ],

  "background": {
    "service_worker": "background.js"
  },

  "content_scripts": [{
    "matches": [
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*"
    ],
    "js": ["content/index.js"],
    "run_at": "document_idle"
  }],

  "commands": {
    "export_conversation": {
      "suggested_key": { "default": "Ctrl+Shift+E" },
      "description": "현재 대화를 JSONL로 저장"
    }
  }
}
```

---

## 설계 패턴 - Strategy Pattern

### 왜 Strategy Pattern인가?

ChatGPT, Claude, Gemini는 각각 다른 DOM 구조를 사용하며, UI 업데이트 주기도 다릅니다.
Strategy Pattern을 사용하면:

1. **격리된 변경**: 특정 사이트의 DOM 변경 시 해당 파서만 수정
2. **확장 용이**: 새로운 LLM 서비스 추가 시 새로운 파서만 추가
3. **테스트 용이**: 각 파서를 독립적으로 테스트 가능
4. **코드 재사용**: 공통 로직(스크롤, Markdown 변환, JSONL 직렬화)은 한 곳에만 구현

### 구조

```typescript
// Strategy Interface
interface ChatParser {
  // 플랫폼 식별
  canHandle(hostname: string): boolean;

  // 전체 메시지 로딩 (DOM Virtualization 대응)
  loadAllMessages(): Promise<void>;

  // 메시지 DOM 노드 수집
  getMessageNodes(): HTMLElement[];

  // 개별 노드에서 role과 content HTML 추출
  parseNode(node: HTMLElement): ParsedMessage;

  // 응답 생성 중인지 확인
  isGenerating(): boolean;

  // 대화 제목 추출 (선택)
  getTitle(): string | null;
}

// Parsed Message 타입
interface ParsedMessage {
  role: 'user' | 'assistant';
  contentHtml: string;
  timestamp?: string;
}

// Context (Factory)
class ParserFactory {
  static getParser(url: string): ChatParser | null {
    const hostname = new URL(url).hostname;

    if (ChatGPTParser.canHandle(hostname)) {
      return new ChatGPTParser();
    }
    if (ClaudeParser.canHandle(hostname)) {
      return new ClaudeParser();
    }
    if (GeminiParser.canHandle(hostname)) {
      return new GeminiParser();
    }

    return null;
  }
}
```

---

## 파일 구조

```
llm-chat-exporter/
├── manifest.json              # Extension 설정
├── background.js              # Service Worker (단축키 핸들러)
│
├── content/
│   ├── index.js              # Content Script 진입점
│   │
│   ├── parsers/
│   │   ├── interface.ts      # ChatParser 인터페이스 정의
│   │   ├── factory.ts        # ParserFactory
│   │   ├── chatgpt.ts        # ChatGPTParser 구현
│   │   ├── claude.ts         # ClaudeParser 구현
│   │   └── gemini.ts         # GeminiParser 구현
│   │
│   ├── scroller.ts           # DOM Virtualization 스크롤 로직
│   ├── serializer.ts         # JSONL 직렬화
│   └── converter.ts          # HTML → Markdown 변환 (Turndown wrapper)
│
├── lib/
│   └── turndown.min.js       # Turndown 라이브러리
│
├── utils/
│   ├── dom.ts                # DOM 유틸리티 (Shadow DOM 탐색 등)
│   └── logger.ts             # 디버그 로깅
│
├── README.md
├── DESIGN.md
└── PLAN.md
```

---

## Parser 인터페이스 설계

### 공통 인터페이스

```typescript
// parsers/interface.ts

export interface ChatParser {
  /**
   * 현재 hostname이 이 파서가 처리 가능한지 확인
   */
  canHandle(hostname: string): boolean;

  /**
   * DOM Virtualization 대응: 스크롤하여 전체 메시지 로딩
   * - 맨 위로 스크롤
   * - MutationObserver로 새 노드 감지
   * - 더 이상 로딩되지 않을 때까지 대기
   */
  loadAllMessages(): Promise<void>;

  /**
   * 현재 DOM에서 모든 메시지 노드 수집
   * @returns 시간 순으로 정렬된 메시지 노드 배열
   */
  getMessageNodes(): HTMLElement[];

  /**
   * 개별 메시지 노드에서 데이터 추출
   * @param node - 메시지 DOM 노드
   * @returns { role, contentHtml, timestamp? }
   */
  parseNode(node: HTMLElement): ParsedMessage;

  /**
   * 현재 응답이 생성 중인지 확인
   * (생성 중이면 경고 후 중단하거나 완료 대기)
   */
  isGenerating(): boolean;

  /**
   * 대화 제목 추출 (가능한 경우)
   */
  getTitle(): string | null;
}

export interface ParsedMessage {
  role: 'user' | 'assistant';
  contentHtml: string;
  timestamp?: string;
}
```

### 예시 구현 (ChatGPTParser)

```typescript
// parsers/chatgpt.ts

export class ChatGPTParser implements ChatParser {
  static canHandle(hostname: string): boolean {
    return hostname.includes('chatgpt.com');
  }

  async loadAllMessages(): Promise<void> {
    // 1. 맨 위로 스크롤
    window.scrollTo(0, 0);

    // 2. 안정화될 때까지 대기 (MutationObserver 사용)
    await waitForScrollStabilization();
  }

  getMessageNodes(): HTMLElement[] {
    // data-message-author-role 속성을 가진 요소 수집
    const nodes = Array.from(
      document.querySelectorAll('[data-message-author-role]')
    ) as HTMLElement[];

    return nodes;
  }

  parseNode(node: HTMLElement): ParsedMessage {
    const role = node.getAttribute('data-message-author-role') as 'user' | 'assistant';

    // Markdown/HTML 콘텐츠 영역 찾기
    const contentElement = node.querySelector('.markdown, .prose');
    const contentHtml = contentElement?.innerHTML || '';

    // 타임스탬프 (현재는 저장 시각으로 대체)
    const timestamp = new Date().toISOString();

    return { role, contentHtml, timestamp };
  }

  isGenerating(): boolean {
    // "Stop generating" 버튼 존재 여부로 판단
    return document.querySelector('button[aria-label*="Stop"]') !== null;
  }

  getTitle(): string | null {
    return document.querySelector('h1')?.textContent?.trim() || null;
  }
}
```

---

## 핵심 처리 로직

### 1. 스크롤 로직 (scroller.ts)

DOM Virtualization 대응을 위한 핵심 로직입니다.

```typescript
/**
 * 페이지 상단까지 스크롤하며 모든 메시지를 로딩
 * @param maxRetries - 최대 재시도 횟수 (무한 루프 방지)
 * @param timeout - 전체 작업 타임아웃 (ms)
 */
export async function scrollToLoadAll(
  maxRetries: number = 10,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();
  let previousHeight = document.body.scrollHeight;
  let retryCount = 0;

  // 맨 위로 스크롤
  window.scrollTo(0, 0);

  while (retryCount < maxRetries) {
    // 타임아웃 체크
    if (Date.now() - startTime > timeout) {
      console.warn('Scroll timeout reached');
      break;
    }

    // DOM 변경 대기
    await waitForDOMChanges(500);

    const currentHeight = document.body.scrollHeight;

    // 높이 변화 없으면 완료
    if (currentHeight === previousHeight) {
      retryCount++;
    } else {
      retryCount = 0;
      previousHeight = currentHeight;
    }

    // 조금씩 스크롤 다운 (추가 콘텐츠 트리거)
    window.scrollBy(0, 100);
  }

  // 다시 맨 위로
  window.scrollTo(0, 0);
}

/**
 * MutationObserver를 사용하여 DOM 변경 대기
 */
function waitForDOMChanges(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let timeoutId: number;

    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        observer.disconnect();
        resolve();
      }, ms);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // fallback: 변경 없어도 ms 후 resolve
    timeoutId = window.setTimeout(() => {
      observer.disconnect();
      resolve();
    }, ms);
  });
}
```

### 2. Markdown 변환 (converter.ts)

Turndown 라이브러리를 사용하여 HTML을 Markdown으로 변환합니다.

```typescript
import TurndownService from 'turndown';

// Turndown 인스턴스 설정
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  fence: '```'
});

// 코드 블록 언어 보존
turndownService.addRule('codeBlock', {
  filter: (node) => {
    return node.nodeName === 'CODE' && node.parentNode?.nodeName === 'PRE';
  },
  replacement: (content, node) => {
    const language = node.className.match(/language-(\w+)/)?.[1] || '';
    return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
  }
});

/**
 * HTML을 Markdown으로 변환
 */
export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}
```

### 3. JSONL 직렬화 (serializer.ts)

```typescript
import { htmlToMarkdown } from './converter';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Metadata {
  platform: 'chatgpt' | 'claude' | 'gemini';
  url: string;
  title?: string;
  exported_at: string;
}

/**
 * ParsedMessage 배열을 JSONL 문자열로 변환
 */
export function buildJsonl(
  parsedMessages: ParsedMessage[],
  metadata: Metadata
): string {
  // 메타데이터 라인 (선택)
  const metaLine = JSON.stringify({ _meta: true, ...metadata });

  // 메시지 라인들
  const messageLines = parsedMessages.map((pm) => {
    const message: Message = {
      role: pm.role,
      content: htmlToMarkdown(pm.contentHtml),
      timestamp: pm.timestamp || new Date().toISOString()
    };
    return JSON.stringify(message);
  });

  return [metaLine, ...messageLines].join('\n');
}
```

### 4. 메인 플로우 (content/index.ts)

```typescript
import { ParserFactory } from './parsers/factory';
import { scrollToLoadAll } from './scroller';
import { buildJsonl } from './serializer';

// Background로부터 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXPORT_CONVERSATION') {
    exportConversation()
      .then((jsonl) => sendResponse({ success: true, data: jsonl }))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true; // 비동기 응답
  }
});

async function exportConversation(): Promise<string> {
  // 1. 파서 선택
  const parser = ParserFactory.getParser(window.location.href);
  if (!parser) {
    throw new Error('Unsupported platform');
  }

  // 2. 생성 중 체크
  if (parser.isGenerating()) {
    throw new Error('Response is still generating. Please wait.');
  }

  // 3. 전체 메시지 로딩
  await parser.loadAllMessages();

  // 4. 메시지 노드 수집 및 파싱
  const nodes = parser.getMessageNodes();
  const parsedMessages = nodes.map((node) => parser.parseNode(node));

  // 5. JSONL 생성
  const jsonl = buildJsonl(parsedMessages, {
    platform: getPlatformName(window.location.hostname),
    url: window.location.href,
    title: parser.getTitle() || undefined,
    exported_at: new Date().toISOString()
  });

  return jsonl;
}

function getPlatformName(hostname: string): 'chatgpt' | 'claude' | 'gemini' {
  if (hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  throw new Error('Unknown platform');
}
```

---

## 기술적 리스크 및 대응 전략

### 1. DOM 구조 변경

**리스크**: ChatGPT/Claude/Gemini는 프론트엔드를 자주 업데이트하며, 클래스명/구조가 변경됨

**대응 전략**:

1. **안정적인 셀렉터 우선 사용**
   - `data-*` 속성 (예: `data-message-author-role`)
   - ARIA 속성 (예: `role="log"`, `aria-label`)
   - 구조적 위치 (예: "유저 아바타 아이콘의 가장 가까운 부모 div")

2. **CSS 클래스 의존 최소화**
   - `div.css-1a2b3c` 같은 난독화된 클래스명 사용 금지
   - 의미 있는 클래스명도 보조 수단으로만 사용

3. **Fallback Selector Chain**
   ```typescript
   function findMessageContainer(): HTMLElement | null {
     // 우선순위 1: data 속성
     let el = document.querySelector('[data-message-id]');
     if (el) return el;

     // 우선순위 2: ARIA
     el = document.querySelector('[role="article"]');
     if (el) return el;

     // 우선순위 3: 구조적 위치
     el = document.querySelector('.conversation > div');
     return el;
   }
   ```

### 2. Claude Artifacts 처리

**리스크**: Claude는 코드/문서를 우측 Artifacts 패널에 별도 렌더링. 메인 채팅창 DOM과 분리됨

**대응 전략**:

```typescript
// ClaudeParser.parseNode 내부
parseNode(node: HTMLElement): ParsedMessage {
  let contentHtml = node.querySelector('.message-content')?.innerHTML || '';

  // Artifacts 확인
  const artifactLink = node.querySelector('[data-artifact-id]');
  if (artifactLink) {
    const artifactId = artifactLink.getAttribute('data-artifact-id');
    const artifactPanel = document.querySelector(`#artifact-${artifactId}`);

    if (artifactPanel) {
      // Artifact 내용을 코드 블록으로 추가
      const artifactCode = artifactPanel.textContent || '';
      contentHtml += `\n\n**[Artifact]**\n\`\`\`\n${artifactCode}\n\`\`\``;
    }
  }

  return { role: 'assistant', contentHtml };
}
```

### 3. Shadow DOM

**리스크**: Gemini는 Web Components(Shadow DOM)를 사용할 가능성이 높음. 일반 `querySelector`로 접근 불가

**대응 전략**:

```typescript
// utils/dom.ts

/**
 * Shadow DOM을 재귀적으로 탐색하는 querySelector
 */
export function queryShadowSelector(selector: string, root: Element = document.body): Element | null {
  // 일반 DOM에서 검색
  let result = root.querySelector(selector);
  if (result) return result;

  // Shadow Root가 있는 모든 요소 탐색
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      result = queryShadowSelector(selector, el.shadowRoot as any);
      if (result) return result;
    }
  }

  return null;
}
```

### 4. 스크롤 로직 무한 루프

**리스크**: 네트워크 지연 시 스크롤이 무한히 대기하거나, 브라우저가 멈출 수 있음

**대응 전략** (이미 구현됨):

- `maxRetries`: 최대 10회 재시도 후 중단
- `timeout`: 30초 전체 타임아웃
- `MutationObserver` 기반 안정화 감지

### 5. 생성 중인 답변

**리스크**: 응답이 완성되기 전 저장 시 불완전한 데이터

**대응 전략**:

```typescript
isGenerating(): boolean {
  // "Stop generating" 버튼 존재 여부
  const stopButton = document.querySelector('button[aria-label*="Stop"]');
  return stopButton !== null;
}

// exportConversation에서 체크
if (parser.isGenerating()) {
  // 옵션 1: 에러 던지기
  throw new Error('Response is generating. Please wait until complete.');

  // 옵션 2: 완료 대기 (향후 구현)
  // await waitUntilGenerationComplete(parser);
}
```

---

## 도메인별 파서 설계 방향

### ChatGPTParser

**특징**:
- 비교적 단순한 DOM 구조
- `data-message-author-role` 속성 활용
- `.markdown`, `.prose` 클래스로 콘텐츠 영역 식별

**주요 셀렉터**:
```typescript
// 메시지 컨테이너
document.querySelectorAll('[data-message-author-role]')

// 콘텐츠 영역
node.querySelector('.markdown, .prose')

// 생성 중 확인
document.querySelector('button[aria-label*="Stop"]')
```

### ClaudeParser

**특징**:
- DOM Virtualization이 가장 공격적 (긴 대화 시 상단 메시지 언마운트)
- Artifacts 별도 패널 처리 필요
- 유저/어시스턴트 구분: 클래스명 또는 구조적 위치

**주요 셀렉터** (예상):
```typescript
// 메시지 컨테이너 (구조적 접근)
document.querySelectorAll('.conversation > [role="article"]')

// Role 구분: 아바타 또는 레이블로 판단
const isUser = node.querySelector('[aria-label="User"]') !== null;

// Artifacts
document.querySelector('[data-artifact-id]')
```

### GeminiParser

**특징**:
- Shadow DOM 사용 가능성
- Draft/여러 답변 중 현재 선택된 것만 추출
- Google의 Lit 프레임워크 사용 가능

**주요 셀렉터** (예상):
```typescript
// Shadow DOM 탐색 유틸 사용
queryShadowSelector('[role="presentation"]')

// 현재 선택된 답변만
node.querySelector('.response.active')
```

---

## 다음 단계

설계가 완료되었으므로, 이제 실제 구현 전에 다음을 검증해야 합니다:

1. **DOM 셀렉터 검증** (가장 중요)
   - ChatGPT/Claude/Gemini에서 개발자 도구로 실제 셀렉터 테스트
   - 메시지 노드, 콘텐츠 영역, role 구분 등

2. **Turndown 라이브러리 테스트**
   - 코드 블록, 테이블이 제대로 변환되는지 확인

3. **Manifest 권한 검증**
   - `activeTab`, `downloads` 권한으로 충분한지 확인

이 문서는 구현 중 발견되는 새로운 리스크나 해결책에 따라 지속적으로 업데이트됩니다.
