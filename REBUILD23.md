# REBUILD23 — AWS → GCP 마이그레이션 계획 (Cloud Run + GPU 일심동체)

> 작성: 2026-04-29
> 목적: AWS Lambda 의 본질적 한계 (504 timeout / vCPU / GGUF 호환) 를 우회해 일심동체 + 외부 API 0 + Gemma 4 자유 사용 구조로 전환

---

## 0. TL;DR

### 0.1 사용자 확정 결정 (2026-04-29)

| # | 항목 | **확정** |
|---|---|---|
| 1 | **마이그 진행 / 보류** | ✅ **진행** |
| 2 | **리전** | ✅ **asia-northeast3 (서울)** |
| 3 | **GPU** | ✅ **활성** — 단 사용량 기반 (idle = 0원). GPU 켜고 끄기는 인스턴스 idle 자동 |
| 4 | **추론 엔진** | ✅ **교체 가능 구조** — 실험실에 Ollama / llama-cpp / vLLM 비교 모드 |
| 5 | **DB** | ✅ Supabase **유지** (마이그 X) |
| 6 | **도메인** | ✅ **Cloud Run 제공 도메인** (`*.run.app`) — Custom domain 없음 |
| 7 | **AWS 폐기** | ✅ GCP 완전 이전 + 안정 검증 후 **전체 제거** |
| 8 | **마이그 방식** | 점진 (AWS/GCP 병렬) — 단, 도메인 전환은 *.run.app 으로 직접 |
| 9 | **타임라인** | Phase 0~6, 총 4~6 working day |
| 10 | **롤백 트리거** | Cloud Run 응답률 99% 미만 또는 한국어 추론 품질 저하 |

### 0.2 GPU 비용 명확화 (사용자 질문 반영)

> "GPU 옵션으로 가능한지 활성화 비활성화 이런식으로 고정비용이면 비용검토 필요"

**답: Cloud Run GPU 는 고정 비용 X. 사용량 기반 (idle = 0원).**

```
[Cloud Run service: GPU 활성화 설정]
  min-instances = 0 (필수 설정)
  ↓
[idle 상태]
  → 인스턴스 0개 → GPU 0개 → 비용 0원
  ↓
[사용자가 호출 시]
  → 인스턴스 1개 spawn (GPU 1개 attach)
  → 콜드 스타트 10~30초
  → 추론 진행 (GPU 활용)
  ↓
[5분 idle 후]
  → 인스턴스 자동 종료 → GPU 반환 → 비용 0원
```

→ "GPU 활성화/비활성화" 토글 = **인스턴스 idle 상태로 자동 관리**. 사용자가 호출하지 않으면 비용 0. 따라서 별도 ON/OFF 스위치 UI 필요 없음.

비용 시뮬레이션 (영상정보관리사 2인, 가끔 호출):
- 월 50회 GPU 추론 × 평균 8초 = 400 GPU-second
- L4 GPU 단가 ~$0.0007/sec → **$0.28/월**
- + vCPU/메모리 + 일반 API + 기타 = **총 ~$3~5/월**

→ AWS 현재 비용 (~$5/월) 과 거의 동일.

### 0.3 추론 엔진 교체 가능 구조 (사용자 요청 반영)

> "추론엔진도 교체 가능한 구조로 실험실에 구현"

**구조**:
```
한 Cloud Run 컨테이너 안에 3개 엔진 동시 설치:
  ① Ollama daemon (port 11434)        — 가장 단순 / 안정
  ② llama.cpp server (port 11435)     — GGUF 직접 / source build
  ③ vLLM server (port 11436)          — 가장 빠름 / GPU PagedAttention

  Express server (port 8080)
   └─ /api/local-infer (engine_key 분기)
       case 'ollama'   → fetch http://localhost:11434/api/chat
       case 'llama-cpp'→ fetch http://localhost:11435/completion
       case 'vllm'     → fetch http://localhost:11436/v1/chat/completions
```

UI (`/lab/local-lambda` 페이지 GCP 마이그 후 → `/lab/local-gcp`):
- 모델 드롭다운 (Gemma 4 / Qwen 3 / Llama 3.3 등)
- **엔진 드롭다운** (Ollama / llama-cpp / vLLM)
- 같은 모델 × 다른 엔진 비교 가능

자세한 구조: § 3.4 참조.

### 0.4 핵심 효과

| 항목 | AWS 현재 | GCP 전환 후 | Δ |
|---|---|---|---|
| 504 Gateway Timeout | 발생 (CloudFront 60s + Lambda BUFFERED) | **사라짐** (Cloud Run 60min, streaming 가능) | ✅ |
| Gemma 4 / 신모델 | ❌ node-llama-cpp 미지원 | ✅ **vLLM / source build 자유** | ✅ |
| GPU 추론 | ❌ Lambda GPU 없음 | ✅ L4 24GB | ✅ |
| 메모리 한도 | 3008MB (계정 quota) | 32GB | ✅ |
| 콜드 스타트 (warm 시) | 5~15s | 1~3s | ✅ |
| 사용량 적을 때 비용 | $5/월 | $3~5/월 | ✅ 약간 ↓ |
| 운영 부담 | Lambda + ALB + CloudFront 3중 관리 | Cloud Run 1개 | ✅ |
| 외부 API 0 | ✅ | ✅ | = |
| 학습 곡선 | (이미 익숙) | 4~6h 셋업 | -1 |

### 핵심 효과

| 항목 | AWS 현재 | GCP 전환 후 | Δ |
|---|---|---|---|
| 504 Gateway Timeout | 발생 (CloudFront 60s + Lambda BUFFERED) | **사라짐** (Cloud Run 60min, streaming 가능) | ✅ |
| Gemma 4 / 신모델 | ❌ node-llama-cpp 미지원 | ✅ **vLLM / source build 자유** | ✅ |
| GPU 추론 | ❌ Lambda GPU 없음 | ✅ L4 24GB | ✅ |
| 메모리 한도 | 3008MB (계정 quota) | 32GB | ✅ |
| 콜드 스타트 (warm 시) | 5~15s | 1~3s | ✅ |
| 사용량 적을 때 비용 | $5/월 | $5~20/월 | ≈ 동일 |
| 운영 부담 | Lambda + ALB + CloudFront 3중 관리 | Cloud Run 1개 | ✅ |
| 외부 API 0 | ✅ | ✅ | = |
| 학습 곡선 | (이미 익숙) | 4~6h 셋업 | -1 |

→ 단점은 학습 곡선뿐. 모든 기능 항목에서 우위.

---

## 1. 배경 — AWS 에서 만난 본질적 한계

### 1.1 504 Gateway Timeout (REBUILD22 §13)

```
[브라우저] → [CloudFront] → [ALB] → [Lambda(serverless-express, BUFFERED)]
              ↑ 60s timeout (계정 quota hard limit)
```

- `serverless-express` = BUFFERED 강제 → res.write 가 메모리 버퍼에만 쌓임
- ALB Lambda target 도 RESPONSE_STREAM 미지원
- → CloudFront 60s 안에 first byte 못 받으면 504

**우회 시도 결과**:
- 옵션 A (CloudFront quota 60→180s): 외부 대기 (승인 미도착)
- 옵션 P (라우터 Lambda + RESPONSE_STREAM + OAC): SigV4 mismatch 미해결 (계정 SCP 의심)
- 옵션 C (NONE 인증 Function URL 직접): 계정 SCP 가 NONE 차단

### 1.2 Lambda 일심동체 한계 (REBUILD22 §x — Phase 1 통합 시도)

```
시도 결과:
  Lambda + Gemma 4 GGUF: ❌ node-llama-cpp 미지원 (b8390 < b8637)
  Lambda + Qwen 3 4B GGUF: ❌ 60s timeout (CPU 추론 느림)
  Lambda + Qwen 3 1.7B GGUF: ❌ 60s timeout (CPU 추론 자체 느림)
```

근본 원인:
- Lambda 메모리 quota 3008MB → 약 2 vCPU
- node-llama-cpp Q4 CPU 추론: 토큰당 100~500ms
- max_tokens 256 = 25~125초 → 60s timeout 자주 초과

### 1.3 종합 평가

AWS 에서 일심동체 + Gemma 4 + 외부 API 0 의 동시 만족은 **현 계정 제약 (SCP, vCPU quota, OAC SigV4) 하에서 사실상 불가능**.

→ 같은 클라우드 내 다른 서비스로 우회 (EC2) 또는 클라우드 자체 변경 (GCP).

EC2 단독 검토 결과 (REBUILD22 §x):
- ✅ 모든 제약 해결
- ❌ 24h 비용 ($60+/월), idle 시도 과금
- ❌ 운영 부담 (OS 업데이트, monitoring)
- ❌ scale-out 수동

GCP Cloud Run 검토 결과:
- ✅ 모든 제약 해결
- ✅ idle 시 0 (사용량만 과금)
- ✅ HTTPS / scale 자동
- ✅ GPU 옵션
- ❌ GCP 학습 곡선 (4~6h)

→ **GCP Cloud Run + GPU 가 최선**.

---

## 2. GCP 옵션 비교 (4가지)

### 2.1 Cloud Run (GPU 가능) ⭐ 추천

```yaml
서비스: Cloud Run service
컨테이너: Docker image (Dockerfile 그대로, port 8080 listen)
GPU: NVIDIA L4 24GB (선택)
메모리: 최대 32GB
CPU: 최대 8 vCPU
timeout: 최대 60분 (request)
HTTPS: 자동 (*.run.app)
도메인: Custom domain mapping 가능
스케일: min/max instances 설정 (min=0 → idle 비용 0)
과금: vCPU/메모리 + GPU 사용 시간 (millisecond)
```

### 2.2 Compute Engine VM (AWS EC2 대응)

```yaml
서비스: 가상머신 24h 운영
인스턴스 종류:
  CPU: e2-standard-2 (2 vCPU, 8GB) — $60/월
  CPU 강력: n2-standard-4 (4 vCPU, 16GB) — $140/월
  GPU T4: n1-standard-4 + T4 (16GB VRAM) — $300/월
  GPU L4: g2-standard-4 + L4 (24GB VRAM) — $520/월
HTTPS: 직접 (Caddy / nginx)
도메인: Cloud DNS
스케일: 수동 또는 MIG (Managed Instance Group)
```

### 2.3 GKE Autopilot (Kubernetes 관리형)

```yaml
서비스: Kubernetes 클러스터 관리
오버헤드: 작은 워크로드에 비용 비효율
권장: 마이크로서비스 다수일 때만
```

### 2.4 Vertex AI Endpoints

```yaml
서비스: AI 모델 호스팅 전용
GPU: A100 / L4 등
비용: 24h 켜둠 → $500~$2000+/월
권장: 대규모 트래픽 + 단일 모델 24h 서빙
```

### 2.5 결정 매트릭스 (영상정보관리사 시나리오 — 2인, 가끔 호출)

| 항목 | Cloud Run + L4 | GCE g2-standard-4 + L4 | GKE | Vertex AI |
|---|---|---|---|---|
| idle 비용 | $0 ⭐ | $520 | $72+ | $500+ |
| 호출당 비용 | ~$0.0035 | $0 (24h 비용 안에) | - | - |
| GPU | ✅ L4 24GB | ✅ L4 24GB | ✅ | ✅ |
| 운영 부담 | 0 (관리형) | OS 패치 | 큼 | 0 |
| timeout | 60분 | 무제한 | 무제한 | 무제한 |
| 콜드 스타트 (idle 후) | 10~30s | 0 | 0 | 0 |
| 점진 마이그 가능 | ✅ | ✅ | ✅ | ✅ |
| 월 비용 (2인 추정) | **$5~20** | $520 | $200+ | $500+ |

→ **Cloud Run + L4 GPU 가 영상정보관리사 시나리오 최적**.

---

## 3. 추천 구조 — Cloud Run + GPU 정밀 설계

### 3.1 아키텍처 다이어그램

```
┌────────────────────────────────────────────────────────────────┐
│                         사용자 브라우저                         │
└────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  Google Cloud Load Balancer (자동, Cloud Run 내장)              │
│   • 자동 HTTPS / TLS 인증서 자동 갱신                           │
│   • Custom domain 매핑 (aitutor.example.com)                    │
│   • DDoS 보호 (Google Cloud Armor 옵션)                         │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  Cloud Run service: aitutor-app                                 │
│  ─────────────────────────────────────────────                  │
│  Container image (Artifact Registry):                           │
│    asia-northeast3-docker.pkg.dev/.../aitutor-app:latest       │
│                                                                 │
│  Resources:                                                     │
│    CPU: 4 vCPU                                                  │
│    Memory: 16 GB                                                │
│    GPU: 1× NVIDIA L4 (24 GB VRAM) — optional                   │
│    timeout: 600s (10분)                                         │
│    concurrency: 10 (인스턴스 당)                                │
│    min-instances: 0 (idle 시 0 vCPU)                            │
│    max-instances: 5                                             │
│                                                                 │
│  Container:                                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Express server.js (port 8080)                             │ │
│  │   ├─ /api/login, /api/questions, /api/memos, ...           │ │
│  │   ├─ /api/hf (Hugging Face 프록시 — 그대로)                │ │
│  │   ├─ /api/local-infer (vLLM 또는 llama-cpp + GPU)          │ │
│  │   │     └─ 모델: Gemma 4 / Qwen 3 / DeepSeek R1 자유       │ │
│  │   └─ 기타 API                                              │ │
│  │                                                             │ │
│  │  Models:                                                    │ │
│  │   /opt/models/gemma-4-31B-it-Q4_K_M.gguf (~16GB)           │ │
│  │   /opt/models/qwen3-32b-Q4_K_M.gguf (~18GB)                │ │
│  │   ... (24GB VRAM 안에서 1개 hot, 나머지 disk)              │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  외부 의존 (변경 없음 / 최소 변경)                               │
│  ─────────────────────────────────────────────                  │
│  Database: Supabase (그대로 유지) ⭐                            │
│   • DATABASE_URL 환경변수 그대로                                │
│   • 마이그레이션 ZERO                                            │
│                                                                 │
│  AI providers (외부):                                           │
│   • HF Inference Providers (router.huggingface.co)              │
│   • Gemini API / OpenAI API / Claude API                        │
│   • API key 는 Secret Manager 에 저장                           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  GCP 부속 서비스                                                 │
│  ─────────────────────────────────────────────                  │
│  Secret Manager: HF_API_KEY, GEMINI_API_KEY, AUTH_TOKEN_SECRET, │
│                  DATABASE_URL 등 (SSM 대응)                      │
│                                                                 │
│  Artifact Registry: aitutor-app:latest, aitutor-app:sha-xxx     │
│  (ECR 대응, Docker image 저장소)                                │
│                                                                 │
│  Cloud Build: 빌드 자동화 (CodeBuild 대응) — 선택               │
│                                                                 │
│  Cloud Logging + Monitoring: 로그/메트릭 (CloudWatch 대응)       │
│                                                                 │
│  Cloud DNS: 도메인 → Cloud Run 매핑 (Route 53 대응) — 선택      │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 GPU 사용 패턴

Cloud Run GPU 는 **인스턴스 당 1 GPU** 할당 (sharing 없음).

```yaml
스케일링:
  - request 1개 시: 1 인스턴스 (1 GPU) 가동
  - 동시 요청 10개: 1 인스턴스가 처리 (concurrency=10) — GPU 1개 공유
  - 동시 요청 11~50: 2~5 인스턴스 (각자 GPU 1개씩) auto-scale
  - idle 5분 → 인스턴스 종료 → GPU 반환

비용:
  - 사용 안 함: $0
  - 1 분 사용: GPU 시간 1분 + RAM/vCPU 시간 1분 비용
  - 24h 켜둠 (min-instances=1): GPU 24h × $0.7/h ≈ $504/월
  → 영상정보관리사 시나리오는 min-instances=0 이 맞음
```

### 3.3 모델 패킹 전략

Cloud Run 컨테이너 image size 한도: **30 GB** (Cloud Run 자체) / **10 GB** (Artifact Registry layer compressed).

권장 패킹:
- Gemma 4 31B Q4_K_M (~17GB)  — 메인
- Qwen 3 32B Q4_K_M (~18GB)   — 한국어 강
- Llama 3.3 70B Q4_K_M (~40GB) — 너무 큼, 제외
- 작은 비교용: Qwen 3 4B (~2.5GB), Phi 4 mini (~2.5GB)

24GB VRAM 안에서 한 번에 올라갈 수 있는 모델:
- Gemma 4 31B Q4 → fits (16GB)
- Qwen 3 32B Q4 → fits (18GB)
- 두 개 동시 mount: 메모리 부족, swap 필요

추천: **Gemma 4 31B Q4 단일 모델 호스팅** (메인) + 비교용 작은 모델 1~2개.

### 3.4 추론 엔진 선택

| 엔진 | 장점 | 단점 | port |
|---|---|---|---|
| **Ollama** | 가장 단순, OpenAI 호환, 모델 자동 관리 | 약간 느림 (vLLM 대비) | 11434 |
| **llama.cpp server** | GGUF 자유, Gemma 4 지원, source build | 단일 batch만, OpenAI 호환 일부 | 11435 |
| **vLLM** | 가장 빠름 (PagedAttention), 처리량 ↑ | 모델 설정 복잡, GGUF X (HF safetensors) | 11436 |

### 사용자 요청 — 추론 엔진 교체 가능 구조 (실험실)

**한 컨테이너 안에 3개 엔진 동시 설치 + 호출 시 분기**:

```dockerfile
# Dockerfile (Cloud Run + L4 GPU 베이스)
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

# Node.js 22 설치
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs build-essential cmake git python3 python3-pip

# Ollama 설치
RUN curl -fsSL https://ollama.com/install.sh | sh

# llama.cpp source build (Gemma 4 / 최신 모델 지원)
RUN git clone https://github.com/ggml-org/llama.cpp /opt/llama.cpp
WORKDIR /opt/llama.cpp
RUN cmake -B build -DGGML_CUDA=ON && cmake --build build --config Release

# vLLM 설치 (Python)
RUN pip3 install vllm

# 모델 다운로드 (Ollama 가 자동, llama.cpp + vLLM 은 수동)
RUN ollama pull gemma-4:31b-q4_k_m
RUN ollama pull qwen3:32b-q4_k_m

# 앱 코드
WORKDIR /app
COPY . .
RUN npm ci --omit=dev

# 시작 스크립트 — 3 daemon + Express
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 8080
CMD ["/start.sh"]
```

```bash
# start.sh — 3개 엔진 daemon + Express
#!/bin/bash
set -e

# 1. Ollama daemon (port 11434)
OLLAMA_HOST=0.0.0.0:11434 ollama serve &

# 2. llama.cpp server (port 11435) — 사용자 호출 시 lazy 시작 (메모리 절약)
# 또는 시작부터 띄우려면:
# /opt/llama.cpp/build/bin/llama-server -m /opt/models/gemma-4-31B-it-Q4_K_M.gguf \
#   --host 0.0.0.0 --port 11435 -ngl 99 &

# 3. vLLM server (port 11436) — 사용자 호출 시 lazy 시작
# python3 -m vllm.entrypoints.openai.api_server --model ... --port 11436 &

# 4. Express (port 8080)
exec node server.js
```

**api/local-infer.js — 엔진 분기**:
```js
const ENGINE_MAP = {
  'ollama':    { url: 'http://localhost:11434/api/chat',     format: 'ollama' },
  'llama-cpp': { url: 'http://localhost:11435/completion',   format: 'llamacpp' },
  'vllm':      { url: 'http://localhost:11436/v1/chat/completions', format: 'openai' },
};

module.exports = withAuth(async (req, res) => {
  const { engine = 'ollama', model_key, messages, ... } = req.body;
  const eng = ENGINE_MAP[engine];
  if (!eng) return res.status(400).json({ error: 'unknown engine' });

  const upstream = await fetch(eng.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildBody(eng.format, { model_key, messages, ... }),
  });
  // 응답 파싱 + SSE forward (engine 별 format 차이 처리)
});
```

**UI (`/lab/local-gcp` 페이지)**:
- 모델 드롭다운: Gemma 4 / Qwen 3 / Llama 3.3 / DeepSeek R1 등
- **엔진 드롭다운: Ollama / llama-cpp / vLLM**
- 같은 모델 × 다른 엔진 비교 모드 (응답 시간 / 품질 / 메모리 사용량)
- 호출 이력에 engine + model 함께 표시

### Phase 별 엔진 도입

| Phase | 엔진 | 사유 |
|---|---|---|
| MVP (Phase 4) | Ollama 만 | 가장 단순, 시작 안정성 ↑ |
| 실험실 확장 (Phase 5+) | + llama.cpp + vLLM | 비교 모드 활성화 |
| 프로덕션 default | 검증 결과로 결정 | 영상정보관리사 시험 해설에 가장 적합한 엔진 |

---

## 4. AWS → GCP 서비스 매핑

| AWS | GCP | 마이그 작업 |
|---|---|---|
| **Lambda (Container)** | **Cloud Run** | Dockerfile 약간 수정 (port 8080) |
| **ECR** | **Artifact Registry** | image push 위치 변경 |
| **CodeBuild** | **Cloud Build** | buildspec.yml → cloudbuild.yaml |
| **CloudFront** | (Cloud Run 내장 HTTPS) + 선택적 Cloud CDN | 폐기 |
| **ALB** | (Cloud Run 내장 LB) | 폐기 |
| **SSM Parameter Store** | **Secret Manager** | 마이그 (lambda.js → 새 부트스트랩) |
| **CloudWatch Logs** | **Cloud Logging** | 자동 (코드 변경 0) |
| **CloudWatch Metrics** | **Cloud Monitoring** | 자동 |
| **IAM** | **IAM (GCP)** | 신규 — Cloud Run service account |
| **VPC** | **VPC** (Cloud Run direct VPC egress 옵션) | 거의 사용 안 함 |
| **Route 53** | **Cloud DNS** | 도메인 NS 변경 (downtime 1~24h) |
| **Service Quotas** | **Service Usage** | 신규 |

→ **마이그 안 하는 것** (그대로): Supabase DB, HF API, Gemini API, OpenAI API, Claude API.

---

## 5. 마이그레이션 Phase 6단계

### Phase 0 — GCP 계정 + 프로젝트 셋업 (30분)

```bash
# 1. GCP 프로젝트 생성 (Console 또는 gcloud)
gcloud projects create aifactory --name="AI TutorTwo"

# 2. 결제 연결 (필수, Cloud Run + GPU 사용)
# Console 에서 billing account 매핑

# 3. 필요 API 활성화
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project=aifactory

# 4. 리전 선택 (한국 사용자 기준)
# asia-northeast3 (서울) 또는 asia-northeast1 (도쿄)
# GPU 가용성: asia-northeast3 L4 GPU 지원
```

산출물: GCP 프로젝트 ID, billing 연결, API 활성화.

### Phase 1 — Artifact Registry + 이미지 빌드 (1h)

```bash
# 1. Artifact Registry 저장소 생성
gcloud artifacts repositories create aitutor \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="AI TutorTwo container images"

# 2. Docker 인증
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# 3. Dockerfile 변경 (port 8080 listen)
# server.js 가 process.env.PORT 또는 8080 사용 (이미 OK)
# lambda.js 제거 또는 미사용

# 4. 빌드 + push (로컬 또는 Cloud Build)
docker build -t asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:latest .
docker push asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:latest
```

산출물: 첫 image push, Artifact Registry tag 확인.

### Phase 2 — Secret Manager + 서비스 계정 (1h)

```bash
# 1. 시크릿 생성 (AWS SSM 의 값 마이그)
echo -n "$HF_API_KEY" | gcloud secrets create HF_API_KEY --data-file=-
echo -n "$AUTH_TOKEN_SECRET" | gcloud secrets create AUTH_TOKEN_SECRET --data-file=-
echo -n "$GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "$OPENAI_API_KEY" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-

# 2. Cloud Run service account 생성
gcloud iam service-accounts create aitutor-run \
  --display-name="AI TutorTwo Cloud Run"

# 3. Secret 접근 권한 부여
for s in HF_API_KEY AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY DATABASE_URL; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:aitutor-run@aifactory.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

산출물: 5개 시크릿, IAM 권한.

### Phase 3 — 코드 변경 + 두 번째 image push (2h)

`lambda.js` 의 SSM 부트스트랩을 Secret Manager 기반으로 변경, 또는 Cloud Run 환경변수에서 자동 주입:

```bash
# Cloud Run 배포 시 시크릿을 환경변수로 자동 주입
gcloud run deploy aitutor \
  --image=... \
  --update-secrets="HF_API_KEY=HF_API_KEY:latest,AUTH_TOKEN_SECRET=AUTH_TOKEN_SECRET:latest,..."
```

코드 변경:
- `lambda.js` 삭제
- `server.js`: `module.exports = app` 마지막에 + `if (require.main === module) app.listen(8080)` 그대로 유지 (현재도 이렇게 됨)
- `api/_runtime/settings.js` 환경변수 직접 사용 (SSM 호출 X)
- `api/server-infer.js` 의 SigV4 invokeLambda 제거 (필요 시 — Cloud Run 안에서는 다른 컨테이너 호출 안 하므로 불필요)
- `package.json` 에서 `@aws-sdk/*` 의존성 제거 (선택)

새 이미지 빌드 + push.

### Phase 4 — Cloud Run 배포 (병렬 운영) (1h)

```bash
gcloud run deploy aitutor \
  --image=asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:latest \
  --region=asia-northeast3 \
  --service-account=aitutor-run@aifactory.iam.gserviceaccount.com \
  --memory=16Gi \
  --cpu=4 \
  --gpu=1 \
  --gpu-type=nvidia-l4 \
  --timeout=600 \
  --concurrency=10 \
  --min-instances=0 \
  --max-instances=5 \
  --port=8080 \
  --update-secrets="HF_API_KEY=HF_API_KEY:latest,AUTH_TOKEN_SECRET=AUTH_TOKEN_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,DATABASE_URL=DATABASE_URL:latest" \
  --allow-unauthenticated
```

배포 후:
- Cloud Run URL: `https://aitutor-xxxxx-an.a.run.app`
- AWS 인프라는 그대로 → AWS 도메인 (d2dcsdi9b1j2rf.cloudfront.net) 도 살아있음
- 둘 다 동시 운영 → 검증

산출물: Cloud Run URL, 첫 배포 성공.

### Phase 5 — 검증 (Cloud Run *.run.app 도메인 직접 사용) (2~4h)

> **사용자 결정 (2026-04-29)**: 도메인은 **Cloud Run 제공 도메인 그대로 사용** (`*.run.app`).
> Custom domain mapping / Cloud DNS / Route 53 변경 → **모두 불필요**.

```bash
# 1. 배포 후 출력된 Cloud Run URL 확인
gcloud run services describe aitutor --region=asia-northeast3 \
  --format="value(status.url)"
# 예: https://aitutor-abc123-an.a.run.app

# 2. 클라이언트 측 코드의 API 호출 base URL 변경
# - capacitor.config.json 의 server.url 변경 (현재: cloudfront.net → 신규: *.run.app)
# - Capacitor 앱 (iOS / Android) 재빌드 + 스토어 배포 (또는 OTA update)
# - 웹은 SPA 가 자기 origin 호출하니 자동

# 3. 검증 항목
- GET /api/config → JSON
- POST /api/login → 인증 OK
- GET /api/questions → DB 연결 OK
- POST /api/hf → HF Inference Providers 동작 (SSE 스트리밍)
- POST /api/local-infer → 일심동체 GGUF 추론 (GPU)
- /lab/hf, /lab/hf/compare, /lab/local-gcp → SPA 라우트
- 일반 SPA 정적 파일 응답 (Cloud Run 가 정적 파일도 서빙)
- DB 쿼리 latency 측정 (Supabase ap-northeast-2 ↔ GCP asia-northeast3)

# 4. 1~2일 trickle 트래픽 (사용자 일부) 모니터링
```

산출물: Cloud Run URL (`*.run.app`) 그대로 라이브, 99% 응답률.

⚠ 주의: capacitor.config.json 의 `server.url` 변경 필요. 모바일 앱은 OTA update 가능 시 즉시 적용, 아니면 스토어 재배포.

### Phase 6 — AWS 인프라 폐기 (1~2주 후, 1h)

```bash
# 검증 완료 + 1~2주 안정 운영 후
aws cloudfront delete-distribution --id E2MP4BK1D16LJN --region us-east-1
aws elbv2 delete-load-balancer --load-balancer-arn ...
aws lambda delete-function --function-name aitutor
aws ecr delete-repository --repository-name aitutor --force
# Lambda inference 함수들도 (사용 안 하면)
aws lambda delete-function --function-name aitutor-inference-e2b
aws lambda delete-function --function-name aitutor-inference-e4b
aws lambda delete-function --function-name aitutor-inference-e2b-gguf
aws lambda delete-function --function-name aitutor-infer-router
# CodeBuild
aws codebuild delete-project --name aitutor-build --region ap-northeast-2
aws codebuild delete-project --name aitutor-inference-build --region ap-northeast-2
# S3 (모델 buckets)
aws s3 rb s3://aitutor-models-794531974010 --force
aws s3 rb s3://aitutor-codebuild-src-794531974010 --force
# SSM
for k in $(aws ssm describe-parameters --query "Parameters[?starts_with(Name, '/aitutor/')].Name" --output text); do
  aws ssm delete-parameter --name $k
done
```

비용 효과: AWS 청구액 → $0 (Supabase 비용 제외).

---

## 6. 코드 변경 범위 (정밀 분석)

### 6.1 삭제

| 파일 | 사유 |
|---|---|
| `lambda.js` | Cloud Run 은 직접 listen, Lambda handler 불필요 |
| `scripts/server-infer-router/` | 옵션 P 라우터 — Cloud Run 에서는 불필요 |
| `Dockerfile` | 일부 변경 (Lambda Container base image → Node 22 일반) |
| `buildspec.yml` | Cloud Build 의 `cloudbuild.yaml` 으로 대체 |

### 6.2 수정

| 파일 | 변경 내용 | 줄 수 |
|---|---|---|
| `Dockerfile` | base image: `public.ecr.aws/lambda/nodejs:22` → `nvidia/cuda:12.4.0-runtime-ubuntu22.04` + Node 22 + Ollama + llama.cpp source build + vLLM (Python) + EXPOSE 8080 + CMD ["/start.sh"] | ~50 |
| `server.js` | `app.listen(8080)` 직접 (현재도 이미 됨, lambda.js export 만 제거) | ~5 |
| `package.json` | `@codegenie/serverless-express` 제거, `@aws-sdk/*` 4개 제거, `@google-cloud/storage` 추가 | ~6 |
| `api/server-infer.js` | SigV4 invokeLambda 제거 → 같은 컨테이너 내부 (`localhost:11434/11435/11436`) 호출로 교체. UI/UX (server-ai, server-ai-gguf 실험실) 유지 | ~80 |
| `api/local-infer.js` | node-llama-cpp 직접 호출 → Ollama/llama.cpp/vLLM 엔진 분기 (`engine` 파라미터) | ~60 |
| `api/upload-sign.js` | **S3 → GCS** : `@google-cloud/storage` 의 `bucket.file().getSignedUrl()` (V4 signed URL) + 업로드는 **resumable session URL** 또는 **V4 signed PUT** 으로 교체. `S3_FILES_BUCKET` → `GCS_FILES_BUCKET` | ~50 |
| `api/memo-files.js` | **S3 → GCS** : `S3Client.DeleteObjectCommand` → `bucket.file(key).delete()` | ~10 |
| `api/pool-upload.js` | **S3 → GCS** : `S3Client.GetObjectCommand` → `bucket.file(key).download()` 또는 `createReadStream` | ~15 |
| `api/cors.js` | CloudFront 도메인 + `*.lambda-url.*` 정규식 제거 → `*.run.app` 정규식 추가 | ~6 |
| `api/signup.js` | `process.env.AWS_LAMBDA_FUNCTION_NAME` 환경 감지 → Cloud Run 의 `K_SERVICE` 로 교체 | ~2 |
| `api/_runtime/settings.js` | **변경 없음** (DB 기반이라 SSM 의존 X. lambda.js 의 SSM 부트스트랩만 폐기) | 0 |
| `capacitor.config.json` | `server.url`: `https://d2dcsdi9b1j2rf.cloudfront.net` → `https://aitutor-xxx.run.app` (Phase 4 배포 후 출력된 URL) | ~1 |
| `src/labs/local-lambda/` | → `src/labs/local-gcp/` 로 디렉토리 rename + UI 에 엔진 드롭다운 (Ollama/llama.cpp/vLLM) 추가 | ~30 |
| `src/App.jsx` | 라우트 `/lab/local-lambda` → `/lab/local-gcp`, lazy import 경로 갱신 | ~3 |
| (신규) `start.sh` | 3 엔진 daemon (Ollama 11434 / llama.cpp server 11435 / vLLM 11436) + `node server.js` (8080) | ~25 |
| (신규) `cloudbuild.yaml` | Cloud Build 빌드 스펙 | ~30 |
| (신규) `scripts/migrate-s3-to-gcs.js` | 기존 S3 데이터 → GCS 마이그 스크립트 (REBUILD23 §17.4) | ~80 |

### 6.3 변경 없음 (대부분의 코드)

- `api/login.js`, `api/signup.js`, `api/questions.js`, `api/memos.js`, `api/explanations.js` 등 일반 API
- `api/hf.js`, `api/_llm/hf-chat.js`, `api/_runtime/hf-catalog.js` (HF 통합)
- `api/openai.js`, `api/gemini.js`, `api/claude.js`
- `src/` 전체 (프론트엔드)
- `api/db.js` (Postgres 연결 — DATABASE_URL 환경변수 그대로)

→ **변경 비율: 코드 5% 미만**.

### 6.4 새 파일

```yaml
# cloudbuild.yaml — Cloud Build 자동화
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'asia-northeast3-docker.pkg.dev/$PROJECT_ID/aitutor/app:$COMMIT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'asia-northeast3-docker.pkg.dev/$PROJECT_ID/aitutor/app:$COMMIT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - aitutor
      - --image=asia-northeast3-docker.pkg.dev/$PROJECT_ID/aitutor/app:$COMMIT_SHA
      - --region=asia-northeast3
images:
  - 'asia-northeast3-docker.pkg.dev/$PROJECT_ID/aitutor/app:$COMMIT_SHA'
```

---

## 7. 비용 시뮬레이션 (3개 시나리오)

### 시나리오 A — 영상정보관리사 (현재, 2인 가끔 호출)

| 항목 | 추정 사용량 | 단가 | 월 비용 |
|---|---|---|---|
| Cloud Run 일반 API 호출 (2인 × 100 req/day × 30일 = 6000 req) | 6000 req × 200ms × 1 vCPU/4GB | ~$0.0000040 / GB-sec | **$0.10** |
| Cloud Run AI 호출 (가끔, 50 req × 5초 GPU) | 50 req × 5s × L4 GPU | ~$0.0007/sec | **$0.18** |
| Artifact Registry storage | 30 GB image × 1개 | $0.10/GB/월 | **$3** |
| Secret Manager | 5 시크릿, 10 access/일 | $0.06/10K access | **$0.01** |
| Cloud Logging | ~1 GB/월 | $0.50/GB | **$0.50** |
| Cloud Build (선택, 빌드 1~3회/월) | 3 × 10분 | $0.003/min | **$0.10** |
| **합계** | | | **~$3.89/월** |

→ AWS 현재 ~$5/월 보다 **약간 저렴**.

### 시나리오 B — 중간 규모 (월 5000 AI 호출)

| 항목 | 추정 사용량 | 월 비용 |
|---|---|---|
| Cloud Run 일반 API | 50K req | $1 |
| Cloud Run AI 호출 (5K req × 8s GPU) | 40000 GPU-sec | **$28** |
| GPU 콜드 스타트 (idle 후 재시작) | ~50회/월 | 사실상 무료 |
| Artifact Registry | 30 GB | $3 |
| Cloud Logging + Monitoring | 5 GB | $2.5 |
| **합계** | | **~$34.5/월** |

### 시나리오 C — 대규모 (월 100000 AI 호출, GPU 24h 켜둠)

| 항목 | 추정 사용량 | 월 비용 |
|---|---|---|
| Cloud Run + L4 24h (min-instances=1) | 720h × $0.7/h | **$504** |
| 트래픽 폭증 시 추가 인스턴스 | 가끔 | $50 |
| 그 외 | | $10 |
| **합계** | | **~$564/월** |

→ Cloud Run 24h 켜두는 것보다 GCE g2-standard-4 ($520/월) 가 저렴할 수 있음. 트래픽 패턴 따라 결정.

### 비용 결정 가이드

```
월 호출 수 < 1000 (현재 시나리오):
  → Cloud Run min-instances=0 (idle 비용 0) ⭐
  → ~$5/월

월 호출 수 1000~10000:
  → Cloud Run min-instances=0
  → ~$30~50/월

월 호출 수 > 10000 (트래픽 일정):
  → Cloud Run min-instances=1 또는 GCE 24h
  → ~$500/월
```

---

## 8. 위험 + 완화

### 8.1 기술적 위험

| 위험 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| GPU 가용성 부족 (asia-northeast3) | 낮음 | 높음 | asia-northeast1 (도쿄) fallback / quota 신청 |
| Cloud Run 콜드 스타트 (idle 후) | 중간 | 중간 | min-instances=1 (월 +$60) 또는 사용자 첫 호출 안내 |
| Supabase 와 GCP 간 latency (다른 클라우드) | 낮음 | 낮음 | 연결 pool, query 최적화 |
| 도메인 전환 시 DNS 캐싱 (24h+) | 높음 | 낮음 | TTL 미리 60s 로 줄이기, 점진 전환 |
| 시크릿 누락 / 오타 | 중간 | 높음 | 배포 전 dry-run / 환경변수 점검 |
| Cloud Build / 권한 설정 실수 | 중간 | 중간 | 단계별 verify (gcloud auth, IAM 명시) |

### 8.2 운영 위험

| 위험 | 완화 |
|---|---|
| GCP 학습 곡선 | 1주일 점진 마이그, 검증 단계 충분히 |
| AWS 리소스 polute (마이그 후 누락 정리) | Phase 6 의 폐기 명령 체크리스트 |
| 비용 폭증 (실수로 GPU 24h 켜둠) | 알림 (Cloud Billing budget alert) 설정 |
| Service account 권한 과다 부여 | Least privilege (필요한 시크릿/리소스만) |

### 8.3 비즈니스 위험

| 위험 | 완화 |
|---|---|
| 도메인 전환 중 사용자 영향 | 점진 (DNS 가중 라우팅) + 1~2일 모니터링 |
| AWS lock-in 해제 vs GCP lock-in | Supabase / HF / OpenAI 등 외부 의존은 그대로 |

---

## 9. 롤백 전략

### 9.1 Phase 별 롤백 가능 시점

```
Phase 0 (GCP 셋업): 롤백 불필요 (영향 0)
Phase 1 (이미지 빌드): 롤백 불필요 (AWS 인프라 그대로)
Phase 2 (시크릿): 롤백 불필요
Phase 3 (코드 변경): git revert (이미 baseline a28e7df 있음)
Phase 4 (Cloud Run 배포): AWS 인프라 그대로 → 도메인 변경 안 함, Cloud Run URL 직접 호출만 영향
Phase 5 (도메인 전환): ★ 핵심 롤백 지점 ★
  → DNS 를 AWS CloudFront 로 다시 가리키기 (TTL 60s 설정해뒀으면 1분 내 복귀)
Phase 6 (AWS 폐기): 폐기 후에는 재배포 필요 → 1~2주 보존 권고
```

### 9.2 클라이언트 base URL 롤백 (Phase 5)

> 사용자 결정: Cloud Run *.run.app 도메인 직접 사용 (DNS / Route 53 / 가중 라우팅 없음).
> 따라서 롤백은 **클라이언트 base URL 변경**으로 처리.

```
[웹 클라이언트] SPA 가 자기 origin (`*.run.app`) 호출
  → 롤백: Cloud Run service 폐기 시 사용자가 신 도메인 접속 못함
  → 또는 Cloud Run service 그대로 두고 새 GCP 배포로 복원

[모바일 앱] capacitor.config.json 의 server.url
  → 롤백: AWS CloudFront URL 로 다시 변경 + 앱 재빌드 (또는 OTA)
  → Phase 6 (AWS 폐기) 전까지 두 도메인 모두 살아있음 → 즉시 롤백 가능
  → AWS 폐기 후 롤백 시: AWS 인프라 재배포 필요 (1~2시간)

→ Phase 6 (AWS 폐기) 결정은 GCP 1~2주 안정 운영 후에만 진행 권고
```

### 9.3 데이터 무결성

Supabase DB 그대로 사용 → **데이터 마이그레이션 0**. 롤백 시 DB 영향 없음.

---

## 10. 검증 체크리스트

### 10.1 Phase 4 후 (Cloud Run 배포 후)

```
[기능 검증]
□ GET /api/config → JSON 응답
□ POST /api/login → 토큰 발급
□ GET /api/questions → DB 데이터 응답
□ POST /api/hf (인증) → HF API 응답 (SSE 스트리밍 OK)
□ POST /api/local-infer (인증) → GGUF 추론 (GPU 사용)
□ /lab/hf, /lab/hf/compare → SPA 라우트
□ /settings → 관리자 토글 동작
□ KISA 트랙 라우트
□ 첨부파일 (memo-files) — base64 저장/조회
□ 회원가입 (signup_disabled 토글)

[성능 검증]
□ 일반 API latency p99 < 500ms
□ AI 호출 latency p99 < 30s
□ 첫 콜드 스타트 < 30s
□ warm 호출 < 3s

[보안 검증]
□ HTTPS 강제 (HTTP 차단)
□ Secret 환경변수 정상 주입
□ CORS 제대로 동작
□ admin only 페이지 접근 제어

[비용 검증]
□ Cloud Billing budget alert 설정 ($30 / $100 / $300 임계)
□ idle 시 GPU instance 0 확인 (1시간 idle 후)
□ 첫 1주일 일별 비용 모니터링
```

### 10.2 Phase 5 후 (도메인 전환 후)

```
□ 사용자 도메인 (aitutor.example.com) 으로 직접 접속
□ HTTPS 인증서 자동 발급
□ Capacitor 앱 (iOS/Android) 도 신 도메인 호출 OK
□ DNS 캐싱 영향 측정 (TTL 60s)
□ 1주일 사용자 컴플레인 0
```

### 10.3 Phase 6 (AWS 폐기) 전 체크

```
□ AWS Lambda 호출 로그 0 (1주일)
□ ALB / CloudFront 트래픽 0 (1주일)
□ Cost Explorer: AWS 비용 점진 감소 확인
□ S3 / ECR / CodeBuild 데이터 백업 (필요시)
□ 폐기 명령 dry-run
```

---

## 11. 타임라인 (4~6 working day)

```
Day 1 (4h):
  ├─ Phase 0: GCP 프로젝트 + billing + API 활성화 (30분)
  ├─ Phase 1: Artifact Registry + 첫 이미지 빌드 (1h)
  ├─ Phase 2: Secret Manager + IAM (1h)
  └─ Phase 3 (절반): 코드 변경 시작 (1.5h)

Day 2 (4h):
  ├─ Phase 3 (완료): 코드 변경 + 두 번째 이미지 (1.5h)
  ├─ Phase 4: Cloud Run 첫 배포 + 기능 검증 (2.5h)

Day 3 (3h):
  └─ Phase 5 (절반): 검증 + 성능 튜닝 + 도메인 매핑 준비 (3h)

Day 4 (2h):
  └─ Phase 5 (완료): 도메인 전환 (점진 DNS) + 모니터링 셋업 (2h)

Day 5~7 (모니터링, 패시브):
  └─ 사용자 컴플레인 모니터링, 트래픽 비교

Day 14 (1h):
  └─ Phase 6: AWS 인프라 폐기 (안정 검증 후)
```

---

## 12. 결정 지원 — 가능 / 불가능 / 선택

### 12.1 가능 / 권장

✅ Cloud Run + L4 GPU (메인)
✅ Supabase 그대로
✅ Secret Manager
✅ Artifact Registry + Cloud Build
✅ asia-northeast3 (서울 리전)
✅ 점진 마이그레이션 (1~2주)
✅ Custom domain mapping

### 12.2 가능 / 비권장

⚠️ GKE Autopilot (작은 워크로드에 오버킬)
⚠️ Vertex AI Endpoints (영상정보관리사 시나리오에 비용 비효율)
⚠️ GCE 24h (idle 비용 → 사용량 적은 시나리오에 비효율)
⚠️ Cloud SQL 신규 (Supabase 마이그 부담)

### 12.3 불가능 / 제약

❌ GPU 무한 timeout (Cloud Run 도 60분 한도)
❌ AWS Lambda 함수 직접 호출 (Cloud Run → Lambda 호출은 가능하지만 의미 X)

---

## 13. 사용자 확정 결정 (2026-04-29) ✅

| # | 결정 항목 | **확정** |
|---|---|---|
| 1 | 마이그 진행 / 보류 | ✅ **진행** |
| 2 | GCP 프로젝트 ID | ✅ **`aifactory-494108`** (실제 생성된 프로젝트, billing 연결 완료) |
| 3 | 리전 | ⚠ **변경됨**: asia-northeast3 (서울) → **us-central1 (아이오와)** [2026-04-29 Phase 4 배포 시도 중 발견]. 사유: asia-northeast3 가 Cloud Run + GPU L4 미지원. 한국 사용자 latency ~150ms 추가 (수용 가능, 추후 latency 문제 시 asia-southeast1 로 이전 가능 — Cloud Run service 재배포 5분, 데이터 영향 0). Artifact Registry/GCS 는 asia-northeast3 그대로 유지 (cross-region 비용 미미). |
| 4 | GPU 옵션 | ✅ **L4 24GB 활성** (사용량 기반, idle = 0원, ON/OFF 토글 자동) |
| 5 | 추론 엔진 | ✅ **교체 가능 구조** — Ollama + llama.cpp + vLLM 3종 (실험실에 비교 모드) |
| 6 | DB | ✅ **Supabase 유지** (마이그 X) |
| 7 | **Storage** | ✅ **GCS 로 마이그** (S3 → GCS, REBUILD23 §17 참조). AWS 완전 폐기 원칙 + GCP 단일 백엔드 통합 + Cloud Run service account 자동 인증 |
| 8 | 도메인 | ✅ **Cloud Run 제공 도메인 그대로** (`*.run.app`) — Custom domain X |
| 9 | 실험실 처리 | ✅ **5개 모두 이번에 한 번에 마이그** — `local-lambda`→`local-gcp` rename + 엔진 드롭다운, `server-ai`/`server-ai-gguf` 백엔드만 Cloud Run 내부 호출로 교체 (UI 유지) |
| 10 | AWS 인프라 | ✅ **GCP 완전 이전 + 안정 검증 후 전체 제거** |
| 11 | 타임라인 | (사용자 미결정 — 권장: 4~6 working day) |
| 12 | billing 한도 | ✅ **$30 alert + 비용 제로화 지향** (min-instances=0 필수, idle 시 $0) |

→ 위 결정 기반으로 Phase 0 부터 작업 진행 가능.

---

## 14. ★ 메모리 클리어 후 재진입 가이드 (NEW SESSION 시작점)

> 본 섹션은 사용자가 메모리 클리어 후 새 conversation 으로 작업 재개 시 LLM 이 첫 자기소개로 읽을 self-contained 가이드.

### 14.1 작업 컨텍스트 30초 요약

**프로젝트**: `/Users/2team/aifac/workspace/aitutor` — 영상정보관리사 자격증 학습 SPA + 서버

**현재 상태** (2026-04-29 라이브):
- AWS 인프라 (Lambda Container + ALB + CloudFront) 라이브
- Lambda 일심동체 (`/lab/local-lambda`) 작동 안 함 — 60s timeout 한계
- HF Inference Providers (`/lab/hf`, `/lab/hf/compare`) 라이브 OK
- 모든 변경사항 git baseline commit `a28e7df`

**다음 작업**: AWS → GCP 마이그레이션 (REBUILD23.md 본 문서)

### 14.2 사용자 확정 결정 (§ 13 참조)

핵심:
- **GCP Cloud Run + L4 GPU + asia-northeast3 (서울)** 단일 service
- **추론 엔진 3종 동시 설치** (Ollama / llama.cpp / vLLM) — 실험실 비교 모드
- **Supabase DB 유지** (마이그 0)
- **Cloud Run *.run.app 도메인 직접 사용** — Custom domain 없음
- **AWS 완전 폐기** (안정 검증 후)

### 14.3 작업 시작 명령

```bash
# 1. 현재 git 상태 확인
cd /Users/2team/aifac/workspace/aitutor
git log --oneline -3
# 예상 출력: a28e7df chore(aitutor): 라이브 baseline ...

# 2. REBUILD23.md 정독 (이 파일)
cat REBUILD23.md | head -100

# 3. Phase 0 부터 진행 (§ 5 참조)
gcloud --version  # 설치 확인
gcloud auth list   # 로그인 확인
```

### 14.4 Phase 진행 순서

| Phase | 핵심 작업 | 시간 | 사용자 직접 작업 |
|---|---|---|---|
| **Phase 0** | GCP 프로젝트 + billing + API 활성화 | 30분 | ✅ Console 에서 결제 카드 등록 |
| **Phase 1** | Artifact Registry + 첫 이미지 빌드 (3 엔진 포함 큰 이미지) | 1.5h | (gcloud 명령) |
| **Phase 2** | Secret Manager + 시크릿 마이그 + IAM | 1h | ✅ AWS SSM 시크릿 값 복사 |
| **Phase 3** | 코드 변경 (lambda.js 제거, Dockerfile 변경, api/local-infer.js 엔진 분기, UI 엔진 드롭다운) | 2~3h | (코드 작업) |
| **Phase 4** | Cloud Run 첫 배포 (GPU L4) + 검증 | 2.5h | (gcloud + 검증) |
| **Phase 5** | capacitor.config.json server.url 변경 + 모바일 앱 재빌드 | 2h | ✅ App Store / Play Store 업데이트 (선택) |
| **Phase 6** | AWS 인프라 전체 폐기 (1~2주 후) | 1h | ✅ 비용 알림 점검 |

### 14.5 우선 검증 포인트 (Phase 4 후)

```
[기능] /api/login → /api/questions → /api/hf → /api/local-infer (engine=ollama|llama-cpp|vllm)
[성능] warm 호출 < 3s, cold < 30s
[비용] 1주일 일별 비용 < $5 (영상정보관리사 시나리오)
[안정] 응답률 99%+
```

### 14.6 코드 변경 핵심 (Phase 3 — 다음 세션 우선 작업)

```
[삭제]
  lambda.js
  scripts/server-infer-router/  (전체 폴더)
  
[수정]
  Dockerfile             — base nvidia/cuda + Node 22 + Ollama + llama.cpp + vLLM
  buildspec.yml          → cloudbuild.yaml 으로 대체 (또는 로컬 docker push)
  start.sh (신규)        — 3 엔진 daemon + node server.js
  api/_runtime/settings.js — SSM 호출 제거, 환경변수 직접 사용
  api/server-infer.js    — SigV4 invokeLambda 제거 (선택)
  api/local-infer.js     — model_key + engine 분기 (Ollama/llama-cpp/vLLM)
  api/_runtime/hf-catalog.js  — 변경 없음
  package.json           — @codegenie/serverless-express, @aws-sdk/* 제거
  capacitor.config.json  — server.url: *.cloudfront.net → *.run.app
  src/labs/local-lambda/  → src/labs/local-gcp/ 로 rename + 엔진 드롭다운 추가

[신규]
  src/labs/local-gcp/EngineCompareTab.jsx (선택) — 같은 모델 × 다른 엔진 비교
```

### 14.7 위험/주의

- ⚠ Cloud Run + GPU 첫 배포 시 GPU quota 신청 필요할 수 있음 (asia-northeast3 L4) — `gcloud compute regions describe asia-northeast3 --format="value(quotas)"` 또는 IAM & Admin > Quotas 에서 확인.
- ⚠ Dockerfile 이미지 크기 — 3 엔진 + 모델 패킹 시 ~10~20GB. Artifact Registry 한도 (compressed 10GB) 안에 들어가게 하려면 모델은 lazy download (Cloud Run 시작 시 GCS 에서 다운) 권장.
- ⚠ Capacitor 앱의 server.url 변경 시 사용자 영향 — OTA 가능 시 즉시, 아니면 스토어 재배포.
- ⚠ Supabase 와 GCP 간 latency — AWS ap-northeast-2 ↔ Supabase 와 GCP asia-northeast3 ↔ Supabase 비교 시 차이가 클 수 있음. 검증 시 측정 필요.

---

## 15. 부록

### 14.1 GCP 학습 자료

- [Cloud Run + GPU 공식 가이드](https://cloud.google.com/run/docs/configuring/services/gpu)
- [Cloud Run + Custom Domain](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Secret Manager 사용법](https://cloud.google.com/secret-manager/docs/configuring-secret-manager)
- [Artifact Registry Docker 인증](https://cloud.google.com/artifact-registry/docs/docker/authentication)

### 14.2 핵심 gcloud 명령 (재현용)

```bash
# 프로젝트 / 인증
gcloud config set project aifactory
gcloud auth login
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# 이미지 빌드 (로컬)
docker build -t asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:v1 .
docker push asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:v1

# 또는 Cloud Build
gcloud builds submit --tag asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:v1

# Cloud Run 배포
gcloud run deploy aitutor \
  --image=asia-northeast3-docker.pkg.dev/aifactory/aitutor/app:v1 \
  --region=asia-northeast3 \
  --memory=16Gi --cpu=4 --gpu=1 --gpu-type=nvidia-l4 \
  --timeout=600 --concurrency=10 \
  --min-instances=0 --max-instances=5 \
  --service-account=aitutor-run@aifactory.iam.gserviceaccount.com \
  --update-secrets="HF_API_KEY=HF_API_KEY:latest,..." \
  --allow-unauthenticated

# 로그 보기
gcloud run services logs read aitutor --region=asia-northeast3 --limit=50

# Cloud Run 사용량 보기
gcloud run services describe aitutor --region=asia-northeast3
```

### 14.3 Cloud Run vs Lambda 비교 매트릭스

| 항목 | AWS Lambda Container | Cloud Run (no GPU) | Cloud Run + L4 GPU |
|---|---|---|---|
| 메모리 | 128MB ~ 10GB (계정 quota 3008MB) | 128MB ~ 32GB | 16~32GB + GPU |
| vCPU | 메모리 비례 | 1~8 vCPU | 4~8 vCPU |
| timeout | 15분 (function), CloudFront 60s | 60분 | 60분 |
| invoke mode | Sync / Async / Stream (RESPONSE_STREAM) | Sync HTTP | Sync HTTP |
| 콜드 스타트 | 컨테이너 마운트 5~30s | 5~30s | 10~30s (GPU 워밍업) |
| HTTPS | Function URL 또는 ALB/CF | 자동 | 자동 |
| 도메인 | Function URL or ALB | Custom domain mapping | 같음 |
| 과금 | request + 시간 + 메모리 | request + 시간 + vCPU + 메모리 | + GPU 시간 |
| 인증 | IAM / NONE / JWT 등 | --allow-unauthenticated 또는 IAM | 같음 |

### 14.4 영상정보관리사 코드 베이스 변경 검증 체크

```
□ server.js → app.listen(8080) (이미 OK)
□ lambda.js → 삭제 가능
□ Dockerfile → base image 변경
□ buildspec.yml → cloudbuild.yaml 신규
□ api/_runtime/settings.js → SSM 호출 제거
□ api/server-infer.js → SigV4 invokeLambda 제거 (선택)
□ package.json → @codegenie/serverless-express 제거
□ package-lock.json → 갱신
□ src/ → 변경 없음
□ Tailwind / Vite 빌드 → 변경 없음
```

---

## 17. Storage 마이그레이션 — S3 → GCS (사용자 확정 2026-04-29)

> 사용자 결정: **A 옵션 (GCS 마이그) — 정석**. AWS 완전 폐기 원칙 + GCP 단일 백엔드 통합 + Cloud Run service account 자동 인증 (env 키 불필요).

### 17.1 영향받는 파일 + 기능

기존에 AWS S3 를 사용하는 코드 (점검 결과, REBUILD23 본문에 누락되어 있던 항목):

| 파일 | 기능 | S3 사용 패턴 |
|---|---|---|
| `api/upload-sign.js` | 메모 첨부파일 업로드 + pool 업로드 (Lambda 6MB 한도 우회) | presigned POST (`createPresignedPost`) + presigned GET (`getSignedUrl`) |
| `api/memo-files.js` | 메모 첨부파일 삭제 | `DeleteObjectCommand` |
| `api/pool-upload.js` | 관리자 pool 업로드 처리 | `GetObjectCommand` |

DB 측: `memo_files.s3_key` 컬럼 — **컬럼명 그대로 유지** (의미만 GCS object key 로 재해석. 스키마 마이그 0).

### 17.2 GCS 신규 리소스

```
프로젝트: aifactory-494108
리전: asia-northeast3 (Cloud Run 과 동일 — 무료 cross-region transfer 회피)
버킷: aitutor-files-aifactory-494108
  ├─ memos/{user_uid}/{uuid}.{ext}        — 메모 첨부 (5MB 제한)
  └─ uploads/pool/{user_uid}/{uuid}.{ext} — 관리자 pool (20MB 제한)
스토리지 클래스: Standard (자주 액세스)
액세스: 비공개 (signed URL 만)
Object Lifecycle: 미설정 (필요 시 30일 후 Coldline 이동 등)
```

### 17.3 인증 방식 — service account (env 키 불필요)

AWS 와 달리 GCP 는 **Cloud Run 의 service account** 가 자동으로 GCS 인증을 해줍니다 (Application Default Credentials, ADC). 즉:

- ❌ 환경변수 `GOOGLE_APPLICATION_CREDENTIALS` 등록 불필요
- ❌ JSON key 파일 불필요
- ❌ `GCS_ACCESS_KEY` 같은 시크릿 불필요
- ✅ Cloud Run 배포 시 `--service-account=aitutor-run@...` 만 지정
- ✅ 해당 SA 에 `roles/storage.objectAdmin` (대상 버킷 한정) 부여

코드에서는 단순히:
```js
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();  // 자동으로 Cloud Run SA credential 사용
const bucket = storage.bucket(process.env.GCS_FILES_BUCKET);
```

### 17.4 데이터 마이그 — `scripts/migrate-s3-to-gcs.js` (신규)

```js
// 기존 S3 버킷의 객체를 GCS 로 복사
// 1) AWS S3 → 로컬 임시 다운로드
// 2) 로컬 → GCS 업로드
// 3) DB 의 memo_files.s3_key 는 그대로 유지 (key path 가 동일하므로)
//
// 호출:
//   node scripts/migrate-s3-to-gcs.js \
//     --src-bucket=aitutor-files-794531974010 \
//     --dest-bucket=aitutor-files-aifactory-494108 \
//     --concurrency=5
//
// 진행:
//   - aws s3 sync 처럼 작동
//   - 진행률 출력
//   - 실패 시 재시도 3회
//   - 결과: 성공 N개 / 실패 M개 / 건너뜀(이미 있음) K개
```

또는 더 단순하게 `gsutil` + AWS S3 호환 모드:
```bash
# .boto 에 AWS credential 기록 후
gsutil -m rsync -r s3://aitutor-files-794531974010 gs://aitutor-files-aifactory-494108
```

### 17.5 코드 변경 핵심 패턴

#### 업로드 signed URL (V4 signed PUT — presigned POST 대체)

GCS 의 V4 PUT signed URL 은 S3 presigned POST 보다 단순. 클라이언트는 `fetch(url, { method: 'PUT', body: file })` 한 번이면 끝.

```js
// api/upload-sign.js (action === 'upload')
const [url] = await bucket.file(key).getSignedUrl({
  version: 'v4',
  action: 'write',
  expires: Date.now() + 5 * 60 * 1000,   // 5분
  contentType: mime_type,
  extensionHeaders: {
    'x-goog-content-length-range': `0,${MAX_SIZE}`,  // 크기 강제
  },
});
return res.json({ key, url, method: 'PUT', headers: { 'Content-Type': mime_type } });
```

⚠ 클라이언트 측 업로드 코드도 함께 수정 필요 — `FormData` (S3 presigned POST) → `fetch(PUT)` 로 변경. 파일 위치: `src/lib/` 또는 메모 첨부 컴포넌트.

#### 다운로드 signed URL (V4 signed GET)

```js
// api/upload-sign.js (action === 'download')
const [url] = await bucket.file(targetKey).getSignedUrl({
  version: 'v4',
  action: 'read',
  expires: Date.now() + 60 * 1000,   // 1분
});
return res.json({ url, key: targetKey });
```

#### 삭제

```js
// api/memo-files.js
await bucket.file(key).delete({ ignoreNotFound: true });
```

#### Get (pool 처리용)

```js
// api/pool-upload.js
const [buf] = await bucket.file(key).download();
// 또는 stream:
const stream = bucket.file(key).createReadStream();
```

### 17.6 환경변수 변경

| 기존 (AWS) | 신규 (GCP) |
|---|---|
| `S3_FILES_BUCKET` | `GCS_FILES_BUCKET` (`aitutor-files-aifactory-494108`) |
| `AWS_REGION` | (불필요, GCS 는 글로벌 endpoint) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | (불필요, ADC 자동 인증) |

### 17.7 IAM 권한 (Phase 2 추가)

```bash
# Cloud Run service account 에 GCS 권한
gsutil iam ch \
  serviceAccount:aitutor-run@aifactory-494108.iam.gserviceaccount.com:objectAdmin \
  gs://aitutor-files-aifactory-494108
```

### 17.8 검증

```
□ 메모 작성 + 첨부파일 업로드 → GCS 버킷에 객체 생성 확인
□ 메모 첨부 다운로드 (V4 signed URL) → 정상 표시
□ 메모 삭제 → GCS 객체도 삭제
□ pool 업로드 → 관리자 처리 → GCS 다운로드 정상
□ DB memo_files 테이블 무결성 (s3_key 컬럼 = GCS object key 로 매핑)
□ 기존 메모 (마이그된 데이터) 다운로드 정상
```

### 17.9 폐기 시점 (Phase 6)

```bash
# AWS S3 버킷 폐기 (마이그 검증 후 1~2주 보존 → 완전 삭제)
aws s3 rb s3://aitutor-files-794531974010 --force
```

---

## 19. AWS ↔ GCP 서비스 상세 매핑 (실제 마이그 결과)

> 본 섹션은 § 4 매핑 표를 확장하여 **본 프로젝트(`workspace/aitutor`) 의 실제 마이그 작업 내역**을 AWS / GCP 서비스명 기준으로 자세히 기록.
> 작성: 2026-04-29 — Phase 1, 2, 3 완료 시점 기준.

### 19.1 한눈에 보는 매핑 표

| # | 분야 | AWS 서비스 | GCP 서비스 | 본 프로젝트의 실제 리소스 | 마이그 상태 |
|---|---|---|---|---|---|
| 1 | 앱 런타임 | **Lambda** (Container) | **Cloud Run** | 서비스명 `aitutor` (**us-central1**, min=0/max=3, 16Gi RAM, 4 vCPU, GPU L4 quota 승인 후 추가 예정). URL: `https://aitutor-z2ppabmtxa-uc.a.run.app` | ✅ Phase 4 라이브 (GPU 없이, Stage 1 통과 2026-04-29) |
| 2 | 추론 엔진 | Lambda (별도 함수: `aitutor-inference-e2b/e4b/qwen35-4b/e2b-gguf/e4b-gguf` + `aitutor-infer-router`) | **같은 Cloud Run 컨테이너 내부 daemon** (Ollama + llama.cpp + vLLM) | Ollama daemon (port 11434, MVP) / llama.cpp (11435, Phase 5) / vLLM (11436, Phase 5) | ✅ 코드 통합 (Phase 3-3) |
| 3 | 컨테이너 레지스트리 | **ECR** (`aitutor`, `aitutor-inference-*`) | **Artifact Registry** | `asia-northeast3-docker.pkg.dev/aifactory-494108/aitutor/aitutor` | ✅ Phase 1 |
| 4 | CI/CD 빌드 | **CodeBuild** (`aitutor-build`, `aitutor-inference-build` + `buildspec.yml`/`inference-buildspec.yml`) | **Cloud Build** (`cloudbuild.yaml`, global default worker pool) | Build ID `ad26bf4b-886b-459b-99ea-270be2a6306b` (3차 시도) | 🚧 진행 중 |
| 5 | CDN / 엣지 | **CloudFront** (`E2MP4BK1D16LJN`, `d2dcsdi9b1j2rf.cloudfront.net`) | (폐기 — Cloud Run 내장 HTTPS) | `*.run.app` 도메인 직접 사용 | ✅ 폐기 결정 (Phase 6 에서 실삭제) |
| 6 | 로드 밸런서 | **ALB** (`aitutor-alb` listener) | (폐기 — Cloud Run 내장 LB) | Cloud Run 자체가 LB + HTTPS 종료 | ✅ 폐기 결정 |
| 7 | 시크릿 관리 | **SSM Parameter Store** (`/aitutor/*`, 8개) | **Secret Manager** | `ANTHROPIC_API_KEY`, `AUTH_TOKEN_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `HF_API_KEY`, `LAW_API_OC`, `OPENAI_API_KEY`, `RESEND_API_KEY` (8개 모두) | ✅ Phase 2-b |
| 8 | 객체 스토리지 | **S3** (`aitutor-files-794531974010`, `aitutor-models-794531974010`, `aitutor-codebuild-src-794531974010`) | **Cloud Storage (GCS)** | `gs://aitutor-files-aifactory-494108` (asia-northeast3, 비공개) | ✅ Phase 2-c (버킷) / 🚧 데이터 마이그 (Phase 4 검증 후) |
| 9 | IAM (서비스 계정) | **IAM Role** (Lambda execution role) | **IAM** + **Service Account** | `aitutor-run@aifactory-494108.iam.gserviceaccount.com` | ✅ Phase 2-a |
| 10 | IAM (권한 부여) | Lambda 의 ECR/S3/SSM access | `roles/secretmanager.secretAccessor` (시크릿 8개) + `roles/storage.objectAdmin` (GCS 버킷) | 위 SA 에 부여 | ✅ Phase 2-b/c |
| 11 | 로깅 | **CloudWatch Logs** (`/aws/lambda/aitutor*`) | **Cloud Logging** | 자동 — Cloud Run 의 stdout/stderr → Logging | ✅ 자동 (코드 변경 0) |
| 12 | 메트릭 | **CloudWatch Metrics** (Invocations, Duration, Errors) | **Cloud Monitoring** | 자동 — Cloud Run 메트릭 (request count, latency, container CPU/mem/GPU) | ✅ 자동 |
| 13 | DNS | **Route 53** (도메인 매핑) | (사용 안 함) | `*.run.app` 직접 — Custom domain mapping 없음 | ✅ 결정 (§ 13) |
| 14 | TLS / 인증서 | **ACM** (CloudFront/ALB 인증서) | (사용 안 함) | Cloud Run 자동 (Google Trust Services, 자동 갱신) | ✅ 자동 |
| 15 | 결제 / 예산 | AWS **Budgets** | **Cloud Billing Budgets** | `aitutor-10usd` 예산 ($10, 50%/90%/100% 알림) | ✅ Phase 4 직전 |
| 16 | 인증 (앱 런타임) | Lambda execution role + AWS_ACCESS_KEY_ID 환경변수 | **ADC** (Application Default Credentials) | Cloud Run SA 자동 — env 키 불필요 | ✅ 자동 |
| 17 | 환경 감지 (앱 코드) | `process.env.AWS_LAMBDA_FUNCTION_NAME` | `process.env.K_SERVICE` | `api/signup.js` 의 isProduction 체크 | ✅ Phase 3-5 |
| 18 | DB | (Supabase 외부) | (Supabase 외부) | DATABASE_URL 그대로 — 마이그 0 | ✅ 변경 X |
| 19 | 외부 LLM API | (외부 — HF, Gemini, OpenAI, Claude) | (외부 — HF, Gemini, OpenAI, Claude) | API key 만 Secret Manager 로 위치 변경 | ✅ Phase 2 |

### 19.2 각 매핑의 마이그 작업 상세

#### ① Lambda Container → Cloud Run

**AWS 시절**
- 함수명: `aitutor` (Container, 3008 MB 메모리, 60s timeout)
- 트리거: ALB target → Lambda Invoke
- 한계: 60s timeout (CloudFront 60s 제한 + Lambda BUFFERED), GGUF 호환 불가, GPU 없음

**GCP 마이그 후**
- 서비스명: **`aitutor`** (Cloud Run, asia-northeast3)
- 스펙: 4 vCPU / 16 Gi RAM / **NVIDIA L4 24GB** / 600s timeout / concurrency 10 / min-instances=0 / max-instances=5
- 트리거: HTTP(S) 자동 (Cloud Run 내장)
- 콜드 스타트: ~30~60s (GPU + 모델 mount)
- idle 시 비용: $0

**코드 변경**
- 삭제: `lambda.js` (Lambda handler + SSM 부트스트랩)
- 삭제: `@codegenie/serverless-express` 의존성
- 수정: `Dockerfile` (Lambda base → multi-stage CUDA 12.4)
- 신규: `start.sh` (Ollama daemon + node server.js 동시 기동)
- 신규: `cloudbuild.yaml`
- 변경 없음: `server.js` 의 `app.listen(8080)` 부분 (이미 호환)

#### ② Lambda inference 함수 5개 → Cloud Run 단일 컨테이너 내부 daemon

**AWS 시절**
- 5개 별도 Lambda 함수: `aitutor-inference-e2b`, `aitutor-inference-e4b`, `aitutor-inference-qwen35-4b`, `aitutor-inference-e2b-gguf`, `aitutor-inference-e4b-gguf`
- 라우터: `aitutor-infer-router` (RESPONSE_STREAM, OAC SigV4 — 미해결)
- 호출 패턴: 메인 Lambda → SigV4 → inference Lambda Invoke API
- 별도 ECR 저장소 5개 + buildspec 1개

**GCP 마이그 후**
- **같은 Cloud Run 컨테이너 안의 daemon 들** (외부 호출 X — IPC 만)
  - Ollama (port 11434) — MVP active
  - llama.cpp server (port 11435) — Phase 5
  - vLLM (port 11436) — Phase 5
- model_key (e2b/e4b/qwen35-4b/e2b-gguf/e4b-gguf) → Ollama 모델 매핑

**코드 변경**
- 삭제: `scripts/server-infer-router/`, `scripts/inference-handler-py/`, `scripts/inference-handler-gguf/`
- 삭제: `inference-buildspec.yml`
- 수정: `api/server-infer.js` — SigV4 invokeLambda → `fetch('http://127.0.0.1:11434/api/chat')` (NDJSON stream → SSE 변환)
- 수정: `api/local-infer.js` — node-llama-cpp 직접 → 엔진 분기 (Ollama/llama-cpp/vLLM)

#### ③ ECR → Artifact Registry

**AWS 시절**
- 저장소: `aitutor` (ECR `794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor`)
- inference 별도 저장소 5개

**GCP 마이그 후**
- 저장소: `aitutor` (Artifact Registry, format=docker)
- URI: `asia-northeast3-docker.pkg.dev/aifactory-494108/aitutor/aitutor`
- 단일 저장소 (inference 별도 저장소 폐기)

**마이그 명령**
```bash
gcloud artifacts repositories create aitutor \
  --repository-format=docker \
  --location=asia-northeast3 \
  --project=aifactory-494108
```

#### ④ CodeBuild → Cloud Build

**AWS 시절**
- 프로젝트: `aitutor-build`, `aitutor-inference-build`
- 스펙: `buildspec.yml` (메인), `inference-buildspec.yml` (inference)
- 환경: `aws/codebuild/amazonlinux2-x86_64-standard:5.0`
- 모델 다운로드: HF → `./models/` (build 컨텍스트에 영구 패킹)

**GCP 마이그 후**
- 자동화: `cloudbuild.yaml` (3 step: docker build / push / Cloud Run deploy)
- 환경: Cloud Build default worker pool (global) + `E2_HIGHCPU_8`
- 모델 패킹 X — Ollama 가 첫 호출 시 자동 pull (또는 Phase 5 startup pre-pull)

**코드 변경**
- 삭제: `buildspec.yml`, `inference-buildspec.yml`
- 신규: `cloudbuild.yaml` (~30 라인)

**호출**
```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_TAG=v$(date +%Y%m%d-%H%M%S) \
  --project=aifactory-494108
```

#### ⑤ CloudFront → (폐기, Cloud Run 내장 HTTPS)

**AWS 시절**
- Distribution ID: `E2MP4BK1D16LJN`
- 도메인: `d2dcsdi9b1j2rf.cloudfront.net`
- 역할: HTTPS 종료, 60s OriginReadTimeout (504 timeout 의 원인)

**GCP 마이그 후**
- Cloud Run 자체가 HTTPS 종료 (Google Trust Services 인증서, 자동 갱신)
- 도메인: `https://aitutor-{hash}-an.a.run.app` (asia-northeast3)
- Custom domain X (REBUILD23 § 13 결정)

**Phase 6 에서 폐기**
```bash
aws cloudfront delete-distribution --id E2MP4BK1D16LJN --region us-east-1
```

#### ⑥ ALB → (폐기, Cloud Run 내장 LB)

**AWS 시절**
- Application Load Balancer + Lambda Target Group

**GCP 마이그 후**
- Cloud Run 자체가 LB 역할. 자동 scale-out (max-instances=5)

#### ⑦ SSM Parameter Store → Secret Manager

**AWS 시절**
- 경로: `/aitutor/*` (8개 시크릿)
- 부트스트랩: `lambda.js` 가 `GetParametersByPath` 로 일괄 로드 → `process.env` 주입

**GCP 마이그 후**
- 시크릿 8개 1:1 마이그 (이름 동일):
  ```
  ANTHROPIC_API_KEY, AUTH_TOKEN_SECRET, DATABASE_URL,
  GEMINI_API_KEY, HF_API_KEY, LAW_API_OC,
  OPENAI_API_KEY, RESEND_API_KEY
  ```
- 주입: Cloud Run `--update-secrets=KEY=KEY:latest` 로 환경변수 자동 주입 (앱 코드 변경 0)

**마이그 명령** (자동화)
```bash
aws ssm get-parameters-by-path --path "/aitutor/" --with-decryption \
  | jq -r '.Parameters[] | "\(.Name)\t\(.Value)"' \
  | while IFS=$'\t' read -r N V; do
    NAME=$(basename "$N")
    printf '%s' "$V" | gcloud secrets create "$NAME" --data-file=-
  done
```

#### ⑧ S3 → Cloud Storage (GCS)

**AWS 시절**
- 버킷: `aitutor-files-794531974010` (메모 첨부 + pool 업로드)
- 모델 버킷: `aitutor-models-794531974010` (별도, inference Lambda 가 다운로드)
- CodeBuild source 버킷: `aitutor-codebuild-src-794531974010`
- API: `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, `@aws-sdk/s3-request-presigner`

**GCP 마이그 후**
- 버킷: **`aitutor-files-aifactory-494108`** (asia-northeast3, 비공개, signed URL 만)
- 모델 버킷 폐기 — Cloud Run 컨테이너 내부 Ollama 가 자동 관리
- API: `@google-cloud/storage` (단일 패키지)

**코드 변경** (REBUILD23 § 17 참조)
- `api/upload-sign.js`: presigned POST → V4 signed PUT URL (단일 PUT)
- `api/memo-files.js`: `DeleteObjectCommand` → `bucket.file().delete({ ignoreNotFound: true })`
- `api/pool-upload.js`: `GetObjectCommand` → `bucket.file().download()` + `getMetadata()`
- DB 컬럼 `memo_files.s3_key` 그대로 유지 (의미만 GCS object key 로 재해석)

**환경변수** : `S3_FILES_BUCKET` → **`GCS_FILES_BUCKET`**

**데이터 마이그 (Phase 4 검증 후)**
```bash
gsutil -m rsync -r s3://aitutor-files-794531974010 gs://aitutor-files-aifactory-494108
# 또는: node scripts/migrate-s3-to-gcs.js
```

#### ⑨~⑩ IAM (서비스 계정 + 권한)

**AWS 시절**
- Lambda execution role + inline 정책 (S3 / SSM / ECR 권한)
- AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY 환경변수 (`api/server-infer.js` 의 SigV4)

**GCP 마이그 후**
- Service Account: **`aitutor-run@aifactory-494108.iam.gserviceaccount.com`**
- 권한:
  - `roles/secretmanager.secretAccessor` × 8 시크릿 (per-secret binding)
  - `roles/storage.objectAdmin` (GCS 버킷 한정)
- **AWS_ACCESS_KEY 시크릿 폐기** — Cloud Run SA 의 ADC 자동 인증

**마이그 명령**
```bash
# SA 생성
gcloud iam service-accounts create aitutor-run \
  --display-name="AI TutorTwo Cloud Run" \
  --project=aifactory-494108

# 시크릿 권한 (8개)
for s in ANTHROPIC_API_KEY AUTH_TOKEN_SECRET DATABASE_URL GEMINI_API_KEY HF_API_KEY LAW_API_OC OPENAI_API_KEY RESEND_API_KEY; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:aitutor-run@aifactory-494108.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done

# GCS 권한
gsutil iam ch \
  serviceAccount:aitutor-run@aifactory-494108.iam.gserviceaccount.com:objectAdmin \
  gs://aitutor-files-aifactory-494108
```

#### ⑪~⑫ CloudWatch (Logs / Metrics) → Cloud Logging / Monitoring

- 코드 변경 0. Cloud Run 의 stdout/stderr 가 자동으로 Cloud Logging 으로 들어감.
- Cloud Run 기본 메트릭 (request count, latency, container CPU/mem/GPU, instance count) 자동 수집.
- 콘솔: https://console.cloud.google.com/run/detail/asia-northeast3/aitutor?project=aifactory-494108

#### ⑮ AWS Budgets → Cloud Billing Budgets

**AWS 시절**
- AWS Budgets 콘솔 또는 CLI

**GCP 마이그 후**
- 예산 ID: `2dde0e70-f38b-4698-8396-5a31ae313f06`
- 이름: `aitutor-10usd`
- 한도: $10/월 (50% / 90% / 100% 임계 알림)
- 필터: `projects/aifactory-494108`

**마이그 명령**
```bash
gcloud billing budgets create \
  --billing-account=0193E0-B0D26B-FB31EB \
  --display-name="aitutor-10usd" \
  --budget-amount=10 \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --filter-projects=projects/aifactory-494108
```

#### ⑰ 환경 감지 (앱 코드)

**AWS 시절** : `process.env.AWS_LAMBDA_FUNCTION_NAME` 가 있으면 Lambda 실행 환경 판정

**GCP 마이그 후** : `process.env.K_SERVICE` 가 있으면 Cloud Run 실행 환경 판정 (Cloud Run 자동 주입 환경변수)

**코드** : `api/signup.js` 의 `isProduction` 체크에서 사용

#### ⑱~⑲ Supabase / 외부 LLM API (변경 없음)

- **Supabase DB** (PostgreSQL) — `DATABASE_URL` 그대로. 마이그 0.
- **HF Inference Providers / Gemini / OpenAI / Claude** — API key 만 Secret Manager 로 옮기고 코드 변경 없음.
- **장기적 latency** 관점: Supabase ap-northeast-2 ↔ GCP asia-northeast3 cross-cloud (ms 단위 추가). 검증 시 측정 필요 (REBUILD23 § 14.7).

### 19.3 폐기되는 AWS 리소스 (Phase 6, 1~2주 후)

```bash
# 검증 + 1~2주 안정 운영 후 일괄 폐기
aws cloudfront delete-distribution --id E2MP4BK1D16LJN --region us-east-1
aws elbv2 delete-load-balancer --load-balancer-arn ...
aws lambda delete-function --function-name aitutor
for f in aitutor-inference-{e2b,e4b,qwen35-4b,e2b-gguf,e4b-gguf} aitutor-infer-router; do
  aws lambda delete-function --function-name $f
done
aws ecr delete-repository --repository-name aitutor --force
for r in aitutor-inference-{e2b,e4b,qwen35-4b,e2b-gguf,e4b-gguf}; do
  aws ecr delete-repository --repository-name $r --force
done
aws codebuild delete-project --name aitutor-build --region ap-northeast-2
aws codebuild delete-project --name aitutor-inference-build --region ap-northeast-2
aws s3 rb s3://aitutor-files-794531974010 --force        # 데이터 GCS 마이그 검증 후
aws s3 rb s3://aitutor-models-794531974010 --force
aws s3 rb s3://aitutor-codebuild-src-794531974010 --force
for k in $(aws ssm describe-parameters --query "Parameters[?starts_with(Name, '/aitutor/')].Name" --output text); do
  aws ssm delete-parameter --name $k
done
```

### 19.4 신규 GCP 리소스 (이번 마이그 결과)

| 리소스 | 이름/ID | 위치 | 비고 |
|---|---|---|---|
| GCP 프로젝트 | `aifactory-494108` (project number 58235609672) | - | 기존 (사전에 생성) |
| Service Account | `aitutor-run@aifactory-494108.iam.gserviceaccount.com` | - | Phase 2-a 생성 |
| Artifact Registry | `aitutor` (docker) | asia-northeast3 | Phase 1 생성 |
| GCS 버킷 | `aitutor-files-aifactory-494108` | asia-northeast3 | Phase 2-c 생성, 비공개 |
| Secret Manager | 8개 시크릿 (이름 동일) | global (auto-replicate) | Phase 2-b |
| Cloud Run 서비스 | `aitutor` | asia-northeast3 | Phase 4 (배포 진행 중) |
| Cloud Build 빌드 | `ad26bf4b-886b-459b-99ea-270be2a6306b` 등 | global | 진행 중 |
| Billing Budget | `aitutor-10usd` (id `2dde0e70-...`) | - | $10 한도, 50/90/100% 알림 |

---

## 21. 사용자 결정 — 실험실 5개 영구 유지 + 컨셉 차이 보존 (2026-04-29 오후, 입장 변경)

### 21.1 결정 변경 이력

| 시점 | 결정 |
|---|---|
| 2026-04-29 오전 | "마이그 완료되면 즉시 삭제 예정" |
| 2026-04-29 오후 (REBUILD24 분석 후) | **5개 모두 영구 유지** — 컨셉이 다르므로 각자 유지 가치 있음. 충분한 실험실 검증 후 검증된 모델/엔진을 메인 AI 해설 시스템으로 promote |

### 21.2 5개 실험실 컨셉 차이 (모두 의미 있음)

| 실험실 | 고유 컨셉 |
|---|---|
| `hf-playground` | **외부 다중 provider 비교** — 14 providers, 122 모델 동시 비교 |
| `local-ai` | **클라이언트 측 추론** — 브라우저 WebGPU, 오프라인 가능 |
| `local-gcp` | **서버 일심동체** — Cloud Run 단일 컨테이너 + 엔진 교체 가능 (Ollama / llama.cpp / vLLM) |
| `server-ai` | **서버 ONNX 추론** — onnxruntime-genai (Python) 컨셉 |
| `server-ai-gguf` | **서버 GGUF 추론** — llama-cpp-python (Python) 컨셉 |

### 21.3 추가 작업 — 컨셉 차이 보존을 위해

| 실험실 | 1차 마이그 후 상태 | 추가 작업 |
|---|---|---|
| hf-playground | ✅ 그대로 | 없음 |
| local-ai | ✅ 그대로 | 없음 (선택: 모델 호스팅 GCS 미러로 한국 latency ↓) |
| local-gcp | 🚧 Ollama only (CPU) | GPU quota 승인 + **Phase 5: llama.cpp + vLLM 추가** (multi-stage devel base) |
| **server-ai** | ⚠ **컨셉 변형** — ONNX → Ollama 매핑 | **컨셉 복원**: onnxruntime-genai Python 추가 (같은 Cloud Run 컨테이너 OR 별도 service) |
| server-ai-gguf | ✅ 컨셉 일치 (Ollama=GGUF 기반) | Phase 5 의 llama.cpp server 활성 시 llama-cpp-python 컨셉에 더 정확 (Ollama 와 직접 비교 가능) |

### 21.4 실험실의 prod promotion 정책

> 사용자 의도: 실험실에서 충분히 검증된 모델/엔진만 메인 AI 해설 시스템 default 로 promote.

- 실험실 = R&D 도구 (영구 운영)
- 메인 AI 해설 = 검증 끝난 default + 사용자 선택 가능 (선택지 점진 확장)

### 21.5 자세한 분석은 별도 문서

- **`workspace/aitutor/REBUILD24.md`** — 5 실험실 정밀 분석 + 4 path 비교 + GCP native 활용 제안
- 본 결정 이후 REBUILD24 의 "시나리오 D — 5개 모두 유지 + 컨셉 차이 보존" 가 채택됨

---

## 20. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-04-29 | REBUILD23.md 최초 작성 (AWS → GCP 마이그레이션 계획) |
| 2026-04-29 | 사용자 확정 결정 반영: 진행 / 서울 / GPU 활성 (사용량 기반) / 추론 엔진 교체 가능 구조 / Supabase 유지 / *.run.app 도메인 / AWS 완전 제거. § 0.1~0.3, § 3.4, § 5 (Phase 5), § 9.2, § 13 갱신. § 14 메모리 클리어 후 재진입 가이드 추가. |
| 2026-04-29 | GCP 프로젝트 ID 확정: **`aifactory`**. 모든 명령어에 반영 (§ 5, § 13, § 14, § 15). |
| 2026-04-29 | 점검 결과 반영 (실험실 5개 모듈 + AWS 의존 누락 항목): § 6.2 수정 표 보강 (S3 의존 3파일, cors.js, signup.js, capacitor.config.json, src/labs/local-lambda rename, App.jsx 라우트 등). 실제 GCP 프로젝트 ID 확정: **`aifactory-494108`** (§ 13 갱신). |
| 2026-04-29 | **Storage 결정: A 옵션 (GCS 마이그)** — 신규 §17 추가. AWS 완전 폐기 원칙에 따라 S3 → GCS 마이그 (`@google-cloud/storage`, V4 signed URL, 데이터 복사 스크립트, IAM, 검증). § 13 결정 표에 Storage / 실험실 / billing 항목 추가. |
| 2026-04-29 | **§ 19 AWS↔GCP 서비스 상세 매핑 추가** — 19개 서비스별 마이그 작업 내역 (실제 리소스 ID/이름 + 마이그 명령 + 코드 변경). § 19.4 에 신규 GCP 리소스 일람표. § 18 변경이력 → § 20 으로 이동. |
| 2026-04-29 | **Phase 4 Cloud Run 라이브 + Stage 1 sanity check 통과** — 빌드 4차 시도 끝에 성공 (1차 `$COMMIT_SHA` 빈값 / 2차 zstd 누락 / 3차 nvcc 없음 → llama.cpp 제거 / 4차 GPU quota 0 → GPU 없이 배포). asia-northeast3 → **us-central1 리전 변경** (asia-northeast3/southeast1 GPU L4 미지원). 라이브 URL `https://aitutor-z2ppabmtxa-uc.a.run.app`. 검증: `/api/config` JSON / `/` SPA / `/api/questions` 401 / 콜드 스타트 1초. capacitor.config.json server.url 갱신. § 13, § 19.1 갱신. GPU quota 승인 대기 (실험실 추론에만 영향, 메인 앱 100% 작동). |
| 2026-04-29 | **Git 커밋 + push 성공 + 모바일 앱 재빌드** — commit `b2bdde4` (38 파일, 4826/4759 줄), GitHub Secret Scanner false positive 발견 (KISA 학습 자료의 의도된 가짜 API 키 패턴 — unblock 후 push 성공). `npm run cap:build` 통과 (Vite 2.45s + Capacitor sync iOS+Android). S3 → GCS 데이터 마이그 검토 — **메인 S3 버킷 비어있어 마이그 작업 0**, Phase 6 에서 빈 버킷 그대로 폐기. |
| 2026-04-29 | **Phase 4 보강 — q-images 이미지 누락 발견** — 사용자가 운영 SPA 에서 문제 이미지 못 불러옴 보고. 원인: 첫 작성한 `.gcloudignore` 의 `public/q-images` 패턴 (Write 도구 차단으로 수정 안 됨) → Cloud Build 컨텍스트에서 244개 학습 이미지 누락 → dist/q-images 빈 채로 빌드. 수정: `.gcloudignore` 에서 `public/q-images` 제거 + kisa-pool 등 큰 디렉토리 추가. cloudbuild.yaml 의 GPU 옵션 임시 주석화 (quota 0). 5차 빌드 시작 (Build ID `53713486-cf57-4fbd-a6a5-8753e3c9ff7e`, 880 파일 143.6 MiB). 사용자 결정 (실험실 폐기 예정) 메모리에 추가. |
| 2026-04-29 | **§ 21 신규 — 실험실 폐기 결정 + REBUILD24 작성 trigger** — 사용자 결정: 실험실 5개 (hf-playground / local-ai / local-gcp / server-ai / server-ai-gguf) GCP 마이그 완전 안정 후 즉시 폐기. 폐기 전 깊이 있는 분석 + GCP native 활용 검토 + 4 path 비교 + 폐기 영향 정량화를 별도 문서 **`REBUILD24.md`** 로 분리 작성. § 21 에 본 결정 + REBUILD24 위치 안내. |
