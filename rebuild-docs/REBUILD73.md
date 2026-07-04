# REBUILD73 — AI 해설 429 안내 개선 + 프롬프트 인스펙터 (전송 프롬프트 확인·수정)

> **작성**: 2026-07-03 KST
> **범위**: `api/kisa-attempt.js`, `src/tabs/KisaTab/ResultOverlay.jsx`
> **목적**: ① AI 추가 해설의 "Gemini 429: Your prepayment credits are depleted" 에러의 원인 규명과 사용자 안내 개선, ② AI 해설 생성 시 API 로 전송되는 **모든 프롬프트·상태를 접기/펼치기로 확인하고 항목별로 수정**할 수 있는 프롬프트 인스펙터 신설.

---

## §1. 429 에러 원인

- 증상: AI 추가 해설에서 Gemini 선택 시 `Gemini 429: Your prepayment credits are depleted. Please go to AI Studio …` 노출.
- 원인: **코드 결함이 아니라 Google AI Studio 계정의 선불 크레딧 소진**. REBUILD67 BYOK 로 해석된 Gemini API 키(공용 또는 개인)의 결제 잔액이 0 — Google 이 429 + 해당 메시지를 반환하고, 서버가 원문 그대로 SSE error 로 전달하고 있었다.
- 조치(운영): AI 설정에서 해당 키를 크레딧이 있는 키로 교체하거나 AI Studio 에서 충전. 코드로 해결할 수 없는 영역.
- 조치(코드): `friendlyLlmError(provider, status, detail)` 신설 — 3사 공통으로 429(크레딧/쿼터 소진 vs 단순 rate limit 구분), 401/403(키 무효)을 **한국어 행동 안내**로 변환해 SSE error 로 전달. 원문 메시지는 괄호로 보존.

## §2. 프롬프트 인스펙터

### 서버 (`api/kisa-attempt.js`)
- `buildExplainPrompt(q)` 분리 — llm-explain(생성)과 신설 조회 액션이 동일 조립 로직 공유 (중복 제거).
- **`GET ?action=explain-prompt&question_id&provider`** 신설 — 전송될 `system_prompt`/`user_prompt`/`model`/`temperature`/`max_output_tokens`/`transport`(프로바이더별 전송 구조)를 그대로 반환.
- **`POST ?action=llm-explain` 에 `overrides` 지원** — `{ system_prompt, user_prompt, model, temperature, max_output_tokens }` 중 수정된 항목만 받아 기본값 대체. `sanitizeOverrides` 로 길이(8k/16k)·범위(temp 0~2, 토큰 256~8192)·모델명 형식(`^[\w.\-]{3,64}$`) 검증. 저장 시 model 컬럼에 실제 사용 모델 기록.
- `streamGemini/streamOpenAI/streamClaude` 에 `opts {model, temperature, maxTokens}` 파라미터 추가 (기본값 기존과 동일).

### 클라이언트 (`ResultOverlay.jsx`)
- AI 추가 해설 박스 하단에 **"⚙️ 전송 프롬프트 확인·수정"** 접기/펼치기 신설. 펼치면 `explain-prompt` 조회 후 `PromptInspector` 렌더.
- 항목별 접기/펼치기 + 수정:
  - 📡 요청 상태 — provider · 생성 중/저장본/오류 · 전송 구조 (읽기 전용)
  - 🎛️ 모델·생성 파라미터 — model / temperature / 최대 출력 토큰 (수정 가능)
  - 🧭 시스템 프롬프트 — textarea (수정 가능)
  - 📝 사용자 프롬프트(문제 데이터) — textarea (수정 가능)
- **수정된 항목만** `overrides` 로 전송(기본값과 같아지면 자동 해제, "수정됨 N" 배지). 수정 상태로 생성하면 `force_new` 강제 → 저장본 캐시 대신 항상 새로 생성.
- 프로바이더 전환 시 기본값 재조회 + model override 초기화(타사 모델명 오전송 방지). "↩️ 기본값 복원" 버튼.

## §3. 검증

- `node -e "require('./api/kisa-attempt.js')"` 모듈 로드 정상 (auth secret 경고는 로컬 env 부재로 정상).
- `npm run build:fe` 정상.

## §4. 함께 정리한 것 — 미커밋 백로그 일괄 커밋

REBUILD56~66 세션들의 소스가 다수 **untracked** 상태로 남아 있었다 (`library-jssec2023` 37파일, `library-kisec2026` 전체, `TheoryList/TheoryDetail/DiagramQuiz/PracticeDetail`, `MarkdownLite`, `kisa-practice.json`, `scripts/build-kisa-practice.mjs` 외, REBUILD56~66 문서). KisaTab 라우팅이 참조하는 파일이 저장소에 없어 **클린 체크아웃 빌드가 깨지는 상태**였으므로, 본 작업 직전에 백로그 전체를 별도 커밋으로 반영했다.

---

## §6. 후속 수정 — codeid(코드식별) AI 해설에 예시 코드 누락 (같은 날)

- **증상**: 코드예시 문항의 AI 추가 해설이 일반론만 생성.
- **근본 원인**: `buildExplainPrompt` 가 mcq(선택지)·diagnosis4(취약코드)만 분기하고 **codeid 분기가 없어**, codeid 의 body(일반 안내문)와 약점 분류만 전송 — 예시 코드(`vulnerable_code`)·4지선다 보기(`choices`)·정답(약점 + 안전/취약 판정)이 프롬프트에 전혀 포함되지 않았다.
- **수정**:
  - codeid 전용 분기 추가 — [예시 코드(언어)] + [보기—보안약점 ①~④] + [정답 ①약점 ②안전/취약 판정] + [기본 해설(참고), 1500자 절단] 포함.
  - codeid 전용 시스템 프롬프트 — 정답/판정 근거(코드 라인·API)/약점 원리/공격 시나리오·안전한 이유/안전한 구현/관련 용어 형식.
  - `[약점 분류]` 코드 표기: codeid 는 chapter_code 가 시드키(CQ-XXXX)라 weakness_code(IMP-XX) 우선.
  - ResultOverlay 안내 문구 맵에 codeid 추가.
- **캐시 정리**: 코드 없는 프롬프트로 이미 생성·저장된 codeid 해설 5건을 DB 에서 삭제 (재생성 유도).
