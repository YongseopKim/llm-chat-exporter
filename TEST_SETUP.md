# Phase 2.5: 테스트 환경 구축 완료

## 완료된 작업

### 1. 코드 리팩토링 ✅
- `src/utils/background-utils.ts` 생성
- `isSupportedUrl`, `getPlatformName`, `generateFilename` 함수 분리
- `src/background.ts`에서 import하여 사용

### 2. Vitest 설정 ✅
- `vitest.config.ts` 생성
- `tests/setup.ts` 생성 (Chrome API 모킹)
- package.json 스크립트 추가

### 3. 단위 테스트 ✅
- `tests/unit/background-utils.test.ts` 작성
  - isSupportedUrl 테스트 (6개 케이스)
  - getPlatformName 테스트 (4개 케이스)
  - generateFilename 테스트 (5개 케이스)
- `tests/unit/content.test.ts` 작성
  - Chrome API 모킹 검증
  - JSONL 형식 검증
  - ExportResponse 구조 검증

### 4. E2E 테스트 ✅
- `tests/e2e/setup.ts` 생성 (Puppeteer 설정)
- `tests/e2e/export-flow.test.ts` 작성
  - Extension 로딩 검증
  - 플랫폼 URL 검증

### 5. package.json 업데이트 ✅
- 테스트 스크립트 추가
- 의존성 추가 (vitest, jsdom, puppeteer 등)

## 다음 단계: 의존성 설치 및 테스트 실행

### 1. 의존성 설치

터미널에서 다음 명령어를 실행하세요:

```bash
npm install
```

이 명령어는 다음 패키지들을 설치합니다:
- `vitest` - 테스트 러너
- `@vitest/ui` - 브라우저 기반 테스트 UI
- `@vitest/coverage-v8` - 코드 커버리지
- `jsdom` - DOM API 모킹
- `puppeteer` - E2E 테스트 (Chrome 자동화)
- `@types/node` - Node.js 타입 정의

### 2. 빌드 실행

테스트 전에 먼저 빌드를 실행하세요:

```bash
npm run build
```

이 명령어는 `dist/background.js`와 `dist/content.js`를 생성합니다.

### 3. 단위 테스트 실행

```bash
# 전체 테스트 실행
npm test

# 또는 watch 모드로 실행
npm run test:watch

# UI 모드로 실행 (브라우저에서 테스트 확인)
npm run test:ui
```

### 4. 테스트 커버리지 확인

```bash
npm run test:coverage
```

커버리지 리포트는 `coverage/` 디렉토리에 생성됩니다.

### 5. E2E 테스트 실행 (선택)

**주의**: E2E 테스트는 headless: false로 실행되므로 Chrome 창이 열립니다.

```bash
npm test tests/e2e
```

## 디렉토리 구조

```
llm-chat-exporter/
├── src/
│   ├── utils/
│   │   └── background-utils.ts   ✨ 새로 생성
│   ├── background.ts              ♻️  리팩토링
│   └── content/
│       └── index.ts
├── tests/
│   ├── setup.ts                   ✨ Chrome API 모킹
│   ├── unit/
│   │   ├── background-utils.test.ts ✨ 단위 테스트
│   │   └── content.test.ts          ✨ 단위 테스트
│   └── e2e/
│       ├── setup.ts                 ✨ Puppeteer 설정
│       └── export-flow.test.ts      ✨ E2E 테스트
├── vitest.config.ts                ✨ Vitest 설정
├── package.json                    ♻️  스크립트 추가
└── TEST_SETUP.md                   ✨ 이 문서
```

## 예상 테스트 결과

### 성공 시나리오

```bash
$ npm test

 ✓ tests/unit/background-utils.test.ts (15 tests)
   ✓ background-utils (15)
     ✓ SUPPORTED_HOSTS (2)
     ✓ isSupportedUrl (6)
     ✓ getPlatformName (4)
     ✓ generateFilename (5)

 ✓ tests/unit/content.test.ts (5 tests)
   ✓ content script (5)
     ✓ message listener (1)
     ✓ dummy response format (3)
     ✓ export response structure (2)

Test Files  2 passed (2)
     Tests  20 passed (20)
  Start at  10:30:00
  Duration  1.2s
```

## 문제 해결

### npm이 설치되지 않은 경우

Node.js를 먼저 설치하세요:

```bash
# macOS (Homebrew)
brew install node

# 또는 nvm 사용
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

### 테스트 실패 시

1. `dist/` 폴더가 있는지 확인:
   ```bash
   npm run build
   ```

2. Chrome API 모킹 확인:
   - `tests/setup.ts`가 올바르게 로드되는지 확인

3. 타입 오류 시:
   - `tsconfig.json`에 `"types": ["vitest/globals"]` 추가

## 다음 Phase (Phase 3)

테스트 환경이 구축되었으므로, 이제 TDD 방식으로 다음 단계를 진행할 수 있습니다:

1. **Parser 인터페이스 정의** (`src/content/parsers/interface.ts`)
2. **Scroller 유틸리티 구현** (`src/content/scroller.ts`)
3. **HTML → Markdown 변환기** (`src/content/converter.ts`)
4. **JSONL 직렬화** (`src/content/serializer.ts`)

각 유틸리티마다:
1. 테스트 작성 (`tests/unit/[name].test.ts`)
2. 구현 (`src/[name].ts`)
3. 테스트 통과 확인

## 참고 자료

- [Vitest 공식 문서](https://vitest.dev/)
- [Puppeteer 공식 문서](https://pptr.dev/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)
