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
| 4D  | Factory 통합 ✅  | - [x] ParserFactory.getParser() 구현<br>- [x] 3개 파서 인스턴스화<br>- [x] 단위 테스트 업데이트 (13 tests)                                                                               | ⭐ 하      |

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
- **전체 162개 테스트 통과** (82개 → 162개, +80개)
  - 기존 82개 (Phase 0-3)
  - 신규 80개 (Phase 4A-D: 28×3 + 4 integration)
- 3개 파서 모두 ChatParser 인터페이스 구현 완료
- ParserFactory 통합 완료 - 실제 파서 인스턴스 반환
- Sample HTML 기반 파싱 검증 완료
- 코드 블록, 테이블, 리스트 구조 보존 확인
- Extension 빌드 성공 (dist/background.js, dist/content.js)

**주요 구현 특징**:
- **ChatGPT**: Fallback selector chain (data-turn → data-message-author-role)
- **Gemini**: Custom elements 기반 (user-query, model-response)
- **Claude**: Hybrid selector (data-testid + data-is-streaming)

---

### Phase 5: 통합 및 에지 케이스 처리 ✅ COMPLETE (2025-11-29)

**목표**: 모든 컴포넌트 통합 및 예외 상황 처리

| 순서 | 작업                 | 체크리스트                                                                                                   | 예상 난이도 | 상태 |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | ---- |
| 5.1  | End-to-End 통합 준비 ✅ | - [x] 전체 플로우 연결<br>- [x] 테스팅 가이드 작성 (450+ lines)<br>- [x] 빌드 성공 (dist/ 생성)                            | ⭐⭐ 중       | **완료** |
| 5.2  | 에러 처리 ✅            | - [x] 지원하지 않는 사이트 처리 (notification)<br>- [x] 생성 중 경고<br>- [x] 빈 대화 처리<br>- [x] Chrome notifications 구현      | ⭐⭐ 중       | **완료** |
| 5.3  | 긴 대화 테스트       | - [ ] 100+ 메시지 대화 테스트 (수동)<br>- [ ] DOM Virtualization 동작 확인<br>- [ ] 성능 측정 (추출 시간)           | ⭐⭐ 중       | **보류** |
| 5.4  | 다양한 콘텐츠 테스트 | - [ ] 코드 블록 (다양한 언어)<br>- [ ] 테이블<br>- [ ] 수식 (LaTeX)<br>- [ ] 이미지<br>- [ ] 리스트 (nested) | ⭐⭐ 중       | **보류** |
| 5.5  | UI/UX 개선 ✅           | - [x] 에러 메시지 개선 (user-friendly)<br>- [x] 성공 알림 (message count + filename)<br>- [x] Chrome notifications API 통합                                     | ⭐ 하        | **완료** |
| 5.6  | Title 기능 제거 ✅      | - [x] `getTitle()` 메서드 제거<br>- [x] ExportMetadata에서 title 필드 제거<br>- [x] 관련 테스트 제거 (9개)<br>- [x] 문서 업데이트<br>**이유**: 플랫폼별 title selector 불안정, best-effort로도 신뢰성 부족 → 포기 결정 | ⭐ 하        | **완료** |

**산출물**:
- ✅ `docs/phase5-testing-guide.md` - 포괄적 테스팅 가이드
- ✅ Enhanced error handling with user notifications
- ✅ Extension ready for manual browser testing
- ✅ Stable JSONL schema without optional title field
- ⏳ 실제 브라우저 테스트 필요 (Phase 5.3, 5.4 - 사용자 manual test로 대체)

**완료 기준**:
- ✅ 코드 레벨 에러 처리 구현
- ✅ 사용자 알림 시스템 구현
- ✅ 156개 테스트 통과
- ✅ 빌드 성공
- ✅ Manual test 가이드 제공
- ⏳ 세 사이트 모두에서 수동 테스트 (사용자가 수행 완료 - 정상 작동 확인)

---

### Phase 6: 문서화 및 배포 준비 (선택)

| 순서 | 작업                  | 체크리스트                                                                    | 예상 난이도 |
| ---- | --------------------- | ----------------------------------------------------------------------------- | ----------- |
| 6.1  | 사용자 문서           | - [ ] 설치 가이드 상세화<br>- [ ] 스크린샷 추가<br>- [ ] 트러블슈팅 섹션      | ⭐ 하        |
| 6.2  | 코드 정리             | - [ ] 주석 추가<br>- [ ] 타입 정의 개선<br>- [ ] 디버그 로그 정리             | ⭐ 하        |
| 6.3  | Chrome Web Store 준비 | - [ ] 아이콘 제작<br>- [ ] 스토어 설명 작성<br>- [ ] 스크린샷/프로모션 이미지 | ⭐⭐ 중       |

---

### Phase 7: UI 변경 대응 전략 - Configuration-Driven Architecture

**목표**: 셀렉터를 외부 설정 파일로 분리하여 장기적 유지보수성 확보

**배경**:
- ChatGPT, Claude, Gemini는 연 3-6회 UI 업데이트 예상
- 현재: 셀렉터가 TypeScript에 하드코딩 → 업데이트 시 30-60분 소요
- 목표: Configuration-driven 아키텍처 → 업데이트 시 5-10분 (73% 단축)

**핵심 설계 결정**:
- **접근 방식**: Configuration-Driven (JSON 기반 설정)
- **버전 관리**: 다중 UI 버전 동시 지원 (구 UI + 신 UI)
- **장애 처리**: 현재 방식 유지 (완전 실패)
- **구현 기간**: 1-2주 (중간 리소스)

| 순서 | 작업                     | 체크리스트                                                                                                                           | 예상 난이도 | 예상 시간 |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------- |
| 7.1  | Configuration 인프라 구축 | - [ ] `/config/selectors.json` 생성 (현재 셀렉터 추출, ~350줄)<br>- [ ] `/config/selectors.schema.json` 생성 (JSON Schema, ~100줄)<br>- [ ] `/src/content/parsers/config-loader.ts` 구현 (~200줄)<br>- [ ] `esbuild.config.mjs` 수정 (JSON 번들링)<br>- [ ] 빌드 테스트 (설정 파일 `dist/`에 포함 확인) | ⭐⭐ 중       | 2일 (Day 1-2) |
| 7.2  | BaseParser 추상 클래스    | - [ ] `/src/content/parsers/base-parser.ts` 생성 (~180줄)<br>- [ ] `getNodesWithFallback()` 메서드 (통합 fallback 로직)<br>- [ ] `extractRoleFromConfig()` - attribute 전략<br>- [ ] `extractRoleFromConfig()` - hybrid 전략<br>- [ ] `extractRoleFromConfig()` - tagname 전략<br>- [ ] `extractContentFromConfig()` 구현<br>- [ ] BaseParser 단위 테스트 작성 (20 tests) | ⭐⭐ 중       | 3일 (Day 3-5) |
| 7.3  | ChatGPTParser 리팩토링    | - [ ] ChatGPTParser가 BaseParser 상속<br>- [ ] 하드코딩된 셀렉터 제거 (lines 29-46)<br>- [ ] `MESSAGE_SELECTORS` → ConfigLoader 사용<br>- [ ] `CONTENT_SELECTORS` → ConfigLoader 사용<br>- [ ] BaseParser 메서드 활용<br>- [ ] 기존 25개 테스트 모두 통과 확인<br>- [ ] 수동 테스트 (실제 ChatGPT 페이지)<br>**코드 감소**: 217줄 → 60줄 (73% 감소) | ⭐⭐ 중       | 2일 (Day 6-7) |
| 7.4  | ClaudeParser 리팩토링     | - [ ] ClaudeParser 리팩토링 (ChatGPT 패턴 동일)<br>- [ ] Hybrid 전략을 설정으로 이전<br>- [ ] `data-testid` + `data-is-streaming` 로직 설정화<br>- [ ] 25개 테스트 통과 확인<br>- [ ] 수동 테스트 (실제 Claude 페이지)<br>**코드 감소**: 322줄 → 80줄 (75% 감소) | ⭐⭐⭐ 상      | 1일 (Day 8) |
| 7.5  | GeminiParser 리팩토링     | - [ ] GeminiParser 리팩토링<br>- [ ] Tagname 전략을 설정으로 이전 (`user-query`, `model-response`)<br>- [ ] Custom element mapping 설정화<br>- [ ] 25개 테스트 통과 확인<br>- [ ] 수동 테스트 (실제 Gemini 페이지)<br>**코드 감소**: 270줄 → 70줄 (74% 감소) | ⭐⭐ 중       | 1일 (Day 9) |
| 7.6  | 검증 도구 & 문서화        | - [ ] `/scripts/validate-selectors.js` 구현 (~120줄)<br>- [ ] `/samples/metadata.json` 생성 (sample 버전 추적)<br>- [ ] `package.json`에 `validate:selectors` 스크립트 추가<br>- [ ] `npm run validate:selectors` 실행하여 전체 검증<br>- [ ] `/config/README.md` 작성 (셀렉터 업데이트 가이드)<br>- [ ] `CLAUDE.md` 업데이트 (새 아키텍처 반영)<br>- [ ] 최종 통합 테스트 (156 tests 통과) | ⭐ 하        | 1일 (Day 10) |

**산출물**:

**신규 파일 (6개)**:
1. `/config/selectors.json` (~350줄) - 중앙 셀렉터 설정 파일
2. `/config/selectors.schema.json` (~100줄) - JSON Schema 검증
3. `/src/content/parsers/config-loader.ts` (~200줄) - Singleton 설정 로더
4. `/src/content/parsers/base-parser.ts` (~180줄) - 추상 베이스 클래스
5. `/scripts/validate-selectors.js` (~120줄) - CLI 검증 도구
6. `/samples/metadata.json` (~50줄) - Sample HTML 메타데이터

**수정 파일 (8개)**:
1. `/src/content/parsers/chatgpt.ts` - 217줄 → 60줄
2. `/src/content/parsers/claude.ts` - 322줄 → 80줄
3. `/src/content/parsers/gemini.ts` - 270줄 → 70줄
4. `/esbuild.config.mjs` - JSON 번들링 로직 추가
5. `/package.json` - `validate:selectors` 스크립트
6. `/CLAUDE.md` - 새 아키텍처 문서화
7. `/config/README.md` - 설정 가이드 (신규)
8. `/samples/README.md` - 버전 추적 섹션 추가

**테스트 파일**:
1. `/tests/unit/config-loader.test.ts` (~100줄, 15 tests)

**완료 기준**:
- ✅ 전체 156개 테스트 통과 (기존 테스트 모두 유지)
- ✅ 3개 파서 모두 BaseParser 상속 완료
- ✅ 셀렉터가 `/config/selectors.json`에서 로드됨
- ✅ `npm run build` 성공 (selectors.json이 dist/에 번들링됨)
- ✅ `npm run validate:selectors` 성공 (3개 플랫폼 모두 검증)
- ✅ 수동 테스트 성공 (실제 3개 플랫폼 페이지에서 export)

**설정 파일 구조 (selectors.json)**:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-11-29",
  "platforms": {
    "chatgpt": {
      "hostname": "chatgpt.com",
      "versions": [
        {
          "id": "v1.0",
          "description": "Initial ChatGPT UI (Nov 2025)",
          "effectiveDate": "2025-11-29",
          "deprecated": false,
          "selectors": {
            "messages": {
              "primary": "[data-message-author-role]",
              "fallbacks": ["[data-turn]", "article[data-testid^=\"conversation\"]"]
            },
            "content": {
              "user": ".whitespace-pre-wrap",
              "assistant": ".markdown"
            },
            "generation": {
              "stopButton": "button[aria-label*=\"Stop\"]"
            },
            "metadata": {
              "role": {
                "strategy": "attribute",
                "attribute": "data-message-author-role",
                "fallback": "data-turn"
              }
            }
          }
        }
      ],
      "activeVersion": "v1.0"
    }
    // claude, gemini 유사 구조...
  }
}
```

**핵심 아키텍처 패턴**:

1. **ConfigLoader (Singleton)**:
```typescript
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: SelectorConfig | null = null;

  static getInstance(): ConfigLoader { /* ... */ }
  loadConfig(): SelectorConfig { /* 캐싱 */ }
  getActiveSelectors(hostname: string): PlatformSelectors | null { /* ... */ }
}
```

2. **BaseParser (Abstract Class)**:
```typescript
export abstract class BaseParser implements ChatParser {
  protected selectors: PlatformSelectors;

  constructor(platformHostname: string) {
    this.selectors = configLoader.getActiveSelectors(platformHostname);
  }

  protected getNodesWithFallback(): HTMLElement[] { /* 통합 로직 */ }
  protected extractRoleFromConfig(node: HTMLElement): 'user' | 'assistant' { /* ... */ }
  protected extractContentFromConfig(node: HTMLElement, role): string { /* ... */ }
}
```

3. **리팩토링된 Parser (예: ChatGPT)**:
```typescript
export class ChatGPTParser extends BaseParser {
  constructor() {
    super('chatgpt.com');  // 설정 자동 로드
  }

  getMessageNodes(): HTMLElement[] {
    return this.getNodesWithFallback();  // BaseParser 메서드
  }

  parseNode(node: HTMLElement): ParsedMessage {
    const role = this.extractRoleFromConfig(node);
    const contentHtml = this.extractContentFromConfig(node, role);
    return { role, contentHtml, timestamp: undefined };
  }
}
```

**장점 (Tradeoffs)**:

✅ **유지보수성**:
- 셀렉터 업데이트 시간: 30-60분 → 5-10분 (73% 단축)
- TypeScript 리컴파일 불필요 (JSON만 수정 후 빌드)
- 중앙 집중식 관리 (모든 셀렉터가 한 파일에)
- Git에서 변경 이력 명확

✅ **버전 관리**:
- 다중 UI 버전 동시 지원 (구 UI + 신 UI)
- 점진적 마이그레이션 (`activeVersion` 변경만으로 전환)
- 롤백 기능 (문제 시 이전 버전으로 즉시 복귀)
- A/B 테스트 가능

✅ **코드 품질**:
- 파서 코드 평균 73% 감소 (270줄 → 70줄)
- 코드 중복 제거 (BaseParser로 통합)
- 테스트 용이성 향상
- 확장성 (새 플랫폼 추가 시 설정만 추가)

✅ **자동화**:
- `npm run validate:selectors`로 즉시 검증
- CI/CD 통합 가능 (GitHub Actions)
- 에러 메시지에 설정 버전 자동 포함

⚠️ **단점**:
- 초기 구현 시간 (~1-2주)
- 약간의 복잡도 증가 (설정 레이어)
- Runtime 오버헤드 ~5% (2.0ms → 2.1ms, 무시 가능)
- 개발자 학습 곡선 (설정 구조 이해 필요)

**셀렉터 업데이트 워크플로우 (기존 vs 신규)**:

**기존 방식 (30-60분)**:
```
UI 변경 감지
  ↓ 10분: 브라우저에서 새 셀렉터 찾기
  ↓ 10분: TypeScript 파일 수정 (chatgpt.ts, claude.ts, gemini.ts)
  ↓ 5분: TypeScript 컴파일 오류 수정
  ↓ 5분: npm run build
  ↓ 10분: npm test (156 tests)
  ↓ 5분: 수동 테스트 (실제 페이지)
  ↓ 5-10분: Git commit/push
총: 30-60분
```

**신규 방식 (5-10분)**:
```
UI 변경 감지
  ↓ 3분: 브라우저에서 새 셀렉터 찾기
  ↓ 2분: /config/selectors.json 편집 (JSON Schema가 자동 검증)
  ↓ 30초: npm run validate:selectors (자동 검증)
  ↓ 1분: npm run build (JSON만 번들링, TS 컴파일 불필요)
  ↓ 2분: npm test (기존 테스트 통과 확인)
  ↓ 1분: 수동 테스트
총: 5-10분 (73% 단축)
```

**긴급 핫픽스 워크플로우**:
```bash
# 1. 설정 파일 수정 (2분)
vim config/selectors.json

# 2. 자동 검증 (30초)
npm run validate:selectors

# 3. 빌드 (30초)
npm run build

# 4. 수동 테스트 (3분)
# Chrome에서 extension 로드 후 실제 페이지 테스트

# 5. 배포 (2분)
git add config/selectors.json
git commit -m "fix: Update ChatGPT selectors for new UI"
git push

# 총: ~8분
```

**향후 확장 가능성 (Phase 8+, 선택)**:

1. **Remote 설정 서버** (긴급 hotfix 배포)
   - CDN 호스팅된 selectors.json
   - Extension 재배포 없이 셀렉터 업데이트
   - 프라이버시 고려 필요

2. **커뮤니티 셀렉터 데이터베이스**
   - 사용자가 작동하는 셀렉터 공유
   - 크라우드소싱된 UI 변경 감지

3. **자동 셀렉터 탐색 (ML 기반)**
   - 휴리스틱 기반 대안 셀렉터 제안
   - DOM 구조 분석으로 자동 발견

**성공 지표**:

| 지표                  | 구현 전 (현재)        | 구현 후 (목표)          |
| --------------------- | --------------------- | ----------------------- |
| 셀렉터 업데이트 시간   | 30-60분               | 5-10분                  |
| 파서 코드 길이        | 평균 270줄             | 평균 70줄               |
| 검증 방법             | 수동 (브라우저 콘솔)   | 자동 (`npm run validate`) |
| 버전 관리             | 없음                  | 완전 지원 (rollback, A/B) |
| 업데이트 난이도       | TypeScript 지식 필요   | JSON 편집만             |

**위험 관리**:

🟢 **낮은 위험**:
- JSON 번들링: esbuild 네이티브 지원
- BaseParser 패턴: 검증된 디자인 패턴
- 기존 테스트: 156개 테스트가 regression 방지

🟡 **중간 위험** (완화 전략 존재):
- 마이그레이션 버그 → **완화**: 파서별 순차 마이그레이션, 테스트 우선
- 설정 복잡도 증가 → **완화**: JSON Schema 검증, 명확한 문서

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

| Phase     | 난이도 | 예상 시간     | 비고                              | 상태 |
| --------- | ------ | ------------- | --------------------------------- | ---- |
| Phase 1   | ⭐ 하   | 2-3시간       | DOM 분석은 단순하지만 중요        | ✅ 완료 |
| Phase 2   | ⭐ 하   | 2-4시간       | 익스텐션 기본 구조                | ✅ 완료 |
| Phase 2.5 | ⭐⭐ 중  | 3-4시간       | 테스트 환경 구축                  | ✅ 완료 |
| Phase 3   | ⭐⭐ 중  | 4-6시간       | Scroller 로직이 까다로움          | ✅ 완료 |
| Phase 4.A | ⭐⭐ 중  | 3-5시간       | ChatGPT가 가장 단순               | ✅ 완료 |
| Phase 4.B | ⭐⭐ 중  | 4-6시간       | Gemini Custom elements            | ✅ 완료 |
| Phase 4.C | ⭐⭐⭐ 상 | 6-8시간       | Claude Artifacts + Virtualization | ✅ 완료 |
| Phase 4.D | ⭐ 하   | 1-2시간       | Factory 통합                      | ✅ 완료 |
| Phase 5   | ⭐⭐ 중  | 4-6시간       | 디버깅 시간 포함                  | ✅ 완료 |
| Phase 6   | ⭐ 하   | 2-3시간       | 문서화 (선택 사항)                | ⏸️ 보류 |
| **Phase 7** | **⭐⭐ 중** | **10일 (1-2주)** | **Configuration-Driven 아키텍처** | ⬜ 계획 |
| **총합 (Phase 1-5)** | - | **~30시간** | 약 1주 (파트타임 기준) | ✅ 완료 |
| **총합 (Phase 7 포함)** | - | **~40-50시간** | 약 2-3주 추가 | ⬜ 미착수 |

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
- [x] **Phase 4A: ChatGPT Parser** (2025-11-29 완료)
- [x] **Phase 4B: Gemini Parser** (2025-11-29 완료)
- [x] **Phase 4C: Claude Parser** (2025-11-29 완료)
- [x] **Phase 4D: Factory 통합** (2025-11-29 완료)
- [x] **Phase 5: 통합 테스트** (2025-11-29 완료) ✅
- [ ] Phase 6: 문서화 (선택, 보류)
- [ ] **Phase 7: Configuration-Driven 아키텍처** ← 다음 단계 (선택)
  - [ ] 7.1: Configuration 인프라 구축
  - [ ] 7.2: BaseParser 추상 클래스
  - [ ] 7.3: ChatGPTParser 리팩토링
  - [ ] 7.4: ClaudeParser 리팩토링
  - [ ] 7.5: GeminiParser 리팩토링
  - [ ] 7.6: 검증 도구 & 문서화

---

**현재 상태**: Phase 5 완료 - Extension 사용 가능 ✅

**다음 선택지**:
1. **Phase 7 진행**: UI 변경 대응을 위한 Configuration-Driven 아키텍처로 리팩토링 (1-2주)
2. **Phase 6 진행**: 문서화 및 배포 준비 (2-3시간)
3. **실사용 테스트**: 현재 상태로 실제 환경에서 사용해보며 개선점 발견

💡 **Tip**:
- Phase 7은 **장기 유지보수성**을 위한 투자입니다. 당장 필요하지 않다면 Phase 6 또는 실사용을 먼저 진행해도 됩니다.
- 각 Phase를 완료할 때마다 `git commit`으로 체크포인트를 만드세요.
- Phase 7을 진행한다면, 파서별 순차 마이그레이션을 권장합니다 (ChatGPT → Gemini → Claude).
