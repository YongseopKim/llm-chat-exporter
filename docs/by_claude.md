## 요구사항 정의서

### 프로젝트 개요

**명칭**: LLM Chat Exporter

**목적**: ChatGPT, Claude, Gemini 웹 UI의 대화 내용을 단축키로 JSONL 파일로 저장

**핵심 동기**: 각 서비스가 최적화한 시스템 프롬프트와 웹 UI 경험을 그대로 보존한 채 대화 데이터를 로컬 자산화

---

### 기능 요구사항

**지원 범위**
- 브라우저: Chrome (데스크톱만)
- 대상 사이트:
  - `https://chatgpt.com/*`
  - `https://claude.ai/*`
  - `https://gemini.google.com/*`

**트리거**
- 단축키 입력 시 현재 열린 대화 1개를 파싱하여 JSONL 파일 다운로드
- 다운로드 다이얼로그 표시 (로컬 저장)

**데이터 처리**
- DOM Virtualization 대응: 스크롤을 강제로 올려 전체 대화 로딩 후 파싱
- 멀티미디어: Markdown 포맷으로 변환 (코드 블록, 테이블 포함)
- 이미지: Markdown 이미지 문법 또는 placeholder 텍스트

**JSONL 스키마**
```jsonl
{"role": "user", "content": "...", "timestamp": "..."}
{"role": "assistant", "content": "...", "timestamp": "..."}
```

**메타데이터** (파일 상단 또는 별도 라인)
- platform: chatgpt | claude | gemini
- url: 대화 URL
- exported_at: 저장 시점 (ISO 8601)
- title: 대화 제목 (파싱 가능 시)

---

### 비기능 요구사항

**유지보수성**
- 공통 Parser 인터페이스 정의
- 사이트별 파서 모듈 완전 분리
- DOM 변경 시 해당 파서만 수정

**에러 처리**
- 지원하지 않는 사이트: 무시 또는 알림
- 생성 중인 답변: 경고 표시 후 중단 또는 완료 대기
- 빈 대화: 빈 파일 생성 또는 알림

---

## 설계서

### 아키텍처 개요

```
[단축키 입력]
     ↓
[Background Script]
  - 현재 탭 URL 확인
  - 지원 사이트 여부 판단
  - Content Script에 메시지 전송
     ↓
[Content Script]
  - 플랫폼 판별
  - 해당 Parser 호출
  - 스크롤 → DOM 파싱 → Markdown 변환
  - JSONL 문자열 생성 → Background로 반환
     ↓
[Background Script]
  - chrome.downloads API로 파일 다운로드
```

### 파일 구조

```
llm-chat-exporter/
├── manifest.json
├── background.js
├── content/
│   ├── index.js          # 진입점, 메시지 핸들러
│   ├── parsers/
│   │   ├── interface.js  # 공통 인터페이스 정의
│   │   ├── chatgpt.js
│   │   ├── claude.js
│   │   └── gemini.js
│   ├── scroller.js       # DOM Virtualization 대응
│   └── serializer.js     # JSONL 변환
└── utils/
    └── turndown.js       # HTML → Markdown 변환
```

### Parser 인터페이스

```javascript
// parsers/interface.js
class ChatParser {
  // 플랫폼 식별
  static canHandle(hostname) { throw new Error('Not implemented'); }

  // 메시지 노드 목록 반환
  getMessageNodes() { throw new Error('Not implemented'); }

  // 개별 노드에서 role과 HTML content 추출
  parseNode(node) {
    // returns { role: 'user' | 'assistant', html: string }
    throw new Error('Not implemented');
  }

  // 응답 생성 중인지 확인
  isGenerating() { throw new Error('Not implemented'); }

  // 대화 제목 추출
  getTitle() { return null; }
}
```

### 핵심 로직 흐름

**1. 스크롤 처리 (scroller.js)**
```javascript
async function scrollToLoadAll() {
  // 1. 맨 위로 스크롤
  // 2. 일정 간격으로 아래로 스크롤하며 새 노드 로딩 대기
  // 3. 더 이상 새 노드가 없으면 종료
  // 4. timeout 설정 (무한 대기 방지)
}
```

**2. 파싱 및 변환**
```javascript
async function exportConversation() {
  const parser = getParserForCurrentSite();

  if (parser.isGenerating()) {
    return { error: 'GENERATING_IN_PROGRESS' };
  }

  await scrollToLoadAll();

  const nodes = parser.getMessageNodes();
  const messages = nodes.map(node => {
    const { role, html } = parser.parseNode(node);
    const markdown = turndownService.turndown(html);
    return { role, content: markdown, timestamp: extractTimestamp(node) };
  });

  return buildJsonl(messages, {
    platform: parser.platform,
    url: location.href,
    title: parser.getTitle(),
    exported_at: new Date().toISOString()
  });
}
```

**3. JSONL 생성**
```javascript
function buildJsonl(messages, meta) {
  const metaLine = JSON.stringify({ _meta: true, ...meta });
  const messageLines = messages.map(m => JSON.stringify(m));
  return [metaLine, ...messageLines].join('\n');
}
```

### Manifest 설정

```json
{
  "manifest_version": 3,
  "name": "LLM Chat Exporter",
  "version": "0.1.0",
  "permissions": ["activeTab", "scripting", "downloads"],
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
      "description": "Export current conversation as JSONL"
    }
  }
}
```

---

## 개발 단계

| 순서 | 작업 | 산출물 | 예상 난이도 |
|------|------|--------|-------------|
| 1 | 익스텐션 골격 + 단축키 바인딩 | manifest, background 기본 동작 | 하 |
| 2 | ChatGPT DOM 분석 및 Parser 구현 | chatgpt.js | 중 |
| 3 | Claude DOM 분석 및 Parser 구현 | claude.js | 중~상 |
| 4 | Gemini DOM 분석 및 Parser 구현 | gemini.js | 중 |
| 5 | 스크롤 로딩 로직 | scroller.js | 중 |
| 6 | Markdown 변환 통합 | turndown 적용 | 하 |
| 7 | 통합 테스트 및 에지 케이스 처리 | 완성 | 중 |

---

## 주요 리스크 및 대응

**DOM 구조 변경**
- 리스크: 세 서비스 모두 프론트엔드를 자주 업데이트
- 대응: 클래스명 의존 최소화. `data-*` 속성, `aria-label`, 구조적 경로(XPath) 우선 사용

**CSS Modules/난독화**
- 리스크: `div.br-x7s` 같은 랜덤 클래스명
- 대응: 상대적/구조적 선택자 사용. fallback selector 여러 개 준비

**Claude Artifacts**
- 리스크: 코드/프리뷰가 별도 DOM 트리
- 대응: 본문에 `[Artifact: {title}]` placeholder 삽입, 또는 내용 포함 여부 옵션화

**생성 중 상태**
- 리스크: 불완전한 답변 저장
- 대응: "Stop Generating" 버튼 존재 여부로 판단, 경고 후 중단

---

## 맹점 체크

**검증되지 않은 전제**
1. 스크롤로 전체 대화를 로딩할 수 있다고 가정 — 일부 서비스는 서버 사이드 페이지네이션을 사용할 수 있음
2. timestamp가 DOM에서 추출 가능하다고 가정 — 실제로는 노출되지 않을 수 있음 (저장 시점으로 대체 필요)

**이 설계가 틀릴 조건**: 서비스가 Shadow DOM으로 전환하거나, 대화 내용을 Canvas/WebGL로 렌더링하는 경우 DOM 파싱 자체가 불가능해짐
