# REBUILD10: AI TutorTwo — Vercel → GCP Cloud Run 마이그레이션 설계

> 작성일: 2026-04-22
> 대상 경로: `workspace/aitutor`
> 현재 URL (Vercel): `https://aitutor-six.vercel.app`
> 목표 프로젝트: GCP **`aifactory`** (projectId: `aifactory-494108`, projectNumber: `58235609672`)
> 목표 리전: `asia-northeast3` (Seoul)
> 참고: `workspace/withbible/REBUILD05.md` (먼저 성공한 유사 마이그레이션)

---

## 목차
1. [마이그레이션 개요](#1-마이그레이션-개요)
2. [현재 상태 심층 분석](#2-현재-상태-심층-분석)
3. [DB 전략: Supabase 유지 vs Cloud SQL 이관 비교](#3-db-전략-supabase-유지-vs-cloud-sql-이관-비교)
4. [Cloud Run 아키텍처 설계](#4-cloud-run-아키텍처-설계)
5. [파일별 변경 사항 상세](#5-파일별-변경-사항-상세)
6. [단계별 실행 계획](#6-단계별-실행-계획)
7. [배포 명령과 검증 체크리스트](#7-배포-명령과-검증-체크리스트)
8. [비용 산정](#8-비용-산정)
9. [Capacitor(iOS/Android) 영향과 대응](#9-capacitorios-android-영향과-대응)
10. [롤백 절차](#10-롤백-절차)
11. [후속 권장 작업](#11-후속-권장-작업)
12. [부록: 환경변수 표 / DB 스키마 표](#12-부록-환경변수--db-스키마)
13. [부록 A: AWS 대안 심층 분석](#부록-a-aws-대안-심층-분석-aws-cli-기반-마이그레이션)
14. [최종 권장 매트릭스 (GCP vs AWS)](#최종-권장-매트릭스-gcp-vs-aws)
15. [부록 B: AWS 완전 이관 최소 스펙 설계 (DAU ≤ 5)](#부록-b-aws-완전-이관-최소-스펙-설계-dau--5)
16. [부록 C: AWS 경량 + Supabase 유지 + 보안 최적화 (DAU ≤ 5) ⭐](#부록-c-aws-경량--supabase-유지--보안-최적화-dau--5)
17. [부록 D: LLM + 이미지 워크로드 최적 아키텍처 (현재 상태 점검 반영) ⭐⭐](#부록-d-llm--이미지-워크로드-최적-아키텍처-aws-cli-실측-기반)
18. [부록 E: AWS 최소 부품 아키텍처 (극단 단순화 · 4부품) 🔥](#부록-e-aws-최소-부품-아키텍처-극단-단순화--4부품)

---

## 1. 마이그레이션 개요

### 1-1. 왜 옮기는가

| 항목 | 내용 |
|------|------|
| 운영 환경 통일 | 사용자의 신규 앱 서비스는 모두 GCP Cloud Run + `asia-northeast3` 기반 (`pressstand`, `pressstand-paper`, `pressstand-web`, `withbible`) |
| 배포/모니터링 표준화 | Vercel ↔ GCP 두 체계 병행 부담 제거, `gcloud` 단일 툴체인 |
| Vercel 종속성 해소 | 함수별 `maxDuration`, rewrites 등 플랫폼 전용 설정 → 표준 Node/Express로 이식 |
| Capacitor 앱과의 일관성 | iOS/Android 네이티브 빌드에서 참조하는 백엔드 URL을 GCP로 단일화 가능 |

### 1-2. 목표

- **코드 최소 변경**: 클라이언트(React/Vite) 코드는 원칙적으로 수정 없음. 이미 `/api/*` 상대경로로 호출 중이므로 백엔드가 바뀌어도 URL 재빌드 불필요.
- **데이터 무손실**: Supabase PostgreSQL의 모든 테이블/데이터 보존.
- **AI 프록시 기능 보존**: Gemini/OpenAI/Claude 3사 SSE 스트리밍, 이미지 첨부, 모델 화이트리스트, 폴백 로직 모두 유지.
- **다운타임 최소화**: Vercel은 당분간 병행 가동, DNS/URL 전환은 Cloud Run 검증 후 수행.

### 1-3. 채택 아키텍처: **Cloud Run + Node 22-alpine Express + Supabase 유지** (Primary)

| 선택지 | 판단 |
|--------|------|
| Cloud Run + 경량 Express | **✅ Primary 채택**. `withbible`, `pressstand-paper`와 동일 패턴. 이미 `server.js`가 거의 완성되어 있어 추가 공수 최소. |
| AWS App Runner + 경량 Express | 🟡 **Alternative** (부록 A 참조). 기존 GCP 통일 원칙과 상충하지만 Supabase가 AWS 위에 있어 네트워크 측면 이점. |
| Cloud Run Jobs | ❌. 장시간 배치용. 웹 서비스 부적합. |
| Cloud Functions (Gen2) | ❌. 24개 핸들러를 각각 함수로 나누면 관리 포인트 증가. Express 단일 컨테이너가 유리. |
| AWS Lambda + API Gateway | ❌. SSE 스트리밍 제약(응답 스트리밍 최근 지원되나 Function URL 필요 + 15분 상한), 24개 함수 관리 부담. |
| GKE / Compute Engine / EC2 | ❌. 오버 엔지니어링. 트래픽 규모 대비 과잉. |
| Firebase Hosting + Cloud Functions | ❌. `firebase` CLI 추가 도입, 기존 `gcloud` 체계와 이원화. |
| AWS Amplify | ❌. SPA 호스팅 + Lambda 조합, SSE 제약은 Lambda와 동일. |

> **이중 제안 구조**: 본문 §4~§11은 GCP Cloud Run 기준으로 상세 설계를 제공합니다. **부록 A (§13)** 는 AWS로 갈 경우의 완전한 대안 설계(aws CLI 명령 포함)를 제공하고, **§14 최종 권장 매트릭스**에서 두 옵션을 같은 축으로 비교해 선택 근거를 제시합니다.

---

## 2. 현재 상태 심층 분석

### 2-1. 전체 아키텍처 요약도

```
┌──────────────────────────────────────────────────────────────────┐
│ [브라우저/Capacitor 앱]                                            │
│  React(Vite) SPA — /api/* 상대경로로 fetch(credentials:'include')  │
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTPS + HttpOnly 쿠키
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│ [Vercel Functions]  ← ⛔ 이번 마이그레이션 대상                      │
│  api/*.js 24개 핸들러                                              │
│   ├─ 인증 (login/signup/forgot-password/send-verification/…)       │
│   ├─ 도메인 CRUD (questions/categories/memos/bookmarks/…)          │
│   ├─ AI 프록시 (gemini/openai/claude, SSE 스트리밍)                 │
│   └─ 특수 (import-docstore, pool-upload, law, memo-files)          │
└──────────┬──────────────────────────────┬────────────────────────┘
           │ pg 커넥션                     │ HTTPS
           ▼                              ▼
┌───────────────────────┐    ┌────────────────────────────────────┐
│ Supabase PostgreSQL   │    │ 외부 API                            │
│  DATABASE_URL (SSL)   │    │  Google Gemini API                  │
│  포트 6543 (pooler)    │    │  OpenAI API                         │
│                       │    │  Anthropic Claude API               │
│                       │    │  Resend (이메일 발송)                │
│                       │    │  국가법령정보 DRF API                 │
└───────────────────────┘    └────────────────────────────────────┘
```

### 2-2. 프론트엔드 심층 분석

| 항목 | 내용 | 영향 |
|------|------|------|
| 빌드 도구 | **Vite 6** (`@vitejs/plugin-react`) | Dockerfile builder 스테이지에서 `npm run build:fe` |
| 라우팅 | React Router 6 (HashRouter 아님, **BrowserRouter**) | Cloud Run 서버에서 **SPA 폴백** 필수 (`/manage`, `/quiz/card` 등 직접 접근 시 `index.html` 반환) |
| 상태/Context | `ImageModalContext`, `CategoryContext`, `localStorage.globalCategoryId`, `localStorage.user`(사용자 정보만) | 토큰은 **HttpOnly 쿠키**에 서버가 저장 |
| 코드 스플리팅 | 탭/서브페이지 `React.lazy` + `Suspense` (`QuizTab`, `ManageTab`, `LearnHub`, `CardStudy`, `ExamMode`, `RandomQuiz`, `BookmarkStudy`, `LoginPage` 등) | 22개 번들 청크 생성 (`dist/assets/*.js`). Cloud Run 정적 서빙에서 immutable 캐시 대상. |
| 벤더 분리 | `manualChunks: { 'vendor-react': [react, react-dom, react-router-dom] }` | 초기 로딩 최적화, CDN 캐시 효율 증대 |
| SSE 훅 | `src/hooks/useSSE.js` — 3사 공통 훅, **스트림 실패 시 `stream:false` 자동 폴백** | Cloud Run timeout 300초 필요 (AI 응답 장시간 대비) |
| API 클라이언트 | `src/lib/api.js` — `fetch(credentials:'include')` + 401 시 `clearAuth+reload` | 쿠키 기반, `SameSite=Lax` · 프로덕션에서 `Secure` 플래그 |
| 정적 자산 | `public/q-images/` (19MB, 문제 이미지) → Vite가 `dist/q-images/`로 복사 | Dockerfile에서 `dist` 전체 복사 |
| PWA | 현재 서비스워커 없음 (withbible과 달리). manifest/icons도 아직 미구성. | 별도 조치 불필요 |
| 오프라인 대응 | `OfflineBanner`, `useNetwork` 훅, `@capacitor/network` | 네이티브 앱용. 서버 영향 없음 |

### 2-3. 백엔드 24개 핸들러 분류

```
인증(6)              ├── login.js         ← DB, rate-limit(IP), scrypt/SHA256 호환
                    ├── signup.js        ← DB, 이메일 인증코드 기반(비밀번호 없이 가입)
                    ├── send-verification.js ← Resend API, rate-limit(IP 인메모리)
                    ├── forgot-password.js    ← DB, scrypt 해싱
                    ├── delete-account.js     ← DB, 사용자 본인 데이터 일괄 삭제
                    └── auth.js          ← 라이브러리 모듈 (HMAC-SHA256 JWT 구현)

공통(2)              ├── db.js           ← pg Pool (max=2, SSL, timeout=10s)
                    ├── cors.js         ← ALLOWED_ORIGINS 화이트리스트
                    └── middleware.js   ← withCors/withAuth/withAdmin 래퍼

도메인 CRUD(8)       ├── questions.js    ← 문제 목록/검색/CRUD(관리자) + 공개 조회
                    ├── categories.js   ← 카테고리/과목 CRUD (관리자)
                    ├── memos.js        ← 문제별 메모 CRUD
                    ├── memo-files.js   ← 첨부파일 (base64, 5MB 제한)
                    ├── bookmarks.js    ← 북마크 토글/태그/일괄조회
                    ├── exam-results.js ← 모의고사 결과 저장/랭킹
                    ├── explanations.js ← AI 생성 해설 저장/목록/삭제
                    └── admin.js        ← 회원 관리 (관리자 전용)

AI 프록시(3)         ├── gemini.js       ← SSE, 이미지 첨부, thinkingBudget/thinkingLevel
                    ├── openai.js       ← SSE, o-시리즈/GPT-5 특수 처리
                    └── claude.js       ← SSE, 이미지 첨부, timeout=120s

외부 API 프록시(1)   └── law.js          ← 국가법령정보 DRF API (search/detail)

관리자 전용(2)       ├── import-docstore.js ← docstore의 exam_questions 테이블을 불러와 현재 DB로 import
                    └── pool-upload.js  ← Gemini Vision으로 PDF/이미지에서 문제 추출 → DB 등록
```

### 2-4. 핸들러 export 패턴 — Vercel↔Express 양쪽 호환

모든 핸들러가 `module.exports = handler` 형태이며 `(req, res)` 시그니처. **Express에서 그대로 마운트 가능** — withbible 마이그레이션에서 필요했던 export 형식 변환 작업이 **불필요**합니다.

이미 `server.js`가 아래처럼 모든 핸들러를 Express 라우트로 등록하고 있어요.

```js
// server.js (현재)
const apiFiles = ['login','signup','auth','send-verification','forgot-password','delete-account',
                  'questions','explanations','categories','memos','memo-files','bookmarks',
                  'exam-results','gemini','openai','claude','law','admin','import-docstore','pool-upload'];
apiFiles.forEach(name => {
  const handler = require(`./api/${name}`);
  app.all(`/api/${name}`, (req, res) => handler(req, res));
  app.all(`/api/${name}/*`, (req, res) => handler(req, res));
});
```

다만 개선 포인트가 있습니다:
1. `PORT=8080` 기본값 보장 (현재 3002)
2. 정적 파일에 대한 `Cache-Control` 명시 (현재 Express 기본값)
3. SPA 폴백 시 `/api/*`는 제외 (현재는 문제 없지만 명시화 권장)
4. `body size limit` 상향 (pool-upload 20MB, memo-files 5MB → 현재 10MB이라 pool-upload가 제한 걸림 — **기존에도 잠재 버그**)
5. `trust proxy` 설정 (Cloud Run은 프록시 뒤)

### 2-5. DB 스키마 (쿼리에서 역추론)

| 테이블 | 역할 | 주요 컬럼 |
|--------|------|-----------|
| `public.users` | 사용자 | `id, username(=이메일), email, name, password_hash, is_admin, created_at` |
| `categories` | 최상위 카테고리 (영상정보관리사 / 네트워크관리사 등) | `id, name, sort_order` |
| `subjects` | 과목 | `id, name, sort_order, category_id` |
| `exams` | 시험 회차 | `id, title, exam_date, sort_order, category_id` |
| `questions` | 문제 | `id, exam_id, subject_id, question_number, original_number, body, choices(JSON), answer, explanation, image_url, updated_at` |
| `question_memos` | 문제별 메모 | `id, question_id, user_id, content, created_at, updated_at` |
| `memo_files` | 메모 첨부파일 (base64) | `id, memo_id, filename, mime_type, data(base64), size, created_at` |
| `question_bookmarks` | 북마크 (태그 기반 다중) | `id, question_id, user_id, tag, created_at` |
| `exam_results` | 모의고사 결과 | `id, exam_id, category_id, user_id, total_questions, correct_count, wrong_count, score, time_spent, time_limit, answers(JSON), created_at` |
| `question_explanations` | AI 생성 해설 저장 | `id, question_id, provider, model, content, extra_prompt, created_at` |
| `email_verifications` | 이메일 인증코드 | `id, email, code(6자리), type(signup/login/reset), expires_at, used, created_at` |
| `login_attempts` | 로그인 브루트포스 방어 | `ip(PK), count, reset_at` — `login.js`가 자동 생성 |
| `exam_questions` (docstore 소유) | **원격** docstore 앱의 문제 풀 | `import-docstore.js`가 읽어서 `questions`로 복사 |

> **주의**: `import-docstore.js`는 **같은 DB 안의 `exam_questions` 테이블**을 직접 쿼리합니다. 즉 **aitutor와 docstore가 같은 Supabase 프로젝트를 공유**하는 구조입니다. 이 관계는 DB를 옮길 때(Cloud SQL 이관) 매우 중요한 판단 변수가 됩니다.

### 2-6. 인증 흐름

```
[회원가입]
  send-verification(type=signup) → email_verifications에 코드 저장 → Resend로 발송
  → signup(email, name, code) → email_verifications 검증 → users INSERT → "가입완료"

[로그인 — 인증코드 방식, 권장]
  send-verification(type=login) → code 발송
  → login(email, code) → email_verifications 검증 → users 조회
  → signToken(HMAC-SHA256 JWT, 7d) → Set-Cookie(HttpOnly, SameSite=Lax, Secure in prod)

[로그인 — 비밀번호 방식, 하위 호환]
  login(email, password) → scrypt/SHA256 verifyPassword → JWT 발급

[요청 인증]
  쿠키 token → extractToken → verifyToken → req.user = payload
  withAuth: 로그인 필요 | withAdmin: req.user.admin 체크

[비밀번호 재설정]
  send-verification(type=reset) → forgot-password(email, code, newPassword)

[계정 탈퇴]
  delete-account(confirm="탈퇴합니다") → memo_files/memos/bookmarks/exam_results/users 삭제
```

**보안 특이사항**:
- `AUTH_TOKEN_SECRET`은 **32자 이상** 필수 (없거나 짧으면 토큰 발급 거부)
- 로그인 브루트포스: **DB 기반 분당 5회 제한** (IP) — 서버리스/컨테이너 어느 환경에서도 동작
- `send-verification` rate-limit: **인메모리 Map**(분당 2회/IP) — Cloud Run에서 min-instances=0 + 다중 인스턴스 시 한계 존재하지만 그대로 유지 (악화되지 않음, 기존과 동일)
- 쿠키 `Secure` 플래그: `NODE_ENV=production` 또는 `VERCEL` 환경변수로 감지 → Cloud Run에서도 `NODE_ENV=production`으로 작동

### 2-7. AI 프록시 특이사항

| 프로바이더 | 엔드포인트 | 특이사항 | 최장 응답 |
|------------|------------|----------|-----------|
| Gemini | `generativelanguage.googleapis.com/v1beta/.../streamGenerateContent?alt=sse` | Gemini 3.x는 `thinkingLevel`, 2.5는 `thinkingBudget`. 이미지 첨부 `inline_data`. | ~2~3분 (thinking 사용 시) |
| OpenAI | `openai` SDK, `chat.completions.create({stream:true})` | o-시리즈/GPT-5.4는 `developer` role, `reasoning_effort`, `max_completion_tokens`. GPT-5계열도 `max_completion_tokens`. | ~3~5분 (o3-pro, xhigh 설정) |
| Claude | `api.anthropic.com/v1/messages` (https 직접) | content_block_delta만 추출. `x-api-key` 헤더. | ~2분 |

**공통**: 
- 이미지 첨부 base64 지원 → `imageBase64, mimeType` 본문 파라미터
- `withAuth` 미들웨어 — 로그인 필수
- 모델 **화이트리스트** — 허용 목록 외 모델은 기본값으로 대체
- 에러 시 SSE 형식으로 `data: {"error":"..."}\n\n` 전송 후 `[DONE]`

**Cloud Run 적용 시 반드시 필요한 설정**:
- 서비스 `--timeout=300` (기본 5분, 최대 60분까지 확장 가능)
- 응답 스트리밍을 위해 `X-Accel-Buffering: no` (이미 설정됨)
- HTTP/2 활성화는 Cloud Run 기본값으로 이미 적용됨

### 2-8. 특수 핸들러

- **`pool-upload.js`**: 관리자가 PDF/이미지(최대 20MB)를 업로드하면 Gemini Vision이 문제를 추출하고 DB에 등록. `@google/generative-ai` SDK 사용. **컨테이너 RAM 소모 가능** — 최대 20MB 파일을 base64로 받아서 Gemini로 재전송하므로 일시적 60MB 이상 사용. **메모리 512Mi 권장 근거**.
- **`import-docstore.js`**: docstore 앱의 `exam_questions` 테이블을 읽어 `questions`로 복사. **동일 Supabase 프로젝트 전제**.
- **`law.js`**: 국가법령정보 DRF API. `LAW_API_OC` 필요 (계정 식별자).
- **`memo-files.js`**: **파일을 DB에 base64 저장** (Supabase Storage 사용 안 함). 5MB/파일 제한.

---

## 3. DB 전략: Supabase 유지 vs Cloud SQL 이관 비교

### 3-1. 핵심 질문: "Supabase의 고유 기능을 쓰고 있는가?"

코드 전수 조사 결과:

| Supabase 고유 기능 | 사용 여부 | 근거 |
|---------------------|-----------|------|
| Supabase Auth (GoTrue) | ❌ 미사용 | 자체 HMAC-SHA256 JWT 구현 (`api/auth.js`) |
| Row Level Security (RLS) | ❌ 미사용 | 애플리케이션 레벨에서 `user_id`로 필터링 |
| Supabase Storage | ❌ 미사용 | `memo_files`는 PostgreSQL에 base64로 저장 |
| Supabase Realtime | ❌ 미사용 | 실시간 기능 없음 |
| Supabase Edge Functions | ❌ 미사용 | 모든 API는 `api/*.js`로 직접 구현 |
| `supabase-js` 클라이언트 | ❌ 미사용 | `pg` 패키지로 직접 연결 (`api/db.js`) |

**결론**: 현재 Supabase는 **"관리형 PostgreSQL 서비스"로만** 쓰이고 있어요. 즉 **DB를 바꿔도 코드 수정 불필요** (DATABASE_URL 환경변수만 교체). 이는 DB 전략 의사결정의 제약이 거의 없다는 것을 의미합니다.

### 3-2. 두 전략 상세 비교

#### 전략 A: Supabase 유지 (+ Cloud Run은 외부에서 Supabase 접근)

```
Cloud Run (aifactory) ─HTTPS(6543 pooler)─▶ Supabase PostgreSQL (리전: ???)
```

| 항목 | 평가 |
|------|------|
| **마이그레이션 공수** | 거의 0 (`DATABASE_URL` 그대로 Cloud Run env로 이관) |
| **데이터 이관 리스크** | 없음 (테이블/인덱스/트리거 그대로) |
| **월 비용 (DB)** | 무료 티어 내 **$0** (500MB DB, 2GB egress/월). 초과 시 Pro $25/월. |
| **지연 시간** | Supabase 프로젝트 리전에 따라 다름. **Tokyo(AWS ap-northeast-1)면 ~20~30ms, us-east면 ~200ms+** ← 현재 리전 확인 필요 |
| **연결 보안** | 공개 인터넷 + SSL. `pgbouncer(6543)` 사용 권장. IP 화이트리스트는 Supabase Pro만 제공 |
| **백업/복원** | Supabase 자동 백업 (무료: 7일, Pro: 30일 + PITR) |
| **docstore 공유 DB 호환성** | 완벽 (같은 Supabase 프로젝트 계속 공유) |
| **관리 부담** | 낮음 (대시보드, SQL Editor, 로그 모두 제공) |
| **Vendor Lock-in** | Supabase 독점 기능을 안 쓰므로 언제든 탈출 가능 |

**장점**: 즉시 안전한 이관, 비용 최저, docstore와의 공유 DB 관계 유지  
**단점**: GCP 생태계 완결성(IAM/VPC 통합)은 양보, 리전 체크 필요

#### 전략 B: Cloud SQL for PostgreSQL 이관

```
Cloud Run (aifactory) ─Unix Socket / Private IP─▶ Cloud SQL (asia-northeast3)
                                                  pg_dump로 Supabase에서 이관
```

| 항목 | 평가 |
|------|------|
| **마이그레이션 공수** | **중~높음**. `pg_dump` → `gcloud sql import` → 검증 → DATABASE_URL 변경 → Cloud SQL Connector 설정 |
| **데이터 이관 리스크** | 중간 (시퀀스/트리거/제약 재현 확인, 인증 토큰/세션 보존) |
| **월 비용 (DB)** | **최저 ~$8~$10/월** (db-f1-micro 1 vCPU-shared + 10GB HDD, 24/7). 실질 무료 불가. |
| **지연 시간** | Cloud Run과 같은 리전(asia-northeast3) → **~1~2ms** 수준 |
| **연결 보안** | Cloud SQL Auth Proxy + Unix Socket → 비밀번호 없이 IAM 인증. Private IP도 가능 |
| **백업/복원** | 자동 백업 + PITR 기본 제공. 스냅샷 복제 편리 |
| **docstore 공유 DB 호환성** | **문제 발생**. docstore는 현재 Supabase에 있음. Cloud SQL로 옮기면 docstore도 함께 이관해야 하거나, `import-docstore.js`가 Supabase를 원격 조회하도록 별도 커넥션 필요 |
| **관리 부담** | 중간 (maintenance window, 버전 업그레이드, 스토리지 확장은 수동) |
| **Vendor Lock-in** | GCP에 묶임 (그러나 표준 PostgreSQL이라 탈출 가능) |

**장점**: 리전 공동 위치로 지연 최소화, GCP IAM 통합, Cloud Run과 같은 보안 경계  
**단점**: 고정 비용 발생 (+$10/월), `aitutor` 단독 이관 시 docstore와의 공유 관계 파괴, 이관 리스크

### 3-3. 권장: **전략 A (Supabase 유지) — Phase 1**

**근거 요약**:
1. Supabase 고유 기능 미사용 → DB 교체 이득이 작음
2. **docstore와 DB 공유** 구조 → 부분 이관 시 복잡도 급증
3. Cloud Run의 `min-instances=0` 철학(유휴 $0)과 **Cloud SQL 24/7 고정비 $10/월**이 상충
4. 지연 시간은 문제 시점에 해결: 현재 Supabase 리전이 Seoul/Tokyo면 체감 무시 가능. us-east라면 Supabase 내에서 새 프로젝트 생성 + 마이그레이션(Pro 플랜)
5. 이관 리스크 제로 → 롤백 쉬움

**전환 트리거 (Phase 2로 넘어갈 때)**:
- DAU 10,000+ 도달하여 Supabase Pro $25/월 필요 시점 → 이 때부터 Cloud SQL도 경쟁력 있음
- 보안 요구: 공개 인터넷 DB 금지 정책 도입 시
- docstore와 aitutor를 **별도 DB로 분리**하기로 결정 시 (도메인 경계가 커짐)
- 극도로 낮은 지연이 필요한 대량 조회 기능 도입 시

### 3-4. 만약 나중에 Cloud SQL로 이관한다면 (Phase 2 사전 설계)

이관 시 필요한 작업은 다음과 같습니다.

```bash
# 1) Cloud SQL 인스턴스 생성 (asia-northeast3)
gcloud sql instances create aitutor-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-northeast3 \
  --storage-size=10GB --storage-type=HDD \
  --backup-start-time=03:00 \
  --project=aifactory-494108

# 2) 데이터베이스/사용자 생성
gcloud sql databases create aitutor --instance=aitutor-db --project=aifactory-494108
gcloud sql users create app_user --instance=aitutor-db --password=<GEN> --project=aifactory-494108

# 3) Supabase에서 dump (로컬)
pg_dump "postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres" \
  --clean --if-exists --no-owner --no-privileges \
  --exclude-schema=auth --exclude-schema=storage --exclude-schema=realtime \
  --exclude-schema=extensions --exclude-schema=graphql \
  -f aitutor-dump.sql

# 4) Cloud Storage 업로드 후 Cloud SQL import
gsutil cp aitutor-dump.sql gs://aifactory-494108-sql-import/
gcloud sql import sql aitutor-db gs://aifactory-494108-sql-import/aitutor-dump.sql \
  --database=aitutor --project=aifactory-494108

# 5) Cloud Run에 Cloud SQL 연결
gcloud run services update aitutor \
  --add-cloudsql-instances=aifactory-494108:asia-northeast3:aitutor-db \
  --update-env-vars=DATABASE_URL="postgresql://app_user:PASS@/aitutor?host=/cloudsql/aifactory-494108:asia-northeast3:aitutor-db" \
  --region=asia-northeast3 --project=aifactory-494108

# 6) api/db.js 수정 (SSL 옵션 제거 — Unix Socket에는 불필요)
```

이 설계는 **Phase 2 도입 시 참고**용으로 남겨두고, 이번 Phase 1에서는 실행하지 않습니다.

---

## 4. Cloud Run 아키텍처 설계

### 4-1. 최종 스펙

| 항목 | 값 | 근거 |
|------|-----|------|
| GCP 프로젝트 | `aifactory-494108` | 신규 프로젝트 (이미 생성됨) |
| 서비스명 | `aitutor` | 기존 Vercel 프로젝트명과 일관성 |
| 리전 | `asia-northeast3` (Seoul) | 전 서비스 통일 |
| 플랫폼 | managed | Cloud Run 완전관리형 |
| 컨테이너 | Node 22-alpine (멀티스테이지) | pressstand-paper/withbible 공통 패턴 |
| 포트 | 8080 | Cloud Run 기본 |
| **메모리** | **512 MiB** | pool-upload 20MB 파일 base64 처리 + pg 풀 + AI SDK 동시 구동 여유 |
| **CPU** | **1 vCPU** | SSE 스트리밍 1~2건 동시 대응에 충분 |
| **timeout** | **300초** | AI 장시간 추론(o3-pro, xhigh) 대응 (Vercel maxDuration=300과 동일) |
| min-instances | 0 | 유휴 비용 0 |
| max-instances | 3 | 비용 상한 + AI 동시 요청 대응 (withbible은 2였음) |
| concurrency | 40 (기본 80에서 하향) | pool-upload/SSE 동시성이 높으면 메모리 초과 방지 |
| cpu-boost | true | Cold start 1초 내 단축 |
| 인증 | unauthenticated (공개) | SPA 특성상 공개. 실제 인증은 앱 JWT가 담당 |
| 환경변수 | 9개 (아래 4-3 참조) | Vercel에서 이관 |

### 4-2. 디렉터리/컨테이너 설계

```
aifac/workspace/aitutor/
├── Dockerfile                ← 신규 (멀티스테이지)
├── .dockerignore             ← 신규
├── .gcloudignore             ← 신규
├── .gitignore                ← .env.* 패턴 추가
├── server.js                 ← 소폭 보강 (PORT=8080, trust proxy, cache headers, body limit)
├── package.json              ← engines.node>=22, start 확인
├── vite.config.js            ← 변경 없음
├── src/                      ← 변경 없음
├── public/                   ← 변경 없음
├── api/                      ← 변경 없음 (24개 핸들러)
├── dist/                     ← Dockerfile builder에서 재생성 (Git에 있어도 무시)
├── capacitor.config.json     ← server.url 변경 검토 (추후 네이티브 재빌드 시)
└── vercel.json               ← 유지 (롤백용 기록)
```

### 4-3. 환경변수 설계

| 변수명 | 용도 | 값 출처 | Cloud Run 주입 방식 |
|--------|------|---------|---------------------|
| `DATABASE_URL` | Supabase PostgreSQL | Vercel env pull | `--env-vars-file` |
| `AUTH_TOKEN_SECRET` | HMAC JWT 서명 (≥32자) | Vercel env pull | `--env-vars-file` |
| `GEMINI_API_KEY` | Gemini API + Vision | Vercel env pull | `--env-vars-file` |
| `OPENAI_API_KEY` | OpenAI API | Vercel env pull | `--env-vars-file` |
| `ANTHROPIC_API_KEY` | Claude API | Vercel env pull | `--env-vars-file` |
| `RESEND_API_KEY` | 이메일 인증코드 발송 | Vercel env pull | `--env-vars-file` |
| `LAW_API_OC` | 국가법령정보 DRF 계정 | Vercel env pull | `--env-vars-file` |
| `NODE_ENV` | `production` | Dockerfile ENV | 이미지 기본값 |
| `PORT` | `8080` | Cloud Run 자동 주입 | 플랫폼 제공 |

**보안**: `.env.production` 파일은 배포 직후 삭제. 장기적으로는 **Secret Manager** 이관 권장(후속 작업 섹션).

### 4-4. CORS 정책 업데이트

`api/cors.js`의 `ALLOWED_ORIGINS`에 Cloud Run URL을 추가해야 합니다.

```js
const ALLOWED_ORIGINS = [
  'https://aitutor-six.vercel.app',       // 기존 (롤백 대비 유지)
  'https://aitutor-<HASH>.a.run.app',     // 신규 (배포 후 기입)
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3002',
];
```

실제 클라이언트는 **같은 도메인에서 상대경로로 호출**하므로 CORS가 크게 문제되진 않습니다. 다만 Capacitor 앱이 `https://aitutor-six.vercel.app` URL을 임베드해 호출한다면 **원본이 해당 도메인**이라 그대로 동작합니다. 네이티브 앱을 Cloud Run URL로 재빌드할 때만 새 Origin 추가 필요.

---

## 5. 파일별 변경 사항 상세

### 5-1. `Dockerfile` (신규)

```dockerfile
# AI TutorTwo - Cloud Run 이미지 (멀티스테이지)
# withbible/Dockerfile 패턴 준용 + Vite 빌드 단계 추가

# ─── Stage 1: Builder (Vite 빌드 + devDependencies 포함) ───
FROM node:22-alpine AS builder

WORKDIR /app

# 의존성 설치 (devDependencies 포함 — vite, plugin 필요)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 후 프론트엔드 빌드
COPY . .
RUN npm run build:fe

# ─── Stage 2: Runtime (프로덕션 의존성만) ───
FROM node:22-alpine AS runtime

WORKDIR /app

# 프로덕션 의존성만 설치 (vite 등 제외)
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 런타임에 필요한 파일만 복사
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/api ./api
COPY --from=builder /app/dist ./dist

# Cloud Run 환경
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
```

**설계 근거**:
- 멀티스테이지로 런타임 이미지 크기 최소화 (빌드 도구 제거 → 약 150~200MB 수준)
- `public/q-images`는 `npm run build:fe` 시 Vite가 `dist/q-images`로 복사하므로 별도 COPY 불필요
- `.env`, `node_modules`, `tests` 등은 `.dockerignore`로 제외

### 5-2. `.dockerignore` (신규)

```
node_modules
npm-debug.log
.git
.gitignore
.vercel
.env
.env.*
test-results
playwright-report
tests
*.md
!package.json
!package-lock.json
Dockerfile
.dockerignore
.gcloudignore
pool
scripts
generate-answers.js
pool-*.js
register-network-questions.js
ios
android
capacitor.config.json
postcss.config.js
tailwind.config.js
playwright.config.js
```

**제외 이유**:
- `pool/`, `scripts/`, `generate-answers.js`, `pool-*.js`, `register-network-questions.js`: **로컬 배치 스크립트** (문제 데이터 가공). 런타임 불필요.
- `ios/`, `android/`, `capacitor.config.json`: 네이티브 앱 소스. 웹 서버에 불필요.
- `postcss.config.js`, `tailwind.config.js`: 빌드 단계에서만 필요. 런타임 불필요.
- `*.md`: 문서. `package.json`은 예외.

### 5-3. `.gcloudignore` (신규)

`gcloud run deploy --source=.` 시 Cloud Build로 업로드되는 파일을 제한.

```
# gcloud run deploy --source=. 업로드 제외
# Dockerfile이 COPY하는 파일은 제외하지 말 것
.git
.gitignore
.vercel
.env
.env.*
node_modules
npm-debug.log
test-results
playwright-report
tests
playwright.config.js
rebuild*.md
REBUILD*.md
PIPELINE.md
pool
scripts
generate-answers.js
pool-*.js
register-network-questions.js
ios
android
```

### 5-4. `.gitignore` 보강

기존에 `.env.*` 패턴 없음. Vercel env pull 결과가 커밋되지 않도록:

```diff
 node_modules
 .env
+.env.*
 ...
```

### 5-5. `server.js` 보강

현재 구조는 거의 완성되어 있습니다. 아래 변경만 적용:

```js
// server.js — Cloud Run 호환 버전
require('dotenv').config();  // 로컬 개발 시에만 의미 있음, Cloud Run은 env 자동 주입
const express = require('express');
const path = require('path');
const app = express();

// Cloud Run은 프록시 뒤 — 실제 클라이언트 IP 복원
app.set('trust proxy', true);

// 미들웨어: body limit을 pool-upload 최대치에 맞춰 25MB로 상향
app.use(express.json({ limit: '25mb' }));

// API 라우트 등록
const apiFiles = [
  'login','signup','auth','send-verification','forgot-password','delete-account',
  'questions','explanations','categories','memos','memo-files','bookmarks',
  'exam-results','gemini','openai','claude','law','admin',
  'import-docstore','pool-upload',
];
apiFiles.forEach(name => {
  try {
    const handler = require(`./api/${name}`);
    app.all(`/api/${name}`, (req, res) => handler(req, res));
    app.all(`/api/${name}/*`, (req, res) => handler(req, res));
  } catch (err) {
    console.warn(`[Server] api/${name}.js 로드 실패:`, err.message);
  }
});

// 정적 파일 — 캐시 정책 명시
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, {
  etag: false,
  setHeaders: (res, filePath) => {
    const rel = path.relative(distPath, filePath).replace(/\\/g, '/');
    // index.html: 항상 최신 받기
    if (rel === 'index.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (rel.startsWith('assets/')) {
      // Vite가 hash를 파일명에 박으므로 immutable 1년
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (rel.startsWith('q-images/')) {
      // 문제 이미지는 내용이 바뀌지 않음
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // 공통 보안 헤더
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  }
}));

// SPA 폴백 — /api/* 제외하고 index.html 반환
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distPath, 'index.html'));
});

// Cloud Run 포트 (기본 8080)
const PORT = parseInt(process.env.PORT, 10) || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AI TutorTwo] listening on 0.0.0.0:${PORT}`);
});

module.exports = app;
```

**변경 요점**:
1. `PORT` 기본값 `8080`으로 변경 (기존 3002)
2. `app.listen`에 `0.0.0.0` 바인딩 명시 (Cloud Run 필수)
3. `trust proxy` (IP 복원용, login.js의 rate-limit가 정확히 동작)
4. `body limit` `10mb` → `25mb` (pool-upload 20MB + base64 팽창 여유)
5. 정적 파일 캐시 정책 명시 (`assets/*` immutable, `index.html` no-cache)
6. 보안 헤더 추가 (`X-Content-Type-Options`, `X-Frame-Options`)
7. SPA 폴백에서 `/api/*` 명시 제외
8. `etag: false` — no-cache와 충돌 방지

### 5-6. `api/cors.js` 업데이트

```diff
 const ALLOWED_ORIGINS = [
   'https://aitutor-six.vercel.app',
+  // Cloud Run 배포 후 실제 URL 반영 (아래는 예시)
+  /^https:\/\/aitutor-[a-z0-9-]+\.a\.run\.app$/,   // 정규식으로 모든 리비전 URL 허용
+  'https://aitutor-472484684327.asia-northeast3.run.app',
   'http://localhost:5173',
   // ...
 ];
```

> 정규식 매칭은 `ALLOWED_ORIGINS.includes(origin)`이 정규식을 지원하지 않으므로 코드 수정이 따라야 합니다. 간단히 문자열만 쓰거나 루프에서 `.test()`로 체크하도록 수정:
> 
> ```js
> function isAllowedOrigin(origin) {
>   return ALLOWED_ORIGINS.some(o => typeof o === 'string' ? o === origin : o.test(origin));
> }
> ```

### 5-7. `capacitor.config.json` (네이티브 재빌드 시만)

현재 네이티브 앱은 `https://aitutor-six.vercel.app`을 임베드합니다. **기존 설치본은 그대로 Vercel을 바라보게 유지**하여 안전합니다. 신규 빌드부터 Cloud Run URL로 변경:

```json
{
  "appId": "com.aitutortwo.app",
  "appName": "AI TutorTwo",
  "webDir": "dist",
  "server": {
    "url": "https://aitutor-<HASH>.a.run.app",
    "cleartext": false
  }
}
```

이 변경은 이번 마이그레이션 범위에서 제외(Phase 2).

---

## 6. 단계별 실행 계획

### 단계 0: 사전 점검 (5분)

```bash
# GCP 프로젝트 확인
gcloud projects list | grep aifactory

# 현재 설정 프로젝트 확인/전환
gcloud config get-value project
gcloud config set project aifactory-494108

# 필요한 API 활성화
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project=aifactory-494108

# 인증 상태 확인
gcloud auth list
```

### 단계 1: Vercel 환경변수 안전 추출 (5분)

```bash
cd /Users/2team/aifac/workspace/aitutor

# 프로덕션 환경변수 다운로드
npx vercel env pull .env.production --environment=production --yes

# 내용 확인 (값은 가려서 확인)
sed 's/=.*/=<REDACTED>/' .env.production

# 예상 변수: DATABASE_URL, AUTH_TOKEN_SECRET, GEMINI_API_KEY,
# OPENAI_API_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, LAW_API_OC
```

**주의**: `.env.production`은 **절대 커밋하지 말 것**. `.gitignore`에 `.env.*` 포함되어 있는지 재확인.

### 단계 2: Cloud Run용 YAML 환경변수 파일 생성 (로그 노출 방지) (2분)

```bash
# 줄바꿈/따옴표 이슈 없는 안전한 YAML 변환 (권한 0600)
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.production', 'utf8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .map(l => {
    const idx = l.indexOf('=');
    const k = l.slice(0, idx).trim();
    let v = l.slice(idx + 1).trim();
    // Vercel env pull은 따옴표로 감싸져 올 수 있음
    if (v.startsWith('\"') && v.endsWith('\"')) v = v.slice(1, -1);
    return k + ': ' + JSON.stringify(v);
  })
  .join('\n');
fs.writeFileSync('/tmp/aitutor-env.yaml', env);
fs.chmodSync('/tmp/aitutor-env.yaml', 0o600);
console.log('환경변수 ' + env.split('\n').length + '개 기록 완료');
"

# 파일 존재만 확인 (내용은 로그에 찍지 않기)
wc -l /tmp/aitutor-env.yaml
```

### 단계 3: 설정 파일 신규 작성/수정 (10분)

순서대로 생성:

1. `Dockerfile` — 5-1 내용 그대로 저장
2. `.dockerignore` — 5-2 내용 그대로 저장
3. `.gcloudignore` — 5-3 내용 그대로 저장
4. `.gitignore` — `.env.*` 줄 추가
5. `server.js` — 5-5 내용으로 교체
6. `api/cors.js` — 5-6 `isAllowedOrigin()` 헬퍼 도입 후 `ALLOWED_ORIGINS`에 정규식/URL 추가. Cloud Run URL은 1차 배포 후 실값으로 교체하는 **2단계 배포** 권장

### 단계 4: 로컬 검증 (5분)

```bash
# 프론트엔드 빌드
npm run build:fe

# 포트 8080으로 실행해 Cloud Run 환경과 동일 조건 검증
PORT=8080 node server.js

# 별도 터미널에서 헬스체크
curl -I http://localhost:8080/                 # → 200 + index.html
curl http://localhost:8080/api/categories      # → {"categories":[...], "subjects":[...]}
```

### 단계 5: 최초 배포 (Cloud Build 포함 ~4~6분)

```bash
cd /Users/2team/aifac/workspace/aitutor

gcloud run deploy aitutor \
  --source=. \
  --project=aifactory-494108 \
  --region=asia-northeast3 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3 \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=40 \
  --port=8080 \
  --timeout=300 \
  --cpu-boost \
  --env-vars-file=/tmp/aitutor-env.yaml \
  --quiet
```

**로그 예상**:
- Cloud Build가 Dockerfile을 해석하여 이미지 빌드 (~3~4분)
- Artifact Registry에 push (~30초)
- Cloud Run 리비전 생성 + 트래픽 100% 할당 (~30초)
- 출력: `Service URL: https://aitutor-<HASH>.a.run.app` 저장

### 단계 6: CORS URL 반영 + 재배포 (2단계 배포, 5분)

```bash
# 배포된 URL 확인
CR_URL=$(gcloud run services describe aitutor \
  --project=aifactory-494108 --region=asia-northeast3 \
  --format='value(status.url)')
echo "Cloud Run URL: $CR_URL"

# api/cors.js의 ALLOWED_ORIGINS에 실제 URL 반영 (또는 정규식으로 처음부터 허용)
```

`api/cors.js`에 실 URL을 반영하고 다시 배포:

```bash
gcloud run deploy aitutor \
  --source=. --project=aifactory-494108 --region=asia-northeast3 --quiet
```

### 단계 7: 환경변수 파일 즉시 삭제 (30초)

```bash
rm -f /tmp/aitutor-env.yaml
rm -f /Users/2team/aifac/workspace/aitutor/.env.production
```

### 단계 8: 검증 (10분, 체크리스트는 7장 참조)

### 단계 9: REBUILD10.md에 실제 배포 결과 기록 (5분)

- 리비전 ID, URL, 배포 일시 기입
- 8장(비용 산정)의 실측치 반영

---

## 7. 배포 명령과 검증 체크리스트

### 7-1. 기능 검증 체크리스트

| # | 항목 | 명령/방법 | 기대 결과 |
|---|------|-----------|-----------|
| 1 | 루트 페이지 | `curl -I $CR_URL/` | 200, `Cache-Control: no-cache` |
| 2 | 정적 에셋 | `curl -I $CR_URL/assets/index-*.js` | 200, `Cache-Control: public, max-age=31536000, immutable` |
| 3 | 문제 이미지 | `curl -I $CR_URL/q-images/q001.png` | 200, immutable 캐시 |
| 4 | SPA 폴백 | `curl -I $CR_URL/quiz/card` | 200 + `index.html` |
| 5 | 카테고리 API | `curl $CR_URL/api/categories` | `{categories:[...], subjects:[...]}` |
| 6 | 공개 문제 API | `curl "$CR_URL/api/questions?action=public"` | `{questions:[...], exams:[...], categories:[...]}` |
| 7 | 회원가입 이메일 인증 | 브라우저로 signup 플로우 | Resend로 이메일 수신, DB에 `email_verifications` INSERT |
| 8 | 로그인 → JWT 쿠키 | 브라우저로 login, DevTools Cookies 확인 | `token` 쿠키(HttpOnly, Secure, SameSite=Lax) 발급 |
| 9 | 인증 필요 API | 로그인 후 `GET /api/memos?action=counts&question_ids=1,2,3` | 200 + counts |
| 10 | 401 리다이렉트 | 쿠키 삭제 후 인증 API 호출 | `401 {error:"..."}` → 클라이언트 자동 로그아웃 |
| 11 | Gemini SSE | 로그인 후 해설 생성 (Gemini 2.5 Flash) | 스트리밍 청크 수신, 본문 표시 |
| 12 | OpenAI SSE | GPT-4o 해설 생성 | 스트리밍 정상 |
| 13 | Claude SSE | Sonnet 4 해설 생성 | 스트리밍 정상 |
| 14 | 장시간 응답 | o3-pro + reasoningEffort=high | 180~240초 타임아웃 없이 완료 (Cloud Run timeout=300) |
| 15 | 이미지 첨부 AI | Gemini에 이미지 포함 요청 | 200 + 해석 응답 |
| 16 | 메모 CRUD | save → list → update → delete | 모두 200 |
| 17 | 첨부파일 업로드 | PNG 5MB 업로드 | 201 + 파일 메타 반환 |
| 18 | 첨부파일 다운로드 | download → base64 데이터 | 200 + `{filename, mime_type, data}` |
| 19 | 북마크 토글 | toggle 2회 | 등록/해제 순환 |
| 20 | 모의고사 저장 | exam-results save | DB에 레코드 + 랭킹 반영 |
| 21 | AI 해설 저장 | explanations save | question_explanations INSERT |
| 22 | 관리자 권한 체크 | 일반 계정으로 `/api/admin` | 403 |
| 23 | 법령 검색 | `POST /api/law {action:'search', query:'개인정보보호법'}` | 결과 배열 |
| 24 | pool-upload 추출 | 관리자가 샘플 PDF 업로드 | Gemini Vision 추출 → 미리보기 |
| 25 | 로그인 브루트포스 | 같은 IP로 잘못된 코드 6회 | 6번째부터 429 |
| 26 | 비밀번호 재설정 | reset 플로우 전체 | 성공 |
| 27 | 계정 탈퇴 | "탈퇴합니다" 입력 후 POST | 사용자 + 연관 데이터 삭제, 쿠키 제거 |

### 7-2. 로그 스트리밍 (배포 후 1시간 모니터링)

```bash
# 실시간 로그
gcloud run services logs tail aitutor \
  --project=aifactory-494108 --region=asia-northeast3

# 최근 50건
gcloud run services logs read aitutor \
  --project=aifactory-494108 --region=asia-northeast3 --limit=50
```

### 7-3. 성능/자원 모니터링

```bash
# 리비전 상태
gcloud run services describe aitutor \
  --project=aifactory-494108 --region=asia-northeast3

# 콘솔 대시보드 (브라우저)
# https://console.cloud.google.com/run/detail/asia-northeast3/aitutor/metrics?project=aifactory-494108
```

핵심 지표: Request latency, Memory usage, CPU utilization, Instance count, Error rate.

---

## 8. 비용 산정

### 8-1. Cloud Run 요금 (asia-northeast3, 2026-04 기준)

| 항목 | 요율 | 월 무료 티어 |
|------|------|--------------|
| CPU | $0.000024 / vCPU-sec | 180,000 vCPU-sec |
| 메모리 | $0.0000025 / GiB-sec | 360,000 GiB-sec |
| 요청 수 | $0.40 / 1M requests | 2,000,000 requests |
| 송신 네트워크 | ~$0.08 / GB | 1 GB |
| Cloud Build | $0.003 / min | 일 120분 |
| Artifact Registry | $0.10 / GB-month | — |

### 8-2. AI API 요금 (별도, Cloud Run 비용과 무관)

| 프로바이더 | 모델 | 참고 요금 (월 비용 아님) |
|------------|------|--------------------------|
| Gemini | 2.5 Flash | $0.075 / 1M input tokens, $0.30 / 1M output |
| OpenAI | GPT-4o | $2.50 / 1M input, $10 / 1M output |
| Claude | Sonnet 4 | $3 / 1M input, $15 / 1M output |

→ AI 비용은 **Cloud Run이 아닌 각 프로바이더 계정에서 과금**. Vercel 때와 동일. 마이그레이션으로 바뀌지 않습니다.

### 8-3. 트래픽 시나리오 (Cloud Run 부분만)

#### 시나리오 A: 실사용자 소수 (DAU 20, 월 600 세션, AI 요청 월 200건) — 현실적

| 항목 | 사용량 | 비용 |
|------|--------|------|
| 요청 수 | ~20,000 | 무료 티어 |
| CPU (512Mi, 요청당 200ms) | ~4,000 vCPU-sec | 무료 티어 |
| 메모리 | ~2,000 GiB-sec | 무료 티어 |
| AI SSE (건당 평균 30초, 1 vCPU 점유) | ~6,000 vCPU-sec | 무료 티어 |
| 네트워크 송신 | ~2 GB (이미지 포함) | ~$0.08 |
| Cloud Build | 주 1회 배포 | 무료 티어 |
| **합계** | | **~$0.1** |

#### 시나리오 B: 소규모 (DAU 200, 월 6,000 세션, AI 요청 월 2,000건)

| 항목 | 사용량 | 비용 |
|------|--------|------|
| 요청 수 | ~200,000 | 무료 티어 |
| CPU | ~100,000 vCPU-sec (무료 180K 내) | 무료 티어 |
| 메모리 | ~50,000 GiB-sec | 무료 티어 |
| 네트워크 송신 | ~20 GB | ~$1.52 |
| **합계** | | **~$2** |

#### 시나리오 C: 중형 (DAU 2,000, AI 요청 월 20,000건)

| 항목 | 사용량 | 비용 |
|------|--------|------|
| 요청 수 | ~2M | 무료 티어 경계 |
| CPU (AI 집중) | ~600K vCPU-sec (초과 420K) | ~$10.08 |
| 메모리 | ~300K GiB-sec | 무료 티어 |
| 네트워크 송신 | ~200 GB | ~$15.92 |
| **합계** | | **~$26** |

### 8-4. 예상 월 비용

- **현재 규모 (DAU 10~30)**: **월 $0~$2** (실질 무료)
- **성장 시나리오 (DAU 1,000)**: **월 $5~$10**
- **상한**: `max-instances=3` → 순간 트래픽 폭주 시에도 비용 상한 예측 가능

Supabase 유지 전략이므로 DB 비용은 $0 (무료 티어 500MB 내).

---

## 9. Capacitor(iOS/Android) 영향과 대응

### 9-1. 현 상황

```json
// capacitor.config.json (현재)
{
  "server": { "url": "https://aitutor-six.vercel.app", "cleartext": false }
}
```

네이티브 앱은 **Vercel URL을 WebView에 임베드**하는 방식. 즉 앱 자체는 껍데기이며, 실제 콘텐츠는 Vercel 서버에서 내려받습니다.

### 9-2. 두 가지 선택지

| 선택 | 설명 | 장단점 |
|------|------|--------|
| **A. 기존 설치본 유지, 신규 빌드만 Cloud Run** | `capacitor.config.json`을 Cloud Run URL로 업데이트. `npm run cap:build && 각 플랫폼 재배포`. 기존 설치본은 계속 Vercel 참조. | 안전. 사용자 영향 없음. Vercel을 당분간 유지해야 함. |
| **B. Vercel 즉시 종료 → 기존 설치본 강제 업데이트** | Vercel 프로덕션 비활성화. 기존 앱은 동작 중단. | 위험. 사용자 손실 가능. 권장 안 함. |

**권장**: Phase 1에서는 웹만 Cloud Run 전환, Capacitor 앱은 Vercel을 1~2주 병행 유지. 안정 확인 후 Phase 2에서 네이티브 재빌드 + 스토어 업데이트.

### 9-3. Vercel 종료 타이밍

1. Cloud Run 2주 안정 운영 (에러율 < 1%, 평균 latency < 500ms)
2. Capacitor 앱 신규 버전 배포 (App Store/Google Play 심사 통과)
3. 구버전 앱 사용자에게 업데이트 유도 공지
4. Vercel 프로덕션 배포 비활성화 (프로젝트 자체는 삭제하지 말고 아카이브)

---

## 10. 롤백 절차

### 10-1. 즉시 롤백 (Cloud Run 이전 리비전으로)

```bash
# 리비전 목록
gcloud run revisions list --service=aitutor \
  --project=aifactory-494108 --region=asia-northeast3

# 이전 리비전으로 트래픽 전환
gcloud run services update-traffic aitutor \
  --to-revisions=aitutor-<PREV_REVISION>=100 \
  --project=aifactory-494108 --region=asia-northeast3
```

### 10-2. 완전 롤백 (Vercel로 복귀)

Vercel 프로젝트는 유지되어 있으므로:
1. 도메인(있다면) DNS를 Vercel로 재지정
2. 없다면 `https://aitutor-six.vercel.app` 주소 공지
3. Cloud Run 서비스는 `min-instances=0`이라 방치해도 비용 거의 없음

```bash
# Cloud Run 서비스 완전 삭제 (필요 시만)
gcloud run services delete aitutor \
  --project=aifactory-494108 --region=asia-northeast3 --quiet
```

### 10-3. DB 롤백

Phase 1은 Supabase 유지이므로 DB 롤백 불필요 (데이터는 그대로).

---

## 11. 후속 권장 작업

| 우선순위 | 작업 | 비고 |
|---------|------|------|
| High | Vercel 프로덕션 비활성화 | Cloud Run 2주 안정 확인 후 |
| High | `.env.*` `.gitignore` 확실히 반영 | 시크릿 커밋 방지 |
| Medium | **Secret Manager 이관** | `DATABASE_URL`, AI API 키를 Secret Manager로 옮기고 `--set-secrets`로 마운트 |
| Medium | `robots.txt` 추가 | 봇 크롤링 억제 |
| Medium | Playwright baseURL 환경변수화 | 로컬/프로덕션 테스트 전환 |
| Medium | **Supabase 프로젝트 리전 확인** | AWS Tokyo 이상이면 지연 허용. us-east면 Seoul 리전으로 마이그레이션 검토 |
| Medium | 월 예산 알림 설정 | $10/$20 임계값 |
| Medium | `send-verification.js`의 인메모리 rate-limit → DB 기반 전환 | 멀티 인스턴스 일관성 |
| Low | Capacitor 앱 재빌드 | Cloud Run URL 반영 |
| Low | `cloudbuild.yaml`로 자동 CI/CD | GitHub Actions 연동 |
| Low | Cloud Logging 에러 알림 | 트래픽 증가 시 |
| Low | Cloud Run → Cloud SQL 이관(Phase 2) | DAU 10,000+ 시점 |
| Low | 커스텀 도메인 연결 | `gcloud run domain-mappings create` |

### 11-1. Secret Manager 이관 예시 (권장 후속)

```bash
# 시크릿 생성
gcloud secrets create aitutor-db-url --project=aifactory-494108 \
  --data-file=<(echo -n "postgresql://...")

gcloud secrets add-iam-policy-binding aitutor-db-url \
  --member=serviceAccount:58235609672-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=aifactory-494108

# Cloud Run에 마운트
gcloud run services update aitutor \
  --set-secrets=DATABASE_URL=aitutor-db-url:latest \
  --project=aifactory-494108 --region=asia-northeast3
```

환경변수로 평문 전달하지 않고 IAM 기반으로 안전하게 주입됩니다.

---

## 12. 부록: 환경변수 / DB 스키마

### 12-1. 환경변수 전체 목록

| 변수명 | 필수 | 최소 길이 | 기능 없을 때 영향 |
|--------|------|-----------|-------------------|
| `DATABASE_URL` | ✅ | — | 모든 DB 기능 불가 (거의 모든 API) |
| `AUTH_TOKEN_SECRET` | ✅ | 32자 | 토큰 발급 거부 → 로그인 불가 |
| `GEMINI_API_KEY` | ✅ | — | Gemini 프록시 500, pool-upload 500 |
| `OPENAI_API_KEY` | ✅ | — | OpenAI 프록시 500 |
| `ANTHROPIC_API_KEY` | ✅ | — | Claude 프록시 500 |
| `RESEND_API_KEY` | ✅ | — | 이메일 인증/회원가입/비밀번호 재설정 불가 |
| `LAW_API_OC` | ⚠️ | — | 법령 검색 500 (핵심 기능은 아님) |
| `NODE_ENV` | ⚠️ | — | 쿠키 `Secure` 플래그 비적용 |
| `PORT` | — | — | Cloud Run 자동 주입 |

### 12-2. 전체 DB 테이블 목록 (심층 분석으로 확인된 것)

```sql
-- 사용자
public.users (id, username, email, name, password_hash, is_admin, created_at)

-- 분류 체계
categories (id, name, sort_order, created_at)
subjects (id, name, category_id, sort_order)
exams (id, title, exam_date, category_id, sort_order)

-- 문제
questions (id, exam_id, subject_id, question_number, original_number,
           body, choices(JSON), answer, explanation, image_url, updated_at)

-- 학습 활동
question_memos (id, question_id, user_id, content, created_at, updated_at)
memo_files (id, memo_id, filename, mime_type, data, size, created_at)
question_bookmarks (id, question_id, user_id, tag, created_at)
exam_results (id, exam_id, category_id, user_id, total_questions,
              correct_count, wrong_count, score, time_spent, time_limit,
              answers(JSON), created_at)
question_explanations (id, question_id, provider, model, content,
                       extra_prompt, created_at)

-- 인증/보안
email_verifications (id, email, code, type, expires_at, used, created_at)
login_attempts (ip PK, count, reset_at)  -- login.js에서 자동 생성

-- 외부 참조 (docstore 소유)
exam_questions (id, exam_id, question_number, body, choices, answer, explanation)
```

### 12-3. 배포 후 기입 (실제 값은 배포 후 채움)

| 항목 | 값 |
|------|-----|
| 리비전 ID | `aitutor-00001-xxx` |
| 서비스 URL (단축) | `https://aitutor-xxxxxx-du.a.run.app` |
| 서비스 URL (번호) | `https://aitutor-58235609672.asia-northeast3.run.app` |
| 배포 일시 | `YYYY-MM-DD HH:MM KST` |
| 배포 결과 | ✅ / ⚠️ / ❌ |
| 초기 리비전 설정 | CPU=1, Mem=512Mi, Concurrency=40, Timeout=300, Min=0, Max=3 |
| 환경변수 개수 | 7개 + NODE_ENV/PORT |

---

## 13. 실행 요약

```bash
# Phase 1: Cloud Run 마이그레이션 전체 플로우
cd /Users/2team/aifac/workspace/aitutor

# 1) Vercel env 추출 → YAML
npx vercel env pull .env.production --environment=production --yes
node -e "/* YAML 변환 스크립트 (단계 2 참조) */"

# 2) Dockerfile / .dockerignore / .gcloudignore / server.js 보강 (파일 편집)

# 3) 로컬 검증
npm run build:fe && PORT=8080 node server.js &
curl -I http://localhost:8080/
kill %1

# 4) 배포
gcloud run deploy aitutor \
  --source=. \
  --project=aifactory-494108 \
  --region=asia-northeast3 \
  --allow-unauthenticated \
  --memory=512Mi --cpu=1 --concurrency=40 \
  --timeout=300 --port=8080 \
  --min-instances=0 --max-instances=3 --cpu-boost \
  --env-vars-file=/tmp/aitutor-env.yaml \
  --quiet

# 5) 정리 + CORS URL 반영 + 재배포
rm -f /tmp/aitutor-env.yaml .env.production
# (api/cors.js 편집 후)
gcloud run deploy aitutor --source=. \
  --project=aifactory-494108 --region=asia-northeast3 --quiet

# 6) 검증 (7장 체크리스트)
# 7) REBUILD10.md §12-3에 결과 기입
```

---

**다음 Phase**(상황에 따라 별도 문서로 분리):
- Phase 2-a: Capacitor 앱 Cloud Run URL로 재빌드 + 스토어 업데이트
- Phase 2-b: Secret Manager 이관
- Phase 2-c: (필요 시) Supabase → Cloud SQL 이관 — 단, `docstore`와의 DB 공유 관계 재설계 선결

---

## 부록 A: AWS 대안 심층 분석 (aws CLI 기반 마이그레이션)

본 부록은 **AWS로 가기로 결정할 경우에 대비한 완전한 대안 설계**입니다. 본문(§1~§12)의 GCP Cloud Run 설계와 **섹션 간 번호가 독립**되어 있어 AWS 단독으로도 실행 가능합니다.

### A.1. AWS 서비스 옵션 매트릭스

| 서비스 | 역할 | Cloud Run 대응 | SSE 스트리밍 | min=0 가능 | 복잡도 | 월 최저비 (0.25 vCPU/0.5GB급) |
|--------|------|----------------|--------------|------------|--------|------------------------------|
| **App Runner** | 관리형 컨테이너 | ≒ Cloud Run | ✅ 지원 | ⚠️ Paused 모드는 있으나 수동 재개 | 낮음 | **~$25~$30/월** (상시 active) / $0 (paused) |
| **Lightsail Containers** | 저가 컨테이너 | ≒ Cloud Run 저사양 | ✅ 지원 | ❌ 항상 과금 | 낮음 | **$7/월** (nano) |
| **ECS Fargate + ALB** | 서버리스 컨테이너 | ≒ Cloud Run 고급 | ✅ 지원 | ⚠️ desired=0 가능하나 ALB 고정비 | 중 | **~$20/월** (ALB $18 + 태스크) |
| **Lambda + API Gateway (or Function URL)** | FaaS | ≒ Cloud Functions | 🟡 Response Streaming 최근 지원(Function URL 한정, 15분 상한) | ✅ | 중-높 (24개 함수 관리) | **~$0** (무료 티어 내) |
| **Elastic Beanstalk** | PaaS (EC2 기반) | ≒ Compute Engine 관리형 | ✅ | ❌ EC2 상시 | 중 | **~$8~$15/월** (t3.micro) |
| **Amplify Hosting + Lambda** | SPA + FaaS | ≒ Firebase Hosting | 🟡 (Lambda 제약과 동일) | ✅ | 중 | 무료 티어 내 |

### A.2. 후보 압축: **App Runner** vs **Lightsail Containers** vs **Lambda**

위 6개 중 이 프로젝트에 현실적인 후보는 3개입니다.

#### A.2.1. AWS App Runner — Cloud Run의 AWS 버전

**특징**:
- 소스(GitHub) 또는 ECR 이미지 기반 배포, HTTPS/오토스케일링 자동
- Node.js 런타임 직접 지원 (이미지 없이 `apprunner.yaml`로 배포 가능)
- 최소 크기: **0.25 vCPU / 0.5 GB** (월 약 $25)
- **Paused 모드** 존재: 요청 없을 때 일시정지 가능하나 `Resume` 수동 필요 (Cloud Run의 min=0 자동 스케일다운과 다름)
- SSE 스트리밍: 네이티브 지원 (ALB 뒤가 아님)
- 리전: `ap-northeast-2` (Seoul) 사용 가능

**맞는 케이스**: Cloud Run과 가장 유사한 DX. 단, 상시 active 시 월 $25+ 고정비 부담.

#### A.2.2. Lightsail Containers — 저가 고정가격

**특징**:
- **월정액 고정**: nano $7, micro $10, small $20, medium $40
- nano = 0.25 vCPU / 512MB / 500GB 트래픽 포함
- **Paused/Pause 없음** — 항상 실행
- 오토스케일링 없음 (노드 수를 수동 지정)
- SSE 지원
- 구성 매우 단순 (정말 월정액 월세 개념)

**맞는 케이스**: 예측 가능한 저가 운영, 트래픽 변동 적음. 단 pool-upload/AI 스트리밍 동시성이 높으면 nano로는 부족할 수 있어 **micro $10/월**이 현실선.

#### A.2.3. Lambda + Function URL — Vercel 가장 유사한 서버리스

**특징**:
- 요청당 과금, **실질 무료 티어 크게 가능** (월 1M 요청, 400K GB-sec)
- Function URL + **Response Streaming** 으로 SSE 지원 (2023 이후)
- 15분 타임아웃 (300초보다 길어서 AI 장시간 추론도 OK)
- **한 함수 한 URL**이 원칙 → 24개 Function URL 관리 부담
- `express` 앱을 **단일 Lambda로 감싸는 `lambda-express-adapter`** 조합 가능 → 현재 Express 코드 대부분 재사용

**맞는 케이스**: 트래픽이 적고 비용 민감, Vercel 경험을 AWS로 이식.

**트레이드오프**: cold start 수백 ms, 메모리 2~3GB 설정 시 비용 상승, VPC 연결 시 cold start 증가.

### A.3. GCP Cloud Run vs AWS App Runner 1:1 비교

| 축 | GCP Cloud Run | AWS App Runner |
|----|---------------|----------------|
| 배포 방식 | `gcloud run deploy --source=.` → Cloud Build 자동 | ECR push → `aws apprunner create-service` 또는 `source-configuration`으로 GitHub 연동 |
| 리전 | `asia-northeast3` (Seoul) | `ap-northeast-2` (Seoul) |
| 최소 인스턴스 | **0** (유휴 시 완전 종료, $0) | **1** (active 시) / 수동 Paused (Cold resume ~수 초~수십 초) |
| 최소 스펙 | 128MB / 0.08 vCPU | 512MB / 0.25 vCPU |
| 과금 모델 | **초당 vCPU/메모리** 사용량 + 요청 수 (무료 티어: 180K vCPU-sec, 360K GiB-sec, 2M 요청) | **시간당 vCPU/메모리** 프로비저닝 + 요청당 처리 시간 (무료 티어: 제한적) |
| SSE 스트리밍 | ✅ 기본 | ✅ 기본 |
| 타임아웃 | 최대 **60분** (기본 300초 설정 권장) | 최대 **120초** (2024 이후) — **O3 pro 장시간 추론(300초+)은 주의 필요** |
| Cold start | ~1초 (cpu-boost) | ~수 초 (paused에서 resume 시 더 김) |
| 기존 앱 통일성 | ✅ 모든 서비스 GCP로 통일 (6개 서비스) | ❌ 유일한 AWS 서비스로 이질 |
| Supabase 리전과의 거리 | Supabase가 AWS 기반이므로 GCP에서는 다른 클라우드를 거침 (~20~40ms) | **Supabase가 AWS-Seoul 또는 Tokyo면 같은 클라우드 내부 네트워크 (~5ms)** |
| IAM 복잡도 | 단순 (프로젝트 단위) | 복잡 (IAM 정책/역할 필수 이해) |
| 로깅 | Cloud Logging 기본 | CloudWatch Logs 기본 |
| 비밀 관리 | Secret Manager | AWS Secrets Manager / SSM Parameter Store |
| 월 최저 비용 (실질) | **$0** (무료 티어 충분) | **$25+** (active) / $0 (paused, 하지만 운영 현실적 어려움) |
| CLI 툴 | `gcloud` | `aws` |

### A.4. App Runner 타임아웃 이슈 — 프로젝트 특수성

aitutor에는 **o3-pro + reasoningEffort=high** 같은 OpenAI 장시간 추론이 최대 5분까지 걸릴 수 있어요. App Runner는 **요청당 최대 120초**가 기본 제한이므로:

- **해결안 1**: OpenAI 요청 중 120초를 넘길 가능성이 있는 모델을 클라이언트에서 제한 (`reasoningEffort=medium` 이하 강제)
- **해결안 2**: App Runner 대신 **ECS Fargate + ALB** 선택 (ALB idle timeout 최대 4000초)
- **해결안 3**: **Lambda Function URL + Response Streaming** 선택 (15분 상한)

→ AWS 선택 시 **App Runner가 Cloud Run 대비 유일한 명확한 약점**입니다. aitutor의 핵심 기능(장시간 추론)이 제약받을 수 있음.

### A.5. 권장 AWS 조합: **App Runner + Supabase 유지** (단, 120초 제약 수용 시)

- 일반 사용(Gemini Flash, GPT-4o, Claude Sonnet)은 대부분 120초 이내 완료
- o3-pro/xhigh만 사용자에게 "2분 이상 걸릴 수 있는 모델"로 경고 또는 비활성화
- DB는 **Supabase 그대로 유지** (GCP 전략 §3과 동일 논리)

**장시간 추론을 꼭 살려야 하면** → **ECS Fargate + ALB** 또는 **Lambda Function URL**을 고려.

### A.6. Dockerfile/서버 구성 — GCP와 100% 공유

**Dockerfile, `.dockerignore`, `server.js`는 §5에 제공한 내용 그대로 사용 가능합니다.** App Runner도 표준 컨테이너를 실행하므로 `PORT=8080` 바인딩, 정적 서빙, SPA 폴백이 동일하게 동작.

유일한 차이는:
- `.gcloudignore` → **불필요** (ECR에 이미 빌드된 이미지를 push하므로 디렉터리 업로드 없음)
- 환경변수 주입 방식: `--env-vars-file` 대신 App Runner 서비스 정의 JSON의 `RuntimeEnvironmentVariables`

### A.7. 사전 준비: AWS CLI 설정

```bash
# AWS CLI 설치 확인
aws --version   # aws-cli/2.x 필요

# 로그인 (관리자 SSO 또는 IAM 사용자 키)
aws configure sso            # 권장
# 또는
aws configure                # Access Key / Secret Key 입력

# 리전 고정
aws configure set region ap-northeast-2

# 계정 확인
aws sts get-caller-identity
```

IAM 사용자에게 필요한 권한 (최소 권한):
- `AWSAppRunnerFullAccess` (App Runner 서비스 CRUD)
- `AmazonEC2ContainerRegistryPowerUser` (ECR push)
- `SecretsManagerReadWrite` (선택, 시크릿 관리)
- `AWSCodeBuildDeveloperAccess` (선택, CodeBuild 사용 시)

### A.8. ECR 준비 + 이미지 빌드/푸시

```bash
# 1) ECR 레포지토리 생성
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=ap-northeast-2
ECR_REPO=aitutor

aws ecr create-repository \
  --repository-name $ECR_REPO \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
echo "ECR URI: $ECR_URI"

# 2) ECR 로그인
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin "${ECR_URI}"

# 3) 이미지 빌드 (로컬, 멀티 아키텍처 대응)
cd /Users/2team/aifac/workspace/aitutor
docker buildx build \
  --platform linux/amd64 \
  -t "${ECR_URI}:latest" \
  -t "${ECR_URI}:$(git rev-parse --short HEAD)" \
  --push \
  .
```

> Apple Silicon(M1/M2) 로컬에서 빌드 시 `--platform linux/amd64` 필수. App Runner는 현재 x86_64만 지원.

### A.9. App Runner 서비스 생성

환경변수는 **Secrets Manager** 또는 **인라인 RuntimeEnvironmentVariables** 두 방식.

#### A.9.1. Secrets Manager에 민감정보 저장

```bash
# DATABASE_URL
aws secretsmanager create-secret \
  --name aitutor/DATABASE_URL \
  --secret-string "$(grep ^DATABASE_URL= .env.production | cut -d= -f2-)"

# AUTH_TOKEN_SECRET
aws secretsmanager create-secret \
  --name aitutor/AUTH_TOKEN_SECRET \
  --secret-string "$(grep ^AUTH_TOKEN_SECRET= .env.production | cut -d= -f2-)"

# AI API 키들 (반복)
for K in GEMINI_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  V=$(grep "^${K}=" .env.production | cut -d= -f2-)
  aws secretsmanager create-secret --name "aitutor/${K}" --secret-string "$V"
done

# 시크릿 ARN 목록 저장
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  aws secretsmanager describe-secret --secret-id "aitutor/${K}" --query 'ARN' --output text
done
```

#### A.9.2. App Runner 인스턴스 역할 생성 (Secrets 접근용)

```bash
# 신뢰 정책
cat > /tmp/apprunner-trust.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
JSON

aws iam create-role \
  --role-name AppRunnerAitutorInstanceRole \
  --assume-role-policy-document file:///tmp/apprunner-trust.json

# Secrets 읽기 권한
cat > /tmp/apprunner-secrets-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/*"
  }]
}
JSON

aws iam put-role-policy \
  --role-name AppRunnerAitutorInstanceRole \
  --policy-name AitutorSecretsRead \
  --policy-document file:///tmp/apprunner-secrets-policy.json
```

#### A.9.3. App Runner 서비스 정의 JSON

```bash
INSTANCE_ROLE_ARN=$(aws iam get-role --role-name AppRunnerAitutorInstanceRole --query 'Role.Arn' --output text)

# ECR 접근 역할 (Amazon이 관리하는 표준 역할 사용 가능)
ACCESS_ROLE_ARN=$(aws iam list-roles --query "Roles[?RoleName=='AppRunnerECRAccessRole'].Arn | [0]" --output text)
if [ "$ACCESS_ROLE_ARN" = "None" ] || [ -z "$ACCESS_ROLE_ARN" ]; then
  # 없으면 생성
  cat > /tmp/apprunner-ecr-trust.json <<'JSON'
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "build.apprunner.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }
JSON
  aws iam create-role --role-name AppRunnerECRAccessRole \
    --assume-role-policy-document file:///tmp/apprunner-ecr-trust.json
  aws iam attach-role-policy --role-name AppRunnerECRAccessRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
  ACCESS_ROLE_ARN=$(aws iam get-role --role-name AppRunnerECRAccessRole --query 'Role.Arn' --output text)
fi

# 서비스 정의
cat > /tmp/apprunner-aitutor.json <<JSON
{
  "ServiceName": "aitutor",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "${ECR_URI}:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8080",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production"
        },
        "RuntimeEnvironmentSecrets": {
          "DATABASE_URL": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/DATABASE_URL",
          "AUTH_TOKEN_SECRET": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/AUTH_TOKEN_SECRET",
          "GEMINI_API_KEY": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/GEMINI_API_KEY",
          "OPENAI_API_KEY": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/OPENAI_API_KEY",
          "ANTHROPIC_API_KEY": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/ANTHROPIC_API_KEY",
          "RESEND_API_KEY": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/RESEND_API_KEY",
          "LAW_API_OC": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:aitutor/LAW_API_OC"
        }
      }
    },
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "${ACCESS_ROLE_ARN}"
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB",
    "InstanceRoleArn": "${INSTANCE_ROLE_ARN}"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 3
  }
}
JSON

# 서비스 생성
aws apprunner create-service --cli-input-json file:///tmp/apprunner-aitutor.json

# 생성 상태 polling
aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='aitutor']"
```

**메모리 2 GB 선택 이유**: App Runner는 vCPU-메모리 조합이 고정입니다. 1 vCPU에 쓸 수 있는 옵션은 `2 GB` 또는 `3 GB`. Cloud Run의 1 vCPU / 512 MB에 해당하는 옵션이 없어 비용이 Cloud Run 대비 **약 2~3배** 증가합니다. (0.25 vCPU 선택 시 pool-upload/AI 동시성 부족 우려)

### A.10. 배포 후 URL 획득 + 검증

```bash
# App Runner 서비스 URL
SERVICE_URL=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='aitutor'].ServiceUrl | [0]" \
  --output text)
echo "https://${SERVICE_URL}"

# 검증 (§7의 체크리스트를 동일하게 실행)
curl -I "https://${SERVICE_URL}/"
curl "https://${SERVICE_URL}/api/categories"
```

### A.11. 재배포 (신규 이미지 + 서비스 업데이트)

```bash
# 새 이미지 push
docker buildx build --platform linux/amd64 \
  -t "${ECR_URI}:latest" \
  -t "${ECR_URI}:$(git rev-parse --short HEAD)" \
  --push .

# App Runner에 재배포 트리거
SERVICE_ARN=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='aitutor'].ServiceArn | [0]" \
  --output text)

aws apprunner start-deployment --service-arn "$SERVICE_ARN"
```

**자동 배포** 원하면 서비스 JSON의 `AutoDeploymentsEnabled: true`로 설정 → ECR `:latest` 푸시 시 자동 배포.

### A.12. 로그 / 모니터링

```bash
# CloudWatch Logs 로그 그룹
aws logs describe-log-groups --log-group-name-prefix "/aws/apprunner/aitutor"

# 실시간 tail
aws logs tail "/aws/apprunner/aitutor/<SERVICE_ID>/application" --follow --region ap-northeast-2
```

### A.13. Paused / Resume — 유휴 비용 관리

```bash
# 유휴 상태로 전환 (요청 처리 중지, 비용 거의 0)
aws apprunner pause-service --service-arn "$SERVICE_ARN"

# 재개 (수 초~수십 초 소요)
aws apprunner resume-service --service-arn "$SERVICE_ARN"
```

> Cloud Run의 **자동** min=0 스케일다운과 달리 App Runner Paused는 **수동 조작**입니다. 프로덕션 서비스에 적용하려면 Lambda + EventBridge로 야간 자동 pause 스크립트를 따로 만들어야 해요.

### A.14. AWS 비용 산정 (asia-seoul, 2026-04 기준)

#### App Runner (active 상태, 1 vCPU / 2 GB, Seoul)

| 항목 | 요율 | 월 비용 (24/7) |
|------|------|----------------|
| vCPU | $0.064 / vCPU-hour | 1 × 24 × 30 × $0.064 = **$46** |
| 메모리 | $0.007 / GB-hour | 2 × 24 × 30 × $0.007 = **$10** |
| 요청 | $0.00003 / 요청 (20만 무료) | 트래픽 소수면 ~$0 |
| **합계** | | **~$56/월** (active 상시) |

> 공식 블로그는 "0.25 vCPU/0.5 GB = ~$25/월"로 안내하지만 aitutor에는 부족할 수 있음. **현실적 최저선은 1 vCPU/2 GB = ~$56/월**.

#### Lightsail Containers (nano, 0.25 vCPU / 0.5 GB, Seoul)

| 플랜 | 월 비용 | 포함 트래픽 |
|------|---------|-------------|
| Nano | $7 | 500 GB |
| Micro | $10 | 500 GB |
| Small | $20 | 500 GB |
| Medium | $40 | 500 GB |

aitutor는 **Micro $10** 이상이 안전선 (pool-upload 20MB + AI 동시성 2건).

#### Lambda Function URL (Response Streaming)

| 항목 | 요율 | 월 비용 (DAU 200 기준) |
|------|------|------------------------|
| 요청 | $0.20 / 1M (무료 1M) | **무료 티어** |
| 컴퓨팅 | $0.0000166667 / GB-sec (무료 400K GB-sec) | **무료 티어** |
| Secrets Manager | $0.40 / 시크릿 / 월 | 7개 × $0.40 = **$2.80** |
| **합계** | | **~$3/월** |

> Lambda는 Vercel의 실질 $0과 가장 유사한 비용 구조.

#### 추가 AWS 공통 비용

| 항목 | 월 비용 |
|------|---------|
| ECR 스토리지 | 0.5GB = **$0.05** |
| CloudWatch Logs | 5GB 무료, 초과 $0.76/GB |
| Secrets Manager | $0.40/시크릿 × 7 = **$2.80** |
| 네트워크 송신 | 1GB 무료, 초과 $0.126/GB (Seoul) |

### A.15. AWS 측 DB 전략 — Supabase 리전 매칭이 핵심

#### A.15.1. Supabase 리전 확인 먼저

```bash
# Supabase 대시보드 > Project Settings > Infrastructure 에서 확인
# 또는 DATABASE_URL의 호스트로 추정 (db.<ref>.supabase.co → ping/whois)
```

Supabase는 **AWS 위에서 운영**됩니다. 주요 아시아 리전:
- `ap-northeast-1` (Tokyo)
- `ap-northeast-2` (Seoul) — 신규 추가
- `ap-southeast-1` (Singapore)

#### A.15.2. 리전 조합별 지연 시간

| App Runner 리전 | Supabase 리전 | 예상 지연 |
|-----------------|---------------|-----------|
| ap-northeast-2 (Seoul) | ap-northeast-2 (Seoul) | **~1~3ms** ⭐ 최적 |
| ap-northeast-2 (Seoul) | ap-northeast-1 (Tokyo) | ~30~40ms |
| ap-northeast-2 (Seoul) | us-east-1 (N. Virginia) | ~200ms+ |

#### A.15.3. DB 이관 옵션

| 전략 | 판단 |
|------|------|
| **Supabase 유지** | ✅ **권장**. §3과 동일 논리. AWS로 가더라도 DB는 옮길 필요 없음. 오히려 Supabase와 App Runner가 같은 AWS 리전이면 네트워크적으로 유리. |
| AWS RDS PostgreSQL 이관 | ⚠️ 고비용 (t4g.micro Single-AZ 기준 ~$12~$15/월). Supabase가 이미 AWS이므로 이관 이득 제한적. |
| Aurora Serverless v2 | ⚠️ 최저 0.5 ACU = 약 $43/월. 오버킬. |

**결론**: AWS로 가더라도 **DB는 Supabase 유지**가 최적. §3의 결론은 플랫폼(GCP/AWS) 무관하게 유효.

### A.16. AWS 배포 실행 요약 (압축 체크리스트)

```bash
# ─── 사전 ───
aws --version && aws sts get-caller-identity
aws configure set region ap-northeast-2

# ─── 1. Vercel env 추출 ───
cd /Users/2team/aifac/workspace/aitutor
npx vercel env pull .env.production --environment=production --yes

# ─── 2. Secrets Manager 업로드 (A.9.1) ───
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  V=$(grep "^${K}=" .env.production | cut -d= -f2-)
  aws secretsmanager create-secret --name "aitutor/${K}" --secret-string "$V"
done

# ─── 3. Dockerfile 작성 (§5-1 그대로) ───

# ─── 4. ECR + 이미지 push (A.8) ───
aws ecr create-repository --repository-name aitutor
# (buildx로 linux/amd64 빌드 + push)

# ─── 5. IAM 역할 2개 생성 (A.9.2) ───
# AppRunnerAitutorInstanceRole, AppRunnerECRAccessRole

# ─── 6. App Runner 서비스 생성 (A.9.3) ───
aws apprunner create-service --cli-input-json file:///tmp/apprunner-aitutor.json

# ─── 7. 정리 ───
rm -f .env.production

# ─── 8. 검증 (§7 체크리스트 동일 적용) ───
# ─── 9. CORS URL 반영 후 이미지 재빌드/재배포 ───
```

### A.17. AWS 선택 시 주의사항

| 이슈 | 내용 |
|------|------|
| **타임아웃 120초 제약** | o3-pro/xhigh 모델 사용 불가. 클라이언트에서 모델 화이트리스트 필터링 필요 |
| **min=0 자동 미지원** | Paused는 수동. 야간 자동 pause를 원하면 별도 Lambda+EventBridge 구성 |
| **IAM 학습 곡선** | 신뢰 정책, 역할, Resource ARN 개념 선행 학습 필요 |
| **buildx 플랫폼 명시** | Apple Silicon 로컬 빌드 시 `--platform linux/amd64` 누락하면 App Runner에서 exec format error |
| **리전 통일** | Supabase/Secrets/ECR/App Runner 모두 `ap-northeast-2`로 통일해야 지연/비용 최적 |
| **CloudWatch Logs 비용** | 에러 로그 많으면 과금. 로그 보관 기간 7일로 제한 권장 |

---

## 최종 권장 매트릭스 (GCP vs AWS)

### 결정 축 및 점수 (5점 만점)

| 결정 축 | 가중치 | GCP Cloud Run | AWS App Runner | AWS Lightsail Containers | AWS Lambda |
|---------|-------|---------------|----------------|--------------------------|------------|
| **이번 이관 공수** | 20% | 5 (withbible 패턴 재사용) | 3 (신규 IAM/ECR 학습) | 3 (동일) | 2 (함수 매핑 고민) |
| **월 비용 (현재 규모)** | 20% | **5** ($0~$2) | 2 ($56+) | 4 ($10) | **5** ($3) |
| **기능 온전성 (장시간 AI)** | 20% | **5** (timeout 300~3600초) | 2 (120초 한계) | **5** | 4 (15분) |
| **기존 인프라 통일성** | 15% | **5** (GCP 6개 서비스) | 1 (AWS 신규) | 1 | 1 |
| **Supabase 네트워크 거리** | 10% | 3 (크로스 클라우드) | **5** (같은 AWS) | **5** | **5** |
| **운영 편의성 (로그/모니터링)** | 10% | 4 | 4 | 3 (제한적) | 4 |
| **학습 곡선** | 5% | 5 (gcloud 익숙) | 3 | 4 | 2 |
| **가중 합계** | **100%** | **4.65** ⭐ | 2.65 | 3.3 | 3.45 |

### 권장 결론

#### 🎯 1순위: **GCP Cloud Run** (본문 §1~§11)
- **근거**: 기존 6개 서비스 통일성 + 무료 티어 실질 $0 + timeout 300초+ AI 장시간 추론 대응 + withbible로 검증된 패턴 재사용. 현재 프로젝트 제약 조건(초보자/단일 운영자) 하에서 종합 최고.

#### 🥈 2순위: **AWS Lightsail Containers** (Micro, $10/월 고정)
- **근거**: AWS를 꼭 가야 하는 사유가 있다면(예: 회사 정책, AWS 크레딧 보유, Supabase가 ap-northeast-2에 있고 지연이 큰 경우) 월 $10 고정가가 가장 예측 가능. SSE 지원 + 타임아웃 여유 + 단순성.
- **단점**: 오토스케일링 없음, 트래픽 폭증 시 수동 플랜 변경 필요.

#### 🥉 3순위: **AWS Lambda + Function URL**
- **근거**: 비용 최저($3/월) + 15분 타임아웃. 단, **24개 Express 라우트를 단일 Lambda로 래핑(`@codegenie/serverless-express`)** 해야 관리 부담 현실화. 학습 곡선 있음.

#### ❌ 비권장: **AWS App Runner**
- **근거**: 120초 타임아웃이 **o3-pro 장시간 추론**을 차단 → 앱 기능 축소 발생. 비용도 $56+로 Cloud Run 대비 수십 배. Cloud Run 대체로서 기능/비용 모두 열세.

### 상황별 분기 조언

| 사용자 상황 | 권장 |
|-------------|------|
| **기본 케이스** (통일성/비용/기능 중시) | **GCP Cloud Run** |
| 회사가 AWS만 사용 | **Lightsail Containers** (월 $10) |
| AWS 크레딧 대량 보유 | **App Runner** (크레딧 소진 용도로는 허용) — 단 120초 제약 수용 |
| 향후 DAU 10K+ 예상, 비용 최적화 | Lambda (단, 24개 라우트 리팩터링 감수) |
| Supabase 리전이 ap-northeast-2인데 지연이 실측 문제 | 확인 후 같은 리전의 AWS (Lightsail 또는 App Runner) |
| Supabase 리전이 us-east-1인 문제 상황 | Supabase 리전 이동을 먼저 → 그 후 GCP/AWS 플랫폼 결정 |
| **DAU ≤ 5 + 완전 AWS 생태계 + 비용 최소화** | **부록 B (§15) 참조** — Lambda + RDS 프리티어 조합으로 첫해 **$0~2/월** 구성 가능 |
| **DAU ≤ 5 + AWS 컴퓨팅 + Supabase 유지 + 보안 최우선** ⭐ | **부록 C (§16) 참조** — Lambda + CloudFront OAC + SSM CMK, **월 $1~$2** 상시 유지 + 10중 보안 레이어 |

### 다음 액션 제안

1. **Supabase 프로젝트 리전 확인** (대시보드 → Project Settings → Infrastructure)
   - Seoul/Tokyo면 → GCP로 진행해도 latency OK, **GCP Cloud Run 권장 그대로**
   - 다른 리전(us-*, eu-*)이면 → 지연 허용 가능성 판단 후 결정
2. **최종 선택 확정** (GCP Cloud Run / Lightsail / Lambda 중)
3. 선택된 플랫폼에 해당하는 섹션 실행:
   - GCP → 본문 §6 단계별 실행 계획
   - AWS → 부록 A.16 실행 요약
4. 배포 후 §12-3 또는 부록 A에 결과 기입

이 매트릭스는 **사용자의 최종 의사결정 도구**입니다. 점수가 기계적으로 결정하지 않도록 상황별 분기 조언을 함께 제공했어요. 결정이 정해지면 해당 섹션의 실행 계획을 그대로 따라가면 됩니다.

---

## 부록 B: AWS 완전 이관 최소 스펙 설계 (DAU ≤ 5)

본 부록은 다음 전제에서 **가장 저렴한 AWS 온전체 구성**을 제시합니다.

- **전제 1**: DAU(일간 활성 사용자) 5명 이하 (개인/지인 테스트 단계)
- **전제 2**: **"완전히 AWS 생태계"** — Supabase/Resend 등 외부 의존성 제거, DB·이메일·시크릿·스토리지 모두 AWS로 이관
- **전제 3**: 월 비용 **$0~$15** 범위 유지 (프리티어 종료 전후 구분)
- **전제 4**: 기능 축소 없음 — AI 3사 + SSE + 첨부파일 + 이메일 인증 + 법령 검색 모두 보존

### B.1. 타깃 스펙 요약

| 항목 | 값 | 근거 |
|------|-----|------|
| 예상 월 요청 수 | ~5,000 | DAU 5 × 세션당 30요청 × 30일 |
| 예상 AI 호출 | ~500/월 | DAU당 일 3~4회 해설 |
| 예상 이메일 발송 | ~50/월 | 회원가입/로그인/재설정 코드 |
| DB 스토리지 | < 1GB | 문제 데이터 + 메모/파일 base64 |
| 동시 접속 | 1~2명 | 극소 |
| pool-upload 사용 | 월 1~2회 | 관리자 본인 운영 |
| 피크 RPS | < 1 req/sec | 부하 무시 가능 |

### B.2. 최소 스펙 아키텍처

```
┌────────────────────────────────────────────────────────────────────┐
│                     CloudFront (선택, 무료 티어)                     │
│                     └─ S3 (정적 SPA: dist/)                         │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ /api/*
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│  Lambda Function URL (Response Streaming)                          │
│  @codegenie/serverless-express 로 Express 앱 그대로 래핑             │
│  메모리 1024MB, timeout 300s                                        │
└──────────────┬─────────────────────────────┬───────────────────────┘
               │ pg                          │ aws-sdk
               ▼                             ▼
┌────────────────────────────┐   ┌──────────────────────────────────┐
│ RDS PostgreSQL             │   │ ├─ S3 (memo files, q-images)     │
│ db.t4g.micro               │   │ ├─ SES (이메일 인증)              │
│ 20GB gp3, Single-AZ        │   │ ├─ SSM Parameter Store (시크릿)   │
│ (12개월 프리티어)           │   │ └─ CloudWatch Logs (5GB 무료)     │
└────────────────────────────┘   └──────────────────────────────────┘
                 │
                 └─ (외부) OpenAI / Gemini / Anthropic / 국가법령 API
```

### B.3. 서비스 선택 근거

#### 컴퓨팅: **Lambda + Function URL** (Response Streaming)

| 이유 | 설명 |
|------|------|
| 비용 | DAU 5면 실질 **$0** (무료 티어 월 1M 요청, 400K GB-sec 내) |
| SSE 지원 | 2023년부터 Function URL은 Response Streaming 지원 → Gemini/OpenAI/Claude SSE 가능 |
| 타임아웃 | 최대 **900초 (15분)** — o3-pro/xhigh 장시간 추론도 OK |
| 코드 변경 | `serverless-express` 래퍼로 **현재 Express 앱 전체를 단일 Lambda로 래핑** → 24개 핸들러 코드 무수정 |
| Cold start | 1~3초 — DAU 5면 사용자 불편 경미 |
| min=0 자동 | Lambda는 기본 요청 없으면 $0 |

#### DB: **RDS PostgreSQL db.t4g.micro** (프리티어 첫 12개월 무료)

| 이유 | 설명 |
|------|------|
| 프리티어 | 신규 AWS 계정 **12개월간 db.t4g.micro 750시간/월 + 20GB gp3 + 20GB 백업 무료** → 첫해 $0 |
| 이후 비용 | 프리티어 종료 후 Single-AZ **~$13/월** (ap-northeast-2 기준) |
| Supabase 대체 가능 여부 | 100% 호환 (PostgreSQL 16). 기존 `pg` 패키지 그대로 사용 |
| 공인/사설 IP | Lambda에서 접근하려면 **VPC Lambda** 또는 **RDS Public Access + 보안그룹 제한** 중 선택 |

**대안 검토 (채택 안 함)**:
- Aurora Serverless v2 **scale-to-0** (2024-11부터 지원): 이론적으로 DAU 5면 월 $1~2 가능. 그러나 **최소 0.5 ACU 활성화 시간당 $0.12** → 예상 외 활성 시간 발생하면 $40~$80/월로 급등 위험. DAU가 예측 가능할 때만 유리.
- DynamoDB: 스키마가 완전 SQL 기반(JOIN, JSON 컬럼, UNIQUE 제약 다수) → 마이그레이션 공수 막대. **기각**.
- Lightsail Managed DB Micro: $15/월 고정. 프리티어 없음. RDS 프리티어 대비 열세.

#### 파일 저장: **S3** (memo_files 개선 + q-images)

| 현재 | 이관 |
|------|------|
| `memo_files.data` (PostgreSQL BYTEA/TEXT에 base64) | S3 `s3://aitutor-files/memos/{uuid}.{ext}` + DB에 key만 저장 |
| `public/q-images/` (컨테이너 내 정적) | `s3://aitutor-files/q-images/` + CloudFront 또는 직접 Lambda가 presigned URL 발급 |

**장점**: DB 크기 급증 방지 (현재는 파일이 DB에 들어가서 RDS 스토리지를 빠르게 소모), 다운로드 대역폭 절감.
**단점**: 코드 변경 필요 (`api/memo-files.js`의 upload/download 부분).
**선택**: DAU 5면 현재 base64 방식도 감당 가능 → **B.5 1단계에서는 유지**, B.5 2단계(스토리지 20GB 근접 시)에 이관.

#### 시크릿: **SSM Parameter Store** (SecureString)

| 이유 | 설명 |
|------|------|
| 비용 | Standard Parameter는 **완전 무료** (Advanced만 월 $0.05/파라미터) |
| vs Secrets Manager | Secrets Manager는 시크릿당 월 $0.40 → 7개면 $2.80/월. SSM은 **$0**. |
| 암호화 | AWS KMS 기본 키로 SecureString 암호화 |
| Lambda 연동 | AWS SDK `@aws-sdk/client-ssm` 또는 Lambda Extension 사용 |

#### 이메일: **SES (Simple Email Service)**

| 이유 | 설명 |
|------|------|
| 비용 | Lambda/EC2에서 호출 시 **월 62,000 이메일 무료**. DAU 5면 완전 무료 영구. |
| Resend 대체 | `send-verification.js`에서 fetch(resend) → `@aws-sdk/client-sesv2` `SendEmailCommand`로 교체 |
| 초기 설정 | **프로덕션 모드 승인** 필요 (Sandbox는 검증된 수신자만 가능). 승인 요청 24시간 내 처리되는 편. |
| 도메인 | 초기에는 `onboarding@resend.dev` 같은 공용 발신 대체로 SES 검증된 도메인 필요. 도메인 없으면 개인 Gmail을 **검증된 발신자**로 등록 (Sandbox에서는 수신도 검증 필요 → 프로덕션 모드 승인 필수) |

#### 로그: **CloudWatch Logs**

- Lambda는 기본으로 `/aws/lambda/<fn>` 로그 그룹에 출력
- **5GB/월 무료**. DAU 5면 절대 초과 안 함.
- 보관 기간 **7일**로 설정하여 장기 적재 비용 0으로 유지

#### 컨테이너 레지스트리: **ECR** (Lambda Container Image 사용 시만)

- Lambda 배포 방식 2가지: **zip** (50MB 상한) vs **컨테이너 이미지** (10GB 상한)
- Express 앱 + `node_modules` 포함 시 **zip 50MB 상한 근접** 가능 → **컨테이너 이미지 권장**
- ECR 비용: 1GB 저장 시 월 **$0.10**. 최소 비용.

### B.4. 비용 산정 (DAU 5 기준)

#### B.4.1. 프리티어 유효 기간 (첫 12개월, 신규 AWS 계정)

| 항목 | 사용량 | 프리티어 한도 | 초과분 비용 |
|------|--------|---------------|-------------|
| Lambda 요청 | ~5,000/월 | 1,000,000/월 | **$0** |
| Lambda 컴퓨팅 | ~15,000 GB-sec | 400,000 GB-sec | **$0** |
| Function URL 요청 | ~5,000/월 | 1,000,000/월 | **$0** |
| RDS db.t4g.micro | 720시간 (24/7) | 750시간/월 | **$0** |
| RDS 스토리지 | 1GB | 20GB gp3 | **$0** |
| RDS 백업 | 1GB | 20GB | **$0** |
| S3 저장 | 1GB | 5GB | **$0** |
| S3 GET/PUT | ~500/월 | 20,000 GET + 2,000 PUT | **$0** |
| SES | ~50 이메일/월 | 62,000/월 | **$0** |
| SSM Parameter Store | 7개 Standard | 10,000 API calls/월 | **$0** |
| CloudWatch Logs | ~100MB/월 | 5GB/월 | **$0** |
| CloudWatch 메트릭 | 기본 | 기본 | **$0** |
| 네트워크 송신 | ~1GB/월 | 100GB/월 (2024~) | **$0** |
| ECR 저장 | 0.5GB | 500MB | **$0** |
| **합계** | | | **💰 $0/월** |

#### B.4.2. 프리티어 종료 후 (2년차~, DAU 5 유지 가정)

| 항목 | 비용 |
|------|------|
| Lambda | **$0** (무료 티어는 항시) |
| Function URL | **$0** |
| RDS db.t4g.micro (Single-AZ, 24/7) | **~$12.41** (0.017 $/hr × 730hr) |
| RDS 스토리지 1GB gp3 | **$0.115** |
| RDS 백업 1GB | **$0.095** |
| S3 1GB 저장 | **$0.023** |
| S3 요청 | **$0.005** |
| SES | **$0** (Lambda 발신 62K 무료 유지) |
| SSM Standard | **$0** |
| CloudWatch Logs | **$0** (보관 7일 설정 시) |
| ECR 0.5GB | **$0.05** |
| **합계** | **💰 ~$12.7/월** |

#### B.4.3. 추가 사항

- **AI API 비용**: OpenAI/Gemini/Claude → **각 프로바이더에 직접 과금**. AWS와 무관. DAU 5 × 해설 500건/월 × 평균 $0.002 = **~$1/월** (Gemini Flash 중심 사용 시)
- **Route 53 도메인**: 커스텀 도메인 연결 시 $0.50/zone/월 + 도메인 등록비 (선택)
- **CloudFront**: SPA를 S3에서 서빙하며 CloudFront로 CDN할 경우, **1TB 송신 + 10M 요청 무료 (영구)** → DAU 5면 **$0**

#### B.4.4. 비용 요약

| 기간 | DAU 5 기준 월 AWS 비용 |
|------|------------------------|
| 1년차 (프리티어) | **$0** |
| 2년차~ | **~$13** (RDS 유지비 사실상 전부) |

Cloud Run + Supabase 유지 시 $0와 비교해 2년차부터 **+$13/월** 증가. 그러나 "완전 AWS 생태계 + Supabase 제거"를 원하신다면 이 정도가 현실적 최저선입니다.

### B.5. 코드 변경 범위

#### B.5.1. 변경 요약

| 파일 | 변경 유형 | 규모 |
|------|-----------|------|
| `lambda.js` (신규) | Express 앱을 Lambda 핸들러로 래핑 | +20줄 |
| `Dockerfile` (신규) | Lambda 컨테이너 이미지용 | +30줄 |
| `package.json` | 의존성 추가: `@codegenie/serverless-express`, `@aws-sdk/client-sesv2`, `@aws-sdk/client-ssm` | +3개 deps |
| `api/db.js` | DATABASE_URL → RDS endpoint. SSL은 RDS CA 번들 사용 | 5줄 변경 |
| `api/send-verification.js` | Resend fetch → SES SDK | ~30줄 변경 |
| `server.js` | Lambda에서는 `app.listen` 불필요. export만 | 기존 유지, `lambda.js`가 사용 |
| `dist/` 정적 서빙 | Lambda가 아닌 S3 + CloudFront에서 서빙 (권장) 또는 Lambda에서 그대로 | 설계 선택 |
| `api/cors.js` | Lambda Function URL 도메인 추가 | 1~2줄 |

**무변경**: `api/*.js` 22개 (auth, login, signup, questions, memos, memo-files, bookmarks, categories, explanations, exam-results, admin, gemini, openai, claude, law, cors, middleware, forgot-password, delete-account, import-docstore, pool-upload, signup)

#### B.5.2. Lambda 래핑 어댑터 (`lambda.js` 신규)

```js
// lambda.js — Express 앱을 Lambda 핸들러로 변환
const serverlessExpress = require('@codegenie/serverless-express');
const app = require('./server');  // 기존 Express 앱을 export

// Lambda Function URL + Response Streaming 대응
exports.handler = serverlessExpress({ app });
```

**주의**: `server.js` 마지막의 `app.listen(...)`은 **로컬 개발/Cloud Run에서만 실행**되도록 분기 처리.

```js
// server.js 끝 부분 수정
if (require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 8080;
  app.listen(PORT, '0.0.0.0', () => console.log(`listening on ${PORT}`));
}
module.exports = app;
```

#### B.5.3. `api/db.js` RDS 대응

```js
const { Pool } = require('pg');
const fs = require('fs');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // RDS용 SSL: Lambda Layer나 이미지에 rds-combined-ca-bundle.pem 포함
      ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com')
        ? { ca: fs.readFileSync('/opt/rds-ca-bundle.pem').toString(), rejectUnauthorized: true }
        : { rejectUnauthorized: false },  // Supabase용 기존 옵션
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}
```

#### B.5.4. `api/send-verification.js` Resend → SES 교체

```js
// 기존 Resend fetch 블록을 SES SDK로 교체
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const ses = new SESv2Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });

const emailCmd = new SendEmailCommand({
  FromEmailAddress: process.env.SES_FROM || 'noreply@yourdomain.com',
  Destination: { ToAddresses: [email] },
  Content: {
    Simple: {
      Subject: { Data: `[AI TutorTwo] ${purposeLabel} 인증코드: ${code}`, Charset: 'UTF-8' },
      Body: {
        Html: {
          Data: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
                   <h2>AI TutorTwo ${purposeLabel}</h2>
                   <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4f46e5">${code}</div>
                   <p>10분간 유효합니다.</p>
                 </div>`,
          Charset: 'UTF-8',
        },
      },
    },
  },
});
await ses.send(emailCmd);
```

### B.6. Lambda 컨테이너 이미지 Dockerfile

```dockerfile
# Lambda Node.js 22 컨테이너 이미지
FROM public.ecr.aws/lambda/nodejs:22

# 작업 디렉터리 (Lambda 기본)
WORKDIR ${LAMBDA_TASK_ROOT}

# 의존성 설치
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 소스 복사
COPY server.js lambda.js ./
COPY api ./api
COPY dist ./dist

# RDS CA 번들 (RDS SSL 연결용)
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /opt/rds-ca-bundle.pem

# Lambda 핸들러 지정
CMD [ "lambda.handler" ]
```

### B.7. Supabase → RDS 데이터 이관 절차

#### B.7.1. RDS 인스턴스 생성

```bash
# 파라미터 (필요 시 수정)
DB_INSTANCE_ID=aitutor-db
DB_NAME=aitutor
DB_USER=app_user
DB_PASS=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-20)
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)

# 보안 그룹 생성 (Lambda에서 접근 허용)
SG_ID=$(aws ec2 create-security-group \
  --group-name aitutor-rds-sg --description "aitutor RDS access" \
  --vpc-id $VPC_ID --query 'GroupId' --output text)

# 본인 IP에서만 접근 허용 (마이그레이션 + 개발용)
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 5432 --cidr ${MY_IP}/32

# RDS 인스턴스 생성 (프리티어)
aws rds create-db-instance \
  --db-instance-identifier $DB_INSTANCE_ID \
  --db-instance-class db.t4g.micro \
  --engine postgres --engine-version 16.3 \
  --master-username $DB_USER --master-user-password "$DB_PASS" \
  --allocated-storage 20 --storage-type gp3 \
  --db-name $DB_NAME \
  --vpc-security-group-ids $SG_ID \
  --publicly-accessible \
  --backup-retention-period 7 \
  --no-multi-az \
  --region ap-northeast-2

# 생성 완료까지 대기 (~5~10분)
aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_ID

# 엔드포인트 확인
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $DB_INSTANCE_ID \
  --query 'DBInstances[0].Endpoint.Address' --output text)
echo "RDS Endpoint: $RDS_ENDPOINT"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${RDS_ENDPOINT}:5432/${DB_NAME}?sslmode=require"
```

#### B.7.2. Supabase → RDS 덤프 이관

```bash
# 1) Supabase에서 스키마 + 데이터 덤프 (로컬)
SUPABASE_URL="postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres"

pg_dump "$SUPABASE_URL" \
  --clean --if-exists --no-owner --no-privileges \
  --exclude-schema=auth --exclude-schema=storage \
  --exclude-schema=realtime --exclude-schema=extensions \
  --exclude-schema=graphql --exclude-schema=graphql_public \
  --exclude-schema=pgsodium --exclude-schema=supabase_functions \
  --exclude-schema=vault \
  -f aitutor-dump.sql

# 2) RDS로 restore
psql "postgresql://${DB_USER}:${DB_PASS}@${RDS_ENDPOINT}:5432/${DB_NAME}?sslmode=require" \
  -f aitutor-dump.sql

# 3) 레코드 수 비교 (샘플)
psql "$SUPABASE_URL" -c "SELECT 'users' AS t, COUNT(*) FROM public.users
  UNION ALL SELECT 'questions', COUNT(*) FROM questions
  UNION ALL SELECT 'question_memos', COUNT(*) FROM question_memos"

psql "postgresql://${DB_USER}:${DB_PASS}@${RDS_ENDPOINT}:5432/${DB_NAME}?sslmode=require" -c "...(동일 쿼리)..."

# 4) 덤프 파일 삭제 (민감정보 포함 가능)
rm -f aitutor-dump.sql
```

> **주의**: `import-docstore.js`는 **docstore 프로젝트의 `exam_questions` 테이블을 참조**합니다. docstore도 함께 AWS로 이관하지 않는다면 이 기능은 **동작 중단**됩니다. 사용 빈도가 낮으면 Phase 1에서 해당 핸들러를 비활성화하거나, Supabase DB를 **읽기 전용 별도 커넥션**으로 유지하는 방식 고려 필요.

### B.8. SES 이메일 서비스 설정

#### B.8.1. 발신 도메인 또는 이메일 검증

```bash
# 옵션 A: 도메인 검증 (권장, 도메인 보유 시)
aws sesv2 create-email-identity \
  --email-identity yourdomain.com \
  --region ap-northeast-2
# → 반환되는 DKIM TokenSigningKey 3개를 DNS CNAME으로 등록

# 옵션 B: 개별 이메일 검증 (도메인 없을 때)
aws sesv2 create-email-identity \
  --email-identity "noreply@your-personal-email.com" \
  --region ap-northeast-2
# → 해당 메일함으로 인증 링크 수신 → 클릭
```

#### B.8.2. 프로덕션 모드 요청 (Sandbox 해제)

```bash
aws sesv2 put-account-details \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url "https://aitutor.your-domain.com" \
  --use-case-description "이메일 인증코드 발송 (회원가입/로그인/비밀번호 재설정, 월 ~100건)" \
  --contact-language EN \
  --region ap-northeast-2
```

- 승인까지 보통 24시간 이내
- Sandbox 모드에서는 검증된 발신/수신 이메일 사이에서만 동작

#### B.8.3. Lambda에 SES 권한 부여

Lambda 실행 역할에 아래 정책 연결:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ses:SendEmail", "ses:SendRawEmail"],
    "Resource": "*"
  }]
}
```

### B.9. 실행 요약 체크리스트

```bash
# ─── 사전 준비 ───
aws configure set region ap-northeast-2
aws sts get-caller-identity

# ─── 1. RDS 생성 + Supabase 데이터 이관 (B.7) ───
# RDS 프로비저닝 → pg_dump → psql restore → 레코드 수 검증

# ─── 2. SES 검증 + 프로덕션 모드 요청 (B.8) ───
# 도메인 또는 이메일 검증 → production-access-enabled 요청 → 24h 대기

# ─── 3. SSM Parameter Store에 시크릿 등록 ───
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY LAW_API_OC SES_FROM; do
  V=$(grep "^${K}=" .env.production 2>/dev/null | cut -d= -f2- || echo "")
  [ -n "$V" ] && aws ssm put-parameter \
    --name "/aitutor/${K}" --type SecureString --value "$V" --overwrite
done
# (RESEND_API_KEY는 이관 대상 아님)

# ─── 4. 코드 수정 (B.5) ───
# - lambda.js 추가
# - server.js: if (require.main === module) 분기
# - api/db.js: RDS SSL 대응
# - api/send-verification.js: SES SDK
# - package.json: 의존성 추가
npm install @codegenie/serverless-express @aws-sdk/client-sesv2 @aws-sdk/client-ssm

# ─── 5. Lambda 컨테이너 이미지 빌드 + ECR 푸시 (부록 A.8과 유사) ───
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor-lambda"
aws ecr create-repository --repository-name aitutor-lambda
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin "$ECR_URI"
docker buildx build --platform linux/amd64 -t "${ECR_URI}:latest" --push .

# ─── 6. Lambda 실행 역할 생성 ───
cat > /tmp/lambda-trust.json <<'JSON'
{ "Version": "2012-10-17", "Statement": [{
  "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"},
  "Action": "sts:AssumeRole" }] }
JSON
aws iam create-role --role-name AitutorLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust.json
aws iam attach-role-policy --role-name AitutorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
# SES, SSM 권한 추가
cat > /tmp/aitutor-lambda-extra.json <<JSON
{ "Version": "2012-10-17", "Statement": [
  {"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParameters","ssm:GetParametersByPath"],
   "Resource":"arn:aws:ssm:ap-northeast-2:${AWS_ACCOUNT_ID}:parameter/aitutor/*"},
  {"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"},
  {"Effect":"Allow","Action":["kms:Decrypt"],"Resource":"*"}
]}
JSON
aws iam put-role-policy --role-name AitutorLambdaRole \
  --policy-name AitutorExtra --policy-document file:///tmp/aitutor-lambda-extra.json

ROLE_ARN=$(aws iam get-role --role-name AitutorLambdaRole --query 'Role.Arn' --output text)

# ─── 7. Lambda 함수 생성 + Function URL 활성화 ───
aws lambda create-function \
  --function-name aitutor \
  --package-type Image \
  --code ImageUri="${ECR_URI}:latest" \
  --role "$ROLE_ARN" \
  --timeout 300 \
  --memory-size 1024 \
  --environment "Variables={NODE_ENV=production,AWS_REGION=ap-northeast-2}" \
  --region ap-northeast-2

# Function URL 생성 (Response Streaming)
aws lambda create-function-url-config \
  --function-name aitutor \
  --auth-type NONE \
  --invoke-mode RESPONSE_STREAM \
  --region ap-northeast-2

# 공개 호출 허용
aws lambda add-permission \
  --function-name aitutor \
  --statement-id AllowPublic \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ap-northeast-2

# 서비스 URL
FN_URL=$(aws lambda get-function-url-config \
  --function-name aitutor --query 'FunctionUrl' --output text --region ap-northeast-2)
echo "Service URL: $FN_URL"

# ─── 8. 환경변수에 SSM 값 주입 (Lambda Extension 또는 코드 내 조회) ───
# 옵션 A: Lambda 시작 시 SSM에서 일괄 조회 (B.5 init 로직)
# 옵션 B: aws-parameters-and-secrets-lambda-extension Lambda Layer 추가

# ─── 9. S3 + CloudFront로 dist/ 정적 서빙 (선택, 성능/비용 최적화) ───
aws s3 mb s3://aitutor-web --region ap-northeast-2
aws s3 sync dist/ s3://aitutor-web --cache-control "public, max-age=31536000, immutable" \
  --exclude index.html
aws s3 cp dist/index.html s3://aitutor-web/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
# CloudFront는 OAC(Origin Access Control) + Function URL 오리진으로 /api/* 전용
# (간소화 원하면 Lambda가 dist/도 직접 서빙 — DAU 5면 이 방식 권장)

# ─── 10. 검증 (§7 체크리스트 동일 실행) ───
curl -I "$FN_URL"
curl "$FN_URL/api/categories"
```

### B.10. 트래픽 증가 시 스케일업 경로

DAU가 늘어날 때 자연스러운 업그레이드 경로는 다음과 같습니다.

| 임계점 | 조치 | 추가 비용 |
|--------|------|-----------|
| DAU 50+ | RDS 스토리지 20GB 근접 → S3로 memo_files 이관 (B.5.3) | 거의 없음 |
| DAU 100+ | Lambda cold start 체감 → Provisioned Concurrency 1개 | +$5/월 |
| DAU 500+ | RDS db.t4g.micro CPU 80%+ → `db.t4g.small` 업그레이드 | +$12/월 |
| DAU 1,000+ | Lambda 응답 지연 → App Runner 또는 ECS Fargate로 전환 | +$25~$60/월 |
| DAU 5,000+ | RDS Read Replica 추가, S3 + CloudFront 본격 적용 | +$30/월 |
| DAU 10,000+ | Aurora Serverless v2 또는 Multi-AZ RDS 이관 | +$50~$150/월 |

**핵심**: DAU 5~50 구간은 **$0~$15/월**로 운영 가능. 본 설계는 이 구간을 최적화한 것.

### B.11. 이 설계의 제약과 수용 여부

| 제약 | 영향 | 수용 가능 여부 |
|------|------|----------------|
| Lambda cold start 1~3초 | 첫 요청만 느림 | DAU 5면 수용 가능 |
| RDS 프리티어 12개월 후 $13/월 발생 | 연 $156 증가 | 수용 또는 이 시점에 재평가 |
| `import-docstore.js` 기능 동작 중지 | docstore도 AWS로 안 옮기면 | 사용 빈도 낮으면 수용 |
| SES Sandbox 해제 대기 (~24h) | 초기 이메일 기능 지연 | 마이그레이션 시점 조정 |
| VPC Lambda 시 cold start +3~10초 | RDS를 Public 대신 VPC로 두면 발생 | Public Access + IP 제한으로 회피 (권장) |
| `@codegenie/serverless-express` 서드파티 의존 | 활발히 유지보수 중 | 수용 가능 |
| S3 CDN 없으면 dist 다운로드 Lambda 통과 | 매 요청 Lambda 컴퓨팅 소비 | DAU 5면 수용 (CloudFront 추가는 무료) |

### B.12. Lambda vs Cloud Run 실질 비용 비교 (DAU 5 기준)

| 구성 | 1년차 | 2년차~ | 비고 |
|------|-------|--------|------|
| **GCP Cloud Run + Supabase** (본문 §1~§11) | **$0** | **$0~$2** | 모든 항목 무료 티어 |
| **AWS Lambda + RDS 프리티어** (부록 B) | **$0** | **~$13** | RDS 고정비만 발생 |
| **AWS App Runner + RDS** (부록 A 조합) | **$56+** | **$70+** | 타임아웃 120초 제약 |
| **AWS Lightsail Container + Lightsail DB** | **$22** | **$22** | 고정 월정액, 예측 가능 |

**결론**: **AWS 완전 이관 + DAU ≤ 5 전제**에서 월 비용 최저 조합은 **Lambda + RDS 프리티어**이며, 첫해 $0, 2년차 이후 약 $13/월 수준입니다. 기존 Cloud Run 권장안 대비 2년차부터 +$13/월이 "완전 AWS 생태계"의 가격표라고 이해하면 됩니다.

### B.13. 최소 스펙 최종 권장안 요약

- **컴퓨팅**: Lambda (1024MB, timeout 300s, Container Image)
- **DB**: RDS PostgreSQL db.t4g.micro (Single-AZ, 20GB gp3, Public + IP 제한)
- **파일**: DB base64 유지 (B.5.3 1단계) — 향후 S3 이관
- **시크릿**: SSM Parameter Store SecureString (무료)
- **이메일**: SES (프로덕션 모드 + Lambda 발신)
- **로그**: CloudWatch Logs (7일 보관)
- **이미지 레지스트리**: ECR (Lambda Container Image)
- **정적 SPA**: Lambda에서 `dist/` 직접 서빙 (CloudFront 미사용으로 단순성 우선)
- **리전**: `ap-northeast-2` (Seoul) 통일

실행은 **B.9 체크리스트** 순서로 진행하면 됩니다. Cloud Run으로 갈지, 이 AWS 최소 스펙으로 갈지는 §14 최종 권장 매트릭스의 상황별 분기 조언을 함께 참고하여 결정해주세요.

---

## 부록 C: AWS 경량 + Supabase 유지 + 보안 최적화 (DAU ≤ 5)

본 부록은 다음 **구체적 요구사항**에 특화된 설계입니다.

- **요구사항 1**: 컴퓨팅은 **AWS로** (aws CLI 기반 배포)
- **요구사항 2**: **Supabase DB는 그대로 유지** (마이그레이션 리스크 제거, docstore 공유 관계 보존)
- **요구사항 3**: **DAU 5 이하 극소 규모** 최적화
- **요구사항 4**: **보안 리스크 최소화** — 다층 방어

부록 B(완전 AWS)와 핵심 차이:
- ❌ RDS 이관 없음 → 월 $13 고정비 제거
- ❌ SES 이관 없음 → Resend 유지(키만 SSM에 안전 보관)
- ✅ 보안 통제 레이어 **강화** (CloudFront OAC, KMS CMK, Reserved Concurrency, WAF 준비)

### C.1. 아키텍처 개요

```
사용자 브라우저 (HTTPS)
    │
    ▼
┌────────────────────────────────────────────────────┐
│ CloudFront (a-b-c.cloudfront.net 또는 커스텀 도메인) │
│  ├─ Security: Origin Shield + OAC                   │
│  ├─ TLS 1.2+ 강제, HTTP/2, HSTS                    │
│  └─ (선택) AWS WAF 연동 포인트                       │
└──────────┬──────────────────────────┬──────────────┘
           │ /* (정적)                │ /api/*
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│ S3: aitutor-web      │   │ Lambda Function URL          │
│ - dist/index.html    │   │ (aws:Referer CloudFront OAC만)│
│ - dist/assets/*      │   │ Response Streaming, 1024MB,  │
│ - Public Access 차단 │   │ timeout 300s, Reserved=10    │
│ - OAC로 CF만 접근    │   └──────────┬───────────────────┘
└──────────────────────┘              │
                                      ├─▶ Supabase PostgreSQL (SSL, 기존 유지)
                                      ├─▶ SSM Parameter Store (KMS CMK 암호화)
                                      ├─▶ Resend API (이메일) / 또는 SES 선택
                                      └─▶ 외부 AI API (OpenAI/Gemini/Claude)
```

### C.2. 보안 위협 모델 (STRIDE 간단 분석)

| 위협 유형 | 예시 시나리오 | 본 설계의 통제 |
|-----------|---------------|----------------|
| **S**poofing (위장) | 공격자가 합법 사용자로 위장 | JWT(HMAC-SHA256, ≥32자 서명키) + HttpOnly 쿠키 + SameSite=Lax |
| **T**ampering (조작) | 요청 파라미터 변조 | HTTPS 전구간 + ALLOWED_MODELS 화이트리스트 + server-side validation |
| **R**epudiation (부인) | 사용자 행위 추적 불가 | CloudWatch Logs + CloudTrail (관리 이벤트 기본 녹화) |
| **I**nformation Disclosure (정보 노출) | 시크릿 유출, DB 노출 | SSM SecureString + KMS CMK + Lambda 로그 sanitization + Supabase SSL |
| **D**oS (서비스 거부) | 트래픽 폭주로 비용/가용성 공격 | **Reserved Concurrency=10** + CloudFront 캐시 + Supabase connection pool |
| **E**levation (권한 상승) | 일반 사용자가 관리자 기능 호출 | withAdmin 미들웨어 + IAM Least Privilege + Supabase는 AWS에서 읽기만 가능한 사용자 계정 검토 |

### C.3. 10중 보안 통제 레이어

| # | 레이어 | 통제 내용 | 비용 |
|---|--------|-----------|------|
| 1 | **네트워크 경계** | CloudFront OAC — Lambda Function URL을 CloudFront에서만 호출 가능하도록 서명 필수. 직접 호출 시 403. | 무료 |
| 2 | **DDoS/스캔 방어** | CloudFront AWS Shield Standard (자동, 무료). Reserved Concurrency=10으로 Lambda 비용 DoS 차단 | 무료 |
| 3 | **전송 암호화** | CloudFront → 사용자: TLS 1.2+ 강제, HSTS 헤더. CloudFront → Lambda: HTTPS. Lambda → Supabase: SSL 필수 | 무료 |
| 4 | **저장 암호화 (시크릿)** | SSM Parameter Store SecureString + **KMS Customer Managed Key** (감사 가능) | KMS CMK $1/월 |
| 5 | **IAM 최소 권한** | Lambda 실행 역할에 `ssm:GetParameter(aitutor/*)`, `logs:*`, `kms:Decrypt` 만 허용. AdminAccess 금지 | 무료 |
| 6 | **앱 레벨 인증** | JWT HMAC-SHA256, 32자 이상 시크릿, 7일 만료, HttpOnly+Secure+SameSite=Lax 쿠키 | 무료 (기존) |
| 7 | **앱 레벨 Rate Limit** | login.js DB 기반 분당 5회 IP 차단, send-verification.js 분당 2회 제한 | 무료 (기존) |
| 8 | **로그 보안** | CloudWatch Logs 보관 7일, Lambda 코드에서 body/query sanitization, `console.log`에 시크릿/토큰 출력 금지 규칙 | 무료 |
| 9 | **비용 이상 감지** | AWS Budgets 월 $5 임계값 알림, Cost Anomaly Detection (ML 기반 무료) | 무료 |
| 10 | **(선택) WAF Managed Rules** | CloudFront 앞단에 AWS WAF Managed Rules (Common/Known Bad Inputs) | $5/월 + 요청당 $0.60/1M (DAU 5면 WAF 비활성 권장) |

### C.4. 서비스 선택 근거 (부록 B와 차이점)

| 서비스 | 선택 | 근거 |
|--------|------|------|
| 컴퓨팅 | Lambda + Function URL | 부록 B와 동일. Lambda 무료 티어로 $0 유지 |
| DB | **Supabase 그대로** | 마이그레이션 리스크/비용 제거. docstore 공유 유지. §3 권장 유지 |
| 정적 SPA | **S3 + CloudFront** | Lambda가 dist/ 서빙하면 요청마다 컴퓨팅 소비. CloudFront는 1TB/10M 무료 → DAU 5면 캐시 히트율 99%+ 기대 |
| 시크릿 | **SSM SecureString + KMS CMK** | CMK($1/월)로 **감사 가능한 키 사용 이력** 확보 (중요 보안 업그레이드). Secrets Manager 대비 $2.80 절약 |
| 이메일 | **Resend 유지** (옵션: SES) | 키를 SSM에 안전 보관하면 외부 서비스 의존 리스크는 관리 가능 수준. 완전 AWS 원하면 SES로 교체 가능 (B.8 참조) |
| CDN | **CloudFront (필수)** | 보안 레이어 1,2의 전제. 무료 티어라 비용 부담 0 |
| IaC | **없음 (수동 CLI)** | DAU 5면 Terraform/CDK 오버킬. 본 부록의 CLI 스크립트로 충분. 필요 시 후속 작업으로 IaC 도입 |

### C.5. 월 비용 산정 (DAU 5, Supabase 유지)

| 항목 | 사용량 | 비용 |
|------|--------|------|
| Lambda 요청 + 컴퓨팅 | ~5,000 요청, 15,000 GB-sec | **$0** (무료 티어) |
| Function URL 요청 | ~5,000 | **$0** (무료) |
| CloudFront 송신 + 요청 | ~2GB, 50,000 요청 | **$0** (1TB/10M 무료) |
| S3 저장 + 요청 | 5MB (dist), GET 소수 | **$0** (5GB/20K GET 무료) |
| SSM Standard Parameter | 7개 × 월 호출 ~100 | **$0** (무료 티어) |
| KMS Customer Managed Key | 1개 | **$1.00** |
| KMS API 호출 | ~300/월 | **$0** (20K 무료) |
| CloudWatch Logs | ~100MB | **$0** (5GB 무료) |
| ECR 저장 | 0.5GB | **$0.05** |
| AWS Budgets 알림 | 1개 | **$0** (2개까지 무료) |
| Cost Anomaly Detection | 활성화 | **$0** |
| Supabase (무료 유지) | — | **$0** |
| Route 53 (선택, 커스텀 도메인) | Hosted Zone 1개 | **$0.50** |
| ACM 인증서 (CloudFront용) | 공개 인증서 | **$0** (무료) |
| **합계 (도메인 없이)** | | **💰 $1.05/월** |
| **합계 (커스텀 도메인 포함)** | | **💰 $1.55/월** |

### C.6. 사전 준비 (aws CLI)

```bash
aws --version                                # aws-cli/2.x 확인
aws configure sso                            # 또는 aws configure
aws configure set region ap-northeast-2
aws sts get-caller-identity                  # 계정/IAM 확인

# 작업 변수 고정
export AWS_REGION=ap-northeast-2
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT=aitutor
```

IAM 사용자에게 필요한 최소 권한 (관리자 계정 아닌 경우):
- `AWSLambda_FullAccess`, `AmazonEC2ContainerRegistryPowerUser`
- `CloudFrontFullAccess`, `AmazonS3FullAccess`
- `AWSKeyManagementServicePowerUser`, `AmazonSSMFullAccess`
- `IAMFullAccess` (역할 생성용 — 가능하면 관리자에게 역할만 선행 생성 요청)

### C.7. 단계별 실행 체크리스트

#### 단계 1 — KMS Customer Managed Key 생성 (레이어 4)

```bash
# KMS CMK 생성
KMS_KEY_ID=$(aws kms create-key \
  --description "aitutor SSM secret encryption" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT \
  --query 'KeyMetadata.KeyId' --output text)

# 친숙한 별칭
aws kms create-alias \
  --alias-name alias/aitutor-ssm \
  --target-key-id $KMS_KEY_ID

echo "KMS Key ID: $KMS_KEY_ID"
echo "KMS Alias ARN: arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:alias/aitutor-ssm"
```

#### 단계 2 — Vercel 환경변수 추출 + SSM Parameter Store 업로드 (레이어 4, 5)

```bash
cd /Users/2team/aifac/workspace/aitutor

# Vercel env 추출
npx vercel env pull .env.production --environment=production --yes

# SSM SecureString으로 업로드 (모두 KMS CMK로 암호화)
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  V=$(grep "^${K}=" .env.production | cut -d= -f2-)
  if [ -n "$V" ]; then
    aws ssm put-parameter \
      --name "/aitutor/${K}" \
      --type SecureString \
      --key-id "alias/aitutor-ssm" \
      --value "$V" \
      --overwrite \
      --region $AWS_REGION
    echo "✓ /aitutor/${K}"
  fi
done

# 환경변수 파일 즉시 삭제
rm -f .env.production
echo "✓ .env.production 삭제 완료"

# 태그로 관리 (선택)
for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  aws ssm add-tags-to-resource \
    --resource-type Parameter --resource-id "/aitutor/${K}" \
    --tags "Key=Project,Value=aitutor" "Key=Env,Value=production" \
    --region $AWS_REGION
done
```

#### 단계 3 — Lambda 실행 역할 (레이어 5, IAM 최소 권한)

```bash
# 신뢰 정책
cat > /tmp/lambda-trust.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
JSON

# 역할 생성
aws iam create-role \
  --role-name AitutorLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust.json \
  --description "Least-privilege role for aitutor Lambda"

# 기본 Lambda 실행 정책 (로그 쓰기)
aws iam attach-role-policy \
  --role-name AitutorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 최소 권한 인라인 정책: SSM 특정 경로 + KMS Decrypt만
cat > /tmp/aitutor-lambda-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOwnSSMParameters",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/aitutor/*"
    },
    {
      "Sid": "DecryptWithCMK",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:key/${KMS_KEY_ID}"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name AitutorLambdaRole \
  --policy-name AitutorLeastPrivilege \
  --policy-document file:///tmp/aitutor-lambda-policy.json

LAMBDA_ROLE_ARN=$(aws iam get-role --role-name AitutorLambdaRole \
  --query 'Role.Arn' --output text)
echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"
```

#### 단계 4 — 코드 수정 (부록 B.5와 동일 + SSM 런타임 조회)

**신규 `lambda.js`**:

```js
// lambda.js — Express 앱을 Lambda로 래핑 + SSM에서 시크릿 런타임 조회
const serverlessExpress = require('@codegenie/serverless-express');
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');

let cachedApp;

async function loadSecrets() {
  const ssm = new SSMClient({ region: process.env.AWS_REGION });
  const resp = await ssm.send(new GetParametersByPathCommand({
    Path: '/aitutor/',
    Recursive: false,
    WithDecryption: true,
  }));
  resp.Parameters.forEach(p => {
    const key = p.Name.split('/').pop();
    process.env[key] = p.Value;
  });
  console.log('[Bootstrap] SSM 시크릿 로드 완료:', resp.Parameters.length);
}

async function init() {
  if (!cachedApp) {
    await loadSecrets();
    // 시크릿을 process.env에 주입한 후에 app을 require
    const app = require('./server');
    cachedApp = serverlessExpress({ app });
  }
  return cachedApp;
}

exports.handler = async (event, context) => {
  const handler = await init();
  return handler(event, context);
};
```

**`server.js` 끝 수정** (Lambda 환경에서 app.listen 호출 방지):

```js
// ...기존 코드 유지...
if (require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 8080;
  app.listen(PORT, '0.0.0.0', () => console.log(`listening on ${PORT}`));
}
module.exports = app;
```

**`package.json` 의존성 추가**:

```bash
npm install @codegenie/serverless-express @aws-sdk/client-ssm
```

**`api/cors.js` 업데이트** (CloudFront 도메인 허용):

```js
const ALLOWED_ORIGINS = [
  'https://aitutor-six.vercel.app',
  /^https:\/\/[a-z0-9]+\.cloudfront\.net$/,
  /^https:\/\/[a-z0-9-]+\.lambda-url\.ap-northeast-2\.on\.aws$/,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3002',
];
function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.some(o =>
    typeof o === 'string' ? o === origin : o.test(origin));
}
function setCorsHeaders(req, res) {
  const origin = req.headers?.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
module.exports = { setCorsHeaders, ALLOWED_ORIGINS, isAllowedOrigin };
```

**`Dockerfile`** (부록 B.6과 동일, RDS CA 번들 줄은 제거 — Supabase는 서버리스 형태라 `rejectUnauthorized:false` 유지):

```dockerfile
FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js lambda.js ./
COPY api ./api
COPY dist ./dist

CMD [ "lambda.handler" ]
```

#### 단계 5 — ECR + Lambda 컨테이너 이미지 빌드/푸시

```bash
# 프론트엔드 빌드
npm run build:fe

# ECR 레포지토리
aws ecr create-repository \
  --repository-name aitutor \
  --image-scanning-configuration scanOnPush=true \
  --region $AWS_REGION

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/aitutor"
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_URI

# Apple Silicon이면 --platform 명시 필수
docker buildx build --platform linux/amd64 \
  -t "${ECR_URI}:latest" \
  -t "${ECR_URI}:$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')" \
  --push .
```

#### 단계 6 — Lambda 함수 생성 + Reserved Concurrency (레이어 2)

```bash
aws lambda create-function \
  --function-name aitutor \
  --package-type Image \
  --code ImageUri="${ECR_URI}:latest" \
  --role "$LAMBDA_ROLE_ARN" \
  --timeout 300 \
  --memory-size 1024 \
  --environment "Variables={NODE_ENV=production}" \
  --region $AWS_REGION

# 비용 DoS 차단: 동시 실행 최대 10개
aws lambda put-function-concurrency \
  --function-name aitutor \
  --reserved-concurrent-executions 10 \
  --region $AWS_REGION
```

#### 단계 7 — Function URL 생성 (인증: AWS_IAM으로 잠금)

```bash
# CloudFront OAC가 서명해서만 호출 가능하게 AWS_IAM으로 설정
aws lambda create-function-url-config \
  --function-name aitutor \
  --auth-type AWS_IAM \
  --invoke-mode RESPONSE_STREAM \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"AllowCredentials":true,"MaxAge":300}' \
  --region $AWS_REGION

# Function URL 획득
FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name aitutor \
  --query 'FunctionUrl' --output text --region $AWS_REGION)
FUNCTION_DOMAIN=$(echo "$FUNCTION_URL" | sed 's|https://||; s|/||')
echo "Function URL: $FUNCTION_URL"
echo "Function Domain: $FUNCTION_DOMAIN"
```

#### 단계 8 — S3 버킷 생성 (정적 SPA)

```bash
BUCKET="aitutor-web-${AWS_ACCOUNT_ID}"

aws s3api create-bucket \
  --bucket $BUCKET \
  --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION

# Public Access 완전 차단
aws s3api put-public-access-block \
  --bucket $BUCKET \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 정적 자산 업로드 (assets/는 immutable)
aws s3 sync dist/ s3://$BUCKET/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"
```

#### 단계 9 — CloudFront 배포 생성 (레이어 1, 2, 3)

```bash
# CloudFront용 OAC(Origin Access Control) 2개: S3용, Lambda용

# OAC for S3
S3_OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config \
    '{"Name":"aitutor-s3-oac","OriginAccessControlOriginType":"s3",
      "SigningBehavior":"always","SigningProtocol":"sigv4"}' \
  --query 'OriginAccessControl.Id' --output text)

# OAC for Lambda Function URL
LAMBDA_OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config \
    '{"Name":"aitutor-lambda-oac","OriginAccessControlOriginType":"lambda",
      "SigningBehavior":"always","SigningProtocol":"sigv4"}' \
  --query 'OriginAccessControl.Id' --output text)

echo "S3 OAC: $S3_OAC_ID"
echo "Lambda OAC: $LAMBDA_OAC_ID"

# CloudFront 배포 설정 (최소 구성)
cat > /tmp/cf-config.json <<JSON
{
  "CallerReference": "aitutor-$(date +%s)",
  "Comment": "aitutor: SPA + Lambda API",
  "Enabled": true,
  "PriceClass": "PriceClass_200",
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "s3-web",
        "DomainName": "${BUCKET}.s3.${AWS_REGION}.amazonaws.com",
        "S3OriginConfig": { "OriginAccessIdentity": "" },
        "OriginAccessControlId": "${S3_OAC_ID}",
        "CustomHeaders": { "Quantity": 0 }
      },
      {
        "Id": "lambda-api",
        "DomainName": "${FUNCTION_DOMAIN}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 5
        },
        "OriginAccessControlId": "${LAMBDA_OAC_ID}",
        "CustomHeaders": { "Quantity": 0 }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-web",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": { "Quantity": 2, "Items": ["GET","HEAD"], "CachedMethods": {"Quantity":2,"Items":["GET","HEAD"]} },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "ResponseHeadersPolicyId": "67f7725c-6f97-4210-82d7-5512b31e9d03"
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [{
      "PathPattern": "/api/*",
      "TargetOriginId": "lambda-api",
      "ViewerProtocolPolicy": "https-only",
      "AllowedMethods": {
        "Quantity": 7,
        "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
        "CachedMethods": {"Quantity":2,"Items":["GET","HEAD"]}
      },
      "Compress": true,
      "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
      "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac"
    }]
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {"ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 10},
      {"ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 10}
    ]
  },
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}
JSON

CF_ID=$(aws cloudfront create-distribution \
  --distribution-config file:///tmp/cf-config.json \
  --query 'Distribution.Id' --output text)

CF_DOMAIN=$(aws cloudfront get-distribution \
  --id $CF_ID --query 'Distribution.DomainName' --output text)

echo "CloudFront ID: $CF_ID"
echo "CloudFront Domain: https://$CF_DOMAIN"
```

> **캐시/요청 정책 ID 설명**:
> - `658327ea-...` = `CachingOptimized` (S3 정적용)
> - `4135ea2d-...` = `CachingDisabled` (API용, 응답 캐시 안 함)
> - `b689b0a8-...` = `AllViewer` (쿠키/헤더/쿼리 전체 포워드 — 인증 쿠키 전달 필수)
> - `67f7725c-...` = `SecurityHeadersPolicy` (HSTS, X-Content-Type-Options 등 자동)

#### 단계 10 — OAC 접근 허용 정책 (레이어 1)

**S3 버킷 정책** (CloudFront만 읽기 허용):

```bash
cat > /tmp/s3-bucket-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOACOnly",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${CF_ID}"
      }
    }
  }]
}
JSON

aws s3api put-bucket-policy --bucket $BUCKET \
  --policy file:///tmp/s3-bucket-policy.json
```

**Lambda 리소스 정책** (CloudFront만 Function URL 호출 허용):

```bash
aws lambda add-permission \
  --function-name aitutor \
  --statement-id AllowCloudFrontOAC \
  --action lambda:InvokeFunctionUrl \
  --principal "cloudfront.amazonaws.com" \
  --source-arn "arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${CF_ID}" \
  --function-url-auth-type AWS_IAM \
  --region $AWS_REGION
```

이 시점에서 **Lambda Function URL을 브라우저로 직접 호출하면 403**이 되고, **CloudFront 경유**로만 200 응답을 받습니다 → **레이어 1(네트워크 경계) 완성**.

#### 단계 11 — 검증 (배포 완료까지 ~15분)

```bash
# CloudFront 배포 상태
aws cloudfront get-distribution --id $CF_ID \
  --query 'Distribution.Status'   # 'Deployed' 되면 완료

# 검증
curl -I "https://${CF_DOMAIN}/"                    # 200 + HSTS/X-* 헤더
curl "https://${CF_DOMAIN}/api/categories"         # API 응답
curl -I "${FUNCTION_URL}"                          # 403 (직접 접근 차단 — 정상)
```

#### 단계 12 — 비용 알림 (레이어 9)

```bash
# AWS Budgets: 월 $5 초과 시 알림
cat > /tmp/budget.json <<JSON
{
  "BudgetName": "aitutor-monthly-5usd",
  "BudgetLimit": {"Amount": "5", "Unit": "USD"},
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {"TagKeyValue": ["user:Project\$aitutor"]}
}
JSON

cat > /tmp/budget-notify.json <<JSON
[{
  "Notification": {
    "NotificationType": "ACTUAL",
    "ComparisonOperator": "GREATER_THAN",
    "Threshold": 80,
    "ThresholdType": "PERCENTAGE"
  },
  "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "your-email@example.com"}]
}]
JSON

aws budgets create-budget \
  --account-id $AWS_ACCOUNT_ID \
  --budget file:///tmp/budget.json \
  --notifications-with-subscribers file:///tmp/budget-notify.json

# Cost Anomaly Detection (ML 기반 이상 감지, 무료)
aws ce create-anomaly-monitor --anomaly-monitor \
  '{"MonitorName":"aitutor-anomaly","MonitorType":"DIMENSIONAL",
    "MonitorDimension":"SERVICE"}'
```

#### 단계 13 — Capacitor/프론트 URL 반영

CloudFront 도메인을 클라이언트에 알려야 합니다. 두 가지 방법:

**방법 A**: SPA가 같은 오리진(`$CF_DOMAIN`)에서 서빙되므로 `/api/*` 상대 경로 그대로 작동 — **코드 변경 없음**

**방법 B** (Capacitor 네이티브 앱): `capacitor.config.json`의 `server.url`을 `https://$CF_DOMAIN`으로 변경 후 네이티브 재빌드

### C.8. 재배포 절차 (코드 변경 후)

```bash
# 1) 프론트엔드 빌드
npm run build:fe

# 2) 이미지 재빌드 + 푸시
docker buildx build --platform linux/amd64 \
  -t "${ECR_URI}:latest" --push .

# 3) Lambda 함수 업데이트
aws lambda update-function-code \
  --function-name aitutor \
  --image-uri "${ECR_URI}:latest" \
  --region $AWS_REGION

# 4) S3 동기화 (정적 파일 변경 시)
aws s3 sync dist/ s3://$BUCKET/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" --delete

aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# 5) CloudFront 캐시 무효화 (index.html만)
aws cloudfront create-invalidation \
  --distribution-id $CF_ID --paths "/index.html" "/"
```

### C.9. 보안 운영 체크리스트

#### C.9.1. 일일 운영 (자동화 권장)

| 항목 | 방법 | 주기 |
|------|------|------|
| CloudWatch 에러율 확인 | Dashboard 또는 알림 | 매일 |
| Supabase 연결 건강성 | `SELECT 1` 쿼리 (헬스 엔드포인트 추가 가능) | 매일 |
| Budget 메일 수신 | 자동 | 자동 |

#### C.9.2. 월간 운영

| 항목 | 방법 | 주기 |
|------|------|------|
| IAM 자격증명 리포트 검토 | `aws iam generate-credential-report` | 매월 |
| 사용하지 않는 IAM 키 비활성화 | 검토 후 수동 | 매월 |
| CloudWatch Logs 이상 패턴 | Logs Insights로 ERROR/WARN 집계 | 매월 |
| SSM Parameter 마지막 수정일 검토 | `aws ssm describe-parameters` | 매월 |
| AWS Budgets 실제 비용 vs 예산 | 대시보드 확인 | 매월 |

#### C.9.3. 분기 운영

| 항목 | 방법 | 주기 |
|------|------|------|
| AUTH_TOKEN_SECRET 로테이션 | 새 키 발급 → SSM 업데이트 → 재배포 | 분기 |
| AI API 키 로테이션 | 각 프로바이더 대시보드에서 새 키 → SSM 교체 | 분기 |
| Supabase 비밀번호 변경 | Supabase 대시보드 → DATABASE_URL 업데이트 | 분기 |
| KMS CMK 키 회전 확인 | 자동 회전 기본 365일, 수동 회전 지원 | 분기 |
| IAM 최소 권한 재검토 | Access Analyzer 리포트 확인 | 분기 |

### C.10. 부록 B 대비 변경점

| 항목 | 부록 B (완전 AWS) | 부록 C (경량 + 보안) |
|------|-------------------|----------------------|
| DB | RDS PostgreSQL (이관) | **Supabase 유지** |
| 이메일 | SES (Resend 대체) | **Resend 유지** (키만 SSM) |
| CloudFront | 선택 (Lambda가 직접 서빙) | **필수** (보안 경계) |
| Function URL 인증 | `NONE` 공개 | **`AWS_IAM` + OAC** |
| SSM 암호화 | 기본 AWS 관리 키 | **Customer Managed KMS Key** |
| Reserved Concurrency | 미설정 | **10개 제한** (비용 DoS 차단) |
| 보안 레이어 수 | 3~4중 | **10중** |
| 월 비용 | $0(1년차) / $13(이후) | **$1 (상시)** |
| 이관 리스크 | 중간 (DB 데이터 이관) | **낮음** (코드 변경만) |
| docstore 호환성 | ❌ (DB 분리) | **✅ (유지)** |

### C.11. 실행 요약 (압축)

```bash
# 10개 명령으로 압축
# 1. 사전 준비
export AWS_REGION=ap-northeast-2
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 2. KMS CMK
KMS_KEY_ID=$(aws kms create-key --description "aitutor SSM" --query 'KeyMetadata.KeyId' --output text)
aws kms create-alias --alias-name alias/aitutor-ssm --target-key-id $KMS_KEY_ID

# 3. SSM 업로드 (단계 2 스크립트)
# 4. IAM 역할 (단계 3 스크립트)
# 5. 이미지 빌드/푸시 (단계 5 스크립트)
# 6. Lambda 함수 + URL (단계 6, 7 스크립트)
# 7. S3 + 업로드 (단계 8)
# 8. CloudFront + OAC (단계 9)
# 9. 리소스 정책 (단계 10)
# 10. 검증 (단계 11) + Budget (단계 12)
```

### C.12. 최소 스펙 최종 권장안

- **컴퓨팅**: Lambda Container Image, 1024MB, timeout 300s, **Reserved Concurrency 10**
- **DB**: **Supabase 유지** (DATABASE_URL은 SSM SecureString)
- **CDN/보안**: **CloudFront + OAC (필수)**, HTTPS only, HSTS, TLS 1.2+
- **시크릿**: **SSM SecureString + KMS CMK**
- **인증**: Function URL = `AWS_IAM` (외부 직접 호출 차단)
- **IAM**: Least-privilege (SSM 특정 경로 + KMS Decrypt만)
- **로그**: CloudWatch Logs 7일 보관
- **비용 보호**: AWS Budgets $5 + Cost Anomaly Detection
- **리전**: `ap-northeast-2` (Seoul) 통일
- **비용**: **월 $1~$2 상시**, 트래픽 늘어도 Reserved로 상한 예측 가능

이 조합은 **DAU 5 전제에서 보안성/비용/기능/운영 단순성**을 모두 최적화한 설계입니다. 실행은 C.7의 13단계 체크리스트를 순서대로 수행하면 됩니다.

> **⚠️ 후속 재진단 필요**: 부록 C는 **일반 웹 앱** 관점으로 설계되었습니다. aitutor의 실제 워크로드는 **LLM 호출이 많고 이미지 업로드 20MB까지** 처리해야 하는 특수성이 있어 **부록 D (§17)** 에서 이 관점으로 재진단 후 개선안을 제시합니다. AWS로 갈 경우 **부록 D를 최종 설계**로 사용하세요.

---

## 부록 D: LLM + 이미지 워크로드 최적 아키텍처 (aws CLI 실측 기반)

본 부록은 **aitutor의 실제 워크로드 특성**(LLM 다량 호출 + 이미지 작업 빈번)과 **aws CLI 실측 점검 결과**를 반영한 최종 설계입니다.

### D.0. AWS CLI 현재 상태 점검 결과 (2026-04-22 실측)

`aws sts get-caller-identity` 및 관련 명령으로 확인한 현 상태:

| 항목 | 실측값 | 판정 |
|------|--------|------|
| aws CLI 버전 | **aws-cli/2.33.9** | ✅ 최신 |
| OS | Darwin/25.3.0 (macOS, arm64) | ✅ Apple Silicon — `--platform linux/amd64` 빌드 필수 |
| IAM 사용자 | `2team-cli` (Account `794531974010`) | ✅ 연결됨 |
| 기본 리전 | `ap-northeast-2` (Seoul) | ✅ 의도대로 |
| Lambda 권한 | **AccessDeniedException** | ❌ **선결 과제** |
| CloudFront 권한 | **AccessDeniedException** | ❌ **선결 과제** |
| ECR 권한 | **AccessDeniedException** | ❌ **선결 과제** |
| S3 권한 | 읽기 OK (ListBuckets 가능) | ⚠️ 쓰기 미검증 |
| service-quotas 조회 | **AccessDeniedException** | ❌ 권한 없음 |
| 기존 aitutor 리소스 | 없음 (깨끗한 환경) | ✅ 충돌 없음 |

#### D.0.1. 워크로드 실측 (로컬 파일시스템)

| 항목 | 실측값 | 시사점 |
|------|--------|--------|
| `public/q-images/` | **19MB**, 230+ 파일, 최대 파일 **459KB** | 모든 이미지 < 500KB → **S3 직접 서빙 최적**, Lambda로 서빙하면 비효율 |
| `dist/` 빌드 산출물 | 1.1MB | 매우 작음 — S3 호스팅 간단 |
| `node_modules/` 전체 | **207MB** | **Lambda zip(50MB) 불가** → **Container Image 필수** |
| pdf-parse + pdfjs-dist | 57MB | 메모리 사용 주의 (pool-upload 경로) |
| openai SDK | 7.4MB | 정상 |
| @google/generative-ai | 소형 | Gemini Vision용 |

#### D.0.2. 선결 과제: IAM 권한 부여 (루트/관리자 작업 필요)

배포 시작 전 `2team-cli` 사용자에 **아래 권한 부여 필수**. 가장 간단한 방법은 루트 사용자가 콘솔에서 정책 연결:

```bash
# 관리자 계정으로 실행
USER=2team-cli
for POLICY in \
  arn:aws:iam::aws:policy/AWSLambda_FullAccess \
  arn:aws:iam::aws:policy/CloudFrontFullAccess \
  arn:aws:iam::aws:policy/AmazonS3FullAccess \
  arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess \
  arn:aws:iam::aws:policy/IAMFullAccess \
  arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser \
  arn:aws:iam::aws:policy/AmazonSSMFullAccess \
  arn:aws:iam::aws:policy/CloudWatchLogsFullAccess \
  arn:aws:iam::aws:policy/AWSBudgetsActionsWithAWSResourceControlAccess \
  arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole; do
  aws iam attach-user-policy --user-name $USER --policy-arn $POLICY
done
```

운영 안정화 후에는 **사용자 전용 최소 권한 정책으로 교체 권장** (본 부록 D.11 참조).

### D.1. aitutor 워크로드 특성 (재확인)

| 특성 | 세부 |
|------|------|
| LLM 호출 | Gemini/OpenAI/Claude 3사, **SSE 스트리밍 기본**, o3-pro/xhigh는 **최대 5분** |
| LLM 요청 페이로드 | 이미지 첨부 base64 포함 시 **5MB 이상 가능** |
| pool-upload | **최대 20MB** PDF/이미지 → Gemini Vision 추출 |
| memo-files | 파일당 5MB 제한, 현재 **DB base64 저장** |
| 정적 이미지 | q-images 230+ 파일, 개별 < 500KB |
| 관리자 작업 | import-docstore, pool-upload 등 장시간 / 대용량 |

### D.2. 부록 C의 한계 재진단 (이미지/LLM 관점)

| # | 한계 | 심각도 | 원인 |
|---|------|--------|------|
| 1 | **Lambda Function URL 요청 페이로드 6MB 한계** | 🔴 **치명적** | pool-upload 20MB 파일 업로드 **실패**. AI + 이미지 첨부 5MB 요청도 경계 |
| 2 | **Lambda 메모리 1024MB** | 🟠 중 | 20MB base64 팽창 + pdf-parse(57MB lib) + AI SDK 동시 구동 시 OOM 가능 |
| 3 | **DB base64 이미지 저장** | 🟠 중 | Supabase 무료 500MB 빠르게 소진, Lambda 응답 메모리 부담 |
| 4 | **Cold start 2~4초** | 🟡 경 | Container Image 특성. SSE 첫 바이트 지연 체감 |
| 5 | **CloudFront origin read timeout 60초** | 🟡 경 | 장시간 모델 **첫 응답**이 60초 넘으면 타임아웃. SSE는 첫 바이트만 빠르면 유지됨. heartbeat 필요 |
| 6 | **Lambda 응답 페이로드** | 🟢 해결됨 | Response Streaming 사용 시 사실상 무제한 (SSE 델타 청크는 작음) |

### D.3. 개선 아키텍처 (부록 D 최종)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 브라우저 / Capacitor 앱                                                │
└──────┬────────────────────────────────────────────────┬──────────────┘
       │ ① /api/* (요청 본문 ≤ 6MB)                     │ ② 직접 업로드/다운로드
       ▼                                                ▼
┌──────────────────────────┐            ┌───────────────────────────────┐
│ CloudFront + OAC         │            │ S3: aitutor-files (private)    │
│ HTTP/2+3, TLS 1.2+       │            │  ├─ memos/{memo_id}/{uuid}     │
│ DDoS Shield Standard     │◀──────────▶│  ├─ uploads/pool/{uuid}        │
│ Security Headers Policy  │  presigned │  └─ public/q-images/*.png      │
└──┬────────────────┬──────┘  URL 서명   │  Lifecycle: 30일 자동 삭제     │
   │ /*, /q-images/ │ /api/*             │  Block Public Access           │
   ▼                ▼                    └───────────────────────────────┘
┌──────────┐   ┌─────────────────────────┐            ▲
│ S3: web  │   │ Lambda (Container Image)│            │ SigV4
│ dist/*   │   │  메모리: 2048MB          │            │
└──────────┘   │  timeout: 300s           │────────────┘
                │  Reserved Concurrency=10 │
                │  Function URL:           │
                │    AWS_IAM + OAC         │
                │    Response Streaming    │
                │  Keep-warm: EventBridge  │ ────▶ Supabase PostgreSQL (유지)
                │    5분 주기 ping         │ ────▶ 외부 LLM API (3사)
                │  환경: NODE_ENV=prod      │ ────▶ Resend (이메일)
                └─────────────────────────┘
                         ▲
                         │ 시크릿 주입
                ┌─────────────────────┐
                │ SSM Parameter Store │
                │  SecureString +     │
                │  KMS CMK 암호화     │
                └─────────────────────┘
```

**핵심 변경 요약**:
1. **파일은 Lambda를 통과하지 않는다** — 클라이언트가 presigned URL로 S3에 **직접** 업로드/다운로드
2. **Lambda 메모리 1024→2048MB** (이미지 처리 여유)
3. **정적 q-images를 dist와 함께 S3로 이관** (CloudFront 캐시 히트율 극대화)
4. **EventBridge 5분 keep-warm** (Provisioned Concurrency 대체, 무료 유지)
5. **memo_files.data 컬럼을 S3 key로 이관** (DB 부하 해소)

### D.4. 이미지 업로드/다운로드 흐름 재설계

#### D.4.1. 메모 첨부파일 업로드 (현재 → 개선)

```
[현재 흐름]
Browser
  └─ POST /api/memo-files?action=upload (base64, ≤5MB)
      └─ Lambda가 base64 디코딩 → DB INSERT (data 컬럼)

[개선 흐름 — 부록 D]
Browser
  ├─ ① POST /api/upload-sign {purpose:'memo', memo_id, filename, mime_type, size}
  │    └─ Lambda가 presigned POST URL 발급 (TTL 5분, Content-Length/MIME 제약)
  ├─ ② Browser → 직접 S3 POST (multipart/form-data)
  │    └─ S3 key = memos/{memo_id}/{uuid}.{ext}
  └─ ③ POST /api/memo-files?action=confirm {memo_id, s3_key, filename, mime_type, size}
       └─ Lambda가 DB에 key만 저장 (data 컬럼 → s3_key로 스키마 변경 필요)
```

#### D.4.2. 메모 첨부파일 다운로드 (현재 → 개선)

```
[현재 흐름]
Browser → GET /api/memo-files?action=download&id=X
  └─ Lambda가 DB SELECT → base64 data 반환 (JSON 응답, Lambda 메모리 사용)

[개선 흐름]
Browser → GET /api/memo-files?action=download&id=X
  └─ Lambda가 DB SELECT → presigned GET URL 반환 (TTL 60초)
Browser → 302 Redirect 또는 직접 S3 GET
  (CloudFront 경유 또는 S3 직접, 둘 다 가능)
```

#### D.4.3. pool-upload 20MB 파일 (관리자 전용)

```
[현재] ❌ Lambda 6MB 제한으로 20MB 전송 불가
[개선]
Browser (관리자)
  ├─ ① POST /api/upload-sign {purpose:'pool', filename, mime_type, size ≤20MB}
  ├─ ② Browser → S3 직접 업로드 (multipart)
  └─ ③ POST /api/pool-upload {action:'extract', s3_key}
       └─ Lambda가 S3에서 파일 GET → Gemini Vision 호출
          (Lambda 내 메모리에 20MB 파일 버퍼 → 2GB 메모리 여유로 처리 가능)
```

#### D.4.4. LLM 이미지 첨부 요청 (AI 해설)

base64 5MB 이하는 **현재 방식 유지**. 5MB 초과는 사용자에게 "이미지를 먼저 메모에 첨부한 뒤 링크로 참조" 또는 서버사이드 리사이즈 옵션. 대부분의 Q&A 이미지는 1MB 미만이므로 실무 영향 거의 없음.

### D.5. 코드 변경 요약

#### D.5.1. 변경 파일 목록

| 파일 | 변경 유형 | 범위 |
|------|-----------|------|
| `api/upload-sign.js` | **신규** | +100줄. presigned POST/GET 발급 |
| `api/memo-files.js` | **리팩터** | `upload` 액션 → `confirm`으로 대체, `download` 액션 → presigned URL 반환 |
| `api/pool-upload.js` | **리팩터** | `extract` 액션이 `s3_key`를 받아 S3에서 파일 조회 |
| DB 마이그레이션 SQL | **신규** | `memo_files.data` → `memo_files.s3_key` 컬럼 추가, 기존 base64 마이그레이션 배치 |
| `src/lib/api.js` 또는 신규 `upload.js` | **신규** | 클라이언트 업로드 플로우 헬퍼 (signedUploadFile) |
| `lambda.js` | 부록 C와 동일 | — |
| `Dockerfile` | **변경** | S3 SDK 포함, 메모리 여유 대비 |
| `package.json` | 의존성 추가 | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |

#### D.5.2. `api/upload-sign.js` (신규)

```js
// api/upload-sign.js — S3 presigned URL 발급 (업로드/다운로드 공용)
const { S3Client } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const { withAuth, withAdmin } = require('./middleware');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const BUCKET = process.env.S3_FILES_BUCKET;  // aitutor-files-<account-id>

module.exports = withAuth(async (req, res) => {
  const { action, purpose, filename, mime_type, size, s3_key } = req.body || {};

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' });

  // ── 업로드 URL 발급 ──
  if (action === 'upload') {
    // 검증
    const VALID_PURPOSES = ['memo', 'pool'];
    if (!VALID_PURPOSES.includes(purpose)) return res.status(400).json({ error: 'purpose 불명' });

    // 크기 제한: memo=5MB, pool=20MB (관리자만)
    const MAX_SIZE = purpose === 'pool' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (!size || size > MAX_SIZE) return res.status(400).json({ error: `파일 크기는 ${MAX_SIZE / 1024 / 1024}MB 이하` });

    // pool은 관리자만
    if (purpose === 'pool' && !req.user.admin) return res.status(403).json({ error: '관리자 전용' });

    // MIME 화이트리스트
    const ALLOWED_MIMES = [
      'application/pdf', 'image/png', 'image/jpeg', 'image/gif',
      'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!ALLOWED_MIMES.includes(mime_type)) return res.status(400).json({ error: '허용되지 않는 파일 형식' });

    // 키 생성 (경로 traversal 방지)
    const ext = filename.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const uuid = crypto.randomUUID();
    const key = `${purpose === 'memo' ? 'memos' : 'uploads/pool'}/${req.user.uid}/${uuid}.${ext}`;

    // presigned POST (브라우저 form upload용)
    const presigned = await createPresignedPost(s3, {
      Bucket: BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 0, MAX_SIZE],
        ['starts-with', '$Content-Type', mime_type.split('/')[0]],
      ],
      Fields: { 'Content-Type': mime_type },
      Expires: 300,   // 5분
    });

    return res.json({ key, ...presigned });
  }

  // ── 다운로드 URL 발급 ──
  if (action === 'download') {
    if (!s3_key) return res.status(400).json({ error: 's3_key 필수' });
    // 간단 권한 체크: 사용자 경로 접두사 확인 (엄격히는 DB 조회 병행)
    if (!s3_key.startsWith(`memos/${req.user.uid}/`) && !req.user.admin) {
      return res.status(403).json({ error: '접근 권한 없음' });
    }

    const url = await getSignedUrl(s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: s3_key }),
      { expiresIn: 60 }
    );
    return res.json({ url });
  }

  return res.status(400).json({ error: 'action 불명' });
});
```

#### D.5.3. `api/memo-files.js` 주요 변경

```js
// 기존 upload 액션 → confirm 액션으로 변경
if (req.method === 'POST' && action === 'confirm') {
  const { memo_id, s3_key, filename, mime_type, size } = req.body;
  if (!memo_id || !s3_key || !filename) return res.status(400).json({ error: '필수 필드 누락' });

  // 접근 권한 체크: s3_key 경로가 본인 것인지 확인
  if (!s3_key.startsWith(`memos/${req.user.uid}/`) && !req.user.admin) {
    return res.status(403).json({ error: '권한 없음' });
  }

  const result = await query(
    `INSERT INTO memo_files (memo_id, filename, mime_type, s3_key, size)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
    [memo_id, filename, mime_type, s3_key, size]
  );
  return res.json({ id: result.rows[0].id, ... });
}

// 기존 download는 s3_key만 반환 (클라이언트가 /api/upload-sign?action=download로 presigned URL 획득)
if (req.method === 'GET' && action === 'download') {
  const { id } = req.query;
  const result = await query('SELECT filename, mime_type, s3_key FROM memo_files WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: '없음' });
  return res.json(result.rows[0]);   // { filename, mime_type, s3_key }
}
```

#### D.5.4. `api/pool-upload.js` 주요 변경

```js
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: process.env.AWS_REGION });

// 기존 extract 액션
if (action === 'extract') {
  const { s3_key } = req.body;  // 기존 file_data, file_name, mime_type 대신
  if (!s3_key) return res.status(400).json({ error: 's3_key 필수' });

  // S3에서 파일 읽기
  const obj = await s3.send(new GetObjectCommand({
    Bucket: process.env.S3_FILES_BUCKET, Key: s3_key,
  }));
  const buffer = Buffer.concat(await obj.Body.toArray());
  const mime_type = obj.ContentType;
  const file_data = buffer.toString('base64');   // Gemini Vision이 base64 요구

  // 기존 extractQuestionsVision 로직 그대로
  const questions = await extractQuestionsVision(file_data, mime_type, s3_key);
  return res.json({ success: true, s3_key, questions, ... });
}
```

#### D.5.5. DB 마이그레이션 SQL

```sql
-- memo_files에 s3_key 컬럼 추가 (기존 data 컬럼 병존)
ALTER TABLE memo_files
  ADD COLUMN s3_key VARCHAR(512),
  ADD COLUMN migrated BOOLEAN DEFAULT false;

-- (선택) 기존 data 컬럼을 NULL 허용으로 변경
ALTER TABLE memo_files ALTER COLUMN data DROP NOT NULL;

-- 신규 업로드는 s3_key만 사용. 기존 레코드는 일괄 마이그레이션 배치 스크립트로 S3 이관 후
-- UPDATE memo_files SET s3_key = ?, migrated = true, data = NULL WHERE id = ?;

-- 완전 마이그레이션 완료 후
-- ALTER TABLE memo_files DROP COLUMN data;
-- ALTER TABLE memo_files DROP COLUMN migrated;
```

### D.6. Lambda 사양 업그레이드

| 파라미터 | 부록 C | 부록 D | 근거 |
|----------|--------|--------|------|
| 메모리 | 1024MB | **2048MB** | 20MB base64 + pdf-parse 파싱 동시 여유 |
| timeout | 300s | **300s** | 변경 없음 (Lambda 최대 900s 가능) |
| Reserved Concurrency | 10 | **10** | 변경 없음 (비용 DoS 차단) |
| Keep-warm | 없음 | **EventBridge 5분 주기** | Cold start 완화, 비용 0 |
| Package Type | Image | **Image** | node_modules 207MB로 zip 불가 |
| Runtime | nodejs:22 base image | **동일** | — |

#### D.6.1. EventBridge Keep-warm 규칙

```bash
# 5분마다 Lambda에 warmup 이벤트 발송
aws events put-rule \
  --name aitutor-warmup \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED \
  --region ap-northeast-2

# Lambda를 타깃으로 등록
aws events put-targets \
  --rule aitutor-warmup \
  --targets "Id"="1","Arn"="arn:aws:lambda:ap-northeast-2:${AWS_ACCOUNT_ID}:function:aitutor","Input"='"{\"source\":\"warmup\"}"' \
  --region ap-northeast-2

# Lambda 호출 권한 부여
aws lambda add-permission \
  --function-name aitutor \
  --statement-id AllowEventBridgeWarmup \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:ap-northeast-2:${AWS_ACCOUNT_ID}:rule/aitutor-warmup \
  --region ap-northeast-2
```

**warmup 이벤트 처리** (`lambda.js` 추가 분기):

```js
exports.handler = async (event, context) => {
  // Warmup 이벤트 감지 → 즉시 리턴 (초기화만 유지)
  if (event?.source === 'warmup') {
    console.log('[Warmup] Lambda 활성 유지');
    return { statusCode: 200, body: 'warm' };
  }
  const handler = await init();
  return handler(event, context);
};
```

비용: 5분 × 8,640회/월 × 200ms × 2GB = 3,456 GB-sec/월 → **무료 티어 400K GB-sec 내, $0**

### D.7. S3 버킷 설계 (파일 전용)

#### D.7.1. 버킷 분리

| 버킷 | 용도 | Public Access | CORS | Lifecycle |
|------|------|---------------|------|-----------|
| `aitutor-web-{acct}` | SPA `dist/` + `q-images/` | Block (CloudFront OAC만) | 불필요 | 없음 |
| `aitutor-files-{acct}` | 사용자 업로드 (memos, pool) | Block (presigned URL만) | 브라우저 직접 업로드용 | `uploads/pool/*` 30일 자동 삭제 |

#### D.7.2. 생성 명령

```bash
BUCKET_WEB="aitutor-web-${AWS_ACCOUNT_ID}"
BUCKET_FILES="aitutor-files-${AWS_ACCOUNT_ID}"

# 두 버킷 생성
for B in $BUCKET_WEB $BUCKET_FILES; do
  aws s3api create-bucket --bucket $B --region $AWS_REGION \
    --create-bucket-configuration LocationConstraint=$AWS_REGION
  aws s3api put-public-access-block --bucket $B \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket $B \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
done

# 파일 버킷 CORS (브라우저 직접 업로드)
cat > /tmp/s3-cors.json <<JSON
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT","POST","GET","HEAD"],
    "AllowedOrigins": ["https://${CF_DOMAIN}"],
    "ExposeHeaders": ["ETag","x-amz-version-id"],
    "MaxAgeSeconds": 300
  }]
}
JSON
aws s3api put-bucket-cors --bucket $BUCKET_FILES --cors-configuration file:///tmp/s3-cors.json

# 파일 버킷 Lifecycle: pool 업로드는 30일 후 자동 삭제
cat > /tmp/s3-lifecycle.json <<'JSON'
{
  "Rules": [{
    "ID": "ExpirePoolUploads",
    "Status": "Enabled",
    "Filter": {"Prefix": "uploads/pool/"},
    "Expiration": {"Days": 30}
  }, {
    "ID": "AbortMultipart",
    "Status": "Enabled",
    "Filter": {"Prefix": ""},
    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}
  }]
}
JSON
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_FILES --lifecycle-configuration file:///tmp/s3-lifecycle.json

# dist + q-images를 web 버킷에 업로드
cd /Users/2team/aifac/workspace/aitutor
npm run build:fe
aws s3 sync dist/ s3://$BUCKET_WEB/ \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"
aws s3 cp dist/index.html s3://$BUCKET_WEB/index.html \
  --cache-control "no-cache, no-store, must-revalidate"
aws s3 sync public/q-images/ s3://$BUCKET_WEB/q-images/ \
  --cache-control "public, max-age=31536000, immutable"
```

### D.8. Lambda IAM 역할 확장 (S3 접근 추가)

부록 C의 Lambda 역할에 S3 권한을 덧붙입니다.

```bash
cat > /tmp/lambda-s3-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FilesBucketRW",
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"],
      "Resource": "arn:aws:s3:::aitutor-files-${AWS_ACCOUNT_ID}/*"
    },
    {
      "Sid": "FilesBucketList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::aitutor-files-${AWS_ACCOUNT_ID}"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name AitutorLambdaRole \
  --policy-name AitutorS3Access \
  --policy-document file:///tmp/lambda-s3-policy.json
```

Lambda 환경변수에 버킷명 주입:

```bash
aws lambda update-function-configuration \
  --function-name aitutor \
  --environment "Variables={NODE_ENV=production,S3_FILES_BUCKET=aitutor-files-${AWS_ACCOUNT_ID}}" \
  --region ap-northeast-2
```

### D.9. 비용 재산정 (DAU 5, 부록 D 기준)

| 항목 | 사용량 | 비용 |
|------|--------|------|
| Lambda (2GB, 5K 요청 + warmup 8.6K) | ~13K 요청, 5K GB-sec | **$0** (무료 티어) |
| Function URL | — | **$0** |
| CloudFront 송신 + 요청 | ~2GB, 50K 요청 | **$0** (1TB/10M 무료) |
| S3 web 버킷 (25MB) | GET 50K | **$0** (5GB/20K GET 무료, 약간 초과분 무시) |
| S3 files 버킷 (~1GB 누적) | PUT 500, GET 2K | **$0.02** |
| S3 presigned URL 서명 | Lambda 내 처리 | **$0** |
| SSM SecureString 7개 | GetParametersByPath | **$0** (무료) |
| KMS CMK | 1개 | **$1.00** |
| KMS API 호출 | ~10K | **$0** (20K 무료) |
| CloudWatch Logs | ~200MB | **$0** (5GB 무료) |
| ECR 이미지 저장 | 0.5GB | **$0.05** |
| EventBridge 룰 (warming) | 8.6K | **$0** (14M 무료) |
| AWS Budgets | 1개 | **$0** |
| Supabase 유지 | 무료 티어 | **$0** |
| Resend | ~50 이메일 | **$0** (무료 티어 3K) |
| Route 53 (선택) | 1 hosted zone | **$0.50** |
| ACM 인증서 | 1개 | **$0** |
| **합계 (도메인 없이)** | | **💰 $1.07/월** |
| **합계 (커스텀 도메인 포함)** | | **💰 $1.57/월** |

**AI API 비용**(별도): DAU 5 × 해설 500건/월 × Gemini 2.5 Flash 중심 = **~$1/월** (프로바이더 직접 청구)

### D.10. AWS CLI 실행 체크리스트 (부록 C 대비 증분)

```bash
# ─── 선결 과제 ───
# 0. IAM 권한 부여 (루트/관리자 계정에서 실행, D.0.2 참조)

# ─── 부록 C에서 공통 ───
# 1. KMS CMK 생성                         (C.7 단계 1)
# 2. SSM에 시크릿 등록                      (C.7 단계 2)
# 3. Lambda IAM 역할 생성                  (C.7 단계 3)

# ─── 부록 D 증분 ───
# 4. S3 두 버킷 생성 + CORS + Lifecycle    (D.7.2)
# 5. dist + q-images를 web 버킷에 업로드    (D.7.2 하단)
# 6. Lambda IAM 역할에 S3 권한 추가         (D.8)

# ─── 코드 변경 ───
# 7. api/upload-sign.js 신규 작성           (D.5.2)
# 8. api/memo-files.js 리팩터               (D.5.3)
# 9. api/pool-upload.js 리팩터              (D.5.4)
# 10. DB 마이그레이션 (Supabase SQL Editor) (D.5.5)
# 11. package.json 의존성 추가
#     npm install @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner
# 12. 클라이언트 업로드 플로우 리팩터 (src/lib)

# ─── 부록 C에서 공통 ───
# 13. Dockerfile로 Lambda Container Image 빌드/푸시 (C.7 단계 5)
# 14. Lambda 함수 생성 (메모리 2048MB)      (C.7 단계 6 + D.6)
# 15. Function URL 생성 (AWS_IAM + Stream)  (C.7 단계 7)
# 16. CloudFront 배포 (web 버킷 + Lambda)   (C.7 단계 9 — 단, S3 오리진은 web 버킷)
# 17. S3/Lambda 리소스 정책 (CloudFront OAC)(C.7 단계 10)

# ─── 부록 D 증분 ───
# 18. EventBridge keep-warm 규칙 추가       (D.6.1)
# 19. Lambda 환경변수에 S3_FILES_BUCKET     (D.8 하단)

# ─── 부록 C에서 공통 ───
# 20. 검증 (C.7 단계 11)
# 21. AWS Budgets + Anomaly Detection       (C.7 단계 12)
```

### D.11. 운영 안정화 후 IAM 최소 권한 재적용

배포 성공 후 `2team-cli`의 FullAccess 정책을 **프로젝트 한정 최소 권한 정책**으로 교체 권장:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AitutorLambdaMgmt",
      "Effect": "Allow",
      "Action": ["lambda:Get*","lambda:List*","lambda:UpdateFunctionCode",
                 "lambda:UpdateFunctionConfiguration","lambda:InvokeFunction"],
      "Resource": "arn:aws:lambda:ap-northeast-2:794531974010:function:aitutor*"
    },
    {
      "Sid": "AitutorECRPush",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken","ecr:BatchCheckLayerAvailability",
                 "ecr:PutImage","ecr:InitiateLayerUpload","ecr:UploadLayerPart",
                 "ecr:CompleteLayerUpload","ecr:Describe*","ecr:List*"],
      "Resource": "arn:aws:ecr:ap-northeast-2:794531974010:repository/aitutor*"
    },
    {
      "Sid": "AitutorS3",
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::aitutor-*",
        "arn:aws:s3:::aitutor-*/*"
      ]
    },
    {
      "Sid": "AitutorCloudFront",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation","cloudfront:GetDistribution","cloudfront:ListDistributions"],
      "Resource": "*"
    },
    {
      "Sid": "AitutorSSM",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter*","ssm:PutParameter"],
      "Resource": "arn:aws:ssm:ap-northeast-2:794531974010:parameter/aitutor/*"
    },
    {
      "Sid": "KMSDecrypt",
      "Effect": "Allow",
      "Action": ["kms:Decrypt","kms:DescribeKey"],
      "Resource": "*"
    }
  ]
}
```

### D.12. 부록 C vs 부록 D 차이 요약

| 항목 | 부록 C | 부록 D ⭐ |
|------|--------|-----------|
| 이미지 저장 | DB base64 (Supabase 부담↑) | **S3 presigned** (Supabase 부담 해소) |
| pool-upload 20MB | ❌ 불가능 (6MB 초과) | **✅ 가능** (S3 직접 업로드) |
| Lambda 메모리 | 1024MB | **2048MB** |
| Cold start 대응 | 없음 | **EventBridge 5분 warming** |
| q-images 서빙 | Lambda 경유 | **S3 직접 (CloudFront 캐시)** |
| 클라이언트 플로우 | 단순 (Lambda만 호출) | **2단계** (sign → S3 → confirm) |
| 월 비용 | $1.05 | **$1.07** (거의 동일) |
| 보안 레이어 | 10중 | **10중 + S3 presigned TTL + Lifecycle** |
| DB 공간 사용량 | 높음 (base64 저장) | **낮음** (key만 저장) |

### D.13. 최종 권장안 요약 (AWS + Supabase 유지 + LLM/이미지 특화)

- **컴퓨팅**: Lambda Container Image, **2048MB**, timeout 300s, Reserved Concurrency 10, Function URL(AWS_IAM + OAC), Response Streaming, **EventBridge 5분 warming**
- **DB**: **Supabase 유지**, DATABASE_URL은 SSM SecureString
- **파일 저장**: **S3 2버킷** (web = 정적 SPA+q-images, files = 사용자 업로드), 모두 Block Public Access + CloudFront OAC
- **업로드/다운로드**: **presigned POST/GET URL** 기반 클라이언트 직접 통신 — Lambda 6MB 제약 우회
- **CDN/보안**: CloudFront + OAC, TLS 1.2+, HSTS, DDoS Shield Standard
- **시크릿**: SSM SecureString + **KMS Customer Managed Key**
- **IAM**: 운영 안정화 후 프로젝트 한정 최소 권한 정책 전환
- **비용**: **월 $1.07** 상시 (커스텀 도메인 포함 $1.57)
- **선결 과제**: `2team-cli` IAM 사용자에 배포 권한 부여 (D.0.2)

이 설계는 **aitutor의 LLM + 이미지 워크로드를 AWS 경량 스택으로 안전하게 수용하면서 월 $1~$2를 유지**합니다. AWS로 결정하신다면 이 부록 D를 **최종 설계**로 채택하시고, D.10 체크리스트의 21단계를 순서대로 실행하시면 됩니다.

> **💡 더 단순한 대안**: 부록 D는 보안 10중 설계라 부품이 9개입니다. DAU 5에는 과해요. **부록 E (§18)** 은 보안·캐시의 일부를 양보하고 **부품을 4개(Lambda/S3/SSM/Supabase)로 압축**한 극단 단순화 버전입니다. 운영 단순성이 최우선이라면 부록 E를 채택하세요.

---

## 부록 E: AWS 최소 부품 아키텍처 (극단 단순화 · 4부품)

본 부록은 "**아키텍처를 최대한 단순하게**" 라는 요구에 답하는 설계입니다. DAU 5 전제에서 과하게 많은 보안/캐시 계층을 덜어내고, **배포·운영·디버깅 단순성**을 최우선으로 둡니다.

### E.1. 설계 철학 — "한 요청 한 경로"

```
사용자 ─── HTTPS ───▶ Lambda Function URL ───▶ Supabase
                              │                       
                              │ presigned URL
                              ▼
                             S3 (1 버킷, 파일만)

시크릿: SSM Parameter Store (Lambda 기동 시 주입)
```

부품 수: **4개**
- **Lambda** (정적 SPA + API 서빙 + SSE 스트리밍)
- **S3** (1개 버킷, 사용자 업로드 파일만)
- **SSM Parameter Store** (시크릿)
- **Supabase** (DB, 기존 유지)

### E.2. 제거된 요소와 그 이유

| 제거 대상 | 원래 역할 | 제거해도 되는 이유 |
|-----------|-----------|---------------------|
| **CloudFront** | CDN, OAC, DDoS Shield, WAF 연결점 | DAU 5면 캐시 필요 없음. Function URL 자체가 TLS 1.2+ 기본 제공. DDoS는 Reserved Concurrency=10으로 비용 상한 방어. |
| **S3 web 버킷** | 정적 SPA + q-images 서빙 | Lambda가 `dist/`와 `q-images/`를 컨테이너 이미지에 포함해 직접 서빙. 19MB + 1.1MB 정적 자산은 Lambda 메모리에서 충분히 처리 가능. |
| **KMS CMK** | SSM SecureString 감사 가능한 암호화 | AWS 관리 키로도 SSM SecureString은 암호화됨. CloudTrail이 기본 감사 이력 제공. **월 $1 절감**. |
| **EventBridge warming** | Cold start 완화 | 최초 요청만 2~4초 느림. DAU 5면 로딩 스피너로 UX 커버 가능. |
| **2번째 S3 버킷** | 파일 전용 분리 | 단일 버킷에 `memos/`, `uploads/pool/`, `public/` prefix로 충분 (또는 public은 Lambda가 서빙하니 필요 없음). |
| **AWS Budgets/Anomaly** | 비용 이상 감지 | Reserved Concurrency로 비용 상한 기계적 차단. 필요 시 나중에 추가. |
| **OAC/CloudFront 연동 정책** | 복잡한 리소스 정책 | Function URL을 직접 공개(`AuthType=NONE`) + Reserved Concurrency로 비용 보호. |

### E.3. 최종 아키텍처 (다이어그램)

```
┌──────────────────────────────────────────────┐
│ 브라우저 / Capacitor 앱                        │
└──────┬───────────────────────────┬───────────┘
       │ ① HTTPS 모든 요청          │ ② 파일 업/다운만
       ▼                           ▼
┌────────────────────────────┐   ┌──────────────────────┐
│ Lambda (Container Image)    │   │ S3: aitutor-files    │
│  - 2048MB, timeout 300s     │   │  Block Public Access │
│  - Function URL:            │   │  CORS: 업로드 허용   │
│    AuthType=NONE            │◀──│  Lifecycle: pool 30d │
│    InvokeMode=RESPONSE_STREAM│ ③ presigned           │
│  - Reserved Concurrency=10  │   └──────────────────────┘
│                              │
│  라우팅:                     │
│  ├─ GET /           → index.html (메모리 서빙)
│  ├─ GET /assets/*   → dist/assets (immutable cache)
│  ├─ GET /q-images/* → 컨테이너 내 이미지 (immutable)
│  ├─ POST /api/upload-sign → presigned URL 발급
│  ├─ POST /api/memo-files?action=confirm
│  ├─ POST /api/gemini|openai|claude (SSE)
│  └─ ...기타 /api/*
│                              │
│  시크릿 주입: SSM Parameter Store (부팅 시)
│                              │
│  외부 호출: Supabase, LLM 3사, Resend
└──────────────────────────────┘
```

### E.4. 잃는 것 vs 얻는 것

| 항목 | 부록 D | 부록 E | 영향도 (DAU 5) |
|------|--------|--------|----------------|
| 부품 수 | 9개 | **4개** | 🟢 운영 단순성 大 향상 |
| CDN 캐시 | ✅ | ❌ | 🟡 q-images 매 요청 Lambda 통과 (3GB/월 전송 → 무료) |
| OAC 보안 경계 | ✅ | ❌ | 🟡 Function URL 공개. Reserved Concurrency로 비용 상한만 방어 |
| KMS CMK 감사 | ✅ | ❌ | 🟢 CloudTrail이 기본 이력 제공 |
| Cold start 완화 | ✅ (5분 warming) | ❌ | 🟡 초기 요청 2~4초 |
| WAF 연결점 | ✅ (추가 가능) | ❌ | 🟢 DAU 5면 공격 표적 아님 |
| HSTS 헤더 | CloudFront 자동 | Lambda에서 명시 | 🟢 코드 1줄로 대체 |
| 월 비용 | $1.07 | **$0.10** | 🟢 KMS $1 + 도메인 관련 제거 |
| 배포 단계 수 | 21단계 | **10단계** | 🟢 절반 이하로 축소 |
| 디버깅 난이도 | 중 (여러 경로) | 낮음 (Lambda 로그만) | 🟢 CloudWatch 한 곳 |

### E.5. 보안 전략 변화

10중 → **5중**으로 단순화하되 핵심 방어는 유지:

| # | 레이어 | 상태 |
|---|--------|------|
| 1 | **TLS 1.2+ 전송 암호화** | Function URL 기본 | 유지 |
| 2 | **앱 레벨 JWT + HttpOnly 쿠키** | 기존 | 유지 |
| 3 | **앱 레벨 Rate Limit** (login DB 기반) | 기존 | 유지 |
| 4 | **Reserved Concurrency=10** | 비용 DoS 차단 | 유지 |
| 5 | **SSM SecureString** (AWS 관리 키) | 시크릿 평문 노출 방지 | 유지 |
| 6 | ~~CloudFront OAC~~ | 제거 | Function URL 공개로 대체 |
| 7 | ~~KMS CMK~~ | 제거 | AWS 관리 키로 대체 |
| 8 | ~~WAF Managed Rules~~ | 제거 | DAU 5에 과잉 |
| 9 | ~~DDoS Shield Advanced~~ | 제거 | Reserved Concurrency로 대체 |
| 10 | ~~감사 이벤트 집계~~ | 제거 | CloudTrail 기본 |

**수용 가능 판단 근거**: DAU 5는 공격 표적이 아님. 서비스 공개 URL이 짧은 무작위 해시(`*.lambda-url.ap-northeast-2.on.aws`)라 존재 자체가 덜 노출. 성장 시 CloudFront/WAF를 **앞단에 끼워넣기만 하면** 되는 업그레이드 경로 보존(E.10).

### E.6. 코드 변경 (부록 D와 차이점만)

#### E.6.1. `server.js` — 정적 서빙 경로 추가

부록 D의 `server.js`는 **이미 `dist/` 정적 서빙과 SPA 폴백을 포함**하므로 그대로 사용 가능. q-images도 Vite 빌드 시 `dist/q-images/`로 복사되므로 자연스럽게 같은 static 미들웨어가 서빙.

보안 헤더만 `server.js`에 직접 추가(CloudFront 대체):

```js
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

#### E.6.2. `Dockerfile` — q-images 포함

```dockerfile
FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 핵심: dist에 q-images까지 포함 (Vite 빌드가 public/ → dist/ 복사)
COPY server.js lambda.js ./
COPY api ./api
COPY dist ./dist

CMD [ "lambda.handler" ]
```

Vite는 `public/` 하위를 빌드 시 `dist/` 루트로 복사하므로 `public/q-images/` → `dist/q-images/`가 자동. 따로 COPY 추가 불필요.

#### E.6.3. `api/upload-sign.js` — 부록 D와 동일

변경 없음. `api/memo-files.js`, `api/pool-upload.js`도 부록 D와 동일.

#### E.6.4. `api/cors.js` — Function URL 도메인만 허용

```js
const ALLOWED_ORIGINS = [
  /^https:\/\/[a-z0-9-]+\.lambda-url\.ap-northeast-2\.on\.aws$/,
  'https://aitutor-six.vercel.app',   // 롤백용
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3002',
];
```

### E.7. 비용 재산정 (DAU 5)

| 항목 | 사용량 | 비용 |
|------|--------|------|
| Lambda (2GB, 5K 요청) | ~5K 요청, 5K GB-sec | **$0** (무료 티어) |
| Lambda 정적 서빙 트래픽 | ~3GB/월 | **$0** (100GB 무료) |
| Function URL | — | **$0** |
| S3 (파일만, ~1GB) | 500 PUT + 2K GET | **$0.03** |
| SSM Standard (7개) | ~100 호출/월 | **$0** |
| CloudWatch Logs | ~100MB | **$0** |
| ECR (이미지 1개, ~500MB) | 저장 | **$0.05** |
| **합계** | | **💰 $0.08/월** |

AI API 비용 별도 ($1 내외/월).

**부록 D 대비**: $1.07 → $0.08, **$1/월 절감** (KMS CMK 제거가 대부분)

### E.8. AWS CLI 실행 체크리스트 (10단계)

```bash
# ────────────────────────────────────────────
# 사전 준비
# ────────────────────────────────────────────
export AWS_REGION=ap-northeast-2
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 선결 과제: 2team-cli IAM 사용자에게 아래 정책 연결 (관리자/루트 계정에서)
# - AWSLambda_FullAccess, AmazonS3FullAccess, AmazonEC2ContainerRegistryFullAccess
# - IAMFullAccess, AmazonSSMFullAccess, CloudWatchLogsFullAccess

# ────────────────────────────────────────────
# 1. Vercel env 추출 + SSM 업로드
# ────────────────────────────────────────────
cd /Users/2team/aifac/workspace/aitutor
npx vercel env pull .env.production --environment=production --yes

for K in DATABASE_URL AUTH_TOKEN_SECRET GEMINI_API_KEY OPENAI_API_KEY \
         ANTHROPIC_API_KEY RESEND_API_KEY LAW_API_OC; do
  V=$(grep "^${K}=" .env.production | cut -d= -f2-)
  [ -n "$V" ] && aws ssm put-parameter \
    --name "/aitutor/${K}" --type SecureString --value "$V" --overwrite
done

rm -f .env.production

# ────────────────────────────────────────────
# 2. S3 파일 버킷 (1개)
# ────────────────────────────────────────────
BUCKET="aitutor-files-${AWS_ACCOUNT_ID}"
aws s3api create-bucket --bucket $BUCKET --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION
aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket $BUCKET \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# CORS (브라우저 직접 업로드)
cat > /tmp/cors.json <<'JSON'
{ "CORSRules":[{
  "AllowedHeaders":["*"], "AllowedMethods":["PUT","POST","GET","HEAD"],
  "AllowedOrigins":["*"], "ExposeHeaders":["ETag"],
  "MaxAgeSeconds":300
}]}
JSON
aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration file:///tmp/cors.json

# Lifecycle (pool 업로드 30일 자동 삭제)
cat > /tmp/lifecycle.json <<'JSON'
{ "Rules":[
  {"ID":"ExpirePool","Status":"Enabled","Filter":{"Prefix":"uploads/pool/"},
   "Expiration":{"Days":30}},
  {"ID":"AbortMultipart","Status":"Enabled","Filter":{"Prefix":""},
   "AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}
]}
JSON
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET --lifecycle-configuration file:///tmp/lifecycle.json

# ────────────────────────────────────────────
# 3. Lambda IAM 역할 (최소 권한)
# ────────────────────────────────────────────
cat > /tmp/trust.json <<'JSON'
{ "Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}
]}
JSON
aws iam create-role --role-name AitutorLambdaRole \
  --assume-role-policy-document file:///tmp/trust.json
aws iam attach-role-policy --role-name AitutorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

cat > /tmp/lambda-policy.json <<JSON
{ "Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParameters","ssm:GetParametersByPath"],
   "Resource":"arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/aitutor/*"},
  {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],
   "Resource":"arn:aws:s3:::${BUCKET}/*"},
  {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::${BUCKET}"}
]}
JSON
aws iam put-role-policy --role-name AitutorLambdaRole \
  --policy-name AitutorLeastPrivilege --policy-document file:///tmp/lambda-policy.json

LAMBDA_ROLE_ARN=$(aws iam get-role --role-name AitutorLambdaRole --query 'Role.Arn' --output text)

# ────────────────────────────────────────────
# 4. ECR + Lambda Container Image 빌드/푸시
# ────────────────────────────────────────────
aws ecr create-repository --repository-name aitutor \
  --image-scanning-configuration scanOnPush=true

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/aitutor"
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_URI

npm install @codegenie/serverless-express @aws-sdk/client-ssm \
  @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner
npm run build:fe   # dist/에 q-images까지 포함됨

docker buildx build --platform linux/amd64 \
  -t "${ECR_URI}:latest" --push .

# ────────────────────────────────────────────
# 5. Lambda 함수 생성
# ────────────────────────────────────────────
aws lambda create-function \
  --function-name aitutor \
  --package-type Image \
  --code ImageUri="${ECR_URI}:latest" \
  --role "$LAMBDA_ROLE_ARN" \
  --timeout 300 \
  --memory-size 2048 \
  --environment "Variables={NODE_ENV=production,S3_FILES_BUCKET=${BUCKET}}"

# 비용 DoS 상한
aws lambda put-function-concurrency \
  --function-name aitutor --reserved-concurrent-executions 10

# ────────────────────────────────────────────
# 6. Function URL (공개, Response Streaming)
# ────────────────────────────────────────────
aws lambda create-function-url-config \
  --function-name aitutor \
  --auth-type NONE \
  --invoke-mode RESPONSE_STREAM \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"AllowCredentials":true,"MaxAge":300}'

aws lambda add-permission \
  --function-name aitutor \
  --statement-id PublicInvoke \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE

FN_URL=$(aws lambda get-function-url-config --function-name aitutor \
  --query 'FunctionUrl' --output text)
echo "🌐 Service URL: $FN_URL"

# ────────────────────────────────────────────
# 7. S3 CORS에 실제 Function URL 도메인 반영 (선택, 더 엄격한 CORS)
# ────────────────────────────────────────────
FN_DOMAIN=$(echo "$FN_URL" | sed 's|https://||; s|/||')
cat > /tmp/cors.json <<JSON
{ "CORSRules":[{
  "AllowedHeaders":["*"], "AllowedMethods":["PUT","POST","GET","HEAD"],
  "AllowedOrigins":["https://${FN_DOMAIN}"], "ExposeHeaders":["ETag"],
  "MaxAgeSeconds":300
}]}
JSON
aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration file:///tmp/cors.json

# ────────────────────────────────────────────
# 8. api/cors.js에 Function URL 도메인 반영 후 재배포
# ────────────────────────────────────────────
# (소스 수정 후)
docker buildx build --platform linux/amd64 -t "${ECR_URI}:latest" --push .
aws lambda update-function-code --function-name aitutor --image-uri "${ECR_URI}:latest"

# ────────────────────────────────────────────
# 9. DB 마이그레이션 (Supabase SQL Editor)
# ────────────────────────────────────────────
# ALTER TABLE memo_files ADD COLUMN s3_key VARCHAR(512);
# ALTER TABLE memo_files ALTER COLUMN data DROP NOT NULL;

# ────────────────────────────────────────────
# 10. 검증
# ────────────────────────────────────────────
curl -I "$FN_URL"                            # 200 + HSTS 등 헤더
curl "$FN_URL/api/categories"                # API 응답
curl -I "$FN_URL/q-images/q001.png"          # 200, image/png
open "$FN_URL"                               # 브라우저 테스트
```

### E.9. 재배포 (이후 운영)

```bash
# 프론트 변경이 있을 때만 빌드
npm run build:fe

# 이미지 재빌드 + 푸시
docker buildx build --platform linux/amd64 -t "${ECR_URI}:latest" --push .

# Lambda 업데이트
aws lambda update-function-code --function-name aitutor --image-uri "${ECR_URI}:latest"
```

단 1단계(Lambda 업데이트)만 남아 부록 D의 "이미지 재빌드 + Lambda 업데이트 + S3 sync + CloudFront invalidate" 4단계 대비 훨씬 간단.

### E.10. 성장 시 업그레이드 경로 (단계적 추가)

이 설계의 장점은 **필요해질 때 각 요소를 하나씩 추가할 수 있다**는 점입니다.

| 성장 단계 | 추가 요소 | 소요 시간 | 월 추가 비용 |
|-----------|-----------|-----------|--------------|
| DAU 20+ 고정 사용자 | CloudFront 앞단 추가 (캐시로 Lambda 부담 경감) | 30분 | $0 (무료 티어) |
| 첫 공격 징후 | AWS WAF Managed Rules | 20분 | $5 + $0.60/1M |
| 감사 요구 발생 | KMS CMK 교체 + SSM 재암호화 | 15분 | $1 |
| 응답 속도 민원 | EventBridge 5분 warming | 10분 | $0 |
| 정규 운영 단계 진입 | AWS Budgets + Anomaly Detection | 5분 | $0 |

즉 **부록 E로 시작 → 필요 시 부록 D의 요소를 하나씩 도입**하는 경로가 가장 낭비 없습니다.

### E.11. 부록 C/D/E 비교 요약

| 항목 | C (경량+보안) | D (LLM/이미지 특화) | E (극단 단순화) 🔥 |
|------|---------------|---------------------|-------------------|
| 부품 수 | 7개 | 9개 | **4개** |
| 월 비용 | $1.05 | $1.07 | **$0.08** |
| 배포 단계 | 13단계 | 21단계 | **10단계** |
| 보안 레이어 | 10중 | 10중 | **5중** (핵심만) |
| pool-upload 20MB | ❌ | ✅ | **✅** |
| 이미지 저장 | DB | S3 | **S3** |
| CDN 캐시 | CloudFront | CloudFront | ❌ (Lambda 직접) |
| Cold start | 2~4초 | 완화 (warming) | 2~4초 수용 |
| 확장성 | 中 | 高 | **中 (단계적 추가 가능)** |
| 디버깅 난이도 | 中 (여러 경로) | 中 (여러 경로) | **낮음** (로그 1곳) |
| DAU 5 적합도 | 과함 | 과함 | **적절** ✅ |

### E.12. 최종 권장안 — **부록 E 채택 기준**

다음 조건 **모두** 만족 시 부록 E를 선택하세요.

- ✅ DAU 5~10명 내 유지 예상
- ✅ 운영자가 1명이고 단순한 아키텍처를 선호함
- ✅ 비용을 극단적으로 낮추고 싶음 (월 $1 미만)
- ✅ Cold start 2~4초가 용인 가능 (로딩 스피너로 커버)
- ✅ 공격 표적이 될 가능성이 낮은 사용자군 (지인 테스트, 폐쇄 그룹)

하나라도 부정되면 **부록 D** 또는 **부록 C**가 더 적합합니다. 또한 부록 E로 시작해도 언제든 E.10의 업그레이드 경로로 보강 가능하므로 **리스크 없이 단순함부터 시작**하는 것이 합리적입니다.
