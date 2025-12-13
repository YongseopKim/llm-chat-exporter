# LLM Chat Exporter

[English](README.md) | **한국어**

ChatGPT, Claude, Gemini 웹 인터페이스의 대화를 JSONL 형식으로 내보내는 Chrome 확장 프로그램입니다.

## 프로젝트 소개

**LLM Chat Exporter**는 ChatGPT, Claude, Gemini 웹 인터페이스의 대화를 API 없이 DOM 파싱으로 추출하여 JSONL 파일로 저장하는 Chrome 확장 프로그램입니다.

### 핵심 가치

- **컨텍스트 보존**: 웹 UI 그대로의 대화 경험 보존
- **로컬 우선**: 모든 처리가 브라우저 내에서 완결
- **데이터 소유권**: 대화 내용을 로컬에 영구 보존

## 사용 방법

1. ChatGPT, Claude, 또는 Gemini에서 대화 페이지 열기
2. `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`) 누르기
3. JSONL 파일 자동 다운로드

## 사용 사례

- LLM 대화를 로컬 지식 베이스로 구축
- 중요한 대화 백업 및 아카이빙
- RAG 파이프라인 입력 데이터로 활용
- 대화 기록 분석 및 학습 자료 활용

## 지원 플랫폼

| 플랫폼 | URL 패턴 |
|--------|----------|
| ChatGPT | `https://chatgpt.com/*` |
| Claude | `https://claude.ai/*` |
| Gemini | `https://gemini.google.com/*` |

## 설치 방법

```bash
git clone https://github.com/YongseopKim/llm-chat-exporter.git
cd llm-chat-exporter
npm install
npm run build
```

Chrome에서 로드:
1. `chrome://extensions/` 이동
2. "개발자 모드" 활성화 (우측 상단 토글)
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `llm-chat-exporter` 폴더 선택

## 개발 명령어

```bash
npm install          # 의존성 설치
npm run build        # 빌드 (TypeScript → JavaScript)
npm run watch        # 감시 모드로 빌드
npm test             # 테스트 실행 (203개 테스트)
npm run test:watch   # 감시 모드로 테스트
npm run validate:selectors # 셀렉터 설정 검증
```

## 출력 형식

### JSONL 스키마

첫 줄은 메타데이터, 이후 줄은 개별 메시지:

```jsonl
{"_meta":true,"platform":"chatgpt","url":"https://chatgpt.com/c/...","exported_at":"2025-11-29T10:00:00Z"}
{"role":"user","content":"RWA 토큰화란 무엇인가요?","timestamp":"2025-11-29T10:00:05Z"}
{"role":"assistant","content":"RWA(실물자산) 토큰화는...","timestamp":"2025-11-29T10:00:10Z"}
```

## 알려진 제한사항

- DOM 구조 변경 시 셀렉터 업데이트 필요
- 이미지는 URL만 저장 (바이너리 다운로드 없음)
- Claude Artifacts는 제한적 지원
- 단일 대화만 내보내기 가능 (배치/히스토리 내보내기 없음)

## 라이선스

MIT License

Copyright (c) 2025

이 프로젝트는 개인 사용 목적입니다. ChatGPT, Claude, Gemini의 이용약관을 준수해 주세요.

---

**소중한 AI 대화를 보존하기 위해 만들었습니다**
