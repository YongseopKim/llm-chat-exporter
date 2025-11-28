## 1\. 질문 정리 (Context Refinement)

**사용자의 의도:**
금룡섭 님은 ChatGPT, Claude, Gemini의 웹 UI 경험(Context)을 그대로 보존한 채, 대화 내용을 단일 진입점(Chrome Extension)을 통해 로컬 데이터(JSONL)로 소유하고자 합니다.

**명세 충돌 조정:**
초기 질문에서는 "질문과 대답을 포함한 JSON"을 원했으나, 추가 답변에서 제시한 스키마는 `role` 기반의 시계열 로그(`{"role": "user", ...}`) 형태입니다. **최신 데이터인 추가 답변의 스키마를 기준으로 설계서를 작성**하되, 파싱 로직 내부에서는 Q\&A 맥락을 유지할 수 있도록 순서를 보장하는 설계를 채택합니다.

-----

## 2\. 답변 요약 (Executive Summary)

요청하신 \*\*[요구사항 정의서 + 설계 문서]\*\*의 초안입니다. 모든 비즈니스 로직은 클라이언트(브라우저) 사이드에서만 실행되는 'Local-First' 구조이며, 유지보수성을 극대화하기 위해 **Strategy Pattern**을 핵심 아키텍처로 채택했습니다. 이 문서는 바로 GitHub README.md나 내부 위키의 최상단에 위치시킬 수 있도록 작성되었습니다.

-----

## 3\. 실제 답변 자세히 서술 (Deep Dive & Analysis)

아래 내용은 프로젝트의 `README.md` 혹은 `DESIGN.md`에 그대로 사용할 수 있는 **설계 명세서**입니다.

-----

# 📜 LLM Chat Exporter: Design & Requirements

## 1\. Project Overview

**LLM Chat Exporter**는 ChatGPT, Claude, Gemini 웹 인터페이스의 대화 내용을 사용자의 로컬 환경으로 추출(Archiving)하는 Chrome Extension이다. API를 사용하지 않고 DOM을 직접 파싱하여, 각 서비스 고유의 System Prompt 및 Context가 반영된 실제 대화 경험을 보존하는 것을 목표로 한다.

## 2\. Requirements Definition

### 2.1. Functional Requirements (FR)

1.  **Supported Platforms:**
      * ChatGPT (`https://chatgpt.com/*`)
      * Claude (`https://claude.ai/*`)
      * Gemini (`https://gemini.google.com/*`)
2.  **Trigger Action:**
      * 특정 단축키(e.g., `Cmd+Shift+E`) 입력 시 현재 활성화된 탭이 지원 대상인지 판별 후 추출 프로세스 시작.
3.  **DOM Virtualization Handling (Critical):**
      * 긴 대화의 경우 상단 스크롤 이동을 통해 Unmount 된 DOM 요소를 강제로 로딩(Mount)시킨 후 파싱해야 한다.
4.  **Content Formatting:**
      * Text: 원문 유지.
      * **Rich Media (Code, Table, Image):** Markdown 포맷으로 변환하여 저장.
5.  **Output Format:**
      * Trigger 1회당 1개의 `.jsonl` 파일 다운로드.
      * 브라우저의 기본 다운로드 다이얼로그(`Save As`)를 호출.
6.  **Scope:**
      * 현재 열려 있는(Active) 대화 세션 1개만 저장.

### 2.2. Non-Functional Requirements (NFR)

1.  **Environment:** Desktop Chrome Browser Only.
2.  **Privacy:** 모든 처리는 로컬 브라우저 내에서 완결되며, 외부 서버로 데이터를 전송하지 않는다.
3.  **Maintainability:** DOM 구조 변경에 대응하기 위해 파서 로직은 사이트별로 모듈화되어야 한다.

-----

## 3\. Data Specification

### 3.1. Output Schema (JSONL)

각 라인은 하나의 메시지 객체(Message Object)를 나타낸다.

```jsonl
{"role": "user", "content": "RWA 토큰화의 기술적 난관은?", "timestamp": "2025-11-28T10:00:00Z"}
{"role": "assistant", "content": "RWA의 핵심 난관은 법적 규제와 온체인 데이터 동기화입니다...", "timestamp": "2025-11-28T10:00:05Z"}
```

  * **role**: `"user"` | `"assistant"` (System 메시지는 제외하거나 필요시 `"system"`으로 정의)
  * **content**: Markdown으로 변환된 텍스트 데이터.
  * **timestamp**: 추출 시점의 타임스탬프 (ISO 8601).

-----

## 4\. System Architecture

### 4.1. High-Level Design (Manifest V3)

  * **Background Service Worker:** 단축키 이벤트를 리스닝하고, 현재 탭의 URL을 라우팅하여 적절한 Strategy를 주입한다.
  * **Content Script:** 실제 DOM에 접근하여 데이터를 추출한다.
  * **Turndown Service:** HTML to Markdown 변환을 담당하는 라이브러리.

### 4.2. Design Pattern: Strategy Pattern

DOM 구조 변경에 유연하게 대응하기 위해, 파싱 로직을 공통 인터페이스(`IChatParser`) 아래 캡슐화한다.

```typescript
// Interface
interface IChatParser {
  // 스크롤을 올려 히스토리를 로딩하는 로직
  loadFullHistory(): Promise<void>;
  // DOM에서 메시지 객체 배열 추출
  parseMessages(): Promise<Array<Message>>;
}

// Concrete Strategies
class ChatGPTParser implements IChatParser { ... }
class ClaudeParser implements IChatParser { ... }
class GeminiParser implements IChatParser { ... }

// Context (ParserFactory)
class ParserFactory {
  static getParser(url: string): IChatParser {
    if (url.includes('claude.ai')) return new ClaudeParser();
    // ...
  }
}
```

-----

## 5\. Implementation Details

### 5.1. DOM Virtualization & Auto-Scroll Logic

Claude와 같이 긴 대화에서 DOM을 비우는(Virtualization) 사이트를 위한 알고리즘.

1.  `window.scrollTo(0, 0)` 실행.
2.  `MutationObserver`를 사용하여 DOM 트리에 새로운 자식 노드(메시지)가 추가되는지 감지.
3.  스크롤 높이(`document.body.scrollHeight`)가 변경되지 않고 안정화될 때까지 대기.
4.  다시 맨 아래로 스크롤하여 최신 메시지까지 로딩 확인 후 파싱 시작.

### 5.2. Markdown Conversion

단순 `innerText` 사용 시 Code Block과 Table이 깨짐.

  * `Turndown` 라이브러리를 사용하여 HTML → Markdown 변환.
  * **Code Block:** `<pre><code>` 태그를 감지하여 \`\`\`language 형식으로 변환.
  * **Images:** `![alt text](image_url)` 형식으로 변환하되, 이미지가 만료되는 링크일 경우에 대한 처리는 추후 고려(현재는 링크 텍스트만 보존).

-----

## 6\. Maintenance & Risk Management

### 6.1. Selector Resilience

  * **Anti-Pattern:** `div.css-1a2b3c`와 같은 난독화된 클래스명 의존 금지.
  * **Best Practice:**
      * `data-testid` 속성 우선 사용.
      * ARIA 속성(`role="log"`, `aria-label="Chat history"`) 활용.
      * 상대적 위치 기반 탐색 (e.g., 유저 아바타 아이콘 SVG의 `closest('div')`).

### 6.2. Update Cycle

  * 서비스 UI 변경으로 파싱 실패 시, 해당 `Concrete Strategy` 클래스만 수정하여 배포한다. (전체 로직 수정 불필요)

-----

### **Critical Feedback (성장 포인트)**

금룡섭 님, 설계상 놓치기 쉬운 \*\*기술적 리스크(Blind Spot)\*\*를 짚어드립니다.

1.  **스크롤 로직의 '무한 루프' 위험:**

      * 네트워크 상태가 좋지 않아 이전 대화 로딩이 지연될 때, 스크롤 로직이 무한히 대기하거나 계속 위로 튕기는 버그가 발생하기 쉽습니다. 반드시 \*\*`Max Retry Count` (예: 5회 시도 후 중단)나 `Timeout`\*\*을 걸어두어 브라우저가 멈추는 것을 방지해야 합니다.

2.  **Claude의 'Artifacts' 처리:**

      * Claude는 코드나 긴 문서를 우측 별도 패널(Artifacts)에 띄웁니다. 이는 메인 채팅창 DOM과 분리되어 있을 수 있습니다. 단순 채팅창 파싱 시 **핵심 코드가 누락될 가능성**이 높습니다. `ClaudeParser` 구현 시 Artifacts 패널의 DOM 존재 여부를 반드시 체크해야 합니다.

3.  **Shadow DOM:**

      * Gemini는 Google의 Lit 라이브러리 등을 사용하여 Web Component(Shadow DOM)를 적극적으로 쓸 가능성이 있습니다. 일반적인 `querySelector`로는 접근이 안 될 수 있으므로, `shadowRoot`를 뚫고 들어가는 유틸리티 함수(`queryShadowSelectors`)를 미리 준비하는 것이 좋습니다.

### **Next Step**

이제 설계 문서는 나왔습니다. 가장 먼저 부딪힐 난관인 \*\*"각 사이트별 DOM 선택자(Selector) 따기"\*\*를 먼저 검증해야 합니다.

"지금 크롬 개발자 도구 콘솔을 켜고, ChatGPT의 대화 텍스트 하나를 정확히 집어내는 `document.querySelector` 명령어를 테스트해 보시겠습니까? 성공하면 바로 코드로 옮기면 됩니다."
