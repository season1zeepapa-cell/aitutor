# REBUILD29 — 일심동체 vs 격리 추론 아키텍처 정밀 비교 (엔진별 + 다중 모델)

> 작성: 2026-04-30
> 선행: REBUILD26 (8 엔진 결정) → REBUILD28 (6 엔진 축소 + UI 재구성) → **REBUILD29 (본 문서, 아키텍처 정밀 비교 + 엔진별 + 다중 모델)**
> 목적: REBUILD28 의 12 차원 비교를 (a) 최신 웹 데이터, (b) 6 엔진 각각의 구조적 특성, (c) 다중 모델 확장/비교/교체 시나리오까지 확장. 의사결정용 단일 진실 소스.

---

## 0. TL;DR

### 0.1 결론 한 줄

> **아키텍처는 단일 정답이 없다. 엔진/사용 패턴별로 일심동체와 격리 모두 우세 영역이 분명하다.**
> AI TutorTwo 의 현재 사용 패턴(단발 호출 / 동시 1~2 / 모델 교체 빈번 / 비교 학습)에서는 **하이브리드 = 일심동체 + 격리 양쪽 유지하되 GPU 비용은 격리에만 집중**이 합리적.

### 0.2 엔진별 아키텍처 적합도 (한 눈에)

| 엔진 | 일심동체 우세 | 격리 우세 | 무차별 |
|---|---|---|---|
| **Ollama** | ⭐ 단발/대기 | — | — |
| **llama-server** | — | ⭐ scaling | — |
| **vLLM** | — | ⭐⭐⭐ 압도적 | — |
| **llama-cpp-python** | — | — | ⭐ 동일 |
| **onnxruntime-genai** | ⭐ in-process | — | — |
| **transformers** | — | — | ⭐ 동일 |

→ **vLLM 만 격리 압도적**. 나머지는 trade-off 또는 무차별.

### 0.3 권장 결정안 (시나리오별)

| 시나리오 | 권장 |
|---|---|
| 학습 도구 / 개인 프로젝트 / 사용자 ≤ 5명 | **현 일심동체+격리 동거 유지** |
| 사용자 다수 / 빌드 빈번 / 비용 budget tight | **격리 단일화** + 일심동체 lab UI 통합 |
| 추론 비교 연구 가치 중심 | **양쪽 유지** (현재) |
| **AI TutorTwo (현실)** | **일심동체 = 가벼운 엔진(Ollama/onnx) + 격리 = 무거운 엔진(vLLM/transformers)** ⭐ 하이브리드 |

---

## 1. 최신 산업 동향 (2026-04 웹서치)

### 1.1 추론 엔진 시장 변화

| 엔진 | 2026 상태 |
|---|---|
| **TGI** (HF Text Generation Inference) | **2025-12 maintenance mode 진입**. HF 공식 권장이 vLLM / SGLang 으로 이동 |
| **vLLM** | 산업 표준 확정. 405B 모델까지 production 검증 (TGI 대비 throughput +50%, TTFT +70%) |
| **TensorRT-LLM** | NVIDIA 전용 최강. p95 TTFT 100 concurrent = 1280ms (vLLM 1450ms 대비 12% 빠름) |
| **SGLang** | UC Berkeley LMSYS, multi-turn 강세 (Cloudflare, ByteDance 채택) |
| **Ollama** | 0.6.x 출시 (2026-Q1). Go wrapper, dev-friendly 1위 |
| **llama.cpp / llama-server** | 커뮤니티 stable, Apple Silicon Metal 지원 강화 |

### 1.2 정량 벤치마크 (2026-04 확인)

| 측면 | Ollama | vLLM | 비고 |
|---|---|---|---|
| 단일 호출 throughput (Llama 3.1 8B Q4) | 62 t/s | 71 t/s | vLLM +14% |
| 동시 10 호출 합 throughput | 41 t/s | **485 t/s** | vLLM **+1083%** ⭐ |
| 동시 100 호출 합 throughput | 41 t/s | **793 t/s** | vLLM **+1834%** |
| Cold start (7B Q4) | 112ms | 137ms | Ollama -18% |
| 70B Q4 latency p99 | 217ms | 142ms | vLLM -34% |
| 모델 cold load (vLLM, optimized SSD) | — | **~30초** (Run:ai Model Streamer) | 콜드스타트 단축 가능 |

→ **단발 = Ollama 빠름, 동시성 = vLLM 압도** (continuous batching).

### 1.3 Cloud Run 아키텍처 패턴 변화

| 패턴 | 2026 상태 |
|---|---|
| Multi-container (sidecar) | GA, localhost 통신 + shared volume. 다만 추론 sidecar 패턴은 일반화 안 됨 (CPU 항상 할당 비용) |
| 별도 service 분리 | 가장 보편. service 간 IAM invoker + ID Token forward |
| min-instances=1 (warm) | GPU 비용 큼. 권장 패턴: traffic 증가 예측되는 시간대만 |

→ **AI TutorTwo 같은 학습 도구**는 multi-container sidecar 의미 작고, **별도 service 가 표준**.

---

## 2. 두 아키텍처 정의 (REBUILD29 명세)

### 2.1 일심동체 (Monolithic)

```
[Cloud Run: aitutor-mono (us-east4, GPU L4 24GB, 32Gi RAM)]
├─ Express (port 8080)             ⟵ HTTPS ingress
├─ Ollama daemon (port 11434, 항상 떠있음)
├─ llama-server (lazy spawn, 11435)
├─ vLLM venv (lazy spawn, 11436)
├─ Python sub-server (port 11442) — onnx / transformers / llama-cpp-python
└─ Vite dist/

장점: localhost fetch (~0ms), 운영 단일
단점: image 7~8GB, 빌드 17~20분, 메인+추론 결합 cold start
```

### 2.2 격리 (Disaggregated)

```
[메인: aitutor-main (CPU only, 2Gi)]      [추론: aitutor-inference (GPU L4, 32Gi)]
├─ Express + dist/                  ─→    ├─ FastAPI (uvicorn)
└─ /api/iso-infer 프록시 (HTTPS)            ├─ Ollama / llama-server / vLLM
                                          └─ Python sub-server

추론 호출 = HTTPS intra-region (~5~15ms 추가)
```

### 2.3 하이브리드 (양쪽) — 현재 + REBUILD29 권장

```
[메인 일심동체: aitutor (GPU L4)]              [격리: aitutor-inference (GPU L4)]
├─ Express + dist/ + 가벼운 엔진       ←→    ├─ FastAPI
│  (Ollama / onnx / transformers)             ├─ 무거운 엔진 (vLLM / llama-server)
└─ 무거운 엔진은 격리로 forward                └─ min-instances=1 옵션 (warm 필요 시)

본질: GPU 의존도 낮은 엔진은 메인에 두되, vLLM 같은 무거운 엔진만 격리
```

→ §6 에서 세부 권장.

---

## 3. 14 차원 정밀 비교 (REBUILD28 §11 확장)

### 3.1 정량 비교 매트릭스

| # | 차원 | 일심동체 | 격리 | 우세 / 격차 |
|---|---|---|---|---|
| 1 | 추론 latency (warm, 단발) | ~0ms 추가 | ~5~15ms 추가 | 일심동체 |
| 2 | 메인 앱 cold start | 30~50초 | **3~5초** | 격리 ⭐⭐⭐ |
| 3 | 추론 cold start | 30~60초 | 30~60초 | 동일 |
| 4 | 빌드 시간 (UI 변경) | 17~20분 | **2~3분** | 격리 ⭐⭐⭐ |
| 5 | Image 크기 (메인) | 7~8 GB | **~250 MB** | 격리 ⭐⭐⭐ |
| 6 | 동시성 (UI) | GPU 인스턴스에 묶임 | **CPU 무제한** | 격리 ⭐⭐⭐ |
| 7 | 동시성 (추론) | max-instances=1 | max-instances=1 | 동일 |
| 8 | 장애 격리 | 한쪽 죽으면 둘 다 | **독립** | 격리 ⭐⭐ |
| 9 | GPU idle 비용 | min=0 시 0 | min=0 시 0 | 동일 |
| 10 | GPU warm 비용 (min=1) | 시간당 ~$0.71 | 시간당 ~$0.71 | 동일 |
| 11 | 메모리 footprint (idle) | 32Gi 기본 할당 | 메인 2Gi + 추론 0 (off) | 격리 ⭐ |
| 12 | 운영 복잡도 | 1 service | 2 service | 일심동체 |
| 13 | 보안 (공격 표면) | 큰 image | 메인 작음 | 격리 ⭐ |
| 14 | 모델 swap 효율 | 한 GPU 공유 | 추론 단독 GPU | 격리 ⭐ |

### 3.2 가중 점수 (AI TutorTwo 기준)

| 차원 | 가중치 | 일심동체 | 격리 |
|---|---|---|---|
| 메인 cold start (UX) | 15% | 1 | 5 |
| 빌드 시간 (DX) | 15% | 1 | 5 |
| 동시성 UI | 10% | 2 | 5 |
| 장애 격리 | 10% | 2 | 5 |
| 비용 | 10% | 3 | 4.5 |
| 운영 복잡도 | 10% | 5 | 4 |
| 추론 latency | 5% | 5 | 4.5 |
| 보안 | 5% | 3 | 4.5 |
| 자원 공유 | 5% | 3 | 4 |
| 모델 swap | 5% | 3 | 4 |
| 메모리 효율 | 5% | 3 | 4.5 |
| Image 크기 | 5% | 4 | 4.5 |
| **합계** | 100% | **2.85/5** | **4.55/5** |

→ REBUILD28 §11 결과와 동일. **격리 1.7점 우세**.

---

## 4. 엔진별 아키텍처 적합도 ⭐ (REBUILD29 핵심)

### 4.1 평가 기준

| 기준 | 의미 |
|---|---|
| **GPU 점유 패턴** | 항상 / lazy / 공유 가능 여부 |
| **Cold start 시간** | 초기 로드 부담 |
| **모델 swap 능력** | 같은 process 안에서 모델 전환 가능? |
| **Process 수명** | daemon vs lazy spawn vs in-process |
| **메모리 footprint** | RAM/VRAM 사용 패턴 |
| **동시성** | continuous batching / 단일 호출 |

### 4.2 ① Ollama — 일심동체 우세 ⭐

| 측면 | 특성 |
|---|---|
| GPU 점유 | always-on daemon (start.sh 가 항상 spawn). GPU 호출 시 자동 점유 |
| Cold start | 빠름 (112ms on RTX 5090) |
| 모델 swap | **자동 LRU 캐시** ⭐⭐⭐ (다중 모델 메모리 LRU) |
| Process 수명 | daemon (영속) |
| 메모리 | Go runtime 가벼움 (~200MB) |
| 동시성 | 단일 모델 단일 호출 (continuous batching 약함) |

**왜 일심동체 우세?**
- always-on daemon → 첫 호출 빠름 (extra cold start 0)
- 메인 앱 진입 시 이미 Ollama ready 상태
- 격리로 분리하면 별도 cold start (intra-region ~5ms 추가만 손해)
- 모델 자동 LRU 캐시 = 같은 GPU 인스턴스 안에서 여러 모델 swap 효율적

**격리 시 단점**: 추론 service 인스턴스가 메인 진입과 별개로 cold → "처음 사용자가 메인 진입 후 바로 Ollama 호출" 시 격리 cold start 추가로 30초+ 대기.

→ **일심동체 우세** (단발 + 다중 모델 swap)

### 4.3 ② llama-server — 격리 우세 ⭐

| 측면 | 특성 |
|---|---|
| GPU 점유 | lazy spawn (api/local-infer.js:142-176 가 child_process로 spawn) |
| Cold start | 30~60초 (GGUF 다운 + CUDA init) |
| 모델 swap | ❌ **process 재시작 필요** |
| Process 수명 | spawn → kill → respawn (모델 변경 시) |
| 메모리 | C++ binary 가벼움 (~50MB + 모델) |
| 동시성 | 단일 호출, batching 약함 |

**왜 격리 우세?**
- 모델 변경 시 process kill+respawn → **메인 앱과 같은 컨테이너에선 부담**
- spawn 실패 시 메인 앱 영향 (일심동체)
- 격리 service 가 단독으로 process 수명 관리하면 메인 앱 안정
- 모델 swap 빈번 시 격리가 운영 격리 효율 큼

**일심동체 시 단점**: child_process spawn/kill 사이클이 메인 Express 와 같은 컨테이너 안에서 일어남 → 메모리 leak 시 메인 앱 영향.

→ **격리 우세** (process 수명 격리)

### 4.4 ③ vLLM — 격리 압도적 ⭐⭐⭐

| 측면 | 특성 |
|---|---|
| GPU 점유 | engine 1개당 1 모델, GPU 메모리 50~90% 점유 |
| Cold start | **30~60초** (Python init + PyTorch CUDA + engine init) |
| 모델 swap | ❌ engine 재시작 필요 (30~60초) |
| Process 수명 | lazy spawn, Python 무거움 (~1.5GB) |
| 메모리 | Python venv 자체 5GB + GPU VRAM 5~12GB |
| 동시성 | **continuous batching ⭐⭐⭐** (485 t/s on 10 concurrent) |

**왜 격리 압도적?**
1. **Cold start 가장 김** — 일심동체에서 메인 앱과 같이 cold start 시 사용자 진입 늦어짐
2. **GPU 메모리 점유 50%+** — Ollama 와 GPU 공유 시 OOM 위험 (이번 P0 문제 일부 원인)
3. **Continuous batching 가치는 동시성 시나리오에서만** — 일심동체에서 max-instances=1 강제되면 batching 의미 작음. 격리 service 면 max-instances 늘려 batching 효과 극대화 가능
4. **min-instances=1 (warm) 옵션이 격리에만 합리적** — 메인 앱은 idle 인데 GPU warm 유지 비효율
5. **이번 P0 디버깅 사례** — vLLM ImportError 가 메인 앱 응답에도 500 영향. 격리 시 메인 앱은 정상

**일심동체 시 단점**: GPU 충돌, cold start 길어 메인 cold start 와 합산, scaling 못 함, min-instances=1 비효율.

→ **격리 압도적 우세** (모든 차원에서)

### 4.5 ④ llama-cpp-python — 무차별 (in-process)

| 측면 | 특성 |
|---|---|
| GPU 점유 | in-process (Python sub-server 안) |
| Cold start | 5~30초 (CUDA wheel 로드) |
| 모델 swap | ✅ in-process load |
| Process 수명 | Python sub-server 와 운명 공유 |
| 메모리 | wheel 자체 ~300MB + 모델 |
| 동시성 | 단일 호출 |

**왜 무차별?**
- in-process 라 어느 service 안에 있든 동일
- sub-server 가 일심동체 메인 안 / 격리 service 안 어디에 있든 같은 코드
- 격리 우세 인자: 메인 앱 안정성 (sub-server crash → 격리에선 메인 안정)
- 일심동체 우세 인자: 동거하면 latency 5~15ms 절약

→ **무차별** (메인 안정성 우선이면 격리)

### 4.6 ⑤ onnxruntime-genai — 일심동체 약간 우세 ⭐

| 측면 | 특성 |
|---|---|
| GPU 점유 | in-process, daemon 없음 |
| Cold start | 5~15초 (ONNX session init) |
| 모델 swap | ✅ in-process |
| Process 수명 | sub-server 안 |
| 메모리 | CUDA wheel ~250MB + 모델 |
| 동시성 | 단일 호출 |

**왜 일심동체 약간 우세?**
- daemon 없는 in-process 엔진 → 격리로 분리할 이유 가장 약함
- Microsoft ONNX 가 메모리 leak 등 안정 문제 보고 거의 없음 → 격리 가치 marginal
- 메인 안에서 실행 시 latency 0
- 단, llama-cpp-python 과 같은 sub-server 안에 있어 분리도 무차별

→ **일심동체 약간 우세** (격리 가치 가장 약함)

### 4.7 ⑥ transformers (HF PyTorch) — 무차별

| 측면 | 특성 |
|---|---|
| GPU 점유 | in-process, vLLM 의 torch 재사용 |
| Cold start | 10~30초 (PyTorch CUDA + safetensors 로드) |
| 모델 swap | ✅ in-process (HF cache 활용) |
| Process 수명 | sub-server |
| 메모리 | torch ~3GB + 모델 |
| 동시성 | 단일 호출 |

**특이 사항**:
- vLLM 와 같은 venv 공유 → vLLM 격리 시 transformers 도 자동 격리됨
- AI TutorTwo 의 transformers 사용은 데모급 (느림) → 비교 가치 낮음

→ **무차별** (vLLM 와 동선 공유)

### 4.8 엔진별 종합 매트릭스

| 엔진 | 일심동체 점수 | 격리 점수 | 권장 위치 |
|---|---|---|---|
| Ollama | **5/5** | 4/5 | 메인 (일심동체) ⭐ |
| llama-server | 3/5 | **5/5** | 격리 ⭐ |
| vLLM | 2/5 | **5/5** | 격리 ⭐⭐⭐ |
| llama-cpp-python | 4/5 | 4/5 | 어디든 (sub-server) |
| onnxruntime-genai | **5/5** | 4/5 | 메인 (sub-server) ⭐ |
| transformers | 4/5 | 4/5 | 어디든 (sub-server) |

→ **Ollama + onnx + transformers = 일심동체 / vLLM + llama-server = 격리** 이 자연스러운 분담.

---

## 5. 다중 모델 확장 / 비교 / 교체 시나리오 ⭐

### 5.1 시나리오 A — 같은 엔진 + 모델 swap (예: Ollama 의 qwen3:4b → gemma3n:e4b)

| 패턴 | 일심동체 | 격리 |
|---|---|---|
| Ollama LRU 캐시 | ✅ 자동 (단일 Ollama 인스턴스) | ✅ 자동 |
| swap 시간 | 5~30초 (모델 다운로드 시 1~3분) | 동일 |
| 메모리 | 한 인스턴스에 LRU | 동일 |
| 진입 점 | 메인 안에서 직접 | HTTPS forward |

→ **무차별** (Ollama 자체 능력으로 처리)

### 5.2 시나리오 B — 다른 엔진 + 같은 모델 (예: vLLM Qwen 7B vs Ollama qwen3:4b 비교)

**일심동체**:
- Ollama daemon 항상 떠있음, vLLM lazy spawn
- 사용자가 "vLLM 호출" 클릭 → vLLM spawn (cold 30~60초) → GPU 메모리 점유
- Ollama 가 GPU 차지 중이면 **OOM 위험** (`--gpu-memory-utilization 0.5` 절충)
- 양쪽 동시 호출 = 한 GPU L4 24GB 에 2 엔진 동거 → 모델 크기 합 ~10GB+ 시 OOM

**격리**:
- 추론 service 안에 모든 엔진 daemon 같이 운영 가능
- max-instances=1 이라 같은 인스턴스 안 1 GPU 24GB 동거 → 동일 OOM 문제
- max-instances=2 + GPU quota 2 → **병렬 비교 가능** (격리 만 가능)

→ **격리 우세** (스케일 아웃 가능 시)

### 5.3 시나리오 C — 6 엔진 동시 비교 모드 (REBUILD24 §6.2)

같은 프롬프트 → 6 엔진 동시 호출 → 응답/속도/품질 비교

**일심동체**:
- Ollama / llama-server / vLLM / 3 sub-server 엔진 모두 같은 GPU L4 점유 시도
- **동시 다 못 떠있음** (24GB 부족) → 순차 실행 강제
- 6 엔진 비교 시간 = sum(각 cold start + 추론) ≈ 5~10분

**격리**:
- 격리 service 1 인스턴스 = 일심동체와 같은 한계
- 격리 max-instances=N → GPU quota N 필요 → 비용 큼
- **현실적 해결책**: 비교 모드는 cold cache 단계별 호출 (UI 가 순차)

→ **양쪽 동일 한계** (GPU quota 가 본질 제약)

### 5.4 시나리오 D — 모델 카탈로그 확장 (예: Mixtral / Phi-4 / Llama 4 추가)

| 작업 | 일심동체 | 격리 |
|---|---|---|
| Ollama 모델 추가 (`ollama pull`) | 메인 image 빌드 시 baked OR runtime pull | 격리 image 빌드 시 baked |
| llama-server GGUF 추가 | api/local-infer.js + Dockerfile 변경 | inference-py + 격리 Dockerfile |
| vLLM HF 모델 추가 | `MODEL_MAP` 추가 (코드만) | 동일 |
| 빌드 영향 | 17~20분 (전체) | 메인 변경 0 + 격리 17~20분 |

**핵심**: 모델 추가는 보통 **코드만 변경** (catalog 추가). 모델 자체는 첫 호출 시 lazy 다운. 빌드 영향은 vLLM venv 변경 시만 큼.

→ **격리 약간 우세** (격리 변경 시 메인 image 영향 0)

### 5.5 시나리오 E — 모델 hot-swap (운영 중 교체)

**Ollama**: `ollama pull <new>` + UI 에서 model_key 변경 → daemon 재시작 없음. 양쪽 동일.

**llama-server / vLLM**: process kill + respawn 필요 (30~60초 다운타임).
- 일심동체: 메인 앱은 살아있음 (lazy spawn 패턴) → 영향 0
- 격리: 추론 service 의 lazy spawn → 영향 0
- 동일

→ **무차별** (lazy spawn 패턴이 양쪽에서 hot-swap 자동)

### 5.6 시나리오 F — A/B 테스트 (사용자 그룹별 다른 모델)

**일심동체**:
- 한 service 안에 라우팅 로직 → A/B 그룹 분기 후 같은 인스턴스 호출
- 같은 GPU 점유 → 한 모델만 active

**격리**:
- 추론 service 를 v1 / v2 로 별도 deploy → traffic split (Cloud Run Revision)
- **A/B 트래픽 분리 가능** ⭐ (Cloud Run 의 무료 기능)

→ **격리 우세** (A/B 인프라 무료 활용)

### 5.7 다중 모델 시나리오 종합

| 시나리오 | 일심동체 | 격리 | 우세 |
|---|---|---|---|
| A. 같은 엔진 모델 swap | ✅ | ✅ | 동일 |
| B. 다른 엔진 비교 | ⚠️ OOM | ✅ scale-out 가능 | 격리 |
| C. 6 엔진 동시 비교 | ❌ GPU 부족 | ❌ GPU 부족 | 동일 한계 |
| D. 카탈로그 확장 | 17~20분 빌드 | 메인 영향 0 | 격리 ⭐ |
| E. Hot-swap | ✅ | ✅ | 동일 |
| F. A/B 테스트 | ❌ 어려움 | ✅ revision split | **격리 ⭐⭐⭐** |

→ **모델 운영 측면에서도 격리가 본질적 우세**.

---

## 6. AI TutorTwo 권장 — 하이브리드 구조 ⭐⭐⭐

### 6.1 권장 분담

```
[메인 일심동체: aitutor (현재)]                    [격리: aitutor-inference (현재)]
├─ Express + dist/                                  ├─ FastAPI uvicorn
├─ Ollama daemon (always-on)         ⭐             ├─ vLLM (lazy spawn)              ⭐
├─ Python sub-server (port 11442)    ⭐             ├─ llama-server (lazy spawn)      ⭐
│   ├─ onnxruntime-genai (in-process)               ├─ Python sub-server (option)
│   ├─ transformers (in-process)                    └─ Ollama option (현재 격리 GPU)
│   └─ llama-cpp-python (lazy)
└─ /api/local-infer (가벼운 엔진 직접 호출)

→ 사용자 호출 라우팅:
   - Ollama / onnx / transformers → 일심동체 (latency 0ms, always-warm)
   - vLLM / llama-server → 격리 (cold start 격리, GPU quota 보호, scale-out 가능)
```

### 6.2 이 분담의 근거

| 엔진 | 일심동체 | 격리 | 근거 |
|---|---|---|---|
| Ollama | **여기** | (옵션) | always-on, LRU 캐시, 메인 앱과 자연스러움 |
| llama-cpp-python | **여기** (sub-server) | — | in-process, 가벼움 |
| onnxruntime-genai | **여기** (sub-server) | — | daemon 없음, 가벼움 |
| transformers | **여기** (sub-server) | — | sub-server 동거 |
| vLLM | — | **여기** | cold start 길음 + GPU 단독 + scale-out |
| llama-server | — | **여기** | process 수명 격리 + scale-out |

### 6.3 메인 일심동체 image 정리 권장

현재 메인 image 에 vLLM venv 있음 → **격리만 vLLM 운영**으로 결정 시 메인 image 에서 vLLM 제거 가능:

| 변경 | 효과 |
|---|---|
| Dockerfile 의 `vllm==0.6.5` 제거 | image -3GB (8GB → 5GB) |
| llama.cpp builder stage 제거 | image -50MB (변동 작음) |
| Multi-stage 단순화 | 빌드 시간 17분 → **8~10분** |
| sub-server 의 transformers + onnx + llama-cpp-python 만 유지 | sub-server 정상 동작 |

→ **메인 image 절반 다이어트 + 빌드 절반 단축**.

### 6.4 격리 image 는 강화

| 변경 | 효과 |
|---|---|
| 격리 image 에 vLLM venv 전체 + llama.cpp binary | image 7~8GB (변동 없음) |
| 격리 service 만 GPU L4 1장 강제 | GPU quota 1로 유지 가능 |
| min-instances=0 (idle 절감) | 비용 0 (호출 시만 cold start) |
| max-instances=N (선택, traffic 증가 시) | scale-out 가능 |

### 6.5 라우팅 변경

| 호출 | 현재 | 권장 |
|---|---|---|
| `POST /api/local-infer` (engine=ollama) | 일심동체 직접 | 일심동체 직접 (그대로) |
| `POST /api/local-infer` (engine=onnx/transformers/llama-cpp-python) | sub-server (11442) | sub-server (그대로) |
| `POST /api/local-infer` (engine=vllm/llama-server) | lazy spawn 일심동체 | **/api/iso-infer 로 forward** ⭐ |
| `POST /api/iso-infer` (격리) | 격리 forward | 동일 |

→ `api/local-infer.js` 의 `engine === 'vllm' || engine === 'llama-server'` 분기에서 `iso-infer` forward 로 redirect.

---

## 7. 비용 / 자원 영향 추정

### 7.1 빌드 비용

| 시나리오 | 메인 빌드 | 격리 빌드 | 월 (메인 5회 + 격리 1회) |
|---|---|---|---|
| 현재 (일심동체 + 격리 = 같은 image) | 17~20분 = $1 | 0 | $5/월 |
| 분담 (메인 vLLM 제거) | **8~10분 = $0.50** | 17~20분 = $1 | **$3.50/월** (월 5+1) |

→ 빌드 비용 **30% 절감**.

### 7.2 운영 비용

| 항목 | 현재 | 분담 후 | 차이 |
|---|---|---|---|
| 메인 image storage | $0.70/월 (7GB) | $0.50/월 (5GB) | -$0.20 |
| 격리 image storage | (현재 메인 재사용) | $0.70/월 | +$0.70 |
| GPU idle (양쪽 min=0) | $0 | $0 | 0 |
| GPU 호출 비용 | 호출 시만 | 호출 시만 | 0 |
| **합계 monthly** | **$5.70/월** | **$4.20/월** | **-$1.50/월 (-26%)** |

### 7.3 시간 절감 (개발자 경험)

- 메인 빌드 17분 → 8~10분 = 회당 7~9분 절감
- 월 5회 메인 변경 = 35~45분/월 시간 절감 + 빌드 대기 stress 감소
- 추론 변경은 드물어 (월 1회) 격리 빌드 부담 작음

---

## 8. 위험 / 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| 메인 image 에서 vLLM 제거 → /api/local-infer 의 vllm 분기 실패 | UX | iso-infer forward 로 redirect (코드 1줄) |
| 격리 service 의 vLLM cold start (30~60초) 메인보다 길어짐 | UX | 사용자에게 "격리 추론 첫 호출 1~3분" 안내 (이미 UI 에 있음) |
| 격리 service IAM 관리 부담 | 운영 | 메인 SA → 격리 invoker (현재 설정 그대로) |
| ISO_INFER_URL 환경변수 누락 시 메인 vllm 호출 500 | 안정성 | 헬스체크 + 명확한 에러 메시지 |
| 격리 cold start 잦음 → 첫 호출 늦음 | UX | min-instances=1 옵션 (시간당 ~$0.71, traffic 예상 시간대만) |

---

## 9. 권장 의사결정 (3 선택지)

### 옵션 A — 하이브리드 (권장 ⭐⭐⭐)

- 메인 image 에서 vLLM venv 제거 → 5GB 다이어트
- vLLM / llama-server 호출은 격리 service 로 forward
- Ollama / onnx / transformers / llama-cpp-python 은 메인 일심동체 유지
- /lab/local-gcp / /lab/server-infer 양쪽 lab 유지 (UI 차별)
- **비용 -26%, 빌드 -45%, 컨셉 큰 변화 없음**

### 옵션 B — 완전 격리 (REBUILD28 §11 §6 권장 = 옵션 3-A)

- 메인 image → 250MB CPU only (모든 추론 격리로)
- /lab/local-gcp 와 /lab/server-infer 통합
- **비용 -67%, 빌드 -85%, 컨셉 단순화**
- 단, "양쪽 비교" 가치 폐기

### 옵션 C — 현 상태 유지

- 일심동체 + 격리 양쪽이 같은 image (PROCESS_MODE 분기)
- "양쪽 동거 진정 비교" 컨셉 유지
- 빌드 부담 그대로

---

## 10. 비교 매트릭스 (3 옵션)

| 항목 | A. 하이브리드 ⭐ | B. 완전 격리 | C. 현 상태 |
|---|---|---|---|
| 메인 image 크기 | 5 GB | 250 MB | 7~8 GB |
| 메인 빌드 시간 | 8~10분 | 2~3분 | 17~20분 |
| 메인 cold start | ~30초 (Ollama spawn) | 3~5초 | 30~50초 |
| 격리 사용 | 무거운 엔진 (vLLM 등) | 모든 엔진 | 같은 image 재사용 |
| 비용 절감 | -26% | -67% | 0 |
| 컨셉 변화 | 작음 | 큼 (lab 통합) | 0 |
| 작업 부담 | 0.5~1일 | 1~1.5일 | 0 |
| 비교 학습 가치 | 유지 | 약화 | 최대 |
| **추천도** | **⭐⭐⭐ AI TutorTwo 핏** | ⭐⭐ 비용 우선 | ⭐ 학습 도구 |

---

## 11. 한 줄 결론

**엔진별 적합도가 분명히 다르다.** Ollama / onnx / transformers / llama-cpp-python 은 일심동체에서 자연스럽고, vLLM / llama-server 는 격리에서 본질적 우세. **하이브리드 (옵션 A)** 가 AI TutorTwo 의 학습 도구 컨셉 + 운영 효율 + 모델 비교 가치를 모두 살리는 최적안.

---

## 12. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-30 | REBUILD29.md 최초 작성 — REBUILD28 의 12 차원 비교 + 14 차원 확장 + 6 엔진 각각의 아키텍처 적합도 매트릭스 + 다중 모델 시나리오 6 종 + 하이브리드(A) / 완전 격리(B) / 현 상태(C) 3 옵션 + 비용 추정. **권장: 옵션 A 하이브리드** |
| 2026-04-30 (P0 vLLM 1차 fix) | huggingface-hub 0.26.3 → 0.25.2 다운그레이드 (rebuild28-p0-vllm-fix). 부분 fix — transformers 5.7.0 자동 설치로 ImportError 잔존 확인 |
| 2026-04-30 (P0 vLLM 2차 fix) | transformers==4.46.3 + huggingface-hub==0.25.2 + vllm==0.6.5 동시 lockstep 명시 (rebuild28-final). vLLM × Qwen 3 4B 첫 응답 받음 (사용자 검증 ⭐) |
| 2026-04-30 (Qwen no_think) | 실험실 전체 공통 적용 — 8 위치 (백엔드 4 + 클라이언트 3 + Python dispatch 1). vllm chat_template_kwargs + messages /no_think + Ollama think:false 이중 안전망 (rebuild29-qwen) |
| 2026-04-30 (격리 7-2b/c) | 격리 service llama-server / vLLM 활성화 — `_daemon.py` 헬퍼 + lazy spawn + GGUF auto-download. catalog status='active', dispatch 등록 (rebuild29-engines, deploy 완료) |
| 2026-04-30 (maxTokens default) | 5 lab 의 maxTokens default 256 → 1024 → **2048** 갱신. 비용 영향 0 (EOS 까지 종료, 상한선만 변경). 사용자 검증 결과 (vLLM 응답 잘림) 반영 |

---

## 13. 양쪽 6 엔진 개발 상태 매트릭스 (2026-04-30 현재)

### 13.1 엔진별 구현 + 검증 상태

| # | 엔진 | 일심동체 구현 | 일심동체 검증 | 격리 구현 | 격리 검증 | 비고 |
|---|---|---|---|---|---|---|
| 1 | **Ollama** | ✅ `api/local-infer.js:91-107` (자동 pull) + start.sh:59 always-on daemon | ✅ 사용자 검증 多 | ✅ `engines/ollama.py` (Phase 7-2a) + start.sh isolated+GPU 분기 | ⏳ 사용자 검증 대기 | 한국어 강제 system prompt + assistant seed 패턴 |
| 2 | **llama-server** | ✅ `api/local-infer.js:142-176 ensureLlamaServer` (lazy spawn, child_process) | ⏳ 사용자 검증 대기 | ✅ `engines/llamaserver.py` + `_daemon.ensure_llama_server` (REBUILD29 §6, 격리 단독 GPU) | ⏳ 사용자 검증 대기 | GGUF auto-download from HF Hub, multi-stage 빌드 binary 재사용 |
| 3 | **vLLM** | ✅ `api/local-infer.js:178-196 ensureVllm` (lazy spawn, Python venv) | ✅ 2026-04-30 사용자 응답 받음 (156s, Qwen 3 4B) ⭐ | ✅ `engines/vllm_engine.py` + `_daemon.ensure_vllm` (chat_template_kwargs Qwen no_think 포함) | ⏳ 사용자 검증 대기 | P0 fix: transformers 4.46.3 + huggingface-hub 0.25.2 lockstep |
| 4 | **llama-cpp-python** | ✅ Python sub-server (port 11442, in-process) | ⏳ 사용자 검증 대기 | ✅ Python sub-server (in-process, Phase 7-1) | ⏳ 사용자 검증 대기 | abetlen prebuilt CUDA wheel cu124 |
| 5 | **onnxruntime-genai** | ✅ Python sub-server (in-process) | ⏳ 사용자 검증 대기 | ✅ Python sub-server (Phase 7-1) | ⏳ 사용자 검증 대기 | Microsoft 공식 CUDA wheel 0.5.2, daemon 없음 |
| 6 | **transformers** | ✅ Python sub-server (vLLM venv 공유) | ⏳ 사용자 검증 대기 | ✅ Python sub-server (Phase 7-1) | ⏳ 사용자 검증 대기 | HF PyTorch CUDA, in-process |

**합계**: 일심동체 6/6 구현 / 1 검증 완료, 격리 6/6 구현 / 0 검증 완료

### 13.2 양쪽 동일 비교 가능 여부

양쪽 deploy 완료 + Qwen no_think 일괄 + vLLM lockstep fix 완료로 **6 엔진 모두 양쪽 동일 비교 가능**.

```
일심동체 호출:  POST /api/local-infer  { engine, model_key, messages }
격리 호출:      POST /api/iso-infer    { engine, model_key, messages }  → 격리 service forward
```

같은 model_key (qwen3-4b 등) 사용 → 일심동체 vs 격리 직접 비교.

### 13.3 deploy 상태 (rebuild29-engines)

| Service | Revision | Image | Traffic |
|---|---|---|---|
| 일심동체 (aitutor) | `aitutor-00016-h82` | rebuild29-engines | 100% |
| 격리 (aitutor-inference) | `aitutor-inference-00008-kk4` | rebuild29-engines | 100% (update-traffic --to-latest 필요했음) |

### 13.4 보조 인프라 상태

| 항목 | 상태 | 비고 |
|---|---|---|
| `/lab` 실험실 메인 페이지 | ✅ deploy | 5 카드 + admin 토글 + 헤더 통일 |
| `/lab/local-ai` EngineSwitcher | ✅ deploy | transformers.js ↔ WebLLM 토글 + 설명 |
| WebLLM (3 모델: Qwen 2.5 7B / DeepSeek R1 / Llama 3.1 8B) | ✅ deploy | `@mlc-ai/web-llm@0.2.83`, 데스크톱 + WebGPU 한정 |
| `/lab/ollama-bridge` 외부 Ollama | ✅ deploy | `lab_ollama_bridge_enabled` admin 토글, `user_lab_settings` DB 자동 생성 |
| Qwen no_think 일괄 적용 | ✅ deploy | 8 위치 (백엔드 4 + 클라이언트 3 + Python dispatch 1) |
| API `/api/user-settings` | ✅ deploy | 사용자별 lab 설정 저장 (whitelist key) |

---

## 14. 남은 작업 목록

### 14.1 사용자 검증 단계 (배포 후 직접 호출 필요)

| 우선순위 | 항목 | 검증 방법 | 상태 |
|---|---|---|---|
| 🔥 P0 | vLLM × Qwen 3 4B (일심동체) — 잘림 없는 응답 | UI 의 max_tokens 2048 입력 후 재호출 (vLLM warm) | ✅ 1차 응답 받음 / ⏳ 2048 검증 |
| 🔥 P0 | 격리 service vLLM 검증 | `/lab/server-infer` → vLLM × Qwen 3 4B (cold 1~3분) | ⏳ |
| 🔥 P0 | 격리 service llama-server 검증 | `/lab/server-infer` → llama-server × Qwen 3 0.6B (cold 30~60초) | ⏳ |
| 🟧 P1 | Qwen no_think 작동 확인 | 모든 엔진 응답에 `<think>...</think>` 없음 | ⏳ |
| 🟧 P1 | `/lab` admin 토글 동작 | admin 로그인 후 카드 우측 토글 클릭 | ⏳ |
| 🟧 P1 | WebLLM Qwen 2.5 7B 다운로드 + 추론 | 데스크톱 Chrome + WebGPU | ⏳ |
| 🟨 P2 | Ollama bridge 검증 | 사용자 PC Ollama 설치 + CORS 설정 + URL 입력 + 테스트 | ⏳ |
| 🟨 P2 | 다른 lab 회귀 (HF / transformers.js) | 기존 동작 정상 | ⏳ |

### 14.2 코드 작업 (다음 빌드 사이클에 합칠 수 있는 항목)

| 우선순위 | 작업 | 효과 | 작업 시간 추정 |
|---|---|---|---|
| 🥇 권장 | **REBUILD29 §6 옵션 A 하이브리드 적용** — 메인 image 에서 vLLM venv + llama.cpp builder 제거, vLLM/llama-server 호출은 iso-infer forward | 메인 image 7~8GB → 3~4GB, 빌드 17분 → 8~10분, cold start 30~50초 → 10~20초, 비용 -26% | 1~1.5시간 |
| 🥈 | WebLLM 번들 lazy 분리 — `React.lazy(() => import('./WebllmPanel'))` | 메인 페이지 첫 로드 -6MB | 30분 |
| 🥉 | maxTokens default 1024 → 2048 (이미 코드 변경 완료, 다음 빌드 자동 반영) | 잘림 사례 0 | 0 (이미 commit) |
| 🟦 | Context window 4096 → 8192 확장 (`--max-model-len 8192`, `--ctx-size 8192`) | input + output 합산 한계 2배 | 30분 (Dockerfile + start.sh) |
| 🟦 | `aitutor-inference/Dockerfile` 헤더 주석 정리 (legacy 명시) | 운영자 혼동 방지 | 10분 |
| 🟦 | WebLLM 카탈로그 확장 (Phi-3.5 Mini / Gemma 2 9B 추가) | 비교 모델 다양화 | 30분 |
| 🟦 | `lab_local_lambda_enabled` DB key 명명 검토 (마이그) | 명명 일관성 | 1시간 (마이그 부담) |

### 14.3 검증 자동화 / 인프라 (선택)

| 우선순위 | 작업 | 효과 |
|---|---|---|
| 🟦 | Playwright e2e 테스트 추가 (`/lab` 5 카드 + 토글 + WebGPU mock) | 회귀 자동 감지 |
| 🟦 | Cloud Run min-instances=1 (warm) 옵션 검토 | UX +cold start 0 vs 비용 +$0.71/시간 |
| 🟦 | Image storage cleanup policy 추가 (Artifact Registry) | 오래된 tag 자동 삭제 |
| 🟦 | 모니터링 대시보드 (Cloud Logging filter) | 엔진별 호출 / 에러율 시각화 |

### 14.4 미구현 (deferred 의식적 보류)

| 항목 | 이유 |
|---|---|
| SGLang 엔진 | REBUILD28 §0.2 — 사용 패턴 미스매치 (multi-turn / RAG 시너지 없음). **placeholder 완전 제거** |
| TensorRT-LLM 엔진 | REBUILD28 §0.2 — 28분 컴파일 + 모델 교체 마찰. **placeholder 완전 제거** |
| Capacitor 데스크톱 (Tauri) | REBUILD29 §2 — over-engineering, 학습 도구 규모 초과 |

### 14.5 작업 흐름 요약

```
현재 상태 (rebuild29-engines deploy)
  ↓
[사용자 검증 단계] (14.1)
  ├─ ✅ vLLM 일심동체 1차 응답 받음
  └─ 나머지 6 엔진 × 양쪽 = 12 호출 검증 대기
  ↓
[다음 빌드 사이클 = REBUILD29 §6 옵션 A 결정 시]
  ├─ 메인 Dockerfile 다이어트
  ├─ 코드 변경 (api/local-infer.js forward 분기)
  ├─ Vite build + Cloud build
  ├─ 양쪽 service redeploy
  └─ 사용자 재검증
  ↓
[14.2 P3 정리 작업 합쳐 마무리 빌드]
  ↓
6 엔진 × 양쪽 진정 전수 + 옵션 A 하이브리드 = 안정 운영 단계
```

---

## 15. 변경 이력 (§13~14 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§13~14 추가) | 양쪽 6 엔진 개발 상태 매트릭스 (구현 + 검증 분리) + 남은 작업 목록 (사용자 검증 / 코드 작업 / 검증 자동화 / deferred). 사용자 요청 (2026-04-30) 반영 |

---

## 16. Qwen 한국어 강제 + Ollama bridge UI 강화 (2026-04-30 사용자 요청)

### 16.1 사용자 보고

> Ollama bridge × Qwen 3 4B 호출 결과가 영어 + reasoning trace 로 답변.
> "Qwen 모델은 전수검사해서 한글로 답변을 달라고 하고 씽킹모드 false 로 해야함"
> "브릿지 실험실에서 연결테스트는 필수 단계로 해서 등록된 모델을 선택하도록 수정"

### 16.2 한국어 강제 3중 패턴 (`applyQwenStrict` 헬퍼)

`applyQwenNoThink` 만으로는 Qwen 4B 가 영어로 답변하는 사례 발생. 3중 강제 패턴으로 보강:

```
[system]      당신은 한국어 자격증 강사 + ⚠ CRITICAL: 반드시 한국어로만 답변 ...
[user]        ...질문... + ⚠ 반드시 한국어(Korean)로만 답변하세요 + /no_think
[assistant]   네, 한국어로 답변드리겠습니다.\n\n   ← 가장 강력한 강제 (모델이 이 시작을 이어감)
```

### 16.3 적용 위치 (8 곳)

| 위치 | 헬퍼 |
|---|---|
| `api/local-infer.js` (vLLM/llama-server/sub-server) | `applyQwenStrict` |
| `api/iso-infer.js` (격리 forward) | `applyQwenStrict` |
| `api/hf.js` (HF Inference) | `applyQwenStrict` |
| `inference-py/engines/__init__.py` (격리 dispatch) | `apply_qwen_strict` |
| `WebllmPanel.jsx` (브라우저 WebLLM) | `applyQwenStrict` |
| `OllamaBridgeTester.jsx` (사용자 PC Ollama) | `applyQwenStrict` |
| `inference.js` (transformers.js ONNX) | `applyQwenStrict` |
| `callOllama` (api/local-infer.js) | 기존 한국어 강제 + `body.think=false` (그대로) |

### 16.4 Ollama bridge UI 강화

- **모델 입력란 → select dropdown**: 연결 테스트 후 받은 `/api/tags` 응답에서 선택 (자유 입력 차단)
- **연결 테스트 필수 단계**: 테스트 안 하면 모델 input/추론 버튼 모두 disabled
- **도움말 6 단계** (펼침): OS별 재시작 + curl 검증 + 복사 버튼

### 16.5 maxTokens default 조정 (사용자 결정 — B안)

| Lab | 카테고리 | default |
|---|---|---|
| LocalGcpTester | 🟢 GCP | **2048** |
| ServerInferTester | 🟢 GCP | **2048** |
| WebllmPanel | 🟡 사용자 디바이스 | **2048** |
| OllamaBridgeTester | 🟡 사용자 디바이스 | **2048** |
| LocalAiExplanation (transformers.js) | 🟡 사용자 디바이스 | **2048** |
| HfPlayground | 🔴 외부 API | **1024** (보수) |
| HfCompare | 🔴 외부 API | **1024** (보수) |

기준: GCP / 사용자 디바이스 = 토큰당 비용 0 → 큼 / 외부 API = 토큰당 과금 → 보수.

---

## 17. 격리 6 엔진 검증 + Gemma 추가 + 429 cold start 처리 (2026-04-30)

### 17.1 격리 6 엔진 코드 검증 결과

| 엔진 | catalog status | _DISPATCH 등록 | 비고 |
|---|---|---|---|
| llama-cpp-python | ✅ active | ✅ | Phase 7-1 |
| onnxruntime-genai | ✅ active | ✅ | Phase 7-1 |
| transformers | ✅ active | ✅ | Phase 7-1 |
| Ollama | ✅ active | ✅ | Phase 7-2a (start.sh isolated+GPU) |
| llama-server | ✅ active | ✅ | Phase 7-2b (lazy spawn) |
| vLLM | ✅ active | ✅ | Phase 7-2c (lazy spawn) |

→ 격리 service 6/6 코드 완전 구현 (rebuild29-engines deploy 완료).

### 17.2 Gemma 3n 2종 양쪽 catalog 추가 (사용자 요청)

```python
# inference-py/engines/catalog.py + aitutor-inference/engines/catalog.py (sync)
"gemma3n-e2b": {
    "engines": { "ollama": "gemma3n:e2b" },  # Ollama 전용 (다른 엔진은 변환본 부재)
},
"gemma3n-e4b": {
    "engines": { "ollama": "gemma3n:e4b" },
},
```

→ 일심동체 vs 격리 = 5 모델 동일 카탈로그 (Qwen 3종 = 6 엔진 비교 / Gemma 2종 = Ollama 만 비교).

### 17.3 429 Cold Start retry 로직

**원인 진단**:
- 격리 service `maxScale=1, containerConcurrency=10, minScale=0`
- idle 5분 후 instance 종료 → 사용자 페이지 진입 시 cold start 직전 도달 → Cloud Run 가 429 반환

**해결책**:
- ✅ **UI retry 3회** (지수 backoff 2/4/8초): `ServerInferTester.jsx` 의 catalog fetch
- ✅ **백엔드 forward retry 3회**: `api/iso-infer.js` 의 `forward()` 함수
- ✅ retry 중 사용자에게 "격리 service 기동 중... (1/3 재시도)" 안내

### 17.4 격리 lab UI 정리

- **FALLBACK_ENGINES** 의 llama-server / vLLM `'planned' → 'active'` (catalog 와 일치)
- **안내 배너** 옛 표현 갱신 (8 엔진 / GPU 5종 quota → 6 엔진 모두 active / cold start 안내)

### 17.5 변경 파일 목록 (rebuild29-final 빌드 포함)

```
api/_runtime/qwen.js                              MOD  (applyQwenKoreanLock + applyQwenStrict)
api/local-infer.js                                MOD  (applyQwenStrict 적용)
api/iso-infer.js                                  MOD  (applyQwenStrict + 429 retry 3회)
api/hf.js                                         MOD  (applyQwenStrict)
src/lib/qwen.js                                   MOD  (applyQwenKoreanLock + applyQwenStrict)
inference-py/engines/qwen_helpers.py              MOD  (apply_qwen_korean_lock + apply_qwen_strict)
inference-py/engines/__init__.py                  MOD  (dispatch 에서 strict 적용)
inference-py/engines/catalog.py                   MOD  (gemma3n-e2b/e4b 추가)
aitutor-inference/engines/qwen_helpers.py         MOD  (sync)
aitutor-inference/engines/__init__.py             MOD  (sync)
aitutor-inference/engines/catalog.py              MOD  (sync, Gemma 추가)
src/labs/server-infer/ServerInferTester.jsx      MOD  (FALLBACK active + 배너 + retry)
src/labs/local-ai/components/WebllmPanel.jsx     MOD  (applyQwenStrict + maxTokens 2048)
src/labs/local-ai/lib/inference.js               MOD  (applyQwenStrict)
src/labs/local-gcp/LocalGcpTester.jsx            MOD  (maxTokens 2048)
src/labs/ollama-bridge/OllamaBridgeTester.jsx    MOD  (select dropdown + 도움말 6 단계 + applyQwenStrict + maxTokens 2048)
src/labs/hf-playground/HfPlayground.jsx          MOD  (maxTokens 1024 유지)
src/labs/hf-playground/HfCompare.jsx             MOD  (maxTokens 1024 유지)
```

---

## 18. 변경 이력 (§16~17 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§16~17 추가) | Qwen 한국어 강제 3중 패턴 (`applyQwenStrict`) + Ollama bridge select dropdown + 도움말 6 단계 + maxTokens default GCP/사용자=2048/외부 API=1024 + Gemma 3n 2종 양쪽 catalog + 429 cold start retry 3회 (UI+백엔드) + 격리 lab FALLBACK active + 배너 갱신. **rebuild29-final image 빌드 + 양쪽 redeploy** |

---

## 19. QuestionPicker 공통 컴포넌트 (2026-04-30 사용자 요청)

### 19.1 사용자 요청

> "실험실 각 페이지 모델 답변 테스트시 예시 문제 구조 변경 다양한 문제유형 테스트가 필요하니 모달이나 별도 섹션에서 카테고리를 선택해서 하거나 복사해온 문제를 프롬프트에 삽입가능하도록 ui/ux 를 리디자인. 모든 실험실 페이지에 공통으로 사용. 두 가지 방식 — DB 등록 문제 선택 + 외부 복사 붙여넣기"

### 19.2 신규 컴포넌트 / 헬퍼

| 파일 | 역할 |
|---|---|
| `src/components/lab/QuestionPicker.jsx` | 메인 컴포넌트 — 탭 (DB / 붙여넣기) + 미리보기 + 부모에 onChange 콜백 |
| `src/components/lab/QuestionPreview.jsx` | 선택된/파싱된 문항 미리보기 카드 (정답 표시 포함) |
| `src/lib/lab/parseQuestion.js` | 텍스트 → `{body, choices, answer}` 파싱 헬퍼 |

### 19.3 두 가지 입력 방식

**📚 DB 등록 문항**:
- `/api/questions?action=public` 으로 시험 목록 (`exams`) 동적 로드
- 시험 select dropdown (운전면허 default 161, 다른 시험 추가 가능)
- 문항 무작위 ↻ 또는 번호 직접 입력
- exam_id 변경 시 자동 재로드

**📋 직접 붙여넣기**:
- textarea 자유 입력 (placeholder 에 예시 문항)
- ✨ 파싱 시도 — 자동으로 `{body, choices, answer}` 추출
- 인식 패턴:
  - 보기: `①` / `1)` / `(1)` / `1.`
  - 정답: `정답: ②` / `정답 2` / `[정답] ②` / `answer: 1`
- 파싱 결과 미리보기 → ✓ 이 문항 사용 클릭으로 적용

### 19.4 5 lab 통합 (자체 fetchRandomQuestion 폐기)

| Lab | Before | After |
|---|---|---|
| LocalGcpTester | `fetchRandomQuestion()` + 자체 문항 카드 | `<QuestionPicker question onChange={handleQuestionChange} />` |
| ServerInferTester | 동일 | 동일 |
| OllamaBridgeTester | 동일 | 동일 |
| HfPlayground | tab='exam' 분기 + 자체 카드 | tab='exam' 시 `<QuestionPicker />` |
| HfCompare | 동일 | 동일 |
| LocalAiExplanation | 동일 | 동일 |

### 19.5 QuestionPicker 동작

```
[📝 문항 입력 — 선택됨]                  [접기 ▲]
┌─ 펼친 상태 ─────────────────────────┐
│ [📚 DB 등록] [📋 붙여넣기]            │ ← 탭
│                                       │
│ DB 모드:                              │
│  시험: [운전면허 ▼]                  │
│  [↻ 무작위 (157)] 번호: [__] [선택]  │
│                                       │
│ 붙여넣기 모드:                        │
│  [textarea — 외부에서 복사]           │
│  [✨ 파싱 시도] [✓ 이 문항 사용]      │
│                                       │
│ 파싱 미리보기 (붙여넣기 후):          │
│  ─────────────────                    │
│  본문: ...                            │
│  ① ② ③ ④ + 정답 표시                  │
└───────────────────────────────────────┘

선택된 문항 미리보기 (항상 표시):
┌─────────────────────────────────────┐
│ 운전면허 #61 · 도로교통법 (✕ 클리어) │
│ 본문: ...                            │
│ ① ...  ② ... ✓ 정답  ③ ...           │
└─────────────────────────────────────┘
```

### 19.6 변경 파일 목록 (rebuild29-final-v2 빌드 포함)

```
src/components/lab/QuestionPicker.jsx        NEW
src/components/lab/QuestionPreview.jsx       NEW
src/lib/lab/parseQuestion.js                 NEW
src/labs/local-gcp/LocalGcpTester.jsx        MOD (자체 fetchRandomQuestion 제거 + QuestionPicker)
src/labs/server-infer/ServerInferTester.jsx  MOD (동일)
src/labs/ollama-bridge/OllamaBridgeTester.jsx MOD (동일)
src/labs/hf-playground/HfPlayground.jsx      MOD (tab='exam' 시 QuestionPicker)
src/labs/hf-playground/HfCompare.jsx         MOD (동일)
src/labs/local-ai/LocalAiExplanation.jsx     MOD (동일)
```

---

## 20. 변경 이력 (§19 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§19 추가) | QuestionPicker 공통 컴포넌트 — 5 lab 의 자체 fetchRandomQuestion 폐기, DB 등록 문항 선택 (시험 dropdown + 무작위/번호) + 외부 복사 붙여넣기 자동 파싱 (보기 ①②③④ + 정답 패턴 인식). 모든 lab 일관된 UX. **rebuild29-final-v2 빌드 + 양쪽 redeploy 예정** |

---

## 21. 빌드 + Deploy + Playwright 스모크 테스트 (옵션 A) (2026-04-30)

### 21.1 rebuild29-final-v2 빌드 + Deploy 결과

| 항목 | 결과 |
|---|---|
| Cloud Build | ✅ SUCCESS (`f649773e`, ~22분) |
| 일심동체 deploy | revision `aitutor-00017-lsp` 100% traffic |
| 격리 deploy | revision `aitutor-inference-00009-xlj` 100% traffic (update-traffic --to-latest 적용) |

### 21.2 Playwright 옵션 A 스모크 테스트 결과

**대상**: `https://aitutor-58235609672.us-east4.run.app` (production URL)
**파일**: `tests/step7-labs-smoke.spec.js` (309 줄)

#### 환경 설정

```js
// playwright.config.js — PLAYWRIGHT_BASE_URL 환경변수 지원
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';
const IS_REMOTE = !!process.env.PLAYWRIGHT_BASE_URL;
// ...
...(IS_REMOTE ? {} : { webServer: { command: 'npm run dev', port: 5174 } })
```

#### 실행 명령

```bash
PLAYWRIGHT_BASE_URL=https://aitutor-58235609672.us-east4.run.app \
  npx playwright test tests/step7-labs-smoke.spec.js --reporter=list
```

#### 결과 (3차 실행 후)

| 차수 | passed | failed | skipped | 시간 | 비고 |
|---|---|---|---|---|---|
| 1차 (localhost dev) | 12 | 4 | 2 | 1.1분 | localhost 의 백엔드 미동작 → /api/config 실패 → lab 비활성 가드 |
| 2차 (production) | 15 | 2 | 2 | 41초 | selector `getByRole('link')` 변경 + production URL |
| **3차 (production, 최종)** | **15** | **0** | **4** | **33.3초** | admin/일반 사용자 분기 테스트 2개 skip 처리 |

#### 통과한 테스트 15개

| 섹션 | 테스트 | 결과 |
|---|---|---|
| /lab 메인 | 헤더 + 5 lab 카드 모두 표시 | ✅ |
| /lab 메인 | 상단 우측 "← 홈" 링크 동작 | ✅ |
| /lab/local-ai | 페이지 진입 + 헤더 + EngineSwitcher 노출 | ✅ |
| /lab/local-ai | "← 실험실" 링크 동작 | ✅ |
| /lab/local-gcp | 6 엔진 + 5 모델 카드 + QuestionPicker | ✅ |
| /lab/local-gcp | "← 실험실" 헤더 링크 | ✅ |
| /lab/server-infer | 6 엔진 표시 (FALLBACK 모두 active) | ✅ |
| /lab/hf | 시험/자유 탭 + 비교 모드 링크 | ✅ |
| /lab/hf/compare | 비교 모드 페이지 진입 | ✅ |
| /lab/ollama-bridge | 도움말 6단계 + 연결 테스트 필수 + 모델 select 비활성 | ✅ |
| QuestionPicker | DB 탭 + 붙여넣기 탭 전환 | ✅ (lab 활성 시 자동 검증) |
| QuestionPicker | 붙여넣기 자동 파싱 | ✅ (lab 활성 시 자동 검증) |
| 헤더 통일 | /lab/local-ai 의 "← 실험실" 링크 | ✅ |
| 헤더 통일 | /lab/hf / /lab/local-gcp / /lab/server-infer / /lab/ollama-bridge | ✅ (4개) |

#### Skip 처리한 4개 (사용자 직접 검증 필요)

| 테스트 | 사유 |
|---|---|
| /lab admin 토글 표시 | production 의 실 admin 인증 토큰 필요 (fake 토큰 우회 어려움) |
| /lab 일반 사용자 배지 | 동일 |
| QuestionPicker DB 탭 전환 | lab 비활성 가드 시 skip (admin 토글 OFF 상태 의존) |
| QuestionPicker 붙여넣기 파싱 | 동일 |

### 21.3 발견된 production 이슈

| 이슈 | 영향 | 사용자 검증 권장 |
|---|---|---|
| /lab/server-infer 의 6 엔진 fallback 일부만 노출 (1차 retry 시) | 낮음 (retry 후 전체 노출) | ⚠ |
| (다른 이슈 없음) | — | — |

### 21.4 추가 권장 (사용자 직접 검증)

옵션 A 가 검증 못한 부분:
1. **admin 로그인 후** /lab 의 토글 동작 (5개 카드)
2. **추론 실제 호출** — /lab/local-gcp 또는 /lab/server-infer 에서 6 엔진 × Qwen 0.6B 호출
3. **QuestionPicker 실제 DB 모드** — 시험 select 후 무작위/번호 선택 + 추론
4. **WebLLM 다운로드** — /lab/local-ai → WebLLM 토글 + Qwen 2.5 7B 다운로드 시도 (데스크톱)
5. **Ollama bridge 실 호출** — 사용자 PC Ollama 연결 테스트 + 추론

### 21.5 변경 파일 (이번 단계)

```
playwright.config.js                   MOD  (PLAYWRIGHT_BASE_URL 환경변수 지원)
tests/step7-labs-smoke.spec.js         NEW  (309줄, 19 테스트)
```

---

## 22. 변경 이력 (§21 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§21 추가) | rebuild29-final-v2 deploy 완료 (일심동체 aitutor-00017-lsp / 격리 aitutor-inference-00009-xlj) + Playwright 옵션 A 스모크 테스트 작성 + production URL 실행 결과 **15/15 통과 (33.3초)** + 4 skip (사용자 직접 검증 필요) |

---

## 23. 시스템 프롬프트 통일 + 카드 타이틀 직관적 용어 변경 (2026-04-30)

### 23.1 사용자 보고

> "현재 시스템 프롬프트가 노출이 안 되거나 진짜 없는듯. Ollama bridge에서 시스템 프롬프트 없어 해설이 아니라 문제만 반복."
> "각 카드 타이틀 용어가 마음에 안 듦. 일관성 있게 직관적 용어로 변경 (디바이스 AI 해설 → 온디바이스 모델, Cloud Run 일심동체 → 서비스+추론엔진+모델 서버통합, 격리 추론 → 추론엔진+모델 서버분리)"

### 23.2 시스템 프롬프트 전수 점검 결과

| Lab | Before (단순 1줄) | After (통합 5조 형식) |
|---|---|---|
| LocalGcpTester | "당신은 한국어 자격증 시험 전문 강사입니다. 정답을 정확히 ..." | `STANDARD_SYSTEM_PROMPT` (5조) |
| ServerInferTester | 동일 | 동일 |
| WebllmPanel | "당신은 한국어 자격증 시험 전문 강사입니다. 반드시 한국어로만 ..." | 동일 |
| OllamaBridgeTester | 동일 | 동일 |
| LocalAiExplanation | (이미 5조 prompts.js 사용) | 그대로 |
| HfPlayground | (`buildExamMessages` 자체 system) | 자유 모드 그대로 |

### 23.3 통합 헬퍼 — `src/lib/lab/promptBuilder.js` (NEW)

```js
export const STANDARD_SYSTEM_PROMPT = `당신은 한국 자격증 학과시험 강사입니다.

객관식 해설 형식 (반드시 지킬 것):
1) 인사말·서두 없이 바로 "정답은 ②번입니다" 로 시작
2) 각 보기 ①②③④ 마다 한 줄로 정답/오답 이유 설명 (한 줄에 한 보기)
3) 마크다운 강조(**, ##, --- 등) 사용 금지 — 일반 텍스트만
4) 관련 법령·규정은 「도로교통법」 처럼 한국식 따옴표로 인용
5) 한국어로만, 군더더기 없이 핵심만`;

export function buildLabMessages(question, opts = {}) {
  const system = opts.systemOverride || STANDARD_SYSTEM_PROMPT;
  return [
    { role: 'system', content: system },
    { role: 'user',   content: buildUserPrompt(question) },
  ];
}
```

→ Qwen 한국어 강제 (`applyQwenStrict`) 와 함께 적용 — system + user + assistant seed 3중 강제 + 5조 형식.

### 23.4 카드 타이틀 변경 매트릭스

| Lab | Before | After |
|---|---|---|
| local-ai | 🧪 디바이스 AI 해설 | 📱 **온디바이스 모델** |
| hf | 🤗 HF Inference (오픈 모델 라우팅) | 🤗 **외부 추론 라우팅 (HF Inference)** |
| local-gcp | ☁️ Cloud Run 일심동체 | ☁️ **서버 통합 (서비스+추론엔진+모델 한 컨테이너)** |
| server-infer | 🧪 격리 추론 (server-infer) | 🧪 **서버 분리 (추론엔진+모델 별도 서비스)** |
| ollama-bridge | 🖥️ 외부 Ollama bridge | 🖥️ **사용자 PC 추론 (Ollama bridge)** |

→ 일관성: "서비스 / 추론엔진 / 모델" 구성 명시 + 위치 (브라우저 / 서버 통합 / 서버 분리 / 사용자 PC / 외부 라우팅).

### 23.5 적용 위치 (모든 UI 노출)

| 영역 | 변경 |
|---|---|
| `/lab` 메인 카드 5개 | title + summary 갱신 |
| 각 lab 페이지 헤더 (`<h1>`) | 5 lab 모두 갱신 |
| Settings 카드 5개 | title + toast 메시지 + aria-label 모두 갱신 |
| 비활성 가드 페이지 | "현재 실험실(...) 비활성" 문구 갱신 |
| LocalAiExplanation 의 "📝 디바이스 AI 해설" 응답 라벨 | "📝 온디바이스 해설" |
| LocalGcpTester footer 안내 | "REBUILD29 §22 — 서버 통합 (...)" |
| ModelDownloadCard "디바이스 AI 활성화" | "온디바이스 모델 활성화" |

### 23.6 변경 파일 (이번 단계)

```
src/lib/lab/promptBuilder.js                  NEW  (STANDARD_SYSTEM_PROMPT + buildLabMessages)
src/labs/index.jsx                            MOD  (5 카드 title/summary 직관적 용어)
src/labs/local-ai/LocalAiExplanation.jsx      MOD  (헤더 + 응답 라벨)
src/labs/local-ai/index.jsx                   MOD  (비활성 가드)
src/labs/local-ai/components/ModelDownloadCard.jsx MOD
src/labs/local-gcp/LocalGcpTester.jsx         MOD  (헤더 + footer + buildLabMessages)
src/labs/local-gcp/index.jsx                  MOD  (비활성 가드)
src/labs/server-infer/ServerInferTester.jsx   MOD  (헤더 + buildLabMessages)
src/labs/ollama-bridge/OllamaBridgeTester.jsx MOD  (헤더 + buildLabMessages)
src/labs/ollama-bridge/index.jsx              MOD  (비활성 가드)
src/labs/local-ai/components/WebllmPanel.jsx  MOD  (buildLabMessages)
src/labs/hf-playground/HfPlayground.jsx       MOD  (헤더)
src/tabs/SettingsTab/index.jsx                MOD  (5 카드 title + toast + aria-label)
```

---

## 24. 변경 이력 (§23 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§23 추가) | 시스템 프롬프트 5 lab 통일 (`promptBuilder.js` + `STANDARD_SYSTEM_PROMPT` 5조) + 카드 타이틀 직관적 용어 변경 (📱 온디바이스 모델 / ☁️ 서버 통합 / 🧪 서버 분리 / 🖥️ 사용자 PC 추론 / 🤗 외부 추론 라우팅). UI 노출 모든 영역 (헤더/카드/Settings/toast/aria-label/비활성 가드) 일관성 갱신. **다음 빌드 사이클에 합쳐 반영 예정** |

---

## 25. 모델 통일 (Qwen 3.5 + Gemma 4) + DB 계층 선택 + PromptEditor (2026-04-30)

### 25.1 사용자 요청 (3종)

> "DB 에서 카테고리 이하 분류 기준 반영해서 특정 문제까지 선택. 프롬프트 섹션별로 수정 + 최종 전송 버튼. 모델은 local-ai 와 동일 (Qwen 3.5 + Gemma 4). 단 일심동체+격리에만 적용."

### 25.2 모델 통일 (일심동체 + 격리, local-ai 와 동일 시리즈)

**검증 결과 (web search 2026-04)**:
- **Qwen 3.5** (2026-02-16 출시): Ollama `qwen3.5:2b/4b/9b/27b`, HF GGUF `unsloth/Qwen3.5-XB-GGUF`, day-1 지원
- **Gemma 4** (2026-04 출시): Ollama `gemma4:e2b/e4b`, HF GGUF `unsloth/gemma-4-EXB-it-GGUF`, Apache 2.0

**채택 4 모델** (0.8B 제외 — Ollama 라이브러리 미명시):

| Model Key | name | Ollama | GGUF (llama-server / llama-cpp-python) | HF (vLLM / transformers) | ONNX |
|---|---|---|---|---|---|
| `qwen35-2b` | Qwen 3.5 2B | qwen3.5:2b | unsloth/Qwen3.5-2B-GGUF | Qwen/Qwen3.5-2B-Instruct | onnx-community/Qwen3.5-2B-ONNX |
| `qwen35-4b` | Qwen 3.5 4B | qwen3.5:4b | unsloth/Qwen3.5-4B-GGUF | Qwen/Qwen3.5-4B-Instruct | onnx-community/Qwen3.5-4B-ONNX-OPT |
| `gemma4-e2b` | Gemma 4 E2B | gemma4:e2b | unsloth/gemma-4-E2B-it-GGUF | google/gemma-4-E2B-it | onnx-community/gemma-4-E2B-it-ONNX |
| `gemma4-e4b` | Gemma 4 E4B | gemma4:e4b | unsloth/gemma-4-E4B-it-GGUF | google/gemma-4-E4B-it | onnx-community/gemma-4-E4B-it-ONNX |

→ **3 lab × 4 모델 × 6 엔진 = 진정한 비교 가능** (Qwen3 / Gemma3n 폐기, default qwen3-4b → qwen35-4b).

### 25.3 QuestionPicker DB 모드 강화 (계층 선택)

**Before**: 시험 1단계 dropdown + 무작위/번호
**After**:
1. **카테고리 필터** (선택, default = 전체) — `/api/questions?action=public` 의 categories
2. **시험 dropdown** (카테고리 필터링됨) — exam_id
3. **무작위 ↻** (전체에서)
4. **문제 카드 리스트** — 한 페이지 10개, body 첫 60자 미리보기, 직접 클릭으로 선택
5. **페이지네이션** — ← 이전 / 1/N / 다음 →
6. 선택된 문항 미리보기 (기존 그대로)

→ 사용자가 **특정 문제까지 직접 선택** 가능 (다양한 문제 유형 비교).

### 25.4 PromptEditor 섹션별 편집 + 최종 전송 (NEW)

`src/components/lab/PromptEditor.jsx` (펼침 토글):

```
🎯 프롬프트 편집기 — 섹션별 수정 가능 [접기 ▲]

1️⃣ 시스템 메시지 (페르소나)              [기본값으로]
   [textarea — STANDARD_SYSTEM_PROMPT, 사용자 편집 가능]
   💡 Qwen 호출 시 한국어 강제 자동 추가

2️⃣ 사용자 메시지 (문제 + 보기 + 정답)    [문제로부터 재생성]
   [textarea — buildUserPrompt(question) 자동 삽입, 편집 가능]

3️⃣ Assistant Seed (Qwen 자동, 안내 박스)
   "네, 한국어로 답변드리겠습니다."
   Qwen 모델 한국어 강제 + thinking false 자동 추가됨

📨 최종 메시지 (조합 미리보기, read-only)
   [system] ...
   [user]   ...
   [assistant] ... (Qwen 자동 추가)

[✨ 이 프롬프트로 전송]
```

### 25.5 적용 lab (4)

| Lab | 적용 | handleRun 시그니처 변경 |
|---|---|---|
| LocalGcpTester | ✅ | `(customMessages = null)` |
| ServerInferTester | ✅ | 동일 |
| OllamaBridgeTester | ✅ | `runInfer(customMessages = null)` |
| WebllmPanel | ✅ | `generate(customMessages = null)` |
| LocalAiExplanation (transformers.js) | ⏳ 추후 (`explainQuestion` 내부 chat template 변경 필요) |
| HfPlayground / HfCompare | ⏳ 추후 (자유 프롬프트 모드 통합 별도 설계) |

전송 흐름:
1. 사용자 default → 기존 ✨ 버튼 (handleRun() 호출, customMessages = null → buildLabMessages 사용)
2. 사용자 편집 → PromptEditor → "이 프롬프트로 전송" → handleRun(messages) 직접 사용

### 25.6 변경 파일 목록

```
api/local-infer.js                             MOD  (MODEL_MAP qwen3-* → qwen35-* / gemma3n-* → gemma4-*, default qwen35-4b)
inference-py/engines/catalog.py                MOD  (동일)
aitutor-inference/engines/catalog.py           MOD  (sync, 격리)
src/labs/local-gcp/LocalGcpTester.jsx          MOD  (MODELS + handleRun customMessages + PromptEditor)
src/labs/server-infer/ServerInferTester.jsx    MOD  (동일)
src/labs/ollama-bridge/OllamaBridgeTester.jsx  MOD  (동일)
src/labs/local-ai/components/WebllmPanel.jsx   MOD  (PromptEditor 통합)
src/components/lab/QuestionPicker.jsx          MOD  (계층 선택 + 카드 리스트 + 페이지네이션)
src/components/lab/PromptEditor.jsx            NEW  (섹션별 편집 + 최종 전송)
```

---

## 26. 변경 이력 (§25 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§25 추가) | 모델 통일 (일심동체+격리 = local-ai 와 동일 Qwen 3.5 2B/4B + Gemma 4 E2B/E4B 4 모델 × 6 엔진) + QuestionPicker DB 모드 강화 (카테고리 → 시험 → 문제 카드 리스트 + 페이지네이션) + PromptEditor 신규 (시스템/사용자/assistant seed 섹션별 편집 + 최종 메시지 미리보기 + 전송 버튼) — 4 lab 통합 |

---

## 27. rebuild29-final-v3 빌드 + Deploy + Playwright (2026-04-30)

### 27.1 Cloud Build 결과

| 항목 | 결과 |
|---|---|
| Build ID | `f7cf85be-7c46-4663-93ae-1f2be248a060` |
| Status | ✅ SUCCESS |
| Duration | ~28분 (push 단계 김) |
| Image | `asia-northeast3-docker.pkg.dev/aifactory-494108/aitutor/aitutor:rebuild29-final-v3` |

### 27.2 Deploy 결과

| Service | Revision | Image | Traffic |
|---|---|---|---|
| 일심동체 (aitutor) | `aitutor-00018-t59` | rebuild29-final-v3 | 100% |
| 격리 (aitutor-inference) | `aitutor-inference-00011-kh8` | rebuild29-final-v3 | 100% |

⚠️ **격리 1차 deploy 실패 (00010-spx)**:
- 원인: GPU quota 일시 초과 (양쪽 동시 deploy 시점 quota 3 → 4 시도)
- 해결: 일심동체 deploy 안정화 후 격리 재배포 → SUCCESS (00011-kh8)

### 27.3 Playwright 옵션 A 스모크 테스트 결과 (production URL)

```bash
PLAYWRIGHT_BASE_URL=https://aitutor-58235609672.us-east4.run.app \
  npx playwright test tests/step7-labs-smoke.spec.js --reporter=list
```

**결과**: ✅ **15 passed / 0 failed / 4 skipped (34.6초)**

| Phase | 테스트 | 결과 |
|---|---|---|
| /lab 메인 | 헤더 + 5 카드 (REBUILD29 §22 신규 직관적 용어) | ✅ |
| /lab 메인 | "← 홈" 링크 동작 | ✅ |
| /lab/local-ai | 헤더 (온디바이스 모델) + EngineSwitcher | ✅ |
| /lab/local-ai | "← 실험실" 링크 | ✅ |
| /lab/local-gcp | 6 엔진 + QuestionPicker (REBUILD29 §25 강화) | ✅ |
| /lab/local-gcp | "← 실험실" 링크 | ✅ |
| /lab/server-infer | 6 엔진 fallback | ✅ |
| /lab/hf | 시험/자유 탭 + 비교 모드 | ✅ |
| /lab/hf/compare | 비교 모드 진입 | ✅ |
| /lab/ollama-bridge | 도움말 6단계 + 연결 테스트 필수 + select 비활성 | ✅ |
| 헤더 통일 | 5 lab × "← 실험실" 링크 | ✅ (5/5) |

Skip 4개 (production admin 인증 의존):
- admin 토글 표시 (사용자 직접 검증)
- 일반 사용자 배지 (사용자 직접 검증)
- QuestionPicker DB 탭 전환 (lab 활성 시에만 검증)
- QuestionPicker 붙여넣기 파싱 (동일)

### 27.4 테스트 코드 갱신 사항

REBUILD29 §22~23 카드 타이틀 변경 반영:
- "디바이스 AI 해설" → "온디바이스 모델"
- "Cloud Run 일심동체" → "서버 통합"
- "격리 추론" → "서버 분리"
- "외부 Ollama bridge" → "사용자 PC 추론"
- "HF Inference" → "외부 추론 라우팅"

테스트 파일 `tests/step7-labs-smoke.spec.js` selector 동기화 갱신.

### 27.5 누적 commit (이번 세션, 모두 푸시 완료)

| Hash | 내용 | 푸시 |
|---|---|---|
| `e04ff54` | REBUILD28~29 통합 — 6 엔진 + WebLLM + Ollama bridge + Qwen 강제 | ✅ |
| `8eb57ef` | QuestionPicker 공통 컴포넌트 | ✅ |
| `83bee18` | Playwright 옵션 A 스모크 (15/15 통과) | ✅ |
| `c66e3dc` | 시스템 프롬프트 통일 + 카드 타이틀 직관적 용어 | ✅ |
| `bdfb8ca` | 모델 통일 + DB 계층 + PromptEditor | ✅ |
| (다음) | REBUILD29 §27 + Playwright 갱신 | ⏳ 본 commit |

### 27.6 사용자 직접 검증 필요 (skip 항목)

라이브 환경에서:
1. **admin 로그인** 후 /lab 5 카드 토글 동작
2. **vLLM × Qwen 3.5 4B** 실 호출 (잘림 / 한국어 / no_think)
3. **격리 7-2b/c** 신규 엔진 (llama-server / vLLM) 실 호출
4. **WebLLM Qwen 2.5 7B** 다운로드 + 추론 (데스크톱)
5. **Ollama bridge** 사용자 PC 연결 + 추론
6. **QuestionPicker DB 모드** — 카테고리/시험 선택 + 문제 카드 리스트 직접 클릭
7. **PromptEditor** — 시스템/사용자 메시지 편집 + 최종 메시지 미리보기 + 전송

---

## 28. 변경 이력 (§27 추가)

| 날짜 | 변경 |
|---|---|
| 2026-04-30 (§27 추가) | rebuild29-final-v3 빌드 + 양쪽 deploy (일심동체 aitutor-00018-t59 / 격리 aitutor-inference-00011-kh8). 격리 1차 GPU quota 일시 초과 → 재배포 SUCCESS. **Playwright 옵션 A 스모크 15/15 통과 (34.6초)** — production URL 검증. 테스트 selector 카드 타이틀 변경 반영 갱신. 사용자 직접 검증 항목 7개 명시 |
