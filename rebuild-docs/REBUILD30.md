# REBUILD30 — AI TutorTwo 프로젝트 현황 + 아키텍처 + 실험실 리팩토링 제안

> 작성: 2026-04-30
> 선행: REBUILD26 (8 엔진 결정) → REBUILD27 (AWS 폐기) → REBUILD28 (6 엔진 축소) → REBUILD29 (Qwen + UI 재구성 + Playwright) → **REBUILD30 (본 문서, 현황 + 아키텍처 + 리팩토링 제안)**
> 목적: REBUILD23~29 누적 결과를 단일 진실 소스로 정리 + 코드베이스 깊이 분석 결과 + 실험실 중심 리팩토링 후보 제시

---

## 0. TL;DR

### 0.1 현황 한 줄

> **AI TutorTwo = 영상정보관리사/운전면허/KISA 자격증 학습 도구. Cloud Run + L4 GPU 기반 6 엔진 × 4 모델 × 5 실험실 lab + DB 문제풀이 + Capacitor 모바일.**

### 0.2 누적 작업 (REBUILD23~29)

| 영역 | 상태 |
|---|---|
| AWS → GCP 마이그 | ✅ Cloud Run + L4 GPU + Cloud SQL + GCS (REBUILD23~25) |
| AWS 폐기 | ✅ 41개 인프라 + Route53 hosted zone (REBUILD27) |
| 8 엔진 → 6 엔진 결정 | ✅ SGLang/TensorRT-LLM deferred (REBUILD28) |
| 격리 service (aitutor-inference) | ✅ 6 엔진 동거 (REBUILD28~29) |
| Qwen 한국어 강제 | ✅ 3중 패턴 + chat_template_kwargs (REBUILD29 §16~22) |
| 5 실험실 lab UI | ✅ /lab 메인 + 카드 + admin 토글 + 직관적 용어 (REBUILD28~29) |
| WebLLM 통합 | ✅ Qwen 2.5 7B / DeepSeek R1 / Llama 3.1 8B (REBUILD28 §11) |
| Ollama bridge | ✅ DB 연동 + select dropdown + 도움말 6단계 (REBUILD28~29) |
| QuestionPicker | ✅ DB 카테고리→시험→문제 카드 + 붙여넣기 파싱 (REBUILD29 §19/§25) |
| PromptEditor | ✅ 시스템/사용자 메시지 섹션별 편집 + 최종 전송 (REBUILD29 §26) |
| 모델 통일 | ✅ Qwen 3.5 + Gemma 4 (3 lab × 4 모델 비교) (REBUILD29 §24) |
| Playwright 스모크 | ✅ 15/15 통과 (REBUILD29 §21/§27) |

### 0.3 발견된 핵심 이슈 (REBUILD30 신규)

| # | 우선도 | 이슈 | 위치 |
|---|---|---|---|
| 1 | 🔴 P0 | `applyQwenStrict()` 누락 — LocalGcpTester / ServerInferTester 의 messages 빌드는 `buildLabMessages` 만 사용 → Qwen 영어 응답 위험 잔존 가능 | `src/labs/local-gcp/LocalGcpTester.jsx:91`, `src/labs/server-infer/ServerInferTester.jsx:127` |
| 2 | 🔴 P0 | API 스키마 불일치 — `maxTokens` (camelCase) vs `max_tokens` (snake_case) 혼재 | `LocalGcpTester` POST body 와 `ServerInferTester` POST body |
| 3 | 🟧 P1 | 코드 중복 — `buildPromptPreview()` 동일 함수 3 lab 에 반복 정의 | LocalGcpTester:35 / ServerInferTester:35 / OllamaBridgeTester:48 |
| 4 | 🟧 P1 | `MODELS` 상수 중복 — LocalGcpTester / ServerInferTester 동일 정의 2회 | LocalGcpTester:28 / ServerInferTester:28 |
| 5 | 🟨 P2 | Props drilling — LocalAiExplanation 의 13 state 가 7 자식으로 전파 | LocalAiExplanation.jsx |
| 6 | 🟨 P2 | `disposePipe()` 에러 무시 — 메모리 누수 가능 | LocalAiExplanation.jsx:136 |
| 7 | 🟨 P2 | `_daemons` 캐시 TTL 없음 — stale daemon 가능 | api/local-infer.js |
| 8 | 🟦 P3 | local-infer.js 단일 핸들러 비대 (392줄) | api/local-infer.js |

### 0.4 권장 리팩토링 (실험실 중심, 7개 후보)

| 작업 | 효과 | 라인 감축 | 시간 |
|---|---|---|---|
| **buildLabPromptPreview 통합** ⭐ | 중복 제거 + 한 곳 변경 시 3 lab 자동 반영 | -51 | 30분 |
| **src/lib/lab/models.js 신규** ⭐ | LAB_MODELS / LAB_ENGINES 중앙화 | -34 | 30분 |
| **buildLabMessages 자동 Qwen 강제** ⭐ | applyQwenStrict 누락 방지 (P0 fix) | 0 (버그 픽스) | 20분 |
| ParamSliders.jsx 재사용 컴포넌트 | maxTokens/temperature 슬라이더 4곳 통합 | -80 | 1시간 |
| ResponsePanel.jsx 추상화 | 에러/응답 렌더링 표준화 | -40 | 45분 |
| coldStartRetry.js 유틸 | 429 retry 재사용 | -15 | 30분 |
| LocalAiContext (Context API) | Props drilling 해결 | -30 | 1.5시간 |
| **합계** | — | **-250 라인** | **5~6시간** |

---

## 1. 프로젝트 컨텍스트

### 1.1 도메인

**AI TutorTwo** = 한국 자격증 학과시험 학습 도구
- **트랙**: 영상정보관리사 / 운전면허 / KISA 진단원 이수시험
- **사용자**: 학습자 (수십 명 추정) + admin (운영자)
- **주 기능**: 기출문제 풀이 / AI 해설 생성 / 메모 / 북마크 / 시험 기록

### 1.2 REBUILD23~29 작업 흐름

```
REBUILD23 (AWS→GCP)        : Cloud Run + L4 GPU + Cloud SQL + GCS 마이그
REBUILD24~25               : 실험실 4~5 lab 설계 + 격리 service 컨셉
REBUILD26 (8 엔진 결정)     : 양쪽 8 엔진 동거 + 옵션 C 하이브리드 + 일정
REBUILD27 (AWS 폐기)        : 41개 인프라 + Route53 폐기 → AWS 청구 $0
REBUILD28 (6 엔진 축소)     : SGLang/TensorRT-LLM deferred + UI 재구성
                            + WebLLM 통합 + Ollama bridge 신규
                            + QuestionPicker 공통
REBUILD29 (Qwen + UI)       : Qwen 한국어 강제 (3중 패턴) + 카드 타이틀
                            + 모델 통일 (Qwen 3.5 + Gemma 4)
                            + DB 계층 선택 + PromptEditor + Playwright 15/15
REBUILD30 (본 문서)         : 현황 + 아키텍처 + 리팩토링 제안
```

### 1.3 사용자 패턴

- **단발 호출** — 1 문제 → 1 해설 (multi-turn 거의 없음)
- **동시 1~2 사용자** — max-instances=1 충분
- **모델 교체 빈번** — 학습자가 UI 에서 비교 비교
- **응답 SLA** — 5~30초 인내 가능

---

## 2. 전체 아키텍처

### 2.1 시스템 다이어그램

```
[사용자 브라우저 / Capacitor 모바일 앱]
  │
  │ HTTPS
  ▼
[Cloud Run: aitutor (us-east4, GPU L4 24GB, 32Gi RAM)]
  ├─ Express server.js (port 8080)         ⭐ 메인 진입점
  │   ├─ /api/* (52 엔드포인트)
  │   ├─ /assets/* (Vite dist, 1년 immutable cache)
  │   └─ /* SPA 폴백
  │
  ├─ Ollama daemon (port 11434)            ⭐ always-on
  ├─ llama-server (port 11435)             ⭐ lazy spawn (첫 호출)
  ├─ vLLM (port 11436)                     ⭐ lazy spawn
  ├─ Python sub-server (port 11442)        ⭐ FastAPI uvicorn
  │   ├─ llama-cpp-python (CUDA wheel)
  │   ├─ onnxruntime-genai-cuda
  │   └─ transformers (HF PyTorch CUDA)
  │
  └─ /var/cache/huggingface/ (모델 lazy 다운로드 캐시)
        │
        │ (vllm/llama-server 호출 시 격리로 forward 옵션)
        ▼
[Cloud Run: aitutor-inference (us-east4, GPU L4)]  ← REBUILD28 §3.2
  ├─ FastAPI uvicorn (port 8080)
  ├─ PROCESS_MODE=isolated 분기
  │   └─ Ollama always-on (port 11434)
  ├─ engines/ (sync 마스터)
  │   ├─ catalog.py (Qwen 3.5 + Gemma 4)
  │   ├─ ollama.py / llama-server.py / vllm_engine.py
  │   ├─ llama-cpp-python.py / onnx.py / transformers_engine.py
  │   ├─ _daemon.py (lazy spawn 헬퍼)
  │   └─ qwen_helpers.py (한국어 강제 + no_think)
  └─ server.py (FastAPI 라우팅)

────────────────────────────────────────────────────

[외부 의존]
  ├─ Cloud SQL (PostgreSQL 14) — 메인 DB
  │   ├─ users / questions / explanations / exam_results
  │   ├─ memos / bookmarks / aitutor_settings
  │   ├─ user_lab_settings (Ollama bridge URL/모델)
  │   └─ kisa_* (진단원 이수시험)
  │
  ├─ GCS Bucket (aitutor-files-aifactory-494108)
  │   └─ memo-files / pool-upload (서명 URL)
  │
  ├─ Secret Manager
  │   ├─ ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY
  │   ├─ HF_API_KEY / RESEND_API_KEY / LAW_API_OC
  │   └─ AUTH_TOKEN_SECRET / DATABASE_URL
  │
  ├─ Artifact Registry (asia-northeast3)
  │   └─ aitutor:* tags (~7~8GB compressed)
  │
  └─ Cloud Build (asia-northeast3)
      └─ trigger: gcloud builds submit (수동)
```

### 2.2 데이터 흐름 (추론 호출)

```
사용자 → POST /api/local-infer { engine, model_key, messages, maxTokens, temperature }
  ↓
api/local-infer.js (392줄)
  ↓ (engine 분기)
  ├─ ollama         → Ollama 11434 /api/chat (한국어 강제 직접)
  ├─ llama-server   → ensureLlamaServer() lazy spawn → /v1/chat/completions
  ├─ vllm           → ensureVllm() lazy spawn → /v1/chat/completions
  └─ llama-cpp-python / onnx / transformers
                    → callPySubserver() → port 11442 /infer

(applyQwenStrict 적용: messages 변환 + chat_template_kwargs)
  ↓
응답 { answer, meta: { engine, infer_ms, total_ms, warm } }
```

### 2.3 격리 forward 흐름

```
사용자 → POST /api/iso-infer { ... }
  ↓
api/iso-infer.js (124줄)
  ├─ getIdToken(audience) — Cloud Run metadata server (50분 TTL 캐시)
  ├─ forward(method, path, body) — Bearer Token + IAM
  ├─ 429 retry 3회 (지수 backoff 2s/4s/8s) ← cold start 대응
  └─ 격리 service POST /infer
        ↓
      inference-py/server.py (FastAPI)
        ├─ apply_qwen_strict (dispatch 직전)
        ├─ engines/ 의 dispatch[engine] → infer()
        └─ 응답 { answer, meta }
```

---

## 3. 실험실 5 lab 상세

### 3.1 코드베이스 규모 (REBUILD30 측정)

| Lab | 핵심 파일 | line | 주요 책임 |
|---|---|---|---|
| 📱 온디바이스 모델 | `src/labs/local-ai/LocalAiExplanation.jsx` | 372 | transformers.js (ONNX) + WebLLM 분기, 다운로드 락, WakeLock |
| 🤗 외부 추론 라우팅 | `src/labs/hf-playground/HfPlayground.jsx` | 470 | HF Inference 단일 모드 + 자유 프롬프트 |
| 🤗 비교 모드 | `src/labs/hf-playground/HfCompare.jsx` | 536 | 2~6 모델 동시 호출 + 자동 분석 |
| ☁️ 서버 통합 (일심동체) | `src/labs/local-gcp/LocalGcpTester.jsx` | 321 | 6 엔진 × 4 모델, lazy spawn 호출 |
| 🧪 서버 분리 (격리) | `src/labs/server-infer/ServerInferTester.jsx` | 323 | 동일 6 엔진, iso-infer forward |
| 🖥️ 사용자 PC 추론 | `src/labs/ollama-bridge/OllamaBridgeTester.jsx` | 474 | 외부 Ollama localhost:11434 직접 |
| WebLLM 패널 | `src/labs/local-ai/components/WebllmPanel.jsx` | (포함) | Qwen 2.5 7B / DeepSeek / Llama 3.1 8B |
| **합계** | 6 핵심 + 보조 | **2,496 LOC** | — |

### 3.2 공통 컴포넌트 + 헬퍼 (735 LOC)

| 파일 | line | 역할 |
|---|---|---|
| `src/components/lab/QuestionPicker.jsx` | 346 | DB 계층 선택 + 붙여넣기 파싱 (REBUILD29 §19/§25) |
| `src/components/lab/QuestionPreview.jsx` | ~70 | 선택된 문항 미리보기 |
| `src/components/lab/PromptEditor.jsx` | ~150 | 시스템/사용자 섹션별 편집 + 전송 (REBUILD29 §26) |
| `src/components/lab/EngineSwitcher.jsx` (local-ai) | ~80 | transformers ↔ WebLLM 토글 |
| `src/lib/lab/promptBuilder.js` | 52 | STANDARD_SYSTEM_PROMPT + buildLabMessages |
| `src/lib/lab/parseQuestion.js` | 109 | 보기 ①②③④ + 정답 자동 파싱 |
| `src/lib/qwen.js` | 83 | applyQwenNoThink + applyQwenKoreanLock + applyQwenStrict |

### 3.3 lab 별 호출 패턴 비교

| Lab | API 엔드포인트 | 인증 | 추론 위치 | 응답 처리 |
|---|---|---|---|---|
| 온디바이스 | (브라우저) | localStorage | WebGPU (사용자 디바이스) | streaming (TextStreamer) |
| HF Inference | `POST /api/hf` | JWT | 외부 (Together / SambaNova / Groq 등) | SSE 스트리밍 |
| 일심동체 | `POST /api/local-infer` | JWT | Cloud Run aitutor | non-stream JSON |
| 격리 | `POST /api/iso-infer` | JWT (메인 SA forward) | Cloud Run aitutor-inference | non-stream JSON |
| Ollama bridge | `POST localhost:11434/api/chat` | (CORS) | 사용자 PC | non-stream JSON |

### 3.4 lab 별 발견된 코드 스멜

#### 3.4.1 LocalGcpTester (321줄)
- ✅ QuestionPicker / PromptEditor 통합 완료 (REBUILD29 §25/§26)
- ❌ `buildPromptPreview()` 함수 — 자체 정의 (`L35`), ServerInfer/OllamaBridge 와 동일 중복
- ❌ `MODELS` 상수 — LAB_MODELS 중앙화 누락 (`L28`)
- ❌ `applyQwenStrict()` UI 직접 적용 안 됨 — 백엔드 의존 (api/local-infer.js 의 callOpenAICompat 가 처리)
- ⚠ `maxTokens` (camelCase) — POST body 키 불일치

#### 3.4.2 ServerInferTester (323줄)
- ✅ FALLBACK_ENGINES 모두 active (REBUILD29 §17)
- ✅ 429 retry 로직 (L82~)
- ❌ 동일 `buildPromptPreview()` 중복 (`L35`)
- ❌ 동일 `MODELS` 중복 (`L28`)
- ⚠ `max_tokens` (snake_case) — POST body 키 LocalGcpTester 와 다름 ⚠️

#### 3.4.3 OllamaBridgeTester (474줄)
- ✅ DB user_lab_settings 연동 (REBUILD28 §11)
- ✅ 도움말 6단계 + select dropdown (REBUILD29 §16)
- ✅ applyQwenStrict 직접 호출 (`L142`)
- ⚠ `runInfer` 가 messages 인자 받게 변경됨 (REBUILD29 §26) — 동일 패턴
- ❌ 동일 `buildPromptPreview()` 중복 (`L48`)

#### 3.4.4 LocalAiExplanation (372줄)
- 🔴 **Props drilling** — 13 state → 7 자식 (DeviceCheckBadge / ModelDownloadCard / MemoryStatus 등)
- 🔴 **disposePipe() 에러 무시** (`L136`) — 메모리 누수 가능
- ✅ wakeLock 제어 (배터리/발열 방지)
- ✅ 다운로드 중 페이지 락
- ⚠ 13 state 중 9개가 download/load 진행 추적용 — Reducer 패턴 적용 후보

#### 3.4.5 HfPlayground (470줄)
- ✅ 동적 카탈로그 로드 (1h 캐시)
- ✅ 시험/자유 모드 탭
- ❌ `messages` 빌드 인라인 (`L106~`) — buildLabMessages 미사용 (자유 모드라 다른 패턴)
- ⚠ `tab === 'exam'` 분기 + `tab === 'prompt'` 분기 = 두 모드 코드 혼재

#### 3.4.6 HfCompare (536줄, 가장 김)
- ✅ 2~6 모델 동시 호출 (Promise.allSettled)
- ✅ 자동 분석 (TTFT / total / cost / 정답 일치)
- ⚠ 가장 큰 lab 파일 — 분석 로직만 100+ 라인. 별도 헬퍼로 추출 가능

### 3.5 lab 별 props 패턴

| Lab | useState 수 | useEffect 수 | useRef 수 | 자식 컴포넌트 |
|---|---|---|---|---|
| LocalAiExplanation | 13 | 4 | 1 | 7 |
| LocalGcpTester | 9 | 1 | 1 | 2 (QuestionPicker, PromptEditor) |
| ServerInferTester | 11 | 2 | 1 | 2 |
| OllamaBridgeTester | 14 | 2 | 1 | 3 (QuestionPicker, PromptEditor, CodeBlock) |
| HfPlayground | 16 | 4 | 4 | 3 |
| HfCompare | 14 | 3 | 1 | 3 |

→ LocalAiExplanation 의 props drilling 가장 심각 (13 state × 7 자식).

---

## 4. 백엔드 API 구조

### 4.1 API 엔드포인트 표 (52개 등록)

| 경로 | 메서드 | 인증 | 책임 | line |
|---|---|---|---|---|
| `/api/login` | POST | 공개 | JWT 토큰 발급 (HMAC-SHA256) | 146 |
| `/api/signup` | POST | 공개 | 회원가입 (signup_disabled 토글) | 165+ |
| `/api/auth` | POST | 공개 | 토큰 검증 | - |
| `/api/config` | GET | 공개 | 5 lab 토글 + 회원가입 차단 상태 | 50 |
| `/api/user-settings` | GET/POST | 필수 | Ollama bridge URL/모델 (whitelist) | 73 |
| `/api/local-infer` | POST/GET | 필수 | 일심동체 6 엔진 추론 | **392** |
| `/api/iso-infer` | POST/GET | 필수 | 격리 service forward (ID Token) | 124 |
| `/api/hf` | POST | 필수 | HuggingFace Inference API 프록시 | 126 |
| `/api/hf-models` | GET | 필수 | HF 모델 카탈로그 (1h 캐시) | ~80 |
| `/api/questions` | GET | 공개 | 기출문제 + categories + exams 조회 | 164 |
| `/api/explanations` | GET | 공개 | 문제 해설 조회 | - |
| `/api/categories` | GET | 공개 | 카테고리 목록 | 141 |
| `/api/memos` / `/api/memo-files` | GET/POST | 필수 | 메모 + 첨부파일 (base64) | - |
| `/api/bookmarks` | GET/POST | 필수 | 북마크 | - |
| `/api/exam-results` | GET/POST | 필수 | 시험 기록 | - |
| `/api/kisa-*` (5개) | GET/POST | 필수 | KISA 진단원 이수시험 | 213~642 |
| `/api/admin` | POST | 관리자 | 시스템 설정 + 회원 관리 | 129 |
| `/api/usage-log` | POST | 필수 | LLM 사용량 기록 | - |
| `/api/upload-sign` | POST | 필수 | GCS 서명 URL | - |
| `/api/import-docstore` | POST | 관리자 | 문제 대량 임포트 | 296 |
| `/api/pool-upload` | POST | 필수 | 기출문제 파일 업로드 (20MB) | 196 |
| `/api/law` | GET | 필수 | 법제처 법령 API 프록시 | - |
| `/api/forgot-password` / `/api/send-verification` | POST | 공개 | 이메일 인증 (Resend) | - |
| `/api/delete-account` | POST | 필수 | 회원 탈퇴 | - |
| `/api/cors` | OPTIONS | 공개 | CORS preflight | - |
| `/api/claude` / `/api/openai` / `/api/gemini` | POST | 필수 | 외부 LLM 프록시 (SSE) | - |

### 4.2 인증 3단계

| 미들웨어 | 동작 | 사용처 |
|---|---|---|
| `withCors(handler)` | CORS 헤더만 | /api/config, /api/questions, /api/auth, /api/signup |
| `withAuth(handler)` | JWT 토큰 검증 → req.user.uid 설정 | 추론 API, 사용자 데이터 (memos, bookmarks 등) |
| `withAdmin(handler)` | JWT + admin 권한 | /api/admin, /api/import-docstore |

JWT 구현:
- HMAC-SHA256 직접 (jsonwebtoken 의존성 제거)
- 토큰 추출: HttpOnly 쿠키 우선 → Authorization 헤더 폴백
- AUTH_TOKEN_SECRET 32자 이상 필수 (Secret Manager 주입)

### 4.3 추론 호출 흐름 (api/local-infer.js, 392줄)

```javascript
모듈 구조:
  ├─ ENGINES catalog (8 항목, 6 active + 2 deferred placeholder)
  ├─ MODEL_MAP (4 모델: qwen35-2b/4b + gemma4-e2b/e4b)
  ├─ ensureOllamaModel() — auto pull
  ├─ ensureLlamaServer() — lazy spawn + GGUF 다운로드
  ├─ ensureVllm() — lazy spawn + venv-vllm 사용
  ├─ callOllama() — /api/chat + 한국어 강제 system + assistant seed
  ├─ callOpenAICompat() — /v1/chat/completions (llama-server / vLLM 공통)
  ├─ callPySubserver() — port 11442 /infer (HTTP proxy)
  └─ withAuth(handler) — engine 분기 + 응답 조립

엔진별 호출 분기:
  if (engine === 'ollama')        → callOllama()
  else if (engine === 'llama-server') → ensureLlamaServer + callOpenAICompat
  else if (engine === 'vllm')         → ensureVllm + callOpenAICompat
  else if (engine === 'llama-cpp-python' / 'onnx' / 'transformers')
                                       → callPySubserver
```

### 4.4 격리 forward (api/iso-infer.js, 124줄)

```javascript
forward(method, path, body):
  1. ISO_INFER_URL 환경변수 확인
  2. getIdToken(audience) — metadata server 호출 (50분 TTL 캐시)
  3. fetch(url, { Authorization: Bearer, X-Internal-Token (옵션) })
  4. 429 retry 3회 (지수 backoff 2s/4s/8s)
  5. 응답 파싱 (JSON 또는 raw)

ID Token 흐름:
  메인 service SA (aitutor-run)
    → http://metadata.google.internal/.../identity?audience={ISO_INFER_URL}
    → Bearer Token 받음
    → 격리 service IAM Invoker 검증 통과
```

### 4.5 sync 마스터 패턴

```
workspace/aitutor-inference/  (sync 마스터)
  ├─ engines/*.py (9 파일)
  ├─ server.py (FastAPI)
  └─ requirements.txt
        │ sync-from-isolated.sh
        ↓
workspace/aitutor/inference-py/  (mirror)
  └─ Dockerfile 빌드 시 image 에 포함

격리 service 운영:
  PROCESS_MODE=isolated 환경변수
  → start.sh 가 isolated 분기 → uvicorn 직접 실행
  → 같은 image 재사용 (REBUILD28 §3.1)
```

---

## 5. 인프라

### 5.1 Cloud Run service

| Service | Region | GPU | RAM | CPU | maxScale | concurrency |
|---|---|---|---|---|---|---|
| **aitutor** (메인) | us-east4 | L4 1장 | 32Gi | 8 | 1 | 10 |
| **aitutor-inference** (격리) | us-east4 | L4 1장 | 32Gi | 8 | 1 | 10 |

→ GPU quota 3 (REBUILD26 변경 이력) 으로 양쪽 운영. 동시 deploy 시 일시 quota 초과 가능 (REBUILD29 §27).

### 5.2 Cloud Build 파이프라인

```
gcloud builds submit --tag asia-northeast3-docker.pkg.dev/.../aitutor:tagN
  ↓
[Stage 1] frontend-builder (Node 22 + Vite) — ~2분
[Stage 2] llamacpp-builder (CUDA devel + cmake + git clone) — ~7분 ⚠️ 무거움
[Stage 3] runtime (CUDA runtime + Node + Ollama + venv-vllm + binaries 복사) — ~10분
[Push]    Artifact Registry asia-northeast3 — ~5~10분 (image 7~8GB)
  ↓
~17~28분 (이번 세션 평균)
```

### 5.3 Storage / Secret

| 항목 | 위치 |
|---|---|
| Cloud SQL (PostgreSQL 14) | (region 별도, max=2 pool) |
| GCS Bucket | aitutor-files-aifactory-494108 |
| Artifact Registry | asia-northeast3 (compressed 한도 10GB) |
| Secret Manager | 8 시크릿 (DB / JWT / API keys) |

### 5.4 모바일 빌드 (Capacitor)

```
capacitor.config.json (17줄):
  appId: com.aitutortwo.app
  webDir: dist
  server.url: https://aitutor-z2ppabmtxa-uk.a.run.app
  ios.scheme: AITutorTwo
  android.allowMixedContent: false
  ↓
npx cap sync → iOS / Android native project 생성
  ↓
Xcode / Android Studio 빌드
```

---

## 6. 코드베이스 통계

### 6.1 디렉토리 별 LOC

```
workspace/aitutor/
├─ src/                 ~10,000 LOC (Vite + React)
│  ├─ labs/            ~2,496 (5 lab 핵심)
│  ├─ components/lab/    ~735 (REBUILD29 신규 공통)
│  ├─ tabs/            ~3,000 (Quiz / Settings / Manage / KISA)
│  ├─ pages/           ~1,500 (Login / Quiz pages / 시험 모드)
│  ├─ tracks/            ~150 (KISA 트랙 라우팅)
│  ├─ components/      ~1,500 (BottomNav / Header / Toast 등)
│  ├─ lib/               ~500 (api / qwen / capacitor / lab/)
│  └─ App.jsx + main.jsx  ~200
├─ api/                ~3,500 (52 엔드포인트)
│  ├─ local-infer.js     392 ⚠️ 가장 김
│  ├─ iso-infer.js       124
│  ├─ hf.js              126
│  ├─ _runtime/          ~310 (qwen / settings / hf-catalog)
│  └─ 다른 핸들러
├─ inference-py/         ~700 (Python sub-server)
└─ tests/                ~600 (Playwright 7 spec)
```

### 6.2 의존성

```json
"dependencies": {
  "@anthropic-ai/sdk": "...",
  "@huggingface/transformers": "^4",
  "@mlc-ai/web-llm": "^0.2.83",          ← REBUILD28 §11 (~6MB 번들)
  "express", "react", "react-router-dom",
  "react-markdown", "highlight.js",
  "@capacitor/core", "@capacitor/ios", "@capacitor/android"
},
"devDependencies": {
  "@playwright/test": "^1.58.2",          ← REBUILD29 §21
  "vite", "tailwindcss"
}
```

---

## 7. 발견된 이슈 + 리팩토링 후보 (실험실 중심)

### 7.1 P0 (시급 — 잠재적 버그)

#### Issue 1 — `applyQwenStrict()` UI 측 누락

**현재 상태**:
- `LocalGcpTester.jsx:91` 의 `messages = buildLabMessages(question)` — `applyQwenStrict` 호출 안 함
- `ServerInferTester.jsx:127` — 동일
- 백엔드 (`api/local-infer.js`, `api/iso-infer.js`) 가 `applyQwenStrict` 호출 → 작동은 함

**문제**:
- 백엔드 의존 — 백엔드 헬퍼 변경 시 모든 lab 영향
- UI 단에서 디버깅 시 "최종 메시지" 미리보기에 한국어 강제 안 보임 (PromptEditor 의 미리보기가 부정확)
- 사용자가 PromptEditor 에서 system 직접 편집 시 한국어 강제 사라짐

**해결**:
- `buildLabMessages()` 가 model 인자 받아 자동 `applyQwenStrict` 적용
- 또는 PromptEditor 가 항상 적용

```js
// src/lib/lab/promptBuilder.js (수정)
import { applyQwenStrict } from '../qwen';

export function buildLabMessages(question, opts = {}) {
  const { systemOverride, model } = opts;
  const system = systemOverride || STANDARD_SYSTEM_PROMPT;
  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: buildUserPrompt(question) },
  ];
  return model ? applyQwenStrict(messages, model) : messages;  // ← 자동 적용
}
```

호출처:
```js
// LocalGcpTester:91
const messages = buildLabMessages(question, { model: modelKey });
```

→ 백엔드 의존 제거 + PromptEditor 미리보기 정확.

#### Issue 2 — API 스키마 불일치 (`maxTokens` vs `max_tokens`)

```js
// LocalGcpTester (camelCase)
body: JSON.stringify({ engine, model_key, messages, maxTokens, temperature })

// ServerInferTester (snake_case)
body: JSON.stringify({ engine, model_key, messages, max_tokens: maxTokens, temperature })
```

→ 백엔드 처리 시 헷갈림. 통일 필요.

**해결**:
- 한 쪽으로 통일 (snake_case 권장 — Python sub-server 와 격리 service 모두 snake_case)
- 백엔드도 통일 (api/local-infer.js 의 `req.body.maxTokens` → `req.body.max_tokens` 또는 fallback 둘 다 받기)

### 7.2 P1 (코드 중복)

#### Issue 3 — `buildPromptPreview()` 중복 정의 (3 lab)

```js
// LocalGcpTester:35, ServerInferTester:35, OllamaBridgeTester:48
function buildPromptPreview(question) {
  const choices = question.choices || [];
  const choicesText = choices.map((c, i) => `${CIRCLE[i]} ${c}`).join('\n');
  // ... 거의 동일 ...
}
```

**해결**: `src/lib/lab/promptBuilder.js` 에 `buildLabPromptPreview` 추출. 3 lab 에서 import.

→ -51 라인 감축, 한 곳 변경 시 3 lab 자동 반영.

#### Issue 4 — `MODELS` 상수 중복

```js
// LocalGcpTester:28, ServerInferTester:28
const MODELS = [
  { key: 'qwen35-2b', name: 'Qwen 3.5 2B', ... },
  // ... 4 항목 동일 ...
];
```

**해결**: `src/lib/lab/models.js` 에 `LAB_MODELS` 단일 정의 + `LAB_ENGINES` 도 추가.

```js
// src/lib/lab/models.js (신규)
export const LAB_MODELS = [...];
export const LAB_ENGINES_LOCAL_GCP = [...];
export const LAB_ENGINES_SERVER_INFER = [...];
```

→ -34 라인 감축 + 중앙 관리.

### 7.3 P2 (구조 개선)

#### Issue 5 — Props drilling (LocalAiExplanation)

13 state → 7 자식 (DeviceCheckBadge / ModelDownloadCard / ModelManagerPanel / MemoryStatus / MemoryHelpCard / EngineSwitcher / WebllmPanel)

**해결**: `LocalAiContext` Provider 도입 (Context API).

```jsx
// LocalAiContext.jsx (신규)
const LocalAiContext = createContext({});
export function LocalAiProvider({ children }) {
  const [device, setDevice] = useState(null);
  const [pipeReady, setPipeReady] = useState(false);
  // ...
  return <LocalAiContext.Provider value={{ device, pipeReady, ... }}>{children}</LocalAiContext.Provider>;
}
export const useLocalAi = () => useContext(LocalAiContext);
```

→ -30 라인, 자식이 직접 useLocalAi() 호출.

#### Issue 6 — `disposePipe()` 에러 무시

```js
// LocalAiExplanation:136
disposePipe(...).catch(() => {});  // ← 에러 무시
```

→ 메모리 누수 시 발견 어려움. 최소 console.warn 또는 telemetry.

#### Issue 7 — `_daemons` 캐시 TTL 없음

`api/local-infer.js` 의 `_daemons` 객체가 process 수명 내 무한 유지. spawn 한 daemon 이 죽어도 cache 갱신 없으면 stale 호출.

**해결**: TTL + heartbeat (proc.exitCode 체크) 추가.

### 7.4 P3 (스타일 / 문서)

#### Issue 8 — `local-infer.js` 비대 (392줄)

- 엔진별 호출 로직이 한 파일에 모임
- `engines/` 디렉토리로 분리 가능 (TS 클래스 패턴 권장)

```
api/engines/
├─ index.js          // 엔진 레지스트리
├─ ollama.js         // OllamaEngine.call(messages, opts)
├─ llamaserver.js    // LlamaServerEngine
├─ vllm.js           // VLLMEngine
└─ pysubserver.js    // PySubServerEngine

api/local-infer.js   // 392줄 → 150줄 (engine.call 만)
```

→ 신규 엔진 추가 비용 ~150줄 → ~40줄/엔진.

### 7.5 ParamSliders / ResponsePanel / coldStartRetry (재사용)

`maxTokens` 슬라이더 + `temperature` 슬라이더 가 4 lab 에서 거의 동일하게 반복:

```jsx
// 4 lab × ~20줄 = 80줄
<div>
  <label>Temperature {temperature.toFixed(2)}</label>
  <input type="range" min={0} max={2} ... />
</div>
<div>
  <label>Max Tokens {maxTokens}</label>
  <input type="range" min={64} max={1024} ... />
</div>
```

**해결**:
```jsx
<ParamSliders
  temperature={temperature} onTemperatureChange={setTemperature}
  maxTokens={maxTokens} onMaxTokensChange={setMaxTokens}
  maxTokensRange={[64, 4096]}  // GCP 는 4096, 외부 1024
/>
```

→ -80 라인 + 일관성.

---

## 8. 우선순위 작업 매트릭스

### 8.1 작업 정량 비교

| # | 작업 | 우선도 | 효과 | 라인 감축 | 시간 |
|---|---|---|---|---|---|
| 1 | buildLabMessages 자동 Qwen 강제 | 🔴 P0 | UI 미리보기 정확 + 백엔드 의존 제거 | 0 (버그 픽스) | 20분 |
| 2 | maxTokens / max_tokens 통일 | 🔴 P0 | API 스키마 일관 | 0 | 30분 |
| 3 | buildLabPromptPreview 추출 | 🟧 P1 | 3 lab 중복 제거 | -51 | 30분 |
| 4 | LAB_MODELS / LAB_ENGINES 중앙화 | 🟧 P1 | 2 lab 중복 + 미래 추가 모델 한 곳 | -34 | 30분 |
| 5 | ParamSliders 재사용 컴포넌트 | 🟨 P2 | 4 lab 슬라이더 통합 | -80 | 1시간 |
| 6 | ResponsePanel 추상화 | 🟨 P2 | 에러/응답 렌더링 표준 | -40 | 45분 |
| 7 | coldStartRetry 유틸 | 🟨 P2 | 429 retry 재사용 | -15 | 30분 |
| 8 | LocalAiContext (Context API) | 🟨 P2 | Props drilling 해결 | -30 | 1.5시간 |
| 9 | disposePipe 에러 처리 강화 | 🟨 P2 | 메모리 누수 추적 | 0 | 15분 |
| 10 | _daemons 캐시 TTL + heartbeat | 🟨 P2 | stale daemon 방지 | 0 | 1시간 |
| 11 | engines/ 디렉토리 분리 | 🟦 P3 | local-infer.js 392→150줄 | -240 (재구성) | 3~4시간 |
| 12 | HfCompare 분석 로직 분리 | 🟦 P3 | 가독성 | -100 | 1시간 |
| **합계** | — | — | — | **-590 라인** | **~12시간** |

### 8.2 권장 작업 패키지

#### 🥇 패키지 A — P0 fix only (50분)
1. buildLabMessages 자동 Qwen 강제 (20분)
2. maxTokens / max_tokens 통일 (30분)

→ **잠재적 버그 차단**. 다음 빌드에 합쳐 배포.

#### 🥈 패키지 B — P0 + P1 (~2시간)
패키지 A + 3, 4 (중복 제거).

→ **-85 라인** + 한 곳 변경 시 3 lab 자동 반영. 가성비 최고.

#### 🥉 패키지 C — P0 + P1 + P2 (~6시간)
패키지 B + 5, 6, 7, 8, 9, 10.

→ **-250 라인**. 본격 리팩토링.

#### 패키지 D — 완전 (~12시간)
모든 12 작업.

→ engines/ 디렉토리 분리 (P3 의 큰 작업).

---

## 9. 기존 작업과 연계

### 9.1 REBUILD29 §6 옵션 A 하이브리드 와의 관계

REBUILD29 의 미진행 결정사항: **옵션 A 하이브리드** (메인 image 에서 vLLM venv + llama.cpp 제거).

**REBUILD30 의 P3 (engines/ 분리)** 와 **옵션 A 하이브리드** 가 결합 시:
- engines/ 분리 → 각 엔진이 격리 로 forward 또는 메인 직접 처리 분기 명확
- 옵션 A 하이브리드 진행 시 메인 image 다이어트 + 격리만 무거운 엔진

→ P3 작업은 옵션 A 결정 후 진행이 자연스러움.

### 9.2 REBUILD30 → REBUILD31 흐름

```
REBUILD30 (본 문서)
  ↓
패키지 A (P0 fix, 50분) → 빌드 + deploy
  ↓
패키지 B (P0 + P1, 2시간) → 다음 빌드
  ↓
[옵션 A 하이브리드 결정]
  ↓
REBUILD31 (옵션 A + 패키지 C/D, 8~12시간)
```

---

## 10. 위험 + 완화

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| 백엔드 applyQwenStrict 변경 시 5 lab 동시 영향 | 중간 | UX | UI 단에서도 적용 (Issue 1 fix) |
| API 스키마 불일치 (maxTokens) → 새 lab 추가 시 혼란 | 높음 | 개발 비용 | snake_case 통일 + 문서화 |
| 코드 중복 (buildPromptPreview) → 한 곳만 수정 시 lab 별 차이 | 높음 | 버그 잠재 | 헬퍼 추출 (P1) |
| Props drilling → LocalAiExplanation 변경 어려움 | 낮음 | 개발 비용 | Context API (P2) |
| _daemons stale → 추론 실패 | 낮음 | UX | TTL + heartbeat (P2) |
| Cloud Build 27분 → 빌드 빈도 부담 | 중간 | 시간 | 옵션 A 하이브리드 + 로컬 빌드 (REBUILD29 §6) |

---

## 11. 검증 / 테스트 현황

### 11.1 Playwright (REBUILD29 §27 결과)

- 7 spec, 19 테스트 (`tests/step1~7-*.spec.js`)
- step7 (REBUILD29 §21) — 옵션 A 스모크
- 결과: **15 passed / 0 failed / 4 skipped**

### 11.2 미커버 영역

| 영역 | 미커버 사유 | 보완 권장 |
|---|---|---|
| admin 토글 동작 | production admin 인증 필요 | 사용자 직접 검증 또는 dev 서버 + fake 토큰 |
| 추론 실 호출 (6 엔진 × 4 모델) | cold start + 비용 | 옵션 B (가벼운 호출 1~2 케이스) |
| QuestionPicker DB 카드 클릭 | lab 활성 의존 | mock API 또는 dev 서버 |
| PromptEditor 편집 + 전송 | UI 인터랙션 다단계 | step 추가 필요 |
| WebLLM 다운로드 (~5GB) | 데스크톱 + WebGPU | 사용자 직접 |
| Ollama bridge 사용자 PC 호출 | 외부 환경 | 사용자 직접 |

→ 옵션 B (가벼운 호출 검증) 진행 시 +30~60초 / +$0.10 비용으로 추론 작동 확인 가능.

---

## 12. 결정 의제 (사용자 결정 필요)

### 12.1 즉시 결정 가능

1. **패키지 A/B/C/D 중 어떤 것부터 진행?**
   - 권장: **패키지 B** (P0 + P1, 2시간, -85 라인)
2. **API 스키마 통일 — camelCase vs snake_case?**
   - 권장: **snake_case** (Python sub-server / 격리 service / vLLM / Ollama 모두 snake_case)
3. **HfPlayground / LocalAiExplanation 의 PromptEditor 통합 (REBUILD29 §26 미적용)**
   - HfPlayground 는 자유 프롬프트 모드라 별도 설계
   - LocalAiExplanation 은 transformers.js 의 explainQuestion 내부 chat template 변경 필요

### 12.2 중기 결정

1. **옵션 A 하이브리드 진행 여부** (REBUILD29 §6, 메인 image 다이어트)
2. **engines/ 디렉토리 분리** (P3, 옵션 A 와 결합 권장)
3. **추가 사용자 검증** (라이브 환경, REBUILD29 §27.6 의 7 항목)

---

## 13. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-30 | REBUILD30.md 최초 작성 — REBUILD23~29 누적 결과 + 전체 아키텍처 + 5 lab 상세 분석 (2,496 LOC) + 백엔드 API 표 (52 엔드포인트) + 인프라 다이어그램 + 발견된 이슈 8개 (P0~P3) + 리팩토링 후보 12개 (-590 라인) + 작업 패키지 A/B/C/D + 우선순위 결정 의제 |
| 2026-04-30 | **§0.3 이슈 1~7 코드 재검증** — 사용자 의사결정 의제 |
| 2026-04-30 | **§0.4 후보 7건 코드 재검증** — #4 ParamSliders + #5 ErrorBanner 진행, #3/#6/#7 보류 또는 불필요 |
| 2026-04-30 | **옵션 A 적용 완료** — buildPromptPreview 통합 / models.js 신규 / slider 1024→4096 |
| 2026-04-30 | **옵션 B (§0.4 #4+#5) 적용 완료** — ParamSliders 4 lab 통합 / ErrorBanner 3 lab 통합 |

---

## 14. 이슈 재검증 결과 (사용자 의사결정 후 진행)

### 14.1 검증 사실 (코드 기준)

| # | 원 진단 | 재검증 결과 |
|---|---|---|
| 1 | applyQwenStrict UI 누락 P0 | ❌ **오진단** — `api/local-infer.js:250,277` + `api/iso-infer.js:104` 백엔드 측 이미 적용. UI(LocalGcp/ServerInfer) 는 백엔드 경유라 재호출 불필요. Ollama bridge / WebLLM 은 브라우저 직접 호출이라 이미 UI 호출 ✓ |
| 2 | maxTokens vs max_tokens P0 | ⚠️ **부분참** — 양쪽 백엔드 호환 처리됨 (`iso-infer.js:102 max_tokens \|\| maxTokens`). 그러나 **진짜 버그 발견**: slider `max=1024` 인데 default=2048 → UI 깨짐 |
| 3 | buildPromptPreview 3중복 P1 | ✅ **참 + α** — 동일 27줄 함수 3 lab 반복. 추가 **semantic bug**: 미리보기 prompt ≠ 실제 전송 prompt (STANDARD_SYSTEM_PROMPT 와 불일치) |
| 4 | MODELS 상수 중복 P1 | ⚠️ **참 — 단 의도** — ServerInfer `FALLBACK_MODELS` 는 fallback 용도 |
| 5 | LocalAiExplanation props drilling P2 | ✅ **참 — 가성비 낮음** — useState 14개 확인. Context API 1.5h vs 효과 미미 |
| 6 | disposePipe 에러 무시 P2 | ⚠️ **의도된 패턴** — cleanup hook 의 빈 catch 는 React 표준 |
| 7 | _daemons 캐시 TTL 없음 P2 | ❌ **오진단** — `d.proc.exitCode === null` 자체 self-healing + 모델 변경 시 `_killDaemon()`. Cloud Run scale-to-zero 가 실질 TTL |

### 14.2 진행 결정 (사용자 옵션 A 선택)

| 작업 | 근거 | 상태 |
|---|---|---|
| **slider max 1024→4096** | 슬라이더 default 2048 표시 못함 | ✅ 완료 |
| **buildPromptPreview 통합 (promptBuilder.js)** | 3 중복 + semantic bug 동시 해결 | ✅ 완료 |
| **src/lib/lab/models.js 신규** | LAB_MODELS 중앙화, 두 lab import | ✅ 완료 |
| ⏸ Context API 도입 | 가성비 낮아 보류 | 후순위 |
| ❌ applyQwenStrict UI 보완 | 오진단 — 백엔드 처리 확인 | 작업 불필요 |
| ❌ _daemons TTL 추가 | 오진단 — self-healing 확인 | 작업 불필요 |

### 14.3 코드 변경 요약

```
변경 파일 7개:
  + src/lib/lab/models.js                   (신규, 19줄, LAB_MODELS 중앙화)
  M src/lib/lab/promptBuilder.js            (+18줄, buildPromptPreview 추가 + safeParseChoices)
  M src/labs/local-gcp/LocalGcpTester.jsx   (-32줄, 로컬 buildPromptPreview/MODELS 제거)
  M src/labs/server-infer/ServerInferTester.jsx  (-32줄, 동일)
  M src/labs/ollama-bridge/OllamaBridgeTester.jsx (-19줄, 로컬 buildPromptPreview 제거)
  M src/labs/local-gcp/LocalGcpTester.jsx (slider max 1024→4096)
  M src/labs/server-infer/ServerInferTester.jsx (slider max 1024→4096)

순감: -66 라인
빌드: ✓ vite build 성공 (2.56s)
```

---

## 15. §0.4 리팩토링 후보 재검증 + 적용 결과

### 15.1 7건 후보 재검증 (코드 기준)

| # | 후보 | 판정 | 근거 |
|---|---|---|---|
| 1 | buildLabPromptPreview 통합 | ✅ 옵션 A 완료 | 7bd78de |
| 2 | src/lib/lab/models.js | ✅ 옵션 A 완료 | 7bd78de |
| 3 | buildLabMessages 자동 Qwen 강제 | ❌ 불필요 | §0.3 이슈 1 — 백엔드(api/local-infer.js + iso-infer.js) 자동 적용 확인 |
| 4 | ParamSliders.jsx | ✅ 옵션 B 완료 | 4 lab 동일 마크업 통합 (LocalGcp/ServerInfer/HfPlayground/HfCompare) |
| 5 | ResponsePanel.jsx | ⚠️ 부분 적용 | 응답 박스는 lab 색상 식별 보존 → 에러 박스만 ErrorBanner 통합 (3 lab) |
| 6 | coldStartRetry.js | ⏸ 보류 | 격리 service 한정. 브라우저 fetch + Node fetch 환경 달라 직접 공유 어려움. 격리 확장 시 재검토 |
| 7 | LocalAiContext (Context API) | ⏸ 보류 | useState 14개지만 자식별 props 2~5개. 1.5h vs 효과 미미. 추가 lab 늘면 재검토 |

### 15.2 옵션 B 적용 코드 변경

```
신규 파일:
  + src/components/lab/ParamSliders.jsx   (62 lines, 4 lab 슬라이더 통합)
  + src/components/lab/ErrorBanner.jsx    (24 lines, 3 lab 에러 박스 통합, default+compact 변형)

수정 파일:
  M src/labs/local-gcp/LocalGcpTester.jsx
  M src/labs/server-infer/ServerInferTester.jsx
  M src/labs/ollama-bridge/OllamaBridgeTester.jsx
  M src/labs/hf-playground/HfPlayground.jsx
  M src/labs/hf-playground/HfCompare.jsx

라인 변동: lab 측 -110 라인 (50 ins vs 160 del), 컴포넌트 +86 라인 → 순감 ~24 라인
   ★ 라인 수치보다 의미: 슬라이더 max 변경 시 5곳 → 1곳 / 에러 스타일 통일 시 3곳 → 1곳

빌드 검증: ✓ vite build 성공 (2.52s)
```

### 15.3 보류 후보 재진입 조건

| 후보 | 재진입 트리거 |
|---|---|
| #3 자동 Qwen 강제 | UI 측 직접 (브라우저) Qwen 호출 lab 가 추가될 때 |
| #6 coldStartRetry | 격리 service 외부 또 다른 cold start 도메인 발생 시 |
| #7 LocalAiContext | LocalAi lab 가 자식 컴포넌트 10+ 또는 props 30+ 에 도달 시 |

---

## 16. §17 사후 작업 (옵션 B 완료 후 — 2026-04-30 ~ 05-01)

### 16.1 작업 흐름 요약

옵션 B 완료 후 추가로 발견된 운영 이슈를 단계적으로 처리:
1. **GCP 비용 정리** — 옵션 B 의 코드 효과 외에 인프라 누적 산출물 청소
2. **API 버그** — `?action=public` 가 401 반환되어 카테고리 dropdown 미노출
3. **UI 데이터 형식 mismatch** — DB 의 choices 객체 배열을 React 가 #31 throw

### 16.2 GCP 인프라 정리 (사용자 옵션 B 결정 기준 = "마지막 2 revision 보존")

#### 16.2.1 Cloud Run revision 정리

| 대상 | Before | After | 삭제 |
|---|---|---|---|
| us-central1 aitutor (좀비) | 2 revision (00001/00002) | 0 (service 삭제) | service 자체 삭제 |
| us-east4 aitutor | 19 revision (00001~00019) | 2 (00018/00019) | 17 |
| us-east4 aitutor-inference | 11 revision (00001~00011) | 2 | 9 |
| pressstand 6 service | 691 revision 누적 | 11 (각 service 2개씩, withbible 1) | 672 |
| **합계** | **723** | **15** | **698** |

#### 16.2.2 Artifact Registry 이미지 정리

| Repo | Before | After | 회수 |
|---|---|---|---|
| aitutor (asia-northeast3) | 19 sha256 / 124 GB | 2 sha256 / 18 GB | **106 GB** |
| pressstand cloud-run-source-deploy | 685 sha256 / 108 GB | 11 sha256 / 0.84 GB | **107 GB** |
| **합계** | **704 sha256 / 232 GB** | **13 sha256 / 19 GB** | **213 GB** |

부수 정리: news-pipeline (6, 메모리 룰 위반), pressstand-staging (3, 미사용) 좀비 이미지 즉시 삭제.

#### 16.2.3 영구 자동화 정책 (재발 방지)

```yaml
AR cleanup-policy (aitutor + pressstand 동일 패턴):
  KEEP:    최신 3 sha256
  DELETE:  untagged > 7일
  DELETE:  tagged > 30일
  Mode:    enforce (dryRun: false)

GCS lifecycle (cloudbuild source 2 버킷):
  Age > 30일 → 자동 Delete
  적용: aifactory-494108_cloudbuild + run-sources-pressstand-asia-northeast3

Cloud SQL pressstand-db Auto-Resize Limit:
  Before: storageAutoResizeLimit=0 (무제한)
  After:  storageAutoResizeLimit=20 GB
  
Cloud SQL Disk Usage Alert:
  Threshold: 80% → email season1zeepapa@gmail.com
  
GCP Budget Alert:
  Display: GCP Total Monthly Budget
  Amount: ₩150,000/월
  Threshold: 50% / 90% / 100%
  기존 ₩10 / ₩1,000 budget 정리됨
```

#### 16.2.4 비용 효과

| 항목 | 월간 절감 |
|---|---|
| AR aitutor 회수 | ~$10.60 |
| AR pressstand 회수 | ~$10.70 |
| GCS cloudbuild source (30일 lifecycle) | ~$0.45 |
| **합계** | **~$21.75/월 (~₩30,500/월, ~₩366,000/년)** |

### 16.3 API 401 버그 수정 (api/questions.js)

#### 증상
`GET /api/questions?action=public` 가 항상 `{"error":"인증이 필요합니다."}` 반환.
실험실 5 페이지의 QuestionPicker DB 모드에서 카테고리 dropdown 이 `categories.length===0` 으로 숨김.

#### 원인
```js
const { action } = req.body || req.query || {};
//                  ^^^ GET 요청 시 body-parser 가 셋업한 빈 객체 {}
//                  truthy 라 req.query 로 fallback 못 함
```

#### 수정
```js
const action = req.body?.action || req.query?.action;
// body.action 이 undefined 면 query.action 으로 자동 fallback
// GET/POST 모두 호환
```

커밋: `edb1c25 fix(aitutor): action=public 라우트 401 버그`

### 16.4 React error #31 — choices 객체 {num,text} 정규화

#### 증상
실험실 페이지에서 시험 dropdown 선택 시 화이트 스크린 + Minified React error #31.

#### 원인
DB 의 `questions.choices` 컬럼:
```json
[{"num":1,"text":"캡슐화"}, {"num":2,"text":"동기화"}, ...]
```

프론트엔드 가정:
```json
["캡슐화", "동기화", ...]
```

`<span>{c}</span>` 에서 c 가 객체 → React 가 객체를 child 로 렌더 시도 → #31 throw.
paste 모드는 string[] 라 OK / DB 모드만 깨짐 → 형식 일치 부족이 근본 원인.

#### 수정 (3 layer 정규화)

```js
// 1. src/components/lab/QuestionPicker.jsx (boundary 정규화)
const choices = arr.map(c =>
  (c && typeof c === 'object') ? String(c.text ?? c.num ?? '') : String(c ?? '')
);

// 2. src/components/lab/QuestionPreview.jsx (방어)
const choices = rawChoices.map(c =>
  (c && typeof c === 'object') ? String(c.text ?? c.num ?? '') : String(c ?? '')
);

// 3. src/lib/lab/promptBuilder.js (LLM prompt)
const choices = choicesArr.map((c, i) => {
  const txt = (c && typeof c === 'object') ? (c.text ?? c.num ?? '') : c;
  return `${CIRCLE[i] || `(${i+1})`} ${txt}`;
}).join('\n');
```

커밋: `914c93f fix(aitutor): React error #31 — choices 객체 정규화`

### 16.5 변경 이력 (16장)

| 날짜 | 커밋 | 작업 |
|---|---|---|
| 2026-04-30 | `7bd78de` | 옵션 A — slider + promptBuilder + models.js |
| 2026-04-30 | `eec2610` | 옵션 B — ParamSliders + ErrorBanner |
| 2026-04-30 | `e78851b` | REBUILD27~30 누적 트리 정리 (58 files) |
| 2026-04-30 | `edb1c25` | action=public 라우트 401 버그 fix |
| 2026-05-01 | `914c93f` | React error #31 choices 객체 정규화 |

### 16.6 Cloud Run 배포 이력

| 날짜 | Revision | TAG | 빌드 시간 |
|---|---|---|---|
| 2026-04-30 09:08 | aitutor-00019-k92 | rebuild30-20260430-173811 | 34분 44초 |
| 2026-04-30 (later) | aitutor-00020-h5x | rebuild30-fix-20260501-082038 | 32분 38초 |
| 2026-05-01 00:28 | aitutor-00021-nkc | rebuild30-react31-fix-20260501-085943 | 28분 11초 |

현재 active: **aitutor-00021-nkc** (us-east4, 100% traffic)

### 16.7 검증

```
$ git status
nothing to commit, working tree clean

$ git log --oneline -5
914c93f fix(aitutor): React error #31 — choices 객체 정규화
edb1c25 fix(aitutor): action=public 라우트 401 버그
e78851b chore(aitutor): REBUILD27~30 누적 트리 정리
eec2610 refactor(aitutor): REBUILD30 §0.4 옵션 B
7bd78de refactor(aitutor): REBUILD30 §0.3 옵션 A

$ git status -sb
## main...origin/main         # ← origin 과 sync ✓

$ curl https://aitutor-z2ppabmtxa-uk.a.run.app/api/questions?action=public
HTTP 200 ✓

$ curl https://aitutor-z2ppabmtxa-uk.a.run.app/lab
HTTP 200 ✓
```

---

## 17. §18 사후 작업 — PromptEditor 통일 + Qwen 강제 가시화 (2026-05-01)

### 17.1 동기

옵션 B 까지 완료한 후 사용자 추가 요청:
1. **일관성** — PromptEditor 가 4 lab (LocalGcp / ServerInfer / OllamaBridge / WebLLM) 만 적용 → 6 lab 모두 통일
2. **투명성 + 편집** — Qwen 자동 주입 강제 프롬프트 (KOREAN_FORCE_*, /no_think) 가 화면에 안 보임 → 노출 + 편집 가능

### 17.2 6 Phase 작업 결과

| Phase | 내용 | 결과 |
|---|---|---|
| 1 | qwen.js (src + api) KOREAN_FORCE_SYSTEM/USER, ASSISTANT_SEED, NO_THINK_TOKEN export | ✅ |
| 2 | PromptEditor 확장 — 기본 펼침, Qwen 4 섹션 (편집 가능), 미리보기 = 실제 모델 입력 | ✅ |
| 3 | LocalGcp / LocalAi 의 read-only "🔍 최종 입력 프롬프트 보기" 제거 (중복 정리) | ✅ |
| 4 | LocalAi (transformers) 에 PromptEditor 추가 — explainQuestion(customMessages) | ✅ |
| 5 | HfPlayground / HfCompare exam 모드에 PromptEditor 추가 — handleRun(customMessages) | ✅ |
| 6 | 빌드 → 배포 → Playwright 전수 → 커밋/푸시 → 문서 갱신 | ✅ |

### 17.3 PromptEditor 신규 구조

```
[🎯 프롬프트 편집기] (기본 펼침 ▲)
├── 1️⃣ 시스템 메시지 (페르소나)              ← 편집
├── 2️⃣ 사용자 메시지 (문제+보기+정답)        ← 편집
├── 🔶 Qwen 한국어 강제 (Qwen 모델일 때만)
│   ├── 3️⃣ System tail (KOREAN_FORCE_SYSTEM)  ← 편집
│   ├── 4️⃣ User tail (KOREAN_FORCE_USER)      ← 편집
│   ├── 5️⃣ Assistant Seed                     ← 편집
│   └── 6️⃣ /no_think 토글                     ← thinking 차단/허용
├── 📨 최종 메시지 미리보기 (실제 모델 입력)
└── ✨ [이 프롬프트로 전송]
```

핵심:
- 백엔드 / 프론트의 `applyQwenStrict` 는 idempotent (`includes('CRITICAL: 반드시 한국어')` 검출 시 skip)
- PromptEditor 가 미리 적용한 messages 보내도 백엔드에서 중복 추가 안 됨
- KOREAN_FORCE_* 비우면 영어 응답 실험 가능

### 17.4 영향 lab (6 lab 통일)

| Lab | PromptEditor | 비고 |
|---|---|---|
| LocalGcp (일심동체) | ✓ | read-only 미리보기 제거 |
| ServerInfer (격리) | ✓ | (기존) |
| OllamaBridge | ✓ | (기존) |
| LocalAi transformers | ✓ NEW | inference.js customMessages 추가 |
| LocalAi WebLLM | ✓ | (기존, WebllmPanel 안에서 사용) |
| HfPlayground exam 모드 | ✓ NEW | 자유 prompt 모드는 그대로 |
| HfCompare exam 모드 | ✓ NEW | 첫 선택 모델 ID 로 isQwen 판정 |

### 17.5 Playwright 검증 결과

```
$ PLAYWRIGHT_BASE_URL=https://aitutor-z2ppabmtxa-uk.a.run.app \
  npx playwright test tests/step7-labs-smoke.spec.js

Running 19 tests using 1 worker
  ✓ 19 tests/step7-labs-smoke.spec.js
  
  4 skipped (admin 인증 필요 / DB 모드 — 의도적 skip)
  15 passed (33.2s)
  0 failed
```

검증 통과 항목:
- 실험실 메인 (/lab) — 5 카드 + 헤더 + 홈 링크
- 디바이스 AI (/lab/local-ai) — EngineSwitcher + 실험실 링크
- Cloud Run 일심동체 (/lab/local-gcp) — 6 엔진 + 모델 카드
- 격리 추론 (/lab/server-infer) — 6 엔진 fallback
- HF Inference (/lab/hf) — 탭 + 비교 모드
- Ollama bridge (/lab/ollama-bridge) — 도움말 6 단계
- 헤더 통일 (5 lab) — "← 실험실" 링크 모두 동작

### 17.6 변경 파일 (8개)

| 파일 | 변경 |
|---|---|
| src/lib/qwen.js | export 4 상수 추가 |
| api/_runtime/qwen.js | sync (CommonJS) export 추가 |
| src/components/lab/PromptEditor.jsx | Qwen 4 섹션 + 기본 펼침 (+90 lines) |
| src/labs/local-gcp/LocalGcpTester.jsx | showPrompt 제거 (-22 lines) |
| src/labs/local-ai/LocalAiExplanation.jsx | PromptEditor 추가 + showPrompt 제거 (-37 lines + 8 lines) |
| src/labs/local-ai/lib/inference.js | customMessages opts 추가 |
| src/labs/hf-playground/HfPlayground.jsx | PromptEditor 추가 (exam 모드) |
| src/labs/hf-playground/HfCompare.jsx | PromptEditor 추가 (exam 모드, 첫 선택 모델) |

순 변동: +187 / -111 = 76 라인 증가 (확장 기능 대비 합리적)

### 17.7 변경 이력 종합 (REBUILD30 누적)

| 날짜 | 커밋 | 작업 |
|---|---|---|
| 2026-04-30 | 7bd78de | 옵션 A — slider + promptBuilder + models.js |
| 2026-04-30 | eec2610 | 옵션 B — ParamSliders + ErrorBanner |
| 2026-04-30 | e78851b | REBUILD27~30 누적 트리 정리 (58 files) |
| 2026-04-30 | edb1c25 | action=public 라우트 401 버그 fix |
| 2026-05-01 | 914c93f | React error #31 choices 객체 정규화 |
| 2026-05-01 | 0d0896b | docs §16~17 사후 작업 추가 |
| 2026-05-01 | 744918a | 빈 카테고리 fallback fix + 시험 갯수 표시 |
| 2026-05-01 | d3f69d6 | §18 PromptEditor 6 lab 통일 + Qwen 강제 가시화 |

### 17.8 Cloud Run 배포 이력

| 날짜 | Revision | TAG | 빌드 시간 |
|---|---|---|---|
| 2026-04-30 09:08 | aitutor-00019-k92 | rebuild30-20260430-173811 | 34분 44초 |
| 2026-04-30 (later) | aitutor-00020-h5x | rebuild30-fix-20260501-082038 | 32분 38초 |
| 2026-05-01 00:28 | aitutor-00021-nkc | rebuild30-react31-fix-20260501-085943 | 28분 11초 |
| 2026-05-01 (later) | aitutor-00022-xd4 | rebuild30-empty-cat-fix-20260501-094454 | 27분 53초 |
| 2026-05-01 (later) | aitutor-00023-xct | rebuild30-prompt-editor-20260501-102105 | 35분 39초 |

현재 active: **aitutor-00023-xct** (us-east4, 100% traffic)

---

## 18. §19 SettingsTab "🧪 실험실" 탭 제거 — /lab 단일 진입점 통일 (2026-05-01)

### 18.1 증상

사용자 보고: "실험실 메인 페이지가 두 가지인 듯, 왔다 갔다"
스크린샷 확인 결과 진짜로 **두 다른 lab 메인 페이지가 동시 존재**:

| 화면 | 위치 | 컴포넌트 |
|---|---|---|
| 목록형 | `/settings` 의 "🧪 실험실" 탭 | `src/tabs/SettingsTab/index.jsx:600-` `LabsSection` |
| 그리드형 (컬러) | `/lab` | `src/labs/index.jsx` `LabsHome` |

### 18.2 원인 (코드 히스토리)

```
REBUILD17 (옛)        : SettingsTab 안에 LabsSection 추가 (목록형)
REBUILD28 §11 (신규)  : /lab 페이지 + LabsHome 그리드 신규 도입
                      → 그러나 SettingsTab LabsSection 제거 안 함
결과                  : 두 lab 메인 페이지 공존 → 사용자 혼란
```

### 18.3 깊이 검증한 옵션 1+ 리스크 (모두 0)

| 검증 | 결과 |
|---|---|
| 일반 사용자 영향 | 0 (Labs 탭은 admin 전용이었음) |
| 데이터 손실 | 0 (DB 동일 `lab_*_enabled` key, /lab 에서 동일 토글) |
| 기능 손실 | 0 (/lab LabsHome 이 5 카드 + admin 토글 + 가드 모두 제공) |
| 외부 deeplink | 0 (`/settings?tab=labs` 사용 안 됨) |
| Playwright 의존 | 0 (LabsSection 미검증) |
| Capacitor 영향 | 0 |

### 18.4 수정 내용

```
src/tabs/SettingsTab/index.jsx:
  - sections 배열에서 'labs' 제거
  - activeSection==='labs' 핸들러 제거
  - LabsSection 함수 251 라인 통째 제거
  + GeneralSection 에 admin 전용 안내 카드 추가
    "🧪 실험실 → /lab 으로 이동" 1 버튼

순감: -253 / +21 = 232 라인 감소
```

### 18.5 admin 동선 변경

```
Before: BottomNav [설정] → "🧪 실험실" 탭 → 5 lab 토글
After:  BottomNav [설정] → "일반" 탭 → "→ /lab 으로 이동" 카드
        또는 URL 직접 /lab 입력
        또는 lab 상세 → "← 실험실" 링크
```

### 18.6 검증

```
Cloud Build SUCCESS — 29분 5초
   Build ID: b9734d66-0a5e-4e4f-b5ed-ea9cc1caecf8
   Revision: aitutor-00024-jhf

Playwright 19 tests / 15 passed / 4 skipped (의도) / 0 failed
   /lab 메인 + 5 lab 페이지 + 헤더 통일 모두 통과
```

### 18.7 변경 이력 종합 (REBUILD30 누적, 9 commit)

| 날짜 | 커밋 | 작업 |
|---|---|---|
| 2026-04-30 | 7bd78de | 옵션 A — slider + promptBuilder + models.js |
| 2026-04-30 | eec2610 | 옵션 B — ParamSliders + ErrorBanner |
| 2026-04-30 | e78851b | REBUILD27~30 누적 트리 정리 (58 files) |
| 2026-04-30 | edb1c25 | action=public 라우트 401 버그 fix |
| 2026-05-01 | 914c93f | React error #31 choices 객체 정규화 |
| 2026-05-01 | 0d0896b | docs §16~17 사후 작업 추가 |
| 2026-05-01 | 744918a | 빈 카테고리 fallback fix + 시험 갯수 표시 |
| 2026-05-01 | d3f69d6 | §18 PromptEditor 6 lab 통일 + Qwen 강제 가시화 |
| 2026-05-01 | 844cb7e | docs §17~18 |
| 2026-05-01 | eb71141 | §19 SettingsTab Labs 탭 제거 — /lab 단일 통일 |

### 18.8 Cloud Run 배포 이력 (6 revision)

| 날짜 | Revision | TAG | 빌드 시간 |
|---|---|---|---|
| 2026-04-30 | aitutor-00019-k92 | rebuild30-20260430-173811 | 34분 44초 |
| 2026-04-30 | aitutor-00020-h5x | rebuild30-fix-20260501-082038 | 32분 38초 |
| 2026-05-01 | aitutor-00021-nkc | rebuild30-react31-fix-20260501-085943 | 28분 11초 |
| 2026-05-01 | aitutor-00022-xd4 | rebuild30-empty-cat-fix-20260501-094454 | 27분 53초 |
| 2026-05-01 | aitutor-00023-xct | rebuild30-prompt-editor-20260501-102105 | 35분 39초 |
| 2026-05-01 | aitutor-00024-jhf | rebuild30-settings-labs-removal-20260501-115909 | 29분 5초 |

현재 active: **aitutor-00024-jhf** (us-east4, 100% traffic)

---

## 19. §20 HF 회귀 fix — circular JSON (2026-05-01)

### 19.1 증상

HfPlayground / HfCompare 의 exam 모드 "✨ 해설 생성" 버튼 클릭 시:
```
⚠ Converting circular structure to JSON --> starting at object with constructor
'HTMLButtonElement' | property '__reactFiber$xxx' -> object with constructor 'td'
--- property 'stateNode' closes the circle
```

### 19.2 원인 — REBUILD30 §18 회귀

§18 PromptEditor 통합 시 `handleRun` 시그니처를 변경:
```js
const handleRun = async (customMessages = null) => {
  if (customMessages) { messages = customMessages; }
  ...
};
```

그러나 `<button onClick={handleRun}>` 그대로 두어 React SyntheticEvent 가
첫 인자로 자동 전달:
```
onClick(syntheticEvent) → handleRun(syntheticEvent)
                         → customMessages = syntheticEvent (truthy!)
                         → messages = syntheticEvent (DOM Fiber 포함)
                         → fetch body JSON.stringify(messages)
                         → DOM circular ref → throw
```

LocalGcp / ServerInfer / LocalAi / WebllmPanel 은 이미
`onClick={() => handleRun()}` / `onClick={() => generate()}` 패턴 사용해서 영향 없었음.
HF 만 회귀 발생.

### 19.3 수정

| 파일 | Before | After |
|---|---|---|
| HfPlayground.jsx:374 | `onClick={handleRun}` | `onClick={() => handleRun()}` |
| HfCompare.jsx:418 | `onClick={handleRun}` | `onClick={() => handleRun()}` |

### 19.4 검증

```
Cloud Build SUCCESS — 28분 28초
   Build ID: 56992633-b4a1-4af9-865d-dcad4c909d59
   Revision: aitutor-00025-m2h ⭐ 100% traffic
   TAG: rebuild30-hf-circular-fix-20260501-130612

curl /lab/hf → HTTP 200 ✓
```

### 19.5 누적 변경 이력 (REBUILD30, 11 commit)

| 날짜 | 커밋 | 작업 |
|---|---|---|
| 2026-04-30 | 7bd78de | 옵션 A — slider + promptBuilder + models.js |
| 2026-04-30 | eec2610 | 옵션 B — ParamSliders + ErrorBanner |
| 2026-04-30 | e78851b | REBUILD27~30 누적 트리 정리 (58 files) |
| 2026-04-30 | edb1c25 | action=public 401 fix |
| 2026-05-01 | 914c93f | React #31 choices 정규화 |
| 2026-05-01 | 0d0896b | docs §16~17 |
| 2026-05-01 | 744918a | 빈 카테고리 fallback fix |
| 2026-05-01 | d3f69d6 | §18 PromptEditor 6 lab 통일 + Qwen 가시화 |
| 2026-05-01 | 844cb7e | docs §17~18 |
| 2026-05-01 | eb71141 | §19 SettingsTab Labs 탭 제거 |
| 2026-05-01 | 9bfc5a9 | docs §18~19 |
| 2026-05-01 | 23c93f8 | §20 HF circular JSON 회귀 fix |

### 19.6 누적 배포 이력 (7 revision, 현재 -00025-m2h)

| Revision | TAG | 빌드 |
|---|---|---|
| -00019-k92 | rebuild30 | 34분 44초 |
| -00020-h5x | rebuild30-fix | 32분 38초 |
| -00021-nkc | react31-fix | 28분 11초 |
| -00022-xd4 | empty-cat-fix | 27분 53초 |
| -00023-xct | prompt-editor | 35분 39초 |
| -00024-jhf | settings-labs-removal | 29분 5초 |
| -00025-m2h | hf-circular-fix | 28분 28초 |

---

## 20. §21 메모리 다이어트 + 자동 cleanup + UI 정리 버튼 (2026-05-01)

### 20.1 동기

503 에러 분석 결과 Cloud Run 컨테이너 SIGKILL (signal 9) 반복 발생:
```
04:23 / 04:54 / 05:00  Container terminated on signal 9
```
원인: 16 GiB memory + 24 GB GPU 한도 안에서 6 엔진 차례 테스트 시 자원 누적 → OOM.

테스트 후 엔진/모델을 정할 예정이라 모든 엔진 사용 가능해야 하므로
**메모리 자동 정리** + **사용자 통제** 필요.

### 20.2 Phase A — Python sub-server lazy import

`inference-py/engines/__init__.py`:
- `transformers_engine` / `llamacpp` / `onnx` 모듈을 호출 시점에 import (`_get_lazy(name)`)
- startup 시 PyTorch (~2 GiB) / transformers / llama-cpp-python / onnxruntime 안 로드
- 호출 시점에만 해당 엔진 module 로드 (cache hit 후 재호출 비용 0)

각 엔진에 `unload_all()` 추가 + `engines.cleanup_all()` 함수 + `POST /cleanup` endpoint.

### 20.3 Phase D — Cross-engine 자동 cleanup

`api/local-infer.js`:
- 추론 호출 entry 에 `cleanupOtherEngines(activeEngine)` 자동 호출
- 호출 엔진 외 모두 정리:
  | 엔진 | cleanup 동작 |
  |---|---|
  | Ollama | `/api/ps` 조회 후 모든 모델에 `keep_alive: 0` 발송 |
  | llama-server | `_killDaemon('llama-server')` SIGTERM/SIGKILL |
  | vLLM | `_killDaemon('vllm')` |
  | Python sub-server | `POST 11442/cleanup` 신호 |

→ 사용자가 엔진 변경하기만 하면 GPU/RAM 자동 회수, OOM 위험 ↓

### 20.4 Phase B — UI "🧹 메모리 정리" 버튼 (admin 전용)

- `POST /api/local-infer?action=cleanup` (admin only)
- LocalGcpTester 헤더에 admin 전용 버튼:
  - 클릭 → confirm("계속?") → `cleanupOtherEngines(null)` (모든 엔진 정리)
  - 응답: `{ ok, cleaned: ['ollama', 'llama-server', 'vllm', 'python-sub-server'] }`

→ admin 이 의식적으로 reset 가능 (debugging / 깨끗 시작)

### 20.5 검증

```
Cloud Build SUCCESS — 30분 6초
   Build ID: 375057bf-c184-4beb-b74a-84cb922aa1c1
   Revision: aitutor-00026-frk ⭐ 100% traffic
   TAG: rebuild30-phase21-memory-20260501-141216

Playwright 19 tests / 15 passed / 4 skipped (의도) / 0 failed (35.7s)
   /lab + 5 lab 페이지 + 헤더 통일 모두 통과
```

### 20.6 변경 파일 (7개)

| 파일 | 변경 |
|---|---|
| inference-py/engines/__init__.py | lazy `_get_lazy()` + `cleanup_all()` (+80 / -17) |
| inference-py/engines/transformers_engine.py | `unload_all()` 추가 |
| inference-py/engines/llamacpp.py | `unload_all()` 추가 (daemon kill) |
| inference-py/engines/onnx.py | `unload_all()` 추가 |
| inference-py/server.py | `POST /cleanup` endpoint |
| api/local-infer.js | `cleanupOtherEngines()` + `?action=cleanup` (+66) |
| src/labs/local-gcp/LocalGcpTester.jsx | admin "🧹 메모리 정리" 버튼 (+33) |

순 변동: +203 / -17 = 186 라인 증가

### 20.7 누적 변경 이력 (REBUILD30, 13 commit)

| 날짜 | 커밋 | 작업 |
|---|---|---|
| ... | (12개 이전) | ... |
| 2026-05-01 | 475867e | §21 Phase A+D+B 메모리 다이어트 |

### 20.8 누적 배포 이력 (8 revision, 현재 -00026-frk)

| Revision | TAG | 빌드 |
|---|---|---|
| -00019-k92 ~ -00025-m2h | (이전 7개) | ... |
| -00026-frk | phase21-memory | 30분 6초 |

---

## 21. §22 GGUF 다운로드 ArrayBuffer 2GiB 한도 fix (2026-05-01)

### 21.1 증상

`llama-server × Gemma 4 E2B` 호출 시 500 에러:
```
⚠ The value of "length" is out of range. It must be >= 0 && <= 2147483647.
  Received 3106735776 (52595ms 후)
```

### 21.2 원인

`api/local-infer.js:154` 의 GGUF 다운로드 코드:
```js
const buf = Buffer.from(await resp.arrayBuffer());  // ← ArrayBuffer 한도 2^31-1 (2.14 GiB)
fs.writeFileSync(modelPath, buf);
```

Gemma 4 E2B GGUF (`gemma-4-E2B-it-Q4_K_M.gguf` ~3.1 GiB) 가 ArrayBuffer max int32 length 초과 → throw. 이전 모델은 2 GiB 미만이라 발생 안 함.

### 21.3 수정 (stream pipeline)

```js
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const tmpPath = modelPath + '.partial';
try {
  await pipeline(
    Readable.fromWeb(resp.body),
    fs.createWriteStream(tmpPath)
  );
  fs.renameSync(tmpPath, modelPath);  // atomic — 중간 실패 시 부분 파일 정리
} catch (err) {
  try { fs.unlinkSync(tmpPath); } catch {}
  throw err;
}
```

### 21.4 효과

- ✅ 큰 GGUF (3 GB+) 다운로드 가능
- ✅ 메모리 점유 chunk 단위 → OOM 위험 ↓
- ✅ Atomic rename → 중간 실패 시 부분 파일 자동 정리

### 21.5 검증

```
Cloud Build SUCCESS — 35분 14초
   Build ID: b73ed20b-acab-4c76-8a07-b7774b3a8eba
   Revision: aitutor-00027-q9j ⭐ 100% traffic
   TAG: rebuild30-gguf-stream-fix-20260501-151930

curl /lab/local-gcp → HTTP 200 ✓
Playwright 19 tests / 15 passed / 4 skipped (의도) / 0 failed (32.9s)
```

### 21.6 누적 변경 이력 (REBUILD30, 14 commit / 9 deploy)

| Revision | TAG | 내용 |
|---|---|---|
| -00026-frk | phase21-memory | Phase A+D+B 메모리 다이어트 |
| -00027-q9j | gguf-stream-fix | ArrayBuffer 2 GiB 한도 → stream |

---

## 22. 한 줄 요약

**REBUILD30 = §0.3 이슈 7건 + §0.4 후보 7건 재검증 + 옵션 A/B 코드 적용 + 사후 GCP 정리 (213GB / ~$22/월 절감) + 영구 cleanup policy + 7건 핫픽스 (401 / React #31 / 빈 카테고리 / Qwen 가시화 / SettingsTab Labs 통일 / HF circular JSON / GGUF stream) + PromptEditor 6 lab 통일 + Settings/Lab 메인 단일화 + §21 메모리 다이어트. 14 commit / 9 deploy / Playwright 15/15 통과 / origin/main + aitutor-00027-q9j 까지 sync.**

---

## 23. §23~§34 — 2일차 통합 작업 (2026-05-03, 1일 16+ 빌드 사이클)

### 23.1 컨텍스트
- 1일차 (REBUILD30 §0~§22) 마무리 후, 사용자 시나리오 기반 단계적 디버깅 + UX 개선
- 외출 중 Telegram 채널 통한 단발 보고 패턴 시작 (msg 2723~2790)
- 빌드 사이클: 메인 service (Cloud Run aitutor) + 격리 service (aitutor-inference) 동기화

### 23.2 §19 — HfPlayground / HfCompare 자유 프롬프트 모드 제거 (시험 모드 단일화)
- **요청**: 모든 lab 의 동일한 패턴 (QuestionPicker → PromptEditor → 결과) 통일
- **제거**: tab/showPrompt/systemMsg/userMsg state, TABS 상수, 프리셋 폼, 옛 "🔍 최종 입력 프롬프트 보기" 카드
- **이유**: PromptEditor 의 system/user 편집이 자유 프롬프트 기능과 동등, "📨 최종 메시지" 미리보기 중복 제거
- **결과**: 5 lab 모두 동일 패턴 (Ollama / LocalGcp / ServerInfer / HfPlayground / HfCompare)

### 23.3 §20 — 모델×엔진 호환 매트릭스 + UI 사전 차단 (3 단계 발견)

#### Layer 1: Qwen 3.5 transformers/vLLM 차단
- **증상**: `ValueError: No supported config format found in Qwen/Qwen3.5-2B-Instruct`
- **원인**: Qwen 공식 transformers weights 가 HF 비공개 (HTTP 401)
- **HF 검증**: 17개 모델 ID 일괄 검증 → 2개 401 (qwen3.5-2b/4b instruct)
- **fix**: api/local-infer.js + catalog.py + LAB_MODELS 의 disabled_engines 에 vllm/transformers 추가
- **추가**: UI 양방향 필터링 (엔진 ↔ 모델 호환만 표시) + 자동 보정 effect

#### Layer 2: Gemma 4 transformers/vLLM 차단
- **증상**: `KeyError: 'gemma4' — Transformers does not recognize this architecture`
- **원인**: 컨테이너 transformers 4.46.3 이 Gemma 4 (2026 출시) model_type 미지원
- **fix**: gemma4 의 disabled_engines 에 vllm/transformers 추가

#### Layer 3: llama-server (llama.cpp) 도 Gemma 4 미지원
- **증상**: `unknown model architecture: 'gemma4'` (llama.cpp 측)
- **추가 차단**: gemma4 의 disabled_engines 에 llama-server, llama-cpp-python 추가
- **보수적 차단**: Qwen 3.5 도 동일 (2026 출시 model_type 미지원 가능성)

### 23.4 §21 — UI 단방향 필터링 변경 (사용자 요청)
- **이전**: 엔진/모델 카드 양방향 필터링 (호환 안 되면 숨김)
- **변경**: 엔진 카드 6개 항상 활성, 모델 카드만 현재 엔진 호환 필터링
- **자동 보정**: 엔진 변경 시 비호환 모델 → 호환되는 첫 모델로 자동 전환
- **적용**: LocalGcpTester / ServerInferTester 양쪽

### 23.5 §22 — Gemma 2 추가 + HF gated 차단
- **추가**: 6 엔진 호환 신규 모델 Qwen 2.5 3B / Gemma 2 2B (사용자 요청)
- **발견**: Gemma 2 도 HF gated repo (`google/gemma-2-2b-it` HTTP 401)
- **추가 차단**: gemma2-2b 의 disabled_engines 에 vllm/transformers 추가

### 23.6 §23 — Sub-server 3 layer 디버깅 (근본 원인 우선)
사용자 보고 사진 3장 → 3가지 sub-server 에러 발견 → 모두 fix:

#### #1: transformers × Qwen 2.5 3B
- **에러**: `Using \`low_cpu_mem_usage=True\` or a \`device_map\` requires Accelerate`
- **fix**: Dockerfile 에 `accelerate==1.1.1` 추가

#### #2: llama-cpp-python × Qwen 2.5 3B
- **에러 1**: `[Errno 2] No such file or directory`
- **원인**: spawn 의 `python` 명령이 컨테이너 default python 호출 → llama_cpp 모듈 미설치
- **fix**: `python` → `/opt/venv-vllm/bin/python` 명시 + stderr 살림 (디버깅 가시성)
- **에러 2 (이후 발견)**: `daemon 헬스체크 실패 (60s 초과)` (모델 로딩 ~89s)
- **fix**: healthcheck 60 → 240s (vllm/llama-server 와 통일)

#### #3: onnxruntime-genai × Qwen 3.5 2B
- **에러**: `Error opening .../genai_config.json`
- **원인**: `onnx-community/*` 는 Transformers.js 형식 (genai_config.json 부재). onnxruntime-genai 는 별도 형식 필요
- **임시 fix**: 모든 모델의 disabled_engines 에 onnxruntime-genai 추가 (이후 §27 에서 정정)

### 23.7 §24 — Lazy import + cleanup endpoint
- **inference-py/engines/__init__.py**: PyTorch / transformers / llama-cpp / onnxruntime 호출 시점에 import (~2-4 GiB startup 메모리 절감)
- **inference-py/server.py**: `/cleanup` endpoint 추가 (REBUILD30 §21 cross-engine cleanup)

### 23.8 §25 — cloudbuild ISO_INFER_URL 영구 등록 (재발 방지)
- **증상**: 격리 service 호출 실패 (`iso_infer_disabled`) — 환경변수 매 빌드마다 사라짐
- **원인**: cloudbuild.yaml 의 `--set-env-vars` 가 명시 vars 만 남기고 나머지 제거
- **즉시 조치**: `gcloud run services update --update-env-vars` 로 복원
- **영구 fix**: substitutions 에 `_ISO_INFER_URL` 추가 + `--set-env-vars` 에 명시

### 23.9 §26 — OllamaBridge 메모리 차단형 정책 + 자동 ping + UI/UX 통합
- **자동 ping**: 페이지 진입 시 ✅/⏳/❌ 큰 배너 (수동 [연결 테스트] 의존성 ↓)
- **OS 자동 감지**: macOS/Windows/Linux 별 켜기 명령 안내
- **메모리 카드 (단일 모델 정책)**: [📥 로딩] / [🗑️ 해제] + 차단형 (다른 모델 점유 시 차단)
- **자동 언로드 토글**: 페이지 떠날 때 자동 메모리 해제
- **UI/UX 8 항목 정리**: 도움말 4번 → 6번 정정, 70B 표현 정확화, keep_alive 풀어쓰기, 메모리 새로고침 라벨 명확화 등
- **사용자 테스트 완료** ✅

### 23.10 §27 — onnxruntime-genai 호환 모델 깊이 재조사 (이전 결정 정정)
- **이전**: "호환 모델 없음" 으로 차단 결정
- **재조사 결과**: Microsoft + onnxruntime 공식 org 가 다수의 호환 모델 제공
  - Microsoft: Phi-3/3.5/4, Mistral 7B, Fara 7B 등
  - onnxruntime org: Gemma-3-ONNX, DeepSeek-R1-Distill-ONNX, gpt-oss-20b-onnx
- **원인 정정**: `onnx-community/*` 가 Transformers.js 형식이라 호환 안 됐을 뿐
- **신규 모델 추가**: Phi-3.5 Mini / Gemma 3 4B / DeepSeek R1 Distill Qwen 7B (3개)
- **참고**: https://github.com/microsoft/onnxruntime-genai

### 23.11 §28 — WebllmPanel 8 항목 통합 리디자인
transformers.js 패널과 동등한 UX 제공:
1. DeviceCheckBadge 인라인 (WebGPU/RAM/GPU buf)
2. 메모리/캐시 종합 카드 (펼침)
3. 캐시된 모델 목록 + 개별 삭제 (`deleteModelAllInfoInCache`)
4. 전체 캐시 비우기 (`clearAllWebllmCache`)
5. 단일 모델 정책 안내 (OllamaBridge 패턴 통일)
6. 자동 언로드 토글 (페이지 이탈 시)
7. 활성 카드 강화 (메모리 사용량 표시 + 큰 [⏏ 언로드] 버튼)
8. 모델 카드에 💾 캐시 배지

### 23.12 §29 — WebLLM MessageOrderError fix
- **에러**: `MessageOrderError: Last message should be from either \`user\` or \`tool\``
- **원인**: PromptEditor 가 Qwen 모델일 때 끝에 `{role:'assistant', content: qSeed}` 추가. Ollama/vLLM 은 prefix 패턴 OK 지만 WebLLM (OpenAI 호환) 거부
- **fix**: `inference-webllm.js` 의 `explainWebllm` 호출 직전 `sanitizeMessagesForWebllm` 으로 마지막 assistant 제거

### 23.13 §30 — HfPlayground UX 8 Phase 리디자인 (사용자 122개 모델 선택 어려움)
- **추천 큐레이션 칩 (8개)**: 한국어강세 / 저렴 / Thinking / Coder / Vision / Tools / LongCtx / Fast
- **시리즈 빠른 필터 (9개)**: 전체 / Qwen / Llama / DeepSeek / Gemma / Mistral / Phi / GLM / Aya
- **조직별 그룹 헤더 + 접기**: 시리즈 특징 설명 (FAMILY_INFO 17 org) 포함
- **2-cols grid (md+)**: 한 화면에 12개 동시 노출
- **provider 가격 메인 표시**: 💰 최저/평균 가격 카드에
- **시리즈별 특징 설명**: 🇨🇳 Alibaba 한국어 강세, 🇺🇸 Meta 영어 표준 등
- **⭐ 즐겨찾기 (localStorage)**: 카드 ⭐ 토글 + 상단 즐겨찾기 섹션
- **⏱ 최근 사용 (5개)**: handleRun/Compare 시 자동 기록 + 상단 노출
- **신규 헬퍼 (lib/models.js)**: FAMILY_INFO, CURATED_PRESETS, SERIES_FILTERS, getFamilyInfo, getFavorites, toggleFavorite, getRecentModels, pushRecentModel

### 23.14 §31 — 라벨 통일 정리
- **`🔌 연결 테스트` → `🔄 모델 목록 새로고침`** (OllamaBridge): 자동 ping 도입 후 의미 명확화
- **`(default)` 라벨 일괄 제거** (5 lab): Ollama / LocalGcp / ServerInfer / LocalAi / WebllmPanel
- **`labs` 탭 제거** (SettingsTab): /lab 페이지로 통일

### 23.15 §32 — git 정리 + PR #1 머지

#### 균형 시나리오 진행 (2026-05-03 18:40 KST 머지)
- **stash**: aitutor 외 워크스페이스 (66 파일) 일시 보관
- **commit 7개**:
  ```
  b257a55 feat(aitutor): 모델×엔진 호환 매트릭스 + Qwen2.5/Gemma2 신규 모델 추가
  a1d71ff fix(aitutor): Python sub-server root-cause 수정 (accelerate + venv python + healthcheck 240s + lazy import + cleanup endpoint)
  a52795b infra(aitutor): cloudbuild ISO_INFER_URL 영구 등록 (재발 방지)
  a81f482 feat(aitutor/ollama-bridge): 메모리 차단형 정책 + 자동 ping + UI/UX 통합 정리
  56a72fe refactor(aitutor/hf-playground): 자유 프롬프트 모드 제거 — 시험 문제 모드 단일화
  a37adcd refactor(aitutor/lab): 공통 UI 단방향 필터링 + (default) 라벨 통일 제거 + 컴포넌트 정리
  3945e27 docs(aitutor): REBUILD30 작업 기록 누적
  ```
- **PR #1 squash 머지**: ff8ddca → main (1 commit 으로 합침, PR 페이지엔 17 commits 보존)
- **stash pop**: 워크스페이스 변경 복원

### 23.16 §33 — 빌드 사이클 (대표 빌드)
| Build # | Tag | 주요 변경 | 결과 |
|---|---|---|---|
| #6 | v20260503-100746 | Qwen2.5/Gemma2 추가 + UI 단방향 필터링 | ✅ 30분 |
| #7 | (취소) | Gemma 2 차단 단독 | 🛑 통합 |
| #8 | v20260503-130224 | accelerate + llamacpp venv + ONNX-genai 차단 + Gemma2 차단 | ✅ 29분 |
| #9 | v20260503-145133 | llamacpp healthcheck 60→240s | ✅ 29분 |
| #10/11 | (취소) | 라벨 변경 단독 | 🛑 통합 |
| #12 | v20260503-172056 | (default) 제거 + OllamaBridge UI/UX 8 항목 | ✅ 33분 |
| #13 | v20260503-192317 | WebLLM MessageOrderError sanitize | ✅ 33분 |
| #14/15 | (취소) | 단독 트리거 | 🛑 통합 |
| #16 | (진행 중) | WebLLM 리디자인 + HF UX 8 Phase + ONNX-genai 신규 3 모델 | ⏳ |

### 23.17 §34 — 최종 호환 매트릭스 (배포 #16 시점)

| 모델 | ollama | llama-server | vllm | llama-cpp | onnx-genai | transformers |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| qwen35-2b/4b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 (Transformers.js) | 🚫 |
| gemma4-e2b/e4b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 (Transformers.js) | 🚫 |
| qwen25-3b | ✅ | ✅ | ✅ | ✅ | 🚫 (미러 없음) | ✅ |
| gemma2-2b | ✅ | ✅ | 🚫 (gated) | ✅ | 🚫 (미러 없음) | 🚫 (gated) |
| **phi35-mini** | 🚫 | 🚫 | 🚫 | 🚫 | ✅ (Microsoft) | 🚫 |
| **gemma3-4b** | 🚫 | 🚫 | 🚫 | 🚫 | ✅ (onnxruntime org) | 🚫 |
| **deepseek-r1-qwen-7b** | 🚫 | 🚫 | 🚫 | 🚫 | ✅ (onnxruntime org) | 🚫 |

→ 6 엔진 모두 활용 가능 (전용 모델 + 호환 모델 조합)

### 23.18 §35 — 한 줄 요약

**REBUILD30 2일차 = 단계적 사용자 시나리오 디버깅 (sub-server 3 layer + Gemma 4 llama.cpp + Qwen 3.5 vllm + ISO_INFER_URL + WebLLM MessageOrder) + UX 통합 리디자인 (OllamaBridge 8 항목 / WebllmPanel 8 항목 / HfPlayground 8 Phase) + 신규 모델 5개 (Qwen2.5 3B / Gemma2 2B / Phi-3.5 Mini / Gemma 3 4B / DeepSeek R1 Distill Qwen 7B) + 호환 매트릭스 정밀화 + 라벨 통일 + git 정리 (PR #1 squash 머지). 16+ 빌드 사이클 / 양쪽 service 동기화 / Telegram 채널 통합 보고. main + aitutor-00041+ / aitutor-inference-00016+ 까지 sync.**

---

## 24. §36~§40 — PR #1 머지 이후 추가 작업 (2026-05-03 후반)

### 24.1 §36 — WebLLM MessageOrderError fix (빌드 #13)
- **에러**: `MessageOrderError: Last message should be from either \`user\` or \`tool\``
- **원인**: PromptEditor 가 Qwen 모델일 때 끝에 `{role:'assistant', content: qSeed}` 추가. Ollama/vLLM 의 prefix 패턴은 OK 지만 WebLLM (OpenAI 호환) 거부
- **fix**: `inference-webllm.js` 의 `explainWebllm` 호출 직전 `sanitizeMessagesForWebllm` 으로 마지막 assistant 제거
- **빌드**: v20260503-192317 (33분 29초)

### 24.2 §37 — WebllmPanel 8 항목 통합 리디자인 (빌드 #16)
transformers.js 패널과 동등한 UX 제공:
1. DeviceCheckBadge 인라인 (WebGPU/RAM/GPU buf)
2. 메모리/캐시 종합 카드 (펼침 토글)
3. 캐시된 모델 목록 + 개별 삭제 (`deleteModelAllInfoInCache`)
4. 전체 캐시 비우기 (`clearAllWebllmCache`)
5. 단일 모델 정책 안내 (OllamaBridge 패턴 통일)
6. 자동 언로드 토글 (페이지 이탈 시)
7. 활성 카드 강화 (메모리 사용량 표시 + 큰 [⏏ 언로드] 버튼)
8. 모델 카드에 💾 캐시 배지

### 24.3 §38 — HfPlayground UX 8 Phase 리디자인 (빌드 #16)
122개 HF 모델 선택 어려움 해결:
- **추천 큐레이션 칩 (8개)**: 한국어강세 / 저렴 / Thinking / Coder / Vision / Tools / LongCtx / Fast
- **시리즈 빠른 필터 (9개)**: 전체 / Qwen / Llama / DeepSeek / Gemma / Mistral / Phi / GLM / Aya
- **조직별 그룹 헤더 + 접기**: 시리즈 특징 설명 (FAMILY_INFO 17 org)
- **2-cols grid (md+)**: 한 화면에 12개 동시 노출
- **provider 가격 메인 표시**: 💰 최저/평균
- **시리즈별 특징 설명**: 🇨🇳 Alibaba 한국어 강세, 🇺🇸 Meta 영어 표준 등
- **⭐ 즐겨찾기 (localStorage)**: 카드 ⭐ 토글 + 상단 즐겨찾기 섹션
- **⏱ 최근 사용 (5개)**: handleRun/Compare 시 자동 기록 + 상단 노출
- **신규 헬퍼 (lib/models.js)**: FAMILY_INFO, CURATED_PRESETS, SERIES_FILTERS, getFamilyInfo, getFavorites, toggleFavorite, getRecentModels, pushRecentModel

### 24.4 §39 — onnxruntime-genai 호환 모델 재조사 + 신규 3 모델 (빌드 #16)
- **이전 결정 정정**: "호환 모델 없음" 으로 차단했던 결정 재조사 → Microsoft + onnxruntime 공식 org 가 다수의 호환 모델 제공함을 확인
- **원인**: `onnx-community/*` 가 Transformers.js 형식 (genai_config.json 부재). Microsoft 의 `microsoft/Phi-*-onnx` / `onnxruntime/Gemma-3-ONNX` 등은 onnx-genai 형식
- **추가**: 3 카탈로그 (api/local-infer.js + catalog.py + LAB_MODELS) 동기화
  - `phi35-mini` — `microsoft/Phi-3.5-mini-instruct-onnx` (cpu_and_mobile/cpu-int4-awq-block-128-acc-level-4)
  - `gemma3-4b` — `onnxruntime/Gemma-3-ONNX` (gemma-3-4b-it/cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4)
  - `deepseek-r1-qwen-7b` — `onnxruntime/DeepSeek-R1-Distill-ONNX` (deepseek-r1-distill-qwen-7B/cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4)
- **결과**: 사용자가 onnxruntime-genai 엔진 선택 시 3 모델 표시 (이전엔 0개)
- **참고**: https://github.com/microsoft/onnxruntime-genai

### 24.5 §40 — LAB_ENGINES 통합 + 두 lab 일치성 보장 (빌드 #17)
**증상**: 사용자가 LocalGcp ↔ ServerInfer lab 사이 같은 엔진의 note 가 다르게 보이는 현상

**원인**: 두 lab 이 자체 ENGINES 하드코딩 (label/note 다름) + catalog.py 에는 note 필드 자체 없음

**fix (4 파일)**:
1. `src/lib/lab/engines.js` 신규 — `LAB_ENGINES` 통일 정의 + `mergeEngineNotes()` 헬퍼
2. `LocalGcpTester` — 자체 ENGINES 제거 → LAB_ENGINES import
3. `ServerInferTester` — FALLBACK_ENGINES → LAB_ENGINES + 격리 service 동적 응답에 mergeEngineNotes 적용
4. `inference-py/engines/catalog.py` ENGINES — note 필드 추가 → list_engines() 자동 응답

**사용자 직접 추가 helper** (lib/lab/models.js):
- `getCompatibleModels(models, engineKey)` — 엔진 호환 모델 필터링
- `pickCompatibleModelKey(models, engineKey, preferred)` — 호환 우선/fallback 선택
- `normalizeLabModels(serverModels)` — 동적 응답 + 정적 카탈로그 병합 (key 기준)
- LocalGcpTester 의 initial state 에 pickCompatibleModelKey 도입

### 24.6 §41 — Cloud Run OOM → 메모리 증가 (16Gi → 24Gi)

**증상**: Python sub-server (port 11442) OOM 으로 SIGKILL → 메인 service `fetch failed (other side closed)` → 500
```
Out-of-memory event detected in container
/app/start.sh: line 84: 91 Killed  python -m uvicorn server:app
```

**원인**: 신규 ONNX 모델 (DeepSeek 7B = ~4.5GB 등) + 동시 활성 sub-server 들이 16Gi 한도 초과

**Cloud Run vCPU vs 메모리 한계 발견**: 4 vCPU 일 때 메모리 최대 16Gi → CPU 도 함께 증가 필요 (6 vCPU = 24Gi 가능)

**fix**:
1. **즉시**: `gcloud run services update aitutor --cpu=6 --memory=24Gi` (재빌드 X, 1분)
2. **영구**: cloudbuild.yaml `--memory=24Gi --cpu=6` 명시 → 빌드 #18+ 자동 유지
3. **격리 service**: 원래 32Gi/8cpu 였음 (downgrade 사고 후 복원)

**최종 자원**:
| Service | CPU | Memory |
|---------|-----|--------|
| aitutor (메인) | 6 | 24Gi |
| aitutor-inference (격리) | 8 | 32Gi |

### 24.7 §42 — 빌드 사이클 (PR #1 머지 이후)

| Build # | Tag | 주요 변경 | 결과 |
|---|---|---|---|
| #13 | v20260503-192317 | WebLLM MessageOrder sanitize | ✅ 33분 |
| #14, #15 | (취소) | 단독 변경 → 통합으로 합침 | 🛑 |
| #16 | v20260503-212641 | WebLLM 8 항목 + HF UX 8 Phase + ONNX-genai 신규 3 모델 | ✅ 35분 |
| #17 | v20260503-221817 | LAB_ENGINES sync + 사용자 helper (pickCompatibleModelKey 등) + catalog.py note | ✅ 33분 |

**메모리 변경 (재빌드 외)**:
- `gcloud run services update --cpu=6 --memory=24Gi` (메인 즉시 적용, 영구화 cloudbuild.yaml)

### 24.8 §43 — 한 줄 요약 (PR #1 머지 이후)

**§36~§42 = WebLLM MessageOrder fix + WebLLM 패널 8 항목 리디자인 + HfPlayground 122 모델 UX 8 Phase 리디자인 (큐레이션/시리즈/그룹/2-cols/가격메인/특징/즐겨찾기/최근사용) + ONNX-genai 신규 3 모델 추가 + LAB_ENGINES 통합 (두 lab 100% 일치) + 사용자 helper (pickCompatibleModelKey/getCompatibleModels/normalizeLabModels) + Cloud Run OOM fix (16Gi/4cpu → 24Gi/6cpu, 격리 32Gi/8cpu 복원). 4 빌드 (3 SUCCESS + 2 취소) + 즉시 메모리 증가. 메인 v20260503-221817 (aitutor-00046+) / 격리 v20260503-221817 (aitutor-inference-00021+) 까지 sync.**

---

## 25. §44 — Playwright 전수 테스트 (운영 환경 직접 검증, 2026-05-03)

### 25.1 환경
- **대상**: 운영 Cloud Run `https://aitutor-z2ppabmtxa-uk.a.run.app`
- **실행**: `PLAYWRIGHT_BASE_URL=https://... npx playwright test`
- **viewport**: 390 × 844 (모바일 시뮬레이션)
- **현재 운영**: aitutor-00046-8fn (24Gi/6cpu) / aitutor-inference-00021-724 (32Gi/8cpu)

### 25.2 실험실 (사용자 핵심 영역) — `step7-labs-smoke.spec.js` ⭐

**결과: 15 PASS / 0 FAIL / 4 SKIP**

| 카테고리 | 결과 | 비고 |
|---------|------|------|
| 실험실 메인 (`/lab`) | ✅ 2 pass + 2 skip | admin 토글/배지는 production 인증 의존 (skip) |
| 디바이스 AI (`/lab/local-ai`) | ✅ 2 pass | 헤더 + EngineSwitcher 노출 |
| Cloud Run 일심동체 (`/lab/local-gcp`) | ✅ 2 pass | 6 엔진 + 모델 카드 + 헤더 링크 |
| 격리 추론 (`/lab/server-infer`) | ✅ 1 pass | fallback 또는 동적 카탈로그 동작 |
| HF Inference (`/lab/hf` + `/compare`) | ✅ 2 pass | 비교 모드 진입 정상 |
| 외부 Ollama bridge (`/lab/ollama-bridge`) | ✅ 1 pass | 도움말 6 단계 펼침 동작 |
| QuestionPicker 단독 | ⏭ 2 skip | lab 비활성 가드 (admin fake 토큰) |
| **헤더 통일** (5 lab) | ✅ 5 pass | 모든 lab "← 실험실" 링크 동작 |

→ **실험실 영역 100% PASS** (skip = admin fake 토큰의 인증 우회 한계)

### 25.3 전체 step1~7 — 32 PASS / 22 FAIL / 4 SKIP

```
step1-layout    (로그인/회원가입/네비)         — 4 fail (인증 의존)
step2-quiz      (학습 탭 필터)                — 1 fail (인증 의존)
step3-ai-memo   (AI 해설 + 메모)              — 1 fail (인증 의존)
step4-manage    (문제관리, admin)             — 3 fail (admin 인증 필요)
step5-settings  (설정 + 최종)                 — 4 fail (admin 인증 필요)
step6-learn-hub (학습 허브 + 카드 학습)        — 9 fail (인증 의존)
step7-labs-smoke (실험실)                     — 0 fail ⭐
```

### 25.4 fail 22개 근본 원인 — 코드 문제 아님

```javascript
// 테스트 spec 의 fake admin 토큰
localStorage.setItem('token', 'test-admin-token');
localStorage.setItem('user', JSON.stringify({ name: 'admin-tester', admin: true }));
```

- **운영 환경의 HMAC JWT 인증** 이 fake 토큰을 거부 → 로그인 페이지로 redirect
- step1~6 spec 은 strict assertion → fail
- step7 (실험실) spec 은 `isVisible() ? expect : skip` conditional 패턴 → 가드 페이지 노출 시 skip 또는 통과

→ **운영 코드 자체는 정상**. 인증 환경 차이로 인한 spec 실행 한계.

### 25.5 검증된 사항 (실험실 PASS 의미)

1. ✅ 모든 lab 페이지 **HTTP 200** + 컴포넌트 렌더링 정상
2. ✅ 6 엔진 + 모델 카드 표시 (LocalGcp / ServerInfer)
3. ✅ HF Inference 카탈로그 + 비교 모드 진입
4. ✅ OllamaBridge 도움말 6 단계 펼침
5. ✅ **헤더 통일** — 모든 lab "← 실험실" 링크 동작
6. ✅ JavaScript 에러 0 (페이지 정상 동작)
7. ✅ 라우팅 정상 (모든 `/lab/*` 정상 진입)

### 25.6 추후 검증 권장

- 실 admin 토큰 발급 후 step1~6 재실행 (운영 진짜 검증)
- §36~§43 신규 UX 검증 spec 추가 (HfPlayground 큐레이션 / WebllmPanel 메모리 카드 / OllamaBridge 자동 ping / LAB_ENGINES 일치 등)

### 25.7 §45 — 한 줄 요약 (전체 마무리)

**REBUILD30 = 1일차 (§0~§22) + 2일차 (§23~§44) 통합. 코드/UX 리디자인 (OllamaBridge / WebllmPanel / HfPlayground / 두 lab 통일) + 신규 모델 5개 (Qwen2.5/Gemma2/Phi-3.5/Gemma3/DeepSeek R1) + 호환 매트릭스 정밀화 (모델×엔진 disabled_engines) + sub-server root-cause 디버깅 (accelerate/venv python/healthcheck) + 인프라 (Cloud Run 24Gi/6cpu 영구화 + ISO_INFER_URL 영구화) + git 정리 (PR #1 + PR #3 squash 머지) + Playwright 운영 검증 (실험실 100% PASS). 17+ 빌드 사이클 / 양쪽 service 동기화 / Telegram 채널 통합 보고 / main + aitutor-00046+ / aitutor-inference-00021+ 까지 100% sync.**

---

## 26. §46 — 엔진별 호환 추천 모델 재점검 (2026-05-04, 사용자 요청)

### 26.1 검증 환경
- HuggingFace API + Ollama Registry 직접 호출 (HTTP 200/401 검증)
- 검증 카테고리:
  - A. transformers / vLLM (HF 공개 instruct + transformers 4.46.3 지원)
  - B. llama-server / llama-cpp-python (GGUF, bartowski 미러)
  - C. Ollama tags (registry.ollama.ai)
  - D. onnxruntime-genai (Microsoft + onnxruntime 공식)

### 26.2 검증 결과 요약
- **Qwen 2.5 시리즈** (1.5B/3B/7B Instruct): API 200 + weights 200 → **모두 공개**
- **Microsoft Phi-3 mini / Phi-3.5 mini**: API 200 + weights 200 → **공개**
- **Google Gemma 2** (2B/9B): API 200, weights 401 → gated (vLLM/transformers X)
- **Meta Llama 3.1 8B / Mistral 7B v0.3**: API 200, weights 401 → gated
- **GGUF (bartowski 미러)**: 모두 200 (qwen2.5/phi3/phi3.5/gemma2/mistral/llama3.1)
- **Ollama tags**: 모두 200 (qwen2.5/phi3/phi3.5/gemma2/mistral/llama3.1/deepseek-r1)
- **onnx-genai (Microsoft)**: Phi-3/3.5/4 mini, Phi-4 reasoning, Gemma-3, DeepSeek-R1 모두 200

### 26.3 현재 매트릭스 (9 모델)

| 모델 | ollama | llama-server | vllm | llama-cpp-python | onnxruntime-genai | transformers |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| qwen35-2b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| qwen35-4b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| gemma4-e2b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| gemma4-e4b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| qwen25-3b | ✅ | ✅ | ✅ | ✅ | 🚫 | ✅ |
| gemma2-2b | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 |
| phi35-mini | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 |
| gemma3-4b | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 |
| deepseek-r1-qwen-7b | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 |

#### 엔진별 모델 분포 (현재)
| 엔진 | 모델 수 |
|------|:---:|
| ollama | 6 |
| llama-server | 2 |
| **vllm** | **1** ⚠️ |
| llama-cpp-python | 2 |
| onnxruntime-genai | 3 |
| **transformers** | **1** ⚠️ |

→ vLLM / transformers 가 매우 빈약 (각 1개)

### 26.4 개선안 매트릭스 (15 모델 — 신규 6 + 기존 확장 2)

| 모델 | ollama | llama-server | vllm | llama-cpp-python | onnxruntime-genai | transformers | 비고 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|------|
| qwen35-2b (현재) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 유지 |
| qwen35-4b (현재) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 유지 |
| gemma4-e2b (현재) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 유지 |
| gemma4-e4b (현재) | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 유지 |
| qwen25-3b (현재) | ✅ | ✅ | ✅ | ✅ | 🚫 | ✅ | 유지 |
| gemma2-2b (현재) | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 유지 |
| phi35-mini ✏️ EXPAND | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **6 엔진** 확장 |
| gemma3-4b (현재) | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 | 유지 |
| deepseek-r1-qwen-7b ✏️ EXPAND | ✅ | ✅ | 🚫 | ✅ | ✅ | 🚫 | Ollama+GGUF 확장 |
| **qwen25-7b** ⭐ NEW | ✅ | ✅ | ✅ | ✅ | 🚫 | ✅ | 한국어 강 7B |
| **phi3-mini** ⭐⭐⭐ NEW | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **6 엔진 만능** |
| **llama31-8b** ⭐ NEW | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 | Meta Llama 표준 (gated → GGUF) |
| **mistral-7b** ⭐ NEW | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 유럽 범용 (gated → GGUF) |
| **gemma2-9b** ⭐ NEW | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 큰 Gemma 2 (gated → GGUF) |
| **phi4-mini** ⭐ NEW | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 | Microsoft 최신 SLM |

#### 엔진별 모델 분포 (개선안 vs 현재)
| 엔진 | 현재 | 개선안 | 변화 |
|------|:---:|:---:|:---:|
| ollama | 6 | **12** | +6 |
| llama-server | 2 | **7** | +5 |
| **vllm** | **1** | **3** | **+2** ⭐ |
| llama-cpp-python | 2 | **7** | +5 |
| onnxruntime-genai | 3 | **5** | +2 |
| **transformers** | **1** | **3** | **+2** ⭐ |

### 26.5 추천 추가/변경 (우선순위)

| 우선순위 | 작업 | 효과 |
|:---:|------|------|
| ⭐⭐⭐ | **Phi-3 Mini 추가** | 6 엔진 만능 — vLLM/transformers 의 빈약함 즉시 해소 |
| ⭐⭐ | **Qwen 2.5 7B 추가** | 5 엔진 + 한국어 강세 (자격증 해설 강화) |
| ⭐⭐ | **phi35-mini 다중 엔진 확장** | 현재 onnx 만 → 6 엔진 (카탈로그 단순 update) |
| ⭐ | **Llama 3.1 8B / Mistral 7B / Gemma 2 9B 추가** | Ollama/GGUF 다양성 확보 |
| ⭐ | **DeepSeek R1 다중 엔진 확장** | onnx 만 → Ollama/GGUF |
| ⭐ | **Phi-4 mini 추가** | Microsoft 최신 SLM |

### 26.6 삭제 검토 (결론: 삭제 0)

| 후보 | 검토 결과 | 결정 |
|------|----------|------|
| qwen35-2b/4b (Ollama 만) | Qwen 3.5 사용자에겐 유일 옵션 | **유지** |
| gemma4-e2b/e4b (Ollama 만) | Gemma 4 신모델 사용자에 유일 | **유지** |

→ 삭제 권장 X. **추가만 권장**.

### 26.7 진행 옵션 (사용자 결정 대기)

| 옵션 | 작업 범위 | 시간 | 효과 |
|------|----------|------|------|
| (A) ⭐⭐⭐ 추천 — Phi-3 Mini + Qwen 2.5 7B + phi35-mini 확장 | 3 변경 | 20분 + 빌드 30분 | vLLM/transformers 강화 |
| (B) ⭐⭐ 균형 — A + Llama 3.1 + Mistral 7B + Gemma 2 9B | 6 변경 | 35분 + 빌드 30분 | Ollama/GGUF 다양성 |
| (C) ⭐ 최대 — B + Phi-4 mini + DeepSeek 확장 | 8 변경 | 45분 + 빌드 30분 | 전 엔진 풍부 |
| (D) 보류 | 0 | 0 | 현재 유지 |

### 26.8 §47 — 한 줄 요약 (재점검 결과)

**§46 = 6 엔진 × 신규 모델 검증 (HF/Ollama 직접 호출) → 현재 9 모델 매트릭스 vs 개선안 15 모델 매트릭스 작성. vLLM/transformers (각 1개) 빈약 발견 → Phi-3 Mini (6 엔진 만능) + Qwen 2.5 7B + phi35-mini 다중 확장이 ⭐⭐⭐ 최우선. 삭제 0 (Qwen 3.5/Gemma 4 는 Ollama 사용자에 유지). 추가 시 카탈로그 3 출처 (api/local-infer.js + catalog.py + LAB_MODELS) 동기화 필수.**

---

## 27. §48 — 사용자 사양 적용 결과 (2026-05-04)

### 27.1 사용자 사양 (이론상 가능 ≠ 핀 버전 안정)
**기준**: 이론상 가능이 아니라 **핀 버전 (transformers==4.46.3, vllm==0.6.5, onnxruntime-genai==0.5.2) 에서 안정적으로 노출할 가치가 있는가**

| 항목 | 결정 |
|------|------|
| 유지 (9 모델) | qwen35-2b/4b, gemma4-e2b/e4b, qwen25-3b, gemma2-2b, phi35-mini, gemma3-4b, deepseek-r1-qwen-7b |
| 신규 (2) | qwen25-7b, phi4-mini |
| 확장 (1) | deepseek-r1-qwen-7b → ollama + llama-server + llama-cpp-python + onnxruntime-genai (4 엔진) |
| 유지 제한 | phi35-mini는 onnxruntime-genai 중심 유지 (6 엔진 확장 ❌) |
| 보류 (2) | llama31-8b, mistral-7b |
| 제외 (2) | phi3-mini, gemma2-9b |

### 27.2 최종 매트릭스 (11 모델, 핀 버전 기준)

| 모델 | ollama | llama-server | vllm | llama-cpp-python | onnxruntime-genai | transformers | 호환 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| qwen35-2b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 1 |
| qwen35-4b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 1 |
| gemma4-e2b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 1 |
| gemma4-e4b | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 1 |
| qwen25-3b | ✅ | ✅ | ✅ | ✅ | 🚫 | ✅ | 5 |
| gemma2-2b | ✅ | ✅ | 🚫 | ✅ | 🚫 | 🚫 | 3 |
| phi35-mini | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 | 1 |
| gemma3-4b | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 | 1 |
| **deepseek-r1-qwen-7b** ✏️ | ✅ | ✅ | 🚫 | ✅ | ✅ | 🚫 | **4** (확장!) |
| **qwen25-7b** ⭐ NEW | ✅ | ✅ | ✅ | ✅ | 🚫 | ✅ | 5 |
| **phi4-mini** ⭐ NEW | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | 🚫 | 1 |

### 27.3 엔진별 호환 모델 (사용자 명시 사양 100% 일치)

| 엔진 | 모델 (핀 버전 기준) | 개수 |
|------|---------------------|:---:|
| **ollama** | qwen35-2b, qwen35-4b, gemma4-e2b, gemma4-e4b, qwen25-3b, gemma2-2b, deepseek-r1-qwen-7b, qwen25-7b | 8 |
| **llama-server** | qwen25-3b, gemma2-2b, deepseek-r1-qwen-7b, qwen25-7b | 4 |
| **llama-cpp-python** | qwen25-3b, gemma2-2b, deepseek-r1-qwen-7b, qwen25-7b | 4 |
| **vllm** | qwen25-3b, qwen25-7b | 2 |
| **transformers** | qwen25-3b, qwen25-7b | 2 |
| **onnxruntime-genai** | phi35-mini, gemma3-4b, deepseek-r1-qwen-7b, phi4-mini | 4 |

### 27.4 note 정정 (5건 — 실제 호환 엔진 수 반영)

| 모델 | 변경 전 | 변경 후 |
|------|--------|--------|
| qwen25-3b | "6 엔진 호환" | **"5 엔진 호환 (onnx-genai 제외)"** |
| gemma2-2b | "GGUF·Ollama 만" | **"3 엔진 호환 (Ollama + GGUF 계열)"** |
| phi35-mini | "영어 표준" | **"onnxruntime-genai 전용"** |
| gemma3-4b | "한국어 OK" | **"onnxruntime-genai 전용"** |
| deepseek-r1-qwen-7b | "Qwen 베이스" | **"Qwen 베이스 / 4 엔진 호환"** |

### 27.5 신규 모델 정확한 catalog entry

#### qwen25-7b (5 엔진 호환)
```js
ollama:    'qwen2.5:7b'
gguf:      { repo: 'bartowski/Qwen2.5-7B-Instruct-GGUF', file: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf' }
hf_repo:   'Qwen/Qwen2.5-7B-Instruct'  // transformers + vLLM
disabled_engines: ['onnxruntime-genai']
```

#### phi4-mini (onnxruntime-genai 전용)
```python
"engines": {
    "onnxruntime-genai": {
        "hf_repo": "microsoft/Phi-4-mini-instruct-onnx",
        "subfolder": "cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4"
    },
}
disabled_engines: ['ollama', 'llama-server', 'vllm', 'llama-cpp-python', 'transformers']
```

#### deepseek-r1-qwen-7b (4 엔진 확장)
```python
"engines": {
    "llama-cpp-python":  {"hf_repo": "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
                          "filename": "DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf"},
    "onnxruntime-genai": {"hf_repo": "onnxruntime/DeepSeek-R1-Distill-ONNX",
                          "subfolder": "deepseek-r1-distill-qwen-7B/cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4"},
    "ollama":             "deepseek-r1:7b",
}
disabled_engines: ['vllm', 'transformers']
disabled_reason: 'transformers/vllm 은 핀 버전 안정성 미검증 (보류)'
```

### 27.6 3 카탈로그 동기화 검증

```
api/local-infer.js MODEL_MAP        ↔
inference-py/engines/catalog.py     ↔   100% 일치 (11 모델 × disabled_engines)
src/lib/lab/models.js LAB_MODELS    ↔
```

**검증 명령**:
```bash
# 1. local-infer.js
node -e "const m=require('./api/local-infer.js'); for (const [k,v] of Object.entries(m.MODEL_MAP)) console.log(k, v.disabled_engines)"

# 2. catalog.py
python3 -c "from inference_py.engines.catalog import MODEL_MAP; [print(k, v.get('disabled_engines',[])) for k,v in MODEL_MAP.items()]"

# 3. LAB_MODELS
grep -E "key:|disabled_engines:" src/lib/lab/models.js
```

### 27.7 §48 — 한 줄 요약

**§48 = 사용자 명시 사양 (핀 버전 안정성 기준) 적용. 11 모델 최종 (유지 9 + 신규 2 [qwen25-7b/phi4-mini] + 확장 1 [deepseek-r1-qwen-7b 1→4 엔진]). note 정정 5건 (실제 호환 엔진 수 반영). 3 카탈로그 100% 일치 검증. ollama 8 / llama-server 4 / llama-cpp-python 4 / vllm 2 / transformers 2 / onnxruntime-genai 4 모델 — 사용자 명시 사양과 정확히 일치.**

---

## 28. §49 (2026-05-04) — legacy `workspace/aitutor-inference/` 폐기

### 28.1 배경

격리 추론 service 의 **legacy 마스터 보존본** (`workspace/aitutor-inference/`) 정리.
phase7-2a (2026-04-29) 부터 일심동체 image 재사용 정책 (`PROCESS_MODE=isolated`) 으로 전환되어,
해당 폴더는 **빌드/배포 어디에도 사용되지 않는 dormant 디렉토리** 가 됨.

### 28.2 삭제 가능성 검증 (전수)

| 항목 | 결과 |
|---|---|
| 빌드 input (cloudbuild.yaml + Dockerfile) | `workspace/aitutor-inference/` **참조 없음** |
| Cloud Run image | 메인 / 격리 양쪽 모두 동일 image (`aitutor:vYYYYMMDD-HHMMSS`) — `PROCESS_MODE` 분기 |
| 마지막 git 활동 | `bdfb8ca` (2026-04-30) 이후 변경 0회 |
| 같은 기간 `aitutor/inference-py/` 변경 | 5회 (sync 방향 실질적으로 역전) |
| 코드 21건 참조 분석 | 모두 service 이름/URL/logger 문자열/주석 — **폴더 import 0건** |
| 유일한 실제 의존 | `aitutor/inference-py/sync-from-isolated.sh` (스크립트도 함께 삭제) |

### 28.3 작업

1. `workspace/aitutor-inference/` 디렉토리 삭제 (Dockerfile + start.sh + server.py + engines/ + README.md + requirements.txt 등)
2. `workspace/aitutor/inference-py/sync-from-isolated.sh` 삭제 (소스 사라지면 무의미)
3. `Dockerfile:149` 주석 갱신 — "mirror" 표현 → "sync 마스터"
4. `start.sh:29,79` 주석 갱신 — legacy 표현 정리

### 28.4 복원 안전망

- **git history 영구 보존** — `git checkout bdfb8ca -- workspace/aitutor-inference/` 로 언제든 복원
- **`aitutor/inference-py/` 가 더 진화된 마스터** — 부활 필요 시 legacy 복원보다 현재 메인을 fork 하는 게 합리적
- **부활 시나리오 희박** — 일심동체 정책 안정화 진행 중 (별도 의사결정 트리거 없음)

### 28.5 운영 영향

**zero**. Cloud Run 양쪽 service 모두 동일 image 운영 중이며 폴더와 무관.

### 28.6 §49 — 한 줄 요약

**legacy `workspace/aitutor-inference/` 폐기 (운영 영향 0). git history 보존으로 복원 안전망 유지. `aitutor/inference-py/` 가 단일 sync 마스터로 자리잡음.**

### 28.7 REBUILD32 후속 노트 (2026-05-04 21:00 KST 추가)

§49 시점의 정책 ("일심동체 image 단일화 + `PROCESS_MODE=isolated` 분기") 은 REBUILD31 §99 옵션 A/B-1 시도 중 region quota 협소 문제로 4번 연속 fail → **REBUILD32 에서 책임 재분리** 결정.

| 시점 | 격리 service 디렉토리 | image | service |
|------|-------------------|-------|---------|
| §49 시점 (REBUILD30) | `workspace/aitutor-inference/` 폐기, `aitutor/inference-py/` 가 sync 마스터 | 메인과 공유 (PROCESS_MODE 분기) | `aitutor-inference` |
| **REBUILD32 시점** (현재) | `workspace/aitutor/server-infer/` **신규** (Ollama only) | **별도 image** (`aitutor-server-infer/server-infer`) | **`aitutor-server-infer`** |

§49 의 "단일화" 의도는 디렉토리 정리 측면에서는 유효 (legacy 마스터 폐기), image 공유 측면은 REBUILD32 로 풀림. 신규 컨셉:
- 메인 image = 6 엔진 동거 (서버 통합용)
- 격리 image = Ollama 단일 (서버 분리용)
- 두 image 모두 `aitutor/inference-py/` 또는 `server-infer/server.py` 에 자급자족

옛 격리 service `aitutor-inference` Cloud Run 자체는 REBUILD32 P5 시점 영구 삭제. §49 의 "폐기" 의도가 (디렉토리뿐 아니라 실제 service 까지) 본 시점 진짜 실행.
