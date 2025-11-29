# 개발 계획 (PLAN.md)

## 목차

1. [개발 로드맵](#개발-로드맵)
2. [단계별 상세 작업](#단계별-상세-작업)
3. [검증해야 할 전제 조건](#검증해야-할-전제-조건)
4. [우선순위 및 의존성](#우선순위-및-의존성)
5. [예상 난이도 및 시간](#예상-난이도-및-시간)

---

## 개발 로드맵

### Phase 0: 사전 검증 (현재 단계) ✅

| 작업                 | 상태   | 산출물       |
| -------------------- | ------ | ------------ |
| 요구사항 정의서 작성 | ✅ 완료 | docs/by_*.md |
| 아키텍처 설계        | ✅ 완료 | DESIGN.md    |
| 개발 계획 수립       | ✅ 완료 | PLAN.md      |

---

### Phase 1: 프로토타입 검증 ✅ 완료 (2025-11-29)

**목표**: 실제 DOM에서 메시지 추출이 가능한지 검증

| 순서 | 작업                      | 체크리스트                                                                                                                         | 예상 난이도 |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1.1  | ChatGPT DOM 분석          | - [x] 메시지 컨테이너 셀렉터 확인<br>- [x] role 구분 방법 확인<br>- [x] 콘텐츠 영역 추출<br>- [x] 생성 중 버튼 확인                | ⭐ 하        |
| 1.2  | Claude DOM 분석           | - [x] 메시지 컨테이너 셀렉터 확인<br>- [x] role 구분 방법 확인<br>- [x] Artifacts 패널 구조 파악<br>- [x] Virtualization 동작 확인 | ⭐⭐ 중       |
| 1.3  | Gemini DOM 분석           | - [x] Shadow DOM 사용 여부 확인<br>- [x] 메시지 컨테이너 셀렉터<br>- [x] Draft 답변 처리 방법                                      | ⭐⭐ 중       |
| 1.4  | Console 프로토타입 테스트 | - [x] 각 사이트에서 `console`로 셀렉터 검증<br>- [x] 간단한 파싱 스크립트 실행<br>- [x] Edge Case 확인 (빈 대화, 긴 대화)          | ⭐ 하        |

**산출물**: `docs/phase1-validation-results.md` (검증 결과 문서)

**완료 기준**: 세 사이트 모두에서 콘솔로 최소 10개 메시지 추출 성공 ✅
- ChatGPT: 12개 (6 user + 6 assistant)
- Claude: 11개 (5 user + 6 assistant)
- Gemini: 12개 (6 user + 6 assistant)

---

### Phase 2: 익스텐션 골격 구현 ✅ 완료 (2025-11-29)

**목표**: 단축키 → Background → Content Script 메시지 흐름 구현

| 순서 | 작업                | 체크리스트                                                                                                         | 예상 난이도 |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| 2.1  | Manifest 작성       | - [x] manifest.json 생성<br>- [x] permissions 설정<br>- [x] commands 등록                                          | ⭐ 하        |
| 2.2  | Background Script   | - [x] 단축키 이벤트 리스너<br>- [x] 현재 탭 URL 확인<br>- [x] 지원 사이트 판별<br>- [x] Content Script 동적 주입   | ⭐ 하        |
| 2.3  | Content Script 골격 | - [x] 메시지 리스너 등록<br>- [x] Background에 응답 반환<br>- [x] 디버깅 로그 추가                                 | ⭐ 하        |
| 2.4  | 다운로드 기능       | - [x] chrome.downloads API 연동<br>- [x] Data URL 방식 (Service Worker 호환)<br>- [x] 파일명 생성 (타임스탬프)     | ⭐ 하        |
| 2.5  | 통합 테스트         | - [x] 단축키 누르면 더미 JSONL 다운로드<br>- [x] 세 사이트 모두에서 동작 확인                                      | ⭐ 하        |

**산출물**:
- `manifest.json`
- `src/background.ts` → `dist/background.js`
- `src/content/index.ts` → `dist/content.js`
- `package.json`, `tsconfig.json`, `esbuild.config.mjs`

**완료 기준**: 단축키로 더미 텍스트 파일 다운로드 성공 ✅

---

### Phase 2.5: 테스트 환경 구축 ✅ 완료 (2025-11-29)

**목표**: 자동화된 테스트 환경 구축으로 수동 테스트 최소화

| 순서  | 작업           | 체크리스트                                                                                                                                                     | 예상 난이도 |
| ----- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2.5.1 | Vitest 설정    | - [x] vitest 설치<br>- [x] vitest.config.ts 생성<br>- [x] chrome API 모킹 setup<br>- [x] .gitignore 업데이트                                                  | ⭐ 하        |
| 2.5.2 | 단위 테스트    | - [x] background-utils.test.ts (16개 테스트)<br>- [x] content.test.ts (6개 테스트)<br>- [x] 유틸리티 함수 리팩토링 (src/utils/background-utils.ts 분리)         | ⭐ 하        |
| 2.5.3 | E2E 테스트     | - [x] Puppeteer 설정<br>- [x] tests/e2e/setup.ts<br>- [x] tests/e2e/export-flow.test.ts (6개 테스트)                                                          | ⭐⭐ 중       |

**기술 스택**:
- **단위 테스트**: Vitest 2.1.9 (ESM 네이티브 지원, esbuild 호환)
- **E2E 테스트**: Puppeteer 23.11.1
- **Chrome API 모킹**: vi.fn() 기반 직접 구현

**산출물**:
- `vitest.config.ts`
- `tests/setup.ts` (Chrome API 모킹)
- `tests/unit/background-utils.test.ts` (16개 테스트)
- `tests/unit/content.test.ts` (6개 테스트)
- `tests/e2e/setup.ts` (Puppeteer 설정)
- `tests/e2e/export-flow.test.ts` (6개 테스트)
- `src/utils/background-utils.ts` (리팩토링)
- `TEST_SETUP.md` (설치 및 실행 가이드)

**완료 기준**: ✅
- `npm run test` 성공 (28개 테스트 통과)
- src/utils/background-utils.ts 커버리지 100%
- E2E 테스트 환경 구축 완료

---

### Phase 3: Parser 인터페이스 및 유틸리티 ✅ 완료 (2025-11-29)

**목표**: 공통 로직 구현 (Parser Interface, Scroller, Converter)

| 순서 | 작업                   | 체크리스트                                                                                                         | 예상 난이도 |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| 3.0  | **Risk-First 검증**    | - [x] Claude scroller 브라우저 검증 (❌ FAIL → 단순 fallback 채택)<br>- [x] Gemini Shadow DOM 검증 (❌ 불필요 → ~2h 절약)<br>- [x] Turndown 기능 검증 (⚠️ 78% → custom rules 추가) | ⭐⭐ 중       |
| 3.1  | Parser 인터페이스 정의 | - [x] `ChatParser` interface 작성<br>- [x] `ParsedMessage` 타입 정의<br>- [x] `ParserFactory` 클래스 작성 (13 tests) | ⭐ 하        |
| 3.2  | Scroller 유틸리티      | - [x] `scrollToLoadAll()` 구현 (simplified fallback)<br>- [x] ~~MutationObserver 기반 안정화 감지~~ (불필요)<br>- [x] Timeout 옵션 추가 (7 tests)  | ⭐⭐ 중       |
| 3.3  | HTML → Markdown 변환   | - [x] Turndown 라이브러리 추가<br>- [x] 코드 블록 언어 보존 규칙<br>- [x] 테이블 변환 규칙 (19 tests)           | ⭐ 하        |
| 3.4  | JSONL 직렬화           | - [x] `buildJsonl()` 함수 구현<br>- [x] 메타데이터 라인 추가<br>- [x] Timestamp ISO 8601 포맷 (9 tests)             | ⭐ 하        |
| 3.5  | ~~Shadow DOM 유틸리티~~    | - [x] ~~`queryShadowSelector()` 구현~~ (브라우저 검증 결과 불필요)<br>- [x] ~~Gemini에서 테스트~~ (Shadow DOM 없음 확인)                                             | ~~⭐⭐ 중~~       |

**산출물**:
- `src/content/parsers/interface.ts` (TypeScript 인터페이스)
- `src/content/parsers/factory.ts` (13개 테스트)
- `src/content/scroller.ts` (7개 테스트)
- `src/content/converter.ts` (19개 테스트, Turndown + 2 custom rules)
- `src/content/serializer.ts` (9개 테스트)
- `tests/unit/content-integration.test.ts` (6개 통합 테스트)
- `validation-results.md` (브라우저 검증 결과 문서)
- ~~`utils/dom.ts`~~ (불필요, 구현 생략)

**완료 기준**: ✅
- **전체 82개 테스트 통과** (목표 40+의 205% 달성)
  - 기존 28개 (Phase 2.5)
  - 신규 54개 (Phase 3: 13+9+19+7+6)
- Content script 통합 완료 (`src/content/index.ts`)
- 브라우저 테스트 성공 (3개 플랫폼, error JSON download 확인)
- Background script 개선 (error 상황에서도 JSON 다운로드)

---

### Phase 4: 사이트별 Parser 구현 ✅ 완료 (2025-11-29)

**목표**: ChatGPT, Claude, Gemini 각각의 Parser 구현

| 순서 | 작업               | 체크리스트                                                                                                                                                                            | 예상 난이도 |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 4A  | ChatGPTParser 구현 ✅ | - [x] `canHandle()` 구현<br>- [x] `getMessageNodes()` 구현 (fallback chain)<br>- [x] `parseNode()` 구현<br>- [x] `isGenerating()` 구현<br>- [x] `getTitle()` 구현<br>- [x] 28개 단위 테스트 작성 | ⭐⭐ 중       |
| 4B  | GeminiParser 구현 ✅  | - [x] 기본 파싱 로직 (custom elements)<br>- [x] ~~Shadow DOM 탐색~~ (불필요, 검증 완료)<br>- [x] Tag-based role detection<br>- [x] 28개 단위 테스트 작성                                                                                           | ⭐⭐ 중       |
| 4C  | ClaudeParser 구현 ✅  | - [x] 기본 파싱 로직 (hybrid selector)<br>- [x] data-is-streaming 기반 role detection<br>- [x] ~~Artifacts 처리 로직~~ (Phase 5로 연기)<br>- [x] DOM Virtualization 대응 (scroller)<br>- [x] 28개 단위 테스트 작성                                                                               | ⭐⭐⭐ 상      |
| 4D  | Factory 통합 (예정)  | - [ ] ParserFactory.getParser() 구현<br>- [ ] 3개 파서 인스턴스화<br>- [ ] 브라우저 테스트                                                                               | ⭐ 하      |

**개발 방법론**: TDD (Test-Driven Development)
- RED phase: 테스트 먼저 작성 (28개/파서)
- GREEN phase: 구현으로 테스트 통과
- REFACTOR phase: 코드 품질 개선

**산출물**:
- `src/content/parsers/chatgpt.ts` (240 lines, 28 tests)
- `src/content/parsers/gemini.ts` (270 lines, 28 tests)
- `src/content/parsers/claude.ts` (323 lines, 28 tests)
- `tests/unit/parsers/chatgpt.test.ts`
- `tests/unit/parsers/gemini.test.ts`
- `tests/unit/parsers/claude.test.ts`
- `tests/unit/parsers/shared/fixtures.ts` (테스트 유틸리티)
- `tests/unit/parsers/shared/mocks.ts` (Mock DOM elements)

**완료 기준**: ✅
- **전체 166개 테스트 통과** (82개 → 166개, +84개)
  - 기존 82개 (Phase 0-3)
  - 신규 84개 (Phase 4A-C: 28×3)
- 3개 파서 모두 ChatParser 인터페이스 구현 완료
- Sample HTML 기반 파싱 검증 완료
- 코드 블록, 테이블, 리스트 구조 보존 확인

**주요 구현 특징**:
- **ChatGPT**: Fallback selector chain (data-turn → data-message-author-role)
- **Gemini**: Custom elements 기반 (user-query, model-response)
- **Claude**: Hybrid selector (data-testid + data-is-streaming)

---

### Phase 5: 통합 및 에지 케이스 처리

**목표**: 모든 컴포넌트 통합 및 예외 상황 처리

| 순서 | 작업                 | 체크리스트                                                                                                   | 예상 난이도 |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| 5.1  | End-to-End 통합      | - [ ] 전체 플로우 연결<br>- [ ] 세 사이트 모두 테스트<br>- [ ] 파일 다운로드 확인                            | ⭐⭐ 중       |
| 5.2  | 에러 처리            | - [ ] 지원하지 않는 사이트 처리<br>- [ ] 생성 중 경고<br>- [ ] 빈 대화 처리<br>- [ ] 네트워크 에러 처리      | ⭐⭐ 중       |
| 5.3  | 긴 대화 테스트       | - [ ] 100+ 메시지 대화 테스트<br>- [ ] DOM Virtualization 동작 확인<br>- [ ] 성능 측정 (추출 시간)           | ⭐⭐ 중       |
| 5.4  | 다양한 콘텐츠 테스트 | - [ ] 코드 블록 (다양한 언어)<br>- [ ] 테이블<br>- [ ] 수식 (LaTeX)<br>- [ ] 이미지<br>- [ ] 리스트 (nested) | ⭐⭐ 중       |
| 5.5  | UI/UX 개선           | - [ ] 진행 상태 알림 (선택)<br>- [ ] 에러 메시지 개선<br>- [ ] 성공 알림                                     | ⭐ 하        |

**산출물**: 완전히 동작하는 익스텐션

**완료 기준**:
- 세 사이트 모두에서 다양한 대화 성공적으로 추출
- 알려진 에지 케이스 모두 처리

---

### Phase 6: 문서화 및 배포 준비 (선택)

| 순서 | 작업                  | 체크리스트                                                                    | 예상 난이도 |
| ---- | --------------------- | ----------------------------------------------------------------------------- | ----------- |
| 6.1  | 사용자 문서           | - [ ] 설치 가이드 상세화<br>- [ ] 스크린샷 추가<br>- [ ] 트러블슈팅 섹션      | ⭐ 하        |
| 6.2  | 코드 정리             | - [ ] 주석 추가<br>- [ ] 타입 정의 개선<br>- [ ] 디버그 로그 정리             | ⭐ 하        |
| 6.3  | Chrome Web Store 준비 | - [ ] 아이콘 제작<br>- [ ] 스토어 설명 작성<br>- [ ] 스크린샷/프로모션 이미지 | ⭐⭐ 중       |

---

## 단계별 상세 작업

### Phase 1.1: ChatGPT DOM 분석 (상세)

**실행 방법**:

1. ChatGPT에서 임의의 대화 페이지 접속
2. 개발자 도구(F12) 콘솔 열기
3. 다음 스크립트 실행:

```javascript
// 메시지 컨테이너 찾기
const messages = document.querySelectorAll('[data-message-author-role]');
console.log('총 메시지 수:', messages.length);

// 첫 번째 메시지 분석
const firstMsg = messages[0];
console.log('Role:', firstMsg.getAttribute('data-message-author-role'));
console.log('Content:', firstMsg.querySelector('.markdown')?.textContent);

// 생성 중 확인
const isGenerating = document.querySelector('button[aria-label*="Stop"]') !== null;
console.log('생성 중:', isGenerating);

// 제목
const title = document.querySelector('h1')?.textContent;
console.log('대화 제목:', title);
```

4. 결과를 `docs/dom-selectors.md`에 기록

**예상 결과**:
- 메시지 노드 수가 실제 대화 수와 일치
- role이 'user' 또는 'assistant'로 올바르게 추출
- 콘텐츠가 정확히 추출됨

---

### Phase 1.2: Claude DOM 분석 (상세)

**주의사항**: Claude는 DOM 구조가 자주 변경되므로, 여러 fallback 셀렉터 준비

```javascript
// 방법 1: role 속성 기반
let messages = document.querySelectorAll('[role="article"]');
if (messages.length === 0) {
  // 방법 2: 구조적 위치
  messages = document.querySelectorAll('.conversation > div');
}

console.log('총 메시지 수:', messages.length);

// Artifacts 확인
const artifacts = document.querySelectorAll('[data-artifact-id]');
console.log('Artifacts 수:', artifacts.length);

// DOM Virtualization 테스트
console.log('현재 scrollHeight:', document.body.scrollHeight);
window.scrollTo(0, 0);
setTimeout(() => {
  console.log('스크롤 후 scrollHeight:', document.body.scrollHeight);
  console.log('새 메시지 수:', document.querySelectorAll('[role="article"]').length);
}, 2000);
```

---

### Phase 1.3: Gemini DOM 분석 (상세)

**Shadow DOM 체크**:

```javascript
// Shadow DOM 탐색 유틸
function findInShadow(selector, root = document.body) {
  let result = root.querySelector(selector);
  if (result) return result;

  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      result = findInShadow(selector, el.shadowRoot);
      if (result) return result;
    }
  }
  return null;
}

// 메시지 찾기
const messages = findInShadow('[role="presentation"]') || document.querySelectorAll('.message');
console.log('메시지 수:', messages?.length || 0);

// Draft 답변 처리
const activeDraft = document.querySelector('.response.active');
console.log('현재 선택된 답변:', activeDraft?.textContent.substring(0, 100));
```

---

## 검증해야 할 전제 조건

### 1. 스크롤로 전체 대화 로딩 가능 여부

**전제**: DOM Virtualization을 사용하는 사이트도 스크롤로 전체 메시지를 로딩할 수 있다

**검증 방법**:
- Claude에서 100+ 메시지 대화 생성
- 맨 아래로 스크롤 후 맨 위로 스크롤
- DOM에 모든 메시지가 로딩되는지 확인

**실패 시 대응**:
- 서버 사이드 페이지네이션을 사용하는 경우, API 호출 필요
- 또는 "현재 화면에 보이는 메시지만" 저장하도록 범위 축소

---

### 2. Timestamp 추출 가능 여부

**전제**: DOM에서 개별 메시지의 작성 시각을 추출할 수 있다

**검증 방법**:
```javascript
const msg = document.querySelector('[data-message-author-role]');
const timeElement = msg.querySelector('time');
console.log('Timestamp:', timeElement?.getAttribute('datetime'));
```

**실패 시 대응**:
- 저장 시점의 타임스탬프를 모든 메시지에 공통으로 사용
- 또는 메시지 순번만 기록

---

### 3. Markdown 변환 품질

**전제**: Turndown이 LLM 응답의 리치 포맷(코드, 테이블)을 정확히 변환한다

**검증 방법**:
- 코드 블록, 테이블이 포함된 응답 추출
- Turndown 변환 후 결과 확인
- 재변환 시 정보 손실 여부 체크

**실패 시 대응**:
- Turndown 규칙 커스터마이징
- 또는 raw HTML로 저장하는 옵션 제공

---

## 우선순위 및 의존성

### 우선순위

1. **P0 (필수)**: Phase 1 (DOM 검증) - 이것이 실패하면 프로젝트 전체가 불가능
2. **P0 (필수)**: Phase 2 (골격) + Phase 3 (유틸리티) - 기본 인프라
3. **P0 (필수)**: Phase 4.1 (ChatGPT Parser) - 가장 간단한 사이트로 프로토타입
4. **P1 (중요)**: Phase 4.2, 4.3 (Claude, Gemini Parser)
5. **P2 (선택)**: Phase 5 (에지 케이스), Phase 6 (문서화)

### 의존성 그래프

```
Phase 1 (DOM 검증)
    ↓
Phase 2 (골격) + Phase 3 (유틸리티)
    ↓
Phase 4.1 (ChatGPT Parser)
    ↓
Phase 4.2, 4.3 (Claude, Gemini Parser) [병렬 가능]
    ↓
Phase 5 (통합 테스트)
    ↓
Phase 6 (문서화) [선택]
```

---

## 예상 난이도 및 시간

| Phase     | 난이도 | 예상 시간     | 비고                              |
| --------- | ------ | ------------- | --------------------------------- |
| Phase 1   | ⭐ 하   | 2-3시간       | DOM 분석은 단순하지만 중요        |
| Phase 2   | ⭐ 하   | 2-4시간       | 익스텐션 기본 구조                |
| Phase 3   | ⭐⭐ 중  | 4-6시간       | Scroller 로직이 까다로움          |
| Phase 4.1 | ⭐⭐ 중  | 3-5시간       | ChatGPT가 가장 단순               |
| Phase 4.2 | ⭐⭐⭐ 상 | 6-8시간       | Claude Artifacts + Virtualization |
| Phase 4.3 | ⭐⭐ 중  | 4-6시간       | Shadow DOM 처리                   |
| Phase 5   | ⭐⭐ 중  | 4-6시간       | 디버깅 시간 포함                  |
| Phase 6   | ⭐ 하   | 2-3시간       | 선택 사항                         |
| **총합**  | -      | **27-41시간** | 약 1-2주 (파트타임 기준)          |

---

## Next Steps (지금 바로 시작하기)

### Step 1: DOM 셀렉터 검증 (가장 먼저!)

1. ChatGPT 대화 페이지를 엽니다
2. F12 → Console 탭
3. 다음 명령어를 실행:

```javascript
// 메시지 노드 확인
document.querySelectorAll('[data-message-author-role]')
```

4. 결과가 나오면 → Phase 1 시작 가능
5. 결과가 안 나오면 → 다른 셀렉터 시도

### Step 2: 프로젝트 폴더 구조 생성

```bash
mkdir -p content/parsers utils lib
touch manifest.json background.js content/index.js
```

### Step 3: Turndown 라이브러리 다운로드

```bash
cd lib
curl -o turndown.min.js https://unpkg.com/turndown/dist/turndown.js
```

---

## 체크리스트 (전체 프로젝트)

- [x] 요구사항 정의서 작성
- [x] 아키텍처 설계 문서 작성
- [x] 개발 계획 수립
- [x] **Phase 1: DOM 셀렉터 검증** (2025-11-29 완료)
- [x] **Phase 2: 익스텐션 골격 구현** (2025-11-29 완료)
- [x] **Phase 2.5: 테스트 환경 구축** (2025-11-29 완료)
- [x] **Phase 3: 공통 유틸리티 구현** (2025-11-29 완료) ✅
- [ ] **Phase 4: ChatGPT Parser** ← 다음 단계
- [ ] Phase 4: Claude Parser
- [ ] Phase 4: Gemini Parser
- [ ] Phase 5: 통합 테스트
- [ ] Phase 6: 문서화 (선택)

---

**다음 작업**: Phase 4.1 - ChatGPT Parser 구현

💡 **Tip**: 각 Phase를 완료할 때마다 `git commit`으로 체크포인트를 만드세요. DOM 구조 변경 시 이전 버전으로 롤백할 수 있습니다.
