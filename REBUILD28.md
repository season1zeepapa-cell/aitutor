# REBUILD28 — 실험실(8 엔진 양쪽 동거) 구현 상태 정밀 점검 + 미구현 추적

> 작성: 2026-04-30
> 목적: REBUILD26 (8 엔진 전수 구현 계획) 의 의도와 현재 코드베이스 상태를 1:1 대조 → 누락/디버깅 항목을 명시화하고 추적 체크리스트를 단일 진실 소스로 둔다.
> 선행: REBUILD23 (AWS→GCP 마이그) → REBUILD24 (실험실 5개 분석) → REBUILD25 (4 lab 컨셉) → REBUILD26 (8 엔진 전수 결정 + Day 1 실행) → REBUILD27 (AWS 인프라 폐기) → **REBUILD28 (본 문서)**

---

## 0. TL;DR

### 0.1 "실험실" = 4개 lab (Settings 토글 기준)

| Lab | 라우트 | DB key | 역할 | 상태 |
|---|---|---|---|---|
| 디바이스 AI | `/lab/local-ai` | `lab_local_ai_enabled` | 모바일 PWA + Gemma 3n E4B 시범 | ✅ 라이브 (외부 추론 X, 클라이언트 사이드) |
| HF Inference | `/lab/hf` | `lab_hf_enabled` | HuggingFace Inference Providers 라우팅 | ✅ 라이브 (오픈 모델 7종) |
| Cloud Run **일심동체** | `/lab/local-gcp` | `lab_local_lambda_enabled` *(legacy key)* | 메인 service 안에 모든 daemon 동거 | 🟡 **6/6 엔진 active** (vLLM 디버깅 중) |
| Cloud Run **격리** | `/lab/server-infer` | `lab_server_infer_enabled` | 별도 Cloud Run service (aitutor-inference) | 🟡 **4/6 엔진 active** |

→ REBUILD28 의 추적 대상은 **일심동체 + 격리** 두 lab 의 6 엔진 동거.

### 0.2 ⚠️ 범위 변경 — "8 엔진 진정 전수" → "6 엔진 진정 전수" (사용자 결정 2026-04-30)

REBUILD26 의 8 엔진 계획에서 **SGLang / TensorRT-LLM 2 엔진을 deferred 처리**한다. AI TutorTwo 의 실제 사용 패턴(단발 호출, 동시 1~2, 모델 교체 빈번)과 두 엔진의 강점(SGLang=multi-turn prefix cache, TensorRT=고 throughput) 이 **정확히 어긋남**. 빌드/운영 부담 대비 실용 가치 marginal.

**deferred + 완전 제거 처리** (사용자 추가 결정 2026-04-30):
- 양쪽 catalog (`api/local-infer.js`, `inference-py/engines/catalog.py`, `aitutor-inference/engines/catalog.py`) 에서 `sglang` / `tensorrt-llm` entry 제거
- placeholder 파일 4개 삭제: `inference-py/engines/{sglang_engine,tensorrt}.py` + `aitutor-inference/engines/{sglang_engine,tensorrt}.py`
- `engines/__init__.py` 의 import + dispatch 주석, `start.sh` 의 placeholder 주석, `Dockerfile` / `requirements.txt` / `README.md` 의 mention 모두 정리
- UI fallback (`LocalGcpTester.jsx`, `ServerInferTester.jsx`) 의 SGLang / TensorRT 항목 제거
- 미래 부활 필요 시 **별도 의사결정 + REBUILD26 §2.1 의 정밀 명세 참고하여 신규 구현**

→ **재정의된 진정 전수 = 양쪽 6 엔진**:
```
일심동체 = Ollama / llama-server / vLLM / llama-cpp-python / onnx / transformers
격리       = (동일 6)
```

### 0.3 6 엔진 양쪽 active 매트릭스 (현 시점)

| # | 엔진 | 일심동체 | 격리 | 양쪽 동일 비교 가능? |
|---|---|---|---|---|
| 1 | Ollama              | ✅ (Phase 5-1 라이브) | ✅ (Phase 7-2a 라이브, GPU L4) | ⭐ |
| 2 | llama-server        | ✅ (Phase 5-1 라이브, lazy spawn) | ❌ (Phase 7-2b 미시작) | — |
| 3 | vLLM                | 🟡 (Phase 5-1 라이브하나 **헬스체크 180s 타임아웃 보고**) | ❌ (Phase 7-2c 미시작) | — |
| 4 | llama-cpp-python    | ✅ (Phase 5-2 라이브, sub-server 11442) | ✅ (Phase 7-1 라이브) | ⭐ |
| 5 | onnxruntime-genai   | ✅ (Phase 5-2 라이브, sub-server 11442) | ✅ (Phase 7-1 라이브) | ⭐ |
| 6 | transformers        | ✅ (Phase 5-2 라이브, sub-server 11442) | ✅ (Phase 7-1 라이브) | ⭐ |
| — | ~~SGLang~~          | 🚫 deferred (placeholder 보존) | 🚫 deferred (placeholder 보존) | (제외) |
| — | ~~TensorRT-LLM~~    | 🚫 deferred (placeholder 보존) | 🚫 deferred (placeholder 보존) | (제외) |
| **합** | — | **5 active / 1 디버깅 = 6/6** | **4 active / 2 미구현 = 4/6** | **4 엔진 비교 가능** |

→ 현재 양쪽 비교 모드(REBUILD24 §6.2)가 의미 있는 엔진은 **Ollama / llama-cpp-python / onnxruntime-genai / transformers** 4종. P0 + P1 완료 시 6 엔진 양쪽 진정 전수 도달.

### 0.4 핵심 미구현 / 디버깅 항목 (우선순위, 갱신)

| 우선순위 | 항목 | 상세 | 위치 |
|---|---|---|---|
| 🔥 P0 | **vLLM 콜드 스타트 헬스체크 타임아웃** | 사용자 텔레그램 2026-04-29 19:39 보고. 180s 안에 `/v1/models` 미응답 → daemon 헬스체크 실패 | `api/local-infer.js:113` `startTimeoutS: 180` |
| 🟧 P1 | **격리 7-2b** — llama-server | inference-py/engines 의 `_DISPATCH` 등록 + start.sh 의 `PROCESS_MODE=isolated` 분기에서 daemon spawn | `inference-py/engines/__init__.py:30` + `start.sh:34-55` |
| 🟧 P1 | **격리 7-2c** — vLLM (P0 해결 후) | 위와 동일 패턴, 일심동체 안정화 패턴 그대로 | (동일) |
| 🟦 P3 | SGLang / TensorRT-LLM 카탈로그 deferred 표기 | catalog status `'planned' → 'deferred'`, UI fallback 라벨 갱신 | `api/local-infer.js:47-48` + `inference-py/engines/catalog.py:26-31` + `src/labs/*/Tester.jsx` FALLBACK |
| 🟦 P3 | dead code: `aitutor-inference/Dockerfile + start.sh + requirements.txt` | 격리 service 가 PROCESS_MODE=isolated 로 일심동체 image 재사용. `aitutor-inference/` 디렉토리는 sync 마스터(server.py + engines/) 외 dead | `workspace/aitutor-inference/{Dockerfile,start.sh,requirements.txt}` |
| 🟦 P3 | UI fallback 카탈로그 stale | `ServerInferTester.jsx:18` FALLBACK_ENGINES 가 `ollama: planned` 표기 — 실제 active | `src/labs/server-infer/ServerInferTester.jsx:14-23` |
| 🟦 P3 | dispatch 에러 메시지 stale | 격리 dispatch 의 `engine_not_ready` 메시지가 ollama active 미반영 | `inference-py/engines/__init__.py:49` |

---

## 1. 작업 컨텍스트

### 1.1 REBUILD26 → 27 → 28 흐름

| 문서 | 일자 | 핵심 |
|---|---|---|
| REBUILD26 | 2026-04-29 | 8 엔진 전수 구현 계획 + Day 1 실행 (변경 이력 13개 row) |
| REBUILD27 | 2026-04-29 | AWS 인프라 41개 + Route53 hosted zone 폐기 → AWS 청구 $0 |
| **REBUILD28** | **2026-04-30** | **REBUILD26 의 Phase 5-1/5-2/7-1/7-2a 완료 검증 + Phase 5-3/7-2b/7-2c/7-2d/8 추적** |

### 1.2 본 점검의 trigger

- 사용자 (2026-04-29 19:39 텔레그램): vLLM × Qwen 3 4B 해설 생성 시 `daemon 헬스체크 타임아웃 (180s)` 에러 스크린샷 보고
- 사용자 (2026-04-30): "REBUILD26.md 실험실 구현 상태를 깊이 코드베이스로 분석해서 REBUILD28.md 신규 작성하고 미구현 식별하여 추적합시다"

→ vLLM 디버깅과 동시에 양쪽 8 엔진 진정 전수 도달까지 남은 항목을 단일 문서로 추적.

---

## 2. 일심동체 (workspace/aitutor) 구현 상태

### 2.1 컨테이너 + 진입점

| 파일 | 역할 | 상태 |
|---|---|---|
| `Dockerfile` | Multi-stage: frontend-builder → llamacpp-builder (CUDA devel) → runtime (CUDA runtime + Node + Ollama + llama-server + venv-vllm) | ✅ 라이브 (revision aitutor-00012-7lk, image phase7-2a-final) |
| `start.sh` | PID 1 = bash, Ollama daemon spawn → Python sub-server (11442) spawn → Express foreground. PROCESS_MODE=isolated 분기 포함 | ✅ 라이브 |
| `server.js` | Express, `/api/iso-infer` 등록 | ✅ 라이브 |

### 2.2 추론 엔진별 상태

#### ① Ollama (port 11434) — ✅ active

- start.sh:59 가 항상 daemon 띄움
- `api/local-infer.js:91-107 ensureOllamaModel()` 자동 pull
- 한국어 강제 system prompt + assistant seed 패턴 (코드:198-250)
- 사용자 검증 다수 완료

#### ② llama-server (port 11435) — ✅ active

- Lazy spawn: `api/local-infer.js:142-176 ensureLlamaServer()` 첫 호출 시 spawn
- GGUF 파일은 `huggingface-cli` 다운 → `/var/cache/huggingface/llama-cpp/` 캐시
- `--ctx-size 4096 -ngl 99 --no-warmup`
- startTimeoutS: 60s
- ⚠️ 실사용 verbose 검증 부족 (코드 라이브하나 사용자 검증 보고 없음)

#### ③ vLLM (port 11436) — 🟡 라이브하나 디버깅 필요

- Lazy spawn: `api/local-infer.js:178-196 ensureVllm()` 첫 호출 시 `/opt/venv-vllm/bin/python -m vllm.entrypoints.openai.api_server`
- 옵션: `--max-model-len 4096 --gpu-memory-utilization 0.5 --enforce-eager`
- **startTimeoutS: 180s (코드:113) ← 타임아웃 발생**

**🔥 P0 디버깅 항목**:
- **에러**: `daemon 헬스체크 타임아웃 (180s, http://127.0.0.1:11436/v1/models) (180607ms 후)`
- **가능 원인 (우선순위)**:
  1. 콜드 스타트 시 HF Hub 에서 `Qwen/Qwen2.5-3B-Instruct` 6GB 다운로드(1~3분) + PyTorch CUDA 초기화(10~30s) + vLLM engine init(20~60s) = 200~300s → 180s 부족
  2. Ollama 가 GPU L4 24GB 점유 중에 vLLM `--gpu-memory-utilization 0.5` 충돌 → vLLM 프로세스 silent crash
  3. spawn stdio: ['ignore', 'inherit', 'inherit'] (코드:192) → 실패 로그가 컨테이너 stdout 으로 흘러 Express 응답에 안 잡힘
- **확정 진단 방법**:
  ```bash
  gcloud run services logs read aitutor --region=us-east4 --limit=200 \
    | grep -E "vllm|VLLM|CUDA|OOM|ERROR|Loading model"
  ```
- **수정 방향 (확정 후)**:
  - 원인 1 → `startTimeoutS: 180 → 600`, 그리고 GCS pre-download 또는 워밍업 endpoint
  - 원인 2 → vLLM spawn 전 Ollama unload 또는 `gpu-memory-utilization 0.3`
  - 원인 3 → spawn stdio 를 파일로 redirect (`/tmp/vllm-spawn.log`) → 실패 시 마지막 로그 라인 응답 메시지에 포함

#### ④ llama-cpp-python (Phase 5-2, sub-server 11442) — ✅ active

- Python sub-server (`inference-py/engines/llamacpp.py`) lazy daemon spawn (port 11437)
- abetlen prebuilt CUDA wheel (cu124), `llama-cpp-python==0.3.4`
- 호출 패턴: `api/local-infer.js → /infer (sub-server) → engines/llamacpp.py:_ensure_daemon() → 11437/v1/chat/completions`

#### ⑤ onnxruntime-genai (Phase 5-2, in-process) — ✅ active

- Microsoft 공식 CUDA wheel `onnxruntime-genai-cuda==0.5.2`
- daemon 없이 sub-server FastAPI 안에서 직접 import (in-process)
- 모델 식별자: HF repo + subfolder (`cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4`)

#### ⑥ transformers (Phase 5-2, in-process) — ✅ active

- HF PyTorch CUDA, `transformers==4.46.3`
- daemon 없이 sub-server 안에서 직접 import
- vLLM 의 torch 재사용 (같은 venv 공유)

#### ⑦ SGLang — 🚫 deferred + 완전 제거 (사용자 결정 2026-04-30)

**제외 사유** (§0.2 참조):
- AI TutorTwo = 단발 호출, multi-turn / RAG 거의 없음 → SGLang 핵심 강점인 RadixAttention prefix cache 시너지 0
- 별도 venv (vLLM torch 충돌) + image +1.5GB → 운영 부담
- vLLM 안정화 시 GPU 최강 엔진 확보 → SGLang 비교 가치 marginal

**완전 제거 처리** (사용자 추가 결정 2026-04-30):
- ✅ `inference-py/engines/sglang_engine.py` + `aitutor-inference/engines/sglang_engine.py` 삭제
- ✅ catalog entry 제거 (양쪽 ENGINES 딕셔너리)
- ✅ `engines/__init__.py` import + dispatch 주석 제거
- ✅ UI fallback (LocalGcpTester / ServerInferTester) 항목 제거
- ✅ `api/local-infer.js` ENGINES 카탈로그 entry + URL 상수 제거
- ✅ Dockerfile / start.sh / requirements.txt / README.md 의 mention 정리
- 미래 부활 필요 시 별도 의사결정 거쳐 신규 구현 (REBUILD26 §2.1 명세 참고)

#### ⑧ TensorRT-LLM — 🚫 deferred + 완전 제거 (사용자 결정 2026-04-30)

**제외 사유** (§0.2 참조):
- AI TutorTwo = 동시 요청 1~2 → TensorRT throughput 강점 활용 불가
- 모델 교체 빈번한 학습 도구 + **모델당 28분 컴파일** = 마찰 최대
- +4GB image → Artifact Registry 10GB compressed 한도 거의 확정 초과
- vLLM 대비 latency 개선 미미 (체감 거의 없음)

**완전 제거 처리** (사용자 추가 결정 2026-04-30):
- ✅ `inference-py/engines/tensorrt.py` + `aitutor-inference/engines/tensorrt.py` 삭제
- ✅ catalog entry 제거 (양쪽 ENGINES 딕셔너리)
- ✅ `engines/__init__.py` import + dispatch 주석 제거
- ✅ UI fallback 항목 제거
- ✅ `api/local-infer.js` ENGINES 카탈로그 entry + URL 상수 제거
- ✅ Dockerfile / start.sh / README.md 의 mention 정리
- 미래 부활 필요 시 별도 의사결정 거쳐 신규 구현 (REBUILD26 §2.1 명세 참고)

### 2.3 일심동체 디렉토리 구조 (현재)

```
workspace/aitutor/
├─ Dockerfile          # multi-stage CUDA + Node + Ollama + llama-server + venv-vllm
├─ start.sh            # PID 1, Ollama daemon, Python sub-server (11442) lazy, Express
├─ server.js           # Express
├─ api/
│  ├─ local-infer.js   # 일심동체 8 엔진 카탈로그 + 6 active dispatcher
│  └─ iso-infer.js     # 격리 service 프록시 (메타데이터 ID Token + forward)
├─ inference-py/       # Python sub-server (port 11442) — 격리 service 코드 mirror
│  ├─ server.py        # FastAPI (sync 마스터에서 복사)
│  ├─ requirements.txt # (sync 마스터에서 복사)
│  ├─ sync-from-isolated.sh
│  └─ engines/         # active 4 + planned 4 = 8 placeholder
└─ src/labs/
   ├─ local-gcp/       # /lab/local-gcp 일심동체 UI (8 엔진 표시)
   └─ server-infer/    # /lab/server-infer 격리 UI (8 엔진 표시)
```

---

## 3. 격리 (Cloud Run aitutor-inference) 구현 상태

### 3.1 운영 모드 — ⚠️ image 재사용 (PROCESS_MODE=isolated)

REBUILD26 §7-2a 부터 격리 service 는 **일심동체 image 를 재사용**한다 (workspace/aitutor 의 Dockerfile 산출물 = phase7-2a-final).

진입점 분기는 `start.sh:34-55`:
```bash
if [ "${PROCESS_MODE:-main}" = "isolated" ]; then
  if [ "${GPU_ENABLED:-0}" = "1" ]; then
    ollama serve > /tmp/ollama.log 2>&1 &
    # ...헬스체크
  fi
  cd /app/inference-py
  exec /opt/venv-vllm/bin/python -m uvicorn server:app --host 0.0.0.0 --port "${PORT:-8080}"
fi
```

→ 격리는 Express 미동작, FastAPI(`inference-py/server.py`) 단일 진입점.

배포 명령 (REBUILD26 변경 이력 §Phase 7-2a):
```bash
gcloud run services update aitutor-inference \
  --region=us-east4 \
  --gpu=1 --gpu-type=nvidia-l4 --no-gpu-zonal-redundancy \
  --memory=32Gi --cpu=8 --max-instances=1 \
  --update-env-vars=PROCESS_MODE=isolated,GPU_ENABLED=1,...
```

### 3.2 dead code 정리 대상 (🟦 P3)

`workspace/aitutor-inference/` 디렉토리에서 **현재 사용**되는 파일:
- ✅ `server.py` — sync 마스터 (sync-from-isolated.sh 가 일심동체 inference-py/ 로 복사)
- ✅ `engines/*.py` — sync 마스터
- ✅ `requirements.txt` — sync 마스터 (다만 일심동체 venv-vllm 이 같은 deps 재설치)

**dead** (격리 image 자체 빌드 시점에는 쓰였으나 phase7-2a 이후 미사용):
- ❌ `Dockerfile` (Python 3.11-slim CPU only)
- ❌ `start.sh` (uvicorn 직접 실행)

→ 정리 옵션: (A) 그대로 보존하고 README 에 "legacy, sync 마스터로만 사용" 명시 / (B) 디렉토리에서 Dockerfile/start.sh 삭제

권장: **(A) 보존 + 헤더 주석 추가**. 격리 service 를 다시 자체 image 로 분리하고 싶을 때 reference 가 됨.

### 3.3 격리 8 엔진 active 매트릭스

inference-py/engines/catalog.py 와 `_DISPATCH` 일치 여부:

| 엔진 | catalog status | _DISPATCH 등록 | start.sh isolated 분기 daemon | 실제 동작 |
|---|---|---|---|---|
| llama-cpp-python | active | ✅ llamacpp.infer | (lazy in engines/llamacpp.py) | ✅ |
| onnxruntime-genai | active | ✅ onnx.infer | (in-process) | ✅ |
| transformers | active | ✅ transformers_engine.infer | (in-process) | ✅ |
| ollama | **active** (catalog:24) | ✅ `_ollama_planned.infer` (\_\_init\_\_.py:27) | ✅ (start.sh GPU_ENABLED=1 분기) | ✅ |
| llama-server | planned | 주석 (\_\_init\_\_.py:30) | 주석 | ❌ |
| vllm | planned | 주석 (\_\_init\_\_.py:31) | 주석 | ❌ |
| sglang | planned | 주석 (\_\_init\_\_.py:32) | 주석 | ❌ |
| tensorrt-llm | planned | 주석 (\_\_init\_\_.py:33) | (없음) | ❌ |

→ 격리 4 active = Ollama (GPU) + llama-cpp-python (CPU) + onnxruntime-genai (CPU) + transformers (CPU). GPU L4 1장 점유 중.

### 3.4 격리 7-2b/c 작업 명세 (🟧 P1)

격리 image 가 일심동체와 같으므로 일심동체에 daemon binary/venv 가 이미 있다. 격리에서 active 전환은 **순수 코드 변경 + redeploy** 만 필요:

#### Phase 7-2b — llama-server (격리)
1. `inference-py/engines/llamaserver.py` 의 infer() 본문 구현 (httpx → 11435 OpenAI 호환)
2. `inference-py/engines/__init__.py:30` 주석 해제 → `_DISPATCH['llama-server'] = _llamaserver_planned.infer`
3. catalog.py 의 `llama-server.status: active`
4. start.sh 의 isolated+GPU 분기에 lazy spawn 함수 추가 (또는 inference-py/engines/llamaserver.py 안에 _ensure_daemon 패턴)
5. 격리 service redeploy (revision rollout)

#### Phase 7-2c — vLLM (격리)
- 위와 동일 패턴, 단 ⚠️ 일심동체의 vLLM 헬스체크 이슈(P0)가 격리에서도 동일 발생. **P0 해결 후 진행 권장.**

#### Phase 7-2d — SGLang (격리) — 🚫 deferred
~~일심동체 Phase 5-3 에서 venv-sglang 빌드되면 격리도 자동 사용 가능.~~ → §0.2 결정으로 보류.

#### Phase 8 — TensorRT-LLM (양쪽) — 🚫 deferred
~~image 별도 검토 (10GB 한도). 격리만 별도 image 또는 양쪽 같은 image.~~ → §0.2 결정으로 보류.

---

## 4. UI / 토글 / 라우팅 일관성

### 4.1 4 lab 토글 (Settings)

| Lab 라벨 | DB key | 라우트 | 가드 | 정상 |
|---|---|---|---|---|
| 🧪 디바이스 AI 해설 | lab_local_ai_enabled | /lab/local-ai | ✅ | ✅ |
| 🤗 HF Inference (오픈 모델 라우팅) | lab_hf_enabled | /lab/hf | ✅ | ✅ |
| 🏠 Cloud Run 일심동체 | lab_local_lambda_enabled (legacy) | /lab/local-gcp | ✅ | ✅ (DB key 만 legacy) |
| 🧪 격리 추론 (server-infer) | lab_server_infer_enabled | /lab/server-infer | ✅ | ✅ |

→ 토글 패턴 일관 (각 lab 별 동일 UI 컴포넌트). DB key 만 마이그 부담으로 legacy 유지.

### 4.2 라우팅 / redirect (App.jsx)

| 옛 라우트 | 처리 |
|---|---|
| `/lab/server-ai/*` | App.jsx:128 `/lab/local-lambda → /lab/local-gcp` Navigate (REBUILD26 §7-1 명시 폐기) |
| `/lab/server-ai-gguf/*` | catch-all → /quiz |
| `/lab/local-lambda` | Navigate to `/lab/local-gcp` (북마크 호환) |

### 4.3 카탈로그 stale 경고 (🟦 P3)

**`src/labs/server-infer/ServerInferTester.jsx:14-23` FALLBACK_ENGINES**:
- 첫 paint 에서 ollama=`planned` 표시 (실제는 active) — 동적 로드되면 갱신되지만 1~2 frame 동안 잘못 표시
- 수정: line 18 `{ key: 'ollama', ..., status: 'active', note: 'Phase 7-2a — GPU L4' }`

**`inference-py/engines/__init__.py:49` dispatch error message**:
```python
raise RuntimeError(f"engine_not_ready: {engine} (Phase {('7-2' if not meta.get('gpu_required') and engine in ('ollama', 'llama-server') else '7-2/8')} 에서 활성화 예정)")
```
→ ollama 가 이미 active 인데 메시지 분기에 ollama 가 남아있음. 다음 active 전환 시 정리.

---

## 5. 미구현 추적 체크리스트

### 5.1 P0 (즉시) — vLLM 헬스체크 디버깅 — ✅ 원인 확정 + fix 진행 중 (2026-04-30)

- [x] Cloud Run 로그에서 vLLM 콜드 스타트 실제 진행 확인 — **③ silent crash 확정**
- [x] **근본 원인**: `huggingface_hub==0.26.3` (Phase 5-2 빌드에 강제) 가 0.26 부터 `is_offline_mode` export 를 제거 → vLLM 0.6.5 + transformers 4.46.3 둘 다 ImportError 로 즉시 종료 → 헬스체크 180s 헛 polling
  ```
  ImportError: cannot import name 'is_offline_mode' from 'huggingface_hub'
    (transformers/utils/hub.py:29)
  [local-infer] vLLM 종료 code=1   (spawn 후 ~10초)
  ```
- [x] **수정**: `huggingface-hub==0.26.3` → `0.25.2` 다운그레이드 (Dockerfile + 양쪽 requirements.txt)
- [ ] Cloud Build 재빌드 (rebuild28-p0-vllm-fix tag) — 진행 중 (~17~20분)
- [ ] 양쪽 service redeploy (image update, env 보존)
- [ ] 사용자 재검증 (vLLM × Qwen 3 4B 해설 생성)

### 5.2 P1 (격리 7-2b / 7-2c)

#### 5.2.1 격리 7-2b — llama-server

- [ ] `inference-py/engines/llamaserver.py` infer() 본문 작성 (httpx + 11435 + GGUF resolve)
- [ ] start.sh isolated+GPU 분기에 lazy spawn 패턴 추가 (또는 engines/llamaserver.py 안 _ensure_daemon)
- [ ] catalog.py status='active' + \_\_init\_\_.py _DISPATCH 등록
- [ ] sync-from-isolated.sh 실행 → 일심동체 inference-py 동기화
- [ ] 격리 service redeploy 검증

#### 5.2.2 격리 7-2c — vLLM (P0 해결 후)

- [ ] (P0 의 vLLM 안정화 완료 후) 위 7-2b 와 동일 패턴
- [ ] 일심동체에서 vLLM 안정성 검증 → 격리에서도 동일 보장

### 5.3 ~~P2 (Phase 8) — TensorRT-LLM~~ — 🚫 deferred

§0.2 사용자 결정으로 보류. placeholder 코드 보존, 미래 trigger 발생 시 부활.

### 5.4 P3 (정리)

- [x] **SGLang / TensorRT-LLM 완전 제거** (2026-04-30 완료) — placeholder 4개 파일 삭제 + 양쪽 catalog entry 제거 + dispatch 주석/UI fallback/Dockerfile/start.sh/requirements/README mention 정리. Python+JS syntax 통과, 양쪽 sync 100% 일치 확인
- [x] `src/labs/server-infer/ServerInferTester.jsx:18` FALLBACK_ENGINES ollama → status='active' (2026-04-30 완료)
- [x] `inference-py/engines/__init__.py:49` dispatch error 메시지 단순화 (2026-04-30 완료)
- [x] `aitutor-inference/README.md` legacy image 재사용 명시 (2026-04-30 완료)
- [x] `aitutor-inference/start.sh` legacy 보존본 표시 헤더 추가 (2026-04-30 완료)
- [ ] `aitutor-inference/Dockerfile` 헤더 주석에 "legacy, phase7-2a 부터 일심동체 image 재사용" 명시 (P3 잔여)
- [ ] `lab_local_lambda_enabled` DB key 명명 검토 (마이그할지 그대로 둘지)

---

## 6. 작업 순서 권장 (옵션 A 채택 후 갱신)

```
Step 1 (P0, 0.5일):
  vLLM 콜드 스타트 디버깅 (Cloud Run 로그 확인 → 원인 확정 → 수정 → 재검증)
  [완료 시 일심동체 vLLM 진정 active = 일심동체 6/6]

Step 2 (P1 격리 7-2b, 0.5일):
  격리 llama-server active (코드만, 일심동체 image 재사용으로 빌드 0)
  [양쪽 동일 비교 가능 엔진 4 → 5]

Step 3 (P1 격리 7-2c, 0.5일):
  격리 vLLM active (P0 의 안정화 패턴 그대로 격리에 적용)
  [양쪽 동일 비교 가능 엔진 5 → 6 = 진정한 전수 도달 ⭐]

Step 4 (P3 정리, 0.5일):
  - SGLang / TensorRT-LLM 카탈로그 'planned' → 'deferred' 일괄 갱신
  - dead code 헤더 명시, UI fallback 갱신, dispatch 메시지 정리

총 일정: 2~3일 (REBUILD26 원안 7~10일 → 60~70% 단축)
```

→ **목표**: 양쪽 6 엔진 동거 + 4 엔진 동일 비교 가능 → 6 엔진 동일 비교 가능. SGLang/TensorRT 미래 부활은 별도 의사결정 시점에 재개.

---

## 7. 비용 / 빌드 누적 추적 (옵션 A 갱신)

REBUILD26 변경 이력 기준 누적:
- 일심동체 빌드 (Phase 5-1 1차 실패 + 2차 SUCCESS): ~$1.5
- 격리 service 빌드 (CPU only 자체 image, phase7-2a 이후 dead): ~$1
- Phase 5-2 일심동체 통합 빌드 (19분 03초): ~$1
- phase7-2a + phase7-2a-cleanup + phase7-2a-final 통합 빌드 (×3): ~$3.5
- **누적 빌드 비용: ~$7** ($10 budget 의 70%)

옵션 A 진행 시 추가 비용:
- P0 vLLM 디버깅: 코드만 변경 → redeploy ~$0 (gcloud run deploy without rebuild)
- P1 격리 7-2b/7-2c: 일심동체 image 재사용 → 빌드 0
- P3 정리: 코드만 → 통합 빌드 1회 ~$1
- **추가 ~$1, 최종 누적 ~$8** ($10 budget 의 80%)

→ SGLang/TensorRT 제외로 빌드 비용 ~$3 절감, budget 안전선 안에서 진정 6 전수 도달 가능.

---

## 8. 위험 + 완화 (옵션 A 갱신)

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| **vLLM 콜드 스타트 헬스체크 실패** | **현재 발생 중** | UX (vLLM 사용 불가) | P0 디버깅 (§5.1) |
| ~~Image 크기 10GB 한도 (SGLang)~~ | — | — | SGLang deferred 로 회피 ✅ |
| ~~Phase 8 TensorRT-LLM 28분 × 2~~ | — | — | TensorRT deferred 로 회피 ✅ |
| 격리 dead code 혼동 | 낮음 | 새 작업자 디버깅 시간 손실 | 헤더 주석 명시 (P3) |
| 일심동체 GPU L4 단일 인스턴스 한계 (max=1) | 낮음 | 동시 사용자 큐 대기 | 미래 사용자 증가 trigger 시 max=2 검토 (GPU quota 4 까지 확보 필요) |
| SGLang/TensorRT 미래 부활 시 정보 유실 | 낮음 | 재학습 비용 | placeholder 코드 + REBUILD26 §2.1 정밀 명세 보존 ✅ |

---

## 9. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-30 | REBUILD28.md 최초 작성 — REBUILD26 의 Phase 5-1/5-2/7-1/7-2a 라이브 검증 + Phase 5-3/7-2b/7-2c/7-2d/8 미구현 식별 + P0 vLLM 헬스체크 디버깅 항목 + dead code (aitutor-inference/Dockerfile,start.sh) 식별 + UI fallback stale 식별 + 추적 체크리스트 (§5) + 작업 순서 권장 (§6) |
| 2026-04-30 (옵션 A 채택) | **사용자 결정: SGLang + TensorRT-LLM 제외** — AI TutorTwo 사용 패턴 (단발 호출 / 동시 1~2 / 모델 교체 빈번) 과 두 엔진 강점 (multi-turn prefix cache / 고 throughput) 의 정확한 미스매치. 빌드/운영 부담 대비 실용 가치 marginal. **deferred 처리 (placeholder 보존)**. §0.1~0.4 매트릭스 갱신, §2.2 ⑦⑧ deferred 표기, §3.4 7-2d/Phase 8 deferred, §5.2~5.4 체크리스트 축소, §6 일정 5~7일 → 2~3일 단축, §7 budget ~$8 (80%), §8 위험 SGLang/TensorRT 제거. **재정의된 진정 전수 = 양쪽 6 엔진**. |
| 2026-04-30 (placeholder 완전 제거) | **사용자 추가 결정: placeholder 코드 완전 제거** — 보존이 아니라 완전 제거 채택. 4 파일 삭제 (`{inference-py,aitutor-inference}/engines/{sglang_engine,tensorrt}.py`) + 양쪽 catalog ENGINES entry 제거 + `engines/__init__.py` import/dispatch 주석 제거 + `api/local-infer.js` ENGINES + URL 상수 제거 + UI fallback (LocalGcpTester / ServerInferTester) 항목 제거 + Dockerfile / start.sh / requirements.txt / README.md mention 일괄 정리. Python+JS syntax 검증 통과, 양쪽 sync 100% 일치. P3 정리 항목 대부분 완료. **재구현 시 REBUILD26 §2.1 명세 참고하여 신규 작성**. |
| 2026-04-30 (P0 vLLM 디버깅) | **P0 vLLM 헬스체크 타임아웃 원인 확정 + fix** — Cloud Run 로그(`gcloud run services logs read aitutor --region=us-east4`) 분석 결과 **③ silent crash** 가 정답. vLLM 프로세스가 spawn 후 ~10초 안에 `ImportError: cannot import name 'is_offline_mode' from 'huggingface_hub'` 로 즉사하고 헬스체크가 180초 헛 polling. 근본 원인: Phase 5-2 빌드에서 venv-vllm 에 강제한 `huggingface-hub==0.26.3` 이 vLLM 0.6.5 / transformers 4.46.3 의 lockstep 을 깸 (0.26 부터 `is_offline_mode` export 제거). **fix: Dockerfile + 양쪽 requirements.txt 의 huggingface-hub 0.26.3 → 0.25.2 다운그레이드**. Cloud Build `rebuild28-p0-vllm-fix` tag 빌드 진행 중. 빌드 완료 후 양쪽 service `update --image=...` (env 보존). |

---

## 10. 한 줄 요약

**P0 vLLM fix deploy 완료 (huggingface_hub 0.26→0.25.2) + REBUILD28 §11 신규 작업 (실험실 메인 + WebLLM 엔진 + Ollama bridge + 헤더 통일) 완료.** 빌드 완료 후 양쪽 service redeploy 검증 → P1 격리 7-2b/c 1일 = **총 1.5~2일에 양쪽 진정 전수 도달 예상**.

---

## 11. 실험실 UI 재구성 (사용자 결정 2026-04-30)

### 11.1 사용자 요청

> "최종 local-ai 모델은 WebLLM 와 transformers.js 엔진으로 선택가능하도록 구성, 선택시 설명도 필요. Ollama bridge 는 별도 카드와 테스트 뷰로 분리하고 로컬 데스크탑 셋팅 설명과 입력값을 등록하도록 db 연계 필요. 각 테스트페이지 상단에 홈으로 돌아가기 대신 실험실 메인으로 돌아가게."

### 11.2 신규/변경 사항

| 항목 | 변경 |
|---|---|
| `/lab` 실험실 메인 신규 | `src/labs/index.jsx` — 5 lab 카탈로그 페이지 (디바이스 AI / HF / 일심동체 / 격리 / Ollama bridge) + admin 토글 상태 표시 + 진입 링크 |
| 라우트 등록 | `App.jsx` `<Route path="/lab" element={<LabsHome />}/>` + `<Route path="/lab/ollama-bridge" element={<OllamaBridgeLab />}/>` |
| 헤더 통일 (5 lab) | local-ai / hf / hf/compare / local-gcp / server-infer 의 "← 홈" → **"← 실험실"** (`/lab` 링크). 각 lab 의 비활성 가드 페이지도 동일 |
| `/lab/local-ai` 엔진 선택 추가 | `EngineSwitcher.jsx` 신규 — transformers.js (현재) ↔ WebLLM 토글 + 각 엔진 장단점 설명 카드 |
| WebLLM 통합 | `npm install @mlc-ai/web-llm@^0.2.83` + `lib/inference-webllm.js` 신규 + `components/WebllmPanel.jsx` 신규 (모델 선택 → 다운로드 → 추론, transformers.js 와 격리된 self-contained 패널) |
| WebLLM 카탈로그 (3종) | Qwen 2.5 7B Instruct (5.1GB, 한국어 ⭐) / DeepSeek R1 Distill Qwen 7B (5.1GB, reasoning) / Llama 3.1 8B Instruct (5.0GB) — 모두 q4f16_1 |
| WebLLM 적합성 판정 | `webllmFitVerdict()` — 데스크톱 + WebGPU + RAM 8GB+ 충족 시 토글 활성. 모바일 / WebGPU 없음 / RAM 부족 시 disabled + 사유 표시 |
| `/lab/ollama-bridge` 신규 | 별도 lab 라우트. 사용자 PC 의 Ollama (localhost:11434) 직접 호출. 70B 까지 가능 |
| Ollama bridge 도움말 | 4 step 펼침 가이드: ① Ollama 설치 / ② 모델 pull / ③ CORS (`OLLAMA_ORIGINS=*`) / ④ HTTPS mixed content 우회 |
| Ollama bridge 사용자 설정 DB 저장 | `api/user-settings.js` 신규 + `user_lab_settings` 테이블 자동 생성 (user_id, key, value 복합 PK) + 화이트리스트 (`ollama_bridge_url`, `ollama_bridge_model`) |
| Ollama bridge UI | URL 입력 (default `http://localhost:11434`) / 모델 입력 (default `qwen3:4b`) / 연결 테스트 (`/api/version` + `/api/tags`) / 추론 호출 (`/api/chat`) / 오류 안내 (CORS / mixed content 자동 감지) |
| admin 토글 신규 | `lab_ollama_bridge_enabled` DB key — `api/admin.js` ALLOWED_SETTING_KEYS + `api/config.js` 응답 + `SettingsTab` 카드 |

### 11.3 파일 변경 목록 (최종)

```
src/labs/index.jsx                       NEW  (실험실 메인 - 5 lab 카탈로그)
src/labs/ollama-bridge/index.jsx         NEW  (가드)
src/labs/ollama-bridge/OllamaBridgeTester.jsx  NEW  (메인 UI + 도움말 + DB 연동)
src/labs/local-ai/components/EngineSwitcher.jsx  NEW
src/labs/local-ai/components/WebllmPanel.jsx     NEW
src/labs/local-ai/lib/inference-webllm.js        NEW
src/labs/local-ai/LocalAiExplanation.jsx         MOD  (engine state + 분기)
src/labs/local-ai/index.jsx                      MOD  (← 실험실)
src/labs/hf-playground/HfPlayground.jsx          MOD  (← 실험실)
src/labs/hf-playground/HfCompare.jsx             MOD  (← 실험실)
src/labs/local-gcp/LocalGcpTester.jsx            MOD  (← 실험실)
src/labs/local-gcp/index.jsx                     MOD  (← 실험실)
src/labs/server-infer/ServerInferTester.jsx      MOD  (← 실험실)
src/App.jsx                                      MOD  (/lab + /lab/ollama-bridge 라우트)
src/tabs/SettingsTab/index.jsx                   MOD  (Ollama bridge 토글 카드 추가)
api/admin.js                                     MOD  (lab_ollama_bridge_enabled whitelist)
api/config.js                                    MOD  (응답에 lab_ollama_bridge_enabled 포함)
api/user-settings.js                             NEW  (사용자별 lab 설정 DB API)
server.js                                        MOD  (apiFiles 에 user-settings 등록)
package.json                                     MOD  (@mlc-ai/web-llm@^0.2.83 추가)
```

### 11.4 검증

- ✅ `node --check` 모든 신규 .js 파일 OK
- ✅ `npx vite build` SUCCESS (2.59s) — 신규 컴포넌트 컴파일 OK
- ⚠ WebLLM 번들 크기 ~6MB (`assets/index-*.js`) — 메인 번들에 포함됨. 향후 lazy loading 으로 분리 권장 (Phase 후속)
- ⏳ Cloud Build 재빌드 + 양쪽 service redeploy 필요

### 11.5 추적 항목

- [ ] Cloud Build (rebuild28-§11-ui tag) → 양쪽 service redeploy
- [ ] 실험실 메인 (/lab) 접근 검증 (5 lab 카드 정상 표시)
- [ ] /lab/local-ai 의 EngineSwitcher 토글 동작 (transformers ↔ WebLLM)
- [ ] WebLLM 첫 모델 다운로드 (Qwen 2.5 7B ~5GB, 데스크톱 검증)
- [ ] /lab/ollama-bridge 활성화 (admin 토글) → 진입 → URL 저장 → 연결 테스트 → 추론
- [ ] WebLLM 번들 lazy loading 분리 (P3 후속)
| 2026-04-30 (REBUILD28 §11 UI 재구성) | **사용자 요청 일괄 반영** — (1) /lab 실험실 메인 신규 + 5 lab 카드 카탈로그, (2) 모든 lab 헤더 "← 홈" → "← 실험실" 통일, (3) /lab/local-ai 에 EngineSwitcher 추가 (transformers.js ↔ WebLLM 토글 + 설명), (4) WebLLM 통합 (@mlc-ai/web-llm v0.2.83) + 카탈로그 3종 (Qwen 2.5 7B / DeepSeek R1 7B / Llama 3.1 8B), (5) /lab/ollama-bridge 신규 lab + 도움말 (Ollama 설치 / CORS / mixed content) + 사용자 설정 DB 저장 (user_lab_settings 테이블 자동 생성), (6) admin 토글 lab_ollama_bridge_enabled 추가. 신규 파일 8개 + 수정 11개. Vite build SUCCESS. |
