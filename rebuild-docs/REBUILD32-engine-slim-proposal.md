# REBUILD32 — 통합 서버 엔진 슬림화

> 작성일: 2026-05-05  
> 상태: **제안 (검토 중)**  
> 목표: 통합 서버(일심동체) 의 6 엔진 → 3 엔진으로 축소, Docker 빌드 2-stage 단순화

---

## §0 배경

통합 서버는 REBUILD28 기준으로 6개 추론 엔진을 탑재한다.

```
Phase 5-1 (daemon):  Ollama / llama-server / vLLM
Phase 5-2 (in-proc): llama-cpp-python / onnxruntime-genai / transformers
```

당시 설계 의도는 "모든 주요 엔진을 한 컨테이너에서 비교"였다. 그러나
REBUILD29~31을 거치면서 **최신 모델(Qwen 3.5, Gemma 4)이 Ollama 전용으로 수렴**되었고,
vLLM과 transformers가 실질적으로 기여하는 범위가 급격히 줄었다.

### 현재 문제

| 문제 | 영향 |
|------|------|
| Stage 2 (llamacpp-builder) — CUDA devel 이미지, cmake 컴파일 | 빌드 시간 +10~15분, 빌드 복잡도 |
| vLLM + torch (CUDA) → Python venv ~5GB 추가 | 이미지 크기, cold start 메모리 |
| 6 엔진 → start.sh / catalog.py / local-infer.js 분기 폭발 | 코드 유지보수 부담 |
| transformers PyTorch lazy import (2~4 GB) | 첫 호출 OOM 위험 |

---

## §1 현황: 모델 × 엔진 매트릭스

`inference-py/engines/catalog.py` 의 disabled_engines 반영 **실제 활성 조합**:

```
모델            | ollama | llama-server | llama-cpp-python | vllm | onnx-genai | transformers
----------------|--------|--------------|------------------|------|------------|-------------
qwen35-2b       |   ✅   |      ❌      |        ❌        |  ❌  |     ❌     |      ❌
qwen35-4b       |   ✅   |      ❌      |        ❌        |  ❌  |     ❌     |      ❌
gemma4-e2b      |   ✅   |      ❌      |        ❌        |  ❌  |     ❌     |      ❌
gemma4-e4b      |   ✅   |      ❌      |        ❌        |  ❌  |     ❌     |      ❌
qwen25-3b       |   ✅   |      ✅      |        ✅        |  ✅  |     ❌     |      ✅
qwen25-7b       |   ✅   |      ✅      |        ✅        |  ✅  |     ❌     |      ✅
gemma2-2b       |   ✅   |      ✅      |        ✅        |  ❌  |     ❌     |      ❌
phi35-mini      |   ❌   |      ❌      |        ❌        |  ❌  |     ✅     |      ❌
gemma3-4b       |   ❌   |      ❌      |        ❌        |  ❌  |     ✅     |      ❌
deepseek-r1-7b  |   ✅   |      ✅      |        ✅        |  ❌  |     ✅     |      ❌
phi4-mini       |   ❌   |      ❌      |        ❌        |  ❌  |     ✅     |      ❌
```

### 핵심 관찰

1. **Qwen 3.5 / Gemma 4 (신규 4종)** → Ollama 만 가능 (transformers weights 비공개, GGUF 미지원)
2. **vLLM** → qwen25-3b/7b 전용. Ollama로 대체 가능. 전용 모델 없음.
3. **transformers** → qwen25-3b/7b 전용. Ollama로 대체 가능. 전용 모델 없음.
4. **llama-server** → llama-cpp-python과 **동일 GGUF 파일 재사용**. 기능 중복.
5. **llama-cpp-python** → qwen25/gemma2/deepseek-r1 GGUF. Ollama와 부분 중복이지만 "Python 직접 추론" 교육 목적 가치 있음.
6. **onnxruntime-genai** → phi35-mini / phi4-mini / gemma3-4b **전용**. 대체 엔진 없음.

---

## §2 슬림화 결정: 제거 대상 3개

### §2.1 vLLM 제거 ✂️

**근거:**
- 활성 모델: qwen25-3b, qwen25-7b — Ollama도 동일 서비스 가능
- "PagedAttention / 고처리량" 장점은 단발 교육 호출 패턴에 불필요
- 의존성 무게: `vllm==0.6.5` wheel ~201MB + 암시적 `torch` CUDA wheel ~2.3GB
- 격리 service(aitutor-server-infer)도 Ollama 전환 완료 → 메인 service 맞춤 불필요
- `disabled_engines` 가 급증 추세 (REBUILD30 §20~27) → 앞으로도 활성 모델 줄어들 전망

**위험:** 낮음. qwen25 계열은 Ollama로 동등 서비스.

### §2.2 transformers (HF PyTorch) 제거 ✂️

**근거:**
- 활성 모델: qwen25-3b/7b — Ollama로 동등 서비스
- `torch` CUDA wheel(~2.3GB) 은 vLLM 제거 후 transformers만 남아도 유지해야 함
- Lazy import 시 2~4 GB 메모리 spike → OOM 빈도 원인 (REBUILD30 §21 동기)
- `accelerate`, `sentencepiece` 도 연쇄 제거 가능

**위험:** 낮음. Qwen 2.5 한국어 품질은 Ollama tag와 동일 베이스 모델.

### §2.3 llama-server 제거 ✂️

**근거:**
- `llama-cpp-python` 과 **동일 GGUF 파일을 공유** (catalog.py `_available_engine_keys` 참조)
- llama-server binary는 Stage 2 (llamacpp-builder) 에서 cmake 빌드 → 가장 큰 빌드 복잡도
- b4400 tag 고정 → upstream 보안 패치 수동 추적 부담
- Python sub-server(port 11442) 안에서 llama-cpp-python이 동일 역할 수행

**위험:** 낮음. llama-cpp-python CUDA wheel이 동일 GGUF 처리.

---

## §3 슬림화 후 3-엔진 아키텍처

```
┌──────────────────────────────────────────────────────┐
│             통합 서버 컨테이너 (REBUILD32 이후)         │
│                                                      │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │  Express 8080   │   │  Python sub-server 11442  │  │
│  │  (Node.js)      │   │  (FastAPI + uvicorn)       │  │
│  └────────┬────────┘   └────────────┬─────────────┘  │
│           │                         │                 │
│    ┌──────▼──────┐         ┌────────▼────────┐       │
│    │ Ollama 11434│         │ llama-cpp-python │       │
│    │ (Go daemon) │         │ (CUDA wheel)     │       │
│    └─────────────┘         │                 │       │
│                            │ onnxruntime-genai│       │
│                            │ (ONNX in-process)│       │
│                            └─────────────────┘       │
│                                                      │
│  [제거] llama-server 11435 / vLLM 11436              │
│  [제거] Stage 2 (llamacpp-builder) / torch / vllm    │
└──────────────────────────────────────────────────────┘
```

### 엔진별 담당 모델 (3 엔진)

| 엔진 | 담당 모델 | 특성 |
|------|----------|------|
| **Ollama** | qwen35-2b/4b, gemma4-e2b/e4b, qwen25-3b/7b, gemma2-2b, deepseek-r1 | 가장 광범위, 모델 자동 관리 |
| **llama-cpp-python** | qwen25-3b/7b (GGUF), gemma2-2b (GGUF), deepseek-r1 (GGUF) | Python 직접 추론, GGUF |
| **onnxruntime-genai** | phi35-mini, phi4-mini, gemma3-4b, deepseek-r1 (ONNX) | Microsoft ONNX 전용 모델 |

---

## §4 예상 효과

### §4.1 Docker 이미지

| 항목 | 현재 | REBUILD32 이후 |
|------|------|----------------|
| Build stage 수 | 3 (frontend + llamacpp-builder + runtime) | **2** (frontend + runtime) |
| llamacpp-builder | CUDA devel ~5GB, cmake 10~15분 | **제거** |
| Python venv 크기 | vllm(201MB) + torch(2.3GB) + transformers + accelerate + sentencepiece | **torch / vllm / transformers / accelerate 제거** → ~4~5GB 절감 |
| 전체 이미지 크기 | ~15~18GB (추정) | **~10~12GB** (추정) |

### §4.2 실행 시간

| 항목 | 현재 | REBUILD32 이후 |
|------|------|----------------|
| 빌드 시간 (CI/CD) | ~20~30분 (cmake 포함) | **~10~15분** |
| Cold start (컨테이너) | Ollama(30s) + pysub(3~5s) | 동일 (llama-cpp-python, onnxruntime-genai는 첫 호출 시 lazy) |
| 첫 transformers 호출 | 2~4GB PyTorch import spike | **없음 (제거)** |
| 첫 vLLM 호출 | 분단위 (PagedAttention init + 모델 로드) | **없음 (제거)** |

### §4.3 코드 유지보수

| 항목 | 현재 | REBUILD32 이후 |
|------|------|----------------|
| 엔진 코드 파일 | 6개 (.py) + _daemon.py | **3개** (ollama + llamacpp + onnx) + _daemon.py |
| Dockerfile 라인 | 175줄 (3 stage) | **~120줄** (2 stage) |
| start.sh 분기 | Ollama + pysub watchdog + llama-server lazy + vllm lazy 언급 | **Ollama + pysub watchdog** (2 daemon만) |
| catalog.py ENGINES dict | 6 엔진 정의 | **3 엔진 정의** |

---

## §5 파일별 변경 계획

### §5.1 Dockerfile

```diff
- # ─── Stage 2: llama.cpp llama-server 빌드 ────────────────────────
- FROM nvidia/cuda:12.4.0-devel-ubuntu22.04 AS llamacpp-builder
- ... (cmake 빌드 전체 35줄 제거)

  # ─── Stage 3: Runtime ────────────────────────────────────────────
  # (2 → Stage 2 로 번호 변경)
  FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime

- COPY --from=llamacpp-builder /out/bin/llama-server /usr/local/bin/llama-server
- COPY --from=llamacpp-builder /out/lib/ /usr/local/lib/llama-cpp/
- ENV LD_LIBRARY_PATH=/usr/local/lib/llama-cpp:$LD_LIBRARY_PATH

  RUN python3.10 -m venv /opt/venv-vllm \
      && /opt/venv-vllm/bin/pip install ... \
-      vllm==0.6.5 \
       transformers==4.46.3 \         ← 제거 (vllm 종속으로 남아 있으면 삭제)
       huggingface-hub==0.25.2 \
-      accelerate==1.1.1 \            ← 제거 (transformers device_map 전용)
      ...
-      # llama-cpp-python CUDA wheel (유지)
+      # llama-cpp-python CUDA wheel (유지 ← 유일한 GGUF Python 엔진)
       --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu124 \
       llama-cpp-python==0.3.4 \
       onnxruntime-genai-cuda==0.8.0 \  ← 유지 (Phi/Gemma3 전용)
       fastapi uvicorn httpx            ← 유지
```

**제거 가능 패키지:**
- `vllm==0.6.5` — 직접 제거
- `torch==2.5.1` — vllm / transformers 모두 제거되면 의존 사라짐
- `transformers==4.46.3` — 직접 제거
- `accelerate==1.1.1` — transformers device_map 전용 → 제거
- `sentencepiece==0.2.0` — transformers tokenizer 전용 → 제거

**유지 패키지:**
- `llama-cpp-python==0.3.4` (CUDA wheel) — GGUF 엔진
- `onnxruntime-genai-cuda==0.8.0` — ONNX 엔진
- `huggingface-hub==0.25.2` — HF Hub 모델 다운로드 (llama-cpp-python, onnx 모두 사용)
- `fastapi`, `uvicorn[standard]`, `httpx` — Python sub-server 라우터

### §5.2 inference-py/requirements.txt

```diff
  fastapi==0.115.5
  uvicorn[standard]==0.32.1
  pydantic==2.10.3
  httpx==0.28.1

  llama-cpp-python==0.3.4
- onnxruntime-genai==0.5.2          ← Dockerfile 에서 0.8.0 CUDA wheel 사용; 이 줄은 fallback
+ onnxruntime-genai==0.8.0          ← 버전 동기화
- transformers==4.46.3              ← 제거
- sentencepiece==0.2.0              ← 제거
- accelerate==1.1.1                 ← 제거
  huggingface-hub==0.25.2
```

### §5.3 inference-py/engines/catalog.py

```diff
  ENGINES = {
      "llama-cpp-python":  {...},   ← 유지
      "onnxruntime-genai": {...},   ← 유지
-     "transformers":      {...},   ← 제거
      "ollama":            {...},   ← 유지
-     "llama-server":      {...},   ← 제거
-     "vllm":              {...},   ← 제거
  }
```

모델 `engines` 딕셔너리 정리:
- `qwen25-3b`, `qwen25-7b` → `transformers` 항목 제거, `llama-cpp-python` + `ollama` 유지
- `disabled_engines` 에서 제거된 엔진 레퍼런스 정리

`_available_engine_keys()` 함수 단순화:
```diff
  if "llama-cpp-python" in engines:
-     available.extend(["llama-server", "llama-cpp-python"])
+     available.append("llama-cpp-python")
- if "transformers" in engines:
-     available.extend(["vllm", "transformers"])
```

### §5.4 inference-py/engines/__init__.py

```diff
  from . import ollama as _ollama_engine
- from . import llamaserver as _llamaserver_engine
- from . import vllm_engine as _vllm_engine

  def _get_lazy(name):
      if name == "llama-cpp-python":
          from . import llamacpp as m
      elif name == "onnxruntime-genai":
          from . import onnx as m
-     elif name == "transformers":
-         from . import transformers_engine as m
      ...

  _DISPATCH = {
      "ollama":            _ollama_engine.infer,
-     "llama-server":      _llamaserver_engine.infer,
-     "vllm":              _vllm_engine.infer,
      "llama-cpp-python":  lambda **kw: _get_lazy("llama-cpp-python").infer(**kw),
      "onnxruntime-genai": lambda **kw: _get_lazy("onnxruntime-genai").infer(**kw),
-     "transformers":      lambda **kw: _get_lazy("transformers").infer(**kw),
  }
```

**삭제 파일:**
- `inference-py/engines/llamaserver.py` (50줄)
- `inference-py/engines/vllm_engine.py` (54줄)
- `inference-py/engines/transformers_engine.py` (96줄)

### §5.5 start.sh

```diff
  # llama-server / vLLM 은 lazy — 이 섹션 완전 제거
- echo "[start.sh] llama-server / vLLM = lazy (api/local-infer.js 가 spawn)"
+ echo "[start.sh] llama-server / vLLM 제거됨 (REBUILD32 슬림화)"

  # SIGTERM trap 단순화
  trap '
      ...
-     pkill -TERM -f llama-server 2>/dev/null || true
-     pkill -TERM -f "vllm.entrypoints" 2>/dev/null || true
      ...
  ' TERM INT
```

### §5.6 api/local-infer.js

`api/local-infer.js` (40KB) 에서 engine 분기 정리:
- `llama-server` (port 11435) 관련 spawn, healthcheck, proxy 코드 제거
- `vllm` (port 11436) 관련 spawn, healthcheck, proxy 코드 제거
- `transformers` engine dispatch 제거
- 지원 엔진 목록 상수에서 3개 제거

### §5.7 삭제 대상 파일 (3개)

```
inference-py/engines/llamaserver.py       (50줄, llama-server HTTP proxy)
inference-py/engines/vllm_engine.py       (54줄, vLLM HTTP proxy)
inference-py/engines/transformers_engine.py (96줄, HF PyTorch in-process)
```

---

## §6 옵션 비교

두 가지 슬림화 수위를 제안한다.

### 옵션 A: 3-엔진 (권장) ⭐

**Ollama + llama-cpp-python + onnxruntime-genai**

- 서버 통합 실험실의 "엔진 비교" 교육 목적 유지
- GGUF 직접 Python 추론(llama-cpp-python)이 Ollama와 실측 비교 가능
- 총 11개 모델 모두 서비스 가능 유지

### 옵션 B: 2-엔진 (최소)

**Ollama + onnxruntime-genai**

- llama-cpp-python 도 제거
- GGUF 모델(qwen25, gemma2, deepseek-r1)은 Ollama로만 서비스
- Python sub-server가 onnxruntime-genai 전용으로 단순화
- 서버 통합 실험실 엔진 선택지 최소화 (교육 비교 축소)

```
옵션 A 추가 제거 대상 (B 채택 시):
  - llama-cpp-python CUDA wheel (Dockerfile --extra-index-url 라인)
  - inference-py/engines/llamacpp.py
  - inference-py/engines/_daemon.py (llama-server / vllm 전용으로 실질 의미 사라짐)
```

**권장: 옵션 A** — 교육 플랫폼 특성상 "여러 방식 직접 비교"가 핵심 가치. llama-cpp-python은 Python 직접 호출 방식을 시연하는 유일한 방법이며 Ollama와 추론 속도/품질 비교에 유용.

---

## §7 실험실 영향

| 실험실 | 영향 |
|--------|------|
| local-ai (WebLLM) | **없음** — 브라우저 WASM, 서버 무관 |
| server-infer (일심동체) | 엔진 선택지 6→3. 모델 지원 범위 동일 |
| local-gcp (격리 service) | **없음** — 별도 service (Ollama 단일, 변경 없음) |
| hf-playground (Transformers.js) | **없음** — 브라우저 Transformers.js, 서버 무관 |
| ollama-bridge | **없음** — 로컬 Ollama 테스터, 서버 무관 |

---

## §8 실행 순서 (단계별 체크리스트)

### Step 1: Python 엔진 파일 제거

```bash
rm inference-py/engines/llamaserver.py
rm inference-py/engines/vllm_engine.py
rm inference-py/engines/transformers_engine.py
```

### Step 2: catalog.py 수정

- ENGINES 딕셔너리에서 `llama-server`, `vllm`, `transformers` 제거
- MODEL_MAP 에서 `transformers` 엔진 항목 제거 (qwen25-3b/7b)
- `_available_engine_keys()` 에서 llama-server/vllm 파생 로직 제거
- `DEFAULT_ENGINE` 재확인 (`llama-cpp-python` → 변경 없음 OK)

### Step 3: __init__.py 수정

- llamaserver, vllm_engine import 제거
- _DISPATCH 에서 3개 항목 제거
- _get_lazy 에서 transformers 분기 제거

### Step 4: requirements.txt 수정

- `transformers`, `sentencepiece`, `accelerate` 제거
- `onnxruntime-genai` 버전 0.8.0 으로 동기화

### Step 5: start.sh 수정

- llama-server / vLLM lazy spawn 언급 주석 정리
- SIGTERM trap 에서 llama-server / vllm 프로세스 kill 제거

### Step 6: api/local-infer.js 수정 (가장 큰 파일, 40KB)

- 엔진 분기 코드에서 `llama-server`, `vllm`, `transformers` 관련 블록 제거
- spawn 함수, healthcheck 함수, proxy 함수 정리

### Step 7: Dockerfile 수정

- Stage 2 (llamacpp-builder) 전체 블록 제거 (~35줄)
- Stage 3 에서 COPY --from=llamacpp-builder 2줄 제거
- LD_LIBRARY_PATH 환경변수 제거
- pip install 에서 `vllm`, `transformers`, `accelerate`, `sentencepiece` 제거
- torch CUDA 별도 설치 라인 제거 (torch 없으면 불필요)

### Step 8: 검증

```bash
# 로컬 빌드 확인 (Stage 2 없어짐 → 2-stage)
docker build -t aitutor-slim-test .

# 추론 엔진 3종 동작 확인
curl -X POST /api/local-infer -d '{"model_key":"qwen25-3b","engine":"ollama","prompt":"안녕"}'
curl -X POST /api/local-infer -d '{"model_key":"qwen25-3b","engine":"llama-cpp-python","prompt":"안녕"}'
curl -X POST /api/local-infer -d '{"model_key":"phi4-mini","engine":"onnxruntime-genai","prompt":"안녕"}'
```

### Step 9: Cloud Run 배포

```bash
cd workspace/aitutor && gcloud builds submit --config cloudbuild.yaml --project=aitutortwo-prod
```

---

## §9 리스크 및 대비

| 리스크 | 발생 가능성 | 대비 |
|--------|-------------|------|
| llama-cpp-python CUDA wheel이 torch 없이 import 실패 | 낮음 | abetlen prebuilt wheel은 자체 CUDA 링크, PyTorch 의존 없음. 첫 빌드에서 검증. |
| onnxruntime-genai 0.8.0 API 변경 (0.5.2→0.8.0) | 중간 | `onnx.py` 의 `og.Generator` API 호환성 확인. 실패 시 onnx.py 만 수정. |
| huggingface-hub 0.25.2 가 llama-cpp-python의 HF 다운로드 차단 | 낮음 | REBUILD28 P0 에서 이미 검증된 버전. |
| 사용자가 vLLM/transformers 엔진 직접 요청 | 있음 | UI에서 엔진 선택지 비노출. 서버에서 422 Unknown Engine 반환. |

---

## §10 미래 확장 여지

슬림화 이후에도 아래 상황이 되면 엔진 재추가가 가능하다:

| 조건 | 엔진 | 근거 |
|------|------|------|
| Qwen 4 / Gemma 5 등 vLLM 최적화 모델 출시 | vLLM | 고처리량 모델 생기면 vLLM PagedAttention 가치 부활 |
| transformers가 Qwen 3.5 공식 weights 공개 | transformers | HF weights 접근 가능해지면 fine-tune 비교 목적 |
| llama.cpp가 Gemma 4 GGUF 공식 지원 | llama-server | Stage 2 복구 or prebuilt binary 활용 |

---

## §11 결론

### 권장 진행 방향

```
옵션 A 채택: 6 엔진 → 3 엔진 (Ollama + llama-cpp-python + onnxruntime-genai)
```

**예상 결과:**
- Docker 이미지 크기 ~5GB 절감
- 빌드 시간 ~10~15분 단축 (cmake Stage 2 제거)
- cold start 메모리 ~2~4GB 절감 (torch import 제거)
- 유지보수 코드 ~200줄 감소
- 실험실 모델 커버리지 100% 유지 (11개 모델 전부 서비스 가능)

**사용자 확인이 필요한 의사결정:**
1. 옵션 A(3 엔진) vs 옵션 B(2 엔진) 선택
2. 실행 시점 (즉시 vs 다음 스프린트)
3. 격리 service (aitutor-server-infer) 는 이미 Ollama 단일 → 변경 없음 확인

---

*이 문서는 제안 단계입니다. 사용자 승인 후 §8 실행 순서에 따라 코드 변경을 진행합니다.*
