# REBUILD34 — `aitutor` 코드베이스 재분석 및 후속 개선 제안

> **작성**: 2026-05-06 KST
> **갱신**: 2026-05-06 KST — §11 진행 현황 (P0/P1/P2 backlog 항목별 완료/이연 표 추가)
> **요청**: 현재 코드베이스 분석 + `REBUILD32.md` / `REBUILD33.md` 참조 기반 아키텍처, 현황 구조, 개선 필요 지점 제안
> **범위**: 코드 변경 없음. 분석/제안 문서 작성만 수행.
> **검증**: `npm run build:fe` 성공, `server-infer/server.py` 문법 확인 성공, Node 라우트 require 확인 성공

---

## §0. 결론 요약

현재 `workspace/aitutor` 는 REBUILD32/33 의 핵심 방향이 대부분 반영된 상태다.

| 영역 | 현재 상태 | 판단 |
|------|-----------|------|
| 메인 service `aitutor` | Express + Vite static + Ollama 단일 엔진, 3 모델 | REBUILD33 A++-2 / 매장 로컬 AI 컨셉 반영 |
| 격리 service `aitutor-server-infer` | FastAPI + Ollama 단일 엔진, 풍부한 모델 catalog | REBUILD32 단일 엔진 격리 컨셉 반영 |
| 옛 multi-engine | `inference-py/` 제거됨, llama-server/vLLM/Python sub-server 제거됨 | 구조적 슬림화 완료 |
| 실험실 UI | `/lab/local-gcp`, `/lab/server-infer`, `/lab/local-ai`, `/lab/hf`, `/lab/ollama-bridge` 유지 | 기능별 분리는 명확함 |
| 주요 남은 부채 | 동시성, 운영 제어 권한, catalog/fallback 불일치, stale 주석/테스트 | 후속 정리가 필요 |

REBUILD32 는 “격리 추론 service 를 Ollama 단일 엔진으로 재설계”했고, REBUILD33 은 “메인 service 도 Ollama 단일 엔진 + 최소 모델로 슬림화하되, 통합/분리 컨셉은 독립 유지”로 수렴했다. 현재 코드는 이 방향과 대체로 일치한다.

다만 지금부터의 병목은 “엔진 수”가 아니라 운영 안정성이다. 특히 Cloud Run concurrency=10 상태에서 Ollama 단일 daemon, 전역 `_lastServedModel`, 모델 unload 정책, 번역 보조 `keep_warm` 이 동시에 존재한다. 서로 다른 모델 요청이 겹치면 모델 unload/load 가 경합할 수 있다. 이 부분은 P0 로 다루는 것이 맞다.

---

## §1. 분석 기준

### 1.1 참조 문서

- `workspace/aitutor/rebuild-docs/REBUILD32.md`
  - 옛 격리 service `aitutor-inference` 폐기
  - 신규 `aitutor-server-infer` 신설
  - Ollama 단일 엔진
  - 별도 Dockerfile / Cloud Build / Cloud Run service
  - 메인 service 는 `/api/iso-infer` 로 ID token forward

- `workspace/aitutor/rebuild-docs/REBUILD33.md`
  - 메인 service 슬림화 재수립
  - A++-2 채택: 메인도 Ollama 단일 엔진 유지
  - 통합 service = 매장 로컬 AI, 3 모델 최소 catalog
  - 격리 service = 회사 전체 추론 자산, 다중 모델 catalog
  - `inference-py/` 제거, Python sub-server 제거
  - 서버 분리 UI 모델 14개 재설계, 이후 번역 보조 모델 추가

### 1.2 확인한 주요 파일

| 파일 | 역할 |
|------|------|
| `server.js` | Express 진입점, API 라우트 동적 등록, static SPA serving |
| `Dockerfile` | 메인 service image, CUDA runtime + Node + Ollama |
| `start.sh` | 메인 service Ollama daemon + Express 시작 |
| `cloudbuild.yaml` | 메인 Cloud Build + Cloud Run 배포 |
| `api/local-infer.js` | 메인 통합 추론 API, Ollama 단일 엔진 + 3 모델 |
| `api/iso-infer.js` | 격리 service forward proxy, ID token 인증 |
| `server-infer/server.py` | 격리 service FastAPI, Ollama catalog + 추론 + 메모리 제어 |
| `server-infer/Dockerfile` | 격리 service image, CUDA runtime + Python/FastAPI + Ollama |
| `server-infer/cloudbuild.yaml` | 격리 service Cloud Build + Cloud Run 배포 |
| `src/labs/local-gcp/LocalGcpTester.jsx` | 메인 통합 실험실 UI |
| `src/labs/server-infer/ServerInferTester.jsx` | 격리 추론 실험실 UI |
| `src/lib/lab/models.js` | 실험실 fallback 모델 union catalog |
| `src/components/lab/MemoryCard.jsx` | 통합/격리 메모리 상태 및 unload/restart UI |
| `tests/step7-labs-smoke.spec.js` | 실험실 UI smoke 테스트 |

---

## §2. 현재 아키텍처

### 2.1 전체 구조

```
workspace/aitutor
├─ server.js                         # Express runtime
├─ api/                              # Node API handlers
│  ├─ local-infer.js                 # 메인 통합 Ollama 추론
│  ├─ iso-infer.js                   # 격리 service proxy
│  ├─ gemini/openai/claude/hf        # 외부 LLM API
│  ├─ kisa-*                         # KISA 학습/시험 모듈
│  ├─ questions/memos/bookmarks/...  # 본업 CRUD
│  └─ _runtime, _llm, _kisa          # shared runtime helpers
├─ src/                              # React/Vite frontend
│  ├─ pages, tabs, components
│  ├─ labs/                          # 실험실 모듈
│  ├─ lib/lab                        # lab 공통 helper/catalog
│  └─ tracks                         # KISA track 추상화
├─ server-infer/                     # 격리 추론 service
│  ├─ server.py
│  ├─ Dockerfile
│  ├─ start.sh
│  └─ cloudbuild.yaml
├─ kisa-module, driver-module        # 콘텐츠/문항 모듈
├─ scripts                           # import/seed/update scripts
└─ rebuild-docs                      # 설계/운영 이력 문서
```

현재 `inference-py/` 디렉토리는 존재하지 않는다. REBUILD33 Phase 2 결과가 실제 코드에 반영된 상태다.

### 2.2 런타임 1 — 메인 service `aitutor`

```
Cloud Run: aitutor
├─ Container: nvidia/cuda:12.4 runtime 기반
├─ Process tree
│  ├─ Ollama daemon (:11434)
│  └─ Express (:8080)
├─ API
│  ├─ /api/local-infer     # localhost Ollama 호출
│  ├─ /api/iso-infer       # 격리 service proxy
│  ├─ /api/gemini/openai/claude/hf
│  └─ 본업 CRUD / KISA endpoints
└─ Static
   └─ dist/ React SPA
```

메인 service 의 추론 catalog 는 `api/local-infer.js` 기준 3개다.

| key | Ollama tag | 용도 |
|-----|------------|------|
| `qwen25-3b` | `qwen2.5:3b` | default, 한국어 강, 영어 번역 가능 |
| `gemma2-2b` | `gemma2:2b` | 경량 fallback |
| `qwen35-4b` | `qwen3.5:4b` | 고성능 옵션 |

현재 Cloud Run spec 은 `cloudbuild.yaml` 기준 `24Gi / 6 vCPU / L4 GPU 1개 / concurrency=10 / max-instances=1` 이다. REBUILD33 의 “메인 GPU 유지, 매장 로컬 AI 컨셉 보존” 결정과 일치한다.

### 2.3 런타임 2 — 격리 service `aitutor-server-infer`

```
Cloud Run: aitutor-server-infer
├─ Container: nvidia/cuda:12.4 runtime 기반
├─ Process tree
│  ├─ Ollama daemon (:11434)
│  └─ FastAPI/Uvicorn (:8080)
├─ Auth
│  └─ --no-allow-unauthenticated
├─ API
│  ├─ GET  /healthz
│  ├─ GET  /infer/models
│  ├─ POST /infer
│  ├─ GET  /memory
│  ├─ POST /memory/unload-all
│  └─ POST /memory/restart-container
└─ 호출자
   └─ 메인 service /api/iso-infer 가 ID token 으로 forward
```

격리 service 는 REBUILD33 §33.10 이후 15개 모델 구조로 보는 것이 정확하다.

| category | 개수 | 예시 |
|----------|------|------|
| `korean` | 8 | Qwen 3.5/2.5, Gemma 2/4, DeepSeek R1 |
| `english` | 5 | Phi 3.5, Phi 4, Llama 3.1/3.2, Mistral |
| `code` | 1 | Qwen 2.5 Coder 7B |
| `translator` | 1 | Qwen 2.5 1.5B |
| **합계** | **15** | 기존 “14개” 설명보다 1개 증가 |

이 “15개” 상태가 현재 코드의 실제 상태다. REBUILD33 의 초기 “14개” 표현은 번역 보조 모델 추가 전 기준이라 일부 주석/문구가 stale 이다.

### 2.4 Frontend 실험실 구조

| 경로 | 역할 | 현재 연결 |
|------|------|-----------|
| `/lab` | 실험실 홈 | DB setting 기반 lab toggle |
| `/lab/local-gcp` | 서버 통합, 매장 로컬 AI | `/api/local-infer` |
| `/lab/server-infer` | 서버 분리, 회사 자산 추론 | `/api/iso-infer` |
| `/lab/local-ai` | 온디바이스 WebGPU | transformers.js / WebLLM |
| `/lab/hf` | HF Inference Providers | `/api/hf`, `/api/hf-models` |
| `/lab/ollama-bridge` | 사용자 PC Ollama | 브라우저에서 localhost bridge |

실험실은 모듈 단위 lazy loading 구조라 기본 학습 화면과 실험 기능이 어느 정도 분리되어 있다.

---

## §3. REBUILD32/33 대비 실제 반영 상태

### 3.1 완료된 것

| 항목 | 근거 | 상태 |
|------|------|------|
| 격리 service 별도 image 분리 | `server-infer/` 존재 | 완료 |
| 격리 service Ollama 단일화 | `server-infer/server.py`, Dockerfile | 완료 |
| 메인 service Ollama 단일화 | `api/local-infer.js`, `Dockerfile`, `start.sh` | 완료 |
| `inference-py/` 제거 | 디렉토리 없음 | 완료 |
| llama-server/vLLM/Python sub-server 제거 | Dockerfile/start.sh/API 단순화 | 완료 |
| `/lab/local-gcp` 단일 엔진 UI | `LocalGcpTester.jsx` | 완료 |
| `/lab/server-infer` 단일 엔진 + 모델 카테고리 UI | `ServerInferTester.jsx` | 완료 |
| 격리 service 메모리 상태/unload/restart | `server.py`, `MemoryCard.jsx` | 완료 |
| 통합 service 메모리 상태/unload/restart | `local-infer.js`, `MemoryCard.jsx` | 완료 |
| Qwen/DeepSeek thinking 정책 | `server.py`, `ParamSliders.jsx` | 완료 |
| 번역 보조 파이프라인 | `server.py`, `ServerInferTester.jsx` | 완료 |

### 3.2 부분 완료 또는 보정 필요

| 항목 | 현재 문제 | 제안 |
|------|-----------|------|
| 격리 모델 수 표현 | 코드상 15개인데 UI/주석 일부는 14개 표현 유지 | “15 모델” 기준으로 문구 정정 |
| 모델 fallback catalog | `server.py` 에 translator 모델 존재, `LAB_MODELS` 에는 없음 | 의도라면 명시, 아니면 fallback 에 translator 추가 |
| category filter | `CATEGORY_META.translator` 는 있으나 필터 버튼 목록에 `translator` 없음 | translator chip 추가 또는 의도적으로 숨긴다는 주석 |
| stale comments | `inference-py`, 6엔진, 16Gi/4CPU 표현 잔존 | 운영 사실 기준 주석 정리 |
| tests | `step7-labs-smoke.spec.js` 가 6엔진/옛 UI 기준 | 테스트 전면 갱신 |
| Cloud Run concurrency | 단일 Ollama daemon + unload 정책인데 concurrency=10 | queue/lock 또는 concurrency=1 검토 |

---

## §4. 핵심 리스크

### 4.1 P0 — 동시성 경합

현재 메인/격리 모두 Cloud Run `--concurrency=10`, `--max-instances=1` 이다. 동시에 여러 사용자가 서로 다른 모델을 호출할 수 있다.

문제 지점:

| 파일 | 상태 |
|------|------|
| `api/local-infer.js` | `_lastServedModel` 전역 상태, `unloadOtherModels()` 로 keep 모델 외 unload |
| `server-infer/server.py` | `_last_served_model` 전역 상태, `unload_other_models()` 로 keep 모델 외 unload |
| `ServerInferTester.jsx` | 번역 보조 ON 시 translator 모델 + 대상 모델을 `keep_warm=True` 로 동시에 유지 |
| Cloud Run | concurrency=10 이라 서로 다른 요청이 같은 daemon/model state 공유 |

가능한 장애:

- 요청 A가 `phi4` 추론 중인데 요청 B가 `qwen25-3b` 호출하며 `phi4` unload 시도
- 번역 파이프라인 1/3, 2/3, 3/3 사이에 다른 요청이 모델을 unload
- `_last_served_model` 이 실제 Ollama 메모리 상태와 불일치
- 모델 전환 시 응답 지연, 502, 빈 응답, OOM, 불규칙한 latency 발생

권장 조치:

| 우선순위 | 조치 | 설명 |
|----------|------|------|
| P0-1 | Cloud Run concurrency 임시 1로 낮추기 | 가장 빠른 안정화. 비용/처리량보다 모델 안정성 우선 |
| P0-2 | 서비스 내부 async queue/lock 도입 | Node는 promise queue, FastAPI는 `asyncio.Lock` 으로 `/infer` critical section 보호 |
| P0-3 | 번역 파이프라인 서버 측 endpoint 화 | 클라이언트 3회 호출 대신 `/infer/translate-assisted` 1회로 원자화 |
| P0-4 | 모델 unload 정책을 “요청 종료 후”로 조정 | 추론 중 unload 경합 방지 |

단기적으로는 `--concurrency=1` 이 가장 현실적이다. 장기적으로는 inference queue 를 넣고 concurrency 를 다시 올리는 방향이 맞다.

### 4.2 P0 — 운영 제어 API 권한

현재 다음 endpoint 는 `withAuth` 수준이다.

| Endpoint | 영향 |
|----------|------|
| `POST /api/local-infer?action=unload-all` | 메인 service Ollama 모델 unload |
| `POST /api/local-infer?action=restart-container` | 메인 Cloud Run 컨테이너 종료, 본업도 순간 중단 |
| `POST /api/iso-infer?action=unload-all` | 격리 service 모델 unload |
| `POST /api/iso-infer?action=restart-container` | 격리 service 컨테이너 종료 |

`restart-container` 는 실질적으로 운영 제어 기능이다. 특히 통합 service 에서는 DB/메모/Gemini 해설 등 본업도 영향을 받는다. 일반 로그인 사용자에게 열려 있으면 운영 리스크가 크다.

권장 조치:

- `restart-container` 는 admin 전용으로 제한
- `unload-all` 도 최소한 lab-admin 또는 admin 전용으로 검토
- 사용자용으로는 “내 세션 이후 자동 unload 요청” 같은 약한 기능만 노출
- 서버 측 audit log 추가: `user.uid`, endpoint, service, timestamp, loaded models

### 4.3 P1 — 동적 가용성 판정의 UX 부정확성

현재 `_check_model_available` 은 “현재 free VRAM/RAM” 기준이다. 하지만 시스템은 단일 모델 정책이라 모델 전환 전 기존 모델을 unload 할 수 있다.

문제:

- 큰 모델이 이미 로드되어 있으면 다른 모델이 “VRAM 부족”으로 disabled 될 수 있다.
- 실제로는 unload 후 사용 가능한데 UI 에서는 사용 불가로 보인다.
- 번역 보조 `keep_warm` 은 예외적으로 2개 모델을 동시에 유지하므로 다른 계산이 필요하다.

권장 조치:

| 상태 | UI 표현 |
|------|---------|
| 현재 free 기준 가능 | `사용 가능` |
| unload 후 가능 | `전환 가능, 기존 모델 unload 필요` |
| unload 후에도 불가 | `자원 부족` |
| 번역 보조 동시 유지 시 불가 | `번역 보조 ON 에서는 자원 부족` |

서버 응답도 다음처럼 확장하면 된다.

```json
{
  "available_now": true,
  "available_after_unload": true,
  "available_with_translator": false,
  "unavailable_reason": null
}
```

### 4.4 P1 — catalog 독립 원칙과 schema 중복의 균형

REBUILD32/33 의 “통합/분리 catalog 독립” 원칙은 타당하다. 다만 현재는 독립 catalog 뿐 아니라 schema, fallback, 주석, UI category 도 분산되어 있다.

현재 source:

| Source | 역할 |
|--------|------|
| `api/local-infer.js` | 메인 3 모델 진실 소스 |
| `server-infer/server.py` | 격리 15 모델 진실 소스 |
| `src/lib/lab/models.js` | 프론트 fallback union |
| `LocalGcpTester.jsx` | 메인 fallback 3 모델 |
| `ServerInferTester.jsx` | category meta, translator constants |

권장 원칙:

- catalog 값은 계속 독립 유지
- 하지만 “모델 응답 schema” 는 공통 계약으로 문서화
- runtime 응답을 우선하고 fallback 은 최소화
- fallback 에는 `schema_version`, `source`, `generated_at` 을 넣어 디버깅 가능하게 함
- 독립 catalog 를 강제로 sync 하는 검증은 금지하되, “중복 key”, “필수 필드 누락”, “UI category 미정의” 정도의 lint 는 허용

### 4.5 P1 — stale 주석/문서 잔재

코드상 주요 stale 표현:

| 파일 | 잔재 |
|------|------|
| `server-infer/server.py` | `inference-py/engines/catalog.py`, “통합 6 엔진 동거” 설명 |
| `src/lib/lab/models.js` | `inference-py` 진실 소스 주석, 6엔진 호환 설명 |
| `api/config.js` | “8 엔진 동거” 주석 |
| `src/App.jsx` | 격리 service “16Gi/4CPU” 주석 |
| `cloudbuild.yaml` | `16Gi/4CPU` 설명과 실제 `24Gi/6CPU` 혼재 |
| `server-infer/cloudbuild.yaml` | 상단 설명은 16Gi/4CPU, 실제는 24Gi/6CPU |
| `tests/step7-labs-smoke.spec.js` | 6엔진/옛 실험실 기준 |

권장 조치:

- 사용자 노출 문구뿐 아니라 코드 주석도 “운영 사실” 기준으로 정리
- REBUILD 이력은 `rebuild-docs/` 에만 두고, 코드 주석은 현재 동작의 why 만 남김
- spec 숫자는 한 파일에 상수화하기보다 배포 yaml 기준으로 명확히 적고, 주석은 최소화

### 4.6 P1 — 테스트가 현재 구조를 보호하지 못함

`tests/step7-labs-smoke.spec.js` 는 주석과 기대값이 옛 6엔진 구조다. 지금 구조에서는 테스트가 통과해도 현재 핵심 기능을 제대로 검증하지 못한다.

갱신이 필요한 테스트:

| 테스트 | 기대값 |
--------|--------|
| `/lab/local-gcp` | Ollama 단일 엔진, 모델 3개, 엔진 dropdown 없음 |
| `/lab/server-infer` | Ollama 단일 엔진, category chip, 모델 15개 또는 backend fallback 처리 |
| 번역 보조 UI | 한국어 약 모델 선택 시만 토글 노출 |
| thinking UI | Qwen 3.5/DeepSeek 선택 시 토글 노출, 권장값 다름 |
| 메모리 카드 | unload/restart 버튼 권한/표시 정책 |
| API smoke | `GET /api/local-infer?action=models`, `GET /api/iso-infer?action=models` 응답 schema |

추론 자체는 비용/시간이 있으므로 smoke 단계에서는 호출하지 않아도 된다. 대신 catalog schema 와 UI 조건부 렌더링은 반드시 잡아야 한다.

### 4.7 P2 — image 크기와 번들 크기

검증 중 `npm run build:fe` 는 성공했지만 다음 경고가 있었다.

| 경고 | 내용 |
|------|------|
| JSX duplicate attribute | `src/components/ui/LoadingOverlay.jsx` 에 `opacity` 속성 중복 |
| chunk size warning | `index-C3h0PJdy.js` 약 6MB, `ort-wasm` 약 23MB |

REBUILD33 §30 에 따르면 메인 image 는 4.81GB 까지 줄었지만, 목표 2GB 에는 못 미쳤다. 주 원인은 CUDA runtime base 와 시스템 패키지다.

권장 조치:

- `LoadingOverlay.jsx` 의 중복 `opacity` 속성 제거
- `local-ai` 관련 heavy dependency 를 더 강하게 lazy split
- Vite `manualChunks` 검토: WebLLM/transformers/ORT 계열 분리
- Docker base 를 `nvidia/cuda:*base*` 또는 Ollama GPU 동작 가능한 최소 image 로 실험
- `apt` 설치 후 불필요 패키지/캐시 점검

---

## §5. 우선순위별 개선안

### 5.1 P0 — 즉시 권장

#### P0-1. 추론 service concurrency 안정화

목표: 모델 unload/load 경합 제거.

선택지:

| 옵션 | 작업 | 장점 | 단점 |
|------|------|------|------|
| A | Cloud Run `--concurrency=1` | 가장 빠르고 안전 | 동시 요청 처리량 감소 |
| B | `/infer` 내부 mutex/queue | UX 안정 + concurrency 유지 가능 | 코드 변경 필요 |
| C | 모델별 queue + unload manager | 가장 정교 | 과함 |

추천: 먼저 A 로 안정화 후 B 를 구현한다.

#### P0-2. restart/unload 권한 재정의

목표: 일반 사용자가 운영 컨테이너를 재시작하지 못하게 함.

제안:

- `restart-container`: admin only
- `unload-all`: admin only 또는 lab-admin only
- UI 버튼도 admin 에게만 노출
- API 에서도 반드시 권한 검증
- 실행 로그 저장

#### P0-3. 번역 파이프라인 원자화

현재 번역 보조는 클라이언트에서 `/api/iso-infer` 를 3번 호출한다. 중간에 다른 요청이 끼면 모델 상태가 흔들릴 수 있다.

제안 endpoint:

```http
POST /infer/translate-assisted
{
  "target_model_key": "phi35-mini",
  "messages": [...],
  "max_tokens": 2048,
  "temperature": 0.3,
  "think": null
}
```

서버 내부에서 한 lock 안에서 `ko->en`, `infer`, `en->ko` 를 실행하면 상태 관리가 단순해진다.

### 5.2 P1 — 다음 스프린트 권장

#### P1-1. catalog schema contract 도입

catalog 독립 원칙은 유지하되, 공통 필드는 계약화한다.

필수 필드 제안:

```ts
type LabModel = {
  key: string;
  name: string;
  org: string;
  size: string;
  note: string;
  category?: 'korean' | 'english' | 'code' | 'translator';
  tier?: 'light' | 'balanced' | 'heavy';
  recommended?: boolean;
  capabilities?: {
    think_supported?: boolean;
    think_default?: boolean;
    multimodal?: boolean;
    context_k?: number;
    tools?: boolean;
    coder?: boolean;
    translator?: boolean;
  };
  params?: {
    temperature?: number;
    top_p?: number;
    repeat_penalty?: number;
  };
  korean_strength?: number;
  available?: boolean;
  unavailable_reason?: string | null;
};
```

검증은 “같은 모델이어야 한다”가 아니라 “각 service 응답이 UI contract 를 만족한다”만 확인한다.

#### P1-2. stale 주석 정리

대상:

- `server-infer/server.py`
- `src/lib/lab/models.js`
- `api/config.js`
- `src/App.jsx`
- `cloudbuild.yaml`
- `server-infer/cloudbuild.yaml`
- `tests/step7-labs-smoke.spec.js`

원칙:

- REBUILD 번호 제거
- 옛 엔진명 제거
- 현재 service spec 기준 정정
- “왜 이 구조인가”만 남김

#### P1-3. 실험실 테스트 재작성

현재 smoke test 는 옛 구조를 설명한다. 다음 기준으로 교체한다.

| describe | 핵심 검증 |
|----------|-----------|
| `/lab/local-gcp` | 매장 로컬 AI, 3 모델 fallback, Ollama 단일 엔진 |
| `/lab/server-infer` | 단일 엔진, category chips, recommended/all 동작 |
| `ParamSliders` | think 토글/translate 토글 조건부 렌더 |
| `MemoryCard` | 버튼 노출/confirm/call endpoint |
| API schema | models 응답 필수 필드 |

#### P1-4. 동적 가용성 개선

서버가 현재 상태와 unload 후 상태를 구분해 내려준다.

추가 필드:

- `available_now`
- `available_after_unload`
- `available_with_translator`
- `requires_unload`
- `estimated_required_ram_mb`
- `estimated_required_vram_mb`

UI 는 disabled 대신 “전환 가능”과 “불가”를 구분한다.

### 5.3 P2 — 운영 품질 개선

#### P2-1. 관측성 보강

현재 로그는 기능별 console/logging 위주다. 다음을 추가하면 장애 분석이 쉬워진다.

- request id
- user id hash
- service name
- model_key
- ollama_tag
- think mode
- translate mode
- pull_ms / unload_ms / infer_ms / total_ms
- error_code
- loaded model count
- GPU/RAM snapshot

#### P2-2. API route registry 명시화

`server.js` 는 `apiFiles` 를 순회하며 require 실패 시 warn 만 찍고 계속 실행한다. 개발 중에는 편하지만 운영에서는 특정 API 누락이 조용히 지나갈 수 있다.

제안:

- required routes 와 optional routes 를 분리
- required route 로드 실패 시 startup fail
- optional/lab route 만 warn
- `/api/health/routes` 로 loaded/missing route 노출

#### P2-3. Docker image 추가 슬림화

메인 image 4.81GB 는 30분 빌드 시절보다는 많이 줄었지만 여전히 크다.

실험 순서:

1. CUDA `runtime` → `base` 전환 가능성 검증
2. Ollama GPU 동작 확인
3. NodeSource 대신 official node + CUDA 조합 검토
4. apt package 최소화
5. build cache layer 재배치

#### P2-4. Frontend chunk 분리

`local-ai` 계열은 기본 학습 사용자에게 필요 없는 대형 의존성이 많다.

제안:

- `@huggingface/transformers`, `@mlc-ai/web-llm`, ORT wasm 계열 별도 chunk
- `/lab/local-ai` 진입 시에만 다운로드
- Vite `manualChunks` 로 lab별 chunk 명확화
- bundle analyzer 추가

---

## §6. 제안 작업 순서

### Phase 1 — 운영 안전성 먼저

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | Cloud Run concurrency=1 검토/적용 | 배포 spec 변경 |
| 2 | restart/unload admin 권한화 | API + UI |
| 3 | `/infer` lock 추가 | Node/FastAPI 코드 |
| 4 | 번역 파이프라인 서버 endpoint 화 | FastAPI + proxy + UI |

### Phase 2 — 현재 구조 정리

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | stale 주석 정정 | 코드 주석 정리 |
| 2 | “14개” → “15개” 모델 표현 정정 | server-infer UI/docs |
| 3 | translator category chip 정책 결정 | UI 수정 |
| 4 | catalog schema contract 작성 | docs 또는 `src/lib/lab/schema` |

### Phase 3 — 테스트 갱신

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | `step7-labs-smoke.spec.js` 현재 UI 기준 재작성 | Playwright |
| 2 | API schema smoke test 추가 | Playwright/APIRequest |
| 3 | 권한 테스트 추가 | restart/unload admin 제한 검증 |

### Phase 4 — 성능/비용 최적화

| 순서 | 작업 | 산출물 |
|------|------|--------|
| 1 | frontend chunk 분리 | Vite config |
| 2 | Docker base image 실험 | 별도 branch/build |
| 3 | image size/build time 실측 | REBUILD 후속 문서 |

---

## §7. 현재 검증 결과

### 7.1 `npm run build:fe`

결과: 성공.

관측:

- Vite build 성공
- 경고: `src/components/ui/LoadingOverlay.jsx` 중복 `opacity` attribute
- 경고: 일부 chunk 500KB 초과
- 큰 산출물:
  - `ort-wasm-simd-threaded.asyncify` 약 23MB
  - main/lab 계열 JS chunk 중 약 6MB chunk 존재

### 7.2 Python syntax

명령:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/aitutor-pycache python3 -m py_compile server-infer/server.py
```

결과: 성공.

메모:

- 기본 `python3 -m py_compile` 은 macOS 사용자 cache 디렉토리에 쓰려다 sandbox 권한 문제로 실패했다.
- `PYTHONPYCACHEPREFIX=/private/tmp/...` 지정 후 정상 통과.

### 7.3 Node require smoke

명령:

```bash
node -e "require('./api/local-infer'); require('./api/iso-infer'); require('./server'); console.log('ok')"
```

결과: 성공.

관측:

- `[Auth] 인증 시크릿이 올바르게 설정되지 않았습니다.` 경고 출력
- 로컬 환경에서 secret 미설정으로 인한 정상적인 경고로 보임
- module load 자체는 성공

---

## §8. 상세 개선 Backlog

### 8.1 P0 Backlog

| ID | 항목 | 근거 | 제안 |
|----|------|------|------|
| P0-A | inference concurrency 안정화 | Cloud Run concurrency=10 + 전역 model state | concurrency=1 또는 queue |
| P0-B | restart-container 권한 제한 | withAuth 로 일반 사용자 가능 | admin only |
| P0-C | unload-all 권한 정책 | 운영 자원에 영향 | admin/lab-admin 검토 |
| P0-D | 번역 파이프라인 원자화 | 3번 client call 사이 경합 가능 | 서버 단일 endpoint |

### 8.2 P1 Backlog

| ID | 항목 | 근거 | 제안 |
|----|------|------|------|
| P1-A | “14 모델” 표현 정정 | translator 추가로 실제 15 | UI/주석/docs 정정 |
| P1-B | translator filter chip | `CATEGORY_META` 에 있지만 버튼 없음 | 추가 또는 숨김 의도 명시 |
| P1-C | stale 주석 정리 | `inference-py`, 6엔진, 16Gi 잔재 | 현재 운영 기준으로 정리 |
| P1-D | dynamic availability 개선 | unload 후 가능 모델도 disabled 가능 | now/after_unload 분리 |
| P1-E | catalog schema contract | catalog 독립과 UI 안정성 균형 | 필수 필드 lint |
| P1-F | Playwright lab test 갱신 | 현재 테스트는 옛 6엔진 기준 | 현재 UI 기준 재작성 |

### 8.3 P2 Backlog

| ID | 항목 | 근거 | 제안 |
|----|------|------|------|
| P2-A | route registry required/optional 분리 | require 실패가 warn 으로 묻힘 | required fail-fast |
| P2-B | observability | 모델 장애 분석에 request trace 부족 | structured log |
| P2-C | frontend chunk split | Vite large chunk warning | manualChunks |
| P2-D | Docker base slim | 메인 image 4.81GB | CUDA base 실험 |
| P2-E | LoadingOverlay JSX warning | duplicate attribute | 간단 수정 |

---

## §9. 권장 의사결정

### Q1. 추론 concurrency 정책

추천: **A — 우선 Cloud Run concurrency=1 적용 후 queue 구현**

| 선택 | 내용 |
|------|------|
| A | concurrency=1 우선 적용, 이후 내부 queue 도입 |
| B | concurrency=10 유지, 내부 lock 만 먼저 구현 |
| C | 현상 유지 |

이유: 현재 구조는 단일 Ollama daemon + 단일 모델 정책이라 병렬 처리보다 상태 안정성이 중요하다.

### Q2. 운영 제어 버튼 권한

추천: **A — restart/unload 모두 admin 전용**

| 선택 | 내용 |
|------|------|
| A | restart/unload 모두 admin 전용 |
| B | restart 만 admin, unload 는 일반 사용자 허용 |
| C | 현상 유지 |

이유: 통합 service 재시작은 본업을 잠시 중단할 수 있다.

### Q3. 격리 모델 수/UI 표현

추천: **A — 15 모델 기준으로 정정하고 translator chip 추가**

| 선택 | 내용 |
|------|------|
| A | 15 모델 명시 + translator category chip 추가 |
| B | translator 는 내부 보조 모델로 숨기고 전체 카운트에서 제외 |
| C | 현상 유지 |

이유: 현재 `models.length` 는 translator 포함 15로 흐를 수 있어 “14개” 문구와 충돌한다.

### Q4. 다음 REBUILD 작업 범위

추천: **A — 운영 안정성(P0)만 먼저**

| 선택 | 내용 |
|------|------|
| A | P0만 먼저: concurrency, 권한, 번역 endpoint |
| B | P0+P1 동시: 주석/테스트/catalog 정리까지 |
| C | 문서만 보관, 구현 보류 |

---

## §10. 최종 판단

`aitutor` 는 REBUILD32/33 이후 “무거운 multi-engine 실험 컨테이너”에서 “본업 앱 + 두 가지 Ollama 추론 경로”로 재정렬되었다.

현재 구조의 장점:

- 메인/격리 service 역할이 명확하다.
- 메인 본업과 매장 로컬 AI 컨셉이 보존됐다.
- 격리 service 는 회사 전체 자산으로 확장 가능한 형태다.
- 옛 Python multi-engine 부채가 제거됐다.
- UI 는 실험 목적별로 분리되어 있다.

현재 구조의 핵심 위험:

- 단일 Ollama daemon 위에서 동시 요청과 unload 정책이 충돌할 수 있다.
- 컨테이너 재시작 같은 운영 제어가 일반 인증 사용자에게 열려 있다.
- 모델 수/카테고리/fallback/schema 의 표현이 일부 불일치한다.
- 테스트와 주석이 과거 구조를 아직 설명한다.

따라서 REBUILD34 이후 구현 우선순위는 “새 모델 추가”보다 “운영 안정성 고정”이 먼저다. 특히 concurrency/권한/번역 파이프라인 원자화 3가지를 먼저 처리하면 현재 아키텍처는 훨씬 안정적으로 굳어진다.

---

## §11. 진행 현황 (2026-05-07 갱신)

REBUILD35 작성 직후 진행한 1차 정리 묶음 + 후속 보안 패치(2026-05-07)의 처리 결과. 본 절은 backlog 의 살아있는 추적표 역할을 한다.

### 11.1 즉시 처리 묶음 (1 PR, 위험 0)

| ID | 항목 | 상태 | 커밋 |
|----|------|------|------|
| P2-E | LoadingOverlay JSX duplicate `opacity` attribute 수정 | ✅ 완료 | `e2108b5` (fillOpacity + strokeOpacity 분리, 원작자 의도 복원) |
| P1-A | "14 모델" → "15 모델" 표현 정정 (3 파일: server.py / ServerInferTester.jsx / api/local-infer.js) | ✅ 완료 | `e2108b5` |
| P1-B | translator 카테고리 chip 의도 명시 (현재 토글로만 노출, 의도된 숨김) | ✅ 완료 | `e2108b5` (ServerInferTester.jsx 주석 추가) |
| P1-C | 잔여 stale 주석 정리 (api/config.js · src/App.jsx · cloudbuild.yaml × 2 · server-infer/server.py) | ✅ 완료 | `e2108b5` |

선행 진행 항목:

| ID | 항목 | 상태 | 커밋 |
|----|------|------|------|
| P1-C(부분) | `src/lib/lab/models.js` stale 주석 정리 + 미사용 헬퍼 3개 제거 | ✅ 완료 | `aab98ed` (Option A 묶음) |
| P1-F(부분) | `step7-labs-smoke.spec.js` 6엔진 기대값 → 단일 Ollama 갱신 | ✅ 완료 | `aab98ed` |
| (extra) | `@mediapipe/tasks-genai` 미사용 의존성 제거 (76MB 절감) | ✅ 완료 | `4bda80c` |
| (extra) | `inference-py/` multi-engine sub-server 디렉토리 제거 | ✅ 완료 | `bc553be` |

### 11.1.5 보안 의존성 패치 (2026-05-07)

REBUILD37 보안 전수 조사 결과 13건 취약점 발견 → `npm audit fix` 자동 처리로 8건 해결, 잔여 5건 LOW (transitive only).

| 항목 | 상태 | 커밋 |
|------|------|------|
| 통합/분리 service 추론 메모리 거동 상세 분석 (REBUILD36.md, 550줄) | ✅ 완료 | `6b06ba3` |
| 의존성 보안 자동 패치 (`npm audit fix`) — DOMPurify 3.3.3 → 3.4.2 등 8건 자동 해결 | ✅ 완료 | `8c0299d` |

자동 해결된 CVE:
- **MODERATE → 0**: DOMPurify (CVE-2026-41238/41239/41240 XSS Bypass) / postcss (CVE-2026-41305) / brace-expansion (CVE-2026-33750) / fast-xml-parser
- **HIGH → 0**: Vite (CVE-2026-39363 path traversal) / @xmldom/xmldom (CVE-2026-34601/41672/41674/41675 × 4) / picomatch (CVE-2026-33671/33672) / path-to-regexp transitive (CVE-2024-52798)

잔여 5건 LOW (의도적 보류, breaking change 동반):
- `@google-cloud/storage` 의존 chain (`@tootallnate/once`, `http-proxy-agent`, `teeny-request`, `retry-request`)
- `--force` 시 `@google-cloud/storage` 5.18.3 다운그레이드 발생 → 차기 GCS major 업그레이드 시 자연 해소

### 11.2 다음 스프린트 (P0 운영 안정성)

| ID | 항목 | 권장 접근 | 비고 |
|----|------|-----------|------|
| P0-A | 추론 service concurrency 안정화 | Cloud Run `--concurrency=1` 즉시 적용 (10분), 트래픽 늘면 mutex/queue 로 진화 | 현재 traffic 패턴은 lab 위주 → A 옵션 비용 낮음 |
| P0-B | restart-container 권한 admin 전용화 | `withAdminAuth` 미들웨어 신설 + `MemoryCard.jsx` 버튼 노출 조건 | 본업 무중단 확보 (직접 위험) |
| P0-D | 번역 파이프라인 서버 endpoint 원자화 | FastAPI `/infer/translate-assisted` + asyncio.Lock | P0-A 적용 후에도 잔류 위험 시 진행 |

### 11.3 이연 / 의사결정 보류

| ID | 항목 | 사유 |
|----|------|------|
| P0-C | unload-all 권한 정책 | 현재 의도된 일반 사용자 허용 (REBUILD33 §31 코드 주석). audit log 만 추가하는 절충안 검토 가능 |
| P1-D | dynamic availability now/after_unload 분리 | REBUILD35 §6.1 default 모델 매트릭스 확정 후 어떤 모델 전환 빈번한지 알면 우선순위 명확 |
| P1-E | catalog schema contract | REBUILD35 §5.2 bench schema 와 동시 진행 (모델 메타 통합 설계) |
| P1-F | Playwright lab test 보강 (전면 재작성) | REBUILD35 §6.4 회귀 테스트 인프라와 통합 |
| P2-A | route registry required/optional 분리 | 운영 실측 장애 사례 부재 |
| P2-B | observability (request id / structured log) | REBUILD35 시스템 메트릭 수집 인프라와 통합 |
| P2-C | frontend chunk split (Vite manualChunks) | `/lab/local-ai` 폐기 의사결정과 묶음 (폐기 시 효과 80% 자동 달성) |
| P2-D | Docker image slim (4.81GB → 2GB) | Cloud Run cold start 의 dominant 요인은 GPU 모델 다운로드. image 절감 효과 제한적 |

### 11.4 커밋 이력 요약 (REBUILD32-37 통합 정리)

| 커밋 | 내용 |
|------|------|
| `4bda80c` | `@mediapipe/tasks-genai` 의존성 제거 (76MB 절감) |
| `aab98ed` | 6엔진 시대 잔재 코드 정리 (Option A — engines.js 삭제, 미사용 헬퍼 제거, step7 갱신) |
| `ec8bfa4` | REBUILD 문서 `rebuild-docs/` 디렉토리로 통합 + REBUILD32~35 추가 |
| `bc553be` | `inference-py/` multi-engine sub-server 제거 |
| `13c7dab` | 격리 추론 service 신설 + 메인 service Ollama 단일 엔진화 |
| `a5643b3` | 실험실 5개 모듈 단일 엔진 + 카테고리/메모리 카드 적용 |
| `e2108b5` | REBUILD34 P2-E + P1-A + P1-B + P1-C 즉시 정리 묶음 |
| `5d980a3` | REBUILD34 §11 진행 현황 신설 |
| `6b06ba3` | **REBUILD36 — 통합/분리 service 추론 메모리 거동 상세 분석 (550줄)** |
| `8c0299d` | **의존성 보안 자동 패치 (npm audit fix) — 13건 → 5건 LOW** |

### 11.5 다음 의사결정 후보

1. **P0-A `--concurrency=1` 즉시 적용 여부** (10분, 비용 0)
2. **P0-B restart-container admin 전용화** (1시간, 본업 무중단)
3. **`/lab/local-ai` 폐기 검토** (P2-C 와 묶음, 367MB 추가 절감)
4. **REBUILD35 Phase 1 (벤치마크 데이터셋 v1) 착수**
5. **npm audit CI hook + Dependabot** (REBUILD37 권장 후속 — 회귀 자동 감지)
6. **`@google-cloud/storage` 메이저 업그레이드** (REBUILD37 잔여 LOW 5건 해소)

위 6건 중 어느 것을 다음 스프린트로 가져갈지 사용자 결정 대기.

