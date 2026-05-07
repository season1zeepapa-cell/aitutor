# REBUILD36 — 통합/분리 service 추론 메모리 거동 상세 분석

> **작성**: 2026-05-07 KST
> **목적**: 사용자가 "모델 선택 → 답변 요청" 클릭 시 컨테이너 RAM / GPU VRAM 이 어떻게 점유·회수되는지 코드베이스 기준으로 상세 추적.
> **기준 화면**: 통합 service 메모리 패널 실측치 (RAM 6.0/31.3GB · VRAM 5.3/22.5GB · GPU 0% · 76°C · 로드 모델 1개)
> **검증 대상**: `api/local-infer.js` (통합) · `server-infer/server.py` (분리) · `start.sh` 양쪽 · Dockerfile 양쪽

---

## §0. 결론 요약

두 service 의 메모리 거동은 **거의 동일한 패턴**(Ollama 단일 엔진, 단일 모델 정책, `keep_alive: '10m'`, `keep_alive: 0` unload)을 공유하지만, **인프라 분리도와 운영 영향 범위**가 다르다.

| 항목 | 통합 (`/api/local-infer`) | 분리 (`/api/iso-infer` → server-infer) |
|------|---------------------------|---------------------------------------|
| 컨테이너 | Express + Ollama 동거 | FastAPI(uvicorn) + Ollama 동거 (별도) |
| Cloud Run service | `aitutor` | `aitutor-server-infer` |
| RAM/VRAM 자원 풀 | 24Gi / L4 22.5GB (메인이 본업도 함께 사용) | 24Gi / L4 22.5GB (격리만 사용) |
| 모델 수 | 3 (매장 로컬 AI) | 15 (회사 자산) |
| 단일 모델 정책 | ✅ `_lastServedModel` 캐시 + `unloadOtherModels()` | ✅ `_last_served_model` 캐시 + `unload_other_models()` |
| `keep_alive` | `'10m'` 고정 | `'10m'` 고정 |
| **`keep_warm` 옵션** | ❌ 없음 | ✅ 있음 (번역 보조 파이프라인) |
| `restart-container` 효과 | 본업 함께 중단 | 격리만 재시작, 본업 무영향 |
| 호출 인증 | `withAuth` (브라우저 직접) | `withAuth` + Google ID token forward |

핵심 통찰:
- **모델 weights 는 컨테이너 RAM 에 거의 안 올라간다.** 디스크 → GPU VRAM 직행. RAM 의 사용량 대부분은 daemon process + page cache + 시스템 오버헤드.
- **`unload-all` 은 VRAM 만 즉시 회수.** 컨테이너 RAM 은 OS page cache + daemon process 유지로 부분 회수 (실측: 85%→80%, 5%p).
- **RAM 100% 회수는 `restart-container` 만 가능.** SIGTERM → graceful shutdown → Cloud Run cold restart.

---

## §1. 통합 Service 메모리 거동

### 1.1 컨테이너 부팅 시점 (1회, cold start)

`start.sh` 가 PID 1 bash 로 실행:

```
[1] Ollama daemon 백그라운드 spawn (port 11434)
    ollama serve > /tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    └─ GPU 자동 감지 (L4 1개)
    └─ /var/ollama/models 디렉토리 준비 (모델 캐시 위치)

[2] Ollama 헬스체크 폴링 (보통 3~5초)
    for i in $(seq 1 30); do
      curl -sf http://127.0.0.1:11434/api/tags
    done

[3] SIGTERM 트랩 설정 (Cloud Run 종료 시 Ollama 정리)
    trap '... kill -TERM $OLLAMA_PID ...' TERM INT

[4] Express 기동 (foreground, port 8080 — Cloud Run 메인 프로세스)
    exec node server.js
```

**부팅 직후 자원 상태**:
- 컨테이너 RAM ~1.5 GB (Ollama daemon + Express + 시스템 baseline)
- GPU VRAM ~0.3~0.5 GB (CUDA context 만)
- 로드 모델 0개

### 1.2 사용자 답변 요청 시 9 단계 (`api/local-infer.js`)

```
브라우저 ──▶ POST /api/local-infer
            body: { model_key: 'qwen25-3b', messages, maxTokens, temperature }
              │
              ▼
         Express server.js
              │
              ▼
       api/local-infer.js — withAuth 래퍼
```

| 단계 | 동작 | RAM/VRAM 변화 |
|------|------|---------------|
| 1 | `withAuth` 인증 검증 (Authorization 헤더 / 쿠키) | 변화 0 |
| 2 | 요청 파싱 + `MODEL_MAP[model_key]` 검증 | 변화 0 |
| 3 | `ensureOllamaModel()` — `GET /api/tags` 로 디스크 캐시 확인 | 변화 0 (TCP 호출만) |
| 3a | 모델 미존재 시 `POST /api/pull` (cold start ~30~60초) | 디스크 사용 ↑ (~2GB), RAM 변화 작음 |
| 4 | `unloadOtherModels()` — `_lastServedModel` 변경 시에만 | 옛 모델 unload 시 VRAM ↓ |
| 4a | `GET /api/ps` → 현재 GPU 로드 모델 목록 | 변화 0 |
| 4b | 새 모델 외 각각에 `POST /api/generate {keep_alive:0}` | VRAM 옛 모델 분량 즉시 회수 |
| 5 | `applyQwenStrict()` — Qwen/DeepSeek 한국어 강제 + thinking off | 변화 0 (메모리 내 prompt 가공) |
| 6 | **추론 호출** `POST /api/chat` ← 이 시점에 모델 메모리 로드 | **VRAM ↑↑** (모델+KV cache) |
| 6a | Ollama 가 GGUF 파일 → mmap → GPU upload | RAM mmap page cache ↑, VRAM ↑↑ |
| 6b | tokenize + forward pass × num_predict | GPU 사용률 0% → 80~95% |
| 6c | 응답 텍스트 조립 후 200 반환 | KV cache 약간 ↑ (다음 호출 재사용) |
| 7 | `_lastServedModel = ollamaModel` 캐시 갱신 | RAM 변수 1개, 무시 가능 |
| 8 | 응답 메타 조립 (infer_ms / total_ms / warm) | 변화 0 |
| 9 | 브라우저로 JSON 반환 | 변화 0 |

### 1.3 첨부 화면 실측치 6.0GB/5.3GB 의 정확한 구성

#### 컨테이너 RAM 6.0 / 31.3 GB (19.1%)

| 구성 | 추정 점유 | 근거 |
|------|-----------|------|
| Linux 커널 + Cloud Run baseline | ~500 MB | nvidia/cuda:12.4 runtime 베이스 |
| Express(Node.js) 프로세스 | ~200~300 MB | server.js + V8 heap + 의존성 |
| Ollama daemon 프로세스 | ~300~500 MB | Go 런타임 + HTTP server |
| **GGUF mmap page cache** | ~1~2 GB | Linux 가 디스크에서 read 한 부분을 자동 캐시. 모델 파일 5.6GB 중 일부 |
| **OS buffer/cache** | ~1~2 GB | 디스크 I/O / log / 임시 파일 |
| 합계 | ~3~5 GB → 약 6 GB 관측 | OS overhead 포함 |

> **모델 weights 자체는 RAM 에 안 올라간다.** GGUF 파일을 mmap 하면 OS 가 일부 페이지를 RAM 에 캐시하지만, 추론은 GPU VRAM 에서 진행.

#### GPU L4 VRAM 5.3 / 22.5 GB (23.7%)

| 구성 | 추정 점유 | 근거 |
|------|-----------|------|
| 모델 가중치 (Qwen 2.5 3B Q4_K_M) | ~1.9 GB | 양자화된 weights (FP16 대비 1/4) |
| **KV cache** | ~1~2 GB | 추론 결과의 attention 상태. `keep_alive: '10m'` 동안 유지 |
| CUDA context + workspace | ~0.5~1 GB | cuBLAS, cuDNN 핸들러, scratch buffer |
| Ollama / llama.cpp 런타임 buffer | ~0.5 GB | tokenizer, 임시 buffer |
| 합계 | ~5.3 GB | `/api/ps` 의 `size_vram: 5.51GB` 와 일치 |

#### GPU 사용률 0% / 온도 76°C

- **0%**: SM(streaming multiprocessor) idle. 추론 안 하는 상태. 메모리만 점유.
- **76°C**: L4 idle 기준 정상 (Cloud Run shared GPU). 추론 중엔 85~90°C.
- 다음 추론 호출 즉시 시작 가능 (warm).

### 1.4 시나리오별 RAM/VRAM 변화

#### A. 동일 모델 연속 호출 (warm) — 가장 빠름

```
[요청 전]  RAM 6.0 GB │ VRAM 5.3 GB │ GPU 0%
              │ POST /api/local-infer
              ▼
[추론 중]  RAM 6.0~6.2 │ VRAM 5.3~5.6 │ GPU 80~95%   (1~3초)
              │                ↑ KV cache 약간 늘어남
[응답 후]  RAM 6.0 GB │ VRAM 5.3~5.6 GB │ GPU 0%   (10분 warm)
```

#### B. 다른 모델로 전환 — load 시간 발생

```
[요청 전]  qwen2.5:3b 로드 │ RAM 6.0 │ VRAM 5.3
   │ 사용자 gemma2-2b 선택
   ▼
[1] unloadOtherModels(keep='gemma2:2b') 호출
[2] /api/ps → ['qwen2.5:3b'] 발견
[3] POST /api/generate {model:'qwen2.5:3b', keep_alive:0}
[4] VRAM 5.3 → 약 0.5 GB (CUDA context만 잔존, 1~2초)
[5] /api/chat 호출 — Ollama 가 gemma2:2b 디스크 → VRAM 로드 (5~15초)
[6] VRAM 0.5 → 약 4.0 GB (gemma2 작은 모델)
[7] 추론 시작
[8] VRAM 4.0 → 4.5 GB (KV cache 추가)
   ▼
[응답 후]  gemma2:2b 만 │ RAM 6.0 │ VRAM ~4.5
```

#### C. 10분 idle 후 자동 unload (Ollama 자체 타이머)

```
[10분 무사용]
   ▼ Ollama 내부 타이머
qwen2.5:3b 자동 unload (keep_alive 만료)
   ▼
[정리 후]  로드 모델 0개 │ RAM ~5.5 │ VRAM ~0.5 │ GPU 0%
```

#### D. 사용자 [🗑️ 모두 언로드] 클릭 (`unload-all`)

```
POST /api/local-infer?action=unload-all
   ▼
[1] /api/ps 로 현재 로드 모델 목록
[2] 각각 POST /api/generate {keep_alive:0}
[3] VRAM 즉시 회수 (수 초)
   ▼
[정리 후]  RAM ~5.5 │ VRAM ~0.5 │ GPU 0%
```

⚠️ RAM 은 부분 회수만 됨 (mmap page cache + Ollama daemon + Express 잔존).

#### E. 사용자 [♻️ 인스턴스 재시작] 클릭 (`restart-container`)

```
POST /api/local-infer?action=restart-container
   ▼
[1] SIGTERM → Express 종료
[2] start.sh 의 trap 발동 → Ollama daemon kill
[3] Cloud Run lifecycle: 컨테이너 종료
[4] 다음 요청 시 새 컨테이너 spawn (cold start)
[5] start.sh 처음부터 (Ollama 5s + 모델 pull/load 30~60s)
   ▼
[정리 후]  RAM ~1.5 │ VRAM 0 │ 로드 모델 0
[부작용]  ⚠️ 본업 (KISA 학습/AI 해설 등) 도 함께 중단됨!
```

### 1.5 RAM/VRAM 회수 강도 비교

| 작업 | VRAM 회수 | RAM 회수 | 다음 요청 latency | 본업 영향 |
|------|-----------|----------|-------------------|----------|
| 추론 종료 (10분 keep_alive) | ❌ 유지 | ❌ 유지 | ⚡ ~1초 (warm) | 0 |
| 10분 후 자동 unload | ✅ 즉시 | 🟡 부분 | 🐢 ~10~30초 | 0 |
| `unload-all` 버튼 | ✅ 즉시 | 🟡 부분 | 🐢 ~10~30초 | 0 |
| 모델 전환 | ✅ 옛 모델 즉시 | 🟡 부분 | 🐢 ~10~30초 | 0 |
| `restart-container` | ✅ 100% | ✅ 100% | 🥶 ~60~90초 | ⚠️ **본업 중단** |

---

## §2. 분리 Service 메모리 거동

### 2.1 컨테이너 부팅 시점 (1회, cold start)

`server-infer/start.sh` — bash PID 1 + uvicorn/Ollama 두 자식 패턴 (REBUILD32 §15 R-4):

```
[1] Ollama daemon 백그라운드 spawn (port 11434)
    ollama serve > /tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!

[2] Ollama 헬스체크 폴링 (보통 3~5초)

[3] FastAPI uvicorn 백그라운드 spawn (port 8080)
    /opt/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8080 &
    UVICORN_PID=$!

[4] SIGTERM 트랩 설정 (uvicorn + Ollama 둘 다 정리)
    trap '... kill -TERM $UVICORN_PID; kill -TERM $OLLAMA_PID ...' TERM INT

[5] bash 가 wait $UVICORN_PID 로 foreground 유지
    └─ uvicorn 죽으면 컨테이너 종료
```

> **통합과의 차이**: 통합은 `exec node server.js` 로 Express 가 PID 1, 분리는 bash 가 PID 1 유지하고 uvicorn/Ollama 가 자식. 이는 SIGTERM 시 두 자식을 모두 정리하기 위함 (R-4 패턴).

### 2.2 사용자 답변 요청 시 — 격리 호출 경로

분리 service 는 브라우저가 직접 호출하지 않고 **메인 service 가 ID token 으로 forward** 하는 2-hop 구조.

```
브라우저
   │ POST /api/iso-infer  body: { model_key, messages, max_tokens, temperature, think, keep_warm }
   ▼
메인 service (Express, aitutor)
   │
   │ withAuth 인증
   │
   │ Google Auth getIdTokenClient(audience=서비스URL).getRequestHeaders()
   │ Authorization: Bearer <ID token>
   │
   │ POST {ISO_INFER_URL}/infer  ← inter-service RTT ~10~50ms
   ▼
분리 service (FastAPI, aitutor-server-infer)
   │
   │ POST /infer 핸들러 (server.py:439~)
   │   ├─ ensure_ollama_model()
   │   ├─ unload_other_models()  (단, keep_warm=False 일 때만)
   │   ├─ apply_qwen_strict()
   │   ├─ thinking 모드 자동/수동 결정 (capabilities.think_supported / think_default)
   │   ├─ POST http://127.0.0.1:11434/api/chat
   │   └─ 응답 메타 조립
   ▼
   응답 ◀──────────────────────────────
```

### 2.3 분리 service 만의 특수 기능

#### A. `keep_warm` 옵션 (REBUILD33 §33.10)

번역 보조 파이프라인용. 통합에는 없음.

```python
# server.py:489~
if not req.keep_warm and _last_served_model != meta["ollama"]:
    await unload_other_models(client, keep_model=meta["ollama"])
```

- `keep_warm=False` (default) — 단일 모델 정책 유지 (다른 모델 unload 후 추론)
- `keep_warm=True` — unload skip → **두 모델 동시 keep_alive**
  - 번역 보조 (한→영→한) 3 단계 파이프라인에서 reload 비용 제거
  - VRAM 누적 위험은 [♻️ 인스턴스 재시작] 으로 회수

#### B. `restart-container` 의 SIGTERM-to-self 패턴 (REBUILD32 §15.5)

```python
# server.py:686~
async def _delayed_terminate(delay_sec: float = 0.6):
    await asyncio.sleep(delay_sec)
    os.kill(os.getpid(), signal.SIGTERM)

@app.post("/memory/restart-container")
async def restart_container():
    # 응답 즉시 반환 + 백그라운드 task 가 0.6초 후 SIGTERM
```

동작 순서:
1. 200 OK 즉시 반환 (사용자 UI 가 응답 받음)
2. 백그라운드 task 0.6초 대기 후 자기 PID 에 SIGTERM
3. uvicorn graceful shutdown 시작
4. start.sh 의 `wait $UVICORN_PID` 깨어남
5. bash trap 발동 → Ollama daemon kill + wait
6. 컨테이너 종료 (exit 0)
7. 다음 호출 시 Cloud Run 이 새 인스턴스 spawn

### 2.4 분리 service `/memory` 응답 구조

`server.py` `_read_meminfo()` + `_read_gpu_info()` + `/api/ps`:

```json
{
  "service": "aitutor-server-infer",
  "engines": ["ollama"],
  "ollama": {
    "reachable": true,
    "loaded": [
      {
        "name": "qwen2.5:7b",
        "size_total": 5859213824,
        "size_vram": 5859213824,
        "expires_at": "2026-05-07T00:51:33Z"
      }
    ]
  },
  "container": {
    "total_mb": 24576,
    "available_mb": 18432,
    "used_mb": 6144,
    "percent": 25.0
  },
  "gpu": {
    "used_mb": 5500,
    "total_mb": 23028,
    "free_mb": 17528,
    "utilization_percent": 0,
    "temperature_c": 76
  }
}
```

### 2.5 분리 service 시나리오별 RAM/VRAM 변화

#### A. 통합과 동일 패턴 (단일 모델 정책 + keep_alive 10m)

`keep_warm=False` 기본값에서는 통합 §1.4 의 시나리오 A~D 와 동일.

#### B. **분리 전용** — 번역 보조 (`keep_warm=True`)

번역 보조 모드 ON 인 한국어 약 모델(예: Phi-3.5 Mini) 추론 흐름:

```
[1/3] qwen2.5:1.5b (translator) 로드 + 한→영 번역
      VRAM 0.5 → 1.5 GB (translator)
      keep_warm=True → unload skip

[2/3] phi-3.5:mini 로드 + 영어 추론
      VRAM 1.5 → 4.0 GB (translator + phi 동시)  ← 분리 전용 동거!
      keep_warm=True → translator unload skip

[3/3] qwen2.5:1.5b (translator) 재사용 + 영→한 번역
      VRAM 4.0 GB 유지 (이미 로드됨, 즉시 추론)
      ⚡ reload 비용 제거 → 응답 시간 ↓
```

- 통합 service 에서는 불가능 (`keep_warm` 옵션 없음, 단일 모델 정책 강제).
- VRAM 누적은 [♻️ 인스턴스 재시작] 으로 100% 회수 가능.

#### C. **분리 전용** — RAM 회수 한계 실측 데이터 (REBUILD32 §15.5)

코드 주석에 기록된 실측치 (server.py:670~):

```
모델 4개 사이클 후 unload-all 실행 결과:
  컨테이너 RAM 사용률 85% → 80% (5%p 만 회수)
  24Gi 중 19.2GB 잔재, 6분간 변화 없음

원인:
  - 모델 파일 디스크 캐시 (/var/ollama/models)
  - Linux 페이지 캐시
  - Go runtime 메모리 OS 미반환
  → unload-all (keep_alive=0) 은 GPU VRAM + 모델 weights 만 회수

해결:
  /memory/restart-container 로 컨테이너 SIGTERM →
  새 인스턴스 cold start → RAM 100% 회수
```

이 실측치는 통합 service 도 동일하게 발생하지만, 통합에서는 `restart-container` 가 본업 영향이 있어 권장도가 낮다. **분리 service 는 격리되어 있어 자유롭게 재시작 가능** 이 핵심 장점.

### 2.6 분리 service RAM/VRAM 회수 비교

| 작업 | VRAM 회수 | RAM 회수 | 다음 요청 latency | 본업 영향 |
|------|-----------|----------|-------------------|----------|
| 추론 종료 (10m keep_alive) | ❌ 유지 | ❌ 유지 | ⚡ ~1초 | 0 |
| 10분 자동 unload | ✅ 즉시 | 🟡 부분 | 🐢 ~10~30초 | 0 |
| `unload-all` | ✅ 즉시 | 🟡 부분 (5%p 만) | 🐢 ~10~30초 | 0 |
| 모델 전환 (`keep_warm=False`) | ✅ 옛 모델 즉시 | 🟡 부분 | 🐢 ~10~30초 | 0 |
| **`keep_warm=True` 동거** | ❌ 두 모델 모두 유지 | ❌ 유지 | ⚡ ~1초 | 0 |
| `restart-container` | ✅ 100% | ✅ 100% | 🥶 ~60~90초 | **0 (격리됨)** |

---

## §3. 통합 vs 분리 service 비교 정리

### 3.1 같은 점

- Ollama 단일 엔진 + 단일 GGUF 모델 1개 메모리 적재
- `keep_alive: '10m'` 으로 추론 후 10분 warm 유지
- 단일 모델 정책 (`_last_served_model` 캐시 + `unload_other_models()`)
- `unload-all` 의 RAM 회수 한계 (page cache + daemon process 잔존)
- `restart-container` 만 RAM 100% 회수 가능
- GGUF mmap page cache 가 컨테이너 RAM 에 잔존
- GPU 사용률 0% 가 idle 정상 상태
- 모델 weights 는 RAM 거의 사용 안 함 (디스크 → GPU VRAM)

### 3.2 다른 점

| 항목 | 통합 | 분리 |
|------|------|------|
| PID 1 프로세스 | Express(node) | bash (uvicorn/ollama 자식) |
| 추론 언어 | Node.js | Python (FastAPI) |
| 호출 경로 | 브라우저 → Express (1-hop) | 브라우저 → Express → ID token → FastAPI (2-hop) |
| 호출 RTT | localhost ~1ms | inter-service ~10~50ms + ID token 인증 |
| 모델 catalog | 3 (매장 로컬 AI) | 15 (회사 자산) |
| 본업 동거 | ✅ KISA/운전면허/영상정보관리사 학습 + AI 해설 함께 | ❌ 추론 전용 |
| `keep_warm` 옵션 | ❌ | ✅ (번역 보조 동거 가능) |
| 번역 보조 파이프라인 | ❌ | ✅ (한→영→한 3단계) |
| `restart-container` 부작용 | ⚠️ 본업 중단 | ✅ 격리 ─ 본업 무영향 |
| 자원 사용 책임 | 메인 service 가 본업 + 추론 둘 다 부담 | 추론 자원 격리 |
| Cloud Run service | `aitutor` | `aitutor-server-infer` |
| Cloud Run spec | 24Gi / 6vCPU / L4 GPU | 24Gi / 4vCPU / L4 GPU |

### 3.3 권장 사용 시나리오

| 상황 | 권장 service |
|------|--------------|
| 매장 매대 전용 학습 단말기 (인터넷 X) | 통합 (오프라인 작동) |
| 본업 학습 화면에서 즉답 필요 | 통합 (RTT 짧음) |
| 회사 전체 자산으로 다양한 모델 비교 | 분리 (15 모델) |
| 영어 자격증 + 번역 보조 사용 | 분리 (`keep_warm=True`) |
| 운영 자원 격리가 필요할 때 | 분리 (restart 자유) |
| 큰 모델 (Phi 4 14B 등) 실험 | 분리 (메인은 본업도 함께라 부담) |

---

## §4. 실측 권장 모니터링 항목

### 4.1 정상 상태 지표

| 지표 | 정상 범위 | 의미 |
|------|----------|------|
| 컨테이너 RAM | < 70% | mmap + daemon overhead 포함 |
| GPU VRAM | < 85% | 모델 + KV cache + CUDA context |
| GPU 온도 | < 90°C | 추론 중 한정. idle 시 70~80°C |
| GPU 사용률 | 0% (idle) / 80~95% (추론) | 30~70% 지속은 비정상 |
| 로드 모델 수 | 1 (단일 모델 정책) / 2 (`keep_warm=True` 일 때만, 분리 전용) | 3개 이상은 unload 실패 |

### 4.2 회수 트리거 결정 트리

```
RAM > 70% 또는 VRAM > 85%
  │
  ├─ 같은 모델 다음 호출 임박? → 그냥 둠 (warm 유지)
  │
  ├─ 다른 모델 호출할 예정? → 자동 unload 발생 (action 불필요)
  │
  ├─ 일정 시간 idle 예상? → unload-all (수 초 회수)
  │
  └─ 메모리 누적 의심 / 4 사이클 이상 사용 후?
       │
       ├─ 통합 service? → restart-container 는 본업 중단! 비용 평가 후 결정
       │
       └─ 분리 service? → restart-container 안전 (격리됨)
```

---

## §5. 자주 묻는 오해 정정

### Q1. "엔진 실행 → 모델 메모리 로드" 순서인가?

**아니오.** Ollama 엔진은 컨테이너 부팅 시 1회만 기동되어 background daemon 으로 계속 떠 있다. 사용자 요청마다 새로 실행되지 않는다.

실제 순서: `엔진은 이미 떠있음 (부팅 시 1회) → 답변 요청 → 모델 로드 (필요 시) → 추론 → 응답`

### Q2. 모델 로드 시 컨테이너 RAM 도 점유되는가?

**거의 안 점유한다.** 모델 weights 는 디스크(GGUF) → GPU VRAM 으로 직행. 컨테이너 RAM 에서 보이는 증가분은 OS page cache (mmap 한 GGUF 파일의 일부 페이지) 정도.

화면에 보이는 RAM 6GB 의 대부분은 daemon process + 시스템 baseline.

### Q3. unload 하면 RAM 도 즉시 회수되는가?

**VRAM 만 즉시 회수, RAM 은 부분 회수.**

- VRAM: `keep_alive: 0` 으로 즉시 free (cuMemFree 호출)
- RAM: Ollama daemon 프로세스 살아있고, OS page cache 도 메모리 압박 시에만 정리됨
- 실측: `unload-all` 4 사이클 후 RAM 사용률 85% → 80% (5%p 만)

### Q4. RAM 100% 회수하려면?

**`restart-container` 만 가능.**

- 통합: 본업도 함께 중단되므로 비용 평가 필수
- 분리: 격리되어 자유롭게 재시작 가능 (REBUILD32 §15.5 의 핵심 가치)

### Q5. GPU 사용률 0% 인데 VRAM 5GB 점유되는 이유는?

**메모리 점유와 연산 사용률은 별개.**

- VRAM 5GB = 모델 weights + KV cache + CUDA context (idle 상태로 메모리만 점유)
- GPU 0% = SM(streaming multiprocessor) idle (추론 안 함)
- 다음 추론 호출 시 즉시 시작 가능 (warm 상태)

### Q6. 온도 76°C 는 정상인가?

**L4 GPU idle 기준 정상.** Cloud Run shared GPU 환경에서 70~80°C 범위. 추론 중엔 85~90°C 까지 올라가도 정상. 90°C 이상 지속은 thermal throttling 위험.

---

## §6. 참고 — 코드 레퍼런스

### 통합 service

| 파일 | 라인 | 함수/변수 |
|------|------|-----------|
| `start.sh` | 전체 | Ollama daemon + Express 부팅 |
| `api/local-infer.js` | 70~98 | `ensureOllamaModel()` (모델 자동 pull) |
| `api/local-infer.js` | 100~128 | `_lastServedModel`, `unloadOtherModels()` |
| `api/local-infer.js` | 130~170 | `callOllama()` (한국어 강제 + thinking off) |
| `api/local-infer.js` | 179~245 | `_readResources()`, `_checkModelAvailable()` |
| `api/local-infer.js` | 264~310 | `unload-all`, `restart-container` action |
| `api/local-infer.js` | 313~370 | `?action=memory` 응답 빌더 |
| `src/components/lab/MemoryCard.jsx` | 전체 | 메모리 패널 UI (첨부 화면) |

### 분리 service

| 파일 | 라인 | 함수/변수 |
|------|------|-----------|
| `server-infer/start.sh` | 전체 | bash PID 1 + uvicorn/Ollama 자식 |
| `server-infer/server.py` | 192 | `_last_served_model` (직전 모델 캐시) |
| `server-infer/server.py` | 195~214 | `InferRequest` (think + keep_warm 필드) |
| `server-infer/server.py` | 217~232 | `apply_qwen_strict()` |
| `server-infer/server.py` | 235~256 | `ensure_ollama_model()` |
| `server-infer/server.py` | 258~291 | `unload_other_models()` |
| `server-infer/server.py` | 439~533 | `POST /infer` 메인 핸들러 |
| `server-infer/server.py` | 538~631 | `_read_meminfo()`, `_read_gpu_info()`, `/memory` |
| `server-infer/server.py` | 634~667 | `/memory/unload-all` |
| `server-infer/server.py` | 670~710 | `/memory/restart-container` (SIGTERM-to-self) |
| `api/iso-infer.js` | 전체 | 메인 → 격리 ID token forward proxy |

---

**문서 종료.**
