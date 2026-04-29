# REBUILD24 — 실험실 5개 GCP 마이그 깊이 분석 + 제안

> 작성: 2026-04-29
> 목적: 1차 마이그 (REBUILD23 Phase 1~4) 후, **실험실 5개의 컨셉 보존 / 컨셉 복원 / GCP native 활용 / 폐기** 4가지 path 의 트레이드오프를 코드베이스 정밀 분석을 토대로 평가
> 사용자 결정 (2026-04-29): "실험실 기능 GCP 마이그 완료되면 즉시 삭제 예정" — 본 문서는 폐기 직전 학습 가치 추출 + 잠재적 prod 승격 검토 동시 진행

---

## 1. 작업 컨텍스트

### 1.1 1차 마이그 (REBUILD23) 결과
- 실험실 5개 모두 **라우팅 측면**에서 GCP 로 마이그 완료 (Cloud Run 단일 컨테이너)
- 그러나 일부 실험실은 **컨셉이 변형** — 특히 `server-ai` (ONNX → GGUF/Ollama 매핑)
- 1차 마이그는 "동작 보장" 에 우선순위, 컨셉 보존은 부분적

### 1.2 사용자 결정 — "마이그 완료 후 폐기"
폐기 의도와 충돌하지 않게 다음을 본 문서에서 검토:
- **A. 폐기 전 학습 가치 추출** — 어떤 실험 결과가 prod (메인 기능) 에 반영 가능?
- **B. 잠재적 prod 승격** — 일부 실험실은 메인 기능보다 가치 클 수 있음
- **C. 폐기 시 정확한 영향** — 코드 / DB / API / 운영 부담 정량화

### 1.3 본 문서의 출력
1. 실험실별 컨셉 + 현재 구현 + 1차 마이그 상태 + 4 path 비교
2. GCP native 활용 깊이 제안 (Vertex AI / Cloud Functions / GKE / Filestore)
3. 폐기 영향 정량화 (코드 라인 수 + DB 토글 + API 라우트)
4. 통합 추천 — 사용자 결정에 맞는 우선순위 path

---

## 2. 실험실 5개 한눈에 보기

| 실험실 | 컨셉 | 백엔드 (1차 마이그 후) | 현재 동작 상태 | 핵심 의존성 |
|---|---|---|---|---|
| `hf-playground` (`/lab/hf`, `/lab/hf/compare`) | **외부 HF Inference Providers 비교** (14 providers, 122 models) | 외부 (`/api/hf` → router.huggingface.co) | ✅ 변경 0, 정상 작동 | `HF_API_KEY`, `/api/hf-models` 카탈로그 (1h 캐시) |
| `local-ai` (`/lab/local-ai`) | **디바이스 AI** — 브라우저 WebGPU 추론 (오프라인) | 클라이언트 자체 (Transformers.js + WebGPU) | ✅ 변경 0, WebGPU 가능 device 만 | HF 의 ONNX 변환 모델 직접 다운로드 (CDN) |
| `local-gcp` (`/lab/local-gcp`, 구 `local-lambda`) | **일심동체** — 앱+모델 같은 컨테이너, 외부 API 0 | Cloud Run 내부 Ollama daemon | 🚧 GPU quota 대기 (CPU 모드 가능, 매우 느림) | Ollama, 모델 lazy pull |
| `server-ai` (`/lab/server-ai`) | **서버 ONNX 추론** — Python onnxruntime-genai 별도 service | 같은 Cloud Run 컨테이너 → Ollama 매핑 | ⚠ **컨셉 변형** (ONNX → GGUF) | 동일 (Ollama) |
| `server-ai-gguf` (`/lab/server-ai-gguf`) | **서버 GGUF 추론** — llama-cpp-python 별도 service | 같은 Cloud Run 컨테이너 → Ollama 매핑 | ✅ 컨셉 일치 (둘 다 GGUF) | 동일 (Ollama) |

---

## 3. 실험실별 정밀 분석

### 3.1 hf-playground

#### 3.1.1 코드베이스 구성 (총 12 파일)
```
src/labs/hf-playground/
├── index.jsx                  — DB 토글 가드 (lab_hf_enabled) + admin 가드
├── HfPlayground.jsx           — 단일 모드 (520 라인) ⭐ 메인
├── HfCompare.jsx              — 비교 모드 (578 라인) ⭐ 독창적 가치
├── CompareIndex.jsx           — 비교 모드 진입점
├── components/
│   ├── ModelCatalog.jsx       — 카탈로그 UI (122 모델)
│   ├── ModelPicker.jsx        — 단일 선택 widget
│   ├── PromptArea.jsx         — 프롬프트 입력 영역
│   ├── ResponseView.jsx       — 응답 표시
│   └── MetricsBadge.jsx       — TTFT/지연/비용 메트릭
├── lib/
│   ├── hfClient.js            — /api/hf SSE 파싱 (109 라인)
│   ├── models.js              — PROMPT_PRESETS, calcCost, fmtCtx, fmtPrice
│   └── comparePresets.js      — COMPARE_PRESETS (사전 정의 비교 그룹)
```

백엔드:
```
api/hf.js                    — HF API 프록시 + SSE 스트리밍 + usage-log
api/hf-models.js             — /v1/models 동적 fetch (1h 메모리 캐시)
api/_llm/hf-chat.js          — chatStream 헬퍼
api/_runtime/hf-catalog.js   — getAllowedIds() 화이트리스트
```

#### 3.1.2 컨셉
- **HF Inference Providers** = HuggingFace 가 14개 provider (Together, SambaNova, Groq, Novita, Cerebras, Fal, Hyperbolic 등) 를 자동 라우팅
- 같은 모델을 여러 provider 가 호스팅 → router 가 가용/속도/비용 기반 선택
- **122개 router live 모델** (Llama 3.3, Qwen 3, DeepSeek R1, Gemma 4, Mistral 등)
- 카탈로그 1h 캐시 → 클라이언트 부담 ↓
- 비교 모드: **2~6개 모델 동시 병렬 호출** (Promise.allSettled) + **자동 분석** (TTFT/지연/비용/정답 일치)

#### 3.1.3 1차 마이그 (REBUILD23) 상태
- ✅ 코드 변경 0
- ✅ Cloud Run 에서 정상 작동
- 외부 API 사용 (`router.huggingface.co/v1`) — GCP region 영향 미미

#### 3.1.4 4 path 비교

| Path | 작업 | 가치 | 비용 | 추천도 |
|---|---|---|---|---|
| **A. 현 상태 유지 + 폐기** | 0 | 학습 데이터 (122 모델 비교 결과) 추출 후 폐기 | $0 | ⭐⭐⭐ |
| **B. 컨셉 보존 (현 상태 영구 유지)** | 0 | HF 의존 지속 | 사용량 기반 | ⭐⭐ |
| **C. GCP native 추가 (Vertex AI Model Garden 통합)** | ~3일 | Gemini Pro/Flash, PaLM, Codey 등 GCP 호스팅 모델 추가 비교 → 한국 사용자 latency ↓, GCP credit 활용 | ~$10/월 GPU off-peak | ⭐⭐⭐ (잠재 prod 승격 가치) |
| **D. prod 승격 — AI 해설 시스템 통합** | ~5일 | 비교 모드의 "정답 일치 자동 분석" 기능을 메인 AI 해설 품질 검증에 활용 | 0 | ⭐⭐⭐ (가장 가치 큼) |

#### 3.1.5 폐기 영향 (Path A)
- 코드 12 파일 + 라인 수 약 1500 줄
- DB 토글: `lab_hf_enabled`
- API 라우트: `/api/hf`, `/api/hf-models`, `api/_runtime/hf-catalog.js`, `api/_llm/hf-chat.js`
- ⚠ **메인 기능 의존 점검 필요**: `api/hf.js` 가 다른 비-실험실 기능에서도 호출되는지 (예: 일반 AI 해설). 확인 결과 — `/api/hf.js` 의 `ALLOWED_ACTIONS = ['lab_hf_chat', 'card_explain', 'kisa_explain', 'kisa_grade']` — **메인 기능 (card_explain, kisa_explain, kisa_grade) 도 `/api/hf` 를 사용**. 따라서 `api/hf.js` 본체는 **폐기 X**, 실험실 UI 만 폐기.

#### 3.1.6 추출 가능 학습 데이터
- 122 모델 × N 호출 × 정답 일치율 (시험 모드)
- → "어떤 모델이 한국 자격증 시험 해설에 가장 정확한가" 데이터 → **메인 기능의 default 모델 선택 기준**
- 폐기 전 1~2주 dry-run 으로 데이터 수집 권장

---

### 3.2 local-ai

#### 3.2.1 코드베이스 구성 (총 12 파일)
```
src/labs/local-ai/
├── index.jsx                       — DB 토글 가드 (lab_local_ai_enabled)
├── LocalAiExplanation.jsx         — 메인 (~400 라인)
├── components/
│   ├── ModelManagerPanel.jsx       — 모델 다운로드 / 삭제 / 캐시 상태
│   ├── MemoryHelpCard.jsx          — 메모리 부족 시 안내
│   ├── ModelDownloadCard.jsx       — 다운로드 진행률 + 모델 카탈로그
│   ├── MemoryStatus.jsx            — 메모리 적합성 표시
│   └── DeviceCheckBadge.jsx        — WebGPU 지원 확인
└── lib/
    ├── prompts.js                  — buildMessages
    ├── wakeLock.js                 — 다운로드 중 화면 OFF 방지 (Wake Lock API)
    ├── deviceCheck.js              — WebGPU 어댑터 + RAM 추정
    ├── memoryFit.js                — 모델 + 시스템 메모리 적합성 검사
    ├── modelCache.js               — IndexedDB 캐시 관리
    └── inference.js                — Transformers.js + WebGPU pipeline (~300 라인) ⭐ 핵심
```

#### 3.2.2 컨셉
- **디바이스 AI** = 브라우저에서 직접 추론 (서버 호출 0, 오프라인 가능)
- **WebGPU 필수** (Chrome/Edge 87+ 데스크탑, 모바일 일부)
- **모델 카탈로그** (5개):
  - Gemma 4 E2B (3.2GB)
  - Gemma 4 E4B (4.9GB) ← 한국어 OK + 멀티모달
  - Qwen 3.5 0.8B (0.6GB) ← 가장 작음
  - Qwen 3.5 2B (1.6GB) ← 한국어 강세
  - Qwen 3.5 4B (2.5GB) ← 양자화 최적화
- **q4f16 quantization** 필수 (메모리 fit)
- **다운로드 + 캐싱** = HF CDN 에서 첫 1회만, 그 후 IndexedDB 영구 저장
- **wakeLock + beforeunload + popstate guard** = 다운로드 중 페이지 이탈 방지 (UX 매우 신경 쓴 흔적)

#### 3.2.3 1차 마이그 (REBUILD23) 상태
- ✅ 코드 변경 0 — 클라이언트 전용
- ✅ 모든 사용자 디바이스에서 동일 작동
- 백엔드 의존 거의 0 (`/api/usage-log` 호출만)

#### 3.2.4 4 path 비교

| Path | 작업 | 가치 | 비용 | 추천도 |
|---|---|---|---|---|
| **A. 현 상태 유지 + 폐기** | 0 | 5개 모델 다운로드 가능자 통계만 추출 | $0 | ⭐⭐ |
| **B. 컨셉 보존 (영구 유지)** | 0 | "오프라인 학습" 가치 살아있음 — 한국 통신 환경 좋아 큰 효용 X | $0 | ⭐ |
| **C. GCP native — 모델 호스팅 위치 변경 (HF CDN → GCS public bucket)** | ~1일 | 한국 사용자 다운로드 latency 50% ↓ (GCS Seoul 가까움), HF 의존도 ↓ | $1/월 (GCS storage 12GB × $0.02) | ⭐⭐⭐ |
| **D. prod 승격 — Capacitor 모바일 앱 oncloud 모드** | ~2주 | 모바일 앱이 오프라인에서도 자격증 해설 가능 → 시장 차별화 | 0 (이미 인프라 있음) | ⭐⭐⭐ (가장 가치 큼, 단 WebGPU 모바일 지원이 제한적이라 모바일은 어려움) |

#### 3.2.5 GCP native 추가 활용 — 모델 호스팅 (Path C 상세)
```
현재: https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX 에서 직접 다운로드
변경: https://storage.googleapis.com/aitutor-models-public/gemma-4-E2B-it-ONNX/* 로 미러
```

작업:
1. GCS 버킷 `aitutor-models-public` (asia-northeast3, public read) 생성
2. HF 모델 5종 mirror 다운로드 (12GB)
3. `src/labs/local-ai/lib/inference.js` 의 model_id 매핑 변경
4. CORS 설정 (anonymous read)

이점:
- 한국 사용자 다운로드 latency: HF (CloudFront) ~30s/GB → GCS Seoul ~10s/GB
- HF 의존도 ↓ (HF 다운 시에도 작동)
- 사용량 추적 (GCS access log)

#### 3.2.6 폐기 영향 (Path A)
- 코드 12 파일 + 라인 수 약 1500 줄
- DB 토글: `lab_local_ai_enabled`
- API 라우트 영향: 없음 (클라이언트 전용)
- 의존 패키지: `@huggingface/transformers`, `@mediapipe/tasks-genai` (다른 곳에서 안 쓰면 함께 제거 가능 — `package.json` 약 50MB ↓)

---

### 3.3 local-gcp (구 local-lambda) ⭐ 1차 마이그 핵심

#### 3.3.1 코드베이스 구성 (총 2 파일)
```
src/labs/local-gcp/
├── index.jsx                — DB 토글 가드 (lab_local_lambda_enabled — 호환성 유지)
└── LocalGcpTester.jsx       — 메인 (~330 라인) — 엔진 드롭다운 + 모델 카드
```

백엔드:
```
api/local-infer.js           — 엔진 분기 (Ollama/llama-cpp/vLLM) ⭐ 1차 마이그 신규
```

#### 3.3.2 컨셉
- **일심동체** = 앱 + 모델이 같은 컨테이너 (외부 API 0)
- **엔진 교체 가능**: Ollama (active) / llama.cpp (planned) / vLLM (planned)
- **모델 4종**: Qwen 3 4B / 1.7B, Gemma 3n E2B / E4B
- 첫 호출 ~30~60s (Cloud Run 인스턴스 spawn + GPU mount + 모델 lazy pull)
- 이후 호출 warm (~수 초)

#### 3.3.3 1차 마이그 (REBUILD23) 상태
- ✅ Lambda → Cloud Run 마이그 완료
- ✅ node-llama-cpp 직접 호출 → Ollama daemon HTTP fetch
- 🚧 GPU L4 quota 대기 중 (CPU 모드 → 추론 매우 느림 ~분 단위)
- 🚧 llama.cpp + vLLM = Phase 5 예정 (multi-stage devel base 필요 — runtime base 에 nvcc 없음)

#### 3.3.4 4 path 비교

| Path | 작업 | 가치 | 비용 | 추천도 |
|---|---|---|---|---|
| **A. 현 상태 유지 + 폐기** | 0 | "Cloud Run 일심동체 가능성" 검증 가치 | $0 | ⭐ (검증 가치 살리려면 1주일 사용 후 폐기) |
| **B. GPU + Phase 5 완성** | ~3일 | 1) GPU L4 추가 (quota 승인 후 1분), 2) multi-stage devel 추가 → llama.cpp + vLLM 활성, 3) Ollama vs llama.cpp vs vLLM 성능 비교 | $0~10/월 (GPU 사용량 기반) | ⭐⭐⭐ |
| **C. GCP native — 모델 GCS 영구 저장 + Cloud Run 시작 시 mount** | ~2일 | 콜드 스타트 60s → 10s 단축. 인스턴스 idle 종료 후에도 모델 다시 다운로드 X | $1/월 (모델 ~16GB GCS 저장) | ⭐⭐⭐ |
| **D. prod 승격 — 메인 AI 해설 시스템 통합 (외부 API 비용 0)** | ~5일 | HF/OpenAI/Gemini 호출을 일심동체로 대체 → 월 외부 API 비용 0. 단점: 한국 사용자 latency 미국 region (us-central1) | $5~20/월 GPU 사용량 vs $20~50/월 외부 API | ⭐⭐ (트레이드오프) |

#### 3.3.5 GCP native 추가 활용 (Path B + C)

**Path B (Phase 5 완성)**:
```dockerfile
# multi-stage devel — llama.cpp 빌드 + vLLM 추가
FROM nvidia/cuda:12.4.0-devel-ubuntu22.04 AS llamacpp-builder
RUN apt-get update && apt-get install -y build-essential cmake git
RUN git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /opt/llama.cpp
WORKDIR /opt/llama.cpp
RUN cmake -B build -DGGML_CUDA=ON -DLLAMA_BUILD_TESTS=OFF \
    && cmake --build build --target llama-server -j

FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime
# ... (현재 Dockerfile)
COPY --from=llamacpp-builder /opt/llama.cpp/build/bin/llama-server /usr/local/bin/

# vLLM (Python pip install)
RUN pip3 install vllm==0.7.0
```

**Path C (GCS 영구 저장)**:
```bash
# 시작 시 GCS → /var/ollama/models 동기화
gsutil -m rsync -r gs://aitutor-models-private/ollama-models /var/ollama/models
```

`start.sh` 에 추가:
```bash
# 모델 사전 다운로드 (Cloud Run startup phase)
if [ -d /var/ollama/models/.complete ]; then
  echo "[start.sh] 모델 캐시 hit"
else
  gsutil -m rsync -r gs://aitutor-models-private/ollama-models /var/ollama/models/
  touch /var/ollama/models/.complete
fi
```

#### 3.3.6 폐기 영향
- 코드 2 파일 + api/local-infer.js (1차 마이그 신규)
- DB 토글: `lab_local_lambda_enabled` (호환성 유지)
- Dockerfile 의 Ollama 설치 부분 (~10 라인) 제거 가능 (메인 앱이 Ollama 안 쓰면)

---

### 3.4 server-ai (서버 ONNX 컨셉)

#### 3.4.1 코드베이스 구성 (총 3 파일)
```
src/labs/server-ai/
├── index.jsx                — DB 토글 가드 (lab_server_ai_enabled)
├── ServerAiTester.jsx       — 메인 (~250 라인) — modelKey: e2b/e4b/qwen35-4b
└── lib/serverInfer.js       — /api/server-infer/{modelKey} SSE 호출
```

백엔드:
```
api/server-infer.js          — 1차 마이그 후: SigV4 invokeLambda → localhost:11434 Ollama
```

#### 3.4.2 컨셉 (원본)
- **서버 ONNX 추론** = Python `onnxruntime-genai` 별도 inference Lambda
- 모델: Gemma 4 E2B/E4B, Qwen 3.5 4B (ONNX 변환본)
- 별도 ECR 저장소 + 별도 Lambda 함수 (per model)
- AWS S3 모델 버킷에서 Lambda 시작 시 다운로드

#### 3.4.3 1차 마이그 (REBUILD23) 상태 — ⚠ 컨셉 변형
**문제**: 1차 마이그 시 model_key (e2b/e4b/qwen35-4b) 를 모두 Ollama (GGUF) 로 매핑함. 즉:
- 원래: `e2b` = Gemma 4 E2B ONNX
- 현재: `e2b` = `gemma3n:e2b` (Ollama 의 Gemma 3n GGUF)

→ **추론 결과가 다를 수 있음** (ONNX vs GGUF, Gemma 4 vs Gemma 3n).

또한 "서버" vs "일심동체" 의 구분이 흐려짐 — 둘 다 같은 Cloud Run 컨테이너 내부.

#### 3.4.4 4 path 비교

| Path | 작업 | 컨셉 보존도 | 비용 | 추천도 |
|---|---|---|---|---|
| **A. 현 상태 (Ollama 매핑) + 폐기** | 0 | ❌ 변형 | $0 | ⭐⭐ (사용자 결정 따름) |
| **B. 컨셉 복원 — Vertex AI Endpoints (별도 ONNX 서비스)** | ~5일 | ✅ 100% | $50~100/월 (Vertex Endpoint min 1 instance 가동) | ⭐ (사용량 적은 시나리오엔 비효율) |
| **C. 컨셉 복원 — Cloud Run 별도 service (Python onnxruntime-genai)** | ~3일 | ✅ 100% | $0 idle (min=0) | ⭐⭐⭐ |
| **D. 폐기 (server-ai-gguf 와 통합 검토)** | 1일 | - | $0 | ⭐⭐⭐ |

#### 3.4.5 GCP native 추가 활용 (Path B/C 상세)

**Path B (Vertex AI Endpoints)**:
- 장점: Google 관리형, GPU/CPU 자동 scale
- 단점: min instance ≥ 1 (idle 비용 ↑), 영상정보관리사 시나리오에 과잉
- 모델: Hugging Face 의 ONNX 모델을 Vertex AI Model Registry 에 import

**Path C (Cloud Run 별도 service)**:
```
Cloud Run service: aitutor-server-onnx (별도)
  - Dockerfile: Python 3.11 + onnxruntime-genai 1.0.5 + transformers
  - 모델: GCS bucket aitutor-models-private/onnx/{e2b,e4b,qwen35-4b}/
  - Endpoint: /infer (POST) — OpenAI 호환 chat/completions
  - 메인 Cloud Run 의 api/server-infer.js 가 이 서비스로 forward
```

비용:
- min=0 → idle 시 $0
- 호출 시 ~$0.002/1k tokens (자체 호스팅)
- GPU 없이 CPU ONNX 추론 → 응답 5~30s (컨테이너 소형)

#### 3.4.6 폐기 영향
- 코드 3 파일 + 라인 수 ~400
- DB 토글: `lab_server_ai_enabled`
- API 라우트: `api/server-infer.js` 의 일부 model_key (e2b/e4b/qwen35-4b)
- ⚠ `api/server-infer.js` 본체는 server-ai-gguf 가 같은 endpoint 쓰므로 함께 결정 필요

---

### 3.5 server-ai-gguf (서버 GGUF 컨셉)

#### 3.5.1 코드베이스 구성 (총 3 파일)
```
src/labs/server-ai-gguf/
├── index.jsx                — DB 토글 가드 (lab_server_ai_gguf_enabled)
├── ServerAiTester.jsx       — 메인 (~250 라인, server-ai 와 거의 동일)
└── lib/serverInfer.js       — server-ai 와 동일 (재사용)
```

#### 3.5.2 컨셉 (원본)
- **서버 GGUF 추론** = Python `llama-cpp-python` 별도 inference Lambda
- 모델: Gemma 4 E2B/E4B GGUF
- 별도 ECR + Lambda

#### 3.5.3 1차 마이그 (REBUILD23) 상태 — ✅ 컨셉 일치
- model_key (e2b-gguf, e4b-gguf) → Ollama 매핑
- **Ollama 자체가 GGUF 기반** (llama.cpp 기반) → 컨셉 100% 일치
- 단, llama-cpp-python (Python 바인딩) vs Ollama (Go 구현체) 의 차이는 있음 (성능 다소 차이)

#### 3.5.4 server-ai 와의 차이
- server-ai (ONNX): Gemma 4 ONNX 변환본 추론
- server-ai-gguf (GGUF): Gemma 4 GGUF 변환본 추론
- 같은 모델 다른 포맷 = 같은 답변, 다른 속도/메모리

#### 3.5.5 4 path 비교

| Path | 작업 | 가치 | 비용 | 추천도 |
|---|---|---|---|---|
| **A. 현 상태 (Ollama 매핑) + 폐기** | 0 | 컨셉 일치 → 학습 데이터 의미 있음 | $0 | ⭐⭐⭐ |
| **B. Phase 5 llama.cpp server 추가 → Ollama vs llama.cpp 비교** | ~2일 | 동일 모델 다른 엔진 성능 비교 데이터 | $0 | ⭐⭐⭐ |
| **C. 폐기 (local-gcp 와 중복)** | 1일 | local-gcp 가 같은 백엔드 + 엔진 드롭다운까지 갖춤 → 중복 | $0 | ⭐⭐⭐⭐ |

#### 3.5.6 추천: **C (폐기)** — local-gcp 와 중복
- local-gcp 의 엔진 드롭다운 = Ollama / llama.cpp / vLLM
- server-ai-gguf 의 가치는 local-gcp 가 흡수
- 폐기 명확

---

## 4. GCP native 추가 활용 — 깊이 있는 제안

### 4.1 Vertex AI Model Garden 통합 (hf-playground 확장)

**현재**: HF Inference Providers 14개 → GCP 사용자에게 외부 API
**제안**: + Vertex AI Model Garden (Gemini 1.5 Pro/Flash, PaLM 2, Codey, Imagen)

```js
// src/labs/hf-playground/lib/vertexClient.js (신규)
export async function chatVertex({ model, messages, ... }) {
  const res = await fetch('/api/vertex', { ... });
  // SSE 파싱 (HF 와 동일 형식)
}
```

```js
// api/vertex.js (신규)
const { GoogleGenerativeAI } = require('@google/generative-ai');
// 또는 Vertex AI SDK 직접:
const { VertexAI } = require('@google-cloud/vertexai');
const vertex = new VertexAI({ project: 'aifactory-494108', location: 'us-central1' });
```

**가치**:
- Vertex AI 는 GCP credit / billing 통합 → 비용 통합 관리
- Gemini 1.5 Pro 가 Korean QA 최강 (HF 라우팅 모델보다 우월할 가능성)
- HF + Vertex 비교 데이터 → 메인 기능 default 모델 결정 근거

**작업량**: ~3일
**비용**: Vertex Gemini Flash $0.00015/1k input, $0.0006/1k output. 호출당 ~$0.001 미만.

### 4.2 모델 호스팅 GCS 미러 (local-ai)

§ 3.2.5 참조. 한국 사용자 다운로드 latency 50% 단축.

### 4.3 Cloud Run + Filestore (영구 모델 저장)

**현재**: Cloud Run 의 stateless 컨테이너 → 인스턴스 spawn 시 모델 매번 다운로드
**제안**: Filestore mount → 모델 영구 저장 + 모든 인스턴스 공유

```yaml
# Cloud Run + Filestore (Cloud Run gen2 환경 + VPC connector)
gcloud run services update aitutor \
  --add-volume-mount name=models,mount-path=/var/ollama/models \
  --add-volume name=models,type=nfs,server=10.x.x.x,path=/aitutor-models
```

**가치**:
- 콜드 스타트 60s → 10s
- 첫 호출 후 모델 다운로드 0
**비용**:
- Filestore Basic 1TB = $0.20/GB/월 = ~$3/월 for 16GB
- VPC connector = $9/월 (Cloud Run gen2 직접 VPC 가능)

**현 시나리오엔 과잉** — 호출 빈도 낮아서 콜드 스타트 60s 수용 가능.

### 4.4 Cloud Run 별도 서비스 분리 (server-ai 컨셉 복원)

§ 3.4.5 Path C 참조. 별도 Cloud Run service `aitutor-server-onnx` 생성.

---

## 5. 폐기 시 영향 정량화

### 5.1 코드 라인 수

| 실험실 | 파일 수 | 라인 수 (추정) | 의존 패키지 |
|---|---|---|---|
| hf-playground | 12 | ~1500 | (외부 API) |
| local-ai | 12 | ~1500 | `@huggingface/transformers`, `@mediapipe/tasks-genai` |
| local-gcp | 2 | ~330 + 백엔드 200 | (Cloud Run 내부) |
| server-ai | 3 | ~400 | (Cloud Run 내부) |
| server-ai-gguf | 3 | ~250 | (Cloud Run 내부) |
| **합계** | **32** | **~4180** | 50MB+ |

### 5.2 DB 토글 (aitutor_settings 테이블)

```sql
DELETE FROM aitutor_settings WHERE key IN (
  'lab_local_ai_enabled',
  'lab_server_ai_enabled',
  'lab_server_ai_gguf_enabled',
  'lab_hf_enabled',
  'lab_local_lambda_enabled'
);
```

### 5.3 API 라우트 (server.js)

| 라우트 | 폐기? |
|---|---|
| `/api/hf` | ❌ 메인 기능 (card_explain, kisa_explain, kisa_grade) 이 사용 — 유지 |
| `/api/hf-models` | ❌ 동일 (메인이 카탈로그 fetch 가능) — 유지 |
| `/api/local-infer` | ✅ 실험실 전용 — 폐기 가능 |
| `/api/server-infer` | ✅ 실험실 전용 — 폐기 가능 |
| `/api/usage-log` | ❌ 메인도 사용 — 유지 |

### 5.4 신규 GCP 리소스 (1차 마이그 산출물 중 폐기 대상)

| 리소스 | 폐기? |
|---|---|
| Cloud Run 컨테이너 내부 Ollama daemon | ✅ Dockerfile 의 Ollama install RUN block 제거 가능 |
| `/var/ollama/models` | ✅ 사용 안 함 |
| Secret Manager 8개 | ❌ 메인이 사용 — 유지 |
| GCS 버킷 | ❌ 메모 첨부 — 유지 |
| Artifact Registry | ❌ 메인 이미지 저장소 — 유지 |

### 5.5 운영 부담 감소

| 항목 | 폐기 전 | 폐기 후 |
|---|---|---|
| Dockerfile 빌드 시간 | ~10분 | ~3분 (Ollama install 제거) |
| Image 크기 | ~3GB | ~1.5GB |
| Cloud Run 콜드 스타트 | ~30s | ~5s |
| 코드 유지보수 | 32 파일 | 0 파일 |

---

## 6. 통합 추천 path

### 6.1 사용자 결정 (2026-04-29) 이 우선시되는 path

**시나리오 A — 단순 폐기 (사용자 결정 그대로)**:
1. Phase 4 검증 1~2주 (Stage 1 OK + Stage 2 정밀 검증)
2. **그 사이에 hf-playground 비교 모드로 학습 데이터 수집** ← 핵심
3. AWS 폐기 (Phase 6) 와 동시에 실험실 5개 폐기
4. Dockerfile 단순화 (Ollama 제거 → 콜드 스타트 ↓)

타임라인: 1~2주

### 6.2 학습 가치 살리는 권장 path

**시나리오 B — 데이터 추출 후 폐기**:
1. **hf-playground 비교 모드** 1~2주 사용:
   - 122 모델 × 자격증 시험 100문항 = 12,200 회 추론 데이터 수집
   - 정답 일치율 ranking → "한국어 자격증 시험에 가장 정확한 모델 5개" 도출
2. 도출된 5개 모델을 메인 AI 해설 기능의 default 모델로 채택
3. 그 후 실험실 5개 폐기
4. **Vertex AI Model Garden 통합** (선택) — Gemini Flash 가 ranking 1위면 메인 default 로

타임라인: 2~3주

### 6.3 잠재적 prod 승격 path

**시나리오 C — 일부 실험실 prod 승격**:
1. **hf-playground 비교 모드** 의 "정답 일치 자동 분석" 기능을 메인 AI 해설 품질 검증 대시보드로 승격
2. **local-ai** 의 "오프라인 학습" 기능을 모바일 앱 차별화 feature 로 prod 승격 (Capacitor 모바일 앱)
3. 나머지 실험실 (local-gcp / server-ai / server-ai-gguf) 만 폐기

타임라인: 3~5주

---

## 7. 즉시 실행 가능한 작업 (사용자 결정 후)

### 7.1 시나리오 A 실행 명령

```bash
# 1. 실험실 디렉토리 5개 일괄 삭제
cd /Users/2team/aifac/workspace/aitutor
git rm -rf src/labs/{hf-playground,local-ai,local-gcp,server-ai,server-ai-gguf}

# 2. App.jsx 의 lazy import + Route 정의 삭제 (다음 grep 으로 위치 확인)
grep -n "labs/" src/App.jsx
grep -n "/lab/" src/App.jsx

# 3. 실험실 전용 API 폐기
git rm api/local-infer.js api/server-infer.js

# 4. server.js 의 apiFiles 배열에서 'local-infer', 'server-infer' 제거

# 5. DB 토글 삭제 (Supabase SQL Editor)
# DELETE FROM aitutor_settings WHERE key LIKE 'lab_%';

# 6. admin.js / config.js 의 lab_*_enabled 키 제거

# 7. SettingsTab/index.jsx 의 lab 토글 UI 제거

# 8. Dockerfile 단순화
# - Ollama install RUN 블록 제거
# - OLLAMA_HOST, OLLAMA_MODELS env 제거
# - start.sh 에서 ollama serve 제거 → exec node server.js 만

# 9. start.sh, scripts/migrate-s3-to-gcs.js 도 폐기 가능

# 10. package.json 의존성 정리:
#     - @huggingface/transformers (local-ai 만 사용) 제거
#     - @mediapipe/tasks-genai 제거

# 11. 빌드 + 배포
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_TAG=v$(date +%Y%m%d-%H%M%S) \
  --project=aifactory-494108
```

### 7.2 시나리오 B 데이터 수집 스크립트

```bash
# scripts/collect-hf-comparison.js (신규 작성)
# 122 모델 × 100 문항 × 정답 일치율 자동 측정
node scripts/collect-hf-comparison.js > comparison-2026-04-29.json
```

자세한 구현은 별도 작업.

---

## 8. 사용자 최종 결정 (2026-04-29 오후, 입장 변경)

### 8.1 결정 — 시나리오 D (신규) 채택

본 REBUILD24 분석을 본 후 사용자 입장 변경:
- 이전: "마이그 완료되면 즉시 삭제 예정" (시나리오 A)
- **변경**: **5개 모두 영구 유지 — 컨셉이 다르므로 유지 가치 있음**

### 8.2 시나리오 D — 5개 모두 유지 + 컨셉 차이 보존

| 실험실 | 결정 | 추가 작업 |
|---|---|---|
| `hf-playground` | ✅ 영구 유지 | 없음 (선택: § 4.1 Vertex AI 통합) |
| `local-ai` | ✅ 영구 유지 | 없음 (선택: § 4.2 GCS 미러) |
| `local-gcp` | ✅ 영구 유지 | **Phase 5 — GPU L4 + llama.cpp + vLLM 추가** (multi-stage devel) |
| `server-ai` | ✅ 영구 유지 | **컨셉 복원 — onnxruntime-genai Python 추가** (§ 3.4.5 Path C) |
| `server-ai-gguf` | ✅ 영구 유지 | Phase 5 의 llama.cpp server 활성 시 llama-cpp-python 컨셉 정확도 ↑ (Ollama vs llama.cpp 비교 가능) |

### 8.3 실험실 운영 정책

> 사용자 의도: "실험실에서 충분한 테스트 후 메인 적용"

- 실험실 = **R&D 도구** (영구 운영)
- 메인 AI 해설 = 실험실에서 검증된 모델/엔진만 default 로 promote
- prod 적용은 단계적 (default 모델 점진 확장, 사용자 선택지 점진 추가)

### 8.4 우선순위 추가 작업 (시나리오 D 실행 계획)

#### Priority 1 — server-ai 컨셉 복원 (1~3일)
**현 상태**: e2b/e4b/qwen35-4b → Ollama (GGUF) 매핑 ⚠ 컨셉 변형
**목표**: onnxruntime-genai 로 ONNX 추론 복원

**옵션 A — 같은 Cloud Run 컨테이너에 통합** (권장):
```dockerfile
# 현재 Dockerfile 에 추가:
RUN pip3 install onnxruntime-genai==0.4.0 transformers
```
```bash
# start.sh 에 daemon 추가 (Phase 5 와 함께):
python3 -m onnx_inference_server --port 11437 &
```
```js
// api/server-infer.js — model_key 분기 정책 변경:
//   e2b/e4b/qwen35-4b           → onnxruntime-genai (port 11437)  ← ONNX 컨셉 복원
//   e2b-gguf/e4b-gguf          → llama.cpp server (port 11435)   ← GGUF 컨셉
```

비용 영향: image 크기 +500MB, 메인 앱 startup +5s. 미미.

**옵션 B — 별도 Cloud Run service** (`aitutor-server-onnx`):
- 장점: 격리, 독립 scale
- 단점: 별도 service 관리 (배포 / 모니터링 분리)
- min=0 → idle 비용 0

#### Priority 2 — local-gcp Phase 5 (2~3일)
- multi-stage devel base 추가 (llama.cpp 빌드 + vLLM Python install)
- start.sh 에 llama.cpp server (11435) + vLLM (11436) lazy daemon 추가
- api/local-infer.js 의 'planned' 엔진을 'active' 로 전환
- **GPU L4 활성** (quota 승인 후 1분 명령)

#### Priority 3 — 실험실 학습 데이터 수집 자동화 (1~2일, 선택)
`hf-playground` 비교 모드를 자동 실행하는 스크립트:
```bash
# scripts/collect-lab-comparison.js
# 122 HF 모델 + 4 GCP 모델 (local-gcp) + 3 server-ai (ONNX) + 2 server-ai-gguf
# × 자격증 시험 100문항
# = 정답 일치율 ranking → 메인 default 모델 데이터 기반 결정
```

#### Priority 4 — GCP native 추가 활용 (선택, 후순위)
- § 4.1 Vertex AI Model Garden 통합 (Gemini / PaLM 추가 비교)
- § 4.2 local-ai 모델 GCS 미러 (한국 latency ↓)
- § 4.3 Cloud Run + Filestore (영구 모델 저장, 콜드 스타트 ↓)

### 8.5 우선순위 권고 — 사용자 결정 받을 사항

질문 1: **server-ai 컨셉 복원** 우선순위?
- 옵션 A (같은 Cloud Run 컨테이너 + onnxruntime-genai) — 빠름, 권장
- 옵션 B (별도 Cloud Run service) — 격리적
- 옵션 C (당분간 Ollama 매핑 유지) — server-ai 라벨만 유지, 컨셉은 Ollama

질문 2: **local-gcp Phase 5 (llama.cpp + vLLM 추가)** 시점?
- 즉시 (2~3일)
- GPU quota 승인 후
- 첫 사용자 검증 1~2주 후

질문 3: **자동 데이터 수집 스크립트** (Priority 3) 작성 필요?
- Yes → 1~2일 작업으로 메인 default 모델 결정 근거 확보
- No → 사용자가 수동으로 비교 모드 사용

---

## 9. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-29 | REBUILD24.md 최초 작성 — 실험실 5개 정밀 분석 + 4 path 비교 + 폐기 영향 정량화 + GCP native 활용 제안 + 시나리오 A/B/C 추천 |
| 2026-04-29 (오후) | **사용자 입장 변경** — "즉시 삭제 예정" → **5개 모두 영구 유지 (컨셉이 다르므로 유지 가치 있음)**. § 8 권장 결정 → 시나리오 D 채택 (5개 모두 유지 + 컨셉 차이 보존). Priority 1~4 추가 작업 정의: ① server-ai ONNX 컨셉 복원 (onnxruntime-genai), ② local-gcp Phase 5 (llama.cpp + vLLM), ③ 학습 데이터 자동 수집, ④ GCP native 추가 활용 (Vertex AI / GCS 미러 / Filestore). |
