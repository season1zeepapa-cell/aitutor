# REBUILD32 — 격리 추론 service 재설계 (Ollama 단일 엔진 전용)

> **수립**: 2026-05-04 19:30 KST
> **트리거**: REBUILD31 §99 옵션 B-1 빌드 4번 연속 quota 초과 fail → "자체 호스팅 추론 컨셉" 유지 위해 컨셉 자체 재설계
> **결정자**: 사용자 (2026-05-04 19:30)
> **상태**: 계획 수립 — 사용자 §0 답변 후 구현 진입

---

## §0. 의사결정 — 사용자 답변 (2026-05-04 20:30 KST 확정 ✅)

| # | 질문 | 사용자 답변 |
|---|------|-----------|
| **Q1** | 신규 service 이름 | **a) `aitutor-server-infer`** (UI 경로 `/lab/server-infer` 와 일치) |
| **Q2** | Region | **a) `asia-southeast1`** (가벼운 spec 으로 quota 안전 확보) |
| **Q3** | GPU 사용 | **a) GPU L4 1개** (Ollama CUDA 가속) |
| **Q4** | 호환 모델 범위 | **a) 8개 전부** (qwen3.5/2.5, gemma2/4, deepseek-r1) |

> 사용자 답변: "고!!!!" (전부 추천대로 a/a/a/a 확정)

---

## §1. 컨셉 — 단일 엔진 별도 service

### 1.1 전제

- 격리 service `aitutor-inference` 의 **본래 컨셉(자체 호스팅 multi-engine 추론)** 은 사용자 본인이 명시 유지 결정
- 단 현재 구조(6 엔진 동거 + Cloud Run 단일 컨테이너)는 region quota 협소로 **운영 불가능 입증** (REBUILD31 §99 빌드 4번 fail)
- 컨셉 유지 + 운영 가능성 확보를 위해 **단일 안정 엔진(Ollama) 전용** 으로 단순화

### 1.2 단일 엔진 = Ollama 선정 근거

| 엔진 | 안정성 | 모델 자동관리 | GGUF/원본 지원 | 격리 service 적합도 |
|------|------|---|---|---|
| **Ollama** | ⭐⭐⭐⭐⭐ | ✅ 자체 registry | ✅ GGUF | ⭐⭐⭐⭐⭐ |
| llama-server | ⭐⭐⭐⭐ | ❌ 수동 GGUF 다운 | ✅ GGUF | ⭐⭐⭐ |
| vLLM | ⭐⭐⭐ | ❌ 수동 HF | 원본 weights | ⭐⭐ (cold start 길고 메모리 큼) |
| llama-cpp-python | ⭐⭐⭐ | ❌ HF Hub 수동 | ✅ GGUF | ⭐⭐ (Python wrapper overhead) |
| onnxruntime-genai | ⭐⭐ | ❌ HF Hub | ONNX 형식 | ⭐ (model_type wheel 잠금 이슈, gemma3 사례) |
| transformers | ⭐⭐ | ❌ HF Hub | 원본 | ⭐⭐ (CPU 데모급 속도) |

**Ollama 가 가장 안정 + 운영 단순** → 격리 service 의 단일 엔진으로 채택.

### 1.3 UI/UX 정책

- `/lab/server-infer` UI **유지** — 사용자가 익숙한 경험 보존
- 단 **엔진 선택 UI 제거** (단일 엔진이라 무의미)
- 모델 카드 = **Ollama 호환 모델만** 표시 (현재 catalog 의 `engines.ollama` 매핑 있는 모델)
- 호출 흐름 = 메인 service 와 동등 (서버 통합과 같은 모델 카탈로그 노출)

---

## §2. 아키텍처 비교 (옛 → 신)

### 2.1 옛 격리 service (REBUILD26~30, 폐기됨)

```
aitutor-inference (Cloud Run, asia-southeast1)
├─ image: aitutortwo-prod/aitutor/aitutor (메인과 공유, PROCESS_MODE=isolated 분기)
├─ 자원: 32Gi / 8 CPU + L4 GPU
├─ 엔진 6개 동거:
│   ├─ Ollama (port 11434)
│   ├─ llama-server (port 11435, lazy)
│   ├─ vLLM (port 11436, lazy)
│   └─ Python sub-server (port 11442) — llama-cpp-python / onnx / transformers
└─ FastAPI uvicorn 단일 진입점
```

### 2.2 신규 격리 service (REBUILD32, 본 PR)

```
aitutor-server-infer (Cloud Run, asia-southeast1, Q1/Q2 결정 따름)
├─ image: aitutortwo-prod/aitutor-server-infer/server-infer (별도 image, 가벼움)
├─ 자원: 16Gi / 4 CPU + L4 GPU (Q3 결정 따름)
├─ 엔진 1개:
│   └─ Ollama (port 11434)
└─ FastAPI uvicorn 또는 Express 단일 진입점 (TBD §4.3)
```

---

## §3. 신규 자원 spec (Q1~Q3 결정 후 확정)

| 항목 | 신규 spec (추천) | 옛 spec |
|------|---------------|---------|
| service name | `aitutor-server-infer` | `aitutor-inference` |
| image repo | `aitutor-server-infer/server-infer` | `aitutor/aitutor` (공유) |
| memory | **16Gi** (Ollama + 7B 모델 GGUF 충분) | 32Gi |
| CPU | **4 vCPU** | 8 |
| GPU | **L4 1개** | L4 1개 |
| min-instances | 0 | 0 |
| max-instances | 1 | 1 |
| concurrency | 10 | 10 |
| timeout | 600s | 600s |
| service account | `aitutor-server-infer-run@` (별도) | `aitutor-inference-run@` |
| auth | `--no-allow-unauthenticated` (메인 ID token 호출만) | 동일 |
| env | `OLLAMA_HOST=0.0.0.0:11434`, `OLLAMA_MODELS=/var/ollama/models` | 동일 + `PROCESS_MODE=isolated`, `GPU_ENABLED=1` |

> **자원 절감**: 32→16Gi, 8→4 CPU = **메모리 50% / CPU 50% 절감**. region quota 압박 해소 + 비용 ↓.

---

## §4. 코드 변경 범위 (전수)

### 4.1 신규 디렉토리/파일

| 경로 | 역할 |
|------|------|
| `workspace/aitutor/server-infer/` (신규) | 격리 service 별도 코드 root |
| `server-infer/Dockerfile` | Ollama only image (Node/Express/Python venv 모두 제거) |
| `server-infer/start.sh` | Ollama serve + 헬스체크 + watchdog |
| `server-infer/server.py` | FastAPI `/healthz` `/infer/models` `/infer` 3개 endpoint |
| `server-infer/cloudbuild.yaml` | 별도 cloudbuild — image 빌드 + Cloud Run 배포 |

### 4.2 수정 대상 (메인 service 측)

| 파일 | 변경 |
|------|------|
| `api/iso-infer.js` | base URL 환경변수 → `SERVER_INFER_URL` 로 명칭 변경 (또는 ISO_INFER_URL 유지하고 값만 새 service URL 로). engine 파라미터 forward 제거 |
| `cloudbuild.yaml` | `_ISO_INFER_URL` substitution 값 갱신 (신규 service URL) |
| `src/labs/server-infer/ServerInferTester.jsx` | 엔진 선택 dropdown/state 제거, `engineKey` 관련 모든 로직 정리. 모델 dropdown은 ollama 호환만 노출 |
| `src/lib/lab/engines.js` | server-infer 화면용 engines 호출 제거 (단일이라 불필요) |
| `src/components/lab/QuestionPicker.jsx` 등 공통 | 영향 0 (서버 통합 LocalGcpTester 와 공유 컴포넌트는 그대로) |

### 4.3 server-infer/server.py 설계 (신규 격리 service 의 진입점)

```python
# FastAPI 단일 파일 (간소함)
GET  /healthz             → {"ok": True, "ollama": <reachable>}
GET  /infer/models        → catalog 의 ollama 호환 모델 list
POST /infer               → body: {model_key, messages, max_tokens, temperature}
                          → Ollama /api/chat 으로 forward (한국어 강제 + thinking 비활성)
```

- 인증: 메인 service 가 ID token 으로 호출 → `--no-allow-unauthenticated` 로 외부 차단
- 모델 자동 pull: 첫 호출 시 `ollama pull <model>` 자동 (현재 메인 service `ensureOllamaModel` 동일 패턴)

---

## §5. 폐기 대상 (REBUILD31 §99 후속 정리)

- ❌ 옛 `aitutor-inference` Cloud Run service (이미 §99 작업 중 삭제됨 ✅)
- ❌ `inference-py/` 디렉토리 안의 일부 파일 (서버 통합 측은 유지, 격리 측 코드는 server-infer/ 로 이전):
  - `inference-py/engines/onnx.py` — 격리 측에서만 쓰던 코드. 메인 측 server.js → /api/local-infer 는 inference-py sub-server (port 11442) 호출 → 메인 image 에 inference-py 그대로 유지 (서버 통합용)
  - 즉 **inference-py/ 자체는 메인 image 에 남겨두고**, 격리 측은 별도 server-infer/ 로 분리
- ❌ `cloudbuild.yaml` 의 `cloud-run-deploy-inference` step (옛 격리 service 배포) → server-infer/cloudbuild.yaml 로 이전
- ❌ `start.sh` 의 `PROCESS_MODE=isolated` 분기 (REBUILD32 부터 옛 격리 image 재사용 패턴 폐기)

---

## §6. 단계별 실행 계획 (Q1~Q4 결정 후)

| Phase | 작업 | 예상 시간 |
|------|------|---------|
| **P1. 신규 디렉토리 + Dockerfile** | server-infer/ 디렉토리 생성, Ollama only Dockerfile (~50줄) | 30분 |
| **P2. server.py FastAPI 작성** | /healthz, /infer/models, /infer 3개 endpoint | 1시간 |
| **P3. start.sh + cloudbuild.yaml** | Ollama daemon spawn + 헬스체크 + Cloud Run 배포 step | 30분 |
| **P4. SA + Artifact Registry repo 생성** | `aitutor-server-infer-run@` SA + `aitutor-server-infer` repo | 15분 |
| **P5. 첫 빌드 + 배포 검증** | gcloud builds submit + service describe + curl healthz | 25분 (빌드) |
| **P6. 메인 service env 갱신** | `_ISO_INFER_URL` → 신규 URL, cloudbuild 재빌드 | 25분 |
| **P7. 옛 cloud-run-deploy-inference step 제거** | cloudbuild.yaml 정리 | 10분 |
| **P8. ServerInferTester.jsx 엔진 로직 제거** | dropdown/state 정리 | 1시간 |
| **P9. 운영 검증** | Cmd+Shift+R + 5개 모델 차례 호출 + 풍부 에러 UI 확인 | 30분 |
| **P10. REBUILD30 §49 / REBUILD31 §99 stale 주석 정정** | 관련 문서 업데이트 | 30분 |

총 예상: **약 5~6시간** (빌드 대기 시간 포함)

---

## §7. 비용 추정

| 자원 | 옛 격리 (32Gi/8CPU/L4) | 신규 격리 (16Gi/4CPU/L4) | 절감 |
|------|---------------------|------------------------|------|
| Cloud Run instance (idle, min=0) | $0 | $0 | $0 |
| Cloud Run instance (active 1h/일) | ~$3/월 | ~$2/월 | ~$1/월 |
| GPU L4 (active 1h/일) | ~$15/월 | ~$15/월 | $0 (GPU 동일) |
| Artifact Registry image storage | ~1.5GB | ~0.8GB (가벼움) | ~$0.05/월 |
| **합계 (가벼운 사용 가정)** | **~$18/월** | **~$17/월** | ~$1/월 |

비용 측면 절감 효과는 작지만, **운영 안정성(quota 안전) + cold start 단축** 이 핵심 이득.

---

## §8. 검증 체크리스트

- [ ] 신규 service `aitutor-server-infer` Cloud Run 배포 SUCCESS
- [ ] `/healthz` 200 OK (ID token)
- [ ] `/infer/models` 응답에 ollama 호환 모델 8개 모두 포함
- [ ] `/infer` 첫 호출 시 ollama pull 자동 + 응답 OK (qwen2.5:3b 기준 30~60초)
- [ ] `/infer` 두 번째 호출 (warm) 5초 이내
- [ ] 메인 service `/api/iso-infer?action=models` HTTP 200 + 모델 list 정상
- [ ] 메인 service `/api/iso-infer` POST 추론 응답 정상
- [ ] `/lab/server-infer` UI 에서 엔진 선택 dropdown 사라진 것 확인
- [ ] 모델 dropdown 에 ollama 호환 모델만 노출
- [ ] 추론 결과 풍부 에러 UI 정상 (실패 시 명확한 메시지)
- [ ] region quota 사용량: 메인 24Gi + 격리 16Gi = 40Gi (안전)

---

## §9. 다음 액션

> 사용자 §0 Q1~Q4 답변 → P1 즉시 시작.

답변 양식 (예시):
```
Q1: a (aitutor-server-infer)
Q2: a (asia-southeast1)
Q3: a (GPU L4)
Q4: a (8개 전부)
```

또는 **"전부 추천대로"** 한마디로 a/a/a/a 확정 가능.

---

## §10. 참고 — 기존 폐기 의도 문서 정정 예정 (별도 commit)

- REBUILD30 §49 "legacy aitutor-inference 폐기, 일심동체 image 단일화" — 본 PR 로 진짜 실행 (이전엔 service 살아있었음)
- REBUILD31 §99.7 배포 추적 표 갱신 — 본 PR 결과 반영
- REBUILD31 §99.8/9/10 추가 — 옵션 A/B-1 시도/fail/폐기 흐름 정리

---

## §11. 실행 결과 (P1~P9 완료, 2026-05-04 21:24 KST)

### 11.1 phase 별 결과

| Phase | 작업 | 결과 |
|------|------|------|
| **P1** | server-infer/Dockerfile (Ollama only, CUDA 12.4 runtime) | ✅ 작성 |
| **P2** | server-infer/server.py (FastAPI 3 endpoint, 모델 8종 카탈로그) | ✅ 작성 |
| **P3** | server-infer/start.sh + cloudbuild.yaml (16Gi/4CPU + L4) | ✅ 작성 |
| **P4** | Artifact Registry repo (`aitutor-server-infer`) + SA (`aitutor-server-infer-run@`) + IAM | ✅ 생성 |
| **P5** | 첫 빌드 `c9b80550` + Cloud Run 배포 | ✅ SUCCESS (14분) |
| **P6** | 메인 cloudbuild `_ISO_INFER_URL` 갱신 | ✅ |
| **P7** | 메인 cloudbuild `cloud-run-deploy-inference` step 제거 | ✅ |
| **P8** | ServerInferTester.jsx 엔진 로직 제거 (-103줄 net) | ✅ |
| **P9** | 메인 service 새 빌드 `2be5d1f7` + 통합 검증 | ✅ SUCCESS (29분) |
| **P10** | 문서 정정 (REBUILD30 §28 + REBUILD31 §99.7~10 + 본 §11~12) | ⏳ 본 commit |

### 11.2 commit 흐름 (REBUILD32 관련 — 전수)

| # | 커밋 | 내용 | Cloud Build |
|---|------|------|-------------|
| 1 | `3b2564b` | `docs: REBUILD32 신규 — Ollama 단일 엔진 재설계 계획` (계획서) | — |
| 2 | `6d0bc0e` | `feat: server-infer/ 신규 — Ollama 단일 엔진 격리 service (P1~P4)` | `c9b80550` SUCCESS (14분) |
| 3 | `04e80dd` | `refactor: REBUILD32 P6~P8 — 메인 측 격리 service 통합 변경` | `2be5d1f7` SUCCESS (29분) |
| 4 | `88a45eb` | `docs: REBUILD32 P10 — 3개 문서 정정 (REBUILD30/31/32)` | — |
| 5 | `1b1d42c` | `ui: server-infer UI/UX REBUILD32 컨셉 반영 — stale 6 엔진 표현 정리` | `06ad1dc9` SUCCESS (32분) |
| 6 | `aa629c4` | `feat: server-infer 단일 모델 정책 + keep_alive=10m (후속)` | `6a4a36ce` FAIL (quota 충돌) → `986433e2` SUCCESS (14분) |
| 7 | `4e10cc9` | `docs: REBUILD32 §11.5 + §12.3 — 단일 모델 정책 + 빌드 직렬화 학습` | — |
| 8 | (본 commit) | `docs: REBUILD32 §11.6 + §14 — 최종 작업 완료 선언` | — |

**총 8 commits, 5번의 SUCCESS 빌드** (1번 FAIL 회복 포함).

### 11.3 서비스 최종 상태

| Service | revision | image | spec |
|---------|---------|-------|------|
| 메인 `aitutor` | `aitutor-00012-nh8` | `aitutor/aitutor:v20260504-205300` | 24Gi / 6CPU + L4 |
| 격리 `aitutor-server-infer` | `aitutor-server-infer-00001-7hm` | `aitutor-server-infer/server-infer:v20260504-203257` | **16Gi / 4CPU + L4** |

### 11.4 코드 정리 효과

- 4개 파일 변경, **-103줄 net** (격리 dead code 제거)
- start.sh `PROCESS_MODE=isolated` 분기 35줄 → 4줄 주석
- ServerInferTester.jsx 318 → 235줄 (단일 엔진 가정 단순화)
- cloudbuild.yaml 의 `cloud-run-deploy-inference` step 제거 (책임 분리)

### 11.5 후속 — 단일 모델 정책 + keep_alive (2026-05-04 22:27 KST, commit `aa629c4`)

**트리거**: 사용자 질문 — "모델 변경 시 서버 메모리 누적되는가?"

**진단**: 초기 server.py 의 `/infer` 는 Ollama default (5분 idle 후 unload) 만 사용 → 사용자가 빠른 모델 전환 시 VRAM 에 여러 모델 누적 가능.

**적용 변경** (server-infer/server.py):
- `unload_other_models(client, keep_model)` 추가 — `/api/ps` 로 메모리 로드 모델 조회 후 keep_model 외 모두 `keep_alive=0` 으로 즉시 unload
- `/infer` 흐름: ensure_ollama_model → unload_other_models → /api/chat (keep_alive=10m)
- 정책 일관성: OllamaBridgeTester (사용자 PC Ollama 모드, REBUILD29 §13) 와 동일한 단일 모델 정책

**빌드 흐름 (학습 가치)**:
1. 1차 시도 빌드 `6a4a36ce` — 메인 빌드 `06ad1dc9` 와 병렬 진행 → **region quota 충돌로 fail**
   - 메인 active(24) + 메인 transient(24) + server-infer active(16) + server-infer 새(16) = 80Gi 시도
2. zombie 정리 — server-infer service 임시 delete (32Gi 회수, 사용자 영향 0 — 24h 트래픽 0)
3. 메인 빌드 SUCCESS 대기 → 메인 새 revision `aitutor-00013-b67` 트래픽 100%
4. 2차 시도 빌드 `986433e2` — 메인 + server-infer 새(16) = 40Gi → **SUCCESS** (13분)
5. service 재생성으로 IAM invoker 권한 재부여 (메인 SA → server-infer)

**최종 revision**: `aitutor-server-infer-00001-zlc`, tag `v20260504-221227`

**🧠 학습 — 같은 region 빌드 직렬화 필요**:
- 메인 cloudbuild + server-infer cloudbuild 가 별도 파이프라인이지만 **같은 region quota 공유**
- 두 빌드 병렬 deploy = quota 충돌 (이번 사례)
- 향후 정책: 한 빌드 끝까지 기다린 후 다른 빌드 트리거 (CI 체인 또는 명시적 흐름)

### 11.6 최종 운영 상태 (2026-05-04 22:30 KST)

**asia-southeast1 region** (총 quota 사용: **40Gi / 10 CPU + 2 GPU L4**)

| Service | revision | image tag | 자원 | 적용 변경 |
|---------|---------|-----------|------|---------|
| **`aitutor`** (메인) | `aitutor-00013-b67` | `v20260504-213731` | 24Gi / 6CPU + L4 | REBUILD31 §99 모두 + REBUILD32 UI/UX 정정 |
| **`aitutor-server-infer`** (격리) | `aitutor-server-infer-00001-zlc` | `v20260504-221227` | 16Gi / 4CPU + L4 | REBUILD32 단일 엔진 + 단일 모델 정책 + keep_alive=10m |

**서비스 분리 컨셉 실현 완성도**:

```
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│   메인 service (aitutor)         │    │ 격리 service (aitutor-server-infer)│
│   image: aitutor/aitutor         │    │ image: aitutor-server-infer/...  │
│   24Gi / 6 CPU + L4 (서버 통합)  │    │ 16Gi / 4 CPU + L4 (서버 분리)     │
│   엔진 6개 (Ollama / llama-server│    │ Ollama 단일 + 8 모델              │
│   / vLLM / sub-server×3)         │    │ 단일 모델 정책 (메모리 누적 방지)  │
│   cloudbuild: ./cloudbuild.yaml  │    │ cloudbuild: server-infer/...     │
└──────────────────────────────────┘    └──────────────────────────────────┘
            │                                       ▲
            └─── /api/iso-infer ──ID token─────────┘
                 (메인 SA → 격리 SA invoker)
```

**책임 분리 ✅** + **별도 image ✅** + **Ollama 단일 엔진 ✅** + **단일 모델 정책 ✅** + **quota 안전 ✅**

---

## §12. 검증 결과 + 미해결 항목

### 12.1 자동 검증 (P9 Monitor 결과)

```
[메인]   rev=aitutor-00012-nh8  tag=v20260504-205300  traffic=100%
[격리]   rev=aitutor-server-infer-00001-7hm  tag=v20260504-203257
/api/local-infer?action=health  HTTP 401 (auth 통과 전 정상) time=275ms
/api/iso-infer?action=models    HTTP 401 (auth 통과 전 정상) time=147ms
```

→ 두 service 모두 endpoint reachable + 정상 routing 확인.

### 12.2 사용자 운영 검증 (Cmd+Shift+R 후 시도 권장)

- [ ] `/lab/server-infer` UI 진입 시 엔진 dropdown 사라진 것 확인
- [ ] 모델 카드 8개 (qwen3.5 2/4, qwen2.5 3/7, gemma2 2, gemma4 e2/e4, deepseek-r1 7) 노출
- [ ] 첫 호출 = ollama pull 자동 (~30~60초) 후 응답 정상
- [ ] 두 번째 호출 (warm) = 5초 이내 응답
- [ ] 서버 통합 (`/lab/local-gcp`) 정상 동작 (REBUILD31 §99 풍부 에러 UI 도 유지)

### 12.3 미해결 / 후속 검토 항목

| # | 항목 | 우선순위 |
|---|-----|--------|
| 1 | Ollama daemon 도 watchdog 패턴 적용 검토 (server-infer/start.sh) | 🟢 낮음 (Ollama 자체가 매우 안정 + 단일 모델 정책으로 더 안전) |
| 2 | ServerInferTester 에 풍부 에러 UI 적용 (LocalGcpTester 패턴) | 🟡 중간 (사용자 결정 후) |
| 3 | 격리 service `min-instances=1` 검토 (cold start 단축) | ⚪ 비용 영향, 1주 운영 모니터링 후 |
| 4 | Cloud Run quota 상향 신청 검토 (메모리 + CPU per region) | ⚪ 즉시 필요 X (region quota 한계 ~80Gi 추정) |
| 5 | server-infer/Dockerfile multi-stage 압축 검토 (CUDA runtime 1.5GB → 더 줄이기) | ⚪ 부수적 |
| 6 | **메인 + server-infer 빌드 직렬화 정책** — 동시 트리거 시 quota 충돌 | 🟡 중간 (이번 사례 학습, 정책화 권장) |
| 7 | Cloud Run service 재생성 시 IAM invoker 권한 자동 부여 (cloudbuild step 추가) | 🟢 낮음 (수동 1회 부여로 충분) |

---

## §13. 사용자 검증 + 후속 결정

### 13.1 사용자 운영 검증 (대기 중)

**Cmd + Shift + R** 강제 새로고침 후 다음 시나리오 시도 → 결과 회신 시 §12.2 체크박스 채움:

| 우선 | 시나리오 | 기대 결과 |
|------|---------|---------|
| 🔴 **필수** | `/lab/server-infer` 진입 → UI 새 모습 (엔진 dropdown 사라짐, Ollama 단일 정보 뱃지) | ✅ 단일 엔진 UI |
| 🔴 **필수** | qwen2.5:3b 호출 → 첫 응답 ~30초 (cold start + ollama pull) | ✅ 한국어 해설 |
| 🔴 **필수** | 같은 모델 재호출 (10분 안) | warm 응답 ~5초 |
| 🟡 | gemma2:2b 로 모델 변경 → 추론 | qwen2.5:3b unload 후 gemma2:2b 만 메모리 (단일 모델 정책) |
| 🟡 | 11분 idle 후 재호출 | 자동 unload 확인 (cold start 다시) |
| 🟢 | 메인 `/lab/local-gcp` 도 함께 정상 동작 | (REBUILD31 §99 풍부 에러 UI 유지) |

### 13.2 후속 검토 항목 (§12.3 의 7개 중 우선순위 ↑)

- 🟡 **§12.3 #6** — 메인 + server-infer 빌드 직렬화 정책화 (이번 사례 학습)
- 🟡 **§12.3 #2** — ServerInferTester 풍부 에러 UI 적용 (LocalGcpTester 패턴)
- ⚪ **§12.3 #3** — 1주 운영 후 트래픽 모니터링 → `min-instances=1` 또는 옵션 C(폐기) 재검토

---

## §14. 작업 완료 선언 (2026-05-04 22:30 KST)

### 14.1 완료 기준

| 항목 | 상태 |
|------|------|
| §0 사용자 결정 4축 (Q1~Q4) 답변 | ✅ a/a/a/a 확정 |
| §6 P1~P10 phase 모두 실행 | ✅ |
| 후속 단일 모델 정책 적용 | ✅ |
| 메인 + 격리 두 service 정상 운영 | ✅ |
| 두 service IAM 권한 + URL 연동 | ✅ |
| Region quota 안전 (40Gi/10CPU) | ✅ |
| 빌드 / 배포 무한 루프 종료 | ✅ |
| 문서 (REBUILD30 §28.7 + REBUILD31 §99 + REBUILD32 §0~§14) 정합성 | ✅ |

### 14.2 미해결 (사용자 검증 대기)

- ⏳ **사용자 운영 검증** (§13.1 의 6개 시나리오 — Cmd+Shift+R 후 시도)
- ⏳ 검증 결과 회신 → §12.2 체크박스 채움 + 마지막 commit

### 14.3 트리거 — 본 PR 종료 후 별도 검토 사항

| 트리거 | 행동 |
|--------|------|
| 사용자 운영 검증에서 issue 발견 | 즉시 hot-fix PR (REBUILD32 후속 §14.x) |
| 1주 후 격리 service 트래픽 0 지속 | 옵션 C (폐기) 재검토 → REBUILD33 후보 |
| 격리 service 자주 사용 (일 50+ 회) | `min-instances=1` 검토 (cold start 단축, 비용 ↑) |
| 메인 + 격리 동시 빌드 사례 재발 | 직렬화 정책 cloudbuild trigger 체인으로 자동화 |

### 14.4 한 줄 요약

> **REBUILD32 = 격리 추론 service 의 컨셉(자체 호스팅) 유지 + 안정성 우선 단일 엔진 재설계 완료. 메인/격리 두 Cloud Run service 가 별도 image / 별도 cloudbuild / 같은 region 에서 quota 안전하게 공존. 사용자 운영 검증만 남음.**

---

## §15. 코드베이스 심층 재검토 (2026-05-05)

> 재검토 범위: `server-infer/` (server.py / Dockerfile / start.sh / cloudbuild.yaml) + `api/iso-infer.js` + `src/labs/server-infer/ServerInferTester.jsx`
> 분류: 🔴 버그 (즉시 수정) · 🟡 개선 (우선순위 중) · 🟢 리팩토링 (코드 품질)

---

### §15.1 🔴 버그 — 즉시 수정 필요

---

#### B-1. Qwen strict 이중 적용 (Critical)

**파일**: `api/iso-infer.js:117` + `server-infer/server.py:251`

```
클라이언트 → iso-infer.js → (applyQwenStrict 1회) → server.py → (apply_qwen_strict 1회)
```

iso-infer.js 가 Node.js 측에서 messages 를 변환한 후 body 에 담아 server.py 로 전달.
server.py 는 받은 messages 에 또 apply_qwen_strict 를 적용.

**결과 (Qwen 계열 모델 호출 시)**:
- `/no_think` 토큰이 마지막 user 메시지에 **2번** 삽입
- 한국어 강제 system 메시지 꼬리가 **2번** 붙음 (중복 검사가 있어 실제 2번 추가는 안 되지만 `apply_qwen_korean_lock` 은 "CRITICAL: 반드시 한국어" 문자열이 있으면 skip — iso-infer.js 적용 이후에는 이미 있으므로 server.py 의 system 추가는 skip. 하지만 assistant seed 는 content 비교라 두 번째 시도 시 skip 가능성 있음)
- 실제로는 중복 guard 코드가 일부 막아주지만 **의도하지 않은 중복 경로** 자체가 문제

**수정 방향 (옵션 2가지)**:
```
옵션 A (권장): iso-infer.js 의 applyQwenStrict 제거
  → "신뢰 경계 안" (메인 → 격리) 이므로 server.py 에서만 처리
  → iso-infer.js 는 단순 proxy 역할에 충실

옵션 B: server.py 의 apply_qwen_strict 제거
  → server.py 를 순수 Ollama proxy 로 단순화
  → 단 iso-infer.js 를 거치지 않는 직접 호출 경로가 생기면 적용 누락 위험
```

**권장**: 옵션 A — iso-infer.js 에서 applyQwenStrict 제거, server.py 에서만 처리.

```diff
// api/iso-infer.js
- const { applyQwenStrict } = require('./_runtime/qwen');
  ...
- const finalMessages = applyQwenStrict(messages, model_key);
  const body = {
    model_key,
-   messages: finalMessages,
+   messages,          // ← server.py 가 처리
    max_tokens: ...,
    temperature: ...,
  };
```

---

#### B-2. `infer_ms` 미반환 → UI "undefined ms" (High)

**파일**: `server-infer/server.py` POST `/infer` 응답 + `ServerInferTester.jsx:296`

server.py 의 `/infer` 응답:
```python
return {
    "answer": data.get("message", {}).get("content", ""),
    "meta": {
        "model_key": req.model_key,
        "model_name": meta["name"],
        "engine": "ollama",
        "ollama_tag": meta["ollama"],
        # ← infer_ms 없음!
    },
}
```

ServerInferTester.jsx:
```jsx
✅ 격리 추론 결과 (ollama · {meta?.infer_ms}ms / 총 {meta?.client_total_ms}ms)
// → 실제 렌더: "ollama · undefinedms / 총 1234ms"
```

호출 이력 테이블:
```jsx
<span>{h.infer_ms}ms / {h.chars}자</span>
// → 실제 렌더: "undefinedms / 45자"
```

**수정**: server.py 에 추론 시간 측정 추가.

```diff
# server-infer/server.py
+ import time
  ...
  async def infer(req: InferRequest):
      ...
+     t0 = time.perf_counter()
      r = await client.post(f"{OLLAMA_URL}/api/chat", ...)
+     infer_ms = int((time.perf_counter() - t0) * 1000)
      ...
      return {
          "answer": ...,
          "meta": {
              ...,
+             "infer_ms": infer_ms,
+             "total_ms": infer_ms,   # 격리 service 는 단일 단계이므로 total = infer
          },
      }
```

---

#### B-3. `/readyz` → 404 (Medium)

**파일**: `api/iso-infer.js:92~94`

```js
if (action === 'ready') {
    const { status, data } = await forward('GET', '/readyz');  // server.py 에 없음 → 404
    return res.status(status).json(data);
}
```

server.py 에 `/readyz` 엔드포인트가 없음. `/healthz` 만 존재.

**수정 옵션**:
- 옵션 A: `action=ready` 코드 제거 (사용처 없으면 dead code)
- 옵션 B: server.py 에 `/readyz` 추가 (= `/healthz` alias)

현재 클라이언트(ServerInferTester.jsx) 에서 `action=ready` 호출 없음 → **옵션 A 권장** (dead code 제거).

---

#### B-4. `lastResp` 항상 null (Low)

**파일**: `api/iso-infer.js:62,74`

```js
let lastResp = null;          // 초기화
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429 || attempt === MAX_RETRIES - 1) {
        ...
        return { status: resp.status, data };   // 항상 여기서 return
    }
    await new Promise(res => setTimeout(res, ...));
    // ← lastResp 에 할당하는 코드 없음
}
return lastResp;   // unreachable, 항상 null
```

마지막 `return lastResp` 는 **도달 불가 코드** (loop 마지막 iteration 에서 `attempt === MAX_RETRIES - 1` → 첫 if 분기로 진입). 단 코드만 보면 `null` 반환처럼 읽혀 혼란.

**수정**:
```diff
- let lastResp = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      ...
  }
- return lastResp;
+ // unreachable
```

---

#### B-5. `showAnswer` dead state (Low)

**파일**: `src/labs/server-infer/ServerInferTester.jsx:42,97`

```js
const [showAnswer, setShowAnswer] = useState(false);   // 선언
// ...
setShowAnswer(false);  // handleQuestionChange 에서 호출
// JSX 에서 showAnswer 를 읽는 코드 없음 → dead state
```

**수정**: `showAnswer` state 와 `setShowAnswer` 제거.

---

### §15.2 🟡 개선 — 우선순위 중

---

#### I-1. deepseek-r1 모델 누락 — 약속된 8개 중 7개

**파일**: `server-infer/server.py` MODELS 리스트

REBUILD32 §0.Q4: "8개 전부" 결정 (qwen3.5/2.5, gemma2/4, deepseek-r1).
§12.2 검증 체크리스트에도 "deepseek-r1 7" 포함이라고 기록.
그러나 실제 server.py 에는 7개만:

```python
MODELS = [
    {"key": "qwen35-2b", ...},
    {"key": "qwen35-4b", ...},
    {"key": "qwen25-3b", ...},
    {"key": "qwen25-7b", ...},
    {"key": "gemma2-2b", ...},
    {"key": "gemma4-e2b", ...},
    {"key": "gemma4-e4b", ...},
    # deepseek-r1:7b 없음!
]
```

**수정**: MODELS 에 deepseek-r1 추가.
```python
{"key": "deepseek-r1-qwen-7b", "name": "DeepSeek R1 Distill Qwen 7B",
 "ollama": "deepseek-r1:7b", "org": "DeepSeek", "size": "~4.5GB",
 "note": "Reasoning 특화 / Qwen 베이스"},
```

단 `apply_qwen_strict` 는 이미 `"qwen" not in lower and "deepseek" not in lower` 로 DeepSeek 도 처리 중 → 추가만 하면 됨.

---

#### I-2. 에러 UI 불일치 (§12.3 #2 후속 구체화)

**파일**: `ServerInferTester.jsx` vs `LocalGcpTester.jsx`

| 항목 | ServerInferTester (서버 분리) | LocalGcpTester (서버 통합) |
|------|--------------------------|--------------------------|
| 에러 저장 | `setError(string)` | `setError({message, status, code, ...})` |
| 에러 렌더링 | `<ErrorBanner message={error} variant="compact" />` | 직접 인라인 렌더링 (풍부 UI) |
| 재시도 버튼 | ❌ 없음 | ✅ "🔁 다시 시도" |
| 헬스체크 버튼 | ❌ 없음 | ✅ "🏥 백엔드 상태 확인" |
| raw 응답 보기 | ❌ 없음 | ✅ `<details>` 접기 |

**수정 방향**: ServerInferTester.jsx 에 구조화 에러 + 재시도 버튼 적용.
```diff
- const [error, setError] = useState('');
+ const [error, setError] = useState(null);
+ const lastReqRef = useRef(null);
  ...
  catch (e) {
-   setError(`${e.message} (${totalMs}ms 후)`);
+   setError({ message: e.message, elapsedMs: totalMs, userAction: '다시 시도하거나 모델을 변경해보세요.' });
  }
```

---

#### I-3. `unload_other_models` 매 요청 호출 최적화

**파일**: `server-infer/server.py`

현재 `/infer` 마다 `/api/ps` → 조회 → keep_model 외 unload 실행.
동일 모델로 연속 호출 시에도 항상 `/api/ps` 네트워크 왕복 발생.

```python
# 현재
async def infer(req):
    ...
    await unload_other_models(client, keep_model=meta["ollama"])  # 매번 호출
    r = await client.post(.../api/chat...)
```

**수정**: 마지막 서빙 모델 캐시. 변경될 때만 unload 호출.

```python
_last_served_model: str | None = None

async def infer(req):
    global _last_served_model
    ollama_tag = meta["ollama"]
    if _last_served_model and _last_served_model != ollama_tag:
        await unload_other_models(client, keep_model=ollama_tag)
    _last_served_model = ollama_tag
    r = await client.post(.../api/chat...)
```

단 멀티 워커 환경에서는 모듈 레벨 변수가 worker 간 공유 안 됨. Cloud Run `--concurrency=10` + uvicorn 단일 프로세스(`--workers 1` 기본) 이므로 안전. 주석으로 명시 필요.

---

#### I-4. `_model_size_gb` 취약 파싱

**파일**: `server-infer/server.py:165~169`

```python
def _model_size_gb(size_str: str) -> float:
    m = re.search(r"(\d+(?:\.\d+)?)\s*GB", str(size_str).upper())
    return float(m.group(1)) if m else 0.0
```

- "~4.4GB".upper() = "~4.4GB" → 매칭 OK
- "4.4 GiB" → "GIB" → 미매칭 → 0.0 반환 → available=True 로 잘못 판정
- 매칭 실패 시 0.0 반환 → `size_gb <= 0` → 가용 체크 skip → 자원 부족 모델이 available 로 표시될 수 있음

**수정**: GiB 지원 + 매칭 실패 시 0이 아닌 기본값 처리.
```python
def _model_size_gb(size_str: str) -> float:
    s = str(size_str).upper().replace("~", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(GIB|GB)", s)
    if not m:
        return 0.0
    val = float(m.group(1))
    return val * (1024 / 1000) if m.group(2) == "GIB" else val
```

---

#### I-5. `normalizeLabModels` 인덱스 기반 매핑 → key 기반으로

**파일**: `src/labs/server-infer/ServerInferTester.jsx:69~74`

```js
normalizeLabModels(d.models).map((m, i) => ({
    ...m,
    available: d.models[i]?.available !== false,  // ← 인덱스 i 기반
    unavailable_reason: d.models[i]?.unavailable_reason || null,
}))
```

`normalizeLabModels` 가 내부적으로 순서를 변경하거나 모델을 필터링하면 `i` 인덱스가 `d.models[i]` 와 불일치 → available 값이 엉뚱한 모델에 적용됨.

**수정**: key 기반 매핑으로 교체.
```diff
- normalizeLabModels(d.models).map((m, i) => ({
-   ...m,
-   available: d.models[i]?.available !== false,
-   unavailable_reason: d.models[i]?.unavailable_reason || null,
- }))
+ (() => {
+   const byKey = Object.fromEntries(d.models.map(s => [s.key, s]));
+   return normalizeLabModels(d.models).map(m => ({
+     ...m,
+     available: byKey[m.key]?.available !== false,
+     unavailable_reason: byKey[m.key]?.unavailable_reason || null,
+   }));
+ })()
```

---

### §15.3 🟢 리팩토링 — 코드 품질

---

#### R-1. Qwen 헬퍼 3중 정의 — 동기화 위험

동일한 Qwen 한국어/no_think 로직이 3곳에 독립 구현되어 있음:

| 파일 | 언어 | 목적 |
|------|------|------|
| `inference-py/engines/qwen_helpers.py` | Python | 통합 서버 Python sub-server |
| `server-infer/server.py` (inline) | Python | 격리 서비스 자급자족 |
| `api/_runtime/qwen.js` | Node.js | iso-infer.js / local-infer.js |

server-infer/server.py 의 inline `apply_qwen_strict` 는 qwen_helpers.py 보다 단순화된 버전 (DeepSeek 처리 포함 등):

```python
# server.py (inline) — 단순화 버전
def apply_qwen_strict(messages, model_key):
    lower = model_key.lower()
    if "qwen" not in lower and "deepseek" not in lower:
        return messages
    ...

# qwen_helpers.py — 완전 버전
QWEN_REGEX = re.compile(r"^qwen", re.IGNORECASE)
def apply_qwen_strict(messages, model_key_or_id):
    return apply_qwen_korean_lock(apply_qwen_no_think(...))
```

두 Python 버전은 **DeepSeek 처리 방식이 다름**:
- server.py: `"deepseek" in lower` 조건으로 DeepSeek 도 처리
- qwen_helpers.py: `QWEN_REGEX.match(...)` 로 Qwen prefix 만 처리 (DeepSeek 미처리)

qwen_helpers.py 에 DeepSeek 조건 누락 → 통합 서버에서 DeepSeek 모델 호출 시 한국어 강제 미적용.

**수정 방향**: qwen_helpers.py 에 DeepSeek 조건 추가, server.py 는 B-1 수정 후 그대로 유지(자급자족).

---

#### R-2. 429 재시도 로직 이중 구현

**파일**: `api/iso-infer.js:63~74` + `ServerInferTester.jsx:54~94`

두 레이어에 지수 backoff 429 retry 패턴이 중복:
```js
// iso-infer.js (서버 측)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
for (let attempt = 0; ...) { ... }

// ServerInferTester.jsx (클라이언트 측)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
for (let attempt = 0; ...) { ... }
```

완전 중복은 아님 — iso-infer.js 가 격리 서비스와의 통신을 retry하고, 클라이언트는 `/api/iso-infer` 엔드포인트 자체를 retry. 하지만 로직이 동일해 유지보수 분산.

**개선**: 두 레이어의 역할을 주석으로 명확히 구분, 상수를 공유 가능한 위치로 이동.

---

#### R-3. 모델 카탈로그 4중 유지 — 옵션 C 채택 (2026-05-05)

##### §15.3.R3.1 현황

격리 서비스의 Ollama 호환 모델 목록이 4곳에 분산:

```
server-infer/server.py           MODELS[]                  8개 (격리 진실 소스)
inference-py/engines/catalog.py  MODEL_MAP (ollama 키)     11개 중 8개 ollama (통합 진실 소스)
src/lib/lab/models.js            LAB_MODELS                 11개 (프론트 union fallback)
ServerInferTester.jsx            FALLBACK_MODELS            LAB_MODELS 필터
```

##### §15.3.R3.2 의사결정 — 통합/분리 서버 독립 운영 원칙 (2026-05-05)

> 사용자 결정: 통합 서버 (aitutor) ↔ 분리 서버 (aitutor-server-infer) 는 완전 독립 운영.
> 한쪽 변경이 다른 쪽 코드/배포/검증/카탈로그에 영향 주지 않아야 함.

이 원칙으로 옵션 A/B 폐기, 옵션 C 채택:

| 옵션 | 내용 | 결정 | 사유 |
|------|------|------|------|
| A | 단일 JSON 진실 소스 (`data/models-catalog.json`) → 두 컨테이너 모두 COPY | ❌ 폐기 | 두 서버가 같은 파일에 의존 → 독립성 정면 위배 |
| B | 일관성 검증 스크립트 (`scripts/check-models-catalog.js`) — server.py == catalog.py 검증 | ❌ 폐기 | 의도적 차이를 거짓 알람으로 처리. 자원/엔진/정책 차이 시 실패 |
| **C** | 책임 분리 명문화 — 각 카탈로그가 단독 진실 소스, 동기화 강제 안 함 | ✅ **채택** | 독립성 원칙 준수. 양쪽 차이가 "버그"가 아닌 "의도된 차이" |

##### §15.3.R3.3 옵션 C 적용 결과

세 카탈로그 파일 헤더 주석에 다음 명시 (코드 자체는 변경 없음):

1. **`server-infer/server.py` MODELS**
   ```python
   # REBUILD32 §15 R-3 — 통합/분리 서버 완전 독립 운영 원칙:
   #   ⚠ 이 MODELS 는 격리 service 의 단독 진실 소스이다.
   #   통합 service (catalog.py) 와 의도적으로 다를 수 있다.
   #   동기화 검증/공유 import 금지. 양쪽이 다른 것은 "버그" 아닌 "의도된 차이".
   ```

2. **`inference-py/engines/catalog.py` MODEL_MAP**
   ```python
   # REBUILD32 §15 R-3 — 통합/분리 서버 완전 독립 운영 원칙:
   #   ⚠ 이 MODEL_MAP 은 통합 service 의 단독 진실 소스이다.
   #   격리 service (server.py) 와 의도적으로 다를 수 있다.
   ```

3. **`src/lib/lab/models.js` LAB_MODELS**
   ```js
   // REBUILD32 §15 R-3 — 양 백엔드의 union fallback.
   //   백엔드 응답 도달 시 즉시 덮어씀. 자동 동기화 검증 도입 금지.
   ```

##### §15.3.R3.4 차이가 의도된 시나리오 예시

- 격리 서비스가 자원 절감을 위해 큰 모델(7B) 제거 → 통합은 유지
- 통합 서비스에 multi-engine 전용 모델 추가 (Phi-4 mini onnx 등) → 격리는 ollama only이므로 미반영
- 격리 서비스가 region quota로 인해 일시적으로 4B 미만만 노출 → 통합은 quota 무관

위 시나리오에서 옵션 B 검증 스크립트는 모두 거짓 알람을 발생시킨다 (lab 가치 훼손).

---

#### R-4. start.sh exec 후 bash trap 비작동 — Ollama 미정리

**파일**: `server-infer/start.sh`

```bash
trap '
  kill -TERM $OLLAMA_PID 2>/dev/null
  wait $OLLAMA_PID 2>/dev/null
  exit 0
' TERM INT

exec /opt/venv/bin/python -m uvicorn server:app ...  # ← bash 프로세스가 uvicorn으로 교체
```

`exec` 이후 bash 프로세스가 사라지므로 trap 이 동작하지 않음.
Cloud Run 이 SIGTERM 보내면 → uvicorn(PID 1) 이 직접 받음 → graceful shutdown → 종료.
그러나 OLLAMA_PID 는 정리되지 않음 (uvicorn 이 모름). Cloud Run 이 timeout 후 SIGKILL 보내면 Ollama 는 좀비 또는 force kill.

**수정 방안**:
```bash
# exec 대신 uvicorn 을 background 로, bash 가 PID 1 유지
/opt/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port "${PORT:-8080}" &
UVICORN_PID=$!

trap '
  echo "[start.sh] SIGTERM → 정리"
  kill -TERM $UVICORN_PID 2>/dev/null
  kill -TERM $OLLAMA_PID 2>/dev/null
  wait $UVICORN_PID 2>/dev/null
  wait $OLLAMA_PID 2>/dev/null
  exit 0
' TERM INT

wait $UVICORN_PID
```

단 Cloud Run 은 PID 1 프로세스의 종료 코드를 컨테이너 종료 상태로 인식. bash 가 `wait $UVICORN_PID` 로 대기하다 uvicorn 종료 시 bash 도 종료 → 정상.

---

#### R-5. Dockerfile 불필요 패키지 제거

**파일**: `server-infer/Dockerfile`

```dockerfile
RUN apt-get install -y --no-install-recommends \
      ca-certificates curl wget zstd \
      python3.10 python3.10-venv python3-pip
```

- `wget`: Ollama install.sh 는 curl 을 우선 사용 (`curl -fsSL` 이미 설치됨). 제거 가능.
- `python3-pip`: `/opt/venv` venv 생성 후 내부 pip 만 사용. 시스템 pip 불필요. 제거 가능.
- `zstd`: Ollama install.sh 가 내부적으로 zstd 압축 해제에 사용. 유지 필요.

```diff
  RUN apt-get install -y --no-install-recommends \
-       ca-certificates curl wget zstd \
-       python3.10 python3.10-venv python3-pip
+       ca-certificates curl zstd \
+       python3.10 python3.10-venv
```

---

### §15.4 전체 이슈 우선순위 요약

| 상태 | 우선순위 | 코드 | 파일 | 내용 | 예상 공수 |
|------|---------|------|------|------|---------|
| ✅ 완료 (4f4b880) | 🔴 즉시 | B-1 | iso-infer.js | Qwen strict 이중 적용 제거 | 5분 |
| ✅ 완료 (4f4b880) | 🔴 즉시 | B-2 | server.py | infer_ms 측정 및 반환 추가 | 10분 |
| ✅ 완료 (4f4b880) | 🔴 즉시 | B-3 | iso-infer.js | action=ready dead code 제거 | 2분 |
| ✅ 완료 (4f4b880) | 🔴 즉시 | I-1 | server.py | deepseek-r1 모델 추가 (8개 완성) | 5분 |
| ✅ 완료 (4f4b880) | 🔴 즉시 | B-4 | iso-infer.js | lastResp 미사용 변수 제거 | 2분 |
| ✅ 완료 (4f4b880) | 🔴 즉시 | B-5 | ServerInferTester.jsx | showAnswer dead state 제거 | 2분 |
| ✅ 완료 (52f7a6b) | 🟡 중간 | I-2 | ServerInferTester.jsx | 에러 UI 구조화 + 재시도 버튼 | 30분 |
| ✅ 완료 (52f7a6b) | 🟡 중간 | I-5 | ServerInferTester.jsx | normalizeLabModels 인덱스→key 기반 | 5분 |
| ✅ 완료 (52f7a6b) | 🟡 중간 | R-1 | qwen_helpers.py | DeepSeek 조건 누락 추가 | 5분 |
| ✅ 완료 (52f7a6b) | 🟡 중간 | R-4 | start.sh | exec → background + trap 수정 | 15분 |
| ✅ 완료 (52f7a6b) | 🟡 중간 | I-4 | server.py | _model_size_gb GiB 지원 | 5분 |
| ✅ 완료 (52f7a6b) | 🟡 중간 | I-3 | server.py | unload_other_models 캐시 최적화 | 10분 |
| ❎ 보류 (이미 양호) | 🟢 낮음 | R-2 | iso-infer.js + ServerInferTester | 429 retry 주석 명확화 — 두 layer 책임 이미 명확히 구분, 추가 작업 ROI 낮음 | 5분 |
| ✅ 완료 (옵션 C) | 🟢 낮음 | R-3 | server.py + catalog.py + lab/models.js | 통합/분리 서버 독립 운영 원칙 명문화 (옵션 A/B 폐기) | 10분 |
| ❎ 보류 (효과 미미) | 🟢 낮음 | R-5 | Dockerfile | 불필요 패키지 제거 — 격리 재배포 비용(~12분) 대비 절감 ~10MB / 5초로 ROI 매우 낮음 | 5분+재배포 |

**총 🔴 즉시 수정 공수**: 약 26분 (단순 코드 변경 위주) — ✅ **2026-05-05 4f4b880 적용 완료**
**총 🟡 중간 공수**: 약 70분 — ✅ **2026-05-05 52f7a6b 적용 + 두 서비스 재배포 완료**

#### §15.4.1 적용 결과 (2026-05-05 KST)

| 커밋 | 항목 | 변경 파일 | 재배포 |
|------|------|---------|---------|
| `4f4b880` | B-1, B-2, B-3, B-4, B-5, I-1 | iso-infer.js, server.py, ServerInferTester.jsx, REBUILD32.md | (이번 묶음에서 함께) |
| `52f7a6b` | I-2, I-3, I-4, I-5, R-1, R-4 | qwen_helpers.py, server.py, start.sh, ServerInferTester.jsx | 격리 11M39S + 메인 32M9S 모두 SUCCESS |

배포된 revision:
- 격리: `aitutor-server-infer-00004-tzp` (asia-southeast1, 24Gi/6CPU/L4 GPU)
- 메인: `aitutor-00016-h6k` (asia-southeast1, 24Gi/6CPU/L4 GPU)

---

### §15.5 즉시 실행 순서 (B-1 ~ B-5 + I-1 묶음)

아래 6개는 단일 commit 으로 묶어 처리 권장:

```bash
# 1) iso-infer.js
#    - applyQwenStrict import 제거
#    - finalMessages 제거 → messages 직접 사용
#    - action=ready 분기 제거
#    - lastResp 변수 제거

# 2) server.py
#    - import time 추가
#    - /infer 핸들러에 t0 = time.perf_counter() + infer_ms 계산
#    - meta 응답에 infer_ms / total_ms 추가
#    - MODELS 에 deepseek-r1 추가

# 3) ServerInferTester.jsx
#    - showAnswer state + setShowAnswer 제거 (3곳)
```

커밋 메시지 예시:
```
fix(server-infer): Qwen 이중 적용 제거 / infer_ms 반환 / dead code 정리
```

---

### §15.6 컨테이너 강제 재시작 엔드포인트 (2026-05-05, 사용자 보고 후속)

#### §15.6.1 사용자 보고 (2026-05-05 KST)

> "분리서버의 경우 모델을 바꿀때마다 컨테이너 ram 이 계속 점유가 늘어나는데
> 모두 언로드 (메모리 회수) 버튼을 눌러도 gpu vram 만 초기화 되는데 정상인가요?"

#### §15.6.2 진단 — Cloud Monitoring 시계열 데이터

격리 service `run.googleapis.com/container/memory/utilizations` (24Gi 컨테이너) 실측:

| 시간 (UTC) | 사용률 | 환산 | 이벤트 |
|---|---|---|---|
| 09:48 | (start) | - | 컨테이너 시작 |
| 09:49 | 1% | 0.24 GB | 카탈로그 조회만 |
| 09:53 | 38% | 9.1 GB | gemma4:e4b 추론 + unload |
| 09:55 | 40% | 9.6 GB | qwen3.5:4b 로딩 |
| 09:57 | 56% | 13.4 GB | qwen3.5:4b unload + qwen2.5:7b pull |
| 10:00 | 70% | 16.8 GB | qwen2.5:7b 추론 + qwen3.5:2b pull |
| **10:03** | **85%** | **20.4 GB** | **🛑 unload-all 직후 (피크)** |
| 10:04~05 | 85→81% | 20.4→19.4 GB | -1 GB 살짝 감소 |
| 10:06~10 | **80%** | **19.2 GB** | **🚨 6분간 회수 안 됨** |

→ 4 모델 사이클 후 unload-all 했음에도 19.2 GB 누적 잔재. **사용자 관찰 정확.**

#### §15.6.3 원인 분석

| 요인 | 회수 여부 | 비중 |
|---|---|---|
| 모델 weights GPU VRAM | ✅ 즉시 회수 (Ollama `cudaFree`) | 별개 |
| 모델 파일 디스크 캐시 (`/var/ollama/models/*.gguf` 4개 ~11.8GB) | ❌ 회수 안 됨 | 큼 |
| Linux 페이지 캐시 (디스크 mmap) | ❌ MemAvailable 컨테이너 환경 보고 부정확 | 큼 |
| Ollama Go runtime 메모리 (free 후 OS 미반환) | ❌ 지연 회수 | 중 |
| uvicorn / Python heap fragmentation | ❌ 부분 회수 | 작음 |

#### §15.6.4 해결 — 옵션 A 채택: 컨테이너 강제 재시작 엔드포인트

옵션 비교:

| 옵션 | 효과 | 비용 | 결정 |
|---|---|---|---|
| 자연 cold start (idle 5분) | 메모리 100% 회수 | 5분 대기 | 이미 활성, 즉시성 부족 |
| **A. `/memory/restart-container` 엔드포인트** | 명시 호출 시 메모리 100% 회수 | 30분 + 양 service 재배포 | ✅ **채택** |
| B. unload-all에 디스크 파일 삭제 추가 | 디스크 캐시만 회수 | 격리 재배포만 | runtime 메모리 잔재 |
| C. 현 상태 유지 + UI 안내만 | 작업 X | 0 | 사용자 의도 미충족 |

#### §15.6.5 구현 — 4 파일

```python
# server-infer/server.py
@app.post("/memory/restart-container")
async def restart_container():
    asyncio.create_task(_delayed_terminate())
    return {"ok": True, "message": "컨테이너 재시작 예약됨", ...}

async def _delayed_terminate(delay_sec=0.6):
    await asyncio.sleep(delay_sec)
    os.kill(os.getpid(), signal.SIGTERM)  # uvicorn graceful shutdown 트리거
```

```js
// api/iso-infer.js
if (req.query?.action === 'restart-container') {
    const { status, data } = await forward('POST', '/memory/restart-container');
    return res.status(status).json(data);
}
```

```jsx
// src/components/lab/MemoryCard.jsx (♻️ 인스턴스 재시작 버튼 추가)
// + ServerInferTester.jsx 에서 restartEndpoint prop 전달
```

#### §15.6.6 동작 시퀀스

```
[사용자 ♻️ 클릭]
   ↓
POST /api/iso-infer?action=restart-container
   ↓ (메인 service forward + ID Token)
POST 격리 service /memory/restart-container
   ↓
1) {ok: true, message: "재시작 예약"} 즉시 응답
2) 0.6초 후 백그라운드 task: os.kill(getpid(), SIGTERM)
3) uvicorn graceful shutdown 시작
4) start.sh 의 wait $UVICORN_PID 깨어남 (R-4 패턴)
5) start.sh 가 Ollama daemon kill + wait
6) 컨테이너 종료 (exit 0)
7) Cloud Run: idle 인스턴스 0 상태
8) 다음 사용자 호출 시: 새 인스턴스 spawn → cold start (~30초~2분)
   → 메모리 100% 회수 (디스크 캐시 + Go runtime + Python heap)
```

#### §15.6.7 UX 분리

UI 에 두 회수 옵션 명확히 분리:

| 버튼 | 효과 | 다음 호출 시간 | 사용 시나리오 |
|---|---|---|---|
| 🗑️ 모두 언로드 (warm 유지) | GPU VRAM + weights 회수 | ~30초 (warm) | 일상 사용, 모델 변경 |
| ♻️ 인스턴스 재시작 (메모리 100% 회수) | 컨테이너 자체 종료 | ~30초~2분 (cold start) | 디스크 캐시 누적 시 명시 회수 |

