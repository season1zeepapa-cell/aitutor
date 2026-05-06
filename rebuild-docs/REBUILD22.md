# REBUILD22 — GGUF (llama.cpp) 서버 추론 도입 (Gemma 4 비-ONNX 형식 병행)

작성일: 2026-04-28
범위: workspace/aitutor — REBUILD21 의 ONNX 환경 (12단계 트러블 끝에 동작) 외에 **GGUF + llama-cpp-python** 형식 병행 운영
선행 문서: REBUILD21 (Python Lambda Container + ONNX Runtime + LWA, Gemma 4 E2B 동작 확정)

---

## 0. TL;DR

REBUILD21 의 ONNX 환경(`onnx-community/gemma-4-E2B-it-ONNX`)을 12단계 호환성 트러블 끝에 동작시킨 후, 사용자 요청으로 ONNX 외 형식 검토. **GGUF (llama.cpp) 형식**이 Lambda CPU 환경에 가장 적합하다는 결론 + **ONNX/GGUF 병행 운영** (Lab 카드 분리). `bartowski/google_gemma-4-E2B-it-GGUF` Q4_K_M (3.2 GB) 변환본을 6차 빌드 끝에 라이브 배포 성공. 한국어 토큰 스트리밍 정상 동작.

### 사용자 결정 (2026-04-28 오후)

| # | 항목 | 결정 |
|---|---|---|
| 1 | ONNX 외 형식 검토 | ✅ Gemma 4 의 GGUF 변환본 |
| 2 | 운영 전략 | ✅ **ONNX / GGUF 병행** (Lab 카드 분리) |
| 3 | 모델 선택 | `bartowski/google_gemma-4-E2B-it-GGUF` Q4_K_M (3.46 GB) |
| 4 | 추론 라이브러리 | `llama-cpp-python` (cmake 빌드, BLAS 미사용) |
| 5 | Lab UI 분리 | 별도 페이지 `/lab/server-ai-gguf` |
| 6 | 토글 키 | `lab_server_ai_gguf_enabled` |
| 7 | E4B GGUF | 후속 (E2B 검증 우선) |

### 결과 — 라이브 배포 완료

- ✅ Lambda 함수 `aitutor-inference-e2b-gguf` (3008 MB) Active
- ✅ Function URL: `https://5wf3mc3qzslhykt3mmolvi2n3i0qinlj.lambda-url.ap-northeast-2.on.aws/`
- ✅ 메인 Lambda `api/server-infer.js` `FUNCTION_MAP['e2b-gguf']` 라우팅
- ✅ Lab 페이지 `/lab/server-ai-gguf` (admin 전용, 토글 ON)
- ✅ SettingsTab 의 🧪 실험실 탭에 **⚡ 서버 추론 GGUF** 카드 노출
- ✅ /infer 직접 invoke 검증: 한국어 토큰 스트리밍 (633초 / 30 토큰, 첫 콜드)

---

## 1. 배경

### 1.1 REBUILD21 의 ONNX 동작 확정 (12차 빌드)

REBUILD21 §16 에 12단계 트러블슈팅 기록:
1. Lambda base image + run.sh ENTRYPOINT 충돌
2. transformers 4.46.3 의 qwen3_5 architecture 미등록
3. AutoTokenizer 의 TokenizersBackend 미지원 → PreTrainedTokenizerFast 직접
4. ONNX Runtime 1.20.1 의 GatherBlockQuantized op 미지원
5. transformers 의 chat_template_utils 의 jinja2 Extension 미정의
6. decoder ONNX 의 attention_mask, num_logits_to_keep 추가 입력
7. KV 캐시 dtype float32 → float16
8. layer 별 head_dim 다름 (Gemma 4 hybrid attention) → ONNX session 의 input metadata 동적 추출
9. Gemma 4 E2B 동작 확정 (한국어 토큰 스트리밍, 41초 / 10 토큰)

→ ONNX 환경은 동작하지만 트러블 누적. 사용자가 **ONNX 외 형식** 옵션 질의.

### 1.2 다른 형식 후보 검토

| 형식 | Lambda CPU 적합성 | 트러블 위험 |
|---|---|---|
| ONNX (현재) | ✅ 동작 (12단계 우회 후) | 신규 모델마다 호환성 검증 필요 |
| **GGUF (llama.cpp)** | ✅✅ CPU 추론 최적화 | 검증된 라이브러리, 트러블 적음 |
| safetensors (PyTorch + transformers) | ⚠️ PyTorch 무거움 | bitsandbytes CPU 양자화 제한적 |
| Keras (TensorFlow) | ❌ TF 패키지 무거움 | Lambda 부적합 |
| MLX (Apple Silicon) | ❌ Lambda 무관 | - |
| CTranslate2 | ⚠️ Gemma 미지원 | - |

**GGUF 가 Lambda CPU 환경에 가장 적합** 결론.

### 1.3 사용자 결정 — ONNX/GGUF 병행

> "ONNX 변형 말고 다른 모델 젬마4로"
> "B. ONNX 와 GGUF 병행 (실험실 카드 분리, 비교 운영)"

→ 같은 Gemma 4 E2B 의 두 형식을 **별도 Lab 페이지** 로 운영:
- `/lab/server-ai` (REBUILD21, ONNX)
- `/lab/server-ai-gguf` (본 라운드, GGUF)

---

## 2. 작업 흐름 — Phase 별 진행

### Phase 1 — GGUF 모델 확보 (30분)

**HF 검색 결과**:
- ✅ `bartowski/google_gemma-4-E2B-it-GGUF` (26개 양자화 변형)
- ✅ `unsloth/gemma-4-E2B-it-GGUF`
- (E4B 는 별도 repo 미확인, 후속)

**Q4_K_M 선정 근거** (bartowski 권장):
- 파일 사이즈: **3.46 GB** (실제 다운로드: 3.2 GB)
- 품질 손실 최소
- Lambda 메모리 3008 MB 한도에서 mmap 으로 적재 가능 추정

**다운로드 시도 1** — 파일명 추측 실패:
```python
# 시도: 'gemma-4-E2B-it-Q4_K_M.gguf'
huggingface_hub.errors.RemoteEntryNotFoundError: 404
```

**다운로드 시도 2** — HF API 로 정확 파일명 조회:
```bash
curl -s "https://huggingface.co/api/models/bartowski/google_gemma-4-E2B-it-GGUF" | jq '.siblings[].rfilename'
# 결과: google_gemma-4-E2B-it-Q4_K_M.gguf  (google_ prefix 있음)
```

성공 — 294초 다운로드.

**S3 업로드**:
```bash
aws s3 cp /tmp/gemma4-e2b-gguf/google_gemma-4-E2B-it-Q4_K_M.gguf \
  s3://aitutor-models-794531974010/e2b-gguf/google_gemma-4-E2B-it-Q4_K_M.gguf
```

### Phase 2 — Python 코드 작성 (Dockerfile + handler, 1시간)

**구조**:
```
scripts/inference-handler-gguf/
  ├─ Dockerfile         # python:3.11-slim + cmake
  ├─ app.py             # FastAPI + llama-cpp-python streaming
  ├─ auth.py            # HMAC JWT (REBUILD21 동일)
  ├─ rate_limit.py      # 4단계 한도 (provider='local-{key}')
  └─ requirements.txt   # llama-cpp-python + fastapi 등
```

**핵심 패턴**:
- `Llama(model_path=...)` 로 GGUF 로드
- `create_chat_completion(stream=True)` → SSE 토큰 스트리밍
- ONNX 환경의 4-session 패턴 불필요 (단일 GGUF 파일)
- `transformers` 의존성 0 → REBUILD21 §16 의 jinja2 / Extension / TokenizersBackend 트러블 회피

### Phase 3 — buildspec.yml 갱신 (HANDLER 분기)

```yaml
env:
  variables:
    HANDLER: "py"          # py (ONNX) 또는 gguf
    MODELS: "qwen35-4b"

phases:
  pre_build:
    commands:
      - cd scripts/inference-handler-${HANDLER}
```

→ 같은 buildspec 으로 ONNX / GGUF 둘 다 빌드. CodeBuild 호출 시 `--environment-variables-override` 로 분기.

---

## 3. 🐛 트러블슈팅 6단계 (상세)

### 3.1 1차 빌드 — `build-essential` 누락

**에러**:
```
Building wheel for llama-cpp-python (pyproject.toml): finished with status 'error'
CMake Error at .../FindPackageHandleStandardArgs.cmake:290 (message):
  -- Configuring incomplete, errors occurred!
```

**원인**:
- `python:3.12-slim-bullseye` base image 에 gcc/g++ 미설치
- llama-cpp-python 은 PyPI 에 source distribution 만 → cmake 빌드 필수
- cmake 가 컴파일러 못 찾음

**해결 시도**: `OpenBLAS` + `BLAS_VENDOR=OpenBLAS` 옵션 추가
- 결과: 같은 에러 (build-essential 자체가 없으니 BLAS 도 무관)

### 3.2 2차 빌드 — pre-built wheel index 매칭 실패

**시도**: abetlen 의 pre-built wheel 사용
```dockerfile
RUN pip install --no-cache-dir \
    llama-cpp-python==0.3.5 \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
```

**로그**:
```
Looking in indexes: https://pypi.org/simple, https://abetlen.github.io/llama-cpp-python/whl/cpu
Collecting llama-cpp-python==0.3.5
  Building wheel for llama-cpp-python: started
  Building wheel for llama-cpp-python: finished with status 'error'
```

**진단**: extra-index-url 이 wheel 못 찾음 → PyPI source distribution 으로 fallback → cmake 빌드 시도 → fail.

abetlen 의 pre-built wheel 이 cp312 또는 우리 platform 에 매칭 안 되는 것으로 추정.

### 3.3 3차 빌드 — `build-essential` 추가했는데도 cmake fail

**Dockerfile 변경**:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git \
    && rm -rf /var/lib/apt/lists/*
```

**같은 에러** — `CMAKE_C_COMPILER` 미설정. cmake 가 gcc 인식 못 함.

**원인 추정**:
- llama-cpp-python 의 scikit-build-core 가 자체 cmake (4.3) 사용
- 시스템 cmake 와 별개로 환경변수 안 받음
- 또는 build-essential 의 gcc 위치 (/usr/bin/gcc) 가 PATH 에 있는데 cmake 의 다른 검색

### 3.4 4차 빌드 — `--only-binary=:all:` (binary 강제)

**시도**: PyPI 또는 다른 source 의 binary wheel 강제
```dockerfile
RUN pip install --no-cache-dir --only-binary=:all: \
    llama-cpp-python==0.3.5
```

**에러**:
```
ERROR: Could not find a version that satisfies the requirement llama-cpp-python==0.3.5
       (from versions: none)
ERROR: No matching distribution found for llama-cpp-python==0.3.5
```

**핵심 발견**:
- `(from versions: none)` — **PyPI 에 어떤 binary wheel 도 없음**
- llama-cpp-python 은 source distribution 만 PyPI 에 올림
- → **cmake 빌드 회피 불가능**

**기록 가치 있는 시도**:
- Python 3.12 → 3.11 다운그레이드 (wheel 풍부 가정)
- bookworm → bullseye 변경
- 모두 같은 결과 (PyPI 에 wheel 없음)

### 3.5 5차 빌드 — `cmake + gcc 환경변수 명시` (성공 — ECR push)

**Dockerfile 핵심**:
```dockerfile
FROM public.ecr.aws/docker/library/python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ make cmake git ninja-build

ENV CC=/usr/bin/gcc
ENV CXX=/usr/bin/g++
ENV CMAKE_C_COMPILER=/usr/bin/gcc
ENV CMAKE_CXX_COMPILER=/usr/bin/g++
ENV CMAKE_ARGS="-DGGML_CUDA=OFF -DGGML_NATIVE=OFF"
ENV FORCE_CMAKE=1

RUN pip install --no-cache-dir --verbose llama-cpp-python==0.3.5 2>&1 | tail -50
```

**핵심 변경**:
1. `CC` / `CXX` 환경변수 명시
2. `CMAKE_C_COMPILER` / `CMAKE_CXX_COMPILER` 직접 지정
3. `GGML_NATIVE=OFF` (CPU 호환성 우선, native opt 끔)
4. `ninja-build` 추가 (cmake 빌드 가속)

**결과**:
- 빌드 시간: 4분 30초 (cmake 컴파일)
- ECR 이미지: 3.67 GB
- ✅ ECR push 성공

### 3.6 5차 검증 — `llama-cpp-python 0.3.5` 이 Gemma 4 GGUF 미지원

**Lambda /infer 호출 결과**:
```
data: {"type": "meta", "model": "e2b-gguf", "format": "gguf", ...}
data: {"error": "inference_failed",
       "message": "Failed to load model from file: /var/task/model/google_gemma-4-E2B-it-Q4_K_M.gguf",
       "traceback": "...
         File \"/usr/local/lib/python3.11/site-packages/llama_cpp/_internals.py\", line 56
         raise ValueError(f\"Failed to load model from file: {path_model}\")"}
```

**원인 분석**:
- `llama-cpp-python==0.3.5` (2024) 는 **2024년 시점의 llama.cpp** 사용
- **Gemma 4 (2026-04-02 launch)** 의 신규 architecture 미지원
- 검색 결과: "Gemma 3 = llama-cpp-python 0.3.8+", "Gemma 4 = 0.4.x+"

### 3.7 6차 빌드 — `llama-cpp-python` latest (성공!)

**Dockerfile 변경**:
```dockerfile
# llama-cpp-python 최신 (Gemma 4 지원 — 2026-04 launch)
RUN pip install --no-cache-dir --verbose llama-cpp-python 2>&1 | tail -50
```

(version pin 제거 → 최신 stable 받음)

**결과**:
- 빌드 시간: ~6분 (cmake)
- ECR 이미지: **3.69 GB**
- ✅ Lambda invoke 성공
- ✅ 한국어 토큰 스트리밍

```
data: {"type": "token", "token": "사"}
data: {"type": "token", "token": " 해"}
data: {"type": "token", "token": "설"}
data: {"type": "token", "token": "\n\n"}
data: {"type": "token", "token": "**"}
data: {"type": "token", "token": "["}
data: {"type": "token", "token": "문제"}
data: {"type": "token", "token": "]"}
... (총 30 토큰, 633초 — 첫 콜드)
data: {"type": "done", "latency_ms": 633526, "output_tokens": 30}
```

---

## 4. 6단계 트러블슈팅 누적 통계

| # | 변경 핵심 | 결과 | 근본 원인 |
|---|---|---|---|
| 1 | Dockerfile 작성 (build-essential 없음) | cmake 에러 | gcc/g++ 미설치 |
| 2 | abetlen pre-built wheel index | 같은 cmake 에러 | wheel 매칭 실패 (platform/python 버전) |
| 3 | build-essential 추가 | CMAKE_C_COMPILER 미설정 | scikit-build-core 의 cmake 자체 검색 |
| 4 | `--only-binary=:all:` | No matching distribution | PyPI 에 binary wheel 없음 (source only) |
| 5 | cmake + gcc 환경변수 명시 | ECR push ✅ / 모델 로드 fail | llama-cpp-python 0.3.5 가 Gemma 4 미지원 |
| 6 | llama-cpp-python latest | **✅ 동작** | (Gemma 4 지원 버전) |

**누적 시간**: 빌드 6회 + 디버깅 ~3시간

---

## 5. 인프라 — 라이브 배포 완료

### 5.1 신규 추가 (REBUILD22)

| 자산 | 사이즈 / 사양 | 비고 |
|---|---|---|
| S3 `s3://...models/.../e2b-gguf/` | 3.2 GB | Q4_K_M GGUF 파일 |
| ECR 리포 `aitutor-inference-e2b-gguf` | 3.69 GB | Python + llama-cpp-python + 모델 |
| Lambda 함수 `aitutor-inference-e2b-gguf` | 3008 MB / 900 s timeout | LWA + FastAPI |
| Function URL | RESPONSE_STREAM | `https://5wf3mc3qzslhykt3mmolvi2n3i0qinlj.lambda-url...` |
| 코드 `scripts/inference-handler-gguf/` | 5 파일 | Dockerfile + 4 Python |
| 프론트 `src/labs/server-ai-gguf/` | 3 파일 | server-ai 복사 + GGUF 메타 |
| App.jsx 라우트 | `/lab/server-ai-gguf/*` | lazy import |
| config/admin 키 | `lab_server_ai_gguf_enabled` | 화이트리스트 |
| SettingsTab Labs 카드 | ⚡ 서버 추론 GGUF | 토글 + 링크 |
| `api/server-infer.js` FUNCTION_MAP | `e2b-gguf` 매핑 추가 | Raw HTTP SigV4 invoke |
| inference-buildspec.yml | HANDLER 분기 | py / gguf |

### 5.2 변경 없음 (기존)

- ONNX 환경 (`scripts/inference-handler-py/`, `aitutor-inference-e2b`, `/lab/server-ai`) — 그대로
- 메인 aitutor Lambda — 변경분 (server-infer FUNCTION_MAP, App.jsx 라우트, SettingsTab 카드, config/admin 토글) 만 재배포
- 디바이스 추론 (`/lab/local-ai`) — 무관

---

## 6. ONNX vs GGUF 비교 (E2B Gemma 4)

| 항목 | ONNX (REBUILD21) | GGUF (REBUILD22) |
|---|---|---|
| HF 모델 ID | `onnx-community/gemma-4-E2B-it-ONNX` | `bartowski/google_gemma-4-E2B-it-GGUF` |
| 파일 사이즈 (디스크) | 3.4 GB (4 ONNX session) | 3.2 GB (단일 GGUF) |
| 추론 라이브러리 | onnxruntime + transformers | llama-cpp-python (cmake 빌드) |
| 빌드 트러블 | **12단계** (Auto-class / TokenizersBackend / op / dtype / shape) | **6단계** (cmake / 라이브러리 호환) |
| Lambda Container 이미지 | 3.1 GB | 3.69 GB |
| Lambda 메모리 (3008 MB) | 동작 ✅ (Max 사용 미측정) | 동작 ✅ |
| 첫 콜드 응답 시간 | 41초 / 10 토큰 | 633초 / 30 토큰 (mmap 초기 로드) |
| Warm 추론 속도 | ~3 초/토큰 | ~3~5 초/토큰 (예상, 후속 측정) |
| 멀티모달 (vision/audio) | 가능 (4 session 분리) | 텍스트 전용 |
| 의존성 트리 | transformers + jinja2 + numpy + ORT | llama-cpp-python 단일 |
| 신규 모델 추가 시 | Auto-class 매핑 + ONNX op 검증 | 라이브러리 버전만 맞으면 OK |

### 핵심 차이
- **GGUF 가 빌드 트러블 적음** (6 vs 12 단계)
- **GGUF 가 의존성 단순** (libcpp 단일)
- **ONNX 가 첫 토큰 빠름** (load_time_ms 짧음)
- **ONNX 가 멀티모달** (GGUF 는 텍스트만)

→ Lab 페이지 두 곳에서 직접 한국어 품질 / 응답 속도 비교 가능

---

## 7. 사용자 콘솔 작업 진행 (참고)

### 7.1 Lambda 한도 증가 (병행 진행됨)

- ✅ Concurrent executions: 10 → 1000 (Service Quotas, 자동 승인)
- ⏳ Function memory: 3008 MB → 10240 MB (Support 케이스 `177734918600740`, "할당되지 않음" 상태)

→ 메모리 한도 풀리면 E4B GGUF / E4B ONNX 추가 가능.

### 7.2 ALB / CloudFront timeout 조정 (REBUILD22 작업 중)

- ALB idle timeout: 300s → 600s (504 fix 시도)
- CloudFront OriginReadTimeout: 60s (default, 변경 안 함)
- 메인 `api/server-infer.js` 에 25초 keep-alive chunk 송신 추가 (504 우회)

---

## 8. UI / 라이브 노출

### 8.1 SettingsTab → 🧪 실험실 탭 (3 카드)

```
🧪 디바이스 AI 해설          [🟢 ON]
   → /lab/local-ai

☁️ 서버 추론 (Lambda + ONNX)  [🟢 ON]
   → /lab/server-ai

⚡ 서버 추론 GGUF (Lambda + llama.cpp)  [🟢 ON]
   → /lab/server-ai-gguf
```

### 8.2 `/lab/server-ai-gguf` 화면 구성

(REBUILD21 의 server-ai 복사 + GGUF 메타데이터 변경)
- 헤더: ⚡ 서버 추론 GGUF (llama.cpp)
- 안내 배너: "Lambda + llama.cpp + GGUF Q4_K_M"
- 모델 카드: Gemma 4 E2B (GGUF Q4_K_M, 3.2 GB, ~8초)
- 운전면허 문항 자동 로드 + 다음 문항 ↻
- 정답 보기/숨기기
- 🔍 최종 입력 프롬프트 보기 (접힘 + 복사)
- ✨ 추론 시작 버튼
- 📊 메트릭 카드 (모델 / 로드 / 첫 토큰 / 전체 / 비용)
- 호출 이력 (최근 10)

### 8.3 admin DB 토글 적용

```sql
INSERT INTO aitutor_settings(key, value, updated_at)
VALUES ('lab_server_ai_gguf_enabled', 'true', NOW())
ON CONFLICT (key) DO UPDATE SET value='true', updated_at=NOW();
```

---

## 9. 배포 시각 + 빌드 ID (감사 추적)

| 시각 (KST) | 작업 | Build ID / Resource |
|---|---|---|
| 14:00~ | 다른 형식 검토 시작 | (사용자 질의) |
| ~14:30 | GGUF 결정 + 모델 검색 | bartowski 발견 |
| ~14:45 | Q4_K_M 다운로드 + S3 업로드 | s3://.../e2b-gguf/ |
| ~15:00 | 코드 작성 (Dockerfile + handler) | scripts/inference-handler-gguf/ |
| 15:19 | 1차 빌드 (build-essential 없음) | `e968e411` (실패) |
| 15:36 | 2차 빌드 (pre-built wheel) | (실패) |
| ~15:50 | 3차 빌드 (build-essential 추가) | (실패) |
| ~16:30 | 4차 빌드 (--only-binary) | (실패) |
| 16:53 | 5차 빌드 (cmake + 환경변수) | `67e66f0c` (ECR push 성공) |
| 17:03 | 5차 invoke 실패 (0.3.5 미지원) | (모델 로드 fail) |
| 17:07 | 6차 빌드 (llama-cpp-python latest) | `5ada5600` ✅ |
| 17:13 | ECR 이미지 push (3.69 GB) | `aitutor-inference-e2b-gguf:latest` |
| ~17:20 | Lambda 함수 생성 + Function URL | `aitutor-inference-e2b-gguf` |
| 17:25 | /infer 검증 — 한국어 토큰 스트리밍 ✅ | latency 633s |
| 17:34 | 메인 Lambda 재배포 시작 | `46ec4cf3` |
| 17:36 | 메인 Lambda update 완료 | `IB7K4RPVQ7KN5691Y0T9A7VYD3` |
| 17:36 | admin 토글 활성화 | DB INSERT |

---

## 10. 후속 과제

### 10.1 즉시 (메모리 한도 처리 후)

1. **E4B GGUF 추가** — Memory 10240 MB 한도 풀린 후
   - `bartowski/google_gemma-4-E4B-it-GGUF` (있다면) 또는 unsloth 변환본
   - Lambda 함수 메모리 8192 MB
   - SERVER_MODELS 에 e4b-gguf 추가
2. **CloudFront 전파 후 사용자 라이브 검증**
   - GGUF Lab 페이지 한국어 추론 품질
   - ONNX vs GGUF 같은 문항 비교

### 10.2 단기 개선

1. **Warm Lambda 유지** — Provisioned Concurrency 옵션 검토 (콜드 스타트 0)
2. **InvokeWithResponseStream 마이그레이션** — 메인 Lambda 가 chunk 별 즉시 forward (현재는 동기 invoke + 한 번에 forward, keep-alive 로 timeout 우회)
3. **모델 캐시 최적화** — `use_mmap=True` 동작 검증, mlock 활용 검토
4. **Reserved Concurrency** — Lambda 한도 증가 후 5 → 그 이상

### 10.3 장기 (REBUILD23+)

1. `/api/server-models` 엔드포인트 — UI 동적 모델 노출 (REBUILD21 §17.1)
2. family 매핑을 config 추출 (REBUILD21 §17.2)
3. 자동 deploy 스크립트 (REBUILD21 §17.3)
4. ONNX vs GGUF 운영 데이터 누적 후 한쪽 선택 또는 모델별 선택 정책
5. 한국어 fine-tuning (LoRA + GGUF 변환)

---

## 11. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-28 | 최초 작성 — REBUILD21 의 ONNX 환경 외 GGUF 형식 병행 도입. 6단계 트러블슈팅 + 라이브 배포 완료 기록 | Claude Code |

---

## 12. 부록

### 12.1 외부 자료

- [bartowski/google_gemma-4-E2B-it-GGUF (HF)](https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF)
- [llama-cpp-python (PyPI)](https://pypi.org/project/llama-cpp-python/)
- [llama.cpp Gemma 3n 지원 PR / 토론](https://github.com/ggml-org/llama.cpp/)
- [Unsloth Gemma 4 가이드](https://unsloth.ai/docs/models/gemma-4)
- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)

### 12.2 내부 선행 문서

- REBUILD15 §13 — Function URL 라우팅 propagation 이슈
- REBUILD17 §13 — `/lab/local-ai` 격리 모듈 패턴
- REBUILD18 §11 — 글로벌 토글 + admin 화이트리스트
- REBUILD20 — Node.js 시도 + 호환성 발견
- **REBUILD21 §16 — ONNX 12단계 트러블슈팅 (본 라운드의 출발점)**
- **REBUILD21 §17 — 후속 확장 개선 5건 (본 라운드 일부 진전)**

### 12.3 핵심 파일 (현재 상태)

```
scripts/inference-handler-gguf/
  ├─ Dockerfile             (python:3.11-slim + cmake + llama-cpp-python latest)
  ├─ requirements.txt       (fastapi + uvicorn + psycopg2 + boto3)
  ├─ app.py                 (FastAPI + Llama + StreamingResponse)
  ├─ auth.py                (HMAC JWT — REBUILD21 동일)
  └─ rate_limit.py          (4단계 한도)

src/labs/server-ai-gguf/
  ├─ index.jsx              (lab_server_ai_gguf_enabled 가드)
  ├─ ServerAiTester.jsx     (LocalAi 패턴 + GGUF 메타)
  └─ lib/serverInfer.js     (SERVER_MODELS = { 'e2b-gguf': ... })

api/server-infer.js
  FUNCTION_MAP = {
    'e4b':       'aitutor-inference-e4b',
    'e2b':       'aitutor-inference-e2b',
    'qwen35-4b': 'aitutor-inference-qwen35-4b',
    'e2b-gguf':  'aitutor-inference-e2b-gguf',  // REBUILD22
    'e4b-gguf':  'aitutor-inference-e4b-gguf',  // 후속
  }

inference-buildspec.yml
  env.variables.HANDLER: "py"  # py(ONNX) | gguf
```

### 12.4 검증된 admin 토큰 (예시 — 메모리 보존용)

```python
# uid=7 admin (season1zeepapa@gmail.com)
# HMAC-SHA256 / 메인 auth.js 와 동일 시크릿 (SSM /aitutor/AUTH_TOKEN_SECRET)
import hmac, hashlib, json, base64, time
header = b64(json.dumps({'alg':'HS256','typ':'JWT'}, separators=(',',':')).encode())
payload = b64(json.dumps({
    'sub':'season1zeepapa@gmail.com',
    'email':'season1zeepapa@gmail.com',
    'uid':7, 'name':'동천동', 'admin':True,
    'iat':int(time.time()), 'exp':int(time.time())+7200
}).encode())
sig = b64(hmac.new(secret.encode(), f'{header}.{payload}'.encode(), hashlib.sha256).digest())
token = f'{header}.{payload}.{sig}'
```

### 12.5 주요 명령 (재현용)

```bash
# 모델 다운로드
python3 -c "from huggingface_hub import hf_hub_download; \
  hf_hub_download('bartowski/google_gemma-4-E2B-it-GGUF', \
    'google_gemma-4-E2B-it-Q4_K_M.gguf', local_dir='/tmp/gemma4-e2b-gguf')"

# S3 업로드
aws s3 cp /tmp/gemma4-e2b-gguf/google_gemma-4-E2B-it-Q4_K_M.gguf \
  s3://aitutor-models-794531974010/e2b-gguf/google_gemma-4-E2B-it-Q4_K_M.gguf \
  --region ap-northeast-2

# CodeBuild (HANDLER=gguf, MODELS=e2b-gguf)
aws codebuild start-build \
  --project-name aitutor-inference-build \
  --region ap-northeast-2 \
  --environment-variables-override \
    "name=HANDLER,value=gguf,type=PLAINTEXT" \
    "name=MODELS,value=e2b-gguf,type=PLAINTEXT"

# Lambda 함수 생성
aws lambda create-function \
  --function-name aitutor-inference-e2b-gguf \
  --package-type Image \
  --code ImageUri=794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor-inference-e2b-gguf:latest \
  --role arn:aws:iam::794531974010:role/aitutor-inference-role \
  --memory-size 3008 \
  --timeout 900 \
  --ephemeral-storage Size=8192 \
  --environment file:///tmp/env-gguf.json \
  --region ap-northeast-2

# Function URL
aws lambda create-function-url-config \
  --function-name aitutor-inference-e2b-gguf \
  --auth-type NONE \
  --invoke-mode RESPONSE_STREAM \
  --region ap-northeast-2

# /infer 검증
aws lambda invoke \
  --function-name aitutor-inference-e2b-gguf \
  --region ap-northeast-2 \
  --invocation-type RequestResponse \
  --cli-binary-format raw-in-base64-out \
  --payload file:///tmp/infer-gguf.json \
  --cli-read-timeout 800 \
  /tmp/result.txt

# admin 토글
psql "$DATABASE_URL" -c \
  "INSERT INTO aitutor_settings(key,value,updated_at) \
   VALUES('lab_server_ai_gguf_enabled','true',NOW()) \
   ON CONFLICT(key) DO UPDATE SET value='true', updated_at=NOW();"
```

---

## 13. 후속 작업 — server-infer 504 timeout 조사 + 옵션 P 인프라 (2026-04-28)

GGUF 라이브 직후 사용자 라이브 검증에서 다음 에러 보고:

```
POST https://d2dcsdi9b1j2rf.cloudfront.net/api/server-infer/e4b 504 (Gateway Timeout)
```

CloudFront → ALB → 메인 Lambda → inference Lambda Invoke 경로에서 콜드 스타트 시 발생.

### 13.1 진단 — `keep-alive` 트릭이 무효한 이유

`api/server-infer.js:160-173` 의 25 초 keep-alive `res.write` 는 다음 흐름 때문에 **클라이언트로 한 byte 도 흘러가지 않음**:

```
[CloudFront] → [ALB Lambda target] → 메인 Lambda
                  ↑ ALB Lambda target 은 RESPONSE_STREAM 미지원 (BUFFERED 강제)
[메인 Lambda]
  serverless-express(server.js)
  ↑ serverless-express 는 BUFFERED 강제
  ↑ Express res.write 는 메모리 버퍼에만 쌓이고
    핸들러 종료 시 한 번에 ALB → CloudFront 전달
```

= **CloudFront 가 60s 동안 origin 첫 byte 를 못 받음 → 504 반환** (REBUILD22 §7.2 keep-alive 가설 무효 확인).

### 13.2 timeout chain 정밀 측정

| 레이어 | 현재 값 | 평가 |
|---|---|---|
| Lambda inference timeout | 900s | OK |
| Lambda main timeout | 300s | OK |
| ALB idle_timeout (`aitutor-alb`) | 600s | OK |
| **CloudFront OriginReadTimeout** | **60s (계정 quota hard limit)** | **병목** |

CloudFront `update-distribution` 으로 60→180 시도 → `InvalidOriginReadTimeout: not within the valid range` (계정 default quota 60s, 증가 신청 필요).

### 13.3 옵션 P — RESPONSE_STREAM 라우터 Lambda (인프라 구축, 보류)

ALB 우회 경로로 `/api/server-infer/*` 만 분기:

```
[브라우저] /api/server-infer/e4b
   ↓
[CloudFront]
  ├─ /*                     → 기존 lambda-origin (ALB)
  └─ /api/server-infer/*    → 신규 infer-router-origin (Function URL, RESPONSE_STREAM)
   ↓
[aitutor-infer-router] (Node 22, 512MB, awslambda.streamifyResponse)
   ↓ HTTPS POST → inference Lambda Function URL (이미 RESPONSE_STREAM)
```

**구축된 인프라 (보존)**:

| 리소스 | ID/Name | 상태 |
|---|---|---|
| IAM Role | `aitutor-infer-router-role` | 활성 (CloudWatch Logs 만) |
| Lambda 함수 | `aitutor-infer-router` | 활성 (Node 22, zip 3KB) |
| Lambda 코드 | `scripts/server-infer-router/index.js` | keep-alive 25 s 포함 |
| Function URL | `gdyuvt2on...lambda-url.ap-northeast-2.on.aws` | AWS_IAM 인증 |
| OAC v2 | `E2LFRQXLBMZ6CU` (`aitutor-infer-router-oac-v2`) | distribution origin 연결 |
| CloudFront origin | `infer-router-origin` | 등록 (트래픽 X) |
| CloudFront behavior | `/api/server-infer/*` | **제거됨** ← 비활성 스위치 |

### 13.4 SigV4 mismatch 미해결 (옵션 P 보류 사유)

표준 OAC + Lambda Function URL 단계 모두 시도, 모두 동일 `signature does not match` 또는 `Forbidden`:

| # | 시도 | 결과 |
|---|---|---|
| 1 | OAC `OriginType=lambda`, `SigningBehavior=always` | mismatch |
| 2 | Lambda permission `Principal: cloudfront.amazonaws.com` + `SourceArn` 제한 | mismatch |
| 3 | invoke-mode RESPONSE_STREAM ↔ BUFFERED 격리 (mode 무관) | mismatch |
| 4 | viewer 가 `x-amz-content-sha256` 헤더 추가 | Forbidden |
| 5 | OriginRequestPolicy `AllViewerExceptHostHeader` ↔ 제거 | mismatch |
| 6 | OAC 새로 생성 + 재 binding | mismatch |
| 7 | `x-amz-content-sha256` 명시 whitelist | **CloudFront가 reserved header로 거부** |

→ **AWS 내부 차원 (계정 SCP/RCP) 의 추가 차단 추정**. `aws lambda invoke` 직접 호출 시 라우터는 정상 동작 (단일 sync invoke 로 unauthorized SSE 응답 확인). 즉 CloudFront → Function URL 사이의 SigV4 검증이 통과 못함. AWS Support 케이스 영역.

### 13.5 옵션 A 우회 — quota 증가 신청 대기

CloudFront "Response timeout per origin" quota 60→180 증가 신청 (사용자 직접 진행). 승인 도착 시 한 줄 변경:

```bash
aws cloudfront get-distribution-config --id E2MP4BK1D16LJN > /tmp/cf.json && \
ETAG=$(python3 -c "import json; print(json.load(open('/tmp/cf.json'))['ETag'])") && \
python3 -c "
import json
d = json.load(open('/tmp/cf.json'))['DistributionConfig']
for o in d['Origins']['Items']:
  if o['Id']=='lambda-origin': o['CustomOriginConfig']['OriginReadTimeout']=180
json.dump(d, open('/tmp/cf-180.json','w'))
" && \
aws cloudfront update-distribution --id E2MP4BK1D16LJN --if-match $ETAG --distribution-config file:///tmp/cf-180.json
```

콜드 스타트 일반 케이스(30~90s) 커버. 워스트 633s 같은 극단은 여전히 ❌.

### 13.6 부수 변경

`server.js:34-36` 의 `'server-infer'` 중복 등록 제거 (한 줄로 정리).

---

## 14. HF Inference Providers 실험실 도입 (2026-04-28)

옵션 P/A 둘 다 외부 의존 대기 상태에서, **별도 우회로 — Hugging Face Inference Providers** 검토 → 채택. 메인 Lambda BUFFERED 상태 그대로 두고도 **HF API 응답이 항상 warm + 빠름** 이라 60 s timeout 안에 끝남.

### 14.1 채택 근거

| 항목 | 자체 inference Lambda | HF Inference Providers |
|---|---|---|
| 콜드 스타트 | 30~90s (워스트 633s) | 0 (provider 가 항상 warm) |
| 모델 다양성 | 5개 (e2b/e4b/gguf 등) | **122 개** (router) |
| 비용 (1000회/월 추정) | ~$3 | ~$0.2~$1.8 (모델별) |
| 운영 부담 | ECR 이미지, Lambda concurrency 관리 | 외부 의존 |
| 504 risk | 콜드 시 발생 | 거의 없음 |

→ HF API 도입 시 **자체 inference Lambda 5개 보존하되 사용은 점진적 전환**. 504 문제 자연 해결.

### 14.2 Phase 1 — 백엔드 프록시 (45 분)

- `api/_llm/hf-chat.js` (신규) — `chat` / `chatStream`. OpenAI 호환 form. SSE 파싱 + usage-log.
- `api/hf.js` (신규) — Express 핸들러 (`withAuth`, SSE forward).
- `api/_llm/usage.js` (확장) — HF 모델 단가 + family fallback.
- `server.js` — `'hf'` 라우트 등록.
- SSM `/aitutor/HF_API_KEY` (사용자 직접 등록, fine-grained "Make calls to Inference Providers" 권한만).

### 14.3 Phase 2 — 실험실 페이지 MVP

- 새 라우트 `/lab/hf` (`server-ai` 패턴 차용 — 운전면허 무작위 + 정답 토글 + 프롬프트 보기 + 메트릭 + 이력)
- 두 모드 탭:
  - 🎓 **시험 문제 모드** — `buildExamMessages(question)` (한국어 자격증 시험 prompt)
  - 💬 **자유 프롬프트 모드** — 영상정보관리사 5종 + 일반 평가 4종 프리셋
- 메트릭 카드: TTFT, 전체 latency, 출력 문자/토큰, 추정 비용 (USD + 원), provider request id
- `/api/config` + admin 토글 `lab_hf_enabled` 추가 (기존 lab_*_enabled 패턴 일관성)
- SettingsTab 에 🤗 HF Inference 토글 카드 추가

### 14.4 Phase 3 — 동적 카탈로그 + 풍부한 UI

**문제 발견**: 처음에 hardcoded 7개 모델 목록 (Gemma 4 / Qwen 3.5 / Llama 4) 추측 ID 사용 → `400 model_not_found`. router 의 실제 ID 와 명명 규칙 다름 (예: `Qwen3.5` 가 아니라 `Qwen3` 도 있고, 별도로 `Qwen3.5` 도 있음 — 5종).

**해결**: `router.huggingface.co/v1/models` 직접 fetch → 122 개 검증된 ID 카탈로그 동적 사용:

- `api/_runtime/hf-catalog.js` (신규) — 메모리 캐시 (1h TTL), provider 별 가격/capability 가공
- `api/hf-models.js` (신규) — `GET /api/hf-models`
- `api/hf.js` 화이트리스트 동적 → router 카탈로그 ID 기준
- `lib/models.js` 정적 MODELS 제거 → `calcCost(model 객체)`, `fmtCtx`, `fmtPrice`, `CAPABILITY_META`, `sortModels` helpers
- `components/ModelCatalog.jsx` (신규) — 검색/필터/정렬 + 카드 grid + 펼치기 provider 비교

UI 특징:
- **현재 선택 모델 카드** (큰, 강조) — capability 배지(🖼️Vision · 🔧Tools · 🧠Thinking · 💻Coder · 🌐MoE · 🔊Audio), 컨텍스트, 최저 입력 가격, live provider 수
- **카탈로그 펼치기** — 검색(이름/조직), capability 필터(다중), 정렬(조직/이름/저렴/컨텍스트↓/Provider 수)
- **카드 펼치기** — 그 모델의 모든 provider 별 status/context/in/out 가격/도구 지원
- **캐시 상태 표시** — ⚡ 캐시 hit / 🔄 fresh + 경과 시간

### 14.5 Phase 4a — 비교 모드 (다중 모델 동시 호출)

새 라우트 `/lab/hf/compare`. 같은 프롬프트로 2~6 개 모델 **병렬** (Promise.allSettled) 호출 → 컬럼별 응답 + 자동 분석.

**신규 파일**:
- `lib/comparePresets.js` — 5종 추천 프리셋 + `extractAnswer()` (정규식 기반 정답 추출)
- `HfCompare.jsx` — 비교 메인 (~430 줄)
- `CompareIndex.jsx` — 가드 진입점

**수정**:
- `components/ModelCatalog.jsx` — `mode='multi'` 추가 (체크박스, maxMulti 한도)
- `App.jsx` — `/lab/hf/compare` 라우트 추가
- `HfPlayground.jsx` — 헤더에 "⚖️ 비교 모드" 진입 버튼

**5종 추천 프리셋** (한 클릭으로 4~5 개 모델 자동 선택):

| 프리셋 | 모델 | 목적 |
|---|---|---|
| 🇰🇷 한국어 비교 | Qwen3 32B / Qwen2.5 72B / Aya Expanse 32B / Gemma 4 31B | 한국어 자격증 적합도 |
| 💰 가성비 4종 | Gemma 4 26B/A4B / Llama 4 Scout / Qwen3 8B / Llama 3.1 8B | 운영 비용 최소화 |
| 🧠 추론 강자 | DeepSeek R1 0528 / Qwen3 235B Thinking / Kimi K2 Thinking / Gemma 4 31B | 어려운 시험 문제 |
| ⚡ 빠른 응답 | Gemma 4 26B/A4B / Llama 4 Scout / Qwen3 8B / Qwen3 Next 80B/A3B | 실시간 UX |
| 🏆 최강 4종 | Gemma 4 31B / Qwen3 235B Instruct / Llama 4 Maverick / DeepSeek V4-Pro | 플래그십만 |

**자동 분석**:
- ⚡ 가장 빠른 첫 토큰(TTFT) / 🏁 가장 빠른 완료
- 💰 가장 저렴 / 📏 가장 긴 응답 / 💵 총 비용
- 🎯 정답 일치 (시험 모드, `extractAnswer()` 정규식 — `①~⑤`, `정답: 1번`)

**병렬 호출 흐름**:

```
사용자 → 4개 모델 선택 + "동시 호출"
   ↓
Promise.allSettled([
  hfChat(model: A, onText → updateColumn(A, ...)),
  hfChat(model: B, onText → updateColumn(B, ...)),
  hfChat(model: C, onText → updateColumn(C, ...)),
  hfChat(model: D, onText → updateColumn(D, ...)),
])
   ↓ (각 컬럼 독립 갱신, 다른 컬럼 영향 X)
모두 done → 자동 분석 트리거
```

**Stack 레이아웃** (Phase 4a 우선): 응답 카드를 세로로 쌓되 border 색상으로 상태 표시 (🔄 amber 진행 / ✅ emerald 완료 / ❌ red 에러). Grid/Diff 레이아웃은 Phase 4b 에서.

---

## 15. 라이브 배포 시각 (감사 추적 — REBUILD22 §13~14)

| 시각 (KST) | Build/배포 | SHA tag | 비고 |
|---|---|---|---|
| 2026-04-28 17:36 | 직전 GGUF 라이브 | sha-4094914 | REBUILD22 본문 |
| 2026-04-28 21:23 | HF Phase 1+2 | sha-hf-phase2-* | api/hf.js + lab 페이지 |
| 2026-04-28 21:30 | HF Phase 3 | sha-hf-rev4-dynamic-catalog | 122 모델 동적 |
| 2026-04-28 22:37 | HF Phase 4a | sha-hf-phase4a-compare | 비교 모드 |

옵션 P 인프라 (라우터 Lambda 등) 는 모두 보존 상태 (behavior 비활성). quota 승인 시 옵션 A 즉시 적용 + admin SCP 점검 후 옵션 P 재활성 5분.

---

## 16. 후속 과제 (REBUILD22 §13~14 기준)

### 16.1 외부 대기

- **CloudFront quota 증가 승인** → 옵션 A (`OriginReadTimeout 60→180s`) 즉시 적용
- **AWS Support / admin SCP 점검** → OAC SigV4 mismatch 해결 시 옵션 P 재활성

### 16.2 HF Phase 4b — 평가 + 저장 (계획)

- ⭐ 5점 척도 / 👍/👎 / 메모 / 👑 우승 지정 (각 응답 카드)
- localStorage 즉시 저장 → 새로고침 복원
- JSON / Markdown 내보내기
- 비교 이력 최근 10건 (localStorage)

### 16.3 HF Phase 4c — DB 영속 + 본 서비스 적용 (계획)

- `hf_compare_log` 테이블 신설 (`user_id, prompt_hash, models[], scores{}, winner_id, created_at`)
- admin 평균 점수 대시보드
- "📊 본 서비스 default 모델로 적용" 버튼 → 카드 해설 화면(QuizTab/AiExplanation) 에 HF provider 추가

### 16.4 inference Lambda FUNCTION_MAP 정합성 정리

`api/server-infer.js:19-26` 의 5개 모델 (e2b/e4b/qwen35-4b/e2b-gguf/e4b-gguf) 중 실제 함수 4개, Function URL 보유 2개. 코드와 인프라 불일치 — HF 전환 진행 시 자체 inference 사용 빈도 줄어드니 정리 시점 검토.

---

## 17. 변경 이력 (REBUILD22 §13~14 추가분)

| 날짜 | 변경 |
|---|---|
| 2026-04-28 | §13 504 timeout 진단 + 옵션 P 인프라 구축 (보존) + 옵션 A quota 신청 |
| 2026-04-28 | §14 HF Inference Providers 도입 (Phase 1~4a 라이브) |
| 2026-04-28 | server.js `'server-infer'` 중복 등록 제거 |
| 2026-04-28 | api/_llm/usage.js 에 HF 모델 PRICING + family fallback 추가 |
| 2026-04-28 | api/admin.js ALLOWED_SETTING_KEYS 에 `lab_hf_enabled` 추가 |
| 2026-04-28 | SettingsTab 🧪 실험실 카드에 🤗 HF Inference 토글 추가 |

