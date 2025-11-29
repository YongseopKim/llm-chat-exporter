# LLM Chat Exporter

> ChatGPT, Claude, Gemini 웹 UI의 대화를 단축키 하나로 로컬에 아카이빙하는 Chrome Extension

## 프로젝트 개요

**LLM Chat Exporter**는 ChatGPT, Claude, Gemini 웹 인터페이스에서 진행한 대화를 API 없이 DOM 파싱으로 추출하여 JSONL 파일로 저장하는 개인용 크롬 익스텐션입니다.

### 핵심 가치

- **Context Preservation**: API가 아닌 웹 UI 그대로의 대화 경험을 보존
  - 각 서비스가 최적화한 시스템 프롬프트 그대로
  - 웹 UI에서만 제공되는 리치 포맷팅(코드 블록, 테이블 등) 보존
- **Local-First**: 모든 처리가 브라우저 내에서 완결, 외부 서버 전송 없음
- **Data Ownership**: 대화 내용을 로컬 자산으로 영구 소유

### 사용 사례

- LLM 대화를 로컬 지식 베이스로 구축
- 중요한 대화 내용을 백업/아카이빙
- 추후 RAG(Retrieval-Augmented Generation) 파이프라인의 입력 데이터로 활용
- 대화 기록 분석 및 학습 자료 활용

---

## 주요 기능

### 지원 플랫폼

- **ChatGPT**: `https://chatgpt.com/*`
- **Claude**: `https://claude.ai/*`
- **Gemini**: `https://gemini.google.com/*`

### 핵심 기능

- **단축키 트리거**: 지정한 단축키(예: `Ctrl+Shift+E`)로 즉시 저장
- **DOM Virtualization 대응**: 스크롤로 전체 대화를 로딩하여 빠짐없이 수집
- **Markdown 변환**: 코드 블록, 테이블, 리스트 등을 Markdown 포맷으로 정확히 변환
- **타임스탬프 보존**: 가능한 경우 메시지별 실제 작성 시각 기록
- **현재 대화만 저장**: 열려있는 단일 대화 세션만 대상 (히스토리 전체 X)

---

## 출력 형식

### JSONL 스키마

각 라인은 하나의 메시지를 나타내는 JSON 객체입니다.

```jsonl
{"role": "user", "content": "RWA 토큰화의 기술적 난관은?", "timestamp": "2025-11-28T10:00:00Z"}
{"role": "assistant", "content": "RWA(Real World Asset) 토큰화의 핵심 난관은 다음과 같습니다:\n\n1. **법적 규제**\n   - 각국의 증권법 적용 여부\n   - 토큰 소유권의 법적 효력\n\n2. **온체인-오프체인 동기화**\n   - 실물 자산 상태와 블록체인 기록 일치\n   - Oracle 문제", "timestamp": "2025-11-28T10:00:05Z"}
```

### 필드 정의

| 필드        | 타입                      | 설명                            |
| ----------- | ------------------------- | ------------------------------- |
| `role`      | `"user"` \| `"assistant"` | 메시지 발신자 (정규화된 값)     |
| `content`   | string                    | Markdown 변환된 메시지 본문     |
| `timestamp` | ISO 8601 string           | 메시지 작성 시각 또는 저장 시각 |

### 선택적 메타데이터 (향후 확장)

- `platform`: `"chatgpt"` | `"claude"` | `"gemini"`
- `url`: 대화 페이지 URL
- `title`: 대화 제목 (파싱 가능 시)
- `message_index`: 메시지 순번

---

## 설치 및 사용법

### 설치 (예정)

```bash
# 저장소 클론
git clone https://github.com/yourusername/llm-chat-exporter.git

# Chrome 익스텐션 로드
# 1. chrome://extensions/ 접속
# 2. "개발자 모드" 활성화
# 3. "압축해제된 확장 프로그램을 로드합니다" 클릭
# 4. llm-chat-exporter 폴더 선택
```

### 사용법 (예정)

1. ChatGPT/Claude/Gemini 대화 페이지를 엽니다
2. 단축키(기본값: `Ctrl+Shift+E`)를 누릅니다
3. 파일 저장 다이얼로그에서 저장 위치를 선택합니다
4. `{platform}_YYYYMMDDTHHMMSS.jsonl` 파일이 생성됩니다

---

## 기술 스택

- **Chrome Extension Manifest V3**
- **TypeScript 5.9.3** + **esbuild**: 빌드 시스템
- **Strategy Pattern**: 사이트별 파서 모듈화
- **Turndown**: HTML → Markdown 변환
- **Vitest**: 단위 테스트 프레임워크
- **Puppeteer**: E2E 테스트 (Chrome 자동화)

---

## 프로젝트 상태

🚀 **Phase 4D 완료 - 다음은 Phase 5: 통합 테스트** 🚀

**최근 완료** (2025-11-29):
- ✅ ChatGPT, Claude, Gemini 파서 구현 완료
- ✅ Factory 패턴 통합
- ✅ 162개 테스트 통과
- ✅ Extension 빌드 성공

- [x] 요구사항 정의
- [x] 아키텍처 설계
- [x] **Phase 1: DOM 셀렉터 검증 완료** (2025-11-29)
  - ChatGPT, Claude, Gemini 샘플 HTML 구조 분석
  - 안정적인 셀렉터 우선순위 결정
  - Fallback 전략 수립
  - 실제 사이트에서 콘솔 검증 완료 (3개 플랫폼 모두 10개+ 메시지 추출 성공)
  - [검증 결과 문서](./docs/phase1-validation-results.md)
- [x] **Phase 2: 익스텐션 골격 구현 완료** (2025-11-29)
  - TypeScript + esbuild 빌드 환경 구축
  - manifest.json (Manifest V3)
  - Background Script (Service Worker) - 단축키 리스너, 동적 Content Script 주입
  - Content Script - 더미 데이터 반환
  - 단축키(Ctrl+Shift+E)로 더미 JSONL 다운로드 성공
- [x] **Phase 2.5: 테스트 환경 구축 완료** (2025-11-29)
  - Vitest 설정 및 Chrome API 모킹
  - 단위 테스트: background-utils (16개), content (6개)
  - E2E 테스트: Puppeteer 설정 (6개)
  - **전체 28개 테스트 통과, 유틸리티 커버리지 100%**
  - [테스트 설정 문서](./TEST_SETUP.md)
- [x] **Phase 3: 핵심 유틸리티 구현 완료** (2025-11-29)
  - **Risk-first validation**: 브라우저 테스트로 기술 검증 (Shadow DOM 불필요 확인 → 2시간 절약)
  - Parser interface & factory (Strategy 패턴)
  - JSONL serializer (9 tests)
  - HTML→Markdown converter with Turndown + custom rules (19 tests)
  - Simplified scroller (fallback 버전, 7 tests)
  - Integration tests (6 tests)
  - **전체 82개 테스트 통과** (목표 40+의 205% 달성)
  - Content script 통합 완료, 브라우저 테스트 성공
  - [검증 결과 문서](./validation-results.md)
- [x] **Phase 4: 사이트별 파서 구현 완료** (2025-11-29) ✅
  - ChatGPTParser ✅ (240 lines, 28 tests)
  - ClaudeParser ✅ (322 lines, 28 tests)
  - GeminiParser ✅ (270 lines, 28 tests)
  - Factory Integration ✅ (4 tests)
  - **전체 162개 테스트 통과**
- [ ] **Phase 5: 통합 테스트 및 엣지 케이스 처리** ← 다음

---

## 문서

### 설계 문서
- [DESIGN.md](./DESIGN.md) - 아키텍처 및 기술 상세
- [PLAN.md](./PLAN.md) - 개발 로드맵 및 작업 계획
- [CLAUDE.md](./CLAUDE.md) - Claude Code용 프로젝트 컨텍스트

### 분석 자료
- [samples/README.md](./samples/README.md) - 플랫폼별 DOM 구조 분석 결과 ⭐
  - 검증된 셀렉터 목록
  - 토큰 절약 분석 방법론
  - 콘솔 테스트 스크립트

### 참고 자료
- [docs/](./docs/) - 각 AI의 초기 설계 제안서

---

## 라이센스

MIT License

Copyright (c) 2025

본 프로젝트는 개인 사용 목적으로 제작되었습니다. ChatGPT, Claude, Gemini의 이용 약관을 준수하여 사용하시기 바랍니다.

---

## 기여

이 프로젝트는 개인 프로젝트이지만, 이슈 제보와 개선 제안은 환영합니다.

### 알려진 제약사항

- DOM 구조 변경 시 파서 수정 필요
- Shadow DOM을 사용하는 컴포넌트의 경우 추가 처리 필요
- Claude Artifacts 등 별도 패널의 콘텐츠는 제한적 지원
- 이미지는 URL만 저장 (바이너리 다운로드 미지원)

---

**Made with ❤️ for preserving valuable AI conversations**
