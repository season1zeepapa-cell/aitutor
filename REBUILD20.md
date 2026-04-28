# REBUILD20 — WebGPU 한계 돌파: Lambda Container CPU 추론 + RESPONSE_STREAM

작성일: 2026-04-28
범위: workspace/aitutor — 디바이스 GPU 메모리 한계로 큰 로컬 모델을 못 쓰는 사용자에게 서버 사이드 ONNX 추론을 자동 폴백 제공
선행 문서: REBUILD15 (Lambda RESPONSE_STREAM 모드 도입), REBUILD17 (4 모델 시범 + Lab 패턴), REBUILD18 (PROVIDERS 4번째 + 글로벌 토글), REBUILD19 (보안·dead code 감사 + Rate Limit 부재)

---

## 0. TL;DR

PWA 환경에서 디바이스 WebGPU 한계와 무관하게 **3개 큰 모델**(Gemma 4 E2B/E4B + Qwen 3.5 4B)을 모든 사용자가 사용할 수 있도록 **별도 Lambda Container 함수(`aitutor-inference`)에 onnxruntime-node + RESPONSE_STREAM** 모드로 추론. **현행 디바이스 추론은 그대로 유지**. **Lab 시범 페이지(`/lab/server-ai`)로 1차 검증** 후 본 기능 통합. 비용 폭증 방지 위해 **4단계 Rate Limit** 적용.

### 사용자 확정 결정 (2026-04-28)

| # | 항목 | 결정 |
|---|---|---|
| 1 | **현행 디바이스 추론** | ✅ 5개 모델 그대로 유지 (변경 없음) |
| 2 | **서버 추론 추가 모델** | ✅ Gemma 4 E2B + E4B + Qwen 3.5 4B (3개) |
| 3 | **출시 전략** | ✅ `/lab/server-ai` 시범 → 검증 → 본 통합 (REBUILD17→18 패턴) |
| 4 | **인프라** | ✅ **AWS Lambda Container** (메모리 10GB) — **SageMaker 사용 안 함** |
| 5 | **응답 방식** | ✅ Lambda RESPONSE_STREAM (REBUILD15 기존 패턴 활용) |
| 6 | 모델 변형 | q4f16 변형 전체 (vision/audio encoder 포함) |
| 7 | **Rate Limit** | ✅ 4단계 방어 (L1 사용자/L2 모델/L3 계정/L4 동시성) |
| 8 | 사용자 동의 | 디바이스 ❌ 시 자동 폴백 + UI 배지로 명시 |

### Lambda 선택 근거 (vs SageMaker Serverless)

| 항목 | Lambda Container ⭐ | SageMaker Serverless |
|---|---|---|
| 응답 timeout | 15분 | 60초 ⚠️ |
| 응답 스트리밍 | RESPONSE_STREAM ✅ | ❌ (가짜만) |
| 메모리 한도 | 10 GB | 6 GB |
| 콜드 스타트 | 5~15초 | 30~60초 |
| 첫 토큰 (warm) | 1~3초 | 5~10초 wait |
| 운영 통합 | 네이티브 (이미 사용 중) | 별도 endpoint |

→ 모든 핵심 항목에서 Lambda 우위.

### 단계적 출시 (5 Phase)

```
Phase A [3~4일]:  인프라 — aitutor-inference Lambda + ECR + IAM
Phase B [3~4일]:  백엔드 — RESPONSE_STREAM 핸들러 + Rate Limit
Phase C [3~4일]:  Lab 시범 — /lab/server-ai 페이지 (격리 모듈)
Phase D [상시]:   검증 — Lab 에서 정확성 / 응답 시간 / 비용
Phase E [2~3일]:  본 통합 — useDeviceAi.js ❌ 분기 자동 폴백

전체: 약 2주
```

---

## 1. 배경

### 1.1 현재 한계

REBUILD17/18 로 5개 로컬 모델 등록 + WebGPU 추론 + 자동 활성화 카드 완성. 그러나 사용자 디바이스의 GPU 메모리 한계로:

| 디바이스 환경 | WebGPU 한계 | 사용 가능 모델 |
|---|---|---|
| 모바일 (스마트폰) | ~2 GB | Qwen 3.5 0.8B 만 |
| 노트북 (통합 GPU) | ~4 GB | + Qwen 3.5 2B |
| 데스크탑 (외장 GPU) | 6 GB+ | + 4B / E2B / E4B |

→ 사용자 약 60~70% 가 4B 이상 모델 ❌. 한국어 품질 강한 큰 모델 사용 불가.

### 1.2 Lambda RESPONSE_STREAM 활용

REBUILD15 에서 이미 Lambda Function URL 의 RESPONSE_STREAM 모드 도입 완료. 해당 패턴을 추론 함수에도 그대로 적용 — 새로운 인프라 학습 비용 없음.

### 1.3 Lab 시범 → 본 통합 패턴

REBUILD17 의 `/lab/local-ai` 시범 → REBUILD18 본 기능 통합 패턴 동일:

- `/lab/server-ai` 신설 (관리자/검증용)
- 격리 모듈 — 본 기능에 영향 0
- 정확성·응답 시간·비용 검증
- 검증 통과 후 `useDeviceAi.js` ❌ 분기에 자동 폴백 통합

---

## 2. 목표

### 2.1 사용자 경험 목표

- ✅ 현행 디바이스 추론 5개 모델 그대로 유지 (회귀 0)
- ✅ 디바이스 ❌ 사용자도 큰 모델 (E2B / E4B / Qwen 4B) 사용 가능
- ✅ 첫 토큰 1~3초 이내 (warm), 콜드 스타트 5~15초 이내
- ✅ 토큰 단위 SSE 스트리밍 (외부 API 와 동일 UX)

### 2.2 운영 목표

- ✅ Lab 시범에서 1차 검증 (격리 환경)
- ✅ 사용량 기반 과금 (idle 시 0)
- ✅ Rate Limit 으로 비용 폭증 방지
- ✅ 비용·지연·정확성 가시화 (REBUILD16 §8.8 llm_usage_log 활용)

### 2.3 비기능 목표

- 데이터 격리: 사용자 학습 내용이 우리 AWS 계정 안에서만 처리
- 회귀 0: 기존 외부 3개 + 디바이스 추론 동작 무관
- 코드 격리: Lab 단계에서는 본 기능 절대 수정 X

---

## 3. 아키텍처

### 3.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ 사용자 디바이스 / Lab 페이지                                       │
├─────────────────────────────────────────────────────────────────┤
│  Lab: /lab/server-ai (NEW)                                       │
│  본: AiExplanation.jsx (Phase E 후)                              │
│     │ POST /api/server-infer                                    │
│     ↓                                                            │
│  CloudFront (E2MP4BK1D16LJN)                                     │
│     ├─ /api/server-infer/* → aitutor-inference (NEW)            │
│     └─ /* → aitutor (메인, 기존)                                 │
└─────┼────────────────────────────────────────────────────────────┘
      │
      ↓ RESPONSE_STREAM 모드
┌─────────────────────────────────────────────────────────────────┐
│ Lambda: aitutor-inference (NEW)                                  │
├─────────────────────────────────────────────────────────────────┤
│  Memory: 10240 MB (10 GB)                                        │
│  Timeout: 900s (15분)                                            │
│  Reserved Concurrency: 5 (L4 한도)                              │
│  Function URL: RESPONSE_STREAM                                   │
│     │                                                            │
│  inference-handler.js                                            │
│     ├─ 1. Auth (HMAC 토큰 검증)                                  │
│     ├─ 2. Rate Limit (L1+L2+L3) 검증                            │
│     ├─ 3. 모델 lazy 로드 (S3 → /tmp 캐시)                        │
│     ├─ 4. transformers.js 로 추론                                │
│     └─ 5. SSE 토큰 스트리밍 응답                                  │
└─────┼────────────────────────────────────────────────────────────┘
      │
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ S3 모델 저장소 (이미 완료)                                          │
│  s3://aitutor-models-794531974010/                               │
│   ├─ qwen35-4b/   (2.8 GB · 13 파일)                            │
│   ├─ gemma4-e2b/  (3.2 GB · 14 파일)                            │
│   └─ gemma4-e4b/  (4.8 GB · 15 파일)                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Lambda Container 동작 모델

```
요청 도착
   │
   │ Lambda 컨테이너 cold? → 5~15초 부팅
   │ Lambda 컨테이너 warm? → 즉시
   ↓
init: 모델 로드 (첫 호출만)
   │ S3 → /tmp 다운로드 또는 EFS 마운트 또는 컨테이너 내장
   │ 약 5~30초 (모델 사이즈)
   ↓
RESPONSE_STREAM 시작
   │ 첫 토큰 즉시 송신 (1~3초)
   │ onnxruntime-node 추론 (10GB 메모리 → 6 vCPU)
   ↓
토큰 단위 SSE 스트리밍
   │ E2B: 8~15초 전체
   │ E4B: 15~30초 전체
   │ Qwen 4B: 8~15초 전체
   ↓
완료 → idle → 약 5~10분 후 컨테이너 자동 종료
```

### 3.3 모델 호스팅 패턴 — 3가지 옵션

| 패턴 | 콜드 스타트 | 비용 | 운영 |
|---|---|---|---|
| **컨테이너 이미지 내장** | 5~15초 | ECR 사이즈 ↑ | 단순 |
| **S3 → /tmp 다운로드 (lazy)** | 30~60초 (첫 호출) | S3 트래픽 ↑ | 중 |
| **EFS 마운트** | 5~10초 | EFS 비용 + VPC 필요 | 복잡 |

**권장: 모델별 별도 ECR 이미지 (컨테이너 내장)**

3개 함수 분리:
- `aitutor-inference-e2b` (이미지 ~3.5 GB)
- `aitutor-inference-e4b` (이미지 ~5.2 GB)
- `aitutor-inference-qwen35-4b` (이미지 ~3 GB)

장점:
- 콜드 스타트 짧음 (5~15초)
- 각 함수 독립적 Reserved Concurrency
- 모델별 독립 배포

단점:
- ECR 사이즈 합 ~12 GB (월 ~$1.2)

---

## 4. 영향도 분석

### 4.1 현행 시스템 영향 — Lab 단계 0, 본 통합 단계 최소

| 영역 | Lab 단계 | 본 통합 단계 |
|---|---|---|
| 외부 API (Gemini/OpenAI/Claude) | ✅ 영향 0 | ✅ 영향 0 |
| 디바이스 WebGPU 추론 (5개 모델) | ✅ 영향 0 | ✅ 영향 0 |
| 메인 Lambda (aitutor) | ✅ 영향 0 | ✅ 영향 0 (CloudFront 라우팅만 추가) |
| `useDeviceAi.js` | ✅ 영향 0 | ⚠️ 폴백 분기 추가 |
| `inference.js` (디바이스 추론) | ✅ 영향 0 | ✅ 영향 0 |
| DB 스키마 | ✅ 영향 0 | ⚠️ provider='local-{size}' 그대로 사용 (변경 0) |

### 4.2 신규 추가 영역

- **Lambda 함수**: `aitutor-inference-{e2b|e4b|qwen35-4b}` × 3
- **ECR 리포**: `aitutor-inference-{e2b|e4b|qwen35-4b}` × 3
- **IAM Role**: `aitutor-inference-role` (S3 read + CloudWatch Logs)
- **CloudFront**: 라우팅 규칙 추가 (`/api/server-infer/*` → inference Function URL)
- **CloudWatch Logs**: 함수별 로그 그룹 3개
- **Frontend Lab 페이지**: `/lab/server-ai` 신규 (격리)
- **DB 추가**: Rate Limit 카운터 (llm_usage_log 활용 또는 별도 테이블)

### 4.3 ECR / S3 사이즈 영향

이미 완료:
- S3 모델 버킷: 10.8 GiB (3개 모델 q4f16 변형 전체)

신규:
- ECR `aitutor-inference-*` × 3 = 약 12 GB
- 월 비용: ~$1.2 (ECR + S3)

---

## 5. 비용 분석

### 5.1 Lambda 가격 (ap-northeast-2, 2026-04 기준)

| 항목 | 단가 |
|---|---|
| 메모리·시간 | $0.0000167 / GB-second |
| 호출 수수료 | $0.20 / 1M 호출 |
| Function URL Data Transfer Out | $0.09 / GB (인터넷) |
| ECR 저장 | $0.10 / GB / 월 |
| CloudWatch Logs | $0.50 / GB ingestion |

### 5.2 모델별 호출당 비용 (메모리 10 GB 기준)

| 모델 | 추론 시간 (warm) | 메모리·시간 비용 | 호출 비용 (1/1M) | 합계/회 |
|---|---|---|---|---|
| Gemma 4 E2B | 12 초 | $0.00200 | $0.0000002 | $0.00200 |
| Gemma 4 E4B | 22 초 | $0.00367 | $0.0000002 | $0.00367 |
| Qwen 3.5 4B | 12 초 | $0.00200 | $0.0000002 | $0.00200 |

### 5.3 트래픽 시나리오별 월 비용

가정: 분포 — Gemma 4 E2B 40% / E4B 30% / Qwen 4B 30%

| 호출 수/월 | E2B | E4B | Qwen 4B | Lambda 합계 |
|---|---|---|---|---|
| 1,000 | $0.80 | $1.10 | $0.60 | **$2.50** |
| 5,000 | $4.00 | $5.51 | $3.00 | **$12.51** |
| 20,000 | $16.0 | $22.0 | $12.0 | **$50.0** |
| 100,000 | $80.0 | $110 | $60.0 | **$250** |

### 5.4 부수 비용

| 항목 | 단가 | 가정 | 월 비용 |
|---|---|---|---|
| ECR 저장 (3개 함수 ~12GB) | $0.10/GB | 12GB | $1.20 |
| S3 모델 저장 (~11GB) | $0.025/GB | 11GB | $0.28 |
| CloudWatch Logs | $0.50/GB | 1GB | $0.50 |
| Data Transfer Out | $0.09/GB | 5GB | $0.45 |
| **부수 합계** | | | **~$2.43/월** |

### 5.5 종합 월 비용 + Rate Limit 적용

Rate Limit 없을 때 (이론적 최대):
| 트래픽 | Lambda | 부수 | 종합 |
|---|---|---|---|
| 1,000 | $2.50 | $2.43 | **$4.93** |
| 5,000 | $12.51 | $2.43 | **$14.94** |
| 20,000 | $50.0 | $2.43 | **$52.4** |
| 100,000 | $250 | $2.43 | **$252** |

Rate Limit 적용 시 (L3 계정 일 1,000 = 월 30,000 호출 천장):
- 최대 월 비용 ≈ **$77** (30,000 호출 × $0.0026 평균)

→ **비용 폭증 절대 불가**.

---

## 6. Phase 단계별 계획

### Phase A — 인프라 (3~4일)

**A.1 S3 모델 버킷** ✅ 이미 완료 (2026-04-28)
- 버킷: `aitutor-models-794531974010`
- 3개 모델 q4f16 변형 전체 업로드 완료
- 합 10.8 GiB

**A.2 IAM Role 생성 (Day 1)**
```bash
aws iam create-role --role-name aitutor-inference-role \
  --assume-role-policy-document '{...}'  # Lambda 신뢰 정책

# S3 read
aws iam put-role-policy --role-name aitutor-inference-role \
  --policy-name S3ModelRead \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":["s3:GetObject","s3:ListBucket"],
      "Resource":["arn:aws:s3:::aitutor-models-794531974010","arn:aws:s3:::aitutor-models-794531974010/*"]
    }]
  }'

# CloudWatch Logs
aws iam attach-role-policy --role-name aitutor-inference-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

**A.3 ECR 리포 + Container 이미지 빌드 (Day 2~3)**

`scripts/inference-handler/Dockerfile`:
```dockerfile
FROM public.ecr.aws/lambda/nodejs:22

ENV MODEL_KEY=qwen35-4b
ENV MODEL_PATH=/var/task/model

WORKDIR ${LAMBDA_TASK_ROOT}

# transformers.js + onnxruntime-node
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# 모델 데이터 (빌드 시 S3 → 컨테이너 내장)
RUN mkdir -p ${MODEL_PATH} && \
    aws s3 sync s3://aitutor-models-794531974010/${MODEL_KEY}/ ${MODEL_PATH}/

# 핸들러
COPY inference-handler.js ./

CMD ["inference-handler.handler"]
```

`scripts/inference-handler/inference-handler.js`:
```javascript
import { AutoTokenizer, AutoProcessor } from '@huggingface/transformers';
// ... family 별 분기 (Gemma4ForConditionalGeneration / Qwen3_5ForConditionalGeneration)

let pipe = null;

export const handler = awslambda.streamifyResponse(async (event, responseStream, context) => {
  const start = Date.now();

  try {
    // 1. Auth
    const auth = await verifyAuth(event);
    if (!auth) {
      responseStream.setContentType('application/json');
      responseStream.write(JSON.stringify({ error: 'unauthorized' }));
      return responseStream.end();
    }

    // 2. Rate Limit
    const limit = await checkRateLimit(auth.user_id, MODEL_KEY);
    if (limit.exceeded) {
      responseStream.setContentType('application/json');
      responseStream.write(JSON.stringify({
        error: 'rate_limit_exceeded', reason: limit.reason, resetAt: limit.resetAt,
      }));
      return responseStream.end();
    }

    // 3. 모델 lazy 로드 (첫 호출만)
    if (!pipe) {
      pipe = await loadPipe(MODEL_PATH);
    }

    // 4. SSE 헤더 + 토큰 스트리밍
    responseStream.setContentType('text/event-stream');
    const body = JSON.parse(event.body);
    const result = await explainQuestion(pipe, body, {
      onToken: (t) => {
        responseStream.write(`data: ${JSON.stringify({ token: t })}\n\n`);
      },
    });
    responseStream.write(`data: [DONE]\n\n`);
    responseStream.end();

    // 5. usage-log
    await logUsage({
      user_id: auth.user_id,
      provider: `local-${MODEL_KEY}`,
      action: 'card_explain_server',
      latency_ms: Date.now() - start,
    });
  } catch (e) {
    responseStream.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    responseStream.end();
  }
});
```

ECR 리포 + 빌드:
```bash
for MODEL in e2b e4b qwen35-4b; do
  aws ecr create-repository --repository-name aitutor-inference-${MODEL}
  docker build --build-arg MODEL_KEY=${MODEL} \
    -t aitutor-inference-${MODEL}:latest scripts/inference-handler/
  docker tag aitutor-inference-${MODEL}:latest \
    794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor-inference-${MODEL}:latest
  docker push \
    794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor-inference-${MODEL}:latest
done
```

**A.4 Lambda 함수 × 3 생성 (Day 3)**
```bash
for MODEL in e2b e4b qwen35-4b; do
  aws lambda create-function \
    --function-name aitutor-inference-${MODEL} \
    --package-type Image \
    --code ImageUri=794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor-inference-${MODEL}:latest \
    --role arn:aws:iam::794531974010:role/aitutor-inference-role \
    --memory-size 10240 \
    --timeout 900 \
    --region ap-northeast-2

  # Reserved Concurrency (L4 — 동시 5개)
  aws lambda put-function-concurrency \
    --function-name aitutor-inference-${MODEL} \
    --reserved-concurrent-executions 5

  # Function URL with RESPONSE_STREAM
  aws lambda create-function-url-config \
    --function-name aitutor-inference-${MODEL} \
    --auth-type NONE \
    --invoke-mode RESPONSE_STREAM
done
```

**A.5 CloudFront 라우팅 추가 (Day 4)**
- 새 origin: `aitutor-inference-{model}` Function URL × 3
- Cache Behavior: `/api/server-infer/{model}/*` → 해당 inference Function URL
- 또는 단일 라우터: `/api/server-infer/*` → inference 라우터 함수 (모델 키 query/body로 분기)

**A.6 헬스 체크 (Day 4)**
- 각 함수 첫 호출 (콜드 스타트 시간 측정)
- 디바이스 추론 결과와 비교 (한국어 5개 해설)
- E4B 메모리 OOM 검증 (10GB 안에 들어가는지)

### Phase B — 백엔드 (3~4일)

**B.1 인증 헬퍼 — Lambda 측**
```javascript
// scripts/inference-handler/auth.js
async function verifyAuth(event) {
  const cookie = event.cookies?.find(c => c.startsWith('auth_token=')) || '';
  const token = cookie.split('=')[1];
  if (!token) return null;
  // HMAC 검증 (메인 Lambda 와 동일 시크릿)
  // ...
}
```

**B.2 Rate Limit 4단계 (이번 라운드 핵심)**

`api/_lib/rate-limit.js` (메인 Lambda — 또는 inference Lambda 안에서 직접 DB 호출):
```javascript
const LIMITS = {
  user_daily:     parseInt(process.env.RL_USER_DAILY ?? '30'),
  user_e4b_daily: parseInt(process.env.RL_USER_E4B_DAILY ?? '10'),
  user_other_daily: parseInt(process.env.RL_USER_OTHER_DAILY ?? '30'),
  account_daily:  parseInt(process.env.RL_ACCOUNT_DAILY ?? '1000'),
};

export async function checkRateLimit(userId, modelKey) {
  const today = new Date().toISOString().slice(0,10);

  // L1: 사용자 전체
  const userTotal = await db.query(
    `SELECT COUNT(*) FROM llm_usage_log WHERE user_id=$1 AND DATE(created_at)=$2 AND provider LIKE 'local-%'`,
    [userId, today]
  );
  if (userTotal.rows[0].count >= LIMITS.user_daily) {
    return { exceeded: true, reason: 'user_daily_limit', resetAt: nextMidnight() };
  }

  // L2: 사용자 × 모델
  const modelLimit = modelKey === 'e4b' ? LIMITS.user_e4b_daily : LIMITS.user_other_daily;
  const userModel = await db.query(
    `SELECT COUNT(*) FROM llm_usage_log WHERE user_id=$1 AND DATE(created_at)=$2 AND provider=$3`,
    [userId, today, `local-${modelKey}`]
  );
  if (userModel.rows[0].count >= modelLimit) {
    return { exceeded: true, reason: 'user_model_limit', resetAt: nextMidnight() };
  }

  // L3: 계정 전체
  const accountTotal = await db.query(
    `SELECT COUNT(*) FROM llm_usage_log WHERE DATE(created_at)=$1 AND provider LIKE 'local-%'`,
    [today]
  );
  if (accountTotal.rows[0].count >= LIMITS.account_daily) {
    // 자동으로 'local' 토글 OFF (REBUILD18 글로벌 토글 활용)
    await db.query(`INSERT INTO aitutor_settings(key,value) VALUES('provider_local_enabled','false') ON CONFLICT DO UPDATE`);
    return { exceeded: true, reason: 'account_daily_limit', resetAt: nextMidnight() };
  }

  return { exceeded: false };
}
```

L4 — Lambda Reserved Concurrency (인프라 단계에서 설정 끝)

**B.3 메인 Lambda 측 — 라우팅 (CloudFront 패턴 시 불필요)**

만약 CloudFront 가 직접 inference Lambda 라우팅하면 메인 Lambda 변경 0.

**B.4 usage-log 확장**
- 액션 'card_explain_server' 화이트리스트 추가
- 실패 케이스도 기록 (provider='local-{key}-failed')

**B.5 백엔드 단위 검증**
- `curl -X POST` Function URL 직접 호출
- 콜드 스타트 / warm 응답 시간
- SSE 토큰 도착 확인
- Rate Limit 도달 시 429 응답

### Phase C — Lab 시범 페이지 (3~4일)

**C.1 디렉토리 구조**
```
src/labs/server-ai/
  ├─ ServerAiTester.jsx        # 메인 페이지
  ├─ components/
  │   ├─ ModelPicker.jsx       # 3개 모델 선택
  │   ├─ PromptInput.jsx       # 문제 입력
  │   ├─ StreamView.jsx        # SSE 토큰 표시
  │   ├─ ComparisonPanel.jsx   # 디바이스 vs 서버 비교
  │   ├─ MetricsCard.jsx       # 응답 시간 / 토큰 수 / 비용
  │   └─ RateLimitStatus.jsx   # 한도 잔여 표시
  └─ lib/
      └─ serverInfer.js        # 서버 호출 (SSE 파싱)
```

**C.2 라우팅 추가**
- `App.jsx` 에 `/lab/server-ai` 경로 추가
- 관리자 권한만 접근 (REBUILD18 admin 패턴)

**C.3 검증 기능**
- 같은 문제로 디바이스 + 서버 추론 결과 비교
- 응답 시간 측정 (콜드 / warm)
- 토큰 수 / 응답 길이
- 호출당 비용 추정
- 잔여 Rate Limit 표시

**C.4 본 기능과 격리**
- `useDeviceAi.js` import 안 함
- `AiExplanation.jsx` 영향 0
- 메뉴에서 별도 진입점

### Phase D — 검증 (Lab 1~2주 운영)

**D.1 정량 KPI**
| 지표 | 목표 |
|---|---|
| 디바이스 vs 서버 응답 일치도 | 95%+ |
| 평균 첫 토큰 (warm) | 3초 이내 |
| 콜드 스타트 (init) | 15초 이내 |
| Lambda 5xx 에러율 | 1% 이내 |
| E4B OOM 에러율 | 5% 이내 |
| 호출당 평균 비용 | $0.003 이내 |
| Rate Limit 도달률 | < 5% (정상 사용 시) |

**D.2 정성 검증**
- 한국어 해설 품질 (디바이스와 비교)
- 보기별 해설 형식 (REBUILD17 §13.16)
- 「법령명」 인용 패턴

**D.3 운영 지표**
- 일별 호출 분포
- 모델별 사용 비율
- 평균 응답 시간 추이
- 비용 일일 누적

### Phase E — 본 통합 (2~3일)

**E.1 `useDeviceAi.js` 수정**
```javascript
const SERVER_FALLBACK_SIZES = ['e2b', 'e4b', 'qwen35-4b'];

const generate = useCallback(async ({ question, onToken, ... }) => {
  // 디바이스 ✅ → 기존 흐름
  if (device?.supported && verdicts[activeSize]?.ok === true) {
    return await deviceInference(...);
  }

  // 서버 폴백 가능한 모델
  if (SERVER_FALLBACK_SIZES.includes(activeSize || preferredSize)) {
    setUsingServerFallback(true);
    return await serverInference({
      provider: `local-${activeSize || preferredSize}`,
      question, onToken,
    });
  }

  // 기존 에러
  throw new Error('디바이스 모델이 활성화되지 않았습니다.');
}, []);
```

**E.2 `DeviceAiCard.jsx` 수정**
- ❌ 모델도 클릭 가능 (서버 폴백 가능 시)
- ☁️ 배지 + "외부 회사 X, 우리 AWS 안" 안내
- 한도 잔여 표시

**E.3 회귀 검증**
- 외부 3개 (Gemini/OpenAI/Claude) 정상
- 디바이스 5개 모델 정상
- 서버 폴백 흐름 정상
- usage-log 'card_explain_server' 기록

**E.4 점진적 노출**
- 처음 admin 토글 OFF
- 일부 사용자 → 점진적 확대
- 비상 시 OFF 복귀 (REBUILD18 토글)

---

## 7. 코드 변경 영향 범위

### 7.1 신규 파일

```
scripts/inference-handler/
  ├─ Dockerfile
  ├─ inference-handler.js
  ├─ auth.js
  ├─ rate-limit.js
  └─ package.json

src/labs/server-ai/
  ├─ ServerAiTester.jsx
  ├─ components/...
  └─ lib/serverInfer.js
```

### 7.2 수정 파일 (Lab 단계)

```
src/App.jsx                                     # /lab/server-ai 라우트
api/usage-log.js                                # 'card_explain_server' 화이트리스트
```

### 7.3 본 통합 단계 추가 수정 파일 (Phase E)

```
src/tabs/QuizTab/local-ai-bridge/useDeviceAi.js   # ❌ 분기 → 서버 폴백
src/tabs/QuizTab/local-ai-bridge/DeviceAiCard.jsx  # ❌ 모델 클릭 가능 + ☁️ 배지
```

### 7.4 변경 없음 (격리)

```
api/{gemini|openai|claude}.js                   # 외부 API 그대로
api/_llm/*                                      # LLM 호출 통일
src/labs/local-ai/lib/inference.js              # 디바이스 추론 그대로
src/labs/local-ai/components/*.jsx              # /lab/local-ai 그대로
buildspec.yml                                   # 메인 Lambda 빌드 그대로
```

---

## 8. 위험 요소 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| **콜드 스타트 5~15초** | 첫 호출 사용자 UX | RESPONSE_STREAM → 첫 토큰 빠름 / "준비 중" UI |
| **E4B 10GB 메모리 한도** | 추론 메모리 OOM | Phase A.6 헬스체크 / OOM 시 E4B 만 보류 |
| **Lambda 동시 실행 5 한도** | 트래픽 폭증 시 throttle | Reserved Concurrency 5 → 안정 후 증가 |
| **추론 시간 길어짐** | 사용자 wait | RESPONSE_STREAM 으로 즉시 토큰 표시 |
| **CPU 추론 = GPU 보다 느림** | E4B 30초+ | 사용자에게 명시 / 디바이스 ✅ 우선 |
| **Rate Limit 디비 부담** | DB 쿼리 추가 | llm_usage_log 인덱스 활용 / Redis 도입 검토 |
| **모델 ECR 사이즈 12GB** | 빌드 시간 ↑ | 첫 빌드만 길음 / 이후 layer 캐시 |
| **회귀 위험** | 본 기능에 영향 | Lab 단계 격리 / Phase E 만 본 코드 수정 |

---

## 9. KPI 검증

### 9.1 Phase A 완료 기준

- ✅ S3 모델 버킷 (이미 완료)
- ✅ Lambda 함수 3개 `Active` 상태
- ✅ Function URL RESPONSE_STREAM 동작
- ✅ Reserved Concurrency 5 설정
- ✅ 헬스체크 통과 (E4B OOM 여부 명시)

### 9.2 Phase B + C 완료 기준

- ✅ Rate Limit 4단계 검증 (한도 도달 시 429)
- ✅ `/lab/server-ai` 라이브 동작
- ✅ usage-log 기록
- ✅ 디바이스 vs 서버 비교 가능

### 9.3 Phase D 검증 (1~2주)

- ✅ 응답 일치도 95%+
- ✅ 첫 토큰 3초 이내
- ✅ E4B 정상 동작 확정
- ✅ 호출당 비용 $0.003 이내
- ✅ Rate Limit 정상 동작 (도달 사용자 < 5%)

### 9.4 Phase E 본 통합 트리거

- 위 KPI 모두 만족
- 사용자 피드백 양호
- 외부 3 + 디바이스 5 회귀 0

---

## 10. 결정 사항 (확정)

### 10.1 Phase A 진입 전 결정 (사용자 디폴트 동의 — 2026-04-28)

| # | 항목 | 결정 |
|---|---|---|
| 1 | S3 버킷명 | `aitutor-models-794531974010` ✅ 완료 |
| 2 | Lambda IAM Role | `aitutor-inference-role` (S3 read + Logs) |
| 3 | Lambda 메모리 | **10240 MB (10 GB)** |
| 4 | Lambda Timeout | **900 초 (15분)** |
| 5 | Lambda Reserved Concurrency | **5** (동시성 천장) |
| 6 | ECR 리포 | 모델별 분리 — `aitutor-inference-{e2b/e4b/qwen35-4b}` |
| 7 | Function URL | RESPONSE_STREAM 모드 |
| 8 | 모델 호스팅 | 컨테이너 이미지 내장 (cold start 짧게) |

### 10.2 Phase B 진입 전 결정 (디폴트 동의)

| # | 항목 | 결정 |
|---|---|---|
| 9 | Rate Limit L1 사용자 일 한도 | **30 회** |
| 10 | Rate Limit L2 E4B 사용자 일 한도 | **10 회** |
| 11 | Rate Limit L2 E2B/Qwen 사용자 일 한도 | **30 회** |
| 12 | Rate Limit L3 계정 일 한도 | **1,000 회** |
| 13 | UI 배지 문구 | **☁️ 서버 추론 (AWS)** |
| 14 | 디바이스 ✅ 도 서버 옵션 | 미제공 |
| 15 | 비용 알람 임계 | 일 **$5** / 월 **$50** |

### 10.3 사후 결정

- 트래픽 패턴 안정화 후 Reserved Concurrency 조정 (5 → 10/20)
- E4B OOM 발생 시 메모리 11GB+ 또는 별도 함수
- Rate Limit 한도 동적 조정 (DB 설정)
- Qwen 3.5 0.8B / 2B 도 서버 호스팅 추가 여부

---

## 11. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-28 | 최초 작성 — 5개 모델 SageMaker 호스팅 + 자동 폴백 설계 | Claude Code |
| 2026-04-28 (갱신 1) | 사용자 결정 반영 — 3개 모델 + Lab 시범 단계 + 5 Phase 구조 | Claude Code |
| 2026-04-28 (갱신 2) | 사용자 요청 — 텍스트 전용 추출 → q4f16 변형 전체로 변경 | Claude Code |
| 2026-04-28 (갱신 3) | **인프라 전환 — SageMaker → Lambda Container** (응답 스트리밍 + 60초 timeout 회피 + 메모리 10GB) + Rate Limit 4단계 추가 | Claude Code |

---

## 12. 부록 — 참고

### 12.1 외부 자료

- [Lambda Container Image](https://docs.aws.amazon.com/lambda/latest/dg/configuration-images.html)
- [Lambda Function URL with Response Streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Lambda Reserved Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
- [onnxruntime-node](https://onnxruntime.ai/docs/install/#install-on-web-and-mobile)
- [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js/index)

### 12.2 선행 문서

- REBUILD15 — Lambda Function URL RESPONSE_STREAM 도입 패턴
- REBUILD16 §8.4 LLM 호출 통일 — PROVIDERS 패턴
- REBUILD16 §8.8 비용 추적 — `llm_usage_log` 활용
- REBUILD17 §13 모델 다중화 — `/lab/local-ai` 격리 모듈
- REBUILD18 §11 의사결정 — 'local' 4번째 프로바이더 + 글로벌 토글
- REBUILD19 §1.1 Rate Limit 부재 — 본 라운드 §6 B.2 에서 해결
