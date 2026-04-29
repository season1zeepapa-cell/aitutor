# REBUILD26 — 8 엔진 전수 구현 + 개발 일정 (실행 계획)

> 작성: 2026-04-29 오후
> 목적: 사용자 최종 결정 ("고민하지 말고 모든 엔진 구현 + 누락 없이 테스트") 을 실행 가능한 일정으로 구체화. REBUILD25 (실험실 4개 컨셉 정리) 의 후속으로 **양쪽 (일심동체 + 격리) 에 8 엔진 전수 동거** 아키텍처 + 개발 순서 옵션 비교 + 비용 분석.

---

## 0. TL;DR

### 0.1 최종 결정 — 양쪽 모두 8 엔진 전수

| 환경 | 엔진 수 | 엔진 목록 |
|---|---|---|
| **일심동체 (local-gcp)** | 8 | Ollama / llama-server / llama-cpp-python / vLLM / SGLang / TensorRT-LLM / onnxruntime-genai / transformers |
| **격리 (server-infer)** | 8 | (동일) |

→ **양쪽 같은 엔진 구성 = 진정한 전수 비교** (격리 vs 통합 latency, 메모리, throughput).

### 0.2 사용자 의사결정 받을 사항

1. **개발 순서**: 옵션 A (순차) / B (격리 CPU 먼저) / C (하이브리드 ⭐ 권장)
2. **TensorRT-LLM 포함 여부**: 28분 컴파일 부담 — Phase 8 별도 단계 또는 일반 Phase 에 통합

### 0.3 권장 path 요약

```
Day 1~2 즉시: 일심동체 GPU 엔진 4 (현재 GPU 활성) + 격리 신규 service CPU 3 + GPU quota 신청
Day 3~4   : GPU quota 승인 후 격리 GPU 엔진 추가
Day 5~6   : 양쪽 Python 엔진 통일 (전수 비교 위해)
Day 7~8+  : TensorRT-LLM 양쪽 추가 (Phase 8, 옵션)
```

---

## 1. 작업 컨텍스트

### 1.1 REBUILD23 / 24 / 25 와의 관계

| 문서 | 역할 |
|---|---|
| REBUILD23 | AWS → GCP 마이그 (Phase 1~6) — Phase 4 라이브 ✅ |
| REBUILD24 | 실험실 5개 정밀 분석 + 4 path 비교 → 5개 모두 유지 결정 |
| REBUILD25 | 실험실 4개 최종 컨셉 정리 + 통합 server-infer 설계 + 2026 산업 동향 검증 |
| **REBUILD26 (본 문서)** | **8 엔진 전수 구현 + 개발 일정 + 비용 분석** |

### 1.2 사용자 결정 누적 history

- (오전) "마이그 완료 후 즉시 삭제 예정" → (오후) **5개 모두 영구 유지**
- "기본 서비스와 추론 서버 분리 + 3가지 추론 엔진 변경 가능 + 모델 변경"
- "GPU 신청 전 GPU 옵션 빼고 별도 Cloud Run 으로 구성, 나중에 GPU 추가"
- **"고민하지 말고 각각 모든 추론 엔진 구현 + 누락 없이 테스트"** ⭐ 본 문서 trigger
- "양쪽 모두 8 엔진 + 개발 순서 어떻게?"

---

## 2. 8 엔진 카탈로그 (전수)

### 2.1 엔진별 정밀 명세

#### 1. Ollama (Go wrapper)
- **출처**: ollama.com (Go 구현체, llama.cpp wrapper)
- **포맷**: GGUF (자체 모델 카탈로그)
- **API**: OpenAI 호환 + 자체 `/api/chat`
- **포트**: 11434 (default)
- **장점**: 모델 자동 관리 (auto-pull), 개발자 편의 최강
- **단점**: 동시 요청 시 VRAM 부족 → 38% CPU offload (3x 느림)
- **현재 상태**: 일심동체에 active

#### 2. llama-server (C++ binary)
- **출처**: `llama.cpp` (Georgi Gerganov, github.com/ggml-org/llama.cpp)
- **포맷**: GGUF (Q4_K_M 등)
- **API**: HTTP + OpenAI 호환 (`/v1/chat/completions`)
- **포트**: 11435
- **장점**: Native C++ binary, 가장 빠른 GGUF 추론, image 작음 (~50MB)
- **단점**: 모델 수동 관리 (자동 pull 없음)
- **빌드**: cmake + CUDA (multi-stage devel base)

#### 3. llama-cpp-python
- **출처**: github.com/abetlen/llama-cpp-python
- **포맷**: GGUF (llama-server 와 동일 모델 호환)
- **API**: HTTP server (`python -m llama_cpp.server`) + 직접 import
- **포트**: 11437 (격리 service)
- **장점**: Python 환경 통합 편의, OpenAI 호환
- **단점**: Python overhead (~1~3% FFI), image 큼 (~500MB)

#### 4. vLLM
- **출처**: github.com/vllm-project/vllm (UC Berkeley + Anyscale)
- **포맷**: HuggingFace transformers 형식 (PyTorch tensor) + GGUF 일부 지원
- **API**: OpenAI 호환 (`/v1/chat/completions`)
- **포트**: 11436
- **장점**: 2026 산업 표준, PagedAttention, GPU 최강 (Amazon/LinkedIn/Stripe 프로덕션)
- **단점**: GPU 사실상 필수 (CPU 매우 느림), Python 무거움 (~1.5GB)
- **GPU 유무**: ⚠ GPU 필수 권장

#### 5. SGLang
- **출처**: github.com/sgl-project/sglang (UC Berkeley LMSYS)
- **포맷**: HuggingFace transformers 형식
- **API**: OpenAI 호환 + 자체 RPC
- **포트**: 11438
- **장점**: RadixAttention prefix cache (multi-turn/RAG 강함), 8B 모델 vLLM 대비 +29% 빠름
- **단점**: GPU 필수, multi-turn 시너지 (단발 호출엔 효과 작음)
- **GPU 유무**: ⚠ GPU 필수

#### 6. TensorRT-LLM
- **출처**: NVIDIA 공식 (github.com/NVIDIA/TensorRT-LLM)
- **포맷**: 자체 컴파일 .engine
- **API**: Triton Inference Server 또는 자체 wrapper
- **포트**: 11439
- **장점**: NVIDIA L4 최강 throughput + latency
- **단점**: **모델당 28분 컴파일** + 모델 변경 시 재컴파일, NVIDIA only, image 큼
- **GPU 유무**: NVIDIA GPU 필수
- **빌드 부담**: 매우 큼 → Phase 8 별도 단계 권장

#### 7. onnxruntime-genai
- **출처**: github.com/microsoft/onnxruntime-genai (Microsoft 공식)
- **포맷**: ONNX (q4f16, q4 quantization)
- **API**: HTTP server 직접 작성 또는 Python import
- **포트**: 11440
- **장점**: 다양 hardware (CPU/CUDA/CoreML/DirectML/Metal), Microsoft 표준
- **단점**: int4 CPU 는 느림 보고 (Issue #1098), generation 헬퍼 일부 제한
- **GPU 유무**: 둘 다 OK (CPU int4 약점, CPU FP16 빠름)

#### 8. transformers (PyTorch native)
- **출처**: github.com/huggingface/transformers
- **포맷**: HuggingFace 표준 (.safetensors)
- **API**: 자체 wrapper 작성 또는 TGI/vLLM 사용
- **포트**: 11441
- **장점**: 가장 다양한 모델 지원 (HuggingFace 모든 모델), BitsAndBytes 양자화
- **단점**: CPU 매우 느림 (데모용), 메모리 사용 큼
- **GPU 유무**: GPU 권장 (CPU 가능하지만 데모급)

### 2.2 8 엔진 GPU 유무 호환성 매트릭스

| 엔진 | CPU only | GPU 활용 | GPU 필수도 |
|---|---|---|---|
| Ollama | ⭐ 가능 (느림) | ⭐ 자동 GPU 감지 | 선택 |
| llama-server | ⭐ 빠름 (GGUF) | ⭐ CUDA 빠름 | 선택 |
| llama-cpp-python | ⭐ 빠름 (GGUF) | ⭐ CUDA 빠름 | 선택 |
| **vLLM** | ❌ 매우 느림 | ⭐ 최강 | ✅ **필수** |
| **SGLang** | ❌ 매우 느림 | ⭐ 부상 | ✅ **필수** |
| **TensorRT-LLM** | ❌ X | ⭐ NVIDIA 최강 | ✅ **필수** |
| onnxruntime-genai | ⚠ int4 느림 | ⭐ CUDA 빠름 | 선택 |
| transformers | ⚠ 매우 느림 | ⭐ FP16 빠름 | 권장 |

---

## 3. 양쪽 8 엔진 동거 아키텍처

### 3.1 일심동체 local-gcp (메인 Cloud Run service)

```
[Cloud Run: aitutor (us-east4, GPU L4 24GB, 8 vCPU, 32 Gi RAM)]
├─ Express server.js (port 8080) — 메인 앱 + API 엔드포인트
│   POST /api/local-infer
│     body: { engine, model_key, messages, ... }
│     → engine 별 localhost daemon 으로 fetch
│
├─ Ollama daemon              (port 11434)  ⭐ active
├─ llama-server (C++)         (port 11435)
├─ llama-cpp-python           (port 11437)
├─ vLLM                       (port 11436)  GPU 활성 시
├─ SGLang                     (port 11438)  GPU 활성 시
├─ TensorRT-LLM               (port 11439)  Phase 8
├─ onnxruntime-genai          (port 11440)
└─ transformers (PyTorch)     (port 11441)

Image 크기 추정 (모든 엔진 baked):
- Base CUDA + Node 22:    2.0 GB
- Ollama binary:          0.2 GB
- llama-server binary:    0.05 GB
- Python + venv:          0.5 GB
- llama-cpp-python:       0.3 GB
- vLLM (PyTorch + deps):  3.5 GB
- SGLang:                 1.5 GB
- TensorRT-LLM:           4.0 GB
- onnxruntime-genai:      0.5 GB
- transformers (PyTorch): 1.0 GB (vLLM 과 일부 공유)
─────────────────────────────────
합계 (Phase 5+8 완성):     ~13.5 GB
↓ multi-stage 최적화:      ~8~10 GB
```

⚠ Artifact Registry compressed 한도 10GB 위험 → 다음 전략 필요:
- Multi-stage build (불필요 빌드 도구 제거)
- 일부 엔진은 lazy install (첫 호출 시 download)
- 또는 separate image (다음 단계 작업)

### 3.2 격리 server-infer (별도 Cloud Run service)

```
[Cloud Run: aitutor-inference (us-east4, CPU 4, 16 Gi RAM, GPU L4 옵션)]
├─ FastAPI server.py (port 8080) — 라우팅 layer
│   POST /infer
│     body: { engine, model, messages, ... }
│     → engine 별 localhost daemon 으로 fetch
│
├─ Ollama daemon              (port 11434)
├─ llama-server (C++)         (port 11435)
├─ llama-cpp-python           (port 11437)
├─ vLLM                       (port 11436)  GPU 활성 시 (Phase 7-2)
├─ SGLang                     (port 11438)  GPU 활성 시
├─ TensorRT-LLM               (port 11439)  Phase 8
├─ onnxruntime-genai          (port 11440)
└─ transformers (PyTorch)     (port 11441)

Image 크기: 일심동체와 비슷 (~8~10 GB)
- 다만 Express + dist/ + 메인 API 코드 없음 → ~1~2 GB 더 작음
- 합계: ~7~9 GB
```

### 3.3 환경 차이 (일심동체 vs 격리)

| 측면 | 일심동체 | 격리 |
|---|---|---|
| 위치 | 메인 service 컨테이너 | 별도 service 컨테이너 |
| 메인 앱과 latency | localhost (~0ms) | network (~5~10ms intra-region) |
| GPU 공유 | ✅ 메인 GPU L4 | ⚠ 별도 GPU quota 필요 |
| 장애 영향 | 메인 앱 같이 죽음 | 격리 (메인 OK) |
| 운영 단순도 | 1 service 관리 | 2 service 관리 |
| 콜드 스타트 | 메인 + 모든 엔진 spawn | 격리만 spawn |
| 비용 | 메인 GPU 사용량 | 별도 GPU 사용량 (대부분 idle $0) |

→ **양쪽 같은 8 엔진 = 진정한 비교 가능** (운영 환경 차이만)

---

## 4. 개발 순서 — 3 옵션 비교

### 4.1 옵션 A — 일심동체 다 → 격리 (순차)

```
Day 1~3: 일심동체 8 엔진 모두 추가 (Phase 5-1 ~ 5-3)
         빌드 + 검증
Day 4~5: 격리 service 신규 생성 (CPU only 3 엔진)
Day 6~7: GPU quota 승인 대기
Day 8~9: 격리 GPU 엔진 추가 (vLLM/SGLang)
Day 10+: 양쪽 TensorRT-LLM (Phase 8)
```

| 측면 | 평가 |
|---|---|
| 일정 | ~10일 |
| 단순도 | 단순 순차 |
| GPU quota 활용 | ❌ 대기 시간 낭비 (Day 6~7) |
| 빠른 피드백 | ⭐ 일심동체 먼저 검증 |

### 4.2 옵션 B — 격리 1 엔진 CPU 부터 (빠른 검증)

```
Day 1~2: 격리 service 신규 생성 (CPU only, llama-cpp-python 1 엔진)
         빠른 검증
Day 3~5: 격리에 CPU 엔진 추가 (onnxruntime-genai / transformers)
Day 6+ : 일심동체 8 엔진 모두 추가
Day 8+ : GPU quota 승인 후 vLLM/SGLang 양쪽
Day 10+: TensorRT-LLM (Phase 8)
```

| 측면 | 평가 |
|---|---|
| 일정 | ~10일 |
| 빠른 검증 | ⭐ 격리 service 부터 |
| 일심동체 확장 지연 | ❌ |

### 4.3 옵션 C — 하이브리드 ⭐ 권장

```
Day 1~2: 병행 진행
  ├─ 일심동체 GPU 엔진 4 추가 (Ollama 외 +llama-server/vLLM/SGLang)
  ├─ 격리 service 신규 (CPU only, llama-cpp-python/onnxruntime-genai/transformers)
  └─ GPU quota 추가 신청 (콘솔 직접, 1~2일 대기)

Day 3~4: GPU quota 승인 후
  ├─ 격리에 vLLM/SGLang 추가 (GPU 활성)
  └─ 양쪽 5 엔진 동거 도달

Day 5~6: Python 엔진 양쪽 통일
  ├─ 일심동체에 llama-cpp-python/onnxruntime-genai/transformers 추가
  └─ 양쪽 7 엔진 동거 도달

Day 7~8: TensorRT-LLM 양쪽 추가 (Phase 8 옵션)
  └─ 양쪽 8 엔진 = 진정한 전수 ⭐

Day 9~10: 통합 검증 + UI 통합 (16 = 8×2 조합 비교 모드)
```

| 측면 | 평가 |
|---|---|
| 일정 | ~7~10일 (Phase 8 제외 시 ~6~8일) |
| 시간 효율 | ⭐⭐⭐ GPU quota 대기 시간 활용 |
| 양쪽 균형 | ⭐⭐⭐ 동시 진행 |
| 복잡도 | ⚠ 병행 진행 부담 |

### 4.4 옵션 비교 매트릭스

| 옵션 | 일정 | 시간 효율 | 복잡도 | 빠른 피드백 |
|---|---|---|---|---|
| A 순차 | 10일 | ⚠ quota 대기 시간 X | ⭐ 단순 | 일심동체 |
| B 격리 먼저 | 10일 | ⚠ | ⭐ 단순 | 격리 |
| **C 하이브리드** ⭐ | **7~10일** | ⭐⭐⭐ | ⚠ 병행 | 둘 다 |

---

## 5. 일정 (옵션 C 하이브리드 기준)

### 5.1 Phase 별 작업 명세

#### Phase 5-1 — 일심동체 GPU 엔진 추가 (Day 1~2)

```
변경 파일:
  Dockerfile (multi-stage devel base for llama.cpp + vLLM/SGLang Python)
  start.sh (4 daemon spawn: Ollama 유지 + llama-server + vLLM lazy + SGLang lazy)
  api/local-infer.js (engine 분기 — 'planned' → 'active')
  src/labs/local-gcp/LocalGcpTester.jsx (UI 4 엔진)

빌드 영향:
  Image 크기: 3 GB → 7 GB
  빌드 시간: 12분 → 30~40분 (vLLM/SGLang Python deps + cmake build)

비용:
  Cloud Build 1회 ~$1
```

#### Phase 7-1 — 격리 service 신규 (CPU only, Day 1~2 병행)

```
신규 디렉토리:
  workspace/aitutor-inference/
    Dockerfile  (Python 3.11 + 5 엔진 baked)
    server.py   (FastAPI 라우터)
    engines/
      llamacpp.py
      onnx.py
      transformers.py
      vllm_engine.py   (Phase 7-2 active)
      sglang_engine.py (Phase 7-2 active)

GCP 인프라:
  Cloud Run service: aitutor-inference (us-east4, CPU 4, 16 Gi)
  Service Account: aitutor-inference-run
  Artifact Registry: 기존 'aitutor' repository 재사용 또는 신규
  IAM: 메인 SA → 격리 service invoker

UI:
  src/labs/server-ai/ → /lab/server-infer 로 rename
  src/labs/server-ai-gguf/ → 폐기 (또는 redirect)

비용:
  Cloud Build 1회 ~$1
  Image 저장: ~$0.50/월 (compressed 5GB)
  호출 시: $0.001~0.005 (CPU only)
```

#### Phase 7-2 — 격리 GPU 활성 (Day 3~4, quota 승인 후)

```
명령 1줄 (코드 변경 없음):
  gcloud run services update aitutor-inference \
    --region=us-east4 \
    --gpu=1 --gpu-type=nvidia-l4 \
    --no-gpu-zonal-redundancy \
    --memory=32Gi --cpu=8 \
    --max-instances=1

엔진 active 전환:
  vLLM: 'planned' → 'active'
  SGLang: 'planned' → 'active'

비용:
  GPU 사용량 호출당 ~$0.005~0.01
```

#### Phase 5-2 — 일심동체 Python 엔진 추가 (Day 5~6)

```
변경:
  Dockerfile 에 llama-cpp-python / onnxruntime-genai / transformers Python deps 추가
  start.sh 에 추가 daemon (lazy)
  api/local-infer.js 에 engine 카탈로그 확장 (4 → 7)

비용:
  Cloud Build 1회 ~$1
  Image: +1.5 GB
```

#### Phase 8 — TensorRT-LLM 양쪽 추가 (Day 7~8, 옵션)

```
부담:
  - 모델당 28분 컴파일 (NVIDIA TensorRT 엔진)
  - 모델 변경 시 재컴파일
  - Image +4GB

대안:
  - 1~2 모델만 사전 컴파일 + image 에 baked
  - 또는 별도 image (lazy load)

비용:
  Cloud Build ~$1.50~3 (28분 컴파일 ×2 service)
  Image: +4 GB × 2 = $1.60/월
```

### 5.2 통합 일정 표

| Day | 작업 | 빌드 비용 | 사용자 액션 |
|---|---|---|---|
| 1 | Phase 5-1 일심동체 4 엔진 빌드 + 격리 신규 service 빌드 + GPU quota 신청 | ~$2 | quota 신청 (1분) |
| 2 | 양쪽 검증 (CPU 격리 + GPU 일심동체) | $0 | 검증 (Stage 2) |
| 3~4 | quota 승인 후 격리 GPU 활성 (1줄 명령) | $0 | quota 승인 메일 알림 |
| 5~6 | Phase 5-2 일심동체 Python 엔진 추가 | ~$1 | 검증 |
| 7~8 | Phase 8 TensorRT-LLM (옵션) | ~$2 | 검증 |
| 9~10 | UI 통합 비교 모드 + 최종 검증 | ~$0.50 | Stage 3 |

---

## 6. 비용 분석

### 6.1 누적 비용 추정 (옵션 C 하이브리드)

| 항목 | 일회성 | 월별 |
|---|---|---|
| 현재 누적 (마이그) | ~$2.00 | $0 (idle 0) |
| Phase 5-1 (일심동체 4 엔진) | ~$1 | image $0.50 |
| Phase 7-1 (격리 신규 service) | ~$1 | image $0.30 |
| Phase 7-2 (GPU 활성, 1줄 명령) | $0 | GPU 호출당 |
| Phase 5-2 (일심동체 Python 추가) | ~$1 | image $0.30 |
| Phase 8 (TensorRT-LLM 양쪽) | ~$2 | image $1.60 |
| 검증 호출 (8 엔진 × 2 service × 모델 N) | ~$0.50 | $0 |
| **총 (Phase 8 포함)** | **~$7.50** | **$2.70/월** |

### 6.2 Phase 8 제외 시

| 항목 | 일회성 | 월별 |
|---|---|---|
| **Phase 5-1 + 7-1 + 7-2 + 5-2 만** | **~$5.50** | **$1.10/월** |

### 6.3 $10 budget 사용률

| 시나리오 | 누적 | Budget 사용률 |
|---|---|---|
| 마이그만 (현재) | $2.00 | 20% |
| + Phase 5-1, 7-1, 7-2, 5-2 | $5.50 | 55% |
| + Phase 8 (TensorRT-LLM) | $7.50 | 75% |

→ Phase 8 까지 진행해도 budget 안전. 다만 월 운영비 ($2.70) 누적되면 6개월 후 경고 가능.

### 6.4 Image 크기 + Artifact Registry 한도 위험

⚠ **Artifact Registry compressed 한도 10GB**:
- Phase 5 후 일심동체 image: ~7GB compressed → 안전
- Phase 8 후 일심동체 image: ~10GB compressed → **한도 위험**

→ Phase 8 시점에 Multi-stage 더 aggressive 최적화 또는 별도 image (lazy daemon) 필요.

---

## 7. 위험 + 완화

### 7.1 기술적 위험

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| Image 크기 10GB 한도 초과 (Phase 8) | 높음 | 빌드 실패 | Multi-stage + lazy daemon, 또는 별도 image |
| Cloud Run 콜드 스타트 60s+ (큰 image) | 중간 | UX | min-instances=1 또는 startup probe 최적화 |
| 8 엔진 daemon 동시 시작 메모리 압박 | 중간 | OOM | lazy spawn (호출 시만), 32 Gi RAM 충분 |
| TensorRT-LLM 28분 컴파일 시간 초과 | 중간 | Cloud Build timeout | timeout 90분, 별도 빌드 스텝 |
| GPU quota 추가 거절 | 낮음 | Phase 7-2 지연 | CPU 운영 + 다른 region 시도 |
| vLLM/SGLang Python 의존성 충돌 | 중간 | 빌드 실패 | 별도 venv 또는 conda env |

### 7.2 운영 위험

| 위험 | 완화 |
|---|---|
| 8 엔진 마다 다른 모델 카탈로그 | 통합 모델 카탈로그 (model_key 매핑) |
| 디버깅 복잡 (어느 엔진에서 실패?) | 엔진별 로그 prefix + Cloud Logging filter |
| 프로덕션 promotion 결정 어려움 | 자동 비교 모드 (REBUILD24 § 6.2 참조) |

### 7.3 비용 위험

| 위험 | 완화 |
|---|---|
| 사용자 검증 호출 폭증 | Cloud Run max-instances=1 (스케일 제한) |
| GPU 의도하지 않은 idle | min-instances=0 유지, billing alert 작동 |
| Image 저장 비용 누적 | 옛 tag 자동 삭제 (Artifact Registry cleanup policy) |

---

## 8. 사용자 결정 받을 사항

### Q1. 개발 순서
- A. 순차 (일심동체 → 격리)
- B. 격리 먼저 (CPU 1 엔진 빠른 검증)
- ⭐ **C. 하이브리드 (병행)** — 권장

### Q2. TensorRT-LLM 포함 여부 (Phase 8)
- A. 포함 (8 엔진 진정한 전수, 28분 컴파일 부담)
- B. 제외 (7 엔진, Image 크기 안전)
- C. 1 엔진만 (Gemma 4 E2B 등 1 모델만 컴파일, 나머지 vLLM 으로)

### Q3. 격리 service Region
- A. us-east4 (메인과 동일, latency 최소)
- B. us-central1 (분산, GPU quota 다른 region)

### Q4. Phase 시작 시점
- A. **즉시** (메인 안정 검증과 병행)
- B. Stage 2 검증 완료 후 (1~2주 후)

### Q5. 비용 budget
- 현재 $10 → 유지 (Phase 8 제외 시 안전, 포함 시 75% 사용)
- 또는 $20 으로 증액 (Phase 8 + 여유)

---

## 9. 권장 default (사용자 시간 절약)

```
Q1: C 하이브리드
Q2: B 제외 (Phase 8 은 추후 별도 결정)
Q3: A us-east4 (메인과 동일)
Q4: A 즉시 (Phase 5/6 와 병행)
Q5: $10 유지
```

→ 누적 ~$5.50, $10 budget 의 55% (안전)
→ 일정: 6~8일
→ 7 엔진 양쪽 (TensorRT-LLM 제외)

---

## 10. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-29 | REBUILD26.md 최초 작성 — 8 엔진 전수 카탈로그 + 양쪽 동거 아키텍처 + 개발 순서 3 옵션 비교 + 일정 + 비용 분석 + Q1~Q5 결정 받을 사항 |
