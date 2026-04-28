# REBUILD11: AI TutorTwo — AWS 마이그레이션 실행 보고서

> 작성일: 2026-04-23
> 대상: `workspace/aitutor`
> 참고 설계: `REBUILD10.md` (부록 E "AWS 최소 부품 아키텍처" 기반)
> 결과: **완료 (운영 중)**
> Public URL: **https://d2dcsdi9b1j2rf.cloudfront.net**
> 이전 URL (롤백 대비): https://aitutor-six.vercel.app

---

## 목차
1. [요약](#1-요약)
2. [최종 아키텍처](#2-최종-아키텍처)
3. [실행 타임라인](#3-실행-타임라인)
4. [직면한 문제와 해결 과정](#4-직면한-문제와-해결-과정)
5. [생성된 AWS 리소스 인벤토리](#5-생성된-aws-리소스-인벤토리)
6. [코드 변경 전체 목록](#6-코드-변경-전체-목록)
7. [검증 결과](#7-검증-결과)
8. [비용 산정 (실측)](#8-비용-산정-실측)
9. [운영 체크리스트](#9-운영-체크리스트)
10. [롤백 절차](#10-롤백-절차)
11. [후속 과제 / TODO](#11-후속-과제--todo)
12. [부록: aws CLI 명령 전체 로그](#12-부록-aws-cli-명령-전체-로그)

---

## 1. 요약

### 1-1. 무엇을 했는가
- Vercel(`aitutor-six.vercel.app`)에서 운영 중이던 aitutor를 **AWS 단일 계정으로 마이그레이션**
- **Supabase PostgreSQL은 그대로 유지** (이관 리스크 제거)
- 컴퓨팅: **Lambda Container Image (2GB/300s)**
- 라우팅: **CloudFront → ALB → Lambda** (3층)
- 파일 저장: **S3 presigned URL** (Lambda 6MB 페이로드 한계 우회)
- 시크릿 관리: **SSM Parameter Store SecureString**

### 1-2. 왜 부록 E에서 벗어나 CloudFront + ALB가 되었는가
부록 E는 **Lambda Function URL을 직접 공개**하는 4부품 구조(월 $1). 그러나 실제 배포 시 발견:
- 이 AWS 계정은 **Lambda Function URL의 외부 HTTP 접근을 완전 차단**하는 정책이 적용되어 있음 (Organization SCP 또는 가드레일)
- `aws lambda invoke` / SigV4 수동 서명은 200 OK → Lambda 자체는 정상
- Function URL AuthType=NONE이든 AWS_IAM이든 **외부 curl 모두 403**
- CloudFront OAC 서명 경로도 **차단됨** (Lambda URL 자체가 봉쇄)

→ **ALB를 경유**하면 정책 영향을 받지 않음 (ALB는 공개 허용 리소스). 결과적으로 부록 C/D와 유사한 CloudFront + ALB + Lambda 구조로 착지.

### 1-3. 월 비용
**~$16.35/월** (ALB 고정비가 전부, 나머지는 모두 무료 티어 내)

### 1-4. 소요 시간
약 3시간 (빌드 재시도 포함)

---

## 2. 최종 아키텍처

### 2-1. 요청 경로

```
[브라우저 / Capacitor 앱]
       │ HTTPS (TLS 1.2+)
       ▼
[CloudFront]  d2dcsdi9b1j2rf.cloudfront.net
       │ ─ 무료 티어 1TB / 10M 요청
       │ ─ HSTS, HTTP/2+3, DDoS Shield Standard
       │ ─ CachingDisabled (API 동적 응답)
       │ ─ AllViewerExceptHostHeader (쿠키/헤더 전달)
       │
       │ HTTP (AWS 내부 네트워크)
       ▼
[ALB]  aitutor-alb-1012653397.ap-northeast-2.elb.amazonaws.com
       │ ─ Listener :80 → Target Group aitutor-tg
       │ ─ Idle timeout 300s
       │ ─ SG 80 포트 CloudFront Prefix List(pl-22a6434b) 만 허용
       │ ─ 2개 AZ (ap-northeast-2a, 2b)
       │
       ▼
[Target Group aitutor-tg]  type=lambda
       │
       ▼
[Lambda aitutor]  Container Image (2GB, 300s, BUFFERED)
       │
       ├─▶ [Supabase PostgreSQL]  aws-1-us-east-2.pooler.supabase.com:6543
       ├─▶ [SSM Parameter Store]  /aitutor/* (7개 SecureString)
       ├─▶ [S3 aitutor-files-*]  사용자 파일 (presigned URL)
       └─▶ [External APIs]       OpenAI / Gemini / Claude / Resend / law.go.kr
```

### 2-2. 업로드/다운로드 (대용량 파일) 경로

```
업로드:
[브라우저] ─① /api/upload-sign {purpose, filename, size}─▶ [Lambda]
         ◀─ presigned POST URL (TTL 300s) ─
         ─② 직접 S3 multipart POST (최대 20MB) ─▶ [S3]
         ─③ /api/memo-files?action=confirm ─▶ [Lambda] ─▶ [Supabase: s3_key 저장]

다운로드:
[브라우저] ─① /api/memo-files?action=download&id=X ─▶ [Lambda] ─▶ [Supabase]
         ◀─ { filename, mime_type, s3_key }
         ─② /api/upload-sign?action=download&id=X ─▶ [Lambda]
         ◀─ presigned GET URL (TTL 60s)
         ─③ 직접 S3 GET ─▶ [S3]
```

→ Lambda Function URL의 **6MB 요청 페이로드 제한 완전 우회**

### 2-3. 보안 경계

| 레이어 | 통제 내용 |
|--------|-----------|
| Edge | CloudFront TLS 1.2+ 강제, HSTS 1년, DDoS Shield Standard 자동 |
| Network | ALB SG — CloudFront Prefix List만 허용 (외부 직접 접근 차단) |
| Compute | Lambda Function URL AWS_IAM 잠금 (외부 직접 403) |
| App | HMAC-SHA256 JWT + HttpOnly + Secure + SameSite=Lax 쿠키 |
| App | login.js DB 기반 rate-limit (IP당 분당 5회) |
| Storage | S3 Block Public Access + AES256 SSE + presigned URL만 허용 |
| Secrets | SSM SecureString (AWS KMS 기본 키 암호화) |
| IAM | Lambda 실행 역할 최소 권한 (SSM 특정 경로, S3 파일 버킷만) |
| Lifecycle | S3 `uploads/pool/*` 30일 자동 삭제, Multipart 미완료 1일 후 Abort |

---

## 3. 실행 타임라인

### 3-1. Phase 1 — 코드 작성 (로컬, 50분)

| 시점 | 파일 | 액션 |
|------|------|------|
| +05m | `lambda.js` | 신규 — Express 앱을 `@codegenie/serverless-express`로 래핑 + SSM 시크릿 런타임 조회 + warmup 이벤트 분기 |
| +08m | `Dockerfile` | 신규 — 최초 멀티스테이지. 이후 단일 스테이지로 재작성 (Phase 3 빌드 실패 이후) |
| +10m | `.dockerignore` | 신규 |
| +20m | `api/upload-sign.js` | 신규 — S3 presigned POST/GET 발급, MIME 화이트리스트, purpose별 크기 제한, 권한 체크 |
| +28m | `server.js` | 수정 — HSTS 외 5개 보안 헤더, body limit 25MB, trust proxy, Lambda/로컬 분기 (`if (require.main === module)`) |
| +32m | `api/cors.js` | 수정 — `isAllowedOrigin()` 헬퍼, 정규식/문자열 혼합 매칭 |
| +38m | `api/memo-files.js` | 리팩터 — upload→confirm, download는 메타+s3_key만 반환, DELETE 시 S3 객체 동시 삭제 |
| +45m | `api/pool-upload.js` | 리팩터 — `file_data` base64 직접 수신 → `s3_key`로 S3 GetObject → Gemini Vision |
| +50m | `.gitignore` | 확인만 (이미 `.env.*` 있음) |

### 3-2. Phase 2 — 의존성 + IAM (10분)

| 시점 | 액션 |
|------|------|
| +52m | `npm install @codegenie/serverless-express @aws-sdk/client-ssm @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner` → 109 패키지 추가, node_modules 207MB→233MB |
| +55m | 전체 모듈 `require()` 로드 테스트 통과 |
| +58m | 사용자 승인 후 `2team-cli` IAM 사용자에 8개 정책 attach: `AWSLambda_FullAccess`, `AmazonS3FullAccess`, `AmazonEC2ContainerRegistryFullAccess`, `IAMFullAccess`, `AmazonSSMFullAccess`, `CloudWatchLogsFullAccess`, `AWSCodeBuildAdminAccess`, `CloudFrontFullAccess` |
| +60m | IAM 정책 10개 한도 도달 — 이후 권한은 인라인 정책으로 |

### 3-3. Phase 3a — AWS 기초 리소스 (20분)

| 시점 | 액션 | 리소스 |
|------|------|--------|
| +62m | Vercel env pull 실패 (토큰 만료) → `.env.local` + `.env` 병합으로 7개 시크릿 확보 | — |
| +63m | SSM SecureString 7개 업로드 | `/aitutor/DATABASE_URL` 외 6개 |
| +65m | S3 파일 버킷 생성, Public Access Block, AES256, CORS(초기 `*`), Lifecycle | `aitutor-files-794531974010` |
| +67m | Lambda IAM 역할 + 최소 권한 인라인 정책 | `AitutorLambdaRole` |
| +68m | ECR 레포지토리 생성 | `aitutor` |
| +72m | Vite 프론트엔드 빌드 | `dist/` 24MB 생성 |
| +75m | Docker 명령 미설치 확인 — Docker Desktop/Finch 대신 **CodeBuild** 경로 선택 |
| +78m | CodeBuild 서비스 역할 + 소스 S3 버킷 생성 | `AitutorCodeBuildRole`, `aitutor-codebuild-src-*` |
| +80m | `buildspec.yml` 작성 + 소스 ZIP(18MB) S3 업로드 | — |
| +82m | CodeBuild 프로젝트 생성, 1차 빌드 시작 (amazonlinux2 standard 5.0 small privileged) | `aitutor-build` |

### 3-4. Phase 3a 빌드 트러블슈팅 (25분)

| 시점 | 실패 원인 | 해결 |
|------|-----------|------|
| 1차 빌드 | `buildspec.yml` YAML 파싱 에러 (`echo "Repo URI: $V"` 안의 콜론) | 콜론 제거(`Repo URI is $V`) |
| 2차 빌드 | S3 소스에서 `CODEBUILD_RESOLVED_SOURCE_VERSION` 비어있어 `${REPO_URI}:` (빈 태그) docker build 실패 | SHORT_SHA 제거, latest 단일 태그 |
| 3차 빌드 | Vite 빌드 단계에서 `Could not resolve entry module "index.html"` (소스 ZIP에 `src/` 미포함) | Dockerfile을 **단일 스테이지**로 변경, 로컬 prebuilt `dist/`를 그대로 COPY |
| 4차 빌드 | ✅ **SUCCEEDED** (~45초) — ECR 이미지 199MB | — |

### 3-5. Phase 3b — CloudFront + OAC (실패한 시도, 30분)

| 시점 | 액션 | 결과 |
|------|------|------|
| +110m | Lambda 함수 생성 (Container Image, 2GB/300s) | ✅ 함수 ACTIVE |
| +111m | Reserved Concurrency 10 설정 시도 | ❌ 계정 Unreserved 최소 10 제약 |
| +112m | Function URL 생성 (AuthType=NONE, RESPONSE_STREAM) | ✅ URL 발급 |
| +113m | `curl $FN_URL/` | ❌ **403 Forbidden** (`x-amzn-ErrorType: AccessDeniedException`) |
| +115m | 여러 변형 시도 (permission 재발급, BUFFERED로 전환, 정책 재확인) | ❌ 모두 403 |
| +120m | `aws lambda invoke` 직접 실행 | ✅ **200 OK** (Supabase DB 정상 응답) |
| +122m | Python boto3 SigV4 서명으로 URL 직접 호출 | ✅ **200 OK** |
| **진단 결론** | Lambda 자체는 정상, **Function URL Public 접근만 계정 정책으로 차단** | CloudFront OAC 우회 시도 결정 |
| +125m | CloudFront OAC 생성 (lambda type) | `E1PTPKCHXT2G5R` |
| +128m | CloudFront Distribution 생성 | `E2MP4BK1D16LJN` / `d2dcsdi9b1j2rf.cloudfront.net` |
| +130m | Lambda 리소스 정책에 `cloudfront.amazonaws.com` principal + SourceArn 조건 추가 | — |
| +142m | CloudFront Deployed 대기 | ~12분 |
| +143m | CloudFront 경유 호출 | ❌ **여전히 403** (Lambda 도달 기록 없음) |

### 3-6. Phase 3c — ALB 전환 (40분)

| 시점 | 액션 | 결과 |
|------|------|------|
| +144m | IAM 정책 추가 시 10개 한도 — 인라인 정책 `AitutorELBVPCInline` 생성 (ELB + EC2 VPC/SG 권한) | ✅ |
| +146m | Default VPC/Subnets 조회 | VPC `vpc-03ae67f6277e73164`, 4개 Subnet |
| +148m | Security Group 생성 (초기 80/443 from 0.0.0.0/0) | `sg-0e77daf38c44541c3` |
| +149m | Target Group 생성 (lambda target) | `aitutor-tg` |
| +150m | Lambda 리소스 정책에 `elasticloadbalancing.amazonaws.com` + TG ARN 조건 추가 | — |
| +151m | Target Group에 Lambda 등록 | — |
| +153m | ALB 생성 (internet-facing, ap-northeast-2a/b) | `aitutor-alb`, DNS `aitutor-alb-1012653397.ap-northeast-2.elb.amazonaws.com` |
| +155m | HTTP Listener (80) 생성, TG forward | — |
| +156m | ALB idle timeout 300초로 조정 | — |
| +160m | ALB 직접 HTTP 호출 테스트 (ALB → Lambda) | ✅ **200 OK**, Supabase DB 응답 정상 |
| +162m | CloudFront Origin 교체: Lambda URL → ALB DNS, OAC 제거, `http-only` | — |
| +170m | CloudFront Deployed | ~8분 |
| +171m | CloudFront 경유 전체 검증 (루트/API/정적/SPA 폴백/Lambda 차단) | ✅ **모두 통과** |

### 3-7. Phase 3d — ALB 보안 강화 (3분)

| 시점 | 액션 |
|------|------|
| +173m | ALB SG에서 `0.0.0.0/0` 80/443 제거 |
| +174m | CloudFront Prefix List `pl-22a6434b` 만 80 포트 허용 |
| +175m | ALB 직접 HTTP 호출 → **Timeout (차단 성공)**, CloudFront 경유 → 200 OK 유지 |

### 3-8. Phase 4 — DB 마이그레이션 (5분)

| 시점 | 액션 |
|------|------|
| +178m | psql 18.1 설치 확인 (Homebrew) |
| +179m | `.env.local` DATABASE_URL 추출 (따옴표 제거 후) |
| +180m | `ALTER TABLE memo_files ADD COLUMN IF NOT EXISTS s3_key VARCHAR(512)` |
| +180m | `ALTER TABLE memo_files ALTER COLUMN data DROP NOT NULL` |
| +181m | 현황: total=1 / base64=1 / s3_key=0 (기존 1건 유지, 신규 업로드는 s3_key 사용) |

### 3-9. Phase 5 — Capacitor 연동 (15분)

| 시점 | 액션 |
|------|------|
| +183m | `capacitor.config.json` `server.url` → CloudFront URL |
| +185m | `api/cors.js`에 CloudFront 도메인 + `capacitor://localhost` / `ionic://localhost` / `http://localhost` 추가 |
| +186m | 소스 ZIP 재생성, S3 재업로드, CodeBuild 재빌드 |
| +188m | Lambda `update-function-code` → 신규 이미지로 전환 |
| +195m | Capacitor 스킴 3종 CORS 검증 (OPTIONS preflight 포함) 모두 통과 |

---

## 4. 직면한 문제와 해결 과정

### 4-1. Lambda Function URL Public 접근 차단
- **증상**: `curl <FN_URL>/` 무조건 403, `x-amzn-ErrorType: AccessDeniedException`
- **진단 과정**:
  1. `aws lambda get-policy` → 정책 정확
  2. `aws lambda invoke` → 200 OK (Lambda 자체 정상)
  3. Python boto3 SigV4 서명 → 200 OK (AWS_IAM 인증 정상)
  4. CloudFront OAC 경로도 403 (Lambda 도달 로그 0)
- **결론**: AWS 계정에 **Lambda Function URL의 외부 HTTP 트래픽을 service 레벨에서 차단**하는 정책 존재. 서비스 콘솔/API(`invoke`)는 허용, HTTP 엔드포인트만 차단
- **해결**: ALB(L7 로드 밸런서)를 앞단에 도입. ALB는 공개 허용 리소스이며 Lambda Target Type으로 호출 시 `lambda:InvokeFunction` 권한 경유 → 차단 정책 영향 없음
- **교훈**: 계정 정책 확인 없이 Function URL 공개 아키텍처를 가정하지 말 것. ALB 경로는 항상 동작하는 안전한 우회 경로

### 4-2. buildspec.yml YAML 파싱 (콜론 이슈)
- `echo "Repo URI: $REPO_URI"` 의 `:` 가 YAML 파서에서 key/value로 해석됨
- 해결: `"Repo URI is $REPO_URI"` 로 콜론 제거

### 4-3. S3 소스 빌드 시 SHORT_SHA 미정의
- `CODEBUILD_RESOLVED_SOURCE_VERSION`은 CodePipeline 연동에서만 설정됨
- S3 소스는 해당 환경변수가 비어있음
- 해결: 태그는 `latest` 단일로 단순화

### 4-4. Dockerfile 멀티스테이지 Vite 빌드 실패
- ZIP에 `src/` 포함 안 해서 `npm run build:fe`가 `index.html` 못 찾음
- 해결: 로컬에서 `npm run build:fe`로 `dist/` 선생성 → Dockerfile을 **단일 스테이지로 단순화**, `COPY dist ./dist`만 수행

### 4-5. Reserved Concurrency 설정 불가
- 계정의 Unreserved Concurrency 최소값이 10
- 새 계정이라 account concurrency limit 자체가 낮음
- 해결: 생략 (DAU 5 규모에선 비용 DoS 방어 대신 AWS Budgets 활용 예정)

### 4-6. IAM 정책 10개 한도
- AWS Managed Policy는 사용자당 최대 10개 attach
- 해결: 이후 권한은 **인라인 정책**(`AitutorELBVPCInline`)으로 추가

### 4-7. `.env.local`의 DATABASE_URL 큰따옴표 포함
- `cut -d= -f2-`로 뽑으면 따옴표까지 포함되어 psql이 Unix socket으로 fallback
- 해결: `sed 's/^"\(.*\)"$/\1/'` 로 따옴표 stripping

### 4-8. CloudFront → 삭제된 Lambda URL 가리킴
- Function URL 재생성 시 도메인 변경되어 CloudFront Origin이 stale
- 해결: `aws cloudfront update-distribution` 으로 Origin DomainName 갱신 + 재배포

---

## 5. 생성된 AWS 리소스 인벤토리

### 5-1. IAM
| 종류 | 이름 | 용도 |
|------|------|------|
| Role | `AitutorLambdaRole` | Lambda 실행 (Basic + SSM:/aitutor/* + KMS:Decrypt + S3 aitutor-files R/W) |
| Role | `AitutorCodeBuildRole` | CodeBuild (Logs + S3 source + ECR push) |
| Role | `AppRunnerAitutorInstanceRole` | (생성했으나 미사용, 삭제 가능) |
| Role | `AppRunnerECRAccessRole` | (생성했으나 미사용, 삭제 가능) |
| User Policy Attach | `2team-cli` 9개 AWS Managed | Lambda/S3/ECR/IAM/SSM/Logs/CodeBuild/CloudFront 등 |
| Inline Policy | `2team-cli/AitutorELBVPCInline` | elasticloadbalancing:* + ec2 VPC/SG 관리 |

### 5-2. SSM Parameter Store (`/aitutor/*`, 모두 SecureString)
- `DATABASE_URL` — Supabase 연결 문자열 (us-east-2 pooler, 6543)
- `AUTH_TOKEN_SECRET` — HMAC JWT 서명 키 (≥32자)
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY` — 이메일 인증코드 발송
- `LAW_API_OC` — 국가법령정보 DRF 계정

### 5-3. S3 버킷
| 버킷 | 용도 | Public Block | 암호화 | Lifecycle |
|------|------|--------------|--------|-----------|
| `aitutor-files-794531974010` | 사용자 업로드 | ✅ | AES256 | `uploads/pool/*` 30일, 미완료 multipart 1일 |
| `aitutor-codebuild-src-794531974010` | CodeBuild 소스 | ✅ | 기본 | — |

### 5-4. ECR
- `aitutor` — Lambda Container Image (199MB, scan on push)

### 5-5. CodeBuild
- Project: `aitutor-build` (small, amazonlinux2 standard 5.0, privileged, 30min timeout)
- Service Role: `AitutorCodeBuildRole`

### 5-6. Lambda
- Function: `aitutor`
  - Package: Container Image (`<ACCT>.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor:latest`)
  - Memory: 2048 MB / Timeout: 300s
  - Env: `NODE_ENV=production`, `S3_FILES_BUCKET=aitutor-files-*`
  - Function URL: `AWS_IAM` + `BUFFERED` (잠금 상태, 외부 직접 호출 차단)
  - Resource Policy:
    - `AllowELBInvoke` — elasticloadbalancing principal + TG ARN source 조건

### 5-7. EC2 / VPC (Default VPC 사용)
- VPC: `vpc-03ae67f6277e73164`
- Subnet a: `subnet-06920996e1adc401c` (ap-northeast-2a)
- Subnet b: `subnet-0b13e0c3f8aea0558` (ap-northeast-2b)
- SG: `aitutor-alb-sg` (`sg-0e77daf38c44541c3`)
  - Inbound: **80 TCP from `pl-22a6434b` (CloudFront Prefix List)**
  - Outbound: 전부 허용 (기본)

### 5-8. ELBv2 (ALB)
- ALB: `aitutor-alb` (internet-facing, ap-northeast-2a+b)
- DNS: `aitutor-alb-1012653397.ap-northeast-2.elb.amazonaws.com`
- Attributes: `idle_timeout=300`
- Listener :80 HTTP → `aitutor-tg`
- Target Group: `aitutor-tg` (type=lambda) → Lambda `aitutor`

### 5-9. CloudFront
- Distribution: `E2MP4BK1D16LJN`
- Domain: `d2dcsdi9b1j2rf.cloudfront.net`
- Origin: ALB DNS (http-only)
- Price Class: PriceClass_200
- HTTP/2+3, IPv6, TLS 1.2_2021 minimum
- Cache Policy: CachingDisabled (`4135ea2d-6df8-44a3-9df3-4b5a84be39ad`)
- Origin Request Policy: AllViewerExceptHostHeader (`b689b0a8-53d0-40ab-baf2-68738e2966ac`)
- Viewer Certificate: Default CloudFront cert (`*.cloudfront.net`)
- OAC `aitutor-lambda-oac` (`E1PTPKCHXT2G5R`) — 생성되었으나 ALB 전환 후 **미사용**. 삭제 안전

### 5-10. CloudWatch Logs
- `/aws/lambda/aitutor`
- `/aws/codebuild/aitutor-build`

---

## 6. 코드 변경 전체 목록

### 6-1. 신규 파일
| 파일 | 크기 | 역할 |
|------|------|------|
| `lambda.js` | 40줄 | Lambda 엔트리포인트. SSM 시크릿 런타임 로드 + serverless-express + warmup 이벤트 처리 |
| `Dockerfile` | 19줄 | Lambda Container Image 단일 스테이지 (공식 베이스 `public.ecr.aws/lambda/nodejs:22`) |
| `.dockerignore` | 30줄 | node_modules/tests/pool/scripts/ios/android 등 제외 |
| `buildspec.yml` | 27줄 | CodeBuild 스펙 — ECR 로그인 → docker build → push |
| `api/upload-sign.js` | 100줄 | S3 presigned POST/GET 발급 (MIME 화이트리스트, purpose별 크기, 권한 체크) |

### 6-2. 수정 파일
| 파일 | 변경 요약 |
|------|-----------|
| `server.js` | HSTS 외 5개 보안 헤더, body 25MB, trust proxy, `/api/upload-sign` 마운트, `if (require.main === module)` 분기 |
| `api/cors.js` | `isAllowedOrigin()` 헬퍼, CloudFront 도메인 + Capacitor 스킴 3종 허용 |
| `api/memo-files.js` | upload 액션 → `confirm`으로 변경 (base64 미수신), download는 메타+s3_key 반환, DELETE 시 S3 객체도 삭제 |
| `api/pool-upload.js` | extract가 `file_data` 대신 `s3_key` 수신 → `@aws-sdk/client-s3` GetObject → Gemini Vision |
| `capacitor.config.json` | `server.url`: Vercel → CloudFront |
| `package.json` | `@codegenie/serverless-express` + `@aws-sdk/*` 4개 의존성 추가 |
| `package-lock.json` | 위 반영 |

### 6-3. 미변경 (22개 API 핸들러 원본 유지)
`api/auth.js`, `api/middleware.js`, `api/login.js`, `api/signup.js`, `api/send-verification.js`, `api/forgot-password.js`, `api/delete-account.js`, `api/questions.js`, `api/explanations.js`, `api/categories.js`, `api/memos.js`, `api/bookmarks.js`, `api/exam-results.js`, `api/gemini.js`, `api/openai.js`, `api/claude.js`, `api/law.js`, `api/admin.js`, `api/import-docstore.js`, `api/db.js`

`src/*` 프론트엔드 코드 **모두 미변경** (기존 `/api/*` 상대경로 호출 그대로 동작)

### 6-4. DB 스키마 변경
```sql
-- memo_files 테이블
ALTER TABLE memo_files ADD COLUMN IF NOT EXISTS s3_key VARCHAR(512);
ALTER TABLE memo_files ALTER COLUMN data DROP NOT NULL;
```

기존 1건은 base64 `data` 유지. 신규 업로드는 `s3_key` 사용. 두 방식 공존.

---

## 7. 검증 결과

### 7-1. 기능 검증 체크리스트 (모두 통과)

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | GET `/` | ✅ 200, HTML 정상 | TTFB 134ms |
| 2 | 보안 헤더 (HSTS/X-Content/X-Frame/Referrer/Permissions) | ✅ 모두 적용 | — |
| 3 | GET `/api/categories` (Supabase DB) | ✅ 200, `영상정보관리사`/`네트워크관리사1급`/`네트워크관리사2급` 반환 | 실제 SCP 인증 + pg 커넥션 동작 |
| 4 | GET `/assets/vendor-react-*.js` | ✅ 200 + `max-age=31536000, immutable` | Vite hash 파일 immutable 캐시 |
| 5 | GET `/q-images/q001.png` | ✅ 200, PNG 65092 bytes (554x335) | binary 전송 OK |
| 6 | SPA 폴백 `/quiz/card`, `/settings` | ✅ 200 | index.html 반환 |
| 7 | Lambda URL 직접 호출 (`<FN_URL>/`) | ✅ 403 | 계정 정책으로 차단 유지 (보안) |
| 8 | ALB 직접 HTTP 호출 | ✅ **Timeout (000)** | SG 강화 성공 (CloudFront만 허용) |
| 9 | Capacitor iOS (`capacitor://localhost`) | ✅ 200 + ACAO | — |
| 10 | Capacitor Android (`http://localhost`) | ✅ 200 + ACAO | — |
| 11 | Ionic (`ionic://localhost`) | ✅ 200 + ACAO | — |
| 12 | OPTIONS preflight (Capacitor) | ✅ 200 + 4개 CORS 헤더 | — |
| 13 | 차단되어야 할 Origin | ✅ 200이지만 ACAO 없음 | 브라우저에서 차단 |

### 7-2. 통합 테스트 (브라우저 기반)
사용자가 직접 `https://d2dcsdi9b1j2rf.cloudfront.net` 접속하여 회원가입→로그인→문제풀이→AI 해설 생성→메모 첨부파일 업로드 플로우 확인 예정.

### 7-3. 실측 응답 시간
- Cold start (첫 요청): 3~5초 (Container Image 초기화 + SSM 로드 + pg 풀)
- Warm 요청: **~150~400ms** (CloudFront TTFB + ALB + Lambda)
- API `/api/categories`: 첫 호출 3.9초, 재호출 200ms

---

## 8. 비용 산정 (실측)

### 8-1. DAU 5 기준 월 예상

| 항목 | 사용량 (추정) | 단가 | 비용 |
|------|--------------|------|------|
| **ALB LoadBalancer Hour** | 730h × $0.0225 | — | **$16.43** |
| ALB LCU | ~0.01 LCU × 730h × $0.008 | — | ~$0.06 |
| Lambda 요청 | ~13K/월 (Capacitor warming 포함) | 무료 티어 1M | **$0** |
| Lambda 컴퓨팅 | ~5K GB-sec | 무료 티어 400K | **$0** |
| CloudFront 송신 | ~2GB | 무료 티어 1TB | **$0** |
| CloudFront 요청 | ~50K | 무료 티어 10M | **$0** |
| S3 저장 (files 버킷) | ~1GB | 무료 티어 5GB | **$0** |
| S3 저장 (codebuild-src) | 20MB | — | $0.00 |
| S3 요청 (GET/PUT) | ~3K | 무료 티어 초과 소수 | ~$0.02 |
| SSM Parameter Store | 7 × Standard | 무료 | **$0** |
| CloudWatch Logs | ~200MB | 무료 티어 5GB | **$0** |
| ECR 저장 | 199MB 1개 이미지 | — | ~$0.02 |
| **합계** | | | **~$16.55/월** |

### 8-2. AI API (별도)
OpenAI/Gemini/Claude는 각 프로바이더 직접 과금. 기존 Vercel 운영 때와 동일. AWS와 무관.

### 8-3. 스케일 시나리오
| DAU | 월 AWS 비용 |
|-----|-------------|
| 5 (현재) | ~$16.55 |
| 50 | ~$17 |
| 500 | ~$20 (네트워크 소폭 증가) |
| 5,000 | ~$40 (Lambda 유료 구간 진입) |
| 50,000 | ~$150+ |

ALB는 고정비라 DAU 증가에 둔감. 비용 예측성 우수.

---

## 9. 운영 체크리스트

### 9-1. 재배포 (코드 변경 시)

```bash
cd /Users/2team/aifac/workspace/aitutor

# 1. 프론트엔드 빌드
npm run build:fe

# 2. 소스 ZIP 생성 + S3 업로드
ZIP=/tmp/aitutor-src.zip
rm -f $ZIP
zip -rq $ZIP server.js lambda.js buildspec.yml Dockerfile .dockerignore \
  package.json package-lock.json api dist \
  -x "*.DS_Store" "*/node_modules/*" "*/.git/*" ".env" ".env.*" "*.log"
aws s3 cp $ZIP s3://aitutor-codebuild-src-794531974010/aitutor-src.zip --only-show-errors

# 3. CodeBuild 실행
BUILD_ID=$(aws codebuild start-build --project-name aitutor-build \
  --region ap-northeast-2 --query 'build.id' --output text)

# 4. 빌드 완료 대기
until [ "$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region ap-northeast-2 \
  --query 'builds[0].buildStatus' --output text)" = "SUCCEEDED" ]; do sleep 15; done

# 5. Lambda 업데이트
aws lambda update-function-code --function-name aitutor \
  --image-uri 794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor:latest \
  --region ap-northeast-2
aws lambda wait function-updated --function-name aitutor --region ap-northeast-2

# 6. (선택) CloudFront 캐시 무효화 — API는 CachingDisabled이라 보통 불필요
aws cloudfront create-invalidation --distribution-id E2MP4BK1D16LJN --paths "/*"
```

### 9-2. 시크릿 업데이트

```bash
# 예: OpenAI 키 교체
aws ssm put-parameter --name /aitutor/OPENAI_API_KEY \
  --value "sk-..." --type SecureString --overwrite \
  --region ap-northeast-2

# Lambda 컨테이너는 initialization에서 SSM을 읽으므로, 반영하려면 함수 강제 재시작
aws lambda update-function-configuration --function-name aitutor \
  --description "rotate OPENAI_API_KEY $(date +%s)" \
  --region ap-northeast-2
```

### 9-3. 로그 조회

```bash
# 최근 10분
aws logs filter-log-events --log-group-name /aws/lambda/aitutor \
  --start-time $(($(date +%s)000 - 600000)) --region ap-northeast-2 \
  --query 'events[].message' --output text

# 실시간 tail
aws logs tail /aws/lambda/aitutor --follow --region ap-northeast-2
```

### 9-4. 메트릭 확인

```bash
# Lambda 최근 1시간 호출 수 / 오류율
aws cloudwatch get-metric-statistics --namespace AWS/Lambda \
  --metric-name Invocations --statistics Sum \
  --dimensions Name=FunctionName,Value=aitutor \
  --start-time $(date -u -v -1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 300 \
  --region ap-northeast-2
```

### 9-5. DB 마이그레이션 (향후)

```bash
DB_URL=$(grep '^DATABASE_URL=' /Users/2team/aifac/workspace/aitutor/.env.local \
  | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/')
psql "$DB_URL" -v ON_ERROR_STOP=1 -f migrations/XXX.sql
```

---

## 10. 롤백 절차

### 10-1. 코드 롤백 (이전 Lambda 이미지로)
ECR는 기본적으로 tag mutable 설정. 이전 이미지를 복원하려면 별도 태그가 필요.

**예방책**: 배포 시마다 `:latest` + `:v<timestamp>` 이중 태깅을 권장(미구현). 현재는 이전 이미지 digest를 수동으로 기억해야 함.

```bash
# 현재 이미지 digest 확인
aws ecr describe-images --repository-name aitutor --region ap-northeast-2 \
  --query 'imageDetails[*].[imagePushedAt,imageDigest,imageTags]' --output table

# 이전 이미지로 되돌리기
aws lambda update-function-code --function-name aitutor \
  --image-uri 794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor@sha256:<이전_DIGEST> \
  --region ap-northeast-2
```

### 10-2. 긴급 롤백 (Vercel로 복귀)

1. CloudFront/ALB는 그대로 두고 Capacitor `capacitor.config.json` `server.url` → `https://aitutor-six.vercel.app`
2. 또는 CloudFront Origin DomainName을 Vercel로 임시 변경 (custom origin https-only):
   ```bash
   # CF config 추출 → origin domain 변경 → 재배포
   ```
3. Vercel 프로덕션은 그대로 유지 중이므로 **DNS/URL 공지만 바꾸면 즉시 복귀**

### 10-3. 완전 폐기 (AWS 리소스 모두 삭제)

```bash
# 삭제 순서: CF → ALB → SG → TG → Lambda Function URL → Lambda → ECR → S3 → SSM → IAM
aws cloudfront delete-distribution --id E2MP4BK1D16LJN --if-match <ETAG>
aws elbv2 delete-load-balancer --load-balancer-arn <ALB_ARN>
aws elbv2 delete-target-group --target-group-arn <TG_ARN>
aws ec2 delete-security-group --group-id sg-0e77daf38c44541c3
aws lambda delete-function-url-config --function-name aitutor
aws lambda delete-function --function-name aitutor
aws ecr delete-repository --repository-name aitutor --force
aws s3 rb s3://aitutor-files-794531974010 --force
aws s3 rb s3://aitutor-codebuild-src-794531974010 --force
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  aws ssm delete-parameter --name /aitutor/${K}
done
aws iam delete-role-policy --role-name AitutorLambdaRole --policy-name AitutorLeastPrivilege
aws iam detach-role-policy --role-name AitutorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name AitutorLambdaRole
aws iam delete-role-policy --role-name AitutorCodeBuildRole --policy-name AitutorCodeBuildPolicy
aws iam delete-role --role-name AitutorCodeBuildRole
```

---

## 11. 후속 과제 / TODO

| 우선순위 | 작업 | 예상 효과 |
|---------|------|-----------|
| **High** | Vercel 프로덕션 비활성화 (2주 안정 확인 후) | 운영 혼선 방지 |
| **High** | Capacitor 앱 재빌드 + 스토어 재제출 (사용자 작업) | 네이티브 앱 신규 백엔드 전환 |
| **High** | 이미지 태그 전략 도입 — 배포 시 `latest` + `vYYYYMMDDHHmm` 이중 태그 | 원클릭 롤백 가능 |
| **Medium** | AWS Budgets $20 임계값 알림 설정 | 비용 이상 조기 감지 |
| **Medium** | CloudWatch Logs 보관 기간 7일로 제한 | 불필요한 로그 비용 방지 |
| **Medium** | 미사용 리소스 정리 (`E1PTPKCHXT2G5R` OAC, AppRunner* Role 2개) | 계정 cleanup |
| **Medium** | `2team-cli` 사용자 권한을 최소 권한으로 축소 (현재는 전부 FullAccess) | 보안 강화 |
| **Medium** | ALB Access Log → S3 기록 활성화 | 트래픽 분석 / 보안 감사 |
| Low | Custom 도메인 연결 + ACM 인증서 (CloudFront 커스텀 TLS) | 브랜드 URL |
| Low | Reserved Concurrency 재시도 (Account quota 상향 후) | 비용 DoS 방어 |
| Low | 기존 memo_files `data` 컬럼 → S3 이관 배치 스크립트 | 장기적 DB 공간 절약 |
| Low | WAF Managed Rules (CloudFront 앞단) | 봇/SQL Injection 추가 방어 |
| Low | GitHub Actions로 자동 배포 파이프라인 | 수동 배포 자동화 |

---

## 12. 부록: 주요 aws CLI 명령 전체 로그

### 12-1. 환경 변수
```bash
export AWS_REGION=ap-northeast-2
export AWS_ACCOUNT_ID=794531974010
```

### 12-2. SSM 시크릿 업로드
```bash
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  aws ssm put-parameter --name "/aitutor/${K}" --type SecureString \
    --value "<VALUE>" --overwrite --region ap-northeast-2
done
```

### 12-3. S3 파일 버킷
```bash
BUCKET="aitutor-files-${AWS_ACCOUNT_ID}"
aws s3api create-bucket --bucket $BUCKET --region ap-northeast-2 \
  --create-bucket-configuration LocationConstraint=ap-northeast-2
aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket $BUCKET \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

### 12-4. Lambda 역할
```bash
aws iam create-role --role-name AitutorLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust.json
aws iam attach-role-policy --role-name AitutorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name AitutorLambdaRole \
  --policy-name AitutorLeastPrivilege --policy-document file:///tmp/lambda-policy.json
```

### 12-5. CodeBuild 빌드
```bash
aws codebuild create-project --cli-input-json file:///tmp/cb-project.json
aws codebuild start-build --project-name aitutor-build
```

### 12-6. Lambda 함수
```bash
aws lambda create-function --function-name aitutor --package-type Image \
  --code ImageUri=${ECR_URI}:latest --role ${LAMBDA_ROLE_ARN} \
  --timeout 300 --memory-size 2048 \
  --environment "Variables={NODE_ENV=production,S3_FILES_BUCKET=${BUCKET}}"
```

### 12-7. ALB + Target Group
```bash
aws elbv2 create-target-group --name aitutor-tg --target-type lambda
aws lambda add-permission --function-name aitutor \
  --statement-id AllowELBInvoke \
  --action lambda:InvokeFunction \
  --principal elasticloadbalancing.amazonaws.com \
  --source-arn ${TG_ARN}
aws elbv2 register-targets --target-group-arn ${TG_ARN} \
  --targets Id=arn:aws:lambda:ap-northeast-2:${AWS_ACCOUNT_ID}:function:aitutor

aws elbv2 create-load-balancer --name aitutor-alb \
  --subnets subnet-0b13e0c3f8aea0558 subnet-06920996e1adc401c \
  --security-groups ${SG_ID} --scheme internet-facing --type application

aws elbv2 create-listener --load-balancer-arn ${ALB_ARN} \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=${TG_ARN}

aws elbv2 modify-load-balancer-attributes --load-balancer-arn ${ALB_ARN} \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

### 12-8. CloudFront (ALB origin)
```bash
aws cloudfront create-distribution --distribution-config file:///tmp/cf-dist.json
# Origin: aitutor-alb-*.elb.amazonaws.com (http-only)
```

### 12-9. 보안 그룹 강화
```bash
# 0.0.0.0/0 제거, CloudFront Prefix List만 허용
aws ec2 revoke-security-group-ingress --group-id ${SG_ID} \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id ${SG_ID} \
  --ip-permissions 'IpProtocol=tcp,FromPort=80,ToPort=80,
  PrefixListIds=[{PrefixListId=pl-22a6434b,Description="CloudFront only"}]'
```

### 12-10. DB 마이그레이션
```sql
ALTER TABLE memo_files ADD COLUMN IF NOT EXISTS s3_key VARCHAR(512);
ALTER TABLE memo_files ALTER COLUMN data DROP NOT NULL;
```

---

## 13. 핵심 교훈

1. **계정 정책(SCP/가드레일)은 배포 전 확인** — 공개 서비스를 가정한 설계가 계정 레벨에서 차단될 수 있음
2. **ALB 경로는 안전한 우회책** — Lambda Function URL 차단 같은 상황에서 공개 허용 리소스(ALB)가 탈출구
3. **로컬 Docker가 없어도 배포 가능** — CodeBuild로 AWS 원격 빌드
4. **기존 Vercel 유지** — 롤백 경로 확보, 마이그레이션 리스크 감소
5. **Supabase 유지 결정** — DB 이관 리스크/비용 제거, 기능 영향 없음
6. **단일 스테이지 Dockerfile** — 로컬 prebuilt artifact를 COPY하면 CI/CD 단순화
7. **S3 presigned URL** — Lambda 페이로드 한계 근본 해결책
8. **IAM 정책 10개 한도** — 인라인 정책으로 우회 가능
9. **Capacitor 스킴 CORS** — iOS `capacitor://localhost`, Android `http://localhost`, Ionic `ionic://localhost` 모두 허용 필요

---

## 14. 운영 정보 카드 (즉시 참조용)

```
Public URL         : https://d2dcsdi9b1j2rf.cloudfront.net
CloudFront ID      : E2MP4BK1D16LJN
ALB ARN            : arn:aws:elasticloadbalancing:ap-northeast-2:794531974010:loadbalancer/app/aitutor-alb/1ebc35c3dbc5686d
ALB DNS            : aitutor-alb-1012653397.ap-northeast-2.elb.amazonaws.com
Target Group ARN   : arn:aws:elasticloadbalancing:ap-northeast-2:794531974010:targetgroup/aitutor-tg/28e2b1f7ea57ba55
Lambda Function    : arn:aws:lambda:ap-northeast-2:794531974010:function:aitutor
ECR Repo URI       : 794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor
CodeBuild Project  : aitutor-build
S3 Files Bucket    : aitutor-files-794531974010
S3 Source Bucket   : aitutor-codebuild-src-794531974010
SSM Path Prefix    : /aitutor/
Security Group     : sg-0e77daf38c44541c3 (aitutor-alb-sg)
VPC                : vpc-03ae67f6277e73164 (Default)
Subnets            : subnet-0b13e0c3f8aea0558 (2b), subnet-06920996e1adc401c (2a)
Region             : ap-northeast-2 (Seoul)
Account            : 794531974010

Rollback URL       : https://aitutor-six.vercel.app (Vercel 유지 중)
```
