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

### Phase 3: Parser 인터페이스 및 유틸리티

**목표**: 공통 로직 구현 (Parser Interface, Scroller, Converter)

| 순서 | 작업                   | 체크리스트                                                                                                | 예상 난이도 |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| 3.1  | Parser 인터페이스 정의 | - [ ] `ChatParser` interface 작성<br>- [ ] `ParsedMessage` 타입 정의<br>- [ ] `ParserFactory` 클래스 작성 | ⭐ 하        |
| 3.2  | Scroller 유틸리티      | - [ ] `scrollToLoadAll()` 구현<br>- [ ] MutationObserver 기반 안정화 감지<br>- [ ] Timeout/MaxRetry 추가  | ⭐⭐ 중       |
| 3.3  | HTML → Markdown 변환   | - [ ] Turndown 라이브러리 추가<br>- [ ] 코드 블록 규칙 커스터마이징<br>- [ ] 테이블 변환 테스트           | ⭐ 하        |
| 3.4  | JSONL 직렬화           | - [ ] `buildJsonl()` 함수 구현<br>- [ ] 메타데이터 라인 추가<br>- [ ] Timestamp ISO 8601 포맷             | ⭐ 하        |
| 3.5  | Shadow DOM 유틸리티    | - [ ] `queryShadowSelector()` 구현<br>- [ ] Gemini에서 테스트                                             | ⭐⭐ 중       |

**산출물**:
- `content/parsers/interface.ts`
- `content/parsers/factory.ts`
- `content/scroller.ts`
- `content/converter.ts`
- `content/serializer.ts`
- `utils/dom.ts`

**완료 기준**: 유닛 테스트 (console에서) 통과

---

### Phase 4: 사이트별 Parser 구현

**목표**: ChatGPT, Claude, Gemini 각각의 Parser 구현

| 순서 | 작업               | 체크리스트                                                                                                                                                                            | 예상 난이도 |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 4.1  | ChatGPTParser 구현 | - [ ] `canHandle()` 구현<br>- [ ] `getMessageNodes()` 구현<br>- [ ] `parseNode()` 구현<br>- [ ] `isGenerating()` 구현<br>- [ ] `getTitle()` 구현<br>- [ ] 통합 테스트 (실제 대화에서) | ⭐⭐ 중       |
| 4.2  | ClaudeParser 구현  | - [ ] 기본 파싱 로직<br>- [ ] Artifacts 처리 로직<br>- [ ] DOM Virtualization 대응<br>- [ ] 통합 테스트                                                                               | ⭐⭐⭐ 상      |
| 4.3  | GeminiParser 구현  | - [ ] Shadow DOM 탐색<br>- [ ] Draft 답변 처리<br>- [ ] 기본 파싱 로직<br>- [ ] 통합 테스트                                                                                           | ⭐⭐ 중       |

**산출물**:
- `content/parsers/chatgpt.ts`
- `content/parsers/claude.ts`
- `content/parsers/gemini.ts`

**완료 기준**:
- 각 사이트에서 최소 3개의 서로 다른 대화 성공적으로 추출
- 코드 블록, 테이블, 리스트가 올바르게 변환됨

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
- [ ] **Phase 3: 공통 유틸리티 구현** ← 다음 단계
- [ ] Phase 4: ChatGPT Parser
- [ ] Phase 4: Claude Parser
- [ ] Phase 4: Gemini Parser
- [ ] Phase 5: 통합 테스트
- [ ] Phase 6: 문서화 (선택)

---

**다음 작업**: Phase 3.1 - Parser 인터페이스 정의

💡 **Tip**: 각 Phase를 완료할 때마다 `git commit`으로 체크포인트를 만드세요. DOM 구조 변경 시 이전 버전으로 롤백할 수 있습니다.
