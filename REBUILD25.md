# REBUILD25 — 실험실 4개 최종 아키텍처 + 통합 서버 추론 service 설계

> 작성: 2026-04-29 오후
> 목적: REBUILD23 (AWS→GCP 마이그) + REBUILD24 (실험실 정밀 분석) 의 결론을 토대로 **사용자 최종 결정 (4 실험실 컨셉 정리)** 을 반영. 진행 내역 + 앞으로 할 계획 통합.

---

## 0. TL;DR — 사용자 최종 결정 (2026-04-29 오후)

### 0.1 실험실 5개 → **4개로 정리**

| 이전 | 결정 | 변경 |
|---|---|---|
| `hf-playground` | ✅ 영구 유지 | 변경 0 |
| `local-ai` | ✅ 영구 유지 | 변경 0 |
| `local-gcp` (구 local-lambda) | ✅ 영구 유지 + **Phase 5: 추론 엔진 3종 완성** | Ollama (active) + llama.cpp + vLLM (Phase 5) |
| `server-ai` (ONNX) | 🔄 **server-ai-gguf 와 통합** | server-ai-gguf 와 합쳐서 1개 실험실로 |
| `server-ai-gguf` (GGUF) | 🔄 **server-ai 와 통합** | 위와 동일 |

### 0.2 통합 서버 추론 service 의 컨셉 (3가지 동시 수용)

> 사용자 결정 (그대로 인용):
> "기본 서비스와 추론서버를 분리하여 **3가지 추론 엔진을 변경가능**하고 **모델도 변경로드하도록 (여러모델)** 구현"

| 컨셉 | 구현 |
|---|---|
| **격리** (메인 앱과 분리) | 별도 Cloud Run service (예: `aitutor-inference`) |
| **3 엔진 비교** | 같은 컨테이너 안에 3 daemon 동거 (onnxruntime-genai / llama-cpp-python / + 1) |
| **여러 모델** | 모델 드롭다운으로 런타임 변경 가능 |
| **GPU 정책** ⭐ | **CPU only 로 시작** — GPU quota 추가 신청 X. 나중에 quota 배정 받으면 1줄 명령으로 GPU 추가 (사용자 결정 2026-04-29) |

### 0.3 4 실험실 최종 운영도

```
┌─ /lab/hf            : 외부 다중 provider (HF Inference, 122 models)
├─ /lab/local-ai      : 클라이언트 WebGPU (Transformers.js)
├─ /lab/local-gcp     : 일심동체 (메인 Cloud Run + 3 엔진 동거)
└─ /lab/server-infer  : 격리 추론 (별도 Cloud Run + 3 엔진 + 여러 모델) ⭐ 신규 통합
```

---

## 1. 진행한 내용 정리 (REBUILD23 + 24 결과)

### 1.1 마이그 단계 — Phase 1~4 라이브 ✅

| Phase | 작업 | 결과 |
|---|---|---|
| 1 | Artifact Registry `aitutor` (asia-northeast3) | ✅ |
| 2 | Service Account `aitutor-run` + Secret Manager 8개 + GCS 버킷 + IAM | ✅ |
| 3 | 코드 변경 37+ 파일 (Storage S3→GCS, 추론 SigV4→Ollama, 실험실 rename) | ✅ |
| 4 | Cloud Run 배포 (us-east4, GPU L4, 8 vCPU, 32 Gi RAM) | ✅ |
| 5 | Capacitor 모바일 sync (iOS + Android) | ✅ |
| 6 | AWS 인프라 폐기 | 🟡 1~2주 검증 후 |

**라이브 URL**: `https://aitutor-z2ppabmtxa-uk.a.run.app` (us-east4)

### 1.2 빌드 / 배포 history

| # | TAG | Region 결정 | 변경 사항 |
|---|---|---|---|
| 1 | (실패) | - | $COMMIT_SHA 빈값 |
| 2 | (실패) | - | zstd 누락 (Ollama install 실패) |
| 3 | (실패) | - | nvcc 없음 (llama.cpp 빌드 실패) |
| 4 | (실패) | us-central1 | GPU L4 quota 0 |
| 5 | v20260429-101938 | us-central1 (GPU 없이) | q-images 누락 fix 필요 |
| 6 | v20260429-111534 | us-central1 → us-east4 (GPU L4) | q-images 포함, GPU 활성 |
| 7 | v20260429-130837 | us-east4 | Ollama 모델 이름 정정 (qwen3:4b) |
| 8 | v20260429-132637 | us-east4 | 자동 pull 로직 추가 |
| 9 | v20260429-141216 | us-east4 | Qwen thinking 비활성 |
| 10 | v20260429-143733 | us-east4 (active) | **Qwen 한국어 강제** ⭐ 현재 라이브 |

### 1.3 사용자 검증 결과

- ✅ Stage 1 sanity check 통과 (로그인 / 문제풀이 / AI 해설 / 메모)
- ✅ /lab/local-gcp Ollama 추론 작동 (Qwen 3 4B 한국어 답변 검증 진행 중)
- ✅ 모든 Gemma 3n 모델 정상
- 🚧 server-ai / server-ai-gguf 컨셉 변형 발견 → **본 REBUILD25 의 핵심 작업**

### 1.4 누적 비용 (마이그 단계)

| 항목 | 금액 |
|---|---|
| Cloud Build 5~9차 (5회) | ~$1.50 |
| Cloud Run 호출 검증 | <$0.10 |
| Storage / Secret Manager / IAM | ~$0 (무료 한도) |
| **누적** | **~$1.60** ($10 budget 의 16%) |

---

## 2. 3-way 추론 컨셉 정밀 비교 (REBUILD25 핵심)

### 2.1 원본 (AWS Lambda 시절) 의 진짜 아키텍처

| 실험실 | 위치 | 호출 패턴 |
|---|---|---|
| **local-gcp** (당시 local-lambda) | **같은 Lambda** (메인 앱 + 모델 같은 process) | Express 안에서 `node-llama-cpp` 직접 추론 |
| **server-ai** | **별도 Lambda 함수** (model 당 1개씩 — `aitutor-inference-e2b`, `aitutor-inference-e4b`, `aitutor-inference-qwen35-4b`) | 메인 Lambda → SigV4 → 다른 Lambda invoke |
| **server-ai-gguf** | **별도 Lambda 함수** (`aitutor-inference-e2b-gguf`, `aitutor-inference-e4b-gguf`) | 동일 |

→ 사용자 가설 100% 맞음:
- **local-gcp** = "같은 서버에 모델"
- **server-ai / server-ai-gguf** = **별도 서버 (Lambda) 에 모델**, 엔진/포맷만 다름

### 2.2 ⚠ 1차 마이그 (REBUILD23) 에서 일어난 컨셉 변형

| 측면 | 원본 (AWS) | 1차 마이그 후 (현재) | 진짜 컨셉 복원 시 |
|---|---|---|---|
| local-gcp | (없음) | ✅ 같은 Cloud Run | ✅ 같은 Cloud Run (변경 없음) |
| server-ai | 별도 Lambda (ONNX) | ⚠ **같은 Cloud Run, Ollama 매핑** | 별도 Cloud Run service `aitutor-inference` |
| server-ai-gguf | 별도 Lambda (GGUF) | ⚠ **같은 Cloud Run, Ollama 매핑** | 위와 통합 (사용자 결정) |

→ 1차 마이그 시 빠른 진행을 위해 3개 모두 같은 Cloud Run 의 Ollama 로 매핑 → "격리 vs 통합" 의 핵심 컨셉 차이가 사라짐.

### 2.3 두 server-* 의 의도된 차이 (격리 + 엔진 + 포맷)

| 측면 | server-ai | server-ai-gguf |
|---|---|---|
| **추론 엔진** | onnxruntime-genai (Microsoft) | llama-cpp-python (Georgi Gerganov) |
| **모델 포맷** | ONNX | GGUF |
| **양자화** | q4f16 (mixed-precision) | Q4_K_M (4-bit k-quants) |
| **메모리 사용** | 큼 (~모델 × 1.5) | 작음 (~모델 × 1.1) |
| **CPU 추론 속도** | 느림 | 빠름 (llama.cpp 최적화) |
| **GPU 추론 속도** | 빠름 (CUDA backend) | 빠름 (CUDA backend) |
| **multi-hardware 지원** | 매우 다양 (CPU/CUDA/Metal/CoreML/DirectML) | CPU/CUDA 위주 |
| **모델 카탈로그** | onnx-community/* | unsloth/*, MaziyarPanahi/* |
| **격리도** | 메인 service 와 별도 | 메인 service 와 별도 |
| **장애 영향** | 죽어도 메인 OK | 죽어도 메인 OK |

### 2.4 일심동체 (local-gcp) 의 본질적 가치

**문제**: AWS Lambda 시절 옵션 A/P/C 모두 SigV4 mismatch / SCP 차단으로 실패. 외부 inference Lambda 호출이 비효율 + 인증 지옥.

**해결**: "앱 + 모델 같은 process" 컨셉
- 외부 API 호출 0 (인증 X, network X)
- 메인 앱이 Express 로 사용자 요청 받고 → localhost 의 Ollama 로 fetch → 즉시 응답
- 모든 의존성 한 컨테이너 안에 → 운영 단순

**부가 가치**:
- **엔진 교체 가능 컨셉** (Ollama / llama.cpp / vLLM) — 다른 두 실험실엔 없음
- 모델 swap 이 런타임에 일어남 (Ollama 의 자동 load/unload)
- 비용 효율 (한 인스턴스에 모든 것)

### 2.5 한 표로 — 4 실험실 최종 컨셉

| 실험실 | 컨셉 | 격리도 | 추론 위치 | 엔진 |
|---|---|---|---|---|
| `hf-playground` | 외부 다중 provider | ✅ 외부 (HF) | router.huggingface.co | 14 providers (자동) |
| `local-ai` | 클라이언트 측 | ✅ 클라이언트 | 브라우저 (WebGPU) | Transformers.js |
| `local-gcp` | 일심동체 | ❌ 메인과 통합 | 메인 Cloud Run 내부 | Ollama / llama-server / vLLM (Phase 5) |
| `server-infer` ⭐ 신규 통합 | 격리 + 엔진 비교 | ✅ 메인과 분리 | 별도 Cloud Run service | onnxruntime-genai / llama-cpp-python / transformers |

→ **4 실험실이 진짜로 4가지 다른 컨셉**.

### 2.6 추론 엔진 동향 조사 (2026년 4월 WebSearch 검증)

WebSearch + 공식 문서 정밀 조사 결과 (출처는 § 2.8):

#### 2.6.1 산업 표준 (2026 4월 기준)

| Tier | 엔진 | 위치 | 비고 |
|---|---|---|---|
| 🥇 1대 표준 | **vLLM** | 산업 표준 (Amazon Rufus 250M users, LinkedIn, Roblox 4B tokens/주, Stripe -73% 비용) | PagedAttention, GPU 최강 default, OpenAI 호환, **Google Cloud Run 공식 codelab 존재** |
| 🥈 2nd | **SGLang** | UC Berkeley LMSYS, 부상 | RadixAttention, 8B 모델에서 vLLM 대비 +29% 빠름 |
| 🥉 3rd | **TensorRT-LLM** | NVIDIA 공식 | 최고 성능, 28분 컴파일 + NVIDIA only |
| ⚠ 폐기 | ~~TGI~~ | HuggingFace | **2025-12-11 maintenance mode 진입**. HuggingFace 공식 vLLM/SGLang 권장 |

#### 2.6.2 CPU/Edge 환경

| 엔진 | 강점 | 검증 |
|---|---|---|
| **llama.cpp** (raw C++) | CPU 가장 빠름 (GGUF Q4_K_M) | Apple Silicon 표준 |
| **Ollama** | llama.cpp wrapper, 자동 관리 + OpenAI 호환 | 데스크탑/개발자 표준 |
| **onnxruntime-genai** (ONNX) | 다양한 hardware (CPU/CUDA/CoreML/DirectML) | int4 CPU 는 느림 보고됨 |

#### 2.6.3 Cloud Run + L4 GPU 공식 권장 (Google Cloud Docs)

- **4-bit 양자화 + GGUF** 권장 (빠른 로드)
- **8 vCPU + 32 GiB** recommended (현재 메인 service 정확 일치 ✅)
- **NVIDIA NIM + vLLM** 공식 codelab 제공 — Cloud Run + vLLM 적극 supported

#### 2.6.4 Ollama vs llama.cpp 의 진짜 성능 차이

- 단발 호출: 차이 미미 (15~30%)
- **동시 5 요청 시 llama.cpp 가 Ollama 대비 3x throughput** (Ollama 가 VRAM 부족 시 38% CPU offload)
- → 영상정보관리사 시나리오 (가끔 호출) 는 **Ollama 의 편의성** 가치 큼

### 2.7 llama-server vs llama-cpp-python — 같은 코어, 다른 layer

```
                    [llama.cpp] (Georgi Gerganov, C/C++)
                         ↑
                   같은 추론 코어 (양자화, GGUF, KV cache)
                         ↓
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  [llama-server]    [llama-cpp-python]   [Ollama]
  C++ binary        Python binding       Go wrapper
  (Phase 5)         (Phase 7-1)          (Phase 5, 현재 active)
```

#### 차이점 표

| 측면 | **llama-server** (Phase 5) | **llama-cpp-python** (Phase 7-1) |
|---|---|---|
| 구현체 | C++ native binary (llama.cpp 빌드 산출물) | Python wrapper (FFI 로 C++ 호출) |
| 빌드 결과 | `/usr/local/bin/llama-server` | `pip install llama-cpp-python` → Python module |
| 시작 | `llama-server -m model.gguf --port 11435` | `python -m llama_cpp.server --model model.gguf` |
| 호출 | HTTP API only | HTTP API + 직접 Python import |
| 의존성 | CUDA libs + libc only (작음) | Python runtime + pip deps + native build (큼) |
| Image 크기 | ~50MB binary | ~500MB (Python + deps) |
| 성능 | **Native, 가장 빠름** | Python overhead (~1~3% FFI 비용) |
| 라이선스 | MIT (llama.cpp) | MIT |

#### 비유

- **llama.cpp** = 자동차 **엔진** (C++ 코어)
- **llama-server** = 그 엔진을 단 **자동차** (직접 운전 — C++ 환경)
- **llama-cpp-python** = 그 엔진을 단 **운전 시뮬레이터** (Python 으로 조작)
- **Ollama** = 그 엔진을 단 **자율주행 자동차** (Go wrapper, 자동 모델 관리)

→ **추론 결과는 동일** (같은 코어, 같은 GGUF Q4_K_M), 다만 **운영 환경/언어**가 다름.

#### 우리 프로젝트의 사용 위치

| 위치 | 환경 | 엔진 선택 | 이유 |
|---|---|---|---|
| **Phase 5 (local-gcp)** | Node.js 메인 컨테이너 | Ollama + **llama-server (C++)** + vLLM | C++ binary 가 image 작음, 추가 Python 의존 X |
| **Phase 7-1 (server-infer)** | Python 격리 컨테이너 | onnxruntime-genai + **llama-cpp-python** + transformers | 다른 두 엔진도 Python → 일관성 |

→ **같은 코어를 환경별 최적 layer 로 사용**. 단순 통일 (한 가지로) 하면 환경 불일치 발생.

### 2.9 제로베이스 최적 3 엔진 추천 (사용자 요청 2026-04-29 후속)

> 사용자 요청: "추론엔진 서버를 분리했을때의 최적 추론엔진 3가지 추천 (해당 서버 gpu 유무 관련있나요?). 일심동체도 제로베이스에서 일심동체시 가장 적합한 추론 엔진 3개로 추천. (gpu 유무도 관련 있나요?)"

#### 2.9.1 ⚠ 핵심 발견 — GPU 유무가 엔진 카탈로그를 결정함

| 엔진 분류 | GPU 필수 | CPU only 가능 | 둘 다 |
|---|---|---|---|
| **vLLM** | ✅ 사실상 필수 | ❌ CPU 지원 약함, 매우 느림 | - |
| **SGLang** | ✅ 사실상 필수 | ❌ 동일 | - |
| **TensorRT-LLM** | ✅ 필수 (NVIDIA) | ❌ 작동 X | - |
| **Ollama** | ⭐ GPU 활용 | ⭐ CPU 가능 (느림) | ✅ 둘 다 |
| **llama-server (C++)** | ⭐ GPU 활용 | ⭐ CPU 가장 빠름 (GGUF) | ✅ 둘 다 |
| **llama-cpp-python** | ⭐ GPU 활용 | ⭐ CPU 가장 빠름 (Python) | ✅ 둘 다 |
| **onnxruntime-genai** | ⭐ GPU 활용 | ⭐ CPU 가능 (int4 느림 보고) | ✅ 둘 다 |
| **transformers (PyTorch)** | ⭐ GPU 빠름 | ⚠ CPU 매우 느림 (데모용) | ✅ 둘 다 |

→ **격리 server-infer 의 CPU only 시점 (Phase 7-1)** 에서는 **vLLM/SGLang 사용 불가**. GPU 추가 (Phase 7-2) 후에야 산업 표준 vLLM/SGLang 활용 가능.
→ **일심동체 local-gcp** 는 메인 service 의 GPU L4 활성 → vLLM 사용 가능.

#### 2.9.2 4가지 시나리오별 최적 3 엔진

##### 시나리오 ① — 일심동체 local-gcp (**GPU 활성**, 현재 환경) ⭐ 사용자 채택안

| # | 엔진 | 컨셉 | 검증 |
|---|---|---|---|
| 1 | **Ollama** | 개발자 편의 + 자동 모델 관리 + OpenAI 호환 | 현재 active, 데스크탑 표준 |
| 2 | **vLLM** | **2026 산업 표준**, PagedAttention, GPU 최강 | Amazon/LinkedIn/Stripe 프로덕션, Google Cloud Run 공식 codelab |
| 3 | **llama-server** (C++) | Ollama 의 raw 코어, 동시 요청 시 Ollama 대비 3x throughput | NVIDIA L4 검증됨 |

→ Phase 5 채택 그대로. **2026 산업 표준에 정확히 부합**.

##### 시나리오 ② — 일심동체 local-gcp (가설: GPU 없을 때)

| # | 엔진 | 컨셉 |
|---|---|---|
| 1 | **Ollama** (자동 관리, CPU 가능) | 변경 없음 |
| 2 | **llama-server** (C++ GGUF, CPU 최강) | 변경 없음 (GPU 없으면 더 가치 ↑) |
| 3 | **onnxruntime-genai** (Microsoft 다양 hardware) | vLLM 자리 대체 — vLLM 은 CPU 거의 안 됨 |

→ 우리 환경은 GPU 있음 → 시나리오 ①. 가설 ② 는 백업 reference.

##### 시나리오 ③ — 격리 server-infer (**CPU only**, Phase 7-1) ⭐ 사용자 채택안

| # | 엔진 | 컨셉 | CPU 추론 적합도 |
|---|---|---|---|
| 1 | **llama-cpp-python** | GGUF Q4_K_M Python binding | ⭐⭐⭐⭐⭐ (CPU 최강) |
| 2 | **onnxruntime-genai** | Microsoft, ONNX, 다양 hardware | ⭐⭐ (int4 CPU 느림 보고) |
| 3 | **transformers (PyTorch CPU)** | HuggingFace 표준, 가장 다양한 모델 | ⭐ (매우 느림, 데모용) |

→ Phase 7-1 채택 그대로. **CPU 환경에서 GGUF (llama-cpp-python) 가 압도적**.

##### 시나리오 ④ — 격리 server-infer (**GPU 추가**, Phase 7-2)

###### 옵션 4-A : 일심동체와 호환 비교 우선
| # | 엔진 | 비고 |
|---|---|---|
| 1 | **vLLM** | 산업 표준 (일심동체와 중복) |
| 2 | **SGLang** | 부상, RadixAttention prefix cache |
| 3 | **transformers (PyTorch GPU)** | 다양 모델 |

###### 옵션 4-B : 일심동체와 차별화 우선 ⭐ 권장
| # | 엔진 | 비고 |
|---|---|---|
| 1 | **SGLang** | vLLM 대안, 8B 모델에서 vLLM 대비 +29% 빠름 |
| 2 | **transformers (PyTorch GPU)** | HuggingFace 표준, BitsAndBytes 양자화 |
| 3 | **(Phase 7-1 의 onnxruntime-genai 또는 llama-cpp-python 유지)** | ONNX 또는 GGUF 컨셉 보존 |

→ 옵션 4-B 가 4 실험실 (hf-playground/local-ai/local-gcp/server-infer) 의 **진정한 차별화** 달성.

#### 2.9.3 GPU 유무 영향 종합 답

| 질문 | 답 |
|---|---|
| 격리 server-infer 의 GPU 유무 영향? | **결정적**. CPU only 면 vLLM/SGLang 불가, GGUF 계열 (llama-cpp-python) 위주. GPU 추가 시 SGLang/vLLM 진가 발휘 |
| 일심동체 local-gcp 의 GPU 유무 영향? | **결정적**. GPU 없으면 vLLM 빼고 Ollama+llama-server+onnxruntime-genai 로 변경. 우리 환경은 GPU 활성 → vLLM 가능 |

#### 2.9.4 사용자 시나리오 적합성 점검 (영상정보관리사 = 2명 가끔 호출)

| 엔진 | 적합도 | 사유 |
|---|---|---|
| Ollama | ⭐⭐⭐⭐⭐ | 자동 관리 가장 편리 |
| vLLM | ⭐⭐⭐⭐ | 산업 표준, 단발 호출에도 적합 |
| llama-server / llama-cpp-python | ⭐⭐⭐⭐ | CPU/GPU 모두 빠름 |
| SGLang | ⭐⭐⭐ | RadixAttention 은 multi-turn/RAG 시너지 — 단발 시나리오엔 효과 작음 |
| TensorRT-LLM | ⭐⭐ | 28분 컴파일 + 가끔 호출 = 비효율 |
| transformers | ⭐⭐⭐ | 다양 모델 비교 가치, 속도는 다른 엔진 대비 떨어짐 |
| onnxruntime-genai | ⭐⭐⭐ | ONNX 컨셉 가치 있음, int4 CPU 는 느림 |

→ 우리 시나리오에 가장 부합 = **Ollama + vLLM + llama-server (일심동체)** + **llama-cpp-python + onnxruntime-genai + transformers (격리 CPU)**

#### 2.9.5 결론

✅ **사용자 원안 (방향) = 2026 산업 표준 + 우리 시나리오에 정확히 부합**:
- 일심동체: **Ollama / vLLM / llama-server**
- 격리 CPU only: **llama-cpp-python / onnxruntime-genai / transformers**
- 격리 GPU 추가 후: 그대로 유지 또는 transformers → SGLang 교체 옵션

⚠ **GPU 유무는 엔진 선택의 결정적 요인**:
- vLLM/SGLang/TensorRT-LLM 은 사실상 GPU 필수
- llama.cpp 계열 (GGUF) 은 CPU/GPU 모두 강력
- onnxruntime-genai 는 다양 hardware 호환 (다만 int4 CPU 약점)

---

### 2.8 출처 (2026년 4월 검증)

본 § 2.6 의 동향 분석은 다음 공식 문서 + 산업 분석 종합:

- **Google Cloud 공식**:
  - [Best practices: AI inference on Cloud Run with GPUs](https://docs.cloud.google.com/run/docs/configuring/services/gpu-best-practices)
  - [How to run LLM inference on Cloud Run GPUs with vLLM (codelab)](https://codelabs.developers.google.com/codelabs/how-to-run-inference-cloud-run-gpu-vllm)
  - [NVIDIA Blog: Cloud Run Adds Support for NVIDIA L4 GPUs and NIM](https://developer.nvidia.com/blog/google-cloud-run-adds-support-for-nvidia-l4-gpus-nvidia-nim-and-serverless-ai-inference-deployments-at-scale/)
- **2026 산업 비교 분석**:
  - [Spheron: vLLM vs TensorRT-LLM vs SGLang H100 Benchmarks](https://www.spheron.network/blog/vllm-vs-tensorrt-llm-vs-sglang-benchmarks/)
  - [Yotta Labs: Best LLM Inference Engines 2026](https://www.yottalabs.ai/post/best-llm-inference-engines-in-2026-vllm-tensorrt-llm-tgi-and-sglang-compared)
  - [BentoML: Best Open-Source LLMs in 2026](https://www.bentoml.com/blog/navigating-the-world-of-open-source-large-language-models)
  - [Fish Audio: Open-source LLM Inference Engines compared 2026](https://fish.audio/blog/open-source-llm-inference-engines-2026/)
- **Ollama / llama.cpp 비교**:
  - [Morph LLM: llama.cpp vs Ollama 2026 Performance](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
  - [openxcell: llama.cpp vs Ollama Best Local LLM Tool 2026](https://www.openxcell.com/blog/llama-cpp-vs-ollama/)
- **ONNX Runtime / llama.cpp 비교**:
  - [Microsoft ONNX Runtime: Accelerating Phi-2, CodeLlama, Gemma](https://onnxruntime.ai/blogs/accelerating-phi-2)
  - [WandB: Inference Speed Benchmarking GPU/CPU/LlamaCPP/ONNX](https://wandb.ai/c-metrics/model-latency-benchmarking/reports/Inference-Speed-Benchmarking-GPU-CPU-LlamaCPP-ONNX--VmlldzoxMDQwMzIwNA)
  - [GitHub: onnxruntime-genai int4 CPU 느림 issue #1098](https://github.com/microsoft/onnxruntime-genai/issues/1098)

---

## 3. 앞으로 할 계획 — Phase 5 + Phase 6 + Phase 7

### 3.1 Phase 5 — local-gcp 추론 엔진 3종 완성

**현재**: Ollama (active) only. llama.cpp + vLLM 은 'planned' 상태.

**목표**: 3 엔진 동시 동거 + UI 드롭다운 모두 active

#### 3.1.0 검증된 3 엔진 선택 근거 (§ 2.6 조사 결과)

| 엔진 | 컨셉 | 검증 |
|---|---|---|
| **Ollama** ⭐ active | 개발자 편의, 자동 모델 관리, OpenAI 호환 | Cloud Run 검증됨, 데스크탑/개발자 표준 |
| **llama-server** (C++) | Ollama 의 raw 엔진, 동시 요청 시 Ollama 대비 3x throughput | NVIDIA L4 검증됨 (Apple Silicon 표준) |
| **vLLM** ⭐ 추가 | **2026 산업 표준** (Amazon/LinkedIn/Stripe), PagedAttention, GPU 최강 | **Google Cloud 공식 Cloud Run codelab 존재** |

→ 사용자 원안 (Ollama / llama.cpp / vLLM) 가 **2026년 산업 표준에 정확히 부합**. 그대로 진행.

#### 3.1.1 Dockerfile multi-stage devel (llama.cpp 빌드용)

```dockerfile
# Stage 1: llama.cpp source build (CUDA 가능 devel base)
FROM nvidia/cuda:12.4.0-devel-ubuntu22.04 AS llamacpp-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake git ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /opt/llama.cpp
WORKDIR /opt/llama.cpp
RUN cmake -B build -DGGML_CUDA=ON -DLLAMA_BUILD_TESTS=OFF -DLLAMA_CURL=OFF \
    && cmake --build build --config Release --target llama-server -j

# Stage 2: Vite frontend build (기존)
FROM node:22-bookworm-slim AS builder
# ... (기존)

# Stage 3: Runtime (기존 + Stage 1 의 binary)
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime
# ... (기존)
COPY --from=llamacpp-builder /opt/llama.cpp/build/bin/llama-server /usr/local/bin/

# vLLM (Python pip install) — image +1.5GB
RUN pip3 install --no-cache-dir vllm==0.7.0
```

#### 3.1.2 start.sh 갱신 — 3 daemon

```bash
# Ollama (이미 active)
ollama serve > /tmp/ollama.log 2>&1 &

# llama.cpp server (lazy 시작 — 첫 호출 시)
# api/local-infer.js 가 spawn
# 또는 startup 시 시작 (모델 lazy 로드)

# vLLM (lazy 시작 — Python heavy)
# 첫 호출 시 spawn
```

#### 3.1.3 api/local-infer.js — 'planned' → 'active' 전환

```js
const ENGINES = {
  'ollama':    { label: 'Ollama',         status: 'active'  },
  'llama-cpp': { label: 'llama.cpp',      status: 'active'  },  // ← Phase 5
  'vllm':      { label: 'vLLM',           status: 'active'  },  // ← Phase 5
};
```

#### 3.1.4 비용 영향

- Cloud Build: ~$0.50 (multi-stage + Python + cmake build 시간 ↑)
- image: +2GB (vLLM Python deps 큼)
- 콜드 스타트: +10s
- idle 비용: $0 (변경 없음)
- 호출당: 같음 (엔진 비교 시 호출 횟수 ×3)

### 3.2 Phase 6 — AWS 인프라 폐기 (1~2주 안정 검증 후)

기존 REBUILD23 § 19.3 그대로:
```bash
aws cloudfront delete-distribution --id E2MP4BK1D16LJN
aws elbv2 delete-load-balancer ...
aws lambda delete-function --function-name aitutor
for f in aitutor-inference-{e2b,e4b,qwen35-4b,e2b-gguf,e4b-gguf} aitutor-infer-router; do
  aws lambda delete-function --function-name $f
done
aws ecr delete-repository --repository-name aitutor --force
# ... ECR / CodeBuild / S3 / SSM 일괄
```

### 3.3 Phase 7 — 통합 서버 추론 service 신규 구축 ⭐ REBUILD25 핵심

#### 3.3.1 신규 Cloud Run service 명세 — **CPU only (Phase 1) → GPU (Phase 2)**

##### Phase 7-1: CPU only (즉시 진행 가능, 사용자 결정 2026-04-29)

```yaml
service:
  name: aitutor-inference
  region: us-east4 (메인과 동일)
  resources:
    cpu: 4
    memory: 16Gi
    gpu: ❌ 없음 (CPU only)
  scaling:
    min: 0 (idle $0)
    max: 2 (CPU instance 는 quota 충분)
    timeout: 1800s (CPU 추론은 느려서 30분 timeout)
  service_account: aitutor-inference-run@aifactory-494108.iam.gserviceaccount.com
  secrets:
    - HF_API_KEY (모델 다운로드용)
  cost:
    idle: $0
    호출당: ~$0.001 ~ $0.005 (모델 사이즈 + 추론 시간)
```

##### Phase 7-2: GPU 추가 (quota 배정 후, 코드 변경 없이 1줄 명령)

```bash
# us-east4 NVIDIA L4 GPU quota 추가 신청 (메인 1 + 추론 1 = 2 GPU)
# 승인 받으면 (1~2일):
gcloud run services update aitutor-inference \
  --region=us-east4 \
  --gpu=1 \
  --gpu-type=nvidia-l4 \
  --no-gpu-zonal-redundancy \
  --no-cpu-throttling \
  --max-instances=1 \
  --project=aifactory-494108
```
- 코드 변경 0
- service 그대로 (revision 만 갱신)
- 추론 속도 즉시 ↑ (CPU 30~120초 → GPU 수 초)
- 비용: idle $0, 호출 시 GPU $0.71/hour 사용량

##### CPU only 시 예상 추론 속도

| 엔진 | 모델 | CPU 추론 시간 (자격증 1문제) |
|---|---|---|
| onnxruntime-genai | Gemma 4 E2B (3.2GB) | ~30~60초 |
| onnxruntime-genai | Gemma 4 E4B (4.9GB) | ~60~120초 |
| onnxruntime-genai | Qwen 3.5 4B (2.5GB) | ~40~80초 |
| llama-cpp-python | Gemma 4 E2B GGUF (1.8GB) | ~10~30초 |
| llama-cpp-python | Gemma 4 E4B GGUF (2.8GB) | ~20~50초 |
| transformers | (작은 모델만) | 매우 느림 (~5~15분), 권장 X CPU only 시점 |

→ Phase 7-1 (CPU only) 에서는 **llama-cpp-python (GGUF) 가 가장 빠름**. 다른 엔진은 데모용.
→ Phase 7-2 (GPU 추가) 에서 모든 엔진 빠르게 작동.

#### 3.3.2 컨테이너 구성 (2026 검증 반영)

```
aitutor-inference 컨테이너 (Python 환경)
├─ Python 3.11
├─ FastAPI / Express (port 8080) — 라우팅 layer
│   POST /infer
│     body: { engine: 'onnx'|'llama-cpp'|'transformers',
│             model: 'gemma-4-e2b'|'qwen3-4b'|... ,
│             messages, maxTokens, temperature }
│
├─ Engine 1: onnxruntime-genai (port 11437) — 'active'
│   ├─ pip: onnxruntime-genai (Microsoft 공식)
│   └─ 모델: gemma-4-e2b-onnx, gemma-4-e4b-onnx, qwen3.5-4b-onnx
│
├─ Engine 2: llama-cpp-python (port 11438) — 'active'
│   ├─ pip: llama-cpp-python (CUDA support)
│   └─ 모델: gemma-4-e2b.gguf, gemma-4-e4b.gguf
│   ⭐ Phase 7-1 CPU only 시점에 가장 빠른 엔진 (GGUF Q4_K_M)
│
└─ Engine 3: transformers (PyTorch native, port 11439) — 'active' ⭐ 권장
    ├─ pip: transformers, torch (cu124 wheel)
    └─ 모델: HuggingFace 표준 (PyTorch tensor)
    ⚠ Phase 7-1 (CPU only) 에서는 데모용 (느림)
    ✅ Phase 7-2 (GPU 추가) 에서 진가 발휘
```

#### 3.3.2-1 3번째 엔진 (transformers) 선택 근거 (§ 2.6 조사 결과)

| 후보 | 평가 | 결정 |
|---|---|---|
| **transformers (PyTorch)** ⭐ | HuggingFace 표준, 가장 다양한 모델, FP16/BitsAndBytes 양자화, CPU 가능 (느림) GPU 빠름 | ✅ **Phase 7 채택 권장** |
| ~~mlc-llm~~ | TVM 기반, 모바일/embed 최적화, 작은 사용 사례 | ❌ Cloud Run 환경 부적합 |
| ~~TGI~~ | **2025-12 maintenance mode 진입** | ❌ HuggingFace 가 공식 폐기 권장 |
| ~~SGLang~~ | RadixAttention prefix cache, GPU 필수 | ⏳ Phase 7-2 (GPU 추가 시) 검토 가능 (transformers 대체 옵션) |
| ~~vLLM~~ | local-gcp 와 중복 | ❌ 격리 service 컨셉 차별화 약화 |
| **2 엔진만 (onnx + llama-cpp)** | 단순화 | ⚠ 가능한 단순안 |

→ **권장**: Phase 7-1 시작 시점엔 **transformers** (Python 표준, HuggingFace 모든 모델 지원). Phase 7-2 GPU 추가 후 사용 패턴 보고 SGLang 으로 교체 옵션 열어둠.

#### 3.3.3 모델 동시 카탈로그 (런타임 변경 가능)

| Model Key | Engine | 출처 | 사이즈 |
|---|---|---|---|
| gemma-4-e2b-onnx | onnx | onnx-community/gemma-4-E2B-it-ONNX | 3.2GB |
| gemma-4-e4b-onnx | onnx | onnx-community/gemma-4-E4B-it-ONNX | 4.9GB |
| qwen3.5-4b-onnx | onnx | onnx-community/Qwen3.5-4B-ONNX | 2.5GB |
| gemma-4-e2b-gguf | llama-cpp | unsloth/gemma-4-E2B-it-GGUF | 1.8GB |
| gemma-4-e4b-gguf | llama-cpp | unsloth/gemma-4-E4B-it-GGUF | 2.8GB |
| qwen3-4b-pt | transformers | Qwen/Qwen3-4B | 8GB (FP16) |

→ **사용자가 UI 에서 engine + model 자유롭게 조합**:
- "gemma-4-e2b" 모델을 ONNX vs GGUF 두 엔진으로 비교
- 같은 모델 다른 추론 스택의 정확도/속도 차이 측정

#### 3.3.4 실험실 UI 통합 — `/lab/server-infer`

```
┌──────────────────────────────────────────┐
│ 🌐 격리 서버 추론 (별도 Cloud Run)        │
│                                          │
│ ⚙ 추론 엔진 (3종)                          │
│   ○ ONNX (onnxruntime-genai)             │
│   ● GGUF (llama-cpp-python)  ⭐ 선택     │
│   ○ PyTorch (transformers)               │
│                                          │
│ 📦 모델 (6종)                             │
│   ● Gemma 4 E2B (3.2GB)  ⭐ 선택         │
│   ○ Gemma 4 E4B (4.9GB)                  │
│   ○ Qwen 3.5 4B (2.5GB)                  │
│   ○ ...                                  │
│                                          │
│ [✨ 격리 service 로 추론 실행]             │
│                                          │
│ 메트릭: 엔진 / 모델 / 격리 latency / 비용 │
└──────────────────────────────────────────┘
```

라우트 변경:
- `/lab/server-ai` → `/lab/server-infer` (rename)
- `/lab/server-ai-gguf` → 폐기 (redirect 또는 삭제)

DB 토글:
- 신규: `lab_server_infer_enabled`
- 폐기: `lab_server_ai_enabled`, `lab_server_ai_gguf_enabled`

#### 3.3.5 메인 service 와의 통신

```js
// api/server-infer.js — 메인 Cloud Run 의 라우터
const INFER_SERVICE_URL = 'https://aitutor-inference-58235609672.us-east4.run.app';

module.exports = withCors(async (req, res) => {
  // 인증 통과 후 격리 service 로 forward
  const upstream = await fetch(`${INFER_SERVICE_URL}/infer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': process.env.INTERNAL_INFER_TOKEN,
    },
    body: JSON.stringify(req.body),
  });
  // SSE 스트리밍 forward
});
```

격리 service 는 `--no-allow-unauthenticated` + service-to-service IAM 인증으로 보호 (외부 직접 호출 차단).

#### 3.3.6 작업 명세 (Phase 7)

```
[코드 신규 작성]
  workspace/aitutor-inference/         ← 신규 디렉토리 (별도 deploy 단위)
    Dockerfile                         ← 3 엔진 + Python deps
    server.py 또는 server.js           ← 라우터 + 3 daemon spawn
    engines/
      onnx_engine.py                   ← onnxruntime-genai
      llamacpp_engine.py               ← llama-cpp-python
      transformers_engine.py           ← PyTorch
    models/
      catalog.json                     ← 모델 메타 (engine 별 가능 모델)
    cloudbuild.yaml                    ← 별도 빌드/배포

  workspace/aitutor/                   ← 메인 변경
    api/server-infer.js                ← 격리 service 로 forward (network)
    src/labs/server-ai/                ← /lab/server-infer 로 rename
    src/labs/server-ai-gguf/           ← 폐기 (또는 redirect)
    src/App.jsx                        ← 라우트 갱신

[GCP 인프라]
  Cloud Run service 'aitutor-inference' (us-east4 또는 us-central1)
  Service Account 'aitutor-inference-run'
  Artifact Registry repository 'aitutor-inference' (또는 기존 'aitutor' 재사용)
  IAM: 메인 SA → aitutor-inference invoker
  GPU L4 quota 1개 추가 신청 (선택, CPU only 도 가능)

[DB]
  aitutor_settings 에 lab_server_infer_enabled 추가
  기존 lab_server_ai_enabled / lab_server_ai_gguf_enabled 폐기

[검증]
  /lab/server-infer 진입 → 6 모델 × 3 엔진 = 18 조합 테스트
  격리 latency 측정 (메인 → 격리 service round-trip)
```

#### 3.3.7 Phase 7 비용 영향 (사전 보고 — 사용자 승인 필수)

##### 사용자 결정 (2026-04-29): **Phase 7-1 CPU only 로 시작**

| 항목 | 일회성 | Phase 7-1 (CPU) 월별 | Phase 7-2 (GPU 추가) 월별 |
|---|---|---|---|
| Cloud Build (신규 service 빌드 ~3회 검증) | ~$1 | $0 | $0 |
| Artifact Registry storage (신규 image ~3GB) | $0.30 | $0.06 | $0.06 |
| GPU L4 quota 추가 신청 | - | - | $0 (대기 1~2일) |
| 호출당 비용 (격리 service vCPU/RAM) | $0.001 ~ $0.005 (CPU 30~120초) | 사용량 기반 | $0.001 |
| 호출당 비용 (격리 service GPU) | - | - | $0.005 ~ $0.01 (GPU L4 수 초) |
| 메인 → 격리 service network | 무료 (같은 region) | 미미 | 미미 |
| **추정 월 운영 비용** | - | **~$0.10** | **~$0.50** |

##### 시점별 진행

```
[지금] 메인 service 검증 (Stage 2, 1~2주)
    ↓
[Phase 5] local-gcp 엔진 3종 완성 (병행 가능)
    ↓
[Phase 7-1] aitutor-inference Cloud Run service 신규 (CPU only) ⭐ 즉시 진행 가능
    ↓
[추후 — GPU quota 승인 시] Phase 7-2: GPU L4 옵션 추가 (1줄 명령)
    ↓
[Phase 6] AWS 인프라 폐기 (Phase 5/7-1 후 1~2주 후)
```

##### 폐기된 옵션 (참고)
- ~~옵션 A : GPU 추가 quota 신청 후 시작~~ → Phase 7-2 로 이연
- ~~옵션 C : 메인 service 의 GPU 공유 (격리 컨셉 손실)~~ → 별도 service 로 격리 보존

---

## 4. 일정 / 우선순위

### 4.1 즉시 (현재)
- ✅ 빌드 9차 라이브 (Qwen 한국어 fix)
- 🔵 사용자 검증 (Stage 2 정밀)

### 4.2 단기 (1~2주)
- Phase 5 — local-gcp 엔진 3종 완성 (llama.cpp + vLLM 추가)
- 사용자 결정: Phase 7 옵션 A/B/C 어느 것?

### 4.3 중기 (3~4주)
- Phase 6 — AWS 인프라 폐기
- Phase 7 — 통합 서버 추론 service 구축

### 4.4 장기 (1~3개월)
- 실험실에서 검증된 모델/엔진 → 메인 AI 해설 default 로 promote
- Vertex AI Model Garden 통합 (선택, hf-playground 확장)

---

## 5. 결정 받을 사항

### Q1. **Phase 7 의 3번째 엔진** 후보 (§ 2.6 조사 결과 반영)
- ⭐ **옵션 A: transformers (PyTorch native)** — HuggingFace 표준, ONNX/GGUF 외 모든 모델, FP16/BitsAndBytes 양자화. CPU 가능 (느림), GPU 빠름. **Phase 7-1 시점 권장**
- ❌ ~~옵션 B: mlc-llm (TVM 기반)~~ — Cloud Run 환경 사용 사례 작음
- ❌ ~~옵션 C: TGI~~ — **2025-12 maintenance mode**, HuggingFace 공식 폐기 권장
- ⚠ **옵션 D: 2 엔진만** (onnxruntime-genai + llama-cpp-python) — 가장 단순, R&D 가치 ↓
- ⏳ **옵션 E: SGLang** — Phase 7-2 (GPU 추가 시) 시점에 transformers 대체 (RadixAttention prefix cache, vLLM 대비 +29% 빠름)

### ~~Q2. 격리 service 의 GPU 정책~~ → ✅ **B 채택 (사용자 결정 2026-04-29)**
- ~~A: GPU L4 quota 추가 신청~~
- **B: CPU only 로 시작 → 나중에 quota 배정 받으면 GPU 추가** ⭐ 채택
- ~~C: 메인 service GPU 공유 (격리 손실)~~

### Q3. **Phase 7 진행 시점**
- 즉시 (Phase 5 와 병행)
- Phase 5 (local-gcp 3 엔진) 완료 후
- 1~2주 메인 안정 검증 후

---

## 6. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-29 | REBUILD25.md 최초 작성 — 4 실험실 최종 컨셉 정리 + 통합 server-infer service 설계 + Phase 5/6/7 계획 |
| 2026-04-29 (오후) | **Q2 결정 반영: CPU only 로 시작** — Phase 7 을 **Phase 7-1 (CPU only, 즉시)** + **Phase 7-2 (GPU 추가, quota 배정 후)** 로 분리. § 0.2 GPU 정책 추가, § 3.3.1 CPU only 명세 + GPU update 1줄 명령, § 3.3.7 비용 분리 (CPU $0.10/월 vs GPU $0.50/월), § 5 Q2 채택 표시. 누적 마이그 비용 영향 0 (Phase 7-1 시점에 빌드 1회 ~$0.30 추가 발생 예정, 사용자 사전 승인 필요). |
| 2026-04-29 (오후) | **2026 산업 동향 검증 + 추론 엔진 명확화** — WebSearch 5종 + 공식 문서 정밀 조사. § 2.6 (2026 산업 동향 — TGI 폐기, vLLM 산업 표준, SGLang 부상, Cloud Run + L4 + vLLM 공식 codelab), § 2.7 (llama-server vs llama-cpp-python 같은 코어 다른 layer 명확화), § 2.8 (출처 12종 인용) 신규. § 3.1.0 (Phase 5 엔진 검증 근거), § 3.3.2-1 (Phase 7 3번째 엔진 transformers 권장 근거) 추가. § 5 Q1 갱신 (TGI ❌ maintenance mode, transformers ⭐ 권장, SGLang Phase 7-2 옵션). 사용자 원안 (Ollama / llama-server / vLLM) 가 2026 산업 표준에 정확히 부합 → 그대로 진행 검증. |
| 2026-04-29 (오후) | **§ 2.9 제로베이스 최적 3 엔진 추천 + GPU 유무 영향 명확화** — 사용자 요청 후속. 4가지 시나리오 분석: ① 일심동체 GPU 활성 (Ollama/vLLM/llama-server), ② 일심동체 GPU 없음 가설 (Ollama/llama-server/onnxruntime-genai), ③ 격리 CPU only (llama-cpp-python/onnxruntime-genai/transformers), ④ 격리 GPU 추가 (옵션 4-A 호환 또는 4-B 차별화). § 2.9.1 GPU 유무가 엔진 카탈로그 결정 (vLLM/SGLang/TensorRT-LLM 은 GPU 필수, llama.cpp 계열은 CPU/GPU 모두 강함). § 2.9.4 영상정보관리사 시나리오 적합도 매트릭스. 결론: 사용자 원안 = 2026 산업 표준 + 시나리오 적합 ✅. |
