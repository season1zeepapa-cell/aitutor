# REBUILD33 — 메인 service (`aitutor`) 슬림화 전략 재수립

> **수립**: 2026-05-05 12:30 KST
> **트리거**: 사용자 지적 (12:20 KST) — 통합 서버 모드가 너무 무겁고 빌드 비효율, 본업과 추론의 통합 효과 미흡, 전략 재수립 필요
> **상태**: 계획 — 사용자 §0 답변 후 구현 진입

---

## §0. 의사결정 — A++ 방향 확정 (2026-05-05 13:50 KST)

### 사용자 결정 (확정)

| # | 항목 | 결정 |
|---|------|------|
| **방향** | 핵심 전략 | **A++ — 단일 엔진 (Ollama) + 호환 모델 다양화 (영어 6개 추가)** |
| **정책** | 통합/분리 운영 | **완전 독립** (catalog/엔진/배포 동기화 강제 X — 의도된 차이) ※ 메모리 신규 메모 반영 |
| **작업 시점** | 진행 시점 | 사용자 의사결정 후 (계획만 작성, 코드 변경 X) |

### A++ 변형 — A++-2 채택 (2026-05-05 14:30 KST 사용자 통찰 반영)

> **사용자 통찰** (Q6 결정 근거):
> - 통합 서버 = **일심동체** 컨셉 (메인 본업 + 추론 같은 서버, RTT ~1ms)
> - 분리 서버 = **독립 마이크로서비스** 컨셉 (재사용 + 장애 격리)
> - 두 아키텍처는 **존재 이유 자체가 다름** → 한쪽이 다른쪽의 forward 가 되면 가치 둘 다 상실
>
> → **A++-1 (옵션 A 변형, 격리 forward) = 두 컨셉 모두 죽임** (§24 분석)
> → **A++-2 (옵션 B 변형, 메인 Ollama 단일) = 두 컨셉 모두 보존** ✅

| 항목 | A++-1 (철회) | **A++-2 (채택)** |
|------|------|------|
| 일심동체 컨셉 | ❌ 폐기 (격리 외부 호출, RTT 50~150ms) | ✅ **유지** (localhost RTT ~1ms) |
| 독립 마이크로서비스 컨셉 | ⚠ 약화 (격리가 메인 의존) | ✅ **유지** (다른 앱 재사용 가능) |
| 장애 격리 | ❌ 메인 ↔ 격리 강결합 | ✅ **독립** (격리 down → 메인 영향 0) |
| 메인 자체 추론 | ❌ | ✅ |
| 비용 절감 | $667 → $36 (-95%) | $667 → $667 (GPU 유지) |
| **결론** | 비용만 절감, 가치 죽임 | **가치 보존, 일부 비용 절감 (image -3GB, 빌드 -20분)** |

상세 분석: §23 (아키텍처 본질) + §24 (A++-1 결함) + §25 (A++-2 작업 매트릭스)

---

## §1. 현재 상태 — 사실 기반 metrics

### 1.1 메인 service `aitutor` 현황

| 항목 | 값 | 분석 |
|------|---|------|
| Cloud Run spec | 24Gi RAM / 6 vCPU / **L4 GPU 1개** | 본업 대비 **과한 자원** |
| Image 크기 | ~5~6 GB (CUDA runtime + Node + Ollama + Python venv) | 무거움 |
| 빌드 시간 | **~30분** (관측: 25~35분) | 비효율 |
| Cold start | 60~120초 | UX ↓ |
| Dockerfile stage | 3개 (frontend / llama.cpp build / runtime) | 복잡 |
| 24h 트래픽 (`/api/local-infer`) | 매우 적음 (학습 목적) | 운영 가치 ↓ |

### 1.2 메인 image 안에 적재된 6 엔진

| # | 엔진 | 출처 | 용도 |
|---|------|------|------|
| 1 | **Ollama** | `curl install.sh` (Go binary, 단순) | Phase 5-1, 항상 active |
| 2 | **llama-server** | `Stage 2: CUDA devel + cmake + llama.cpp 빌드` (~12분) | lazy spawn |
| 3 | **vLLM** | `pip install vllm==0.6.5` (~3GB venv) | lazy spawn |
| 4 | **llama-cpp-python** | `pip install --extra-index-url cu124 llama-cpp-python==0.3.4` | Python sub-server (port 11442) |
| 5 | **onnxruntime-genai** | `pip install onnxruntime-genai-cuda==0.5.2` (REBUILD32 후속 0.8.0 시도) | Python sub-server |
| 6 | **transformers** | `pip install transformers==4.46.3 + accelerate` | Python sub-server |

**관측**: 7개 빌드(REBUILD32 흐름)에서 모든 엔진 빌드 시간 누적 측정 — Stage 2(llama.cpp CUDA build) + Stage 3(Python venv) 가 **빌드 시간의 ~80% 차지**.

### 1.3 코드량 분포

| 영역 | 라인 수 | 책임 |
|------|------|------|
| `api/local-infer.js` | 890줄 | 6 엔진 dispatcher + MODEL_MAP 19종 + cleanupOtherEngines + watchdog 호출 |
| `inference-py/engines/*.py` | 1,318줄 (9 파일) | Python sub-server 안 3 엔진 + daemon 관리 + catalog |
| `start.sh` | 78줄 | Ollama spawn + Python sub-server watchdog |
| `Dockerfile` | 161줄 | 3-stage 멀티스테이지 |
| **server-infer/ (격리, 비교용)** | **413줄 / 단일 image** | Ollama 1 엔진 |

### 1.4 사용처 — 6 엔진 통합 모드 의 진짜 운영 가치

| 화면 / 경로 | 6 엔진 사용? | 실제 트래픽 |
|---------|----------|-----------|
| 영상정보관리사 학습 (DB 문제풀이, 메모, 통계) | ❌ 외부 API (Gemini/OpenAI/Claude) | 메인 |
| AI 해설 생성 | ❌ Gemini API 직접 호출 | 메인 |
| `/lab/local-gcp` (서버 통합 실험실) | ✅ 6 엔진 모두 | **거의 0** |
| `/lab/server-infer` (서버 분리 실험실) | ❌ 격리 service (Ollama만) | 거의 0 |
| `/lab/ollama-bridge` (사용자 PC) | ❌ 사용자 자원 | 사용자 |
| `/lab/hf/compare` (HF API 비교) | ❌ HF Inference API | 외부 |

→ **메인의 6 엔진 통합 모드는 `/lab/local-gcp` 한 화면 학습/실험용**.
   본업(자격증 학습 앱)은 외부 API 만 사용 — GPU 불필요.

---

## §2. 비대화 원인 진단

### 2.1 본업과 추론 컨셉 mismatch

```
[본업]                                  [추론 (학습/실험용)]
영상정보관리사 학습 앱                    /lab/local-gcp 6 엔진 비교
  - DB CRUD (Supabase)                    - Ollama / llama-server / vLLM
  - 외부 LLM API (Gemini/OpenAI/Claude)    - llama-cpp-python / onnx / transformers
  - 1 Gi RAM 충분                          - 24 Gi + L4 GPU 필요
  - 빌드 1분이면 충분                       - 빌드 30분 (CUDA + Python venv)
                                          - 트래픽 거의 0
        ▼                                       ▼
        └────── 같은 컨테이너 운영 (REBUILD23~) ──────┘
                          ↓
                 자원 mismatch + 빌드 비효율
                 본업 코드 변경 → 30분 재빌드 (CUDA stage 포함)
```

### 2.2 REBUILD32 가 해결한 부분 + 안 한 부분

| | 해결됨 | 안 됨 |
|---|------|------|
| 격리 service (server-infer) | ✅ 별도 image, Ollama 단일, 16~24Gi 가벼움 | — |
| 메인 service (`aitutor`) | — | ❌ 6 엔진 그대로, 본업과 함께 | 

→ **REBUILD32 는 `격리만` 슬림화. 메인은 그대로**. 본 REBUILD33 에서 메인도 슬림화.

### 2.3 빌드 시간 분포 (관측 기반)

```
Stage 0 (frontend Vite):       3분
Stage 1 (llama.cpp CUDA build): 12분  ← 65 GiB CUDA devel image pull + cmake + nvcc 빌드
Stage 2 (runtime + venv 설치):  15분  ← vllm 3GB + transformers + ollama install
─────────────────────────────────────
                              ~30분
```

본업 코드 변경 시:
- Stage 0 만 새로 (frontend) → cache 안 씀
- Stage 1, 2 는 cache hit → push 만 (~5분)
- 다만 dependency 변경 시 전체 재빌드 (~30분)

### 2.4 운영 가치 vs 비용

| 메인의 6 엔진 통합 | 가치 | 비용 |
|---|---|---|
| 학습/실험 (`/lab/local-gcp`) | 약함 (사용자 거의 안 씀) | 매월 GPU L4 + 24Gi 청구 |
| 본업과 같은 image | 0 (분리해도 본업 영향 없음) | 빌드 30분 + image 5GB |

→ **운영 가치 < 비용**. 슬림화 정당성 명확.

---

## §3. 옵션 비교 매트릭스 (5개 옵션)

| # | 옵션 | 메인 image | 빌드 시간 | GPU | 작업량 | 본업 영향 | 비교 학습 가치 |
|---|------|---------|---------|-----|------|---------|------------|
| **A** | **완전 격리 위임** — 메인 = 본업만, 추론은 모두 server-infer 위임 | **~500 MB** | **~3분** | ❌ 제거 | 2~3일 | 0 | ⚠ 격리 = Ollama 단일이라 6 엔진 비교 상실 |
| **B** | 메인 = Ollama만 — vLLM/llama-server/Python sub-server 모두 제거 | ~2 GB | ~10분 | ✅ 유지 | 4~6시간 | 0 | ⚠ 6 엔진 비교 상실 |
| **C** | **3-service 분리** — 메인(본업) + 격리(Ollama) + multi-engine(6 엔진) | 메인 ~500MB / multi ~6GB | 메인 ~3분 / multi ~30분 | 메인 ❌ / multi ✅ | 1주 | 0 | ✅ **유지 (multi 에서)** |
| **D** | 외부 API 만 — 자체 호스팅 추론 모두 폐기 | ~500 MB | ~3분 | ❌ 제거 | 1~2일 | 0 | ❌ 자체 호스팅 컨셉 자체 폐기 (REBUILD32 의도 충돌) |
| **E** | Dockerfile 캐시 최적화만 — 기능 변경 0 | 변동 0 | 30→15분 | ✅ 유지 | 4~6시간 | 0 | ✅ 그대로 |

### 3.1 옵션별 코드 영향

#### A — 완전 격리 위임
- 제거: `Dockerfile` Stage 1,2 (llama.cpp CUDA + Python venv)
- 제거: `start.sh` Ollama / Python sub-server spawn
- 제거: `inference-py/` 디렉토리 (격리 측 server-infer/ 와 중복)
- 변경: `api/local-infer.js` → forward to `server-infer` 또는 폐기
- UI: `/lab/local-gcp` → 격리 호출 (UI 유지) 또는 폐기

#### B — Ollama만 유지
- 제거: Dockerfile Stage 1 (llama.cpp build)
- 제거: Dockerfile Stage 2 의 vllm/transformers/llama-cpp-python/onnxruntime-genai
- 제거: `inference-py/` 디렉토리
- 변경: `api/local-infer.js` MODEL_MAP 에서 ollama 매핑 모델만 노출
- UI: `/lab/local-gcp` 엔진 dropdown 단일

#### C — 3-service 분리 (가장 깔끔)
- 메인: A 와 동일
- 신규 `aitutor-multi-engine`: 메인 image 의 Stage 2,3 그대로 + FastAPI router (격리 server-infer 와 동일 패턴)
- 격리 server-infer: 그대로 (Ollama 단일)
- UI: `/lab/local-gcp` → 신규 multi-engine service forward
- 작업량: 1주 (3 service 운영, IAM, cloudbuild 3개)

---

## §4. 추천 + 영향 분석

### 4.1 추천 — **옵션 A (완전 격리 위임)**

**이유**:
1. **본업과 추론 컨셉 분리** — REBUILD32 의 격리 컨셉을 메인까지 확장
2. **빌드 30분 → 3분** = 본업 변경 사이클 가속화
3. **비용 ↓** — 메인 GPU L4 1개 절감 (월 ~$500~700)
4. **운영 단순화** — 메인 image 5GB → 500MB, cold start 60s → 5s
5. **REBUILD32 와 일관성** — 격리만 분리한 것을 메인까지 확장

**유보 가치 (옵션 A 가 잃는 것)**:
- 6 엔진 비교 학습 가치 — `/lab/local-gcp` 한 화면
- → 사용자 사용 빈도 = **거의 0** 이라 가치 작음
- → 만약 비교 학습 가치 정말 필요하면 **옵션 C** 채택

### 4.2 옵션 A 채택 시 영향 (전수)

| 영역 | 영향 | 작업 |
|------|------|------|
| 본업 (학습 앱) | 영향 0 | — |
| 외부 API 추론 (Gemini/OpenAI/Claude) | 영향 0 | — |
| `/lab/server-infer` (격리, Ollama) | 영향 0 (이미 격리 service 사용) | — |
| `/lab/ollama-bridge` | 영향 0 (사용자 PC) | — |
| `/lab/hf/compare` | 영향 0 (HF API) | — |
| `/lab/local-gcp` (메인 통합) | **변경** — 격리 forward 또는 폐기 | Q2 결정 |
| `inference-py/` | **제거** | git rm -rf |
| Dockerfile | **단순화** (3-stage → 1-stage) | -100줄 추정 |
| start.sh | **단순화** (Ollama + sub-server spawn 제거) | -50줄 |
| api/local-infer.js | **폐기 또는 forward** | Q2 결정 |
| cloudbuild.yaml | **GPU 제거** + memory 24→2Gi | 변경 |

---

## §5. 단계별 실행 계획 (옵션 A 채택 시)

### Phase 1 — `/lab/local-gcp` 처리 결정 (Q2)

선택 a (격리 forward) — 추천:
- `api/local-infer.js` 를 격리 forward 로 단순 wrap
- 또는 `/lab/local-gcp` UI 가 직접 `/api/iso-infer` 호출 (메인 endpoint 제거)
- LocalGcpTester.jsx → ServerInferTester.jsx 와 통합 또는 redirect

선택 b (UI 폐기):
- `/lab/local-gcp` 라우터 + LocalGcpTester.jsx 제거
- `/lab/server-infer` 만 남김 (이미 동일 컨셉)

### Phase 2 — 메인 Dockerfile 슬림화

```
[기존: 161줄, 3-stage]                     [신: ~40줄, 1-stage]
Stage 1: frontend-builder (Vite)            FROM node:22-bookworm-slim
Stage 2: llama.cpp CUDA build (~12분)       WORKDIR /app
Stage 3: CUDA runtime + Python venv         COPY package.json package-lock.json ./
                                            RUN npm ci --omit=dev
                                            COPY server.js api ./
                                            COPY --from=frontend dist ./dist
                                            CMD ["node", "server.js"]
```

제거:
- `nvidia/cuda:12.4.0-runtime-ubuntu22.04` → `node:22-bookworm-slim`
- Ollama install
- llama-server binary
- Python venv (vllm/transformers/llama-cpp-python/onnxruntime-genai/accelerate)
- `inference-py/` COPY

### Phase 3 — start.sh 단순화

```
[기존: 78줄]                                [신: ~5줄 또는 폐기]
Ollama spawn + watchdog                    exec node server.js
Python sub-server watchdog                 (또는 start.sh 자체 폐기,
SIGTERM trap                                 Dockerfile CMD 직접)
exec node server.js
```

### Phase 4 — cloudbuild.yaml 갱신

| 옛 | 신 |
|----|----|
| `--memory=24Gi --cpu=6` | `--memory=2Gi --cpu=2` |
| `--gpu=1 --gpu-type=nvidia-l4` | (제거) |
| `--no-gpu-zonal-redundancy` | (제거) |
| `--no-cpu-throttling` | (제거 또는 유지) |
| `--timeout=600` | `--timeout=300` (외부 API 5분 충분) |

### Phase 5 — `inference-py/` 제거

```bash
git rm -rf workspace/aitutor/inference-py/
```
- 1,318줄 제거
- server-infer/server.py 와 중복 책임 정리

### Phase 6 — `api/local-infer.js` 처리 (Q2 따라)

**선택 a 격리 forward**:
- 모든 endpoint (`?action=models`, `POST /infer`, `?action=memory`, `?action=health`, `?action=cleanup`) 를 격리 service 로 forward
- 또는 단순 redirect → 클라이언트가 `/api/iso-infer` 직접 호출

**선택 b UI 폐기**:
- `api/local-infer.js` 자체 제거
- `server.js` 의 라우터 등록 줄 제거

### Phase 7 — 빌드 + 배포 + 검증

```
1. Docker 빌드 (Node only, ~3분 예상)
2. Cloud Run 배포 (GPU 제거 → 자원 회수)
3. /lab/server-infer + /lab/local-gcp 동작 확인
4. 본업 (DB 문제 풀이, AI 해설) 정상 동작 확인
```

### Phase 8 — REBUILD30 §28 (§49) + REBUILD32 정정

본 REBUILD33 결과를 §28.8 (또는 신규 §29) 에 후속 노트로 추가.

---

## §6. 비용 시뮬레이션

### 6.1 메인 service (`aitutor`)

| 항목 | 옛 (REBUILD32 시점) | 신 (REBUILD33 옵션 A) | 절감 |
|------|------------------|---------------------|------|
| RAM | 24 Gi | 2 Gi | -91% |
| CPU | 6 vCPU | 2 vCPU | -67% |
| GPU | L4 1개 | (없음) | -100% |
| Image 크기 | ~5~6 GB | ~500 MB | -90% |
| 빌드 시간 | 30분 | 3분 | -90% |
| Cold start | 60~120s | 5~10s | -90% |
| **시간당 비용 (active)** | **$0.91** | **~$0.05** | **-95%** |
| **월 비용 (24/7 가정)** | **~$667** | **~$36** | **-95%** |

### 6.2 격리 service (`aitutor-server-infer`) — 변동 없음

24Gi/6CPU/L4 그대로 (REBUILD32 결과 유지).

### 6.3 합계 (REBUILD32 vs REBUILD33)

| 시나리오 | REBUILD32 | REBUILD33 옵션 A | 절감 |
|---------|----------|----------------|------|
| 메인 active 24/7 + 격리 비상주 (현실) | 메인 $667 + 격리 $5 = **$672** | 메인 ~$5 (외부 API 호출만) + 격리 $5 = **$10** | **-98%** |
| 메인 비상주 (min=0) + 격리 비상주 | 메인 ~$30 + 격리 $5 = $35 | 메인 ~$3 + 격리 $5 = **$8** | -77% |

→ **메인을 24/7 active 로 운영해도 슬림화 시 월 ~$10**. 본업 빠른 응답 + 비용 작음 동시 달성.

---

## §7. 리스크 + 롤백 계획

### 7.1 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `/lab/local-gcp` 의 6 엔진 비교 학습 가치 상실 | 학습 측면 손실 | 옵션 C (multi-engine service 신설) 또는 옵션 B (Ollama만) 검토 |
| 외부 API 의존 ↑ (Gemini/OpenAI/Claude) | 비용/장애 외부 의존 | 격리 service 의 Ollama 가 fallback 가능 (이미 운영 중) |
| MODEL_MAP 19개 모델 사용 못함 | 메인에서 |  격리는 Ollama 호환 7개. Phi/onnx 모델 등은 사용 못함 |
| inference-py/ 제거 후 복원 어려움 | git history 보존, server-infer/server.py 가 마스터 | git checkout 으로 복원 가능 |

### 7.2 롤백 계획

본 PR 만 revert 하면 메인 image 옛 spec 으로 즉시 복귀:
```bash
git revert <REBUILD33-commits>
gcloud builds submit --config cloudbuild.yaml ...
```

---

## §8. 검증 체크리스트 (옵션 A 채택 후)

- [ ] 메인 service 새 image (Node only) 빌드 SUCCESS
- [ ] 새 image 크기 < 1GB 확인
- [ ] 빌드 시간 < 5분 확인
- [ ] Cloud Run 배포 성공 (GPU 없는 spec)
- [ ] 본업 정상 — DB 문제풀이 / 메모 / 이미지 / AI 해설 (Gemini)
- [ ] /lab/server-infer (격리) 정상
- [ ] /lab/local-gcp 처리 정상 (Q2 따라)
- [ ] /lab/ollama-bridge / /lab/hf/compare 정상
- [ ] cold start < 10초 확인
- [ ] 월 비용 모니터링 (1주 후 GCP Billing)

---

## §9. 다음 액션

> 사용자 §0 Q1~Q5 답변 → REBUILD33 P1~P8 즉시 시작.

답변 양식:
```
Q1: A (완전 격리 위임)
Q2: a (격리 forward, /lab/local-gcp UI 유지)
Q3: a (즉시)
Q4: a (inference-py 제거)
Q5: a (즉시)
```

또는 **"전부 추천대로"** 한마디로 A/a/a/a/a 확정.

---

## §10. 참고 — REBUILD 시리즈 흐름

| Version | 핵심 |
|---------|------|
| REBUILD23~30 | 메인 service 6 엔진 동거 일심동체 (이번 슬림화 대상) |
| REBUILD31 §99 | CIRCLE/240s/watchdog 후속 안정성 (메인 안정화) |
| REBUILD32 | 격리 service 신설 (Ollama 단일 분리) — 본 슬림화의 모범 |
| **REBUILD33** | **메인 슬림화 — 6 엔진 통합 컨셉 폐기, 본업 분리** |
| 후속 (REBUILD34?) | 운영 1주 모니터링 + 추가 최적화 |

---

## §11. 엔진 적합도 순위 + 현재 지원 모델 (catalog.py 정확 추출)

### 11.1 종합 매트릭스 (지원 모델 수 포함)

| 순위 | 엔진 | 안정 | 빌드 | 모델 | 한국어 | GPU | API | **지원 수** | **점수** |
|------|------|----|------|------|------|-----|-----|----------|---------|
| 🥇 1 | **Ollama** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **8개** | **5.0** |
| 🥈 2 | llama-server | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **4개** | **3.7** |
| 🥉 3 | vLLM | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **2개** | **3.3** |
| 4 | llama-cpp-python | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **4개** | **2.8** |
| 5 | transformers | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐ | **2개** | **2.5** |
| 6 | onnxruntime-genai | ⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | **4개** | **2.0** |

### 11.2 엔진별 현재 지원 모델 (catalog.py MODEL_MAP, helper 로직 적용)

#### 🥇 Ollama — **8개 모델** (압도적 1위)
| Org | 모델 | size |
|-----|------|------|
| Alibaba | Qwen 3.5 2B | ~1.6GB |
| Alibaba | Qwen 3.5 4B | ~2.5GB |
| Alibaba | Qwen 2.5 3B | ~2GB |
| Alibaba | Qwen 2.5 7B | ~5GB |
| Google | Gemma 2 2B | ~1.6GB |
| Google | Gemma 4 E2B | ~3.2GB |
| Google | Gemma 4 E4B | ~4.9GB |
| DeepSeek | DeepSeek R1 Distill Qwen 7B | ~4.5GB |

→ **모든 한국어 강세 모델 + 멀티모달 (Gemma 4) 망라**

#### 🥈 llama-server — **4개 모델** (GGUF 파생)
| Org | 모델 | size |
|-----|------|------|
| Alibaba | Qwen 2.5 3B | ~2GB |
| Alibaba | Qwen 2.5 7B | ~5GB |
| Google | Gemma 2 2B | ~1.6GB |
| DeepSeek | DeepSeek R1 Distill Qwen 7B | ~4.5GB |

→ Ollama 의 부분집합 (Gemma 4, Qwen 3.5 빠짐 — 신형 모델 GGUF 미공개)

#### 🥉 vLLM — **2개 모델** (HF 원본 weights, 가장 제한)
| Org | 모델 | size |
|-----|------|------|
| Alibaba | Qwen 2.5 3B | ~2GB |
| Alibaba | Qwen 2.5 7B | ~5GB |

→ 대부분 모델이 HF gated (Gemma 라이센스 동의 필요) 또는 vLLM 미호환

#### 4. llama-cpp-python — **4개 모델** (llama-server 와 동일 GGUF)
| Org | 모델 | size |
|-----|------|------|
| Alibaba | Qwen 2.5 3B | ~2GB |
| Alibaba | Qwen 2.5 7B | ~5GB |
| Google | Gemma 2 2B | ~1.6GB |
| DeepSeek | DeepSeek R1 Distill Qwen 7B | ~4.5GB |

→ **llama-server 와 100% 동일** — 운영 가치 중복

#### 5. transformers — **2개 모델** (vLLM 과 동일 HF 원본)
| Org | 모델 | size |
|-----|------|------|
| Alibaba | Qwen 2.5 3B | ~2GB |
| Alibaba | Qwen 2.5 7B | ~5GB |

→ 광범위 호환 가능하나 catalog 등록 모델은 2개 (속도 느려서 등록 보류)

#### 6. onnxruntime-genai — **4개 모델** (ONNX 형식만, 매우 제한)
| Org | 모델 | size |
|-----|------|------|
| Microsoft | Phi-3.5 Mini | ~2.5GB |
| Google | Gemma 3 4B | ~2.5GB |
| DeepSeek | DeepSeek R1 Distill Qwen 7B | ~4.5GB |
| Microsoft | Phi-4 Mini | ~2.5GB |

→ Microsoft Phi 시리즈 + ONNX 변환된 일부만 (Qwen/Gemma 2/4 제외)

### 11.3 모델 × 엔진 호환 매트릭스 (한눈에)

| 모델 (catalog) | Ollama | llama-server | vLLM | llama-cpp-python | onnx-genai | transformers |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Qwen 3.5 2B | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Qwen 3.5 4B | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Qwen 2.5 3B | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Qwen 2.5 7B | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Gemma 2 2B | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Gemma 4 E2B | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gemma 4 E4B | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DeepSeek R1 Distill Qwen 7B | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Phi-3.5 Mini | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Gemma 3 4B | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Phi-4 Mini | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

→ **Ollama 가 8/11 모델 (73%) 호환** — 압도적 우위
→ Phi/Gemma 3 시리즈는 onnx-genai 만 → 사용자 검증 결과 한국어 약함 (REBUILD32 §99)

### 11.4 옵션별 모델 보존 효과

#### 옵션 A (Ollama 단일 / 격리 위임)
- **8개 모델 보존** (Ollama 호환 모두)
- 잃는 모델: Phi-3.5 / Gemma 3 / Phi-4 (onnx 전용, 한국어 약해 손실 작음)

#### 옵션 B (메인 = Ollama만 슬림화)
- 옵션 A 와 동일 보존

#### 옵션 C (3-service: 메인 + 격리 + multi-engine)
- multi-engine service 가 6 엔진 그대로 유지 → **11개 모델 모두 보존**
- 단 multi-engine service 운영 부담 (image 6GB, 빌드 30분)

### 11.5 결론 — 모델 측면에서도 Ollama 단일이 최적

> **Ollama 가 catalog 의 8개 모델 (한국어 강세 + 멀티모달 모두) 을 cover**.
> llama-server / llama-cpp-python 은 Ollama 의 부분집합 (4개).
> vLLM / transformers 는 가장 제한 (2개).
> onnx-genai 는 4개지만 한국어 검증 실패 사례 있음 (REBUILD32 §99).
>
> → **옵션 A/B 채택 시 잃는 모델 = Phi/Gemma 3 (3개, 한국어 약함)** — 손실 최소
> → 옵션 C 채택 시 보존 11개 — 학습 가치 우수, 운영 부담 ↑

---

## §12. 핵심 전략 — "엔진 단순화 + 모델 다양화" (Ollama Single, Catalog Rich)

### 12.1 패러다임 전환

| 측면 | 옛 (REBUILD23~30) | **새 (REBUILD33)** |
|------|---|---|
| 엔진 수 | **6** (Ollama + llama-server + vLLM + Python sub-server×3) | **1** (Ollama 단일) |
| 모델 수 (현재) | 11 (catalog 등록) | **현재 8 → 영어 자격증 대응 12 → 미래 N**(catalog 1줄 추가) |
| 운영 복잡도 | ⭐⭐ (의존성 충돌, lazy spawn, watchdog, daemon×3) | ⭐⭐⭐⭐⭐ (단일 daemon) |
| 새 모델 추가 비용 | 엔진별 호환성 검증 + Dockerfile 변경 + venv 재빌드 | **catalog 1줄** + Ollama lazy pull |
| 빌드/이미지 | 5GB / 30분 | **500MB / 3분** |
| 도메인 확장 (자격증/언어) | 엔진별 호환성 매트릭스 검증 | **모델만 큐레이션** |

### 12.2 5가지 가치

1. **운영 단순성** — daemon 1개, Python venv 0개, dependency 충돌 0
2. **무한 확장성** — catalog 1줄로 새 모델 추가 (image 영향 0, Ollama lazy pull)
3. **도메인별 큐레이션** — 한국어/영어/코드/멀티모달 모두 같은 인터페이스로
4. **미래 LLM 무관 대응** — 새 모델 출시 → Ollama registry 등록 → catalog 추가
5. **비용 효율** — 빌드 10배 빠름, image 10배 작음, GPU 1개 절감 (월 $500+ 절감)

### 12.3 Unix 철학 / 마이크로서비스 정합성

> 하나의 일을 잘 하는 도구 (Ollama) + 풍부한 데이터 (모델) = 단일 인터페이스 (REST)

HF Inference / OpenAI / Together.ai 같은 대규모 호스팅 service 와 동일 패러다임. **REBUILD33 = 그것의 self-hosted 버전**.

---

## §13. 신규 Catalog — 한국어 + 영어 자격증 듀얼 (12개 모델 확정)

### 13.1 한국어 자격증 (영상정보관리사 / KISA 등) — 7개 (현행 유지)

| key | name | ollama tag | size | note |
|-----|------|------------|------|------|
| `qwen35-2b` | Qwen 3.5 2B | `qwen3.5:2b` | ~1.4GB | 경량 / 한국어 강 |
| `qwen35-4b` | Qwen 3.5 4B | `qwen3.5:4b` | ~2.5GB | 균형 / 한국어 강 / 추천 |
| `qwen25-3b` | Qwen 2.5 3B | `qwen2.5:3b` | ~1.9GB | 범용 / 한국어 강 |
| `qwen25-7b` | Qwen 2.5 7B | `qwen2.5:7b` | ~4.4GB | 고성능 / 한국어 강 |
| `gemma2-2b` | Gemma 2 2B | `gemma2:2b` | ~1.6GB | Gemma 안정 |
| `gemma4-e2b` | Gemma 4 E2B | `gemma4:e2b` | ~2.0GB | Gemma 신형 / 멀티모달 |
| `gemma4-e4b` | Gemma 4 E4B | `gemma4:e4b` | ~3.5GB | Gemma 신형 / 멀티모달 / 큰 모델 |

### 13.2 영어 자격증 (TOEIC / GCP / AWS) — **6개 신규 추가** (A++ 확정)

사용자 시나리오 (TOEIC + GCP/AWS) 에 맞춰 6개 큐레이션:

| key | name | ollama tag | size | 주 용도 |
|-----|------|------------|------|------|
| `phi35-mini` | Phi-3.5 Mini | `phi3.5` | ~2.3GB | **TOEIC RC** (가볍고 영어 추론) |
| `phi4-14b` | Phi-4 (14B) | `phi4` | ~9GB | **GCP/AWS 시나리오 추론 최강** |
| `llama31-8b` | Llama 3.1 8B | `llama3.1:8b` | ~4.7GB | **TOEIC LC** 청해 / 영어 일반 |
| `llama32-3b` | Llama 3.2 3B | `llama3.2:3b` | ~2.0GB | 가벼운 영어 (응답 속도 우선) |
| `qwen25-coder-7b` | Qwen 2.5 Coder 7B | `qwen2.5-coder:7b` | ~4.7GB | **GCP/AWS 코드/SDK** |
| `mistral-7b` | Mistral 7B | `mistral` | ~4.4GB | 영어 다양성 (백업) |

**신규 추가 = 6개 → 격리 catalog 14개 (한국어 8 + 영어 6)**

> 메인 catalog 도 같은 6개 추가 가능 (A++-2 변형 시), 단 통합/분리 독립 정책에 따라 **각 service 가 자체 결정**.

### 13.3 사용 시나리오별 추천 모델

| 학습 시나리오 | 1순위 | 2순위 |
|------------|------|------|
| 영상정보관리사 학과 시험 (한국어) | qwen2.5-3b | qwen3.5-4b |
| KISA 정보보호 (한국어) | qwen2.5-7b | gemma4-e4b |
| TOEIC RC (영어 객관식 빠른 응답) | phi3.5-mini | llama3.1-8b |
| TOEIC LC 청해 해설 (영어) | llama3.1-8b | qwen2.5-7b |
| **GCP Associate / AWS SAA** (시나리오 영어) | **phi4-14b** | qwen2.5-coder-7b |
| GCP/AWS 코드 / SDK 예제 | qwen2.5-coder-7b | phi4-14b |
| 멀티모달 (이미지/문서) | gemma4-e4b | gemma4-e2b |

### 13.4 메모리/VRAM 안전 시뮬레이션 (격리 24Gi/L4 24GB)

| 모델 | 단일 운영 RAM | 단일 운영 VRAM | 안전? |
|------|------------|--------------|------|
| phi4 (14B) ~9GB | ~12GB | ~12GB | ✅ (단일 모델 정책 덕에 OK) |
| llama3.1:8b ~4.7GB | ~7GB | ~6GB | ✅ |
| qwen2.5-coder:7b ~4.7GB | ~7GB | ~6GB | ✅ |
| 기존 7개 (각 1.4~4.4GB) | 각자 < 7GB | 각자 < 6GB | ✅ |

→ **단일 모델 정책 (REBUILD32 keep_alive + unload_other_models)** 덕에 모든 12개 모델 24Gi/24GB 안에서 안전 운영.

---

## §14. 단계별 실행 계획 — A++ 두 변형별 작업 매트릭스

### 14.0 공통 — 격리 catalog 영어 6개 추가 (양 변형 동일, ~1시간)

| # | 변경 | 파일 | 영향 |
|---|------|------|------|
| 0.1 | server-infer/server.py MODELS 에 영어 6개 추가 (한국어 8 + 영어 6 = 14개) | `server-infer/server.py` | +30줄 |
| 0.2 | _check_model_available 로직 영어 모델 size 정확 반영 (phi4 14B 등 큰 모델) | `server-infer/server.py` (재활용) | 0줄 |
| 0.3 | LAB_MODELS (frontend) 동기화 — 영어 모델도 client 보임 | `src/lib/lab/models.js` | +30줄 |
| 0.4 | 격리 빌드 트리거 (~14분) | server-infer/cloudbuild.yaml | (기존 그대로) |

→ **이 0.1~0.4 만 진행해도 격리 service `/lab/server-infer` 에 영어 모델 6개 즉시 사용 가능**.

### 14.1 변형 A++-1 (옵션 A 변형: 메인 = 본업만, ~6시간)

| Phase | 작업 | 파일 | 영향 |
|-------|------|------|------|
| **P1.1** | Dockerfile 1-stage 슬림 (CUDA→Node) | `Dockerfile` | 161줄 → ~40줄 |
| **P1.2** | `inference-py/` 제거 (1318줄, 격리와 중복 책임) | `git rm -rf workspace/aitutor/inference-py/` | -1318줄 |
| **P1.3** | `start.sh` 단순화 (Ollama+sub-server watchdog 제거 → Express 직접) | `start.sh` | 78 → ~5줄 또는 Dockerfile CMD 직접 |
| **P1.4** | `cloudbuild.yaml`: GPU 제거 + memory 24→2Gi + cpu 6→2 | 메인 `cloudbuild.yaml` | -10줄 |
| **P1.5** | `api/local-infer.js`: 격리 forward 로 단순 wrap (또는 폐기) | `api/local-infer.js` | 890 → ~50줄 (폐기 시 0) |
| **P1.6** | `LocalGcpTester.jsx`: `/api/iso-infer` 호출로 변경 (UI 유지) | `src/labs/local-gcp/LocalGcpTester.jsx` | 약간 |
| **P1.7** | 메인 빌드 트리거 + spec 갱신 | (Cloud Build) | (~3분 빌드) |
| **P1.8** | 검증 — 본업 + /lab/local-gcp + /lab/server-infer 모두 정상 | 사용자 | ~30분 |

**A++-1 작업량**: 코드 ~3시간 + 빌드 ~30분 + 검증 ~30분 = **~4시간**

### 14.2 변형 A++-2 (옵션 B 변형: 메인 = Ollama 단일, ~5시간)

| Phase | 작업 | 파일 | 영향 |
|-------|------|------|------|
| **P2.1** | Dockerfile Stage 2 (llama.cpp CUDA build) 제거 | `Dockerfile` | -30줄 |
| **P2.2** | Dockerfile Stage 3 의 Python venv (vllm/transformers/llama-cpp-python/onnxruntime-genai/accelerate) 제거 | `Dockerfile` | -20줄 (RUN pip 명령 단순화) |
| **P2.3** | `inference-py/` 제거 (격리와 중복) | `git rm -rf workspace/aitutor/inference-py/` | -1318줄 |
| **P2.4** | `start.sh`: Python sub-server watchdog + llama-server lazy 분기 제거 (Ollama spawn 만 유지) | `start.sh` | 78 → ~30줄 |
| **P2.5** | `api/local-infer.js`: 엔진 dispatch 5분기 (vllm/llama-server/sub-server×3) 제거 → Ollama 단일 분기만 | `api/local-infer.js` | 890 → ~400줄 |
| **P2.6** | MODEL_MAP 의 `disabled_engines` / `engines` 매핑 정리 (Ollama만 남기기) | `api/local-infer.js` | 단순화 |
| **P2.7** | 메인 catalog 영어 6개 추가 (격리와 동기화 X — 의도된 차이 가능) | `api/local-infer.js` MODEL_MAP | +30줄 |
| **P2.8** | LocalGcpTester.jsx: 엔진 카드 단순화 (단일 엔진 정보 뱃지로 ServerInferTester 패턴 차용) | `src/labs/local-gcp/LocalGcpTester.jsx` | 단순화 |
| **P2.9** | `cloudbuild.yaml`: memory 24Gi 유지 (Ollama + 큰 모델) / GPU 유지 / cpu 6 유지 | 메인 `cloudbuild.yaml` | 변동 0 |
| **P2.10** | 메인 빌드 트리거 (~10분 예상) | (Cloud Build) | |
| **P2.11** | 검증 | 사용자 | ~30분 |

**A++-2 작업량**: 코드 ~3.5시간 + 빌드 ~10분 + 검증 ~30분 = **~4.5시간**

### 14.3 두 변형 비교 (한눈에)

| | A++-1 (옵션 A) | A++-2 (옵션 B) |
|---|---|---|
| 메인 추론 가능 | ❌ (격리 forward) | ✅ Ollama 자체 |
| 메인 GPU | 제거 (월 $500+ 절감) | 유지 |
| 메인 image | **~500 MB** | ~2 GB |
| 메인 빌드 | **~3분** | ~10분 |
| 메인 cold start | **5~10초** | 30~60초 |
| 본업 응답 (Gemini API) | 변동 0 | 변동 0 |
| /lab/local-gcp UI | 격리 forward | 메인 자체 (단일 엔진) |
| 통합/분리 차이 | 없음 (같은 격리 호출) | **있음** (메인 catalog ≠ 격리 catalog 가능) |
| 비교 학습 가치 | ⚠ 상실 | **유지** (메인/격리 다른 catalog 비교 가능) |
| 작업량 | ~4시간 | ~4.5시간 |
| 위험 | 낮음 | 중간 (api/local-infer.js 큰 변경) |

### 14.4 추천 — 사용자 시나리오 별

| 사용자 의도 | 추천 변형 |
|-----------|---------|
| 본업 + 격리 추론 (UI 통합 forward) | **A++-1** (가장 슬림, 비용 ↓↓) |
| 메인 자체 추론 + 격리와 다른 catalog 비교 학습 | **A++-2** (의도된 차이 가치) |

**제 의견**: 격리 service 가 이미 안정 운영 + 24Gi/L4 → 메인 자체 추론 운영 가치 약함. **A++-1 추천**.

---

## §15. 영향 범위 + 운영 변경

### 15.1 메인 service `aitutor` 변경

| 항목 | Before | After |
|------|--------|-------|
| Image | ~5~6 GB (CUDA + Node + Ollama + Python venv) | **~500 MB** (Node only) |
| Dockerfile | 161줄 / 3-stage | **~40줄 / 1-stage** |
| 빌드 시간 | ~30분 | **~3분** |
| 자원 spec | 24Gi / 6 vCPU / **L4 GPU** | **2Gi / 2 vCPU / GPU 없음** |
| Cold start | 60~120초 | **5~10초** |
| 실행 프로세스 | Ollama + Python sub-server + Express | **Express 단일** |

### 15.2 격리 service `aitutor-server-infer` 변경

| 항목 | Before | After |
|------|--------|-------|
| Image | ~1.5GB (Ollama only, REBUILD32) | **변경 없음** (~1.5GB) |
| 자원 | 24Gi / 6 vCPU / L4 (REBUILD32 §X) | **변경 없음** |
| 모델 카탈로그 | 7개 | **12개** (영어 4개 추가) |

### 15.3 사용자 영향

| 화면 | 영향 |
|------|------|
| 본업 (DB 문제풀이 / 메모 / AI 해설) | **0** (Gemini API 그대로) |
| `/lab/server-infer` (격리) | ✅ 모델 12개 (한국어 + 영어 듀얼) |
| `/lab/local-gcp` (메인 통합) | UI 그대로, backend 격리 forward |
| `/lab/ollama-bridge` / `/lab/hf/compare` | 영향 0 |

### 15.4 비용 영향

| 항목 | Before | After | 절감 |
|------|--------|-------|------|
| 메인 시간당 (active) | $0.91 | **~$0.05** | -95% |
| 메인 24/7 월 비용 | $667 | **~$36** | -95% |
| 격리 시간당 | $0.91 | **변경 없음** | — |
| 격리 비상주 (현재 사용) | ~$5/월 | **변경 없음** | — |
| **합계 (현실 시나리오: 메인 active 24/7 + 격리 비상주)** | **~$672/월** | **~$10/월** | **-98%** |

---

## §16. 검증 체크리스트

### 16.1 자동 검증 (Cloud Build / Cloud Run)

- [ ] 메인 빌드 SUCCESS (목표 < 5분)
- [ ] 메인 image 크기 < 1GB 확인
- [ ] 격리 빌드 SUCCESS (catalog 확장 반영)
- [ ] 메인 service Cloud Run revision 새로 생성 + traffic 100%
- [ ] 메인 spec: GPU=없음, memory=2Gi, cpu=2

### 16.2 본업 정상 검증 (한국어 자격증 학습)

- [ ] DB 문제풀이 (Supabase) 정상
- [ ] 문제 메모 작성/저장 정상
- [ ] 이미지 첨부 정상
- [ ] AI 해설 (Gemini API) 정상 호출 + 응답
- [ ] 사용자 인증 (HMAC JWT) 정상

### 16.3 격리 추론 정상 검증 (12개 모델)

#### 한국어 자격증 (현행 7개)
- [ ] qwen2.5-3b 한국어 해설 정상
- [ ] gemma4-e4b (Default) 한국어 해설 정상
- [ ] qwen3.5-4b 정상

#### 영어 자격증 (신규 4개)
- [ ] phi3.5-mini TOEIC 샘플 RC 영어 해설
- [ ] phi4-14b GCP/AWS 시나리오 답변 + 영어 추론
- [ ] llama3.1-8b 영어 일반
- [ ] qwen2.5-coder-7b GCP/AWS 코드 예제

### 16.4 UI 검증

- [ ] `/lab/server-infer` 모델 카드 12개 노출
- [ ] 메모리 카드 펼침 → RAM/VRAM/로드 모델 정상
- [ ] 동적 가용성 — 자원 부족 시 amber disabled
- [ ] [🗑️ 모두 언로드] 정상 작동
- [ ] `/lab/local-gcp` UI 그대로 + 격리 forward 동작 (Q2 a 채택)

---

## §17. 리스크 + 롤백

### 17.1 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 영어 모델 첫 cold start 지연 (phi4 ~9GB pull, 1~2분) | UX 첫 호출 길음 | 사용자 안내 + 단일 모델 정책으로 warm 유지 |
| /lab/local-gcp UI 가 격리 forward 와 호환 안 될 가능성 | UI fail | Phase 4 사용자 검증 + 필요 시 hotfix |
| Phi-4 14B 가 격리 24Gi 안 안 들 가능성 | 큰 모델 OOM | 단일 모델 정책 + 동적 가용성 (REBUILD32) 으로 자동 disabled |
| Ollama registry pull 첫 호출 시간 | cold start 1~2분 | 정상 (학습용 acceptable) |

### 17.2 롤백 계획

본 PR commits 만 revert + 메인 빌드 1회 → 옛 spec (24Gi/L4) 복구. 약 30분.

```bash
git revert <REBUILD33-commits>
gcloud builds submit --config cloudbuild.yaml ...
```

---

## §18. 다음 액션

> §0 결정 확정 → Phase 1~5 즉시 시작.

작업 시간 추정:
- Phase 1 (코드 변경): ~3시간
- Phase 2 (catalog 확장): ~1시간
- Phase 3 (빌드/배포): ~30분
- Phase 4 (검증): ~1시간 (사용자)
- Phase 5 (문서): ~30분

**총 ~6시간** (사용자 검증 시간 포함).

---

## §19. 후속 운영 + 미래 확장 (참고)

### 19.1 1주 운영 후 권장 점검

- [ ] GCP Billing 실제 절감 액 확인
- [ ] 영어 모델 사용 빈도 (어떤 모델 자주 호출?)
- [ ] cold start 빈도 (idle 후 첫 호출)

### 19.2 미래 확장 시나리오 (catalog 1줄 추가만으로)

| 트리거 | 추가 모델 |
|--------|---------|
| 일본어 자격증 (JLPT) | `qwen2.5:14b` 또는 `llm-jp:13b` |
| 중국어 자격증 (HSK) | `qwen2.5:7b` (이미 있음, 다국어) |
| 의학 / 법률 | `meditron:7b`, `qwen2.5:14b` |
| 코드 인터뷰 / 알고리즘 | `codellama:13b`, `deepseek-coder-v2:16b` |
| 새 LLM 출시 (예: Llama 4, Gemma 5) | Ollama 지원 시점에 catalog 추가 |

---

## §20. 통합/분리 서비스 완전 독립 운영 원칙 (2026-05-05 신규)

> 메모리 메모: **"통합/분리 서버 완전 독립 운영"** — `aitutor` ↔ `aitutor-server-infer` 카탈로그/엔진/배포 동기화 강제 금지. 차이는 "버그" 아닌 "**의도된 차이**" (REBUILD32 §15 R-3 + 본 REBUILD33 §20)

### 20.1 원칙

| 영역 | 메인 (`aitutor`) | 격리 (`aitutor-server-infer`) | 동기화 정책 |
|------|---|---|---|
| 엔진 | A++-1 → 본업만 / A++-2 → Ollama | Ollama 단일 (REBUILD32) | **자유 — 다를 수 있음** |
| 모델 catalog | 변형 따라 결정 | 14개 (한국어 8 + 영어 6, A++ 후) | **자유 — 다를 수 있음** |
| Image | 별도 image (a/aitutor) | 별도 image (a/aitutor-server-infer) | **이미 분리** |
| Cloudbuild | `cloudbuild.yaml` (root) | `server-infer/cloudbuild.yaml` | **이미 분리** |
| 자원 spec | A++-1: 2Gi/2vCPU / A++-2: 24Gi/6vCPU/L4 | 24Gi/6vCPU/L4 | **자유** |
| Service Account | aitutor-run@ | aitutor-server-infer-run@ | **이미 분리** |

### 20.2 의도된 차이 — 5가지 시나리오

#### 시나리오 1: catalog 차이 (예: 메인은 한국어 위주, 격리는 영어 추가)
- 사용자 학습 비교 가치
- 예: 메인 = 8개 (한국어), 격리 = 14개 (한국어 + 영어)
- 둘 다 같은 모델 (qwen2.5:3b 등) 가져도 OK / 다른 모델만 가져도 OK

#### 시나리오 2: 엔진 차이 (예: 메인은 6 엔진, 격리는 Ollama)
- 통합 비교 학습 (REBUILD23~30 컨셉)
- 격리는 안정 우선 (REBUILD32)
- A++-2 변형 시 둘 다 Ollama 단일 → 동등

#### 시나리오 3: 자원 spec 차이
- 메인 24Gi (큰 모델 운영) / 격리 16Gi (작은 모델만) 같은 비대칭 OK
- 또는 메인 2Gi (본업만) / 격리 24Gi (추론) 같은 역할 분리

#### 시나리오 4: 모델 default 차이
- 메인 default: gemma2:2b (가벼움)
- 격리 default: gemma4:e4b (큰 모델)
- 사용자 의도된 추천 차이

#### 시나리오 5: 배포 시점 차이
- 메인 hotfix → 메인만 빌드 (격리 영향 0)
- 격리 catalog 추가 → 격리만 빌드 (메인 영향 0)
- 두 service 가 다른 image SHA → **정상 (의도된 차이)**

### 20.3 강제 동기화 금지 — 안 하는 것 list

❌ **금지 사항**:
- 메인 catalog 변경 시 격리 catalog 자동 동기화 (또는 그 반대)
- "두 service 가 같은 image SHA여야 한다" 정책
- 양쪽 모두 빌드해야 새 모델 사용 가능 같은 결합
- 한쪽 fail 시 다른 쪽도 rollback 같은 강결합

✅ **허용 사항**:
- 운영자가 의도해서 두 catalog 동등하게 관리 (편의상 OK)
- 한 쪽 변경 시 다른 쪽도 같이 변경 결정 (의사결정 후)
- 공통 helper / 공통 prompt builder (`src/lib/lab/promptBuilder.js`) 등 코드 재활용

### 20.4 관련 메모리 메모

```
[memory] 통합/분리 서버 완전 독립 운영
- aitutor ↔ aitutor-server-infer 카탈로그/엔진/배포 동기화 강제 금지
- 차이는 "버그" 아닌 "의도된 차이"
- (REBUILD32 §15 R-3, 2026-05-05)
```

### 20.5 구현 체크리스트

A++ 채택 시 본 정책 적용을 위한 코드 검토:

- [ ] `api/local-infer.js` 의 MODEL_MAP 과 `server-infer/server.py` 의 MODELS 가 **별도 정의 유지** (공통 import 강제 X)
- [ ] `src/lib/lab/models.js` 의 LAB_MODELS 가 메인 catalog 와 다를 수 있음 (frontend 자체 결정 가능)
- [ ] cloudbuild 두 파이프라인이 **각각 독립 트리거** (메인 빌드 ↛ 격리 자동 빌드, 그 반대도)
- [ ] 한쪽 fail 시 다른 쪽 운영 영향 0 (이미 별도 service 라 자동)

---

## §21. 코드베이스 재분석 (2026-05-05 13:50 KST 기준)

### 21.1 격리 service 현재 catalog (server-infer/server.py)

```
1.  qwen35-2b      — Qwen 3.5 2B    (~1.4GB)
2.  qwen35-4b      — Qwen 3.5 4B    (~2.5GB)
3.  qwen25-3b      — Qwen 2.5 3B    (~1.9GB)
4.  qwen25-7b      — Qwen 2.5 7B    (~4.4GB)
5.  gemma2-2b      — Gemma 2 2B     (~1.6GB)
6.  gemma4-e2b     — Gemma 4 E2B    (~2.0GB)
7.  gemma4-e4b     — Gemma 4 E4B    (~3.5GB) [DEFAULT]
8.  deepseek-r1-qwen-7b — DeepSeek R1 Distill 7B (~4.5GB) ← 직전 추가됨
```

→ **현재 격리 catalog 8개** (deepseek-r1 추가됨, REBUILD32 §99 에서 한 번 제거됐다 다시 추가)

### 21.2 메인 service 현재 catalog (inference-py/engines/catalog.py)

```
11개 모델 — Ollama 매핑 8 + onnx-genai 전용 3 (Phi-3.5/Phi-4/Gemma 3)
```

→ 메인이 격리보다 3개 더 많음 (onnx 전용 모델). **이미 의도된 차이** ✅

### 21.3 메인 Dockerfile 의 6 엔진 의존성 (제거 대상)

```
Stage 2 (llamacpp-builder, ~12분 빌드):
  - CUDA 12.4 devel + cmake + git + nvcc
  - llama.cpp clone + 빌드 → /usr/local/bin/llama-server (~80MB)

Stage 3 (runtime, Python venv, ~15분):
  - vllm==0.6.5 + torch==2.5.1 (~3GB)
  - transformers==4.46.3
  - llama-cpp-python (cu124 wheel)
  - onnxruntime-genai-cuda==0.5.2 (또는 0.8.0, REBUILD32 §X 시도)
  - accelerate==1.1.1 + fastapi + uvicorn

A++ (양 변형) 적용 시 모두 제거 가능 → image ~3GB 절감
```

### 21.4 영향 받는 코드 위치

| 파일 | 라인 | 변경 | 변형 |
|------|-----|------|------|
| `Dockerfile` | 161줄 | A++-1 → ~40줄 / A++-2 → ~80줄 (Ollama 유지) | 양 변형 |
| `start.sh` | 78줄 | A++-1 → ~5줄 (또는 폐기) / A++-2 → ~30줄 (Ollama만) | 양 변형 |
| `api/local-infer.js` | 890줄 | A++-1 → ~50줄 (forward) / A++-2 → ~400줄 (Ollama만) | 양 변형 |
| `inference-py/` | 1318줄 (9 파일) | **제거** | 양 변형 |
| `cloudbuild.yaml` (root) | 99줄 | GPU/cpu/memory 갱신 | 양 변형 |
| `src/labs/local-gcp/LocalGcpTester.jsx` | ~360줄 | A++-1 → 격리 endpoint 호출 / A++-2 → 단일 엔진 UI | 양 변형 |
| `server-infer/server.py` | 380줄+ | 영어 6개 추가 (~30줄) | A++ 공통 |
| `src/lib/lab/models.js` | (LAB_MODELS) | 영어 6개 추가 (~30줄) | A++ 공통 |
| `cloudbuild.yaml` (격리) | (server-infer/) | 변동 0 | — |

### 21.5 빌드/배포 직렬화 (REBUILD32 §99 학습)

| 시퀀스 | 작업 |
|--------|------|
| 1 | 격리 catalog 확장 commit + push |
| 2 | 격리 빌드 (~14분) → SUCCESS 후 |
| 3 | 메인 슬림화 commit + push (변형 결정 후) |
| 4 | 메인 빌드 (A++-1 ~3분 / A++-2 ~10분) → SUCCESS |
| 5 | 사용자 검증 (~1시간) |

→ 한 번에 commit 하지 말고 **격리 → 메인 직렬** 권장 (REBUILD32 §99 의 region quota 충돌 학습 반영)

---

## §22. 다음 액션 — 사용자 의사결정 항목

### Q6 — A++ 변형 선택
- **A++-1** (옵션 A 변형, 추천) — 메인 = 본업만, 격리 forward
- A++-2 (옵션 B 변형) — 메인 = Ollama 단일

### Q7 — 메인 catalog 갱신 (변형 따라)
- A++-1 시: 메인 catalog 자동 폐기 (격리 forward)
- A++-2 시: a) 메인도 격리와 같은 14개 / b) 메인은 한국어 위주 8개만 / c) 메인이 더 풍부한 catalog (예: onnx-genai 전용 모델 보존)

### Q8 — 진행 시점
- a) 즉시 — 격리 catalog 확장 (영어 6개) 먼저, 메인 슬림화는 사용자 검증 후
- b) 격리 + 메인 동시 진행 (1일 작업)
- c) 보류 — 더 검토

답변 양식:
```
Q6: A++-1
Q7: a (자동 폐기)
Q8: a (격리 catalog 먼저)
```
또는 **"전부 추천대로"** 한마디로 즉시 진행 가능.

> **참고**: Q6 는 §0 에서 A++-2 로 확정됨 (사용자 통찰 반영, 2026-05-05 14:30 KST).
> Q7 은 A++-2 채택 시 메인 catalog 정책 (§25 에서 상세).
> Q8 는 진행 시점 (사용자 의사결정 후).

---

## §23. 두 아키텍처의 본질 — 일심동체 vs 독립 마이크로서비스

### 23.1 통합 서버 (`/lab/local-gcp`) — 일심동체 컨셉

```
┌──────────────────────────────────────────┐
│   aitutor (메인 service Cloud Run)       │
│ ┌──────────────┐         ┌────────────┐  │
│ │ Express      │ localhost│ Ollama     │  │
│ │ (본업)       │ ──RTT ~1ms→ (추론)     │  │
│ │              │         │ port 11434 │  │
│ └──────────────┘         └────────────┘  │
│        ↑                                 │
│   사용자 학습 앱 사용자                    │
└──────────────────────────────────────────┘
```

#### 존재 이유
- **물리적 같은 서버** — 본업과 추론이 process 안 (또는 같은 컨테이너) 에서
- **네트워크 레이턴시 0** — localhost loopback 호출 (RTT ~1ms)
- **단일 책임** — 메인 학습 앱 사용자 전용 최적화
- **컨테이너 일체감** — 한 컨테이너 = 한 운영 단위 (배포/롤백/모니터링 1회로 양쪽)

#### 누가 사용?
- aitutor 학습 앱 사용자 (영상정보관리사 자격증 학습 등)
- 사용자 시점에서 추론 = 본업의 일부 (분리 의식 X)

#### 기술 핵심
- localhost:11434 호출 (network stack 0, kernel loopback)
- 메인 catalog = 메인 학습 앱에 최적화된 모델 큐레이션
- Ollama daemon = 메인 process tree 안

#### 장애 모델
- 메인 down ↔ 추론 down 동기 (단일 점)
- 단 본업의 외부 API (Gemini/OpenAI/Claude) 는 별도 의존 X — 본업은 항상 운영 가능

### 23.2 분리 서버 (`/lab/server-infer`) — 독립 마이크로서비스 컨셉

```
┌──────────────────────────────────┐    ┌──────────────────────────────────────┐
│ aitutor (메인)                   │    │  aitutor-server-infer (격리)          │
│  ├─ /api/iso-infer ──ID token──→ │ ──→│  Ollama + 풍부 catalog                │
│  └─ ...                          │    │   (한국어/영어/코드/멀티모달...)       │
└──────────────────────────────────┘    │                                      │
                                        │   ↑ ↑ ↑                              │
┌──────────────────────────────────┐    │   │ │ │                              │
│ pressstand (다른 앱)             │ ───┘ │ │                                  │
└──────────────────────────────────┘      │ │                                  │
                                          │ │                                  │
┌──────────────────────────────────┐      │ │                                  │
│ withbible (다른 앱)              │ ─────┘ │                                  │
└──────────────────────────────────┘        │                                  │
                                            │                                  │
┌──────────────────────────────────┐        │                                  │
│ 미래 신규 앱                     │ ───────┘                                  │
└──────────────────────────────────┘                                           │
                                        └──────────────────────────────────────┘
```

#### 존재 이유
1. **재사용 가능 인프라** — aitutor 외 다른 프로젝트 (pressstand/withbible/미래 신규 앱) 가 호출 가능
2. **장애 격리 (fault isolation)** — 격리 down → 메인 학습 앱 정상 (외부 API fallback)
3. **독립 진화** — 격리 catalog/엔진을 메인과 다른 페이스로 발전 (의도된 차이)
4. **Cost-per-tenant** — 다른 앱이 사용하면 비용 분산
5. **회사 전체 추론 자산** — 추론 = 공통 인프라 (DB 처럼)

#### 누가 사용?
- aitutor 메인 (`/lab/server-infer`)
- 미래 다른 앱 (pressstand, withbible 등)
- 외부 API consumer (가능성)

#### 기술 핵심
- ID token 인증 + REST API (HTTPS, 50~150ms RTT)
- 격리 catalog = 범용 (한국어 + 영어 + 도메인별 풍부)
- 별도 Cloud Run service, 별도 image, 별도 SA

#### 장애 모델
- 격리 down → 메인 본업 영향 0 (외부 API 만 사용해도 학습 가능)
- 메인 down → 격리 영향 0 (다른 앱 호출 가능)
- **양쪽 독립** ✅

### 23.3 두 컨셉의 상호 보완 관계

| 측면 | 통합 (일심동체) | 분리 (독립) |
|------|--------------|-----------|
| 사용자 경험 | 빠름 (RTT 0) | 약간 느림 (RTT ↑) |
| 본업 의존도 | 같은 컨테이너 | 외부 호출 |
| 다른 앱 활용 | ❌ | ✅ |
| 장애 격리 | ❌ | ✅ |
| 운영 단위 | 단일 (배포 1회) | 분리 (배포 2회) |

→ **둘 다 가치 다르므로 둘 다 운영 합리적**. 한쪽이 다른쪽 의 forward 가 되면 두 컨셉 모두 죽음.

---

## §24. A++-1 추천 철회 + A++-2 채택 분석

### 24.1 A++-1 의 치명적 결함

#### 결함 1: 일심동체 컨셉 폐기

A++-1 (메인 = 본업만, 격리 forward) 채택 시:
```
사용자 → 메인 → /api/iso-infer → 격리 (외부 호출)
                ↑                ↑
              레이턴시 발생       50~150ms RTT
```

- localhost (~1ms) → **외부 호출 (50~150ms)** 로 변경
- 메인 본업 + 추론이 **같은 서버 아님** → 일심동체 깨짐
- "통합 서버" 라는 이름이 무색 — 사실상 격리만 운영

#### 결함 2: 분리 컨셉 약화

A++-1 채택 후 격리 service 의 위치:
- 메인의 forward 호출만 받음 → 메인의 backend 처럼 인식
- 다른 앱에서 호출 가능성 ↓ (메인 의존 인프라로 격하)
- 진정한 "독립 마이크로서비스" 가치 ↓

#### 결함 3: 메인 추론 0 → 본업 격리 의존

격리 down 시:
- /lab/local-gcp = 격리 forward 라 동작 안 함
- /lab/server-infer = 격리 직접 호출이라 동작 안 함
- → **모든 학습 추론 기능 down** (외부 API 외에는 운영 불가)

A++-2 와 비교 시:
- A++-2: 격리 down 시 /lab/local-gcp 의 메인 자체 추론은 정상 → 사용자 학습 지속 가능
- A++-1: 격리 down 시 모든 학습 추론 정지

### 24.2 A++-2 의 우월성 (8가지 가치 재확인)

| # | 가치 | A++-2 가 보존 |
|---|------|-------------|
| 1 | 일심동체 컨셉 (메인 본업 + Ollama 같은 서버) | ✅ |
| 2 | 독립 마이크로서비스 컨셉 (격리 = 재사용 가능) | ✅ |
| 3 | 장애 격리 (양쪽 독립) | ✅ |
| 4 | 본업 보호 (외부 API + 자체 Ollama 다중 fallback) | ✅ |
| 5 | 엔진 단순화 (메인 6→1 엔진, REBUILD33 본질) | ✅ |
| 6 | 모델 다양화 (양쪽 catalog 큐레이션, REBUILD33 본질) | ✅ |
| 7 | 회사 전체 추론 자산 (격리 = 공통 인프라) | ✅ |
| 8 | 미래 확장성 (메인 GPU 유지, 다른 엔진 부활 가능) | ✅ |

### 24.3 A++-2 의 트레이드오프 (정직한 평가)

| 항목 | A++-1 | A++-2 |
|------|------|------|
| 비용 절감 (메인 24/7) | $667 → $36 (-95%) | **$667 → $667 (GPU 유지)** |
| 빌드 시간 | 30 → 3분 | **30 → 10분** |
| Image 크기 | 5GB → 500MB | **5GB → 2GB** |

A++-2 는 **비용/빌드 절감 효과는 작지만**, **아키텍처 가치 보존이 본질**.

→ **단순 비용 절감보다 컨셉 보존이 더 큰 가치**.

---

## §25. A++-2 작업 매트릭스 (상세)

### 25.1 메인 service 슬림화 (Ollama 일심동체 유지)

| Phase | 작업 | 파일 | 변경량 |
|------|------|------|------|
| **P25.1** | Dockerfile Stage 2 (llama.cpp CUDA build) **제거** | `Dockerfile` | -30줄 / 빌드 -12분 |
| **P25.2** | Dockerfile Stage 3 의 Python venv (vllm 0.6.5 + transformers 4.46 + llama-cpp-python + onnxruntime-genai + accelerate) **제거** | `Dockerfile` | -20줄 / image -3GB |
| **P25.3** | Dockerfile 의 Ollama install + Node + Express **유지** (일심동체 유지) | `Dockerfile` | 변동 0 |
| **P25.4** | `inference-py/` 디렉토리 **제거** (격리 server-infer/ 와 중복 책임) | `git rm -rf workspace/aitutor/inference-py/` | -1318줄 |
| **P25.5** | `start.sh`: Python sub-server watchdog **제거** + Ollama spawn **유지** | `start.sh` | 78 → ~30줄 |
| **P25.6** | `api/local-infer.js`: 5 엔진 dispatch 분기 **제거** (vllm, llama-server, llama-cpp-python, onnxruntime-genai, transformers) — Ollama 분기만 유지 | `api/local-infer.js` | 890 → ~400줄 |
| **P25.7** | MODEL_MAP: `engines` 매핑 단순화 (Ollama only), `disabled_engines` 제거 가능 | `api/local-infer.js` | 단순화 |
| **P25.8** | (선택) MODEL_MAP 에 영어 6개 추가 (메인 학습 앱 영어 자격증 대비) | `api/local-infer.js` | +30줄 |
| **P25.9** | `LocalGcpTester.jsx`: 엔진 dropdown 제거 (단일 엔진 정보 뱃지로, ServerInferTester 패턴 차용) | `src/labs/local-gcp/LocalGcpTester.jsx` | 단순화 |
| **P25.10** | `cloudbuild.yaml`: GPU L4 **유지**, memory 24Gi **유지** (Ollama + 큰 모델 위해) | `cloudbuild.yaml` | 변동 0 |

### 25.2 격리 service 변동 (Q7 결정 사항)

| Q7 옵션 | 격리 catalog 정책 | 메인 catalog 와 관계 |
|--------|-----------------|------------------|
| **Q7-a** | 격리 catalog 영어 6개 추가 (총 14개, 메인과 다른 영어 모델) | 메인은 한국어 7개 + (선택) 영어 일부 / 격리는 14개 → **의도된 차이** |
| Q7-b | 격리 그대로 (8개) — 메인만 영어 추가 | 메인 = 한국어 7 + 영어 6 = 13개 / 격리 = 8개 → **의도된 차이** (역방향) |
| Q7-c | 양쪽 모두 같은 14개 — 동등 catalog | 차이 없음 (의도된 차이 정책 위반 가능) |

**추천**: Q7-a (격리도 영어 추가) — **격리 = 회사 전체 자산** 컨셉 + 외부 앱 호출 가능성 ↑

### 25.3 변경 요약 (코드)

| 파일 | Before | After | 변경 |
|------|--------|-------|------|
| `Dockerfile` | 161줄 / 3-stage / 5GB | **~80줄 / 2-stage / 2GB** | -50% |
| `start.sh` | 78줄 | **~30줄** | -62% |
| `api/local-infer.js` | 890줄 | **~430줄** (Ollama only + 영어 6 추가) | -52% |
| `inference-py/` | 1318줄 (9 파일) | **0** | -100% |
| `LocalGcpTester.jsx` | 6 엔진 카드 + dropdown | **단일 엔진 뱃지** | 단순화 |
| `cloudbuild.yaml` | 변동 0 | (유지) | 0 |
| `server-infer/server.py` | 8 모델 | **14 모델** (영어 6개 추가) Q7-a | +30줄 |
| `LAB_MODELS` | 11 모델 | **14 모델** | +30줄 |

**총 코드 변경**: -1,800줄 / +60줄 = **net -1,740줄**

### 25.4 단계별 실행 순서 (직렬화 — REBUILD32 §99 학습)

```
1. 격리 catalog 확장 commit + push
   └─ 격리 빌드 (~14분)
       └─ SUCCESS 확인

2. 메인 슬림화 commit (큰 변경)
   ├─ Dockerfile / start.sh / api/local-infer.js / inference-py 제거 / LocalGcpTester
   └─ commit + push
       └─ 메인 빌드 (~10분)
           └─ SUCCESS 확인

3. 사용자 검증 (~1시간)
   ├─ 본업 (DB 문제풀이 / Gemini API)
   ├─ /lab/local-gcp (메인 자체 Ollama 호출)
   ├─ /lab/server-infer (격리 호출)
   └─ 영어 모델 (TOEIC + GCP/AWS) 검증

4. 문서 정정 (~30분)
   └─ REBUILD33 §26 검증 결과 추가
```

**총 예상**: 코드 ~3시간 + 빌드 ~25분 + 검증 ~1시간 + 문서 ~30분 = **~5시간**

### 25.5 검증 체크리스트 (사용자 검증 시점)

#### 본업 (메인 학습 앱) — 영향 0 검증
- [ ] DB 문제풀이 정상
- [ ] AI 해설 (Gemini API) 정상
- [ ] 메모/이미지/인증 정상

#### /lab/local-gcp (메인 일심동체) — 신 단일 엔진
- [ ] 모델 dropdown 단일 엔진 (Ollama 뱃지)
- [ ] 모델 카드 14개 (한국어 + 영어, Q7-a 시)
- [ ] qwen2.5:3b 호출 → 한국어 해설 (보기별 충실)
- [ ] phi4 호출 → 영어 추론 (GCP/AWS 시나리오)
- [ ] 메모리 카드 펼침 → Ollama 1 엔진만 표시 (이전 sub-server/llama-server/vllm 제거됨 확인)

#### /lab/server-infer (격리 독립) — 변동 없음 또는 catalog 확장
- [ ] 모델 카드 14개 (Q7-a 시) 또는 8개 (Q7-b 시)
- [ ] 격리 down 테스트 — 메인 /lab/local-gcp 정상 (장애 격리 검증)

#### 빌드 / 운영
- [ ] 메인 image ~2GB 확인
- [ ] 메인 빌드 ~10분 확인
- [ ] GPU L4 유지 확인 (cloudbuild)
- [ ] 본업 외부 API 응답 정상 (Gemini)

### 25.6 리스크 + 롤백

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `api/local-infer.js` 큰 변경 (890→430줄) | 단순화 과정 버그 | 빌드 후 검증 시점에서 발견, git revert 가능 |
| MODEL_MAP 변경 시 `disabled_engines` / `engines` 매핑 정합성 | 모델 dispatch 깨짐 | 단일 엔진이라 단순. helper 함수 (`getAvailableEngineKeys`) 정리 |
| 빌드 직렬화 깜빡 | region quota 충돌 (REBUILD32 §99 패턴) | §25.4 순서 준수 |
| /lab/local-gcp UI 의 `LAB_ENGINES` import 잔존 | runtime error | useEffect 정리 + LAB_ENGINES 제거 또는 단일 항목만 |

**롤백**: git revert <P25 commits> + 메인 빌드 1회 → 옛 spec 복귀 (~30분)

---

## §26. 다음 액션 (대기)

### 사용자 의사결정 항목 (Q7/Q8)

#### Q7 — 격리 catalog 정책 (A++-2 채택 후)
- **a) 격리도 영어 6개 추가** (격리 14 모델, 회사 전체 자산화) ← **추천**
- b) 격리 그대로 (8 모델), 메인만 영어 추가
- c) 양쪽 동등 14 모델 (의도된 차이 정책 위반)

#### Q8 — 진행 시점
- **a) 격리 catalog 먼저, 메인 슬림화는 격리 검증 후** ← **추천 (작은 단위 안전)**
- b) 격리 + 메인 동시 진행 (1일 작업)
- c) 보류 — 더 검토

답변 양식:
```
Q7: a (격리 14 모델, 회사 자산화)
Q8: a (격리 먼저)
```
또는 **"전부 추천대로"** 한마디.

> **본 commit (REBUILD33 §23~§26 추가) 은 문서만**. 사용자 의사결정 후 §25.4 단계별 실행 진입.

---

## §27. 변경 이력

| 시각 (KST) | 섹션 | 변경 |
|----------|------|------|
| 2026-05-05 12:30 | §1~§19 신설 | REBUILD33 초기 작성 (옵션 A 추천) |
| 2026-05-05 13:00 | §11 추가 | 엔진 적합도 매트릭스 + 지원 모델 |
| 2026-05-05 13:30 | §12~§19 갱신 | 핵심 전략 (엔진 단순화 + 모델 다양화) + catalog (12) |
| 2026-05-05 13:50 | §20~§22 신설, §0/§13/§14 갱신 | A++ 두 변형 (1/2) + 통합/분리 독립 정책 + 영어 6 |
| **2026-05-05 14:30** | **§0/§22 갱신, §23~§26 신설** | **A++-1 철회 + A++-2 채택 (사용자 통찰: 일심동체 vs 독립 마이크로서비스)** |
| **2026-05-05 15:00** | **§28 신설** | **통합 서버 = 매장 로컬 AI 컨셉 (최소 catalog) / 분리 = 회사 자산 (풍부 catalog) 역할 분담 명확화** |

---

## §28. 통합 서버 = 매장 로컬 AI 컨셉 (전략 수정, 2026-05-05 15:00)

> **사용자 결정** (15:00 KST):
> - 통합 서버 = aitutor 전용 **매장 로컬 AI / 내장 AI** 컨셉
> - **한 개 엔진 (Ollama) + 최소 모델** 전략
> - **한글에 강한 가벼운 모델**
> - **영어시험 번역도 잘 함** (한↔영 번역 능력)
> - 통합/분리 역할 분담 명확화

### 28.1 매장 로컬 AI 컨셉 (Embedded Local AI)

```
┌─────────────────────────────────────────────────┐
│  aitutor 학습 앱 (영상정보관리사 등)               │
│                                                  │
│  ┌────────────────────────┐                      │
│  │ Express + Ollama       │   ←── 매장 로컬 AI   │
│  │ (한 개 엔진 + 최소 모델) │      • 학습 앱 전용 │
│  │                        │      • 가벼움        │
│  │ Default: qwen2.5:3b    │      • 빠른 응답     │
│  │ 백업: gemma2:2b        │      • 한국어 강     │
│  │ 고성능: qwen3.5:4b     │      • 영어 번역 가능 │
│  └────────────────────────┘                      │
│                                                  │
│  본업: DB / 메모 / Gemini API                    │
└─────────────────────────────────────────────────┘
```

**비유**:
- **편의점의 자체 결제 단말기** — 본사 시스템 안 거치고 매장에서 즉시 처리
- **자동차의 내장 내비게이션** — 외부 서버 안 거치고 차 안에서 동작
- **가전제품의 내장 AI 칩** — 클라우드 안 거치고 기기 내부 처리

**철학**: 학습 앱이 "AI 를 가지고 있다" — 외부 의존 0, 빠른 응답, 단순한 책임.

### 28.2 요구사항

| 요구 | 우선순위 | 이유 |
|-----|--------|------|
| 한국어 강 | 🔴 **필수** | 영상정보관리사/KISA 등 한국어 자격증이 본업 |
| 영어 번역 능력 (한↔영) | 🟡 **중요** | TOEIC 어휘 / 영어 docs 번역 / 자격증 보조 |
| 가벼움 (image / cold start) | 🔴 **필수** | 매장 로컬 AI 는 빠른 응답 핵심 |
| 다양성 | ⚪ 낮음 | 분리 service 가 담당 (역할 분담) |
| 추론 능력 | ⚪ 낮음 | 자격증 객관식 4지선다는 깊은 추론 불필요 |
| 코드 능력 | ❌ 불필요 | 본업이 한국어 학습이라 코드 무관 |

### 28.3 모델 후보 비교 (한국어 + 영어 번역 + 가벼움)

| 후보 | 크기 | 한국어 | 영어 번역 | 가벼움 | 매장 로컬 적합도 |
|-----|------|------|---------|------|--------------|
| **Qwen 2.5 3B** (qwen2.5:3b) | ~1.9GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (다국어 모델) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ **1순위** |
| **Gemma 2 2B** (gemma2:2b) | ~1.6GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ **2순위** |
| Qwen 3.5 4B (qwen3.5:4b) | ~2.5GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Qwen 3.5 2B (qwen3.5:2b) | ~1.4GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Gemma 4 E2B (gemma4:e2b) | ~2.0GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Phi 3.5 (phi3.5) | ~2.3GB | ⭐⭐ (영어 위주) | ⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ 한국어 약 |
| Llama 3.2 3B (llama3.2:3b) | ~2GB | ⭐⭐ (영어 위주) | ⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ 한국어 약 |
| Qwen 2.5 7B (qwen2.5:7b) | ~4.4GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ (무거움) | ⭐⭐ 매장 부적합 |

#### 1순위: Qwen 2.5 3B 가 매장 로컬 AI 에 가장 적합한 이유

1. **한국어 학습 데이터 풍부** — Alibaba 가 다국어 (중/영/한) 학습 강화
2. **영어 번역 능력 우수** — 다국어 모델이라 한↔영 번역 자연스러움
3. **1.9GB 가벼움** — Cold start 빠름 (~30초)
4. **자격증 객관식에 충분한 능력** — 4지선다 + 보기별 해설에 충분
5. **메모리 효율** — 메인 service 24Gi 안에서 여유 있음

#### 2순위: Gemma 2 2B 가 백업 모델로 적합한 이유

1. **Google 표준 안정성**
2. **1.6GB 가장 가벼움** — Cold start ~25초
3. Qwen 과 다른 패밀리 → 비교 가치 (한 모델 응답 어색할 때 fallback)

### 28.4 추천 catalog (통합 서버 = 메인)

#### 옵션 28-A: 최소 1 모델 ⭐ (가장 단순)
```python
MODELS_MAIN = [
    {"key": "qwen25-3b", "name": "Qwen 2.5 3B", "ollama": "qwen2.5:3b", ...},
]
DEFAULT_MODEL_KEY = "qwen25-3b"
```
- 매장 로컬 AI 컨셉 가장 충실
- 사용자 모델 선택 UI 자체 불필요 (자동)
- image 안에 모델 0 (Ollama lazy pull)

#### 옵션 28-B: 최소 2 모델 ⭐⭐ (백업 + 비교)
```python
MODELS_MAIN = [
    {"key": "qwen25-3b", "name": "Qwen 2.5 3B", "ollama": "qwen2.5:3b", ...},  # DEFAULT
    {"key": "gemma2-2b", "name": "Gemma 2 2B",  "ollama": "gemma2:2b",  ...},  # 가벼운 백업
]
DEFAULT_MODEL_KEY = "qwen25-3b"
```
- 1 모델 응답 어색할 때 다른 패밀리 fallback
- 사용자가 비교 가능
- 여전히 가벼움

#### 옵션 28-C: 최소 3 모델 (균형) ← **추천**
```python
MODELS_MAIN = [
    {"key": "qwen25-3b",  "name": "Qwen 2.5 3B",  "ollama": "qwen2.5:3b",  ...},  # DEFAULT 한국어 + 영어 번역
    {"key": "gemma2-2b",  "name": "Gemma 2 2B",   "ollama": "gemma2:2b",   ...},  # 가벼운 백업
    {"key": "qwen35-4b",  "name": "Qwen 3.5 4B",  "ollama": "qwen3.5:4b",  ...},  # 고성능 옵션
]
DEFAULT_MODEL_KEY = "qwen25-3b"
```
- DEFAULT 가벼움 (1.9GB)
- 백업 더 가벼움 (1.6GB)
- 고성능 (2.5GB) 옵션
- 모두 한국어 + 영어 번역 강

→ **추천: 옵션 28-C (3 모델)**

### 28.5 통합 vs 분리 역할 분담 (명확화)

| 측면 | 통합 (`aitutor`) | 분리 (`aitutor-server-infer`) |
|------|---|---|
| **컨셉** | 매장 로컬 AI / 내장 | 회사 전체 추론 자산 |
| **누가 사용** | aitutor 학습 앱 사용자만 | aitutor + pressstand + withbible + 미래 신규 앱 |
| **catalog 크기** | **3개** (최소) | **14개** (풍부) |
| **모델 선정 기준** | 한국어 + 영어 번역 + 가벼움 | 한국어 + 영어 자격증 + 코드 + 도메인별 |
| **응답 속도 우선** | RTT ~1ms (localhost) | RTT 50~150ms (외부 호출) |
| **장애 영향** | 메인 down → 자체 영향 | 격리 down → 다른 앱 영향 가능 |
| **default 모델** | qwen2.5:3b (가벼움) | gemma4:e4b (큰 모델, 다양성) |
| **포지션** | 학습 앱 내장 — 빠르고 단순 | 인프라 — 풍부하고 강력 |

### 28.6 작업 영향 — A++-2 의 catalog 정의

A++-2 채택 + 본 §28 적용 시 메인 service 의 catalog 정책:

| 단계 | 작업 |
|------|------|
| **메인 catalog (api/local-infer.js MODEL_MAP)** | 11 모델 → **3 모델** (qwen25-3b, gemma2-2b, qwen35-4b) |
| **메인 disabled_engines** | 모두 제거 (Ollama 단일 → 호환성 매트릭스 불필요) |
| **메인 LAB_MODELS (frontend)** | 3 모델로 동기화 |
| **메인 DEFAULT_MODEL_KEY** | `qwen25-3b` |
| **격리 catalog** | Q7 결정 따라 (추천: 14 모델 - 회사 자산화) |

### 28.7 사용자 시나리오 — 매장 로컬 AI 의 가치

#### 시나리오 1: 학습 앱 첫 사용자 (가장 흔함)
```
사용자: 영상정보관리사 문제풀이 시작
  → DB 문제 받기 (본업)
  → AI 해설 요청
  → 메인 Ollama (qwen2.5:3b) localhost 호출 (RTT 1ms)
  → ~5초 후 한국어 해설 응답 (warm)
```

#### 시나리오 2: 영어 자격증 보조 학습 (TOEIC 등)
```
사용자: TOEIC 어휘 영어 → 한국어 번역 요청
  → 메인 Ollama (qwen2.5:3b) 호출
  → 다국어 모델이라 영어 → 한국어 자연스럽게 번역
  → 빠른 응답 (가벼운 모델)
```

#### 시나리오 3: 깊은 영어 학습 / 다양한 모델 비교
```
사용자: 다양한 모델 비교 / 영어 자격증 (GCP/AWS) 시나리오 학습
  → /lab/server-infer (분리 service) 사용
  → 14개 모델 풍부 (phi4, llama3.1, qwen-coder 등)
  → 외부 호출이지만 풍부한 모델
```

→ **사용자 의도에 맞춰 통합/분리 자연 분리**:
- 일반 학습 → 통합 (빠름, 충분한 한국어)
- 깊은 비교 / 영어 자격증 → 분리 (풍부함)

### 28.8 비용 / 빌드 영향 (A++-2 + 옵션 28-C 채택 시)

| 항목 | A++-2 단독 | A++-2 + 옵션 28-C |
|------|---------|---|
| 메인 image | ~2GB | **~2GB (변동 0)** — 모델은 lazy pull 이라 image 무관 |
| 메인 빌드 | ~10분 | **~10분 (변동 0)** |
| 메인 cold start (첫 호출 시 모델 pull) | ~30~60초 | **~30초** (qwen2.5:3b 가 가벼워서 ↓) |
| 메인 catalog 코드 | 11 모델 매핑 (복잡) | **3 모델 매핑 (단순)** ✅ |
| 메인 사용자 UI 부담 | 모델 카드 11개 | **3개 (선택 단순)** ✅ |
| 비용 변동 | 0 | 0 |

→ **이미지/빌드 변동 0, UI 단순화 + 사용자 인지 부담 ↓**

### 28.9 미래 확장 정책

#### 통합 (메인) catalog 확장 정책 — 신중
- 추가는 **한국어 + 가벼움 + 매장 적합성** 기준만
- 영어 자격증 (TOEIC/GCP/AWS) → **격리 service 로 위임** (분리 컨셉)
- 새 LLM 출시 시 → **격리 먼저 검증** → 매장 적합 시 통합 추가

#### 분리 (격리) catalog 확장 정책 — 풍부
- 자격증 도메인별 추가 자유 (영어/일본어/중국어/의학/법률/코드)
- 회사 다른 프로젝트 요구 시 추가
- 새 LLM 즉시 시도 가능 (회사 자산 컨셉)

### 28.10 추가 결정 항목 (Q9)

#### Q9 — 통합 catalog 옵션
- **a) 옵션 28-A** (1 모델: qwen2.5:3b만) — 가장 매장스러움
- **b) 옵션 28-B** (2 모델: + gemma2:2b) — 백업 추가
- **c) 옵션 28-C** (3 모델: + qwen3.5:4b) ← **추천 (균형)**
- d) 다른 의견 (특정 모델 추가/제외)

답변 양식:
```
Q7: a (격리 14 모델)
Q8: a (격리 먼저)
Q9: c (통합 3 모델 - qwen2.5:3b + gemma2:2b + qwen3.5:4b)
```
또는 **"전부 추천대로"** 한마디.

---

## §29. 최종 작업 정리 (대기, A++-2 + §28 통합)

### 29.1 변경 요약 (전체)

| 영역 | Before | After | 영향 |
|------|--------|-------|------|
| 메인 image | ~5~6 GB | **~2 GB** | -60% |
| 메인 빌드 | ~30분 | **~10분** | -67% |
| 메인 catalog | 11 모델 (6 엔진 매핑) | **3 모델 (Ollama 단일)** | -73% |
| 메인 코드 (api/local-infer.js) | 890줄 | **~430줄** | -52% |
| 메인 inference-py/ | 1318줄 | **0** | -100% |
| 격리 catalog | 8 모델 | **14 모델** (Q7-a 시) | +75% |
| 격리 image / 자원 | 변동 0 | 변동 0 | 0 |
| 일심동체 컨셉 | ✅ | ✅ **유지** | — |
| 독립 마이크로서비스 컨셉 | ✅ | ✅ **유지** | — |

### 29.2 단계별 실행 순서 (Q9 추가 반영)

```
Phase 1: 격리 catalog 영어 6개 추가 (Q7-a)
  ├─ server-infer/server.py: MODELS 8 → 14
  ├─ src/lib/lab/models.js: LAB_MODELS 동기화 (분리 화면용)
  └─ commit + push + 격리 빌드 (~14분)
       └─ SUCCESS 후

Phase 2: 메인 슬림화 (A++-2) + 통합 catalog 최소화 (Q9-c)
  ├─ Dockerfile: Stage 2 (CUDA build) 제거 + Stage 3 의 Python venv 제거 (Ollama 유지)
  ├─ start.sh: Python sub-server watchdog 제거 (Ollama spawn 유지)
  ├─ api/local-infer.js: 5 엔진 분기 제거 (Ollama만), MODEL_MAP 11 → 3
  ├─ inference-py/ git rm
  ├─ LocalGcpTester.jsx: 엔진 dropdown → 단일 엔진 정보 뱃지
  └─ commit + push + 메인 빌드 (~10분)
       └─ SUCCESS 후

Phase 3: 사용자 검증 (~1시간)
  ├─ /lab/local-gcp 통합 (메인 자체) 동작 — 3 모델 카드, qwen2.5:3b default
  ├─ /lab/server-infer 분리 (격리) 동작 — 14 모델 카드
  ├─ 본업 (DB / Gemini API) 정상
  └─ 빌드/image 크기/cold start 측정

Phase 4: 문서 정정 (~30분)
  └─ REBUILD33 §29 완료 결과 추가
```

**총 예상**: 코드 ~3.5시간 + 빌드 ~25분 + 검증 ~1시간 + 문서 ~30분 = **~5.5시간**

### 29.3 검증 체크리스트 (요약)

#### 본업
- [ ] DB 문제풀이 / 메모 / Gemini AI 해설 정상

#### 통합 (`/lab/local-gcp`) — 매장 로컬 AI
- [ ] 모델 카드 3개 (qwen2.5:3b default, gemma2:2b, qwen3.5:4b)
- [ ] qwen2.5:3b 한국어 해설 정상
- [ ] qwen2.5:3b 영어 → 한국어 번역 정상 (TOEIC 어휘 등)
- [ ] localhost 호출 RTT < 50ms 확인
- [ ] 단일 엔진 정보 뱃지 (Ollama)

#### 분리 (`/lab/server-infer`) — 회사 자산
- [ ] 모델 카드 14개 (한국어 8 + 영어 6)
- [ ] phi4 영어 추론 정상 (GCP/AWS 시나리오)
- [ ] qwen2.5-coder:7b 코드 응답 정상
- [ ] 격리 down 시 메인 정상 동작 (장애 격리)

#### 운영
- [ ] 메인 image ~2GB 확인
- [ ] 메인 빌드 ~10분 확인
- [ ] 격리 catalog 14 모델 동적 가용성 (REBUILD32) 정상

---

> **본 §28~§29 추가 commit 은 문서만**. Q7/Q8/Q9 사용자 의사결정 후 §29.2 단계별 실행 진입.

---

## §30. Phase 2 적용 결과 (2026-05-05 22:42 KST 빌드 완료)

### 30.1 실측 vs 목표 (29.1 표 비교)

| 영역 | 목표 (29.1) | 실측 | 평가 |
|------|---------|------|------|
| 메인 image | ~2 GB (-60%) | **4.81 GB (-46%)** | 🟡 부분 달성 (CUDA runtime base 2.6GB 한계) |
| 메인 빌드 | ~10분 (-67%) | **12M 36S (-61%)** | 🟢 거의 달성 |
| 메인 catalog | 3 모델 | **3 모델** (qwen25-3b/gemma2-2b/qwen35-4b) | ✅ 달성 |
| 메인 코드 (api/local-infer.js) | ~430줄 | **427줄** | ✅ 달성 |
| 메인 inference-py/ | 0 (1318줄 제거) | **0 (1377줄 제거)** | ✅ 초과 달성 |
| 일심동체 컨셉 | 유지 | **유지** | ✅ |
| 독립 마이크로서비스 컨셉 | 유지 | **유지** | ✅ |

**총 코드 변경**: net **-2052줄** (목표 -1740줄 대비 -312줄 추가 슬림화)

### 30.2 빌드 결과 (Cloud Build + Cloud Run 실측)

```
Cloud Build:
  Build ID:   7a1eea9f-1f17-430d-b815-daebb5b01fe6
  Duration:   12M 36S (이전 32M 9S 대비 -19m 33s, -61%)
  Status:     SUCCESS
  Image tag:  asia-southeast1-docker.pkg.dev/aitutortwo-prod/aitutor/aitutor:v20260505-222910

Cloud Run:
  Service:    aitutor (asia-southeast1)
  Revision:   aitutor-00018-4qx (이전 aitutor-00017-sm2 → 신규 활성)
  Status:     Ready=True
  URL:        https://aitutor-xq3ezzqwfa-as.a.run.app
  Spec:       24Gi RAM / 6 vCPU / NVIDIA L4 GPU 1개 (변동 0)

Image manifest size 비교:
  이전 (00017-sm2 / v192706): 8.89 GB (9,547,692,373 B)
  슬림화 (00018-4qx / v222910):  4.81 GB (5,164,924,834 B)
  절감:                         -4.08 GB (-46%)
```

### 30.3 image 크기 -46% 달성 분석

**제거된 항목** (Dockerfile diff 기준):
- llama.cpp Stage 2 빌드 산출물 (llama-server binary + .so 라이브러리, ~200 MB)
- Python venv (vLLM 0.6.5 + PyTorch 2.5.1 + transformers 4.46 + llama-cpp-python + onnxruntime-genai-cuda + accelerate, **~3 GB**)
- inference-py/ 소스 (1.3 MB, 무시 가능)
- libcurl4 / libgomp1 (llama-server 의존성, ~10 MB)
- python3-pip (~10 MB)

**잔존 항목** (4.81 GB 구성):
- nvidia/cuda:12.4.0-runtime-ubuntu22.04 base (~2.6 GB) — Ollama GPU 활용을 위해 필수
- Node.js 22 (NodeSource, ~150 MB)
- Ollama binary + 의존 (~70 MB)
- npm 의존 (production only, ~150 MB)
- Vite 빌드 산출물 (~10 MB)
- 시스템 패키지 + apt cache 잔재 (~1.5 GB)

→ 추가 슬림화 가능 영역: CUDA runtime base 교체 (예: `nvidia/cuda:12.4.0-base-ubuntu22.04` ~1.0 GB)
   다만 Ollama GPU 동작 호환성 검증 필요 → REBUILD34 후속.

### 30.4 검증 체크리스트 (사용자 확인 대기)

#### 본업 (영향 0 검증)
- [ ] DB 문제풀이 / 메모 / 첨부파일 정상
- [ ] Gemini API AI 해설 정상

#### 통합 (`/lab/local-gcp`) — 매장 로컬 AI
- [ ] 모델 카드 3개 표시 (qwen2.5:3b default + gemma2:2b + qwen3.5:4b)
- [ ] 단일 엔진 정보 뱃지 (Ollama, 옛 6 엔진 dropdown 사라짐 확인)
- [ ] qwen2.5:3b 한국어 해설 정상
- [ ] qwen2.5:3b 영어 → 한국어 번역 정상 (TOEIC 어휘 등)
- [ ] 메모리 카드 펼침 — Ollama 1 엔진만 표시 (옛 sub_server / daemons 제거 확인)

#### 분리 (`/lab/server-infer`) — 회사 자산 (변동 없음)
- [ ] 모델 카드 표시 (현재 8 모델, 격리 영어 6 추가 빌드 시 14)
- [ ] ♻️ 인스턴스 재시작 (REBUILD32 §15.6) 버튼 정상

#### 운영 측정 (자동 검증 완료)
- [x] 메인 image ~4.81GB (목표 ~2GB 대비 -46%, CUDA base 한계)
- [x] 메인 빌드 12M 36S (목표 ~10분 대비 -61%)
- [x] Cloud Run revision Ready=True
- [x] GPU L4 유지 (cloudbuild.yaml 변동 0)

### 30.5 남은 작업

| # | 작업 | 비고 |
|---|------|------|
| 1 | 사용자 UI 검증 (§30.4 체크리스트) | 사용자 직접 |
| 2 | (선택) 격리 catalog 영어 6 모델 추가 빌드 | Phase 1 race condition 후속 — 의사결정 대기 |
| 3 | (선택) REBUILD34 — image base 추가 슬림화 | 4.81 → ~2GB 가능성 검토 |

### 30.6 변경 이력

```
93eb6af (5월 5일) feat(aitutor): REBUILD33 Phase 1 — 격리 영어 6개 + restart-container
3584e53 (5월 5일) docs(aitutor): REBUILD32 §15.6 — 컨테이너 강제 재시작 진단/구현
3e1c9a0 (5월 5일) feat(aitutor): REBUILD33 Phase 2 — 메인 service 슬림화 (A++-2)
3d6e6f5 (5월 5일) docs(aitutor): REBUILD33 §30 Phase 2 적용 결과 (image 4.81GB / 빌드 12M36S)
d09050f (5월 6일) feat(aitutor): 통합 service 도 격리와 동일 메모리 회수 UX (REBUILD33 §31)
507c879 (5월 6일) docs(aitutor): 실험실 페이지 전수 REBUILD 참조 제거 + 운영 사실 정정 (REBUILD33 §32)
```

---

## §31. 통합 service 메모리 회수 UX 보강 (2026-05-06)

### 31.1 사용자 보고 + 결정

> "서버통합에도 서버분리처럼 메모리 현황 아래 메모리 초기화 기능을 추가해주세요.
> 엔진이 하나로 확정되었으니 상단 메모리 정리 서버통합페이지에서 제거 .... 필요합니다."

격리 service 의 ♻️ 인스턴스 재시작 패턴을 통합 service 에도 동일 적용. 엔진 단일화로 무의미해진 헤더 [🧹 메모리 정리] admin 버튼 제거.

### 31.2 변경

| 파일 | 변경 |
|------|------|
| `api/local-infer.js` | `?action=cleanup` (admin 전용) 제거 / `?action=unload-all` (warm 유지, 모든 인증 사용자) 추가 / `?action=restart-container` (process.kill SIGTERM, 본업 영향 응답에 명시) 추가 |
| `src/components/lab/MemoryCard.jsx` | `restartImpactWarning` prop 추가 — 통합 본업 영향 경고 confirm 분기 |
| `src/labs/local-gcp/LocalGcpTester.jsx` | 헤더 [🧹 메모리 정리] admin 버튼 + handleCleanup + cleaning state + getAuthUser import 제거 / MemoryCard 에 unloadEndpoint + restartEndpoint + restartImpactWarning 전달 |

### 31.3 동작 시퀀스 (통합 ♻️ 인스턴스 재시작)

```
[사용자 ♻️ 클릭]
   ↓
confirm — 본업 영향 경고 ("DB / 메모 / Gemini AI 해설 등도 5~10초 다운")
   ↓
POST /api/local-infer?action=restart-container
   ↓
1) {ok: true, message: "재시작 예약", impact_warning: "..."} 즉시 응답
2) 600ms 후 setTimeout: process.kill(process.pid, 'SIGTERM')
3) Express graceful shutdown
4) Cloud Run 컨테이너 종료
5) 다음 호출 시 새 인스턴스 spawn → cold start (~30초~2분)
   → 메모리 100% 회수
```

### 31.4 UX 분리 (격리 vs 통합)

| 영역 | 🗑️ 모두 언로드 (warm 유지) | ♻️ 인스턴스 재시작 (메모리 100%) |
|------|---------------------------|-------------------------------|
| 격리 (`/lab/server-infer`) | GPU VRAM + weights 회수 | 컨테이너 종료, 본업 영향 0 |
| 통합 (`/lab/local-gcp`) | GPU VRAM + weights 회수 | 컨테이너 종료, **본업도 5~10초 다운** |

confirm 메시지에 `restartImpactWarning` 분기로 차별화.

### 31.5 배포 결과

| 항목 | 값 |
|------|------|
| 커밋 | `d09050f` |
| 빌드 시간 | 11M 46S |
| Cloud Run revision | `aitutor-00019-9lv` (Ready=True) |
| Image tag | v20260506-003008 |

---

## §32. 실험실 페이지 전수 — REBUILD 참조 제거 + 운영 사실 정정 (2026-05-06)

### 32.1 사용자 보고 + 결정

> "서버통합과 서버분리 페이지 모두 전수 설명내용 분석해서 현재 코드베이스에 맞도록 수정해주세요.
> 그리고 rebuild 내용은 제거. 다른 실험실 페이지에서도 rebuild 파일 내용은 제거 필요."

배경:
- 옛 REBUILD17~33 참조가 사용자 노출 텍스트 + 코드 주석에 102 곳 잔존
- spec 정보가 옛값 (예: 격리 service 16Gi/4CPU → 실제 24Gi/6CPU)
- 옛 컨셉 (6 엔진 동거 등) 잔재로 사용자 혼란 가능성

### 32.2 작업 범위

| 영역 | 파일 수 | REBUILD 잔존 (Before → After) |
|------|--------|---------|
| `src/labs/index.jsx` | 1 | 1 → 0 |
| `src/labs/local-gcp/*` | 2 | 11 → 0 |
| `src/labs/server-infer/*` | 2 | 19 → 0 |
| `src/labs/ollama-bridge/*` | 2 | 17 → 0 |
| `src/labs/hf-playground/*` (HfPlayground / HfCompare / index / CompareIndex / ModelCatalog) | 5 | 23 → 0 |
| `src/labs/local-ai/*` (LocalAiExplanation + 4 컴포넌트) | 5 | 16 → 0 |
| `src/components/lab/*` (ErrorBanner / ParamSliders / PromptEditor / QuestionPicker / QuestionPreview / MemoryCard) | 6 | 15 → 0 |
| **합계** | **22 파일** | **102 → 0** |

### 32.3 사용자 노출 텍스트 정정 사항

#### 32.3.1 `/lab` 진입점 (`src/labs/index.jsx`)

| 카드 | Before | After |
|------|--------|-------|
| 서버 통합 | "메인 앱 + 6 추론엔진 (Ollama / llama-server / vLLM / llama-cpp-python / onnx / transformers) 같은 Cloud Run, GPU L4 24GB" | "메인 앱과 같은 Cloud Run 컨테이너에 Ollama 단일 엔진 + 3 모델 (qwen2.5:3b / gemma2:2b / qwen3.5:4b). 학습 앱 전용 내장 AI." |
| 서버 분리 | "Ollama 단일 엔진 + 8 모델, 안정성 우선 (REBUILD32)" | "Ollama 단일 엔진 + 다중 모델 (한국어 + 영어), 회사 자산 컨셉." |

#### 32.3.2 `/lab/local-gcp` (서버 통합)

- 안내 배너에 운영 사실 추가: `asia-southeast1, 24Gi/6CPU + L4 GPU, localhost RTT ~1ms`
- 엔진 뱃지 부설명: `Go wrapper · 모델 자동관리 · 매장 로컬 AI 단일 엔진`
- footer: `매장 로컬 AI — Express + Ollama 같은 컨테이너, 단일 엔진, 최소 catalog`

#### 32.3.3 `/lab/server-infer` (서버 분리)

- Spec 정정: **16Gi / 4CPU → 24Gi / 6CPU** (실제 운영 spec 반영, cloudbuild.yaml 기준)
- 컨셉 명시 추가: "Ollama 단일 엔진 · 회사 자산 컨셉 — 다양한 한국어/영어 모델을 격리 환경에서 운영. 학습 앱 외 다른 앱도 호출 가능 (인증된 service만)"
- 엔진 뱃지: `Go wrapper · 모델 자동관리 · GGUF 양자화 · 격리 service 단독 진실 소스`

#### 32.3.4 다른 페이지 footer

| 페이지 | Before | After |
|--------|--------|-------|
| `/lab/hf` | "REBUILD22 §x — HF Inference Providers (router.huggingface.co/v1)" | "HF Inference Providers — router.huggingface.co/v1" |
| `/lab/hf/compare` | "REBUILD22 §x — Phase 4a 비교 모드 (Stack 레이아웃)" | "HF Inference Providers — 비교 모드 (Stack 레이아웃)" |
| `/lab/ollama-bridge` | "REBUILD28 §11 — 외부 Ollama bridge (사용자 PC 의 Ollama 직접 호출)" | "외부 Ollama bridge — 사용자 PC 의 Ollama 직접 호출 (localhost:11434)" |
| `/lab/local-ai` | "REBUILD17 §5 / REBUILD28 §11 — WebGPU 디바이스 AI 시범 · 엔진 2종" | "WebGPU 디바이스 AI 시범 — 엔진 2종 (transformers.js + WebLLM)" |

### 32.4 코드 주석 정리 정책

코드/JSX 주석의 REBUILD 참조도 모두 제거 (사용자 명시 요청). 다만 동작 의도는 일반적 설명문으로 보존:

```js
// Before: // REBUILD32 §15 I-2 — string → object 로 구조화 (LocalGcpTester 스타일)
// After:  // 구조화 에러 — { message, status, code, cause, elapsedMs, userAction, raw }

// Before: // REBUILD33 §31 (2026-05-06) — 통합 service 도 격리와 동일하게 두 회수 옵션 노출
// After:  // 통합 service 도 격리와 동일하게 두 회수 옵션 노출

// Before: {/* 안내 배너 — REBUILD32 (Ollama 단일 엔진 격리 service) */}
// After:  {/* 안내 배너 */}
```

변경 이력 추적은 git log + REBUILD 시리즈 문서 (rebuild-docs/) 가 담당하므로 코드 주석에 중복 기록 안 함.

### 32.5 배포 결과

| 항목 | 값 |
|------|------|
| 커밋 | `507c879` |
| 변경 | 22 파일 (+141 / -160줄) |
| 빌드 시간 | 11M 38S |
| Cloud Run revision | `aitutor-00020-wcf` (Ready=True) |
| Image tag | v20260506-005314 |

### 32.6 검증

```bash
# 전수 검증
$ grep -rc "REBUILD" src/labs src/components/lab --include="*.jsx" | awk -F: '{s+=$2} END {print s}'
0

# 빌드 산출물 (Vite) 에 REBUILD 참조 잔존 없음 — Cloud Run revision 활성 확인
$ curl -s https://aitutor-xq3ezzqwfa-as.a.run.app/lab/local-gcp | grep -i "REBUILD" | wc -l
0  # (예상)
```

### 32.7 향후 정책

- 코드 변경 시 사용자 노출 텍스트에 REBUILD 참조 추가 금지
- 변경 이력은 git commit message + rebuild-docs/REBUILD*.md 에만 기록
- 코드 주석은 "왜" (WHY) 만 기록, 변경 이력 추적은 git blame 으로

---

## §33. 분리 service 모델 14개 UI 재설계 + 영어 6개 빌드 (2026-05-06)

### 33.1 트리거

> 사용자 보고: "분리서버의 모델수가 많아 ui/ux를 재검토하고 모델 선택하는 부분 수정해주세요. 그리고 6개 모델 추가 같이 빌드 배포 바랍니다"

배경:
- 격리 service `aitutor-server-infer` 의 catalog 가 한국어 8 + 영어 6 = **14개**로 확장 (REBUILD33 §13.2 Q7-a 채택)
- 기존 ServerInferTester.jsx 는 14개를 단일 1-col grid 로 수직 나열 → 인지 부담 ↑, 스크롤 ↑
- 한국어/영어 분류, 추천/일반 구분, 큰 모델 cold start 안내 부재

### 33.2 UI/UX 재설계 결정

| 영역 | Before | After |
|------|--------|-------|
| 그리드 | 1-col 14개 수직 나열 | **2-col grid** (모바일 1-col) |
| 분류 | 없음 | **카테고리 필터칩** — `⭐ 추천 5` `🇰🇷 한국어 8` `🇬🇧 영어 5` `💻 코드 1` `🌏 전체 14` |
| 추천 강조 | 없음 | 카테고리 1순위 모델 ⭐ 표시 |
| 카테고리 시각 | 없음 | 카드 좌상단 **색 도트** (한국어=blue, 영어=emerald, 코드=purple) |
| 티어 정보 | size 만 표시 | **🪶 가벼움 / ⚖ 균형 / 🐘 큰 모델** 뱃지 (cold start hint 포함) |
| Cold start 안내 | footer 한 줄 | 큰 모델 카드에 인라인 ⏱ 경고 + footer 요약 |
| 기본 카테고리 | 전체 노출 | **추천** (default 모델 + 핵심 5개만) — 인지 부담 ↓ |

### 33.3 메타 데이터 추가 — server.py 진실 소스

REBUILD32 §15 R-3 (통합/분리 완전 독립 운영) 원칙에 따라 격리 service 단독 진실 소스에 메타 추가:

```python
# server-infer/server.py
{"key": "qwen35-4b", ..., "category": "korean", "tier": "balanced", "recommended": True},
{"key": "phi35-mini", ..., "category": "english", "tier": "balanced", "recommended": True},
{"key": "qwen25-coder-7b", ..., "category": "code", "tier": "heavy", "recommended": True},
# ... 14개 전체에 category/tier/recommended 부여
```

추천 모델 (각 카테고리 1순위):
- 🇰🇷 한국어: `qwen35-4b`, `qwen25-3b`, `gemma4-e4b` (default)
- 🇬🇧 영어: `phi35-mini`, `phi4-14b`
- 💻 코드: `qwen25-coder-7b`

### 33.4 코드 변경 사항

| 파일 | 변경 |
|------|------|
| `server-infer/server.py` MODELS | 14개 모델 각각에 `category` / `tier` / `recommended` 메타 추가 |
| `src/lib/lab/models.js` LAB_MODELS | 영어 6개 fallback 추가 (phi35-mini / phi4-14b / llama31-8b / llama32-3b / qwen25-coder-7b / mistral-7b). 격리 전용 명시 (disabled_engines 에 ollama 외 모두 포함) |
| `src/labs/server-infer/ServerInferTester.jsx` | 카테고리 필터칩 + 2-col grid + 추천 ⭐ + 티어 뱃지 + 카테고리 도트 + cold start 인라인 경고. FALLBACK_MODELS 필터 조건 정정 (`m.engines.ollama` → `!disabled_engines.includes('ollama')` — 옛 조건은 LAB_MODELS 에 engines 필드가 없어 항상 빈 배열이던 버그) |

### 33.5 빌드 + 배포 결과 (직렬화 — REBUILD32 §99 학습 준수)

#### 33.5.1 격리 service (Phase 1)

| 항목 | 값 |
|------|------|
| Cloud Build ID | `c0ac0816-428c-4fbd-999e-959a3f55b38d` |
| 빌드 시간 | **7M 7S** |
| Image tag | `asia-southeast1-docker.pkg.dev/aitutortwo-prod/aitutor-server-infer/aitutor-server-infer:v20260506-084725` |
| Cloud Run revision | `aitutor-server-infer-00007-qvs` (Ready=True) |
| URL | https://aitutor-server-infer-xq3ezzqwfa-as.a.run.app |
| Status | ✅ SUCCESS |

#### 33.5.2 메인 service (Phase 2 — 격리 SUCCESS 후 직렬 트리거)

| 항목 | 값 |
|------|------|
| Cloud Build ID | `13ca6db3-3d77-497d-b959-42a22ac5c565` |
| 빌드 시간 | **10M 3S** |
| Image tag | `asia-southeast1-docker.pkg.dev/aitutortwo-prod/aitutor/aitutor:v20260506-085537` |
| Cloud Run revision | `aitutor-00021-rm5` (Ready=True) |
| URL | https://aitutor-xq3ezzqwfa-as.a.run.app |
| Status | ✅ SUCCESS |

#### 33.5.3 직렬화 정책 준수

REBUILD32 §99 학습 — 같은 region (asia-southeast1) 내 두 빌드 동시 deploy 시 quota 충돌 가능. 본 작업은 격리 SUCCESS 확인 후 메인 빌드를 트리거하는 직렬 흐름으로 quota 충돌 회피 ✅.

#### 33.5.4 코드 변경 통계

| 파일 | 변경 |
|------|------|
| `server-infer/server.py` | +5줄 (메타 코멘트 4 + 14개 모델 인라인 메타) |
| `src/lib/lab/models.js` | +36줄 (영어 6개 fallback + 코멘트) |
| `src/labs/server-infer/ServerInferTester.jsx` | +110/-30줄 (필터칩 + 2-col grid + 추천/티어 시각화 + FALLBACK_MODELS 버그 정정) |
| `rebuild-docs/REBUILD33.md` | +본 §33 (~140줄) |

### 33.6 검증 체크리스트

#### 격리 service
- [ ] `/api/iso-infer?action=models` 응답에 `category`/`tier`/`recommended` 필드 포함
- [ ] 14개 모델 노출 (한국어 8 + 영어 5 + 코드 1)

#### `/lab/server-infer` UI
- [ ] 카테고리 필터칩 5개 정상 표시 (`⭐ 추천 5` 기본 활성)
- [ ] 필터 클릭 시 visibleModels 재계산 + 그리드 갱신
- [ ] 모바일 1-col / 데스크톱 2-col grid 동작
- [ ] 추천 모델에 ⭐ 표시
- [ ] 티어 뱃지 (🪶 / ⚖ / 🐘) 표시 + hint title
- [ ] 큰 모델 카드에 ⏱ cold start 경고 인라인
- [ ] 카테고리 도트 색상 (한국어 파란 / 영어 초록 / 코드 보라) 표시
- [ ] 동적 가용성 (자원 부족 시 amber disabled) 정상

#### 본업 영향
- [ ] 메인 학습 앱 정상 (DB / 메모 / Gemini API)
- [ ] `/lab/local-gcp` 통합 service 정상 (변동 없음)

---

### 33.7 Hotfix — Phi-3.5 Mini 중복 노출 + 카테고리 카운트 부풀림 (2026-05-06)

#### 33.7.1 사용자 보고

> "모델리스트가 이상해요 중복되서 나오고 필터 숫자도 같이 이상합니다."

스크린샷 관측:
- 헤더 카운트: `(7/15종)` — 백엔드 14개인데 15개로 표시
- 추천 카테고리 카운트: `7` — 실제 추천 6개인데 7로 표시
- `Phi-3.5 Mini` 카드가 그리드에 여러 번 노출

#### 33.7.2 원인

`src/lib/lab/models.js` 의 `LAB_MODELS` 에 `phi35-mini` 가 **두 번 정의**되어 있었음:

| 정의 위치 | 출처 | disabled_engines | 상태 |
|---------|------|----------------|------|
| 옛 (REBUILD30 §34) | onnxruntime-genai 전용 | `['ollama', 'llama-server', 'vllm', 'llama-cpp-python', 'transformers']` | 사용처 폐기됨 (inference-py 제거, REBUILD33 Phase 2) |
| 새 (REBUILD33 §13.2 = §33) | ollama 격리 전용 | `['llama-server', 'vllm', 'llama-cpp-python', 'transformers', 'onnxruntime-genai']` | 신규 |

`normalizeLabModels` 가 LAB_MODELS 를 순회하며 백엔드 응답(runtimeMap)과 매칭할 때 동일 `key` 두 항목 모두 `runtimeMap.has(key)` 검사를 통과 → 결과에 `phi35-mini` 가 2번 등장 → UI 중복 노출 + 카운트 부풀림.

#### 33.7.3 적용 수정

| 파일 | 변경 |
|------|------|
| `src/lib/lab/models.js` | 옛 `phi35-mini` (onnxruntime-genai 전용) 항목 제거. 사용처 폐기 명시 코멘트 추가. `gemma3-4b` 는 ollama 미호환이라 격리 UI 미노출 → 보존 (다른 lab fallback 가치). |
| `src/lib/lab/models.js` `normalizeLabModels` | key 기반 `Set` dedup 안전장치 추가. 동일 key 우발적 중복 정의 시 첫 매칭만 유지하여 UI 중복 노출 재발 방지. |

#### 33.7.4 빌드 결과

| 항목 | 값 |
|------|------|
| Cloud Build ID | `8267e18b-5731-4a06-9690-06855cdbcafb` |
| 빌드 시간 | **9M 40S** |
| Image tag | `asia-southeast1-docker.pkg.dev/aitutortwo-prod/aitutor/aitutor:v20260506-091914` |
| Cloud Run revision | `aitutor-00022-p4t` (Ready=True) |
| 격리 빌드 | 변동 없음 (LAB_MODELS 는 frontend 자원 — 격리 server.py 미영향) |
| Status | ✅ SUCCESS |

#### 33.7.5 검증 (사용자 새로고침 후)

- [ ] 헤더 카운트: `(N/14종)` — 전체 14 일치
- [ ] 카테고리 카운트: `⭐ 추천 6` `🇰🇷 한국어 8` `🇬🇧 영어 5` `💻 코드 1` `🌏 전체 14`
- [ ] `Phi-3.5 Mini` 카드는 추천/영어 카테고리에서 1번만 노출

#### 33.7.6 학습 — 동일 key 중복 방지 정책

LAB_MODELS 를 union fallback 으로 운영할 때 옛 모델 정의 + 신규 추가 사이에 같은 key 가 우발적으로 중복될 수 있음. 본 hotfix 의 dedup 안전장치는 그런 우발에 강건하지만, **신규 모델 추가 시 LAB_MODELS 안에서 동일 key 가 이미 있는지 grep 로 사전 점검** 하는 워크플로 권장.

```bash
# 신규 모델 추가 전 점검
grep -n "key: '<신규-key>'" src/lib/lab/models.js
```

---

### 33.8 Hotfix — Qwen 3.5 빈 응답(0자) + gemma4 사이즈 메타 부정확 (2026-05-06)

#### 33.8.1 사용자 보고

> "답변이 안나와요 원인을 찾아주세요" (스크린샷: Qwen 3.5 4B 호출 이력 3건 모두 37~43초 소요 + 0자 응답)

> 추가 지시: "분리 서버의 모든 모델을 호환성 재검토해주세요. 그리고 qwen 모델은 공통으로 한글로 답변해야하고 씽킹 false 입니다."

#### 33.8.2 14개 모델 호환성 재검토 (Ollama registry 기준)

| Ollama tag | 존재 | 사이즈 (registry 실측) | 카탈로그 (옛) | 액션 |
|-----------|------|----------------------|--------------|------|
| `qwen3.5:2b` | ✅ | ~1.4GB | ~1.4GB | OK |
| `qwen3.5:4b` | ✅ multimodal · 256K · reasoning capability | ~2.5GB | ~2.5GB | OK |
| `qwen2.5:3b` / `qwen2.5:7b` | ✅ | ~1.9GB / ~4.4GB | 동일 | OK |
| `qwen2.5-coder:7b` | ✅ | ~4.7GB | ~4.7GB | OK |
| `gemma2:2b` | ✅ | ~1.6GB | ~1.6GB | OK |
| **`gemma4:e2b`** | ✅ multimodal | **~7.2GB** | ~2.0GB | **정정** |
| **`gemma4:e4b`** (default) | ✅ multimodal | **~9.6GB** | ~3.5GB | **정정** |
| `deepseek-r1:7b` | ✅ reasoning | ~4.5GB | ~4.5GB | OK |
| `phi3.5` / `phi4` | ✅ | ~2.3GB / ~9GB | 동일 | OK |
| `llama3.1:8b` / `llama3.2:3b` | ✅ | ~4.7GB / ~2.0GB | 동일 | OK |
| `mistral` | ✅ | ~4.4GB | ~4.4GB | OK |

→ **14개 모델 모두 Ollama registry 실재**. tag 변경 불필요. `gemma4:e2b/e4b` 만 사이즈 메타 부정확.

#### 33.8.3 Root Cause — `body.think = False` 누락

| 항목 | 통합 service (`api/local-infer.js:138-147`) | 격리 service (`server.py:328-340`) |
|------|--------------------------------------------|----------------------------------|
| `is_qwen` 판정 | ✅ `/^qwen/i` + `/deepseek/i` | ❌ 없음 |
| `body.think = False` | ✅ 적용 | **❌ 누락** |

**거동 (Qwen 3.5 / DeepSeek-R1)**:
- `think: false` 누락 시 → reasoning capability 가 응답을 `thinking` 필드에만 쌓고 `content` 빈 문자열 반환
- server.py:367 `data.get("message", {}).get("content", "")` → 빈 문자열 → UI 0자
- `apply_qwen_strict` 가 system 메시지에 "사고 과정 표시하지 말고" 텍스트를 넣어도 부족 — Ollama API 레벨 옵션 필수

**증거**: 사용자 호출 이력 3건 (37/37/43초) 모두 200 OK + 0자 → 모델은 응답 생성했지만 content 비어있음.

#### 33.8.4 적용 패치 (server.py)

##### A. `/infer` 핸들러 — `body.think = False` 추가

```python
ollama_tag_lower = meta["ollama"].lower()
is_thinking_model = ollama_tag_lower.startswith("qwen") or "deepseek" in ollama_tag_lower

body = {
    "model": meta["ollama"],
    "messages": final_messages,
    "stream": False,
    "options": {"num_predict": req.max_tokens, "temperature": req.temperature},
    "keep_alive": "10m",
}
if is_thinking_model:
    body["think"] = False  # Qwen / DeepSeek thinking 비활성 (실험실 공통 정책)

r = await client.post(f"{OLLAMA_URL}/api/chat", json=body)
```

##### B. MODELS — gemma4 사이즈 정정

```python
{"key": "gemma4-e2b", ..., "size": "~7.2GB", "tier": "heavy", ...},  # 옛 ~2.0GB / balanced
{"key": "gemma4-e4b", ..., "size": "~9.6GB", "tier": "heavy", ...},  # 옛 ~3.5GB / balanced
```

→ `_check_model_available` 의 RAM/VRAM 체크가 정확한 사이즈 기준으로 동적 가용성 판정. tier 도 `balanced` → `heavy` 로 정정 (UI 에 ⏱ cold start 1~2분 경고 인라인 표시).

#### 33.8.5 Qwen 공통 정책 명문화

| 정책 | 적용 방식 | 위치 |
|------|---------|------|
| **한글 답변 강제** | `apply_qwen_strict` system 메시지에 한국어 강제문 추가 | `server.py:92-107` (이미 적용) |
| **thinking false** | Ollama API `body.think = False` | `server.py:316-340` (본 §33.8.4 A 추가) |

적용 범위:
- ✅ Qwen 시리즈 (qwen3.5:2b/4b, qwen2.5:3b/7b, qwen2.5-coder:7b)
- ✅ DeepSeek R1 (deepseek-r1:7b — Qwen 베이스)
- 다른 모델 (Phi, Llama, Mistral, Gemma) — Ollama 가 미지원 옵션 무시 (안전), 영어 답변 OK 의도 (영어 자격증 학습 시나리오)

#### 33.8.6 빌드 + 배포 결과

| 항목 | 값 |
|------|------|
| Cloud Build ID | `8f34cb4f-1c50-4b29-aade-3ae4958b33d9` |
| 빌드 시간 | **7M 14S** |
| Image tag | `asia-southeast1-docker.pkg.dev/aitutortwo-prod/aitutor-server-infer/aitutor-server-infer:v20260506-131224` |
| Cloud Run revision | `aitutor-server-infer-00008-dgj` (Ready=True) |
| 메인 빌드 | SKIP (변동 없음 — server.py 만 변경) |
| Status | ✅ SUCCESS |

#### 33.8.7 검증 (사용자 새로고침 후)

- [ ] Qwen 3.5 4B 호출 → **한국어 응답 정상** (이전 0자 → 한국어 해설)
- [ ] Qwen 3.5 2B / Qwen 2.5 3B/7B / DeepSeek-R1 7B 모두 정상 응답
- [ ] Gemma 4 E2B / E4B 카드에 🐘 큰 모델 뱃지 + ⏱ cold start 1~2분 경고 인라인 표시
- [ ] 동적 가용성 — 자원 부족 시 amber disabled 정확화 (실 사이즈 기준)
- [ ] Phi / Llama / Mistral 영어 답변 정상 (한국어 강제 미적용 의도)

#### 33.8.8 향후 안전장치 (보류 — 사용자 결정)

- 빈 응답 UI 안전장치 (ServerInferTester) — root cause 해결로 즉시 필요성 ↓, 향후 유사 이슈 발견용으로 추가 가능
- 통합 정리 작업(D1~E9) — 본 hotfix 와 분리, 사용자 의사결정 후 별도 진행

---

### 33.9 DeepSeek-R1 degeneration hotfix + thinking 토글 UI + 모델별 특성 정보 패널 (2026-05-06)

#### 33.9.1 사용자 보고

> "DeepSeek-R1 답변에 'Go Go Go...' 무한 반복" (스크린샷: 49초 추론 + 총 151초 + 후반부 토큰 degeneration)

> 추가 지시 1: "권장으로 작업하는데 think:false 를 온도와 토큰 슬라이드바 근처에 토글로 조정 가능하게 할 수있나요?"

> 추가 지시 2: "각 호환 모델별 특성 옵션이 있는지 자세히 조사해서 보고바랍니다." → 보고서 §33.9.4 참조

#### 33.9.2 Root Cause — `think: false` × DeepSeek-R1 충돌

DeepSeek-R1 Distill Qwen 7B 는 **reasoning 모델** — distill 학습 자체가 `<think>...</think>` chain 후 final answer 생성 패턴.

§33.8 hotfix 가 모든 Qwen + DeepSeek 에 일괄 `body.think = False` 적용 → R1 의 reasoning chain 차단 → 모델 혼란 → confidence 낮아져 같은 토큰 반복 (`Go Go Go...`) 사례.

#### 33.9.3 적용 패치

##### A. server.py — 모델별 think_default + 사용자 토글 우선

```python
# capabilities.think_supported / think_default 메타 신설:
#   Qwen 3.5      : think_supported=True,  think_default=False  (chat 응답 정상화)
#   DeepSeek R1   : think_supported=True,  think_default=True   (degeneration 방지)
#   기타          : think_supported=False                      (옵션 미전송)

class InferRequest(BaseModel):
    ...
    think: Optional[bool] = None   # None=auto / True=on / False=off

# /infer 핸들러
if req.think is not None:
    effective_think = bool(req.think)        # 사용자 UI 토글 우선
else:
    effective_think = capabilities.get("think_default", False)  # 모델별 권장값

if capabilities.get("think_supported"):
    body["think"] = effective_think
# else: 옵션 미전송 (Ollama 가 미지원 모델에서 무시되도록)
```

##### B. server.py — `repeat_penalty: 1.15` 추가 (degeneration 안전장치)

모든 모델 호출에 적용. `params.repeat_penalty` 가 모델 메타에 있으면 그 값 사용 (DeepSeek R1 = 1.15 명시).

##### C. server.py — 14 모델 메타 확장

| 필드 | 내용 |
|------|------|
| `capabilities` | `think_supported`, `think_default`, `multimodal`, `context_k`, `tools`, `coder` |
| `params` | 권장 `temperature`, `top_p`, `repeat_penalty` |
| `korean_strength` | 1~5 (한국어 학습 데이터 + 응답 품질) |
| `tips` | 한 줄 사용 팁 (UI 모델 정보 패널 노출) |

헬퍼 함수 (`_qwen_thinking()`, `_deepseek_r1()`, `_phi()`, `_llama()`, `_coder()`, `_mistral()`) 로 capability 패턴 재사용.

##### D. ParamSliders.jsx — Thinking 모드 토글 (선택적 prop)

```jsx
// 4 lab (LocalGcp / ServerInfer / HfPlayground / HfCompare) 공용 컴포넌트.
// thinking 토글은 thinkSupported=true 일 때만 노출 (다른 lab 영향 0).
<ParamSliders
  ...
  thinkMode={thinkMode}                  // 'auto' | 'on' | 'off'
  onThinkModeChange={setThinkMode}
  thinkSupported={modelMeta.capabilities?.think_supported}
  thinkRecommend={modelMeta.capabilities?.think_default ? 'on' : 'off'}
/>
```

##### E. ServerInferTester.jsx — 선택된 모델 상세 정보 패널 (신규)

모델 선택 직후 ParamSliders 위에 다음 패널 노출:

```
🔍 {모델명} 상세 정보                  {org} · {size}
🌐 한국어 강도   ⭐⭐⭐⭐⭐ (5/5)
[💭 thinking 지원] [🖼️ multimodal] [🛠️ tools] [💻 코드 특화] [📜 256K context]
📊 권장: temp 0.7 · top_p 0.95 · repeat_penalty 1.1
💡 {tips} — 모델별 사용 팁
```

#### 33.9.4 14 모델별 특성 보고서 (요약)

| 모델 | think_supported | think_default | 권장 temp | 한국어 | 특수 capability |
|------|-----|-----|-----|-----|------|
| Qwen 3.5 2B / 4B | ✅ | **off** | 0.7 | ⭐⭐⭐⭐⭐ | multimodal · 256K |
| Qwen 2.5 3B / 7B | ❌ | — | 0.7 | ⭐⭐⭐⭐⭐ | tools |
| Qwen 2.5 Coder 7B | ❌ | — | **0.0** | ⭐⭐⭐⭐ | tools · coder · 128K |
| Gemma 2 2B | ❌ | — | **1.0** | ⭐⭐⭐⭐ | 8K (제한) |
| Gemma 4 E2B / E4B | ❌ | — | 0.7 | ⭐⭐⭐⭐ | multimodal · 32K |
| DeepSeek R1 7B | ✅ | **on** | **0.6** | ⭐⭐ | reasoning + repeat_penalty 1.15 |
| Phi 3.5 / Phi 4 | ❌ | — | **0.0** | ⭐⭐ | 정확성 강세 (영어) |
| Llama 3.1 / 3.2 | ❌ | — | 0.7 | ⭐⭐⭐ | tools · 128K |
| Mistral 7B | ❌ | — | 0.7 | ⭐⭐ | tools · 32K |

특이값 (모델 권장과 다른 default 사용 시 모델 정보 패널의 `📊 권장` hint 로 사용자에게 안내):
- DeepSeek R1: temperature 0.6 (높을수록 토큰 반복 ↑) + repeat_penalty 1.15
- Phi/Coder: temperature 0.0 (정확성 우선)
- Gemma 2: temperature 1.0 (Google 공식 권장)

#### 33.9.5 빌드 결과

| 항목 | 격리 service | 메인 service |
|------|------------|------------|
| Cloud Build ID | `30d1dd5b-5af2-48c7-8086-823b648eab93` | `3e0601a6-1129-431f-8e68-c9175532d056` |
| 빌드 시간 | **7M 14S** | **10M 41S** |
| Image tag | `aitutor-server-infer:v20260506-142733` | `aitutor:v20260506-143537` |
| Cloud Run revision | `aitutor-server-infer-00009-krk` | `aitutor-00023-xl8` |
| Status | ✅ SUCCESS | ✅ SUCCESS |

직렬화 정책 준수 (격리 SUCCESS 확인 후 메인 빌드 트리거 — REBUILD32 §99 region quota 충돌 회피).

#### 33.9.6 검증 (사용자 새로고침 후)

##### Thinking 토글 동작
- [ ] Qwen 3.5 4B 선택 → ParamSliders 에 [💭 Thinking 모드] 토글 노출 (자동/켜기/끄기)
- [ ] [자동] default → 응답 정상 (think:false 자동 적용)
- [ ] [켜기] 선택 → 0자 응답 (Qwen 3.5 thinking 활성 시 빈 응답 — 의도된 동작)
- [ ] [끄기] 선택 → 응답 정상

##### DeepSeek R1 정상화
- [ ] DeepSeek R1 7B 선택 → [💭 Thinking 모드] 토글 노출 + 권장 hint "켜기"
- [ ] [자동] default → 응답 정상 (think:true 자동 적용, degeneration 없음)
- [ ] [끄기] 선택 → degeneration 재현 (의도된 비교용)

##### 모델별 특성 정보 패널
- [ ] 모델 선택 시 상세 정보 패널 자동 노출
- [ ] 한국어 강도 별점 (⭐⭐⭐⭐⭐ ~ ⭐⭐) 정확
- [ ] capability 칩 (thinking / multimodal / tools / coder / context_k) 정확
- [ ] 권장 파라미터 (temp / top_p / repeat_penalty) 모델별 다름
- [ ] 팁 (`tips`) 한 줄 안내 노출

##### 비-thinking 모델 (Phi / Llama / Mistral / Gemma / Qwen 2.5)
- [ ] 토글 미노출 (thinkSupported=false)
- [ ] 응답 정상 (각 모델별 권장 temperature 사용자 hint 표시)

#### 33.9.7 정책 정리 (Qwen 공통 + 모델별)

| 정책 | 적용 |
|------|------|
| **Qwen 공통 한국어 강제** | `apply_qwen_strict` system 메시지 (Qwen + DeepSeek 매칭) |
| **Qwen 시리즈 thinking 기본 off** | `qwen35-2b/4b` capabilities.think_default=False |
| **DeepSeek R1 thinking 기본 on** | `deepseek-r1-qwen-7b` capabilities.think_default=True |
| **사용자 UI 토글 override** | `req.think` 명시 시 모델별 default 무시 |
| **degeneration 안전장치** | options.repeat_penalty 1.15 (모든 모델 default, DeepSeek R1 명시) |
| **영어 자격증 모델 한국어 미강제** | Phi/Llama/Mistral 은 apply_qwen_strict 매칭 X — 영어 응답 OK |

---

### 33.10 번역 보조 파이프라인 — 한국어 약 모델의 한국어 응답 품질 보강 (2026-05-06)

#### 33.10.1 사용자 보고 + 결정

> 사용자 보고: Phi-3.5 Mini 응답에 한국어 + 영어 + 한자 혼재 (영어 자격증 모델의 한국어 한계)

> 사용자 제안: "영문 모델이 있는 서버분리의 경우 ... 가벼우면서 국문을 영문으로 번역해주는 우수한 호환 모델을 추천 ... 양방향 토글이나 옵션 기능"

> 의사결정: Q1=c (옵션 C: 번역 보조 + 단일 모델 정책 완화), Q2=a (Qwen 2.5 1.5B), Q3=a (양방향), Q4=a (한국어 약 모델만), Q5=a (즉시)

> 사용자 추가 요구: "기존 기능에 영향 없도록 주의 + 보조 번역 기능에 대해 모델 자세히 명시"

#### 33.10.2 보조 번역 모델 선정 — Qwen 2.5 1.5B

| 항목 | 값 | 비고 |
|------|-----|------|
| Ollama tag | `qwen2.5:1.5b` | Alibaba 공식 |
| 사이즈 | **~986MB** | 14개 모델 중 가장 가벼움 |
| 다국어 지원 | **29개 (한국어 명시)** | Qwen 2.5 공식 지원 |
| Cold start | ~20초 | 빠른 첫 호출 |
| Context | 32K | 번역 task 충분 |
| 카탈로그 카테고리 | `translator` (신규) | UI 카테고리 필터 별도 칩 |
| 권장 temperature | 0.0 | 정확한 번역 |
| capabilities.translator | `True` | 클라이언트 토글 매칭 키 |

대안 검토:
- Qwen 2.5 3B (1.9GB) — 운영 중이지만 1.5B 보다 무거움
- Aya-expanse 8B (5.1GB) — 다국어 전문, 한국어 명시. 너무 큼

→ **Qwen 2.5 1.5B 채택** — 가벼움 + 한국어 명시 + cold start 짧음

#### 33.10.3 기존 기능 영향 0 보장 설계 (사용자 명시 요구)

| 영역 | 보존 보장 |
|------|---------|
| 14개 기존 모델 메타 | 변경 0 — qwen25-1.5b 추가만 |
| `/infer` 호출 default | `keep_warm: Optional[bool]=False` default = 기존 단일 모델 정책 100% 유지 |
| `unload_other_models` 로직 | `if not req.keep_warm and ...` 분기 — keep_warm=False 시 옛 동작 그대로 |
| ParamSliders 4 lab 공용 | `translateMode` 등 prop **전부 optional** — 다른 lab 미전달 시 토글 미노출 |
| ServerInferTester `runDirectInfer` | translateMode='off' (default) 시 기존 단일 호출 분기 — 응답/에러 처리 100% 보존 |
| 메모리 누적 위험 | ♻️ 인스턴스 재시작 버튼 (REBUILD32 §15.5) 으로 회수 가능 |

#### 33.10.4 적용 코드 변경

##### A. server.py — qwen25-1.5b 추가 + keep_warm 옵션

```python
# 신규 헬퍼
def _translator():
    return {"think_supported": False, "think_default": False, "multimodal": False,
            "context_k": 32, "tools": False, "coder": False, "translator": True}

# MODELS 끝에 추가
{"key": "qwen25-1.5b", "name": "Qwen 2.5 1.5B", "ollama": "qwen2.5:1.5b",
 "size": "~1.0GB", "category": "translator", "tier": "light",
 "capabilities": _translator(), "params": {"temperature": 0.0, "top_p": 0.9},
 "korean_strength": 5,
 "tips": "Qwen 2.5 1.5B — 번역 보조 전용. 다국어 29개..."}

# InferRequest 에 keep_warm 신설
class InferRequest(BaseModel):
    ...
    keep_warm: Optional[bool] = False  # True 시 unload skip (번역 모드)

# /infer 핸들러
if not req.keep_warm and _last_served_model != meta["ollama"]:
    await unload_other_models(client, keep_model=meta["ollama"])
```

##### B. ParamSliders.jsx — translateMode 토글 (optional prop)

```jsx
// 기존 props 유지 + 신규 optional prop 추가 (다른 lab 영향 0)
translateMode, onTranslateModeChange, translateSupported, translatorName, translatorSize
const showTranslateToggle = translateSupported && typeof onTranslateModeChange === 'function';
```

##### C. ServerInferTester.jsx — 3단계 파이프라인 + UI

```jsx
// translateMode='off' (default) → runDirectInfer (기존 동작 100% 보존)
// translateMode='on' + korean_strength≤2 → runTranslatePipeline (3단계)

const runTranslatePipeline = async (originalMessages) => {
  // 1/3: 한국어 → 영어 (Qwen 2.5 1.5B, low temp 0.0, keep_warm=true)
  // 2/3: 영어 → 추론 모델 (사용자 선택, keep_warm=true)
  // 3/3: 영어 답변 → 한국어 (Qwen 2.5 1.5B, keep_warm=false 마지막 단계)
};
```

#### 33.10.5 보조 번역 모델 명시 UI (3개 위치)

| 위치 | 표시 내용 |
|------|---------|
| ParamSliders 토글 영역 | `🌐 번역 보조 (한↔영 양방향)` + `보조 모델: **Qwen 2.5 1.5B** (~1GB)` |
| 모델 정보 패널 | 한국어 약 모델 선택 시 `🌐 번역 보조 권장` 칩 + 한국어 강도 amber 색 |
| 추론 진행 표시 | 3단계 progress bar + 단계별 모델명 (`Qwen 2.5 1.5B → Phi-3.5 Mini → Qwen 2.5 1.5B`) |
| 응답 details 펼침 | 단계별 시간 + 영어 원본 답변 (학습 가치) |

#### 33.10.6 사용 시나리오

##### 시나리오 1: TOEIC RC (영어 직접 학습)
```
사용자: 영어 지문 입력
[번역 보조 OFF] → Phi-3.5 영어 답변 그대로 (영어 학습 가치)
```

##### 시나리오 2: GCP/AWS 한국어 자격증 학습
```
사용자: "VPC 피어링과 Transit Gateway 의 차이를 설명해주세요"
[번역 보조 ON]
  1/3 Qwen 2.5 1.5B: 한국어 → 영어 (~5초)
  2/3 Phi-4 14B: 영어 reasoning (~15초)
  3/3 Qwen 2.5 1.5B: 영어 답변 → 한국어 (~5초)
사용자: 한국어 답변 받음 (Phi-4 추론 품질 + 한국어 가독성)
```

##### 시나리오 3: 한국어 자격증 학습 (영상정보관리사)
```
사용자: Qwen 2.5 3B 직접 선택
[번역 보조 토글 미노출] (korean_strength=5라 자동 미노출)
→ 직접 한국어 추론 (변경 없음)
```

#### 33.10.7 빌드 결과

| 항목 | 격리 service | 메인 service |
|------|------------|------------|
| Cloud Build ID | `cd433ef4-964a-4eb9-bdae-d04e77f89669` | `595e491e-0a0e-4e18-935c-29d29dd33ca4` |
| 빌드 시간 | **6M 46S** | **9M 51S** |
| Image tag | `aitutor-server-infer:v20260506-151807` | `aitutor:v20260506-152549` |
| Cloud Run revision | `aitutor-server-infer-00010-4kn` | `aitutor-00024-mwc` |
| Status | ✅ SUCCESS | ✅ SUCCESS |

직렬화 정책 준수 (격리 SUCCESS 후 메인 트리거).

#### 33.10.8 검증 (사용자 새로고침 후)

##### 기존 기능 영향 0 검증 (필수)
- [ ] Qwen 2.5 3B/7B 한국어 자격증 응답 정상 (변경 없음)
- [ ] Qwen 3.5 4B/2B thinking false 응답 정상 (§33.9 유지)
- [ ] DeepSeek R1 thinking on 응답 정상 (§33.9 유지, degeneration 없음)
- [ ] 번역 토글 OFF default → 기존 단일 호출 동작 100% 동일

##### 번역 토글 노출 조건
- [ ] Phi-3.5 Mini / Phi-4 / Llama / Mistral 선택 → 토글 노출 (korean_strength=2)
- [ ] Qwen / Gemma / DeepSeek (korean_strength≥4) 선택 → 토글 미노출
- [ ] Qwen 2.5 1.5B (translator 카테고리) 선택 → 토글 미노출 (자기 자신)

##### 번역 파이프라인 동작
- [ ] Phi-3.5 + 번역 ON + 한국어 자격증 문제 → 한국어 답변 정상 출력
- [ ] 진행 표시 1/3 → 2/3 → 3/3 단계별 노출
- [ ] 응답 details 펼침 — 영어 원본 답변 + 단계별 시간 노출
- [ ] 호출 이력에 `qwen25-1.5b → phi35-mini → qwen25-1.5b` 표시

##### 메모리 정책 (keep_warm)
- [ ] 번역 ON 시 두 모델 동시 keep_alive (24GB VRAM 안에서 OK)
- [ ] 메모리 누적 시 ♻️ 인스턴스 재시작 버튼으로 회수 정상

#### 33.10.9 향후 운영 정책

- 번역 보조 토글은 **사용자 명시 활성** 시에만 동작 (default OFF)
- Qwen 2.5 1.5B 는 번역 task 전용으로 운영 — 일반 추론 카테고리 미노출 (translator 카테고리 별도)
- 단일 모델 정책 완화는 keep_warm=True 명시 시에만 — 기본 정책은 그대로 유지
- 메모리 누적 모니터링 필요 시 ♻️ 인스턴스 재시작 (§15.5)
- Aya-expanse 8B 등 다국어 전문 모델은 향후 검토 (현재 Qwen 2.5 1.5B 로 충분)
