# REBUILD21 — Python Lambda Container + ONNX Runtime + Lambda Web Adapter (서버 추론 통합)

작성일: 2026-04-28
범위: workspace/aitutor — REBUILD20 의 Node.js 기반 시도 폐기 + Python 기반 정통 ONNX 추론 환경으로 재구축
선행 문서: REBUILD20 (Node.js 시도 + 호환성 이슈 발견), REBUILD17 (디바이스 추론 + Lab 패턴), REBUILD18 (PROVIDERS / 글로벌 토글), REBUILD19 (보안 / Rate Limit 부재)

---

## 0. TL;DR

REBUILD20 의 Node.js + onnxruntime-node 시도가 **`com.microsoft:CausalConvWithState` op 미지원**으로 실패 확인. 깊이 검토 결과 Python ONNX Runtime 환경에서만 안정적 contrib ops 지원 + Gemma 3n / Gemma 4 모델 카드 검증된 코드 존재. **Python Lambda Container + Lambda Web Adapter (LWA) + FastAPI + uvicorn** 패턴으로 전환하여 진정한 SSE 스트리밍 + ONNX contrib ops + Lambda 인프라 그대로 재활용.

### 핵심 결정 (확정)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 추론 환경 | ✅ **Python 3.12 + ONNX Runtime CPU** |
| 2 | HTTP 서버 | ✅ FastAPI + uvicorn |
| 3 | Lambda Streaming | ✅ Lambda Web Adapter (LWA) sidecar |
| 4 | Function URL | ✅ RESPONSE_STREAM 모드 (LWA 가 chunked 처리) |
| 5 | 호스팅 모델 | Gemma 4 E2B + E4B + Qwen 3.5 4B |
| 6 | 모델 변형 | q4f16 ONNX 전체 (vision/audio encoder 포함) |
| 7 | 인증 | HMAC JWT (메인 auth.js 와 동일 시크릿/형식) |
| 8 | Rate Limit | 4단계 (L1/L2/L3/L4) |
| 9 | DB | psycopg2-binary + 기존 llm_usage_log |
| 10 | Lambda 메모리 | **사용자 콘솔에서 한도 증가 필수** (현재 3008 MB → 10240 MB) |

### Phase 흐름

```
Phase 0 [완료, 30분]:  기존 Node.js 인프라 정리 + 제거 목록 기록
Phase A [4~6시간]:     Python 코드 작성 (Dockerfile + FastAPI + inference)
Phase B [1~2시간]:     CodeBuild 빌드 + ECR push (Q4B 우선)
Phase C [30분]:        Lambda 함수 update + Function URL + 헬스체크
Phase D [1~2시간]:     검증 (추론 / 스트리밍 / Rate Limit)
Phase E [30분]:        Lab 페이지 라이브 (lab_server_ai_enabled=true) — admin/검증 전용

전체: 약 1~1.5일

⚠️ **중요 정책 (2026-04-28 사용자 추가 결정)**:
- 🚫 **자동 폴백 로직 완전 제거** — 디바이스 ❌ 시 서버로 자동 전환 X. AiExplanation/useDeviceAi 본 기능 코드 변경 0
- 🚫 **Thinking 모드 항상 OFF** — Qwen3 / Gemma 의 reasoning 모드 기본 비활성화
- ✅ 서버 추론은 `/lab/server-ai` admin 페이지에서 명시적 직접 호출만
```

---

## 1. REBUILD20 의 발견 + 폐기 이유

### 1.1 발견된 호환성 이슈

REBUILD20 으로 Node.js + transformers.js + onnxruntime-node 기반 Lambda Container 빌드. Q4B 모델 첫 추론 호출 시:

```
Load model from /var/task/model/onnx/decoder_model_merged_q4f16.onnx failed:
Fatal error: com.microsoft:CausalConvWithState(-1) is not a registered function/op
```

### 1.2 근본 원인

`CausalConvWithState` 는 ONNX Runtime 의 **Microsoft contrib op (kMSDomain)**:

| 환경 | contrib ops 지원 |
|---|---|
| onnxruntime-web (WASM, 브라우저) | ✅ 풍부 |
| **Python onnxruntime** | ✅ **풍부** (가장 견고) |
| onnxruntime-node (Native bindings) | ❌ **부분 누락** |
| ORT-Web + WebGPU | ✅ 풍부 |

→ Gemma 3n / Gemma 4 / Qwen 3.5 의 ONNX 변환본은 `kMSDomain` op 사용 — Python 또는 ORT-Web 환경 전제로 만들어짐. Node.js native 환경은 미적용.

### 1.3 검토한 5가지 해결책

| 옵션 | 시간 | 평가 |
|---|---|---|
| 1. transformers.js + WASM backend (Node.js) | 30~60분 | 시도해 볼 가치 있으나 검증 안 됨, 실패 가능성 큼 |
| **2. Python Lambda + ONNX Runtime + LWA** ⭐ | 1~1.5일 | **검증된 모델 카드 코드 + 인프라 재활용** |
| 3. GGUF + node-llama-cpp | 1~2일 | 모델 다시 받음, 멀티모달 제한 |
| 4. SageMaker GPU + PyTorch | 2~3일 | 비용 ↑ ($720/월) |
| 5. 외부 인프라 (Bedrock / Together) | 1일 | 외부 전송, 격리 가치 손실 |

### 1.4 옵션 2 선택 근거

- **검증된 코드**: Gemma 3n 모델 카드의 Python ONNX example 그대로 차용 가능
- **자산 재활용 100%**: S3 모델 / ECR 리포 / Lambda 함수 / IAM / Lab 페이지
- **진짜 SSE 스트리밍**: Lambda Web Adapter + FastAPI + RESPONSE_STREAM
- **메모리 한도 동일**: 어느 옵션이든 Lambda 메모리 증가 필요
- **비용 변동 없음**: Python = Node.js 동일 단가

---

## 2. 사용자 콘솔 작업 (필수)

### 2.1 Lambda 메모리 한도 증가

**현재**: 3008 MB / **목표**: 10240 MB (10 GB)

**바로가기 링크** (서울 리전):
- AWS Service Quotas Lambda: https://ap-northeast-2.console.aws.amazon.com/servicequotas/home/services/lambda/quotas
- Lambda 콘솔: https://ap-northeast-2.console.aws.amazon.com/lambda/home

**절차:**
1. 위 Service Quotas 링크 진입
2. 검색창에 `memory` 입력 → "Maximum memory allocation per function" 또는 유사 항목
3. 또는 **`Concurrent executions`** 한도 (현재 10 → 1000) 도 함께 증가 (REBUILD15 §17.2 이슈 회피)
4. **Request quota increase** 클릭
5. Desired value: `10240` (메모리) / `1000` (동시 실행)
6. 신청 사유: "Production AI inference workload requires larger Lambda memory for ONNX model serving"

**예상 처리 시간**:
- 자동 승인 (수 분~수 시간) 가능성 큼
- 인간 검토 필요 시 1~2 영업일

**한도 증가 전 모델별 가능성** (3008 MB):
- ✅ Qwen 3.5 4B (디스크 2.5GB) — 빠듯하지만 가능
- ⚠️ Gemma 4 E2B (3.2GB) — 매우 빠듯
- ❌ Gemma 4 E4B (4.9GB) — 불가

### 2.2 작업 진행 흐름

```
[즉시] 사용자: 콘솔 한도 증가 신청
[즉시] Claude: Phase 0 (정리) + Phase A (Python 코드) 진행
[1~2시간 후] 한도 승인 → E2B/E4B 까지 가능
[병행] Q4B 부터 빌드/검증 (3008 MB 한도 안)
```

---

## 3. 제거 목록 (Phase 0 — 즉시)

### 3.1 인프라 — 제거

| 항목 | 제거 방법 | 영향 분석 |
|---|---|---|
| Lambda 함수 `aitutor-inference-qwen35-4b` | `aws lambda delete-function` | 메인 aitutor 영향 0 (별도 함수) |
| Function URL (Q4B) | 함수 삭제 시 자동 | Lab 페이지 미배포 상태라 영향 0 |
| ECR 이미지 `aitutor-inference-{e2b/e4b/qwen35-4b}:latest` (Node.js) | `aws ecr batch-delete-image` | 미사용 — 영향 0 |

### 3.2 인프라 — 유지 (재활용)

| 항목 | 재활용 |
|---|---|
| S3 버킷 `aitutor-models-794531974010` (10.8 GB) | ✅ Python 컨테이너에서 동일 모델 사용 |
| ECR 리포 3개 (`aitutor-inference-e2b/e4b/qwen35-4b`) | ✅ 빈 상태로 유지, Python image push |
| IAM Role `aitutor-inference-role` | ✅ 권한 그대로 (Python 동일) |
| `AitutorCodeBuildExtraPolicy` | ✅ S3 read + ECR repo 권한 동일 |
| CodeBuild project `aitutor-inference-build` | ✅ buildspec 만 변경 |

### 3.3 코드 — 제거

| 파일/디렉토리 | 비고 |
|---|---|
| `scripts/inference-handler/` (전체) | Node.js 기반 — 7 파일 |
| `inference-buildspec.yml` | 새 Python buildspec 으로 재작성 |

### 3.4 코드 — 유지

| 파일 | 영향 |
|---|---|
| `src/labs/server-ai/ServerAiTester.jsx` | API URL 동일 |
| `src/labs/server-ai/index.jsx` | 토글 가드 그대로 |
| `src/labs/server-ai/lib/serverInfer.js` | SSE 클라이언트 — Python 응답도 동일 형식 |
| `src/App.jsx` (라우트 추가) | 그대로 |
| `api/usage-log.js` (화이트리스트) | 그대로 |
| `api/config.js` / `api/admin.js` (토글) | 그대로 |

### 3.5 안전 검증 (제거 전 체크리스트)

- ✅ 메인 aitutor Lambda 와 격리 — 별도 함수 제거이므로 영향 0
- ✅ 외부 API (Gemini/OpenAI/Claude) — 무관
- ✅ 디바이스 추론 (WebGPU) — 무관
- ✅ 사용자 트래픽 — Lab 페이지 미배포 + `lab_server_ai_enabled=false` (default)
- ✅ DB / 인증 / 결제 — 무관
- ✅ S3 모델 데이터 — 보존
- ✅ 메인 ECR 리포 (`aitutor`) — 무관

---

## 4. Phase A — Python 코드 작성

### 4.1 디렉토리 구조

```
scripts/inference-handler-py/
  ├─ Dockerfile             # Python 3.12 base + LWA layer
  ├─ requirements.txt       # onnxruntime, transformers, fastapi, uvicorn
  ├─ run.sh                 # uvicorn 시작
  ├─ app.py                 # FastAPI 진입점 + SSE
  ├─ inference.py           # ONNX 4-session 추론 엔진
  ├─ auth.py                # HMAC JWT 검증
  └─ rate_limit.py          # 4단계 한도 (psycopg2)
```

### 4.2 핵심 의존성 (requirements.txt)

```
onnxruntime==1.20.1       # CPU, contrib ops 포함
transformers==4.46.3      # AutoProcessor / AutoConfig
numpy<2.0                 # ORT 호환
fastapi==0.115.6
uvicorn[standard]==0.34.0
psycopg2-binary==2.9.10
boto3==1.35.99
Pillow==11.0.0            # vision_encoder
```

### 4.3 Dockerfile (요약)

```dockerfile
FROM public.ecr.aws/lambda/python:3.12

# Lambda Web Adapter — Function URL RESPONSE_STREAM 변환
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 \
     /lambda-adapter /opt/extensions/lambda-adapter

ARG MODEL_KEY=qwen35-4b
ENV MODEL_KEY=${MODEL_KEY}
ENV PORT=8080
ENV AWS_LWA_INVOKE_MODE=RESPONSE_STREAM
ENV READINESS_CHECK_PATH=/ping

WORKDIR ${LAMBDA_TASK_ROOT}
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py inference.py auth.py rate_limit.py run.sh ./
RUN chmod +x run.sh

# 모델 (CodeBuild 가 S3 → 빌드 컨텍스트로 sync)
COPY model/ /var/task/model/

CMD ["./run.sh"]
```

### 4.4 app.py 핵심 패턴

FastAPI + StreamingResponse 로 SSE 송신. LWA 가 자동으로 chunked → RESPONSE_STREAM 변환.

```python
@app.post("/infer")
async def infer(request: Request):
    auth = verify_auth(request)
    if not auth: raise HTTPException(401)

    limit = check_rate_limit(auth['uid'], MODEL_KEY)
    if limit['exceeded']:
        return StreamingResponse(error_iter(limit), media_type='text/event-stream')

    body = await request.json()
    return StreamingResponse(stream_tokens(body, auth, limit), media_type='text/event-stream')
```

### 4.5 inference.py — Gemma 3n 모델 카드 패턴 차용

4개 ONNX 세션 (vision/audio/embed/decoder) 별도 로드. 모델별 동적 (Qwen 3.5 4B 는 audio 없음).

---

## 5. Phase B — CodeBuild 재구성

### 5.1 inference-buildspec.yml (새로 작성)

```yaml
version: 0.2
env:
  variables:
    MODELS: "qwen35-4b"      # 우선 Q4B, 한도 증가 후 e2b/e4b 추가
    S3_MODEL_BUCKET: "aitutor-models-794531974010"

phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com
      - cd scripts/inference-handler-py

  build:
    commands:
      - |
        for M in $MODELS; do
          REPO_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/aitutor-inference-$M
          rm -rf model
          mkdir -p model
          aws s3 sync s3://${S3_MODEL_BUCKET}/$M/ model/ --quiet
          docker build --build-arg MODEL_KEY=$M -t $REPO_URI:latest .
          docker push $REPO_URI:latest
          docker rmi $REPO_URI:latest 2>/dev/null
          rm -rf model
          docker system prune -f
        done

  post_build:
    commands:
      - echo "Python inference images pushed"
```

### 5.2 빌드 실행

CodeBuild project (`aitutor-inference-build`) 그대로 사용. 환경변수 override 로 MODELS 지정.

---

## 6. Phase C — Lambda 함수 + Function URL

### 6.1 함수 생성 (Q4B 우선)

```bash
# 메모리 한도 안에서 (한도 증가 전): 3008 MB
# 한도 증가 후: 10240 MB

aws lambda create-function \
  --function-name aitutor-inference-qwen35-4b \
  --package-type Image \
  --code ImageUri=794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor-inference-qwen35-4b:latest \
  --role arn:aws:iam::794531974010:role/aitutor-inference-role \
  --memory-size 3008 \
  --timeout 900 \
  --ephemeral-storage Size=4096 \
  --environment file:///tmp/env.json \
  --region ap-northeast-2

# Function URL (RESPONSE_STREAM 모드)
aws lambda create-function-url-config \
  --function-name aitutor-inference-qwen35-4b \
  --auth-type NONE \
  --invoke-mode RESPONSE_STREAM \
  --cors '{"AllowOrigins":["https://d2dcsdi9b1j2rf.cloudfront.net"],"AllowMethods":["POST"],"AllowHeaders":["content-type","authorization"]}' \
  --region ap-northeast-2

# 외부 접근 권한
aws lambda add-permission \
  --function-name aitutor-inference-qwen35-4b \
  --statement-id FunctionURLPublic \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE
```

### 6.2 Function URL Forbidden 대응

REBUILD20 에서 발견된 Function URL 라우팅 propagation 이슈 (REBUILD15 §13 동일):
- 신규 생성 후 ~15분 대기 → 자동 해결 가능
- 안 풀리면 ALB 우회 또는 region 라우팅 재생성
- 본 라운드는 Lambda 직접 invoke (sigv4) 검증 → Function URL 검증 분리

---

## 7. Phase D — 검증 항목

### 7.1 Lambda 직접 invoke (Function URL 우회)

```bash
aws lambda invoke \
  --function-name aitutor-inference-qwen35-4b \
  --payload file:///tmp/test-event.json \
  /tmp/result.txt
```

검증:
- ✅ Python 컨테이너 부팅
- ✅ LWA + uvicorn 시작
- ✅ FastAPI /ping 응답
- ✅ 인증 통과 (uid=7 admin)
- ✅ Rate Limit 통과
- ✅ ONNX 모델 로드 (CausalConvWithState OK)
- ✅ 토큰 단위 SSE 스트리밍
- ✅ usage-log 기록

### 7.2 KPI

| 지표 | 목표 |
|---|---|
| 콜드 스타트 | 15~30 초 (Python + LWA + 모델 로드) |
| 첫 토큰 (warm) | 1~3 초 |
| 전체 응답 (Q4B, 80 토큰) | 8~15 초 |
| 메모리 사용량 (Q4B) | ≤ 3000 MB |
| Rate Limit 정상 동작 | 4단계 모두 |
| 한국어 추론 품질 | 디바이스 추론과 비교 시 90%+ 일치도 |

---

## 8. Phase E — Lab 페이지 라이브 (admin 검증 전용)

### 8.1 메인 Lambda 재배포

이미 작성된 Lab 페이지 + config/admin 토글 + usage-log 화이트리스트 → 메인 Lambda 빌드 + 배포.

### 8.2 Lab 페이지 활성화 (admin 토글)

```bash
# admin 으로 토글 활성화 — admin 만 진입 가능
curl -X POST /api/admin -d 'action=set_setting&key=lab_server_ai_enabled&value=true'
```

### 8.3 라이브 검증 (admin 직접 사용)

`/lab/server-ai` 접속 → 모델 선택 → "추론 시작" → 토큰 스트림 확인.

### 8.4 본 기능(AiExplanation) 통합 — **하지 않음**

- 사용자 정책 (2026-04-28): 자동 폴백 로직 완전 제거
- `useDeviceAi.js` 변경 없음 (디바이스 ❌ 시 기존 흐름 유지)
- `AiExplanation.jsx` 변경 없음 (PROVIDERS 그대로 4개)
- 서버 추론은 admin 이 `/lab/server-ai` 에서 명시적 호출만

---

## 9. 비용 분석

### 9.1 Lambda 가격 (Python = Node.js 동일)

| 모델 | 메모리·시간 비용/회 | 호출 수수료/회 | 합계/회 |
|---|---|---|---|
| Qwen 3.5 4B (3 GB · 12 초) | $0.000601 | $0.0000002 | $0.000601 |
| Gemma 4 E2B (5 GB · 12 초, 한도 증가 후) | $0.001002 | $0.0000002 | $0.001002 |
| Gemma 4 E4B (8 GB · 22 초, 한도 증가 후) | $0.002939 | $0.0000002 | $0.002939 |

### 9.2 월 트래픽 시나리오 (분포: E2B 40% / E4B 30% / Q4B 30%)

| 호출/월 | 합계 |
|---|---|
| 1,000 | $1.36 |
| 5,000 | $6.79 |
| 20,000 | $27.16 |
| 100,000 | $135.8 |

### 9.3 부수 비용

- ECR (3개 컨테이너 ~6 GB Python image) : $0.60/월
- S3 모델 (10.8 GB) : $0.27/월
- CloudWatch Logs : $0.50/월
- **합계 ~$1.4/월**

### 9.4 Rate Limit 적용 시 최대

L3 계정 일 1,000 호출 → 월 30,000 → **최대 ~$45/월**.

---

## 10. 위험 요소 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| **Lambda Web Adapter 첫 도입** | 운영 패턴 학습 | AWS 공식 layer (~2년 검증) + 다른 사례 풍부 |
| **Python ONNX 메모리 ↑** | Q4B 3008 MB 빠듯 | 한도 증가 신청 + Q4B 부터 검증 |
| **Function URL Forbidden** | Lab 페이지 호출 안 됨 | Lambda 직접 invoke 로 우선 검증 + 시간 두고 재시도 / 안 되면 ALB 우회 |
| **콜드 스타트 15~30 초** | 첫 호출 사용자 UX | RESPONSE_STREAM → 첫 토큰 빠름 + "준비 중" UI |
| **4-session 추론 복잡** | 코드 디버깅 | 모델 카드 검증된 코드 차용 |
| **psycopg2 binary 호환** | Lambda x86_64 | `psycopg2-binary` 충분 |
| **Concurrent Executions 한도 10** | 트래픽 폭증 시 throttle | 사용자 콘솔에서 1000 으로 증가 신청 |

---

## 11. 자산 재활용 / 새 작성 정리

### 11.1 100% 재활용

- S3 모델 버킷 (10.8 GB)
- ECR 리포 3개 (이미지만 갱신)
- IAM Role (`aitutor-inference-role`)
- CodeBuild project (buildspec 만 변경)
- 메인 Lambda 측 변경분 (App.jsx, config.js, admin.js, usage-log.js)
- Lab 페이지 (`src/labs/server-ai/`)

### 11.2 폐기 + 새로 작성

| Old (REBUILD20) | New (REBUILD21) |
|---|---|
| `scripts/inference-handler/` (Node.js, 7 파일) | `scripts/inference-handler-py/` (Python, 7 파일) |
| `inference-buildspec.yml` (Node.js Docker) | `inference-buildspec.yml` (Python Docker) |
| `onnxruntime-node` 의존성 | `onnxruntime` (Python) |
| `awslambda.streamifyResponse` | LWA + FastAPI `StreamingResponse` |
| HMAC 2-segment 토큰 | HMAC 3-segment JWT (메인과 동일) |

---

## 12. 작업 진행 순서

```
✅ Phase 0 — 정리 (즉시)
   ├─ Lambda 함수 (qwen35-4b) 삭제
   ├─ ECR 이미지 untag (Node.js)
   ├─ scripts/inference-handler/ 삭제
   └─ inference-buildspec.yml 삭제

🔄 Phase A — Python 코드 작성 (4~6시간)
   ├─ scripts/inference-handler-py/Dockerfile
   ├─ requirements.txt
   ├─ app.py (FastAPI)
   ├─ inference.py (4-session ONNX)
   ├─ auth.py (HMAC 3-segment)
   ├─ rate_limit.py (psycopg2)
   ├─ run.sh
   └─ inference-buildspec.yml (Python 빌드)

⏳ Phase B — 빌드 (1~2시간, 사용자 한도 증가 신청과 병행)
   ├─ zip + S3 업로드
   ├─ CodeBuild start (MODELS=qwen35-4b)
   └─ ECR push 검증

⏳ Phase C — Lambda 함수 (30분)
   ├─ 함수 생성 (3008 MB, 한도 안에서)
   ├─ Function URL + RESPONSE_STREAM
   └─ Reserved Concurrency 5

⏳ Phase D — 검증 (1~2시간)
   ├─ aws lambda invoke 직접 호출
   ├─ Q4B 추론 동작 확인
   ├─ 콜드/Warm 응답 시간 측정
   └─ Rate Limit 4단계 검증

⏳ Phase E — Lab 페이지 활성화 (30분)
   ├─ 메인 Lambda 재배포 (vite build + 새 buildspec)
   ├─ admin 토글 lab_server_ai_enabled=true
   └─ /lab/server-ai 라이브 검증

⏳ Phase F — E2B/E4B 추가 (한도 증가 승인 후)
   ├─ 메모리 5120 MB / 8192 MB Lambda 함수 생성
   ├─ 빌드 + 검증
   └─ Lab 페이지 3개 모델 모두 노출
```

---

## 13. 사용자 콘솔 작업 링크 (요약)

### 13.1 Lambda 메모리 / 동시 실행 한도 증가 (필수)

- 🔗 https://ap-northeast-2.console.aws.amazon.com/servicequotas/home/services/lambda/quotas

신청 항목:
1. **Concurrent executions**: 현재 10 → 1000
2. **Memory limits per function**: 현재 3008 → 10240 MB

### 13.2 Lambda 함수 모니터링

- 🔗 https://ap-northeast-2.console.aws.amazon.com/lambda/home#/functions

### 13.3 CloudWatch Logs (디버깅 시)

- 🔗 https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home#logsV2:log-groups

### 13.4 ECR 이미지 모니터링

- 🔗 https://ap-northeast-2.console.aws.amazon.com/ecr/repositories

---

## 14. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-28 | 최초 작성 — REBUILD20 의 Node.js 시도 폐기 + Python Lambda Container + LWA 패턴 정통 재구축 계획 | Claude Code |
| 2026-04-28 (갱신 1) | **자동 폴백 로직 완전 제거** + **Thinking 모드 OFF 기본** 정책 반영. Phase E 본 통합 → admin Lab 페이지 직접 호출 전용으로 축소 | Claude Code |
| 2026-04-28 (갱신 2) | §16 실제 작업 진행 로그 + 트러블슈팅 6단계 상세 추가 (8h~10h 작업 기록) | Claude Code |

---

## 16. 실제 작업 진행 로그 + 트러블슈팅 (상세)

> 본 섹션은 2026-04-28 실제 진행한 작업의 시간순 기록 + 단계별로 발견한 이슈와 해결 과정을 상세히 정리. 각 시도가 다음 시도의 출발점이 되는 누적 디버깅 흐름.

### 16.1 시간선 요약

| 시각 (KST) | 이벤트 | 결과 |
|---|---|---|
| ~16:30 | REBUILD20 의 Node.js 빌드 → 모델 호환성 발견 → REBUILD21 작성 | Node.js 폐기 결정 |
| ~16:35 | Phase 0 — 기존 인프라 / 코드 정리 | ✅ |
| ~16:40 | Phase A — Python 코드 작성 (8 파일 + Dockerfile + buildspec) | ✅ |
| ~16:50 | Phase B 1차 빌드 (Lambda base + run.sh) | ❌ ENTRYPOINT 충돌 |
| ~17:00 | Phase B 2차 빌드 (python:3.12-slim + uvicorn 직접) | ✅ /ping 성공 |
| ~17:08 | Phase B 3차 빌드 (transformers main) | ❌ qwen3_5 architecture |
| ~17:15 | Phase B 4차 빌드 (AutoConfig 우회) | ❌ TokenizersBackend |
| ~17:25 | Phase B 5차 빌드 (PreTrainedTokenizerFast) | ❌ GatherBlockQuantized |
| ~17:35 | Phase B 6차 빌드 (onnxruntime>=1.22 + thinking OFF) | 🔄 진행 중 |

---

### 16.2 트러블슈팅 #1 — Lambda Container ENTRYPOINT 충돌

**증상**

```
{"errorMessage": "the 'package' argument is required to perform a relative import for '..run'",
 "errorType": "TypeError",
 "stackTrace": ["File \"/var/lang/lib/python3.12/importlib/__init__.py\", line 84, ..."]}
```

**원인 분석**

- 우리 Dockerfile 이 `FROM public.ecr.aws/lambda/python:3.12` (Lambda base image) 사용
- CMD 에 `["./run.sh"]` 로 shell 스크립트 지정
- Lambda base image 의 ENTRYPOINT 가 `/lambda-entrypoint.sh` 로 강제됨
- Lambda runtime 이 CMD 를 **Python 핸들러 경로**로 해석 → `./run.sh` 를 모듈명으로 import 시도 → 실패

**진단 과정**

1. `/ping` 직접 호출 → 즉시 위 에러 (1초)
2. `/infer` 도 동일 에러 → Lambda 부팅 자체 실패 확인
3. AWS LWA 공식 example 검색 → `python:3.12.0-slim-bullseye` 일반 image 사용 발견
4. 결론: Lambda base image 와 LWA 패턴이 충돌 — LWA 가 Lambda runtime 자체를 대체

**해결**

- Dockerfile 변경:
   - Before: `FROM public.ecr.aws/lambda/python:3.12`
   - After: `FROM public.ecr.aws/docker/library/python:3.12-slim-bullseye`
- `run.sh` 제거 (불필요)
- CMD 에 직접 명령:
   - `CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]`
- WORKDIR 변경: `${LAMBDA_TASK_ROOT}` → `/var/task` (일반 image 라 변수 미정의)

**검증 결과**

- `/ping` 호출 → 51초 콜드 + `{"ok": true, "model": "qwen35-4b"}` 반환 ✅
- LWA + FastAPI + uvicorn 정상 부팅 확인

---

### 16.3 트러블슈팅 #2 — transformers Auto-class 매핑 미등록

**증상**

```
data: {"type": "meta", "model": "qwen35-4b", "rate_limit": {...}}
data: {"error": "inference_failed",
       "message": "The checkpoint you are trying to load has model type `qwen3_5`
                   but Transformers does not recognize this architecture.
                   This could be because of an issue with the checkpoint,
                   or because your version of Transformers is out of date."}
```

**원인 분석**

- `transformers==4.46.3` (2024 후반 release) 가 Qwen 3.5 (2026-02 추가) 미지원
- 해결 시도 1: `transformers @ git+main` (transformers 5.x dev) 사용
- 같은 에러 → 추가 검증 (HF discussion 검색):
   - "Value error, Model architectures ['Qwen3_5ForConditionalGeneration'] are not supported for now. Transformers version 5.3.0.dev0"
   - **transformers main 도 Qwen3_5 architecture 매핑 미등록** 확인
- 핵심 이유 — Qwen3.5 의 ONNX 변환본은 `Qwen3_5ForConditionalGeneration` 클래스 사용. transformers main 에 modeling 코드 (`modeling_qwen3_5.py`) 는 있지만 `MODEL_MAPPING` 등록 안 됨

**진단 과정**

1. 처음에 `transformers==4.46.3` 으로 빌드 → 미지원 에러
2. transformers main 으로 변경 시도
3. CodeBuild 로그 검토:
   - 1차 빌드 (00:13): `Successfully installed transformers-4.46.3`
   - 2차 빌드 (00:20): `Cloning https://github.com/huggingface/transformers.git (to revision main)`
   - 두 빌드의 image digest 가 동일 → docker layer cache 의심
4. 사실은 — main 으로 빌드된 image 도 같은 에러 (architecture 미등록)
5. 검색 결과로 `Qwen3_5ForConditionalGeneration is not supported for now` 확인 → main 의 한계 인지

**해결**

- transformers Auto-class 우회 — config.json 직접 파싱
- 변경:
   - Before: `from transformers import AutoConfig, AutoProcessor; config = AutoConfig.from_pretrained(...)`
   - After: `with open('config.json') as f: config_json = json.load(f)`
- text 필드 (text_config 또는 root) 에서 `num_key_value_heads`, `head_dim`, `num_hidden_layers`, `eos_token_id` 직접 추출
- transformers 4.46.3 으로 다운그레이드 (안정성 우선)

**검증 결과**

- `qwen3_5` model_type 에러 해소 → 다음 단계 진입

---

### 16.4 트러블슈팅 #3 — TokenizersBackend 클래스 미지원

**증상**

```
data: {"error": "inference_failed",
       "message": "Tokenizer class TokenizersBackend does not exist
                   or is not currently imported."}
```

**원인 분석**

- `AutoConfig` 우회는 성공했으나 `AutoTokenizer.from_pretrained()` 가 여전히 fail
- Qwen 3.5 4B 의 `tokenizer_config.json` 안:
   ```json
   {
     "tokenizer_class": "TokenizersBackend",
     ...
   }
   ```
- transformers 의 AutoTokenizer 가 이 `tokenizer_class` 필드를 보고 클래스 매핑 시도 → import 실패

**진단 과정**

1. AutoConfig 우회 후 다시 호출 → 새 에러 메시지로 변경됨 (단계 진전)
2. 에러 메시지의 "TokenizersBackend" 가 transformers tokenizer 매핑 dict 에 없음 확인
3. tokenizer_config.json 파일에 `tokenizer_class: TokenizersBackend` 명시 발견
4. 결론: AutoTokenizer 도 architecture-aware 라 우회 필요

**해결**

- AutoTokenizer → PreTrainedTokenizerFast 직접 사용
- PreTrainedTokenizerFast 는 transformers 의 generic class — tokenizer.json 만 있으면 동작 (architecture 매핑 무관)
- 코드 변경:
   ```python
   # Before
   from transformers import AutoTokenizer
   self.tokenizer = AutoTokenizer.from_pretrained(model_dir, trust_remote_code=False)

   # After
   from transformers import PreTrainedTokenizerFast
   tok_cfg = json.load(open('tokenizer_config.json'))
   self.tokenizer = PreTrainedTokenizerFast(
       tokenizer_file=os.path.join(model_dir, 'tokenizer.json'),
       chat_template=tok_cfg.get('chat_template'),
       eos_token=..., bos_token=..., pad_token=...,
       additional_special_tokens=[...],
   )
   ```
- chat_template, special tokens 모두 tokenizer_config.json 에서 직접 추출

**검증 결과**

- TokenizersBackend 에러 해소 → 다음 단계 진입 (또 새 에러)

---

### 16.5 트러블슈팅 #4 — ONNX op 호환성 (CausalConvWithState, GatherBlockQuantized)

**증상 1 (Node.js 시점, REBUILD20)**

```
Fatal error: com.microsoft:CausalConvWithState(-1) is not a registered function/op
```

**증상 2 (Python 시점, 현재)**

```
[ONNXRuntimeError] : 10 : INVALID_GRAPH :
Load model from /var/task/model/onnx/embed_tokens_q4f16.onnx failed:
This is an invalid model. In Node, ("/model/embed_tokens/Gather_Quant",
GatherBlockQuantized, "com.microsoft", -1) :
Error Unrecognized attribute: bits for operator GatherBlockQuantized
```

**원인 분석**

- ONNX 모델 안에 사용된 Microsoft custom ops (`com.microsoft` 도메인):
  1. `CausalConvWithState` — onnxruntime-node 미지원 (Node.js 폐기 원인)
  2. `GatherBlockQuantized` — onnxruntime 1.20.1 (Python) 도 `bits` attribute 미지원
- ONNX op 가 진화함 — 새 attribute (`bits`) 추가됨 → 오래된 onnxruntime 거부
- 우리 `requirements.txt` 의 `onnxruntime==1.20.1` 이 2024년 release. q4f16 quantization 의 신규 op 미지원

**진단 과정**

1. PreTrainedTokenizerFast 로 변경 후 다시 호출 → 또 새로운 ONNX 에러
2. 에러 메시지에서 "Unrecognized attribute: bits" 명확
3. ONNX Runtime release notes 검토 → 1.21+ 부터 q4 quantization 신규 attribute 대응 추정
4. 결론: onnxruntime 버전 업그레이드 필수

**해결 (현재 진행 중)**

- requirements.txt:
   - Before: `onnxruntime==1.20.1`
   - After: `onnxruntime>=1.22.0`
- 동시에 사용자 정책 (Thinking OFF) 도 inference.py 에 적용:
   ```python
   prompt = self.tokenizer.apply_chat_template(
       messages, tokenize=False, add_generation_prompt=True,
       enable_thinking=False,    # Qwen 3.x 계열
       thinking=False,           # 일부 chat_template 의 다른 변수명
   )
   ```
- 6차 빌드 진행 중 (Build ID: `3ee09145...`)

**예상 결과**

- onnxruntime 1.22+ 가 GatherBlockQuantized 의 `bits` attribute 인식 → 모델 로드 성공
- 토큰 생성 + SSE 스트리밍 정상 동작

---

### 16.6 인프라 발견 — 계정 한도 throttling

**현상**

```
$ aws lambda get-account-settings --region ap-northeast-2
{
  "ConcurrentExecutions": 10,         ← default 1000
  ...
}

$ aws lambda create-function --memory-size 10240 ...
ValidationException: 'MemorySize' value failed to satisfy constraint:
  Member must have value less than or equal to 3008
```

**원인**

- AWS 신규/저활용 계정의 throttling
- REBUILD15 §17.2 에서 동일 패턴 확인된 사례
- Service Quotas UI 에서 일부 항목은 "조정 불가" 표시 → AWS Support Center 케이스 필요

**대응 (사용자 콘솔 작업)**

- 🔗 AWS Support Center: https://support.console.aws.amazon.com/support/home#/case/create?issueType=service-limit-increase
- 신청 항목:
  - **Concurrent executions**: 10 → 1000
  - **Function memory**: 3008 MB → 10240 MB
- 사용 사례:
  > "Production AI inference workload — ONNX-based language model serving (Gemma 4 / Qwen 3.5) on Lambda Container Images"
- 예상: 자동 승인 (수 분~수 시간) 또는 1 영업일 내

**임시 운영**

- 한도 증가 전: Q4B (3008 MB 안에서 빠듯하게 가능) 만 우선 검증
- 한도 증가 후: E2B (3.2 GB), E4B (4.9 GB) 추가 가능

---

### 16.7 사용자 정책 변경 (2026-04-28 오전)

#### 변경 1 — 자동 폴백 로직 완전 제거

**원래 계획 (REBUILD21 v1)**:
- 디바이스 ❌ 시 `useDeviceAi.js` 가 자동으로 서버 추론 호출
- `AiExplanation.jsx` 에 ☁️ 배지 + ❌ 모델도 클릭 가능

**변경 후**:
- 자동 폴백 X
- 본 기능 코드 변경 0 (`useDeviceAi.js`, `DeviceAiCard.jsx`, `AiExplanation.jsx` 모두 그대로)
- 서버 추론은 admin `/lab/server-ai` 에서 명시적 직접 호출만

**영향**:
- Phase E 의 코드 수정 작업 폐기
- Lab 페이지 (이미 작성됨) — admin 검증 전용으로 유지

#### 변경 2 — Thinking 모드 OFF 기본

**원래**: 모델 chat template 의 thinking 설정 default

**변경 후**: 항상 OFF 강제
- `inference.py` 의 `apply_chat_template` 호출 시:
   - `enable_thinking=False` (Qwen 3.x 계열)
   - `thinking=False` (일부 다른 chat_template 변수명)
- 미지원 인자 시 fallback (try/except)

**이유**: 사용자가 reasoning 출력 원하지 않음. 빠른 응답 + 깔끔한 해설.

---

### 16.8 누적 빌드 통계

| 빌드 # | 변경 내용 | 빌드 시간 | 결과 |
|---|---|---|---|
| 1 | Lambda base + run.sh | ~3분 | ❌ ENTRYPOINT 충돌 |
| 2 | python:3.12-slim + CMD uvicorn | ~3분 | ✅ /ping OK |
| 3 | transformers @ main | ~5분 (git clone) | ❌ Auto-class 미등록 |
| 4 | AutoConfig 우회 + transformers 4.46.3 | ~3분 | ❌ TokenizersBackend |
| 5 | PreTrainedTokenizerFast | ~3분 | ❌ GatherBlockQuantized |
| 6 | onnxruntime>=1.22 + thinking OFF | 🔄 진행 중 | 검증 대기 |

**누적 시도 시간**: 약 25~30분 (빌드 자체) + 디버깅·코드 수정 시간 별도

**인프라 이미지**:
- Q4B Python 컨테이너: ~2.7~3.1 GB (Lambda Container Image 한도 10 GB 안)
- ECR 누적 이미지: 6개 (lifecycle policy 로 50개 한도까지 자동 정리)

---

### 16.9 누적 자산 변동

| 자산 | 시작 시점 | 현재 |
|---|---|---|
| S3 모델 데이터 | 10.8 GB | 10.8 GB (변경 0) |
| ECR 리포 (e2b/e4b/qwen35-4b) | 빈 상태 | qwen35-4b 만 image 있음 |
| Lambda 함수 | 없음 | aitutor-inference-qwen35-4b (3008 MB) |
| Function URL | 없음 | `https://poxx7qf3h67mlphpdt3xesya7y0gzpzl.lambda-url.ap-northeast-2.on.aws/` |
| IAM Role | 사전 생성 | 그대로 |
| CodeBuild project | aitutor-inference-build | 그대로 (buildspec Python 으로 변경) |
| 코드 디렉토리 | scripts/inference-handler/ (Node.js) | scripts/inference-handler-py/ (Python) |
| Lab 페이지 | 작성됨 (미배포) | 그대로 (변경 0) |

---

### 16.10 다음 단계 (우선순위)

1. **6차 빌드 완료 → /infer 검증** (즉시)
   - onnxruntime 1.22+ 가 GatherBlockQuantized 인식하는지
   - 모델 로드 → 첫 토큰 시간 측정
2. **동작 확정 시** — Q4B 운영 가능 상태 도달
3. **사용자 한도 증가 승인 후** — E2B/E4B 추가
   - 같은 코드베이스로 빌드 (MODEL_KEY override)
   - Lambda 함수 메모리 5120 MB / 8192 MB 로 신규 생성
4. **Lab 페이지 라이브** — 메인 Lambda 재배포
   - vite build (이미 완료된 상태) + zip + S3 + CodeBuild + Lambda update + CloudFront invalidation
   - admin 토글 `lab_server_ai_enabled=true`
5. **검증 완료 후** — 한국어 추론 품질 / 응답 시간 / 비용 측정 → KPI 평가

---

### 16.11 교훈 (다음 프로젝트 참고)

1. **ONNX 모델은 환경 의존성 강함**
   - 변환 시점의 ORT 버전 = 추론 시점의 ORT 버전과 호환되어야 op 인식
   - 모델 카드의 권장 환경 (Python ORT / WebGPU 등) 명시 확인 필수
2. **Lambda Container Image — Lambda base 와 LWA 는 충돌**
   - LWA 사용 시 일반 Python image (`python:3.12-slim`) 권장
   - Lambda base image 는 Lambda runtime + handler 패턴 강제
3. **transformers Auto-class 신규 모델 늦게 등록**
   - modeling 코드는 main 에 있어도 MODEL_MAPPING 등록은 별도 PR
   - ONNX 직접 호출 환경에서는 Auto-class 우회가 안전
4. **PreTrainedTokenizerFast 는 generic — architecture 무관**
   - tokenizer.json + chat_template 만 있으면 동작
   - 신규 모델 tokenizer 호환성 우회의 표준 패턴
5. **CodeBuild docker layer cache**
   - requirements.txt 변경 → 자동 invalidate (다행히)
   - 강제 cache bypass 필요 시 `--no-cache` 옵션
6. **AWS 신규 계정 throttling 주의**
   - 메모리 / 동시 실행 한도 확인 (`aws lambda get-account-settings`)
   - Support Center 케이스가 Service Quotas 보다 확실

## 17. 후속 과제 — 확장성 개선 (B+ → A 등급 목표)

> 본 라운드(REBUILD21) 의 인프라 / 코드 구조에 대한 확장성 진단(2026-04-28) 결과 식별된 개선점. 현재 구조는 같은 family(Gemma/Qwen) 안 모델 추가는 우수, 새 family 도입 / 운영 자동화 측면은 보강 여지 있음. 본 라운드에서는 **변경하지 않고 후속 과제로 기록**.

### 17.1 진단 요약

| 측면 | 현재 등급 | 목표 |
|---|---|---|
| 같은 family 모델 추가 (Gemma 4 N개, Qwen 3.5 N개) | A | 유지 — 코드 변경 0, MODELS 환경변수만 |
| 새 family 추가 (Llama / Phi / Mistral 등) | C | A — family 매핑을 config 로 추출 |
| 인프라 자동화 (ECR / Lambda / Function URL) | B | A — 자동 deploy 스크립트 |
| Lab UI 동적 모델 목록 | C+ | A — `/api/server-models` 엔드포인트 |
| ONNX op 호환성 첫 검증 | C | 변동 어려움 (모델 의존) — 단 빌드 패턴 표준화 |

**종합: 현재 B+ → 5건 개선 시 A 등급**.

### 17.2 후속 과제 5건 (우선순위 순)

#### [후속 1] `/api/server-models` 엔드포인트 — UI 동적 모델 노출
**현재 한계**:
- `src/labs/server-ai/lib/serverInfer.js` 의 `SERVER_MODELS` 객체가 클라이언트 코드에 hardcoded
- 모델 추가 시 프론트 코드 수정 + 메인 Lambda 재배포 필요

**개선안**:
```javascript
// api/server-models.js (NEW)
module.exports = withCors(async (req, res) => {
  const enabled = await getSetting('server_models_enabled', '[]');
  const models = JSON.parse(enabled);
  // 응답: [{key, label, diskGB, expectedSec, family, memorySize}, ...]
  res.json({ models });
});
```
- 모델 목록을 DB(`aitutor_settings`)에서 동적 로드
- 추가 시 admin 콘솔에서 JSON 한 줄 추가 → 즉시 UI 반영
- 인프라 (Lambda 함수 + Function URL) 만 별도 만들면 됨

**예상 작업**: 30분~1시간

#### [후속 2] family 매핑을 config 추출 — 새 family 추가 단순화
**현재 한계**: `inference.py` 의 family 분기 hardcoded
```python
if 'gemma' in mt: self.family = 'gemma4'
elif 'qwen' in mt: self.family = 'qwen3.5'
else: raise ValueError(...)
```

**개선안**:
```python
# scripts/inference-handler-py/family_registry.py (NEW)
FAMILY_REGISTRY = {
    'gemma':   { 'family': 'gemma4',  'sessions': ['embed','decoder','vision','audio'], 'eos': 106 },
    'qwen':    { 'family': 'qwen3.5', 'sessions': ['embed','decoder','vision'],         'eos': None },
    'llama':   { 'family': 'llama',   'sessions': ['decoder'],                          'eos': None },
    'phi':     { 'family': 'phi',     'sessions': ['decoder'],                          'eos': None },
    # 새 family 추가 시 여기 한 줄만
}
```
- 새 family 도입 = 등록만, inference.py 코드 변경 없음
- session 구조 (몇 개 + 어떤 종류) 도 config

**예상 작업**: 1~2시간

#### [후속 3] 자동 deploy 스크립트 — 모델 추가 = 한 명령
**현재 한계**: 새 모델 추가 시 수동 명령 8단계 필요
1. S3 모델 업로드 / 2. CodeBuild start / 3. ECR push 검증 / 4. Lambda 함수 생성 / 5. Function URL / 6. Reserved Concurrency / 7. CloudFront 라우팅 / 8. UI 매핑

**개선안**:
```bash
# scripts/deploy-inference-model.sh
./deploy-inference-model.sh \
  --model-key gemma4-9b \
  --hf-id onnx-community/gemma-4-9B-it-ONNX \
  --memory 8192 \
  --family gemma
```
- HF 다운로드 → S3 → CodeBuild → ECR → Lambda → Function URL → CORS → admin 토글 모두 자동
- idempotent (재실행 안전)
- 실패 시 cleanup

**예상 작업**: 2~3시간

#### [후속 4] CloudFront path-based 자동 라우팅
**현재 한계**: Function URL 직접 호출 — 도메인 분리, CORS 설정 매번
- 클라이언트 fetch URL = `https://poxx7qf3h67mlphpdt3xesya7y0gzpzl.lambda-url.ap-northeast-2.on.aws/`
- 모델 추가 = Function URL 발급 + UI 의 URL 매핑 갱신

**개선안**:
- CloudFront 에 `/api/server-infer/{model}/*` 경로 라우팅
- Origin 추가 (Function URL) + Cache Behavior 매핑
- 클라이언트 fetch URL = `/api/server-infer/qwen35-4b` (same-origin)
- CORS 불필요, 토큰 cookie 자동 전달

**예상 작업**: 3~4시간 (CloudFront update-distribution 복잡도)

#### [후속 5] ONNX op 호환성 빌드 패턴 표준화
**현재 한계**: 모델별 첫 빌드 시 ONNX op 미지원 발견 → 빌드 5~6번 반복
- REBUILD21 §16 의 트러블슈팅 #4 참고

**개선안**:
- `scripts/inference-handler-py/check_compat.py` (NEW) — ONNX 모델 사전 검증
   - InferenceSession 로드 시도 → op 미지원 즉시 감지
   - GitHub Actions 또는 로컬 사전 실행
- 표준 onnxruntime 버전 / contrib op / extensions 패키지 명세 문서화 (`docs/onnx-compat-matrix.md`)
- 새 모델 도입 시 first build 전 호환성 체크

**예상 작업**: 2시간 + 모델 추가 시마다 표 갱신

### 17.3 우선순위 + 트리거 조건

| 후속 | 트리거 |
|---|---|
| [후속 1] `/api/server-models` | 모델 N개(>5) 운영 시 UI 관리 부담 |
| [후속 2] family 매핑 추출 | 새 family (Llama / Phi 등) 첫 도입 직전 |
| [후속 3] 자동 deploy 스크립트 | 빈번한 모델 변경 / 신규 추가 시 |
| [후속 4] CloudFront 라우팅 | Function URL CORS / 도메인 관리 부담 누적 |
| [후속 5] 호환성 검증 | 새 모델 첫 도입 시 매번 (트러블 누적 시) |

→ 본 라운드(REBUILD21) 검증 완료 후, 운영 데이터 누적 + 새 요구사항 발생 시점에 우선순위 재검토.

---

## 15. 부록 — 참고 자료

### 15.1 외부

- [AWS Lambda Web Adapter (GitHub)](https://github.com/awslabs/aws-lambda-web-adapter)
- [Lambda Response Streaming (Python via LWA)](https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/)
- [Gemma 3n E2B ONNX 모델 카드 (Python example)](https://huggingface.co/onnx-community/gemma-3n-E2B-it-ONNX)
- [ONNX Runtime contrib operators](https://onnxruntime.ai/docs/reference/operators/ContribOperators.html)
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)

### 15.2 내부

- REBUILD15 §13 — Function URL 라우팅 propagation 이슈
- REBUILD17 §13 — `/lab/local-ai` 격리 모듈 패턴 (본 라운드 차용)
- REBUILD18 §11 — 글로벌 토글 + admin 화이트리스트
- REBUILD19 §1.1 — Rate Limit 부재 (본 라운드 §6 B.2 에서 해결)
- REBUILD20 — Node.js 시도 + 호환성 발견 (본 라운드의 출발점)
