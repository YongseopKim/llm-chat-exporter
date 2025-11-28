## 1. 질문 정리

* README/설계 문서의 “첫 섹션”에 들어갈 수준으로,
  이 프로젝트의 **요구사항 정의서 + 간단한 설계서**를 하나의 아웃풋으로 정리해 달라는 요청.
* 전제 조건:

  * 대상: ChatGPT / Claude / Gemini 웹 UI (데스크톱 크롬)
  * 트리거: 크롬 익스텐션 단축키
  * 저장: 현재 열린 대화 전체를 DOM 파싱 → JSONL 다운로드
  * 스키마: `{"role": "...", "content": "...", "timestamp": "..."}` 형식의 per-message JSONL
  * DOM virtualization 대응, Markdown 변환, 사이트별 파서 인터페이스 분리 등은 이미 방향이 정해져 있음.

---

## 2. 답변 요약

* 프로젝트를 한 줄로 요약하고, 대상/범위를 명시한다.
* 기능 요구사항: 단축키 동작, 지원 사이트, 파싱 대상, JSONL 스키마, DOM virtualization 스크롤 로딩, Markdown 변환 등을 정리한다.
* 비기능 요구사항: 브라우저 제약, 개인용, 유지보수 전략(사이트별 파서/공통 인터페이스) 등을 정의한다.
* 설계 개요: Manifest v3 기반 크롬 익스텐션, background(service worker) + content script + 사이트별 파서(Strategy 패턴) 구조를 설명한다.
* 주요 플로우: 단축키 → 활성 탭 검사 → 파싱 요청 → DOM 전체 스크롤/수집 → JSONL 생성 → 다운로드까지의 단계를 기술한다.

아래 블록을 그대로 README 첫 섹션으로 쓸 수 있도록 정리한다.

---

## 3. 실제 답변 (요구사항 정의서 + 간단한 설계서)

### ## 프로젝트 개요

**프로젝트명(가칭)**: LLM Web Chat Exporter

브라우저(크롬)에서 사용 중인 다음 세 가지 LLM 웹 UI:

* ChatGPT: `https://chatgpt.com/*`
* Claude: `https://claude.ai/*`
* Gemini: `https://gemini.google.com/*`

에 대해, 사용자가 정의한 단축키를 누르면 **현재 열린 단일 대화의 전체 메시지**를 DOM으로부터 파싱해, 다음 형식의 JSON Lines(JSONL) 파일로 다운로드하는 개인용 크롬 익스텐션이다.

이 프로젝트의 목적은 LLM API를 사용하지 않고, 각 서비스가 제공하는 웹 UI 그대로의 대화 흐름을 로컬에 아카이빙하는 것이다.

---

### ## 범위 및 대상

* 브라우저: Google Chrome (데스크톱)
* OS: 데스크톱 환경 (Windows / macOS 등)
* 대상 사이트:

  * ChatGPT: `https://chatgpt.com/*`
  * Claude: `https://claude.ai/*`
  * Gemini: `https://gemini.google.com/*`
* 대상 대화:

  * 현재 탭에서 열려 있는 **단일 대화(conversation)** 전체
  * DOM virtualization(무한 스크롤 등)에 의해 화면 밖의 메시지는, 스크롤을 올려 모든 메시지를 로딩한 후 수집한다.

---

### ## 기능 요구사항

#### ### F1. 단축키 기반 대화 저장

* 사용자는 크롬에서 정의된 단축키(예: `Ctrl+Shift+L`)를 누를 수 있어야 한다.
* 단축키 입력 시:

  1. 현재 활성 탭이 지원되는 도메인(ChatGPT / Claude / Gemini)인지 확인한다.
  2. 지원 도메인이 아니면 아무 동작도 하지 않는다(또는 콘솔 로그 정도만 남긴다).
  3. 지원 도메인이면 해당 탭의 content script에 “대화 추출 요청” 메시지를 보낸다.
  4. content script는 대화 내용을 파싱하여 JSONL 문자열을 생성해 background로 반환한다.
  5. background는 JSONL 내용을 Blob으로 감싼 뒤, `chrome.downloads` API를 사용해 다운로드를 트리거한다.
* 다운로드 시:

  * 파일명 예시:

    * `chatgpt_20251128T235959.jsonl`
    * `claude_20251128T235959.jsonl`
    * `gemini_20251128T235959.jsonl`
  * 사용자는 매번 파일 저장 다이얼로그를 통해 저장 위치를 선택한다(브라우저 기본 다운로드 설정을 그대로 사용).

#### ### F2. 현재 대화 1개만 저장

* 저장 대상은 **현재 브라우저 탭에서 열린 단일 대화**로 제한한다.
* 대화 목록(히스토리 페이지)에서 여러 개를 한 번에 저장하는 기능은 범위에서 제외한다.
* 한 번의 단축키 동작 → 하나의 JSONL 파일이 생성된다.

#### ### F3. DOM Virtualization 대응

* Claude 등 일부 서비스는 긴 대화를 DOM virtualization으로 처리하여, 화면 밖 상단 메시지를 실제 DOM에서 제거했다가 스크롤 시 다시 로딩한다.
* 익스텐션은 “현재 보이는 부분만”이 아니라 “대화 전체”를 저장해야 한다.
* content script는 다음과 같은 전략을 사용한다:

  * 대화 시작부까지 자동으로 스크롤을 올리는 로직을 구현한다.
  * 스크롤 위치를 조금씩 위로 이동시키면서, DOM에 로딩되는 메시지를 모두 수집한다.
  * 스크롤이 더 이상 올라가지 않을 때(대화 최상단에 도달)까지 반복한다.
* 최종적으로, “대화 상단부터 하단까지 모든 메시지”를 시간 순서대로 수집한다.

#### ### F4. 메시지 단위 JSONL 스키마

* 저장 포맷은 JSON Lines 형식이며, **한 메시지당 한 줄**의 JSON 객체를 기록한다.
* 기본 스키마:

```jsonl
{"role": "user", "content": "...", "timestamp": "..."}
{"role": "assistant", "content": "...", "timestamp": "..."}
```

* 필드 정의:

  * `role`: `"user"` 또는 `"assistant"`

    * 사이트별 실제 롤 이름(ChatGPT: user/assistant, Claude: user/assistant, Gemini: user/model 등)을 공통 `"user"` / `"assistant"`로 정규화한다.
    * 시스템 메시지, 도구 호출 등은 기본적으로 제외하지만, 필요 시 향후 `"system"`, `"tool"` 등의 role을 확장할 수 있도록 파서 단계에서 구분 가능하게 설계한다.
  * `content`: 메시지 본문을 Markdown 문자열로 변환한 결과

    * 일반 텍스트, 코드 블록, 테이블, 리스트 등을 Markdown 포맷으로 최대한 정확하게 표현한다.
  * `timestamp`: ISO 8601 문자열

    * 최소한 “저장 시점” 기준의 타임스탬프를 기록한다.
    * 사이트 DOM에서 개별 메시지의 실제 작성/응답 시각을 얻을 수 있으면 그 값을 사용하고, 불가능하면 저장 시각을 공통으로 쓴다.

* 확장 가능(선택) 필드 예:

  * `platform`: `"chatgpt" | "claude" | "gemini"`
  * `url`: 대화 페이지의 URL
  * `message_index`: 0부터 시작하는 메시지 순번

기본 요구사항은 `role`, `content`, `timestamp` 세 필드를 만족하는 것이다.

#### ### F5. 멀티미디어 및 리치 텍스트 처리

* LLM 응답에 포함된 다음 요소는 모두 **Markdown으로 변환**한다:

  * 코드 블록:

    * HTML 구조(`pre > code`)를 Markdown 코드 블록(```lang ... ```)으로 변환
  * 인라인 코드: `<code>` → `...`
  * 테이블: `<table>` → Markdown 테이블 문법
  * 리스트, 헤딩, 굵은/기울임 텍스트 등: 가능한 한 Markdown 표현으로 유지
* 이미지, 파일 첨부 등의 경우:

  * 최소 요구사항: 이미지 alt 텍스트나 캡션 등 텍스트 정보만 있으면 포함한다.
  * 원본 이미지 파일 다운로드, 바이너리 인코딩 등은 범위에서 제외한다.
  * 필요시 향후 `![alt](url)` 형태로 이미지 URL을 표현할 수 있도록 확장 여지를 남긴다.

---

### ## 비기능 요구사항

#### ### N1. 개인용 도구

* 이 익스텐션은 사용자 개인의 브라우저에서만 동작하는 개인용 도구이다.
* 수집된 JSONL 파일은 사용자 로컬 디스크로만 저장되며, 익스텐션은 별도의 서버나 외부 서비스로 데이터를 전송하지 않는다.

#### ### N2. 보안 및 프라이버시

* 수집 대상에는 민감한 정보(실명, 계좌, API 키, 토큰 등)가 포함될 수 있다.
* 익스텐션 자체에서 추가 암호화를 수행하지 않고, OS 수준 디스크 암호화 등은 사용자의 환경에 맡긴다.
* 외부 전송 기능(예: 클라우드 업로드, 외부 API 호출)은 기본 기능에서 제외한다.

#### ### N3. 유지보수 전략

* ChatGPT / Claude / Gemini는 프론트엔드 DOM 구조가 수시로 변경될 수 있다.
* 이를 고려하여:

  * 각 사이트별 파서를 **독립된 모듈**로 분리한다.
  * 공통 파서 인터페이스를 정의하고, 각 사이트별 구현은 이 인터페이스를 따르게 한다.
  * DOM 변경으로 특정 사이트 파서가 깨져도, 다른 사이트 파서는 영향을 최소화한다.
* 유지보수 방식:

  * 사용 중 오류나 파싱 실패가 발생하면, 해당 사이트 파서 모듈만 수정한다.
  * 클래스명/스타일 의존도를 최소화하고, `data-*` 속성, ARIA 속성, 구조적 위치 등 상대적으로 안정적인 DOM 특징을 우선 사용한다.

---

### ## 아키텍처 및 설계 개요

#### ### A1. 전체 구조

크롬 Manifest v3 기반으로, 다음 구성요소로 설계한다.

* `manifest.json`

  * permissions: `"activeTab"`, `"scripting"`, `"downloads"`
  * host_permissions: ChatGPT/Claude/Gemini 도메인
  * background: service worker 스크립트
  * content_scripts: 세 도메인에 공통 content script 주입
  * commands: 단축키(예: `"save_conversation"`)

* Background(Service Worker)

  * 단축키 이벤트 수신
  * 활성 탭 검사 및 도메인 판별
  * content script에 “대화 추출” 메시지 전송
  * JSONL 문자열 수신 후 다운로드 트리거

* Content Script

  * 현재 페이지의 도메인을 기준으로 해당 플랫폼 파서 선택
  * DOM virtualization 대응(스크롤 로딩) 수행
  * 메시지 리스트를 수집하고, 공통 메시지 구조로 통일
  * HTML/리치 텍스트를 Markdown 문자열로 변환
  * JSONL 문자열로 직렬화하여 background에 반환

* Parser 계층

  * 공통 인터페이스(예시):

    ```ts
    interface ChatParser {
      loadAllMessages(): Promise<void>;  // 스크롤 올리기 등
      extractMessages(): ParsedMessage[]; // { role, contentHtml, timestamp? }[]
    }
    ```

  * 구현체:

    * `ChatGPTParser implements ChatParser`
    * `ClaudeParser implements ChatParser`
    * `GeminiParser implements ChatParser`

---

### ## 주요 동작 플로우

1. 사용자가 ChatGPT / Claude / Gemini 대화 페이지를 연다.
2. 사용자가 단축키(예: `Ctrl+Shift+L`)를 누른다.
3. background service worker:

   * 현재 활성 탭 조회
   * URL 호스트 확인 → 지원 사이트인지 검사
   * content script에 `{ type: "EXPORT_CONVERSATION" }` 메시지 전송
4. content script:

   * 현재 도메인 기반으로 적절한 `ChatParser` 인스턴스 선택
   * `parser.loadAllMessages()` 호출 → 페이지 상단까지 자동 스크롤하여 모든 메시지 DOM 로딩
   * `parser.extractMessages()` 호출 → `ParsedMessage[]` 수집
   * 각 `ParsedMessage`의 HTML을 Markdown으로 변환
   * 공통 스키마에 따라 `{"role","content","timestamp"}` 형태의 JSON 객체 리스트를 만든다.
   * JSON Lines 문자열로 직렬화하여 background로 응답한다.
5. background:

   * 응답받은 JSONL 문자열을 Blob으로 감싼 뒤, `chrome.downloads.download` 호출
   * 브라우저가 파일 저장 다이얼로그를 띄우고, 사용자가 저장 위치를 선택한다.

---

### ## 도메인별 파서 설계 방향(요약)

#### ### ChatGPTParser

* 메시지 컨테이너:

  * `data-message-author-role="user" | "assistant"` 등의 속성을 활용해 롤 구분
* 내용 추출:

  * 본문: Markdown/HTML 영역(`.markdown`, `.prose` 등)을 기준으로 텍스트 + HTML 추출
* 특징:

  * 구조가 비교적 단순하지만 UI 업데이트 주기가 빠를 수 있음

#### ### ClaudeParser

* 메시지 컨테이너:

  * 유저/어시스턴트 말풍선을 구분하는 안정적인 클래스나 data-* 속성 탐색
* Artifacts 등 별도 패널:

  * 초기 버전에서는 본문에 직접 포함하기보다는 텍스트 설명(예: `[Artifact: ...]`) 정도로만 다루거나, 우선 제외하는 전략 가능
* DOM virtualization:

  * 긴 대화의 경우 Claude가 상단 메시지를 언마운트할 가능성이 크므로, 스크롤 로직이 특히 중요함

#### ### GeminiParser

* 메시지 컨테이너:

  * 웹 컴포넌트/Shadow DOM 사용 여부를 확인하고, 필요한 경우 shadowRoot 탐색 로직 포함
* Draft/여러 답변:

  * 현재 선택된 답변만 가져오도록 DOM 상태를 파악

---

이 문서는 이 프로젝트의 “요구사항 정의서 + 간단한 설계서” 역할을 한다.
여기까지를 README의 첫 섹션으로 두고, 이후 섹션에서 실제 코드 구조, 빌드/설치 방법, 도메인별 파서 구현 상세 등을 추가로 기술하면 된다.
