# REBUILD14: AI TutorTwo — 프로젝트 종합 아키텍처 · 업그레이드 연대기 · 전체 기능 참조

> 작성일: 2026-04-24
> 대상: `workspace/aitutor`
> 목적: 초기 Vercel 배포부터 현재 AWS + KISA 학습 플랫폼까지의 **전 여정 + 현재 상태 + 제공 기능**을 한 문서에 정리
> Public URL: **https://d2dcsdi9b1j2rf.cloudfront.net**
> 운영 기준: PWA 설치 가능 / 148 문항 / 69 학습 챕터 / AI 3종 연동

---

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [업그레이드 연대기 (REBUILD10 ~ 13)](#2-업그레이드-연대기)
3. [현재 아키텍처](#3-현재-아키텍처)
4. [인프라 구성 (AWS)](#4-인프라-구성-aws)
5. [데이터베이스 구조 (Supabase)](#5-데이터베이스-구조-supabase)
6. [API 엔드포인트 전체 목록](#6-api-엔드포인트-전체-목록)
7. [프론트엔드 구조 및 라우팅](#7-프론트엔드-구조-및-라우팅)
8. [사용자 제공 기능 총정리](#8-사용자-제공-기능-총정리)
9. [인증 및 보안](#9-인증-및-보안)
10. [배포 파이프라인](#10-배포-파이프라인)
11. [모니터링 및 운영](#11-모니터링-및-운영)
12. [기술 부채 및 향후 로드맵](#12-기술-부채-및-향후-로드맵)
13. [비용 최적화 로드맵 — ALB 대체 전환](#13-비용-최적화-로드맵--alb-대체-전환)
14. [부록: 주요 용어 해설](#14-부록-주요-용어-해설)

---

## 1. 프로젝트 개요

### 1-1. 정체성
**AI TutorTwo**는 두 종류의 자격증 시험 대비를 한 앱에서 제공하는 학습 플랫폼이다.

| 대상 시험 | 형태 | 문항 수 | 비고 |
|---------|------|-------|------|
| 영상정보관리사 | 기출 MCQ 중심 | 1,489문항 | 원래의 주력 콘텐츠 |
| **KISA SW 보안약점 진단원 이수시험** | MCQ + 4단계 진단 서술형 | **148문항** + 69 학습 챕터 | REBUILD13에서 이식 |

### 1-2. 핵심 가치 제안
- 📱 **언제 어디서나**: 웹, PWA 설치, iOS/Android 네이티브(Capacitor)
- 🎯 **시험 유형 1:1 매칭**: MCQ는 OMR 이론시험 / diagnosis4는 서술형 실기시험
- 🤖 **AI 해설 3종**: Gemini, Claude, OpenAI를 사용자가 선택
- 💾 **해설 저장 재사용**: 같은 질문 + 같은 provider는 즉시 캐시 반환 (LLM 비용 절약)
- 🔁 **SM-2 스페이스드 리피티션**: 틀린 문항은 1·3·7·15·30일 간격 자동 재출제
- 🔐 **이메일 인증 가입 + HMAC-SHA256 JWT 세션**

### 1-3. 현재 숫자 현황
```
총 DB 문항            1,637건 (영상정보관리사 1,489 + KISA 148)
KISA 학습 챕터         69개 (설계 20 + 구현 49, 100% 커버)
KISA 카테고리          8개 (입력검증/보안기능/시간상태/에러처리/코드오류/캡슐화/API오용/세션통제)
정답 해설 사전 작성    108건 (MCQ 96 + diagnosis4 model_answer 파생 12)
LLM provider          3종 (Gemini 2.5 Flash, Claude Haiku 4.5, OpenAI gpt-4o-mini)
설치 가능한 플랫폼     5종 (Web / PWA Chrome Android / PWA Safari iOS / PWA Desktop / Capacitor 네이티브)
```

---

## 2. 업그레이드 연대기

### 2-1. 연대표 한눈에 보기

```
┌────────────────────────────────────────────────────────────────────────┐
│ 2026-04   ● REBUILD10   Vercel → GCP Cloud Run 마이그레이션 설계 (설계만) │
│           ● REBUILD11   AWS 마이그레이션 실행 (실제 이전)                │
│           ● REBUILD12   이메일 인증 복구 + 자동 로그인                    │
│           ● REBUILD13   KISA 드릴 모듈 이식 + 후속 확장 ★                │
│           ● REBUILD14   (현재) 종합 문서 작성 + 튜토리얼 기능            │
└────────────────────────────────────────────────────────────────────────┘
```

### 2-2. 각 REBUILD 요약

#### REBUILD10 — 마이그레이션 설계 (GCP 시나리오)
- 원본: Vercel `aitutor-six.vercel.app`
- 목표(당시): GCP Cloud Run (`aifactory` 프로젝트, `asia-northeast3`)
- 결과: **실제 이전은 AWS로 변경**됨 (REBUILD11 참조)

#### REBUILD11 — AWS 마이그레이션 실행
- Lambda Container Image (`aitutor`, 2GB/300s)
- CloudFront → ALB → Lambda 3층 경로 (Organization SCP 대응)
- Supabase PostgreSQL 유지 (이관 리스크 제거)
- S3 presigned URL 업로드 (Lambda 6MB 응답 한도 우회)
- SSM Parameter Store SecureString (시크릿 관리)
- **월 비용**: ~$16.35 (ALB 고정비 위주)

#### REBUILD12 — 이메일 인증 복구 + 자동 로그인
- **Part A**: `/api/send-verification` 500 에러 해결
  - 원인: Resend 샌드박스(`onboarding@resend.dev`)는 본인 이메일만 발송 가능
  - 해결: `newsstand.blog` 도메인 구매 + DKIM/SPF/MX/DMARC DNS 설정
- **Part B**: 회원가입 시 자동 로그인
  - `api/signup.js`에 JWT 발급 + HttpOnly 쿠키 Set-Cookie
  - `LoginPage.jsx` `handleSignup` 자동 로그인 처리
  - Lambda 콜드스타트 404/5xx 재시도 로직 추가

#### REBUILD13 — KISA 드릴 모듈 이식
- **초기**: 76 문항 + 5 테이블 + 7 API + 11 UI 컴포넌트
- **후속**: 148 문항 + 7 테이블 + 11 API + 13 UI 컴포넌트 + 69 학습 챕터
- 드릴 / SRS / 실전 모의고사 / LLM 보조 채점 / 통계 / **정답 해설 + LLM 해설 저장 재사용**
- **PWA 설치** (Service Worker 없이)
- **단계 탭 분리** (Design vs Implementation)

### 2-3. 핵심 학습 (모든 REBUILD 공통)

| 교훈 | 출처 | 내용 |
|-----|------|------|
| 제약이 가장 간단한 솔루션을 낳는다 | 12 | Resend 도메인 한 줄 변경으로 이메일 인증 복구 |
| 네임스페이스 격리가 롤백 비용을 결정한다 | 13 | `kisa_*` 접두어 + `api/kisa-*` + `src/tabs/KisaTab/` |
| Service Worker 없는 PWA도 가능하다 | 13 | Chrome 87+부터 manifest만으로 설치 가능 |
| 설계 문서가 이식 가능성을 좌우한다 | 13 | `kisa-module/` 패키지가 체계적이었기에 5시간에 이식 |

---

## 3. 현재 아키텍처

### 3-1. 전체 시스템 다이어그램

```
                       ┌──────────────────────────────────┐
                       │  사용자 (Web / PWA / Native App)   │
                       └────────────┬─────────────────────┘
                                    │ HTTPS
                       ┌────────────▼─────────────────────┐
                       │  CloudFront (E2MP4BK1D16LJN)      │
                       │  TLS + /api/* + /* 통합 라우팅      │
                       └────────────┬─────────────────────┘
                                    │
                       ┌────────────▼─────────────────────┐
                       │  AWS Lambda (aitutor)             │
                       │  Container Image / Node.js 22     │
                       │  Express + serverless-express     │
                       │  2GB RAM / 300s timeout           │
                       └────────────┬─────────────────────┘
                                    │
          ┌──────────────────┬──────┴──────┬───────────────────┐
          │                  │             │                   │
┌─────────▼──────┐ ┌─────────▼────┐ ┌──────▼─────────┐ ┌──────▼────────┐
│ Supabase Postgres│ │ SSM Parameter│ │ ECR Image Repo │ │ LLM APIs       │
│ (aitutor + kisa) │ │ Store (7 keys)│ │ aitutor:latest │ │ Gemini / OpenAI│
│ SSL required     │ │ SecureString │ │                │ │ Claude         │
└──────────────────┘ └──────────────┘ └────────────────┘ └────────────────┘
```

### 3-2. 요청 처리 흐름 (예시: 문제 풀이 제출)

```
1. 사용자가 "제출" 버튼 클릭
2. Browser → POST https://d2dcsdi9b1j2rf.cloudfront.net/api/kisa-attempt
3. CloudFront → Lambda (ALB 경유)
4. Lambda가 withAuth 미들웨어로 JWT 검증
5. Supabase에서 kisa_questions 조회
6. scorer.js 결정론 채점
7. kisa_diagnosis_attempts INSERT
8. SM-2 self_grade 반영 → kisa_review_queue UPSERT
9. 응답 JSON (점수 + 모범답안 + 해설 + SRS 갱신)
10. Browser → ResultOverlay 렌더링
11. (선택) AI 추가 해설 버튼 클릭 → 별도 SSE 요청
```

---

## 4. 인프라 구성 (AWS)

### 4-1. 리전 및 서비스 매핑

| 서비스 | 이름 | 리전 | 역할 |
|-------|-----|------|------|
| CloudFront | `E2MP4BK1D16LJN` | Global | CDN + TLS + SPA 라우팅 |
| Lambda | `aitutor` | ap-northeast-2 (Seoul) | Express 앱 실행 |
| ECR | `aitutor` | ap-northeast-2 | 컨테이너 이미지 저장소 |
| CodeBuild | `aitutor-build` | ap-northeast-2 | Docker 빌드 + ECR push |
| S3 (빌드 소스) | `aitutor-codebuild-src-794531974010` | ap-northeast-2 | CodeBuild 소스 zip |
| S3 (파일 업로드) | Lambda presigned | ap-northeast-2 | 사용자 업로드 파일 |
| SSM Parameter Store | `/aitutor/*` | ap-northeast-2 | 시크릿 7종 |
| CloudWatch Logs | `/aws/lambda/aitutor` | ap-northeast-2 | 실행 로그 |

### 4-2. 시크릿 인벤토리 (SSM)

| 파라미터 이름 | 용도 |
|-------------|------|
| `/aitutor/DATABASE_URL` | Supabase PostgreSQL 연결 문자열 |
| `/aitutor/AUTH_TOKEN_SECRET` | HMAC-SHA256 JWT 서명 시크릿 |
| `/aitutor/GEMINI_API_KEY` | Google Generative Language API |
| `/aitutor/OPENAI_API_KEY` | OpenAI API |
| `/aitutor/ANTHROPIC_API_KEY` | Anthropic (Claude) API |
| `/aitutor/RESEND_API_KEY` | 이메일 발송 (인증코드) |
| `/aitutor/LAW_API_OC` | 국가법령정보 API OC 키 |

Lambda 콜드스타트 시 `loadSecrets()`가 `/aitutor/` 경로 전체를 일괄 조회해 `process.env`로 주입.

### 4-3. 비용 구조 (월 ~$20 추정)

| 항목 | 월 비용 | 비고 |
|------|--------|------|
| ALB | $16.35 | 고정비 (REBUILD11 구조상 필수) |
| Lambda 실행 | ~$0.50 | 콜드 + 웜 스타트 포함 소량 |
| CloudFront | ~$0.20 | 무료 티어 1TB/월 |
| ECR 저장 | ~$0.10 | 이미지 1개 유지 |
| SSM | $0.00 | 4,000건/월 무료 |
| CloudWatch | ~$0.30 | 로그 5GB 내 |
| S3 | ~$0.05 | 소스 zip + 업로드 소량 |
| **합계** | **~$17.50** | |

Supabase는 무료 플랜 유지 (500MB 한도 내).

---

## 5. 데이터베이스 구조 (Supabase)

### 5-1. 테이블 인벤토리

#### 🟢 영상정보관리사 관련 (12개)
```
users                       회원 계정 (id INTEGER, email, name, is_admin)
organizations               소속 조직
categories                  카테고리 (3개)
exams                       시험 회차 (29개)
subjects                    과목 (3개)
questions                   기출 문항 (1,489개)
question_memos              사용자별 메모
memo_files                  메모 첨부 파일 (base64)
question_bookmarks          즐겨찾기
exam_results                시험 회차별 결과
question_explanations       AI 해설 저장 (영상정보관리사 전용)
email_verifications         이메일 인증코드
login_attempts              로그인 시도 기록 (rate limit)
```

#### 🟣 KISA 드릴 관련 (7개, REBUILD13 신규)
```
kisa_questions                     148 문항 (MCQ 96 + diagnosis4 52)
kisa_chapters                      69 학습 챕터 (정의/원인/영향/대응원칙)
kisa_diagnosis_attempts            사용자별 풀이 이력 + 채점
kisa_review_queue                  SM-2 SRS 큐 (PK: user_id + question_id)
kisa_exam_sessions                 실전 모의고사 세션
kisa_reports                       진단보고서 (v2 예약, 현재 빈 테이블)
kisa_question_llm_explanations     LLM 추가 해설 저장 (provider별)
```

### 5-2. 주요 테이블 상세

#### kisa_questions (가장 중요)
```sql
id                UUID PK
question_type     'mcq' | 'diagnosis4'
stage             'design' | 'implementation'
weakness_category 8종 enum
weakness_code     CWE-89 등 국제 표준 (또는 KISA 내부)
chapter_code      DSG-IV-01 / IMP-SF-04 등 국내 분류 코드
weakness_name_ko  한글 명칭
language          java/python/javascript/kotlin/swift/etc
difficulty        하/중/상
body              문제 본문 (마크다운)
vulnerable_code   취약 코드 (diagnosis4 전용)
choices           JSONB [{num,text}] (mcq 전용)
answer_index      INT (mcq 전용)
vulnerable_lines  INT[] (diagnosis4 전용)
rationale_keywords TEXT[] (채점용)
fix_keywords      TEXT[] (채점용)
safe_code         안전 코드 (diagnosis4 전용)
model_answer      JSONB {verdict, rationale, fix_description}
explanation       TEXT — 기본 해설 (Claude Code 사전 작성)
reference         참조 문서 (KISA 가이드 §N.M.L)
tags              TEXT[]
```

#### kisa_chapters (학습 컨텐츠)
```sql
chapter_code      VARCHAR(32) PK
stage             design|implementation
category          8종 enum
title             챕터 제목
definition        정의 (이 약점이 무엇인가)
cause             원인 (왜 발생하는가)
impact            영향 (공격 성공 시 피해)
countermeasures   JSONB array [원칙1, 원칙2, ...]
reference_docs    TEXT[] (KISA 가이드 참조)
related_chapters  TEXT[] — 설계 → 구현 연관 매핑 (공식 §3-1.4)
```

### 5-3. ER 다이어그램 (KISA 부분)

```
  users (id)
    │ (FK X, user_id 매핑만)
    │
    ├─▶ kisa_diagnosis_attempts (user_id, question_id)
    │           │
    │           ▼
    │       kisa_questions (id) ─────────┐
    │           │                        │
    ├─▶ kisa_review_queue (복합 PK)      │
    │           ▲                        │
    │           │                        │
    ├─▶ kisa_exam_sessions (user_id)     │
    │                                    │
    ├─▶ kisa_reports (v2 예약)           │
    │                                    │
    └─▶ kisa_question_llm_explanations ◀─┘
                (question_id + provider)

  kisa_chapters (chapter_code PK)
      │ related_chapters TEXT[]로 자기참조 N:M
      └─▶ kisa_chapters
```

---

## 6. API 엔드포인트 전체 목록

### 6-1. 공개 / 인증 엔드포인트 (영상정보관리사 기존 + 신규)

| Method | Path | 용도 | 인증 |
|--------|------|------|------|
| POST | `/api/send-verification` | 이메일 인증코드 발송 | ❌ |
| POST | `/api/signup` | 회원가입 + 자동 로그인 | ❌ |
| POST | `/api/login` | 로그인 (이메일 + 인증코드) | ❌ |
| POST | `/api/forgot-password` | 비밀번호 재설정 | ❌ |
| POST | `/api/delete-account` | 회원탈퇴 | ✅ |
| GET  | `/api/auth` | 현재 로그인 사용자 정보 | ✅ |

### 6-2. 영상정보관리사 기능

| Method | Path | 용도 |
|--------|------|------|
| GET/POST/PUT/DELETE | `/api/questions` | 문항 CRUD (admin) |
| GET/POST/PUT/DELETE | `/api/explanations` | AI 해설 CRUD |
| GET/POST | `/api/categories` | 카테고리 |
| GET/POST/PUT/DELETE | `/api/memos` | 사용자 메모 |
| GET/POST/DELETE | `/api/memo-files` | 메모 첨부파일 |
| GET/POST/DELETE | `/api/bookmarks` | 즐겨찾기 |
| GET/POST | `/api/exam-results` | 시험 회차 결과 |
| POST | `/api/gemini` | Gemini 프록시 (SSE) |
| POST | `/api/openai` | OpenAI 프록시 (SSE) |
| POST | `/api/claude` | Claude 프록시 (SSE) |
| POST | `/api/law` | 국가법령정보 조회 |
| GET/POST | `/api/admin` | 관리자 기능 |
| POST | `/api/import-docstore` | docstore 연동 |
| POST | `/api/pool-upload` | pool 업로드 |
| POST | `/api/upload-sign` | S3 presigned URL 발급 |

### 6-3. KISA 드릴 모듈 (REBUILD13)

| Method | Path | 용도 |
|--------|------|------|
| GET/POST/DELETE | `/api/kisa-admin` | 문항 CRUD + seed 임포트 (admin) |
| GET  | `/api/kisa-drill?action=next` | 다음 문항 조회 (필터: type/stage/category/language/difficulty/chapter_code/srs) |
| GET  | `/api/kisa-drill?action=count` | 필터 조건 문항 수 |
| POST | `/api/kisa-attempt` | 답안 제출 + 채점 + SRS 갱신 |
| POST | `/api/kisa-attempt?action=llm-grade` | LLM 보조 채점 |
| POST | `/api/kisa-attempt?action=llm-explain` | LLM 해설 스트리밍 (SSE, 저장/재사용) |
| GET  | `/api/kisa-attempt?action=list-explanations` | 저장된 LLM 해설 목록 |
| POST | `/api/kisa-attempt?action=delete-explanation` | 저장된 해설 삭제 |
| GET  | `/api/kisa-review?action=queue` | 오늘 복습 대상 |
| GET  | `/api/kisa-review?action=stats` | 통계 (카테고리별 정답률 / 주간 학습량 / 복습 예정) |
| POST | `/api/kisa-review?action=suspend` | 특정 문항 복습 일시중단 |
| POST | `/api/kisa-exam?action=start` | 모의고사 세션 시작 |
| GET  | `/api/kisa-exam?action=session&id=` | 진행 중 세션 조회 |
| POST | `/api/kisa-exam?action=autosave` | 30초 자동저장 |
| POST | `/api/kisa-exam?action=submit` | 세션 제출 + 최종 채점 |
| GET  | `/api/kisa-exam?action=result` | 제출 완료 세션 결과 |
| GET  | `/api/kisa-study?action=list` | 69 챕터 목록 |
| GET  | `/api/kisa-study?action=detail&code=` | 챕터 상세 + 연관 매핑 + 코드 예시 |

### 6-4. 공통 미들웨어 (`api/middleware.js`)

```javascript
withCors(handler)   // CORS + OPTIONS + 공통 에러 500
withAuth(handler)   // + JWT 검증 (401 on fail) + req.user 주입
withAdmin(handler)  // + admin 플래그 확인 (403 on fail)
```

---

## 7. 프론트엔드 구조 및 라우팅

### 7-1. 폴더 구조
```
src/
├── main.jsx                 React Router 진입점
├── App.jsx                  최상위 Context + Layout + Routes
├── index.html               vite-plugin-pwa 자동 주입 manifest
│
├── pages/                   SPA 페이지
│   ├── LoginPage.jsx           로그인/회원가입 (단일 화면, 모드 전환)
│   ├── LearnHub.jsx            학습 허브
│   ├── CardStudy.jsx           카드형 문제 풀이
│   ├── RandomQuiz.jsx          무작위 퀴즈
│   ├── BookmarkStudy.jsx       즐겨찾기 학습
│   └── ExamMode.jsx            영상정보관리사 모의고사
│
├── tabs/                    탭별 기능 묶음
│   ├── QuizTab/                (기존) 문제 풀이
│   ├── ManageTab/              (admin) 문항 관리
│   ├── ImportTab/              (admin) 문항 임포트
│   ├── SettingsTab/            LLM 설정 / 테마
│   └── KisaTab/                (REBUILD13) KISA 드릴
│       ├── index.jsx              /kisa/* 서브 라우터
│       ├── Dashboard.jsx          대시보드 (단계 탭)
│       ├── Study.jsx              학습 목록
│       ├── StudyDetail.jsx        학습 상세 (연관 매핑)
│       ├── DrillSession.jsx       드릴 세션
│       ├── McqCard.jsx            객관식 카드
│       ├── DiagnosisCard.jsx      4단계 진단 카드
│       ├── ResultOverlay.jsx      채점 결과 + 해설 + LLM
│       ├── KisaExamMode.jsx       실전 모의고사
│       └── Stats.jsx              통계 (recharts)
│
├── components/
│   ├── Header.jsx
│   ├── BottomNav.jsx             5탭 (학습/KISA/관리/연동/설정)
│   ├── CodeBlock.jsx             prismjs + 라인 번호 + 클릭
│   ├── ErrorBoundary.jsx
│   ├── OfflineBanner.jsx
│   └── ui/                       공통 UI
│       ├── Button.jsx, Card.jsx, Modal.jsx
│       ├── Toast.jsx (ToastProvider)
│       ├── ImageModal.jsx, LoadingOverlay.jsx
│       ├── MultiSelect.jsx, Skeleton.jsx
│
├── hooks/
│   ├── useTheme.js               다크모드
│   ├── useSSE.js                 SSE 스트리밍
│   ├── useNetwork.js             온라인/오프라인 감지
│   ├── useFilterState.js         필터 URL 동기화
│   └── useKisaSrs.js             KISA SRS 훅
│
├── lib/
│   ├── api.js                    apiGet/apiPost + 쿠키 인증
│   ├── kisaScorer.js             클라이언트 미리보기 채점
│   └── mdToHtml.js               마크다운 렌더링
│
├── constants/
│   ├── llm.js                    LLM provider 설정
│   └── models.js                 모델 카탈로그
│
└── contexts/                    Context (AuthContext 등)
```

### 7-2. 라우트 맵

```
/                          → /quiz 리다이렉트
/login                     LoginPage (미인증 시 자동 표시)

/quiz                      LearnHub (기존 학습)
/quiz/category             QuizTab
/quiz/random               RandomQuiz
/quiz/card                 CardStudy
/quiz/bookmark             BookmarkStudy
/quiz/exam                 ExamMode

/manage                    ManageTab (admin)
/import                    ImportTab (admin)
/settings                  SettingsTab

/kisa                      KisaTab 서브라우터
  /kisa                    Dashboard
  /kisa/drill              DrillSession (쿼리: stage/category/type/chapter_code/srs)
  /kisa/exam               KisaExamMode
  /kisa/study              Study
  /kisa/study/:chapterCode StudyDetail
  /kisa/stats              Stats

* (기타)                   → /quiz 리다이렉트
```

### 7-3. 전역 Context

| Context | 제공 값 | 위치 |
|--------|--------|------|
| ToastProvider | `useToast()` | App.jsx 최상위 |
| ImageModalContext | `useImageModal()` | App.jsx 최상위 |
| CategoryContext | `useGlobalCategory()` | App.jsx (로그인 시) |

---

## 8. 사용자 제공 기능 총정리

### 8-1. 인증 및 계정
- 이메일 인증 기반 회원가입 (Resend → `newsstand.blog` 도메인)
- 회원가입 즉시 자동 로그인 (HttpOnly 쿠키 JWT)
- 로그인 (이메일 + 인증코드 한번에 6자리 OTP)
- 비밀번호 재설정
- 회원 탈퇴

### 8-2. 영상정보관리사 기존 학습
- 📚 학습 허브: 카테고리별 탐색
- 🔀 무작위 퀴즈: 셔플된 문제 풀이
- 📇 카드 스터디: 플래시카드 방식
- 🔖 즐겨찾기 학습
- ⏱️ 시험 모드 (회차별 타이머)
- 📝 메모 기능 (첨부파일 포함)
- 🤖 AI 해설 생성 (Gemini/OpenAI/Claude)
- 👤 관리자 기능 (문항 CRUD, 임포트, docstore 연동)

### 8-3. KISA 드릴 모듈 (핵심 신규)

#### 🎯 Dashboard (`/kisa`)
- 주간 학습량 / 평균 점수 / 오늘 복습 요약
- 4개 시작 버튼: 학습 자료 / 드릴 / 실전 모의 / 통계
- **📐 설계단계 / 🔧 구현단계 탭 분리**
- 탭별 카테고리 정답률 bar
- 카테고리 바로 시작 버튼 (stage 자동 포함)

#### 📖 학습 자료 (`/kisa/study`)
- 설계 20 + 구현 49 = 69 챕터 목록
- 챕터 상세: 정의 / 원인 / 영향 / 대응 원칙 / 취약 vs 안전 코드 비교
- **연관 챕터 배지** (설계 → 구현 / 구현 → 설계 양방향 클릭 이동)
- 참조 KISA 가이드 문서 표시

#### 🎯 드릴 (`/kisa/drill`)
- 쿼리 파라미터 기반: type / stage / category / language / difficulty / chapter_code / srs
- 문항별 진행률 "N/M" 표시 (실제 문항 수 API 조회 기반)
- 완주 시 🎉 완료 화면
- 학습 자료로 돌아가기 버튼

#### 📝 MCQ 카드 (이론)
- 4~5지 선택지 라디오
- 제출 후 정답/오답 즉시 표시

#### 🔍 diagnosis4 카드 (실기)
- 취약 코드 + 4단계 입력 폼
- 코드 라인 클릭 → `cited_lines` 자동 입력
- 서술/코드 탭 전환 가능한 수정방안 입력
- 필수 키워드 힌트 (실제 키워드는 숨김)

#### 📋 ResultOverlay (채점 결과, 핵심 UX)
- 자가채점 + LLM 점수 + 종합 점수 배너
- ✅/❌ 정답 여부
- **📖 정답 해설 (파란 박스)** — Claude Code 사전 작성
  - MCQ: 정답 번호 + 핵심 근거 + 각 선택지 해설 + 참조
  - diagnosis4: 판정 / 취약 근거 / 수정 방안 / 취약 라인 (폴백)
- **🤖 AI 추가 해설 (저장 재사용)**
  - Gemini / Claude / OpenAI 3종 버튼
  - 저장된 해설 있으면 ✓ 뱃지 + 즉시 표시 (LLM 호출 X)
  - 저장 없으면 SSE 스트리밍 생성 + 자동 저장
  - 🔄 같은 AI로 새로 생성 / 🗑️ 저장된 해설 삭제
- 모범답안 / 안전한 코드 / DIFF 토글
- SM-2 자가평가 4버튼 (다시/어려움/괜찮음/쉬움)

#### ⏱️ 실전 모의고사 (`/kisa/exam`)
- 3가지 모드: 이론 60분(MCQ 30) / 실기 100분(diagnosis 15) / 전체 180분
- 상단 고정 타이머 (10분 미만 빨간색 경고)
- 문항 네비 패널 (답안 상태별 색상)
- 30초 자동저장 + localStorage draft 백업
- 제출 후 성적표 (이론/실기/종합 + 합격선 70점 판정)

#### 📊 통계 대시보드 (`/kisa/stats`)
- 3개 차트 (recharts):
  - 7대 분류 평균 점수 (BarChart)
  - 최근 7일 학습량 (LineChart)
  - 향후 7일 복습 예정 (BarChart)
- 요약: 총 응시 / 고유 문항 / 평균 / 오늘 복습

### 8-4. 공통 기능

| 기능 | 동작 |
|------|------|
| 🌓 다크모드 | 시스템 설정 자동 감지 + 수동 토글 |
| 📱 PWA 설치 | iOS Safari / Android Chrome / Desktop Chrome |
| 📶 오프라인 배너 | `useNetwork`로 offline 감지 (단, SW 없어 실제 오프라인 동작 X) |
| ⏰ Lambda 콜드스타트 복구 | 404/5xx/네트워크 오류 자동 재시도 1회 |
| 🗃️ 이미지 모달 | 이미지 클릭 시 확대 |

---

## 9. 인증 및 보안

### 9-1. 인증 흐름
```
사용자 이메일 입력 → /api/send-verification (6자리 인증코드 메일)
사용자 인증코드 입력 → /api/login or /api/signup
서버: HMAC-SHA256 JWT 발급 (페이로드: sub, email, uid, name, admin)
서버: Set-Cookie: token=<JWT>; HttpOnly; Secure; SameSite=Lax; Max-Age=7d
이후 모든 /api/* 요청에 쿠키 자동 전송
withAuth 미들웨어: jwt.verify → req.user 주입
```

### 9-2. 보안 원칙 적용 상태

| 원칙 | 적용 |
|------|------|
| HTTPS 강제 | ✅ CloudFront + HSTS |
| HttpOnly 쿠키 | ✅ JS 접근 차단 |
| Secure 쿠키 | ✅ HTTPS 전용 |
| SameSite=Lax | ✅ CSRF 완화 |
| 비밀번호 저장 | ✅ scrypt 해시 (기존 SHA-256 레거시 호환) |
| SQL 삽입 | ✅ PreparedStatement 모든 쿼리 |
| 시크릿 관리 | ✅ SSM Parameter Store (코드 하드코딩 0) |
| Rate Limit | ✅ 로그인(`login_attempts`) + LLM 채점(50회/일) |
| 에러 메시지 | ✅ 일반화 ("서버 오류가 발생했습니다") |
| 로그 민감정보 | ✅ 자격증명 미기록 |

---

## 10. 배포 파이프라인

### 10-1. 자동화된 배포 스텝 (매번 동일)

```bash
# 1) 프론트엔드 빌드 + SW 제거 (vite-plugin-pwa 부산물)
cd workspace/aitutor && npm run build:fe

# 2) 소스 zip (제외: node_modules/.git/ios/android/tests/docs/kisa-module/kisa-pool)
zip -r /tmp/aitutor-src.zip . -x "..."

# 3) S3 업로드 (CodeBuild 소스)
aws s3 cp /tmp/aitutor-src.zip \
  s3://aitutor-codebuild-src-794531974010/aitutor-src.zip \
  --region ap-northeast-2

# 4) CodeBuild 트리거 (Docker 빌드 + ECR push, ~80초)
aws codebuild start-build --project-name aitutor-build --region ap-northeast-2

# 5) ECR 최신 digest 조회 → Lambda 이미지 교체
DIGEST=$(aws ecr describe-images --repository-name aitutor ...)
aws lambda update-function-code --function-name aitutor \
  --image-uri "794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor@${DIGEST}" \
  --region ap-northeast-2

aws lambda wait function-updated --function-name aitutor --region ap-northeast-2

# 6) CloudFront 캐시 무효화
aws cloudfront create-invalidation --distribution-id E2MP4BK1D16LJN --paths "/*"
```

### 10-2. 롤백 전략 (3단계)

| Level | 작업 | 데이터 영향 | 소요 |
|-------|------|----------|------|
| 1 | BottomNav에서 KISA 탭 주석 | ❌ 없음 | 5초 |
| 2 | `git revert` + 재배포 | ❌ 없음 | 5분 |
| 3 | `001_kisa_module_rollback.sql` 실행 | ⚠️ KISA 데이터 삭제 | 10분 |

기존 영상정보관리사 12개 테이블은 **어느 레벨에서도 영향 없음**.

---

## 11. 모니터링 및 운영

### 11-1. CloudWatch 로그 패턴
```bash
# 최근 에러
aws logs tail /aws/lambda/aitutor --since 1h --region ap-northeast-2 \
  --filter-pattern "ERROR"

# LLM 호출 모니터링
aws logs tail /aws/lambda/aitutor --since 1h --region ap-northeast-2 \
  --filter-pattern "[Kisa"

# Resend 이메일 발송
aws logs tail /aws/lambda/aitutor --since 1h --region ap-northeast-2 \
  --filter-pattern "[Verify]"
```

### 11-2. 정기 점검 체크리스트

#### 주간
- [ ] LLM API 사용량 (Gemini / OpenAI / Claude) 요금 확인
- [ ] `kisa_diagnosis_attempts` 일간 insert 수 (학습 활성도)
- [ ] Lambda 콜드스타트 빈도

#### 월간
- [ ] Supabase 용량 (500MB 한도)
- [ ] Resend 도메인 결제 상태 (`newsstand.blog`)
- [ ] 이수시험 문항 확장 필요 여부

#### 분기
- [ ] KISA 가이드 버전 업데이트 확인
- [ ] 콘텐츠 주제(OWASP Top 10 등) 싱크

---

## 12. 기술 부채 및 향후 로드맵

### 12-1. v2 이연 항목

1. **진단보고서 DOCX 기능** (REBUILD13 STEP 11 생략)
   - `kisa_reports` 테이블 이미 존재
   - `docx` npm 패키지 설치 완료
   - `api/kisa-report.js` + `src/tabs/KisaTab/ReportBuilder.jsx` 구현만 필요
   - 예상 시간: 3시간

2. **Playwright E2E 테스트** (`tests/kisa/*`)
   - 회귀 안전성 확보
   - 드릴 / 모의고사 / 학습 플로우

3. **diagnosis4 해설 100% 커버**
   - 현재 52개 중 11개만 explanation 컬럼에 있음
   - 나머지는 `model_answer` 폴백 (UX는 동일)

4. **Capacitor 네이티브 앱 스토어 등록**
   - `capacitor.config.json` 이미 준비
   - `cap:build` 스크립트 존재
   - App Store / Play Store 심사 필요

### 12-2. 성능 최적화 후보

- Stats chunk 381KB (recharts) → 경량 SVG 차트 직접 구현
- Lambda Provisioned Concurrency 1개 도입 ($5/월) → 콜드스타트 제거
- DB connection pool 확대 (max=2 → max=4)

### 12-3. 콘텐츠 확장

- diagnosis4 언어 변종 추가 (각 챕터당 Java/Python/JS 3종)
- 이수시험 기출 실제 반영 (공개되면 정기 반영)
- 관련 법규 기출 (개인정보보호법 등)

---

## 13. 비용 최적화 로드맵 — ALB 대체 전환

> **상태**: 📝 **계획 수립 완료 / 실행은 차후로 연기 (2026-04-24 BELL 결정)**
> **동기**: 현재 월 $17.30 중 ALB 고정비 $16.35가 93% 차지 — "고정비 제거"로 96% 비용 절감 가능

### 13-1. 현재 비용 구조 분석

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
월 운영비 $17.30 구성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALB (고정비)         $16.35  ■■■■■■■■■■■■■■■■■ 93%
CloudWatch Logs      $ 0.30  ■ 2%
CloudFront           $ 0.20  ■ 1%
ECR (누적)           $ 0.39  ■ 2%
S3                   $ 0.05  · 0.3%
Lambda 실행          $ 0.01  · 0.1%
API Gateway          —        (현재 미사용)
SSM                  $ 0.00  · 0%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**현재 경로**: 브라우저 → CloudFront → **ALB** → Lambda
**ALB 채택 이유**: REBUILD11에서 검증 — 이 AWS 계정은 Lambda Function URL 외부 HTTP 접근을 SCP로 차단해 ALB로 우회 구성.

### 13-2. AWS 생태계 내 대체 후보 6종 비교

| 후보 | 월 비용 | 고정비 | 구현 난이도 | 장점 | 제약 |
|------|--------|-------|-----------|------|------|
| **🏆 API Gateway HTTP API (V2)** | **$0** | ❌ 없음 | 🟢 낮음 | 무료 티어 1M 요청/월, Lambda 직결 | 타임아웃 29초, 페이로드 10MB |
| API Gateway REST API (V1) | $0 | ❌ 없음 | 🟢 낮음 | 캐싱·API Key 기능 | HTTP API보다 3.5배 비쌈 |
| Lambda Function URL 직접 | $0 | ❌ 없음 | 🟢 매우 낮음 | 완전 무료, 최소 구조 | ⚠️ 이 계정 SCP로 차단됨 |
| Function URL + CloudFront OAC | $0 | ❌ 없음 | 🟡 중간 | SigV4 서명 보안 | ⚠️ REBUILD11 차단 확인 |
| AWS App Runner | $25~ | ✅ 있음 | 🟡 중간 | 상시 가동, 콜드 스타트 X | 오히려 더 비쌈 |
| ECS Fargate | $30~ | ✅ 있음 | 🔴 높음 | 완전 제어 | 비용·관리 부담 |

### 13-3. 추천 방안: API Gateway HTTP API (V2)

**선정 근거** (4가지):
1. **비용 0원**: 무료 티어 100만 요청/월 (현재 24,840회/월 → 2.5% 사용)
2. **구조 유사**: Lambda 그대로 유지, `@codegenie/serverless-express` 호환 (코드 변경 거의 0)
3. **SCP 우회 불필요**: AWS 표준 경로라 계정 정책과 충돌 없음
4. **CloudFront 호환**: Origin만 ALB → API Gateway로 교체

### 13-4. 전환 후 예상 월 비용

| 항목 | 현재 | 전환 후 | 차이 |
|------|------|--------|-----|
| ALB | $16.35 | ❌ **삭제** | −$16.35 |
| API Gateway HTTP | — | $0.00 (무료) | +$0 |
| Lambda | $0.01 | $0.01 | 0 |
| CloudFront | $0.20 | $0.20 | 0 |
| CloudWatch | $0.30 | $0.30 | 0 |
| S3 | $0.05 | $0.05 | 0 |
| ECR | $0.39 | $0.10 (Lifecycle 적용 시) | −$0.29 |
| SSM | $0.00 | $0.00 | 0 |
| **합계** | **$17.30** | **$0.66** | **−$16.64 (96%)** |

**연간 절감액**: $199.68

### 13-5. 전환 작업 플로우 (Phase A~D, 예상 1~2h)

#### Phase A: 사전 검증 (10분)
```bash
# 현재 ALB 타깃 그룹 / 리스너 규칙 백업
aws elbv2 describe-load-balancers --region ap-northeast-2 > /tmp/alb-backup.json
aws elbv2 describe-target-groups --region ap-northeast-2 >> /tmp/alb-backup.json
aws elbv2 describe-listeners --region ap-northeast-2 >> /tmp/alb-backup.json

# API Gateway 계정 쿼터 확인
aws service-quotas get-service-quota \
  --service-code apigateway --quota-code L-1A1C4D1A \
  --region ap-northeast-2
```

#### Phase B: API Gateway HTTP API 생성 (20분)
```bash
# 1. HTTP API 생성 + Lambda 프록시 통합
aws apigatewayv2 create-api \
  --name aitutor-api \
  --protocol-type HTTP \
  --target 'arn:aws:lambda:ap-northeast-2:794531974010:function:aitutor' \
  --region ap-northeast-2

# 2. Lambda에 API Gateway 호출 권한 부여
aws lambda add-permission \
  --function-name aitutor \
  --statement-id apigateway-http-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn 'arn:aws:execute-api:ap-northeast-2:794531974010:***/*/*' \
  --region ap-northeast-2

# 3. 테스트 URL로 직접 호출 확인
curl https://<api-id>.execute-api.ap-northeast-2.amazonaws.com/api/questions
```

#### Phase C: CloudFront Origin 전환 (15분, 무다운타임)
```bash
# CloudFront Distribution E2MP4BK1D16LJN 의 Origin 교체
# - 이전: <alb-domain>
# - 신규: <api-id>.execute-api.ap-northeast-2.amazonaws.com

aws cloudfront get-distribution-config --id E2MP4BK1D16LJN > /tmp/cf-config.json
# Origins.Items[0].DomainName 수정
# OriginProtocolPolicy를 https-only 로 확인
aws cloudfront update-distribution --id E2MP4BK1D16LJN \
  --distribution-config file:///tmp/cf-config-updated.json \
  --if-match <ETag>

# 전파 완료까지 5~15분 대기
aws cloudfront wait distribution-deployed --id E2MP4BK1D16LJN
```

#### Phase D: ALB 삭제 (10분, 24시간 검증 후)
```bash
# 24시간 병행 운영으로 문제 없는지 확인 후
aws elbv2 delete-listener --listener-arn <listener-arn> --region ap-northeast-2
aws elbv2 delete-target-group --target-group-arn <tg-arn> --region ap-northeast-2
aws elbv2 delete-load-balancer --load-balancer-arn <alb-arn> --region ap-northeast-2
```

### 13-6. 전환 시 주요 리스크 5가지

#### ① 타임아웃 29초 제약 ⚡
- API Gateway HTTP API 최대 응답: **29초 하드 한도**
- 현재 Lambda 타임아웃 300초 → **271초 감소**
- **실제 영향 체크**:
  - ✅ LLM 스트리밍 (SSE): 전체 10~20초 → 안전
  - ✅ LLM 보조 채점 (REST): 최대 20초 → 여유
  - ⚠️ DOCX 생성 (v2 이연 기능): 복잡 보고서는 위험. 비동기 처리(S3 presigned + 별도 워커) 필요
- **대응 원칙**: 29초 초과 우려 엔드포인트는 SSE로 분할 또는 비동기 패턴

#### ② Payload 크기 10MB 📦
- API Gateway HTTP 한도: **10MB** (요청·응답 각각)
- 현재 Lambda 페이로드 6MB 한도와 유사 → 추가 제약 없음

#### ③ 동시 연결 및 Throttling 🔄
- 기본 계정 Throttle: **10,000 RPS, 5,000 burst**
- 계정 단위 한도라 다른 API Gateway와 공유 시 조정 필요
- 개인 학습 앱 수준(수십 RPS)에서는 걱정 없음

#### ④ CORS 처리 경로 변경 🌐
- 현재 Lambda Express `api/cors.js` 미들웨어가 처리 → **그대로 작동**
- API Gateway 자체 CORS 설정은 **비활성화** (Lambda 처리 존중)
- 이중 CORS로 헤더 중복 시 preflight 실패 가능성 → 꼭 한 곳에서만

#### ⑤ 커스텀 도메인 무영향 🌍
- 사용자 URL `d2dcsdi9b1j2rf.cloudfront.net` 그대로 유지
- CloudFront Distribution 설정만 내부 변경
- 최종 사용자에게 URL 변경 전달 불필요

### 13-7. 전환 검증 체크리스트

Phase C 완료 후 반드시 확인:

```bash
# 1. CloudFront에 서빙 중인 index.html 번들 여전히 동일
curl -s https://d2dcsdi9b1j2rf.cloudfront.net/ | grep -oE "index-[a-zA-Z0-9]+\.js"

# 2. 주요 API 엔드포인트 응답 (401은 정상 — 인증 필요)
for p in /api/questions /api/kisa-drill /api/auth; do
  printf "%-25s " "$p"
  curl -s -o /dev/null -w "HTTP:%{http_code}\n" "https://d2dcsdi9b1j2rf.cloudfront.net${p}"
done

# 3. 로그인 흐름 수동 검증
# - 이메일 인증코드 발송
# - 코드 입력 → 로그인 성공
# - KISA 드릴 한 문항 제출 → 정답 해설 표시

# 4. AI 해설 스트리밍 (장시간 응답)
# - 풀이 후 [Gemini] 버튼 → 끝까지 스트리밍 완료하는지 확인 (29초 내)

# 5. CloudWatch 로그 접근성
aws logs tail /aws/lambda/aitutor --since 5m --region ap-northeast-2
```

### 13-8. 롤백 계획

Phase D(ALB 삭제) 전이면 **Origin만 ALB로 되돌리는 1분 작업**으로 완전 원복 가능.

Phase D 실행 후 문제 발생 시:
- 새 ALB 재생성 + 타깃 그룹 연결 → 약 15분
- DNS/Origin 복원 + CloudFront 전파 5~15분
- 총 약 30분 다운타임 가능

→ **24시간 병행 운영 권장** (Phase D를 1일 뒤에)

### 13-9. 실행 판단 기준

다음 중 하나에 해당하면 전환 실행 권장:
- [ ] 월 운영비 $15 이상 부담된다고 판단될 때
- [ ] 트래픽이 월 50만 요청 이상으로 증가 (Lambda 실행비도 동반 검토 필요)
- [ ] Lambda 함수 구조를 리팩토링하는 타이밍 (작업 범위 통합)
- [ ] 팀 멤버가 변경되어 새 인프라로 재학습 기회

---

> **13 섹션 요약**: ALB $16/월을 **API Gateway HTTP API $0/월**로 대체 시 **연 $200 절감**. 코드 변경 거의 없고, 24시간 병행 운영으로 안전 전환 가능. 실행 시점은 BELL 판단.

---

## 14. 부록: 주요 용어 해설

| 용어 | 의미 |
|------|------|
| **MCQ** | Multiple Choice Question (객관식) |
| **diagnosis4** | KISA 실기 서술형 4단계 진단 (취약여부/라인/근거/수정) |
| **SRS** | Spaced Repetition System (SM-2 경량판) |
| **chapter_code** | DSG-IV-01 형식의 KISA 내부 챕터 번호 (DSG=설계, IMP=구현) |
| **CWE** | Common Weakness Enumeration (국제 표준 약점 번호) |
| **SSE** | Server-Sent Events (LLM 스트리밍 프로토콜) |
| **KDF** | Key Derivation Function (bcrypt/scrypt/Argon2) |
| **XXE** | XML External Entity 공격 |
| **IDOR** | Insecure Direct Object Reference |
| **TOCTOU** | Time-of-Check to Time-of-Use (경쟁조건) |
| **PWA** | Progressive Web App |
| **KISA** | 한국인터넷진흥원 (Korea Internet & Security Agency) |

---

> **REBUILD14 작성 완료.** 이 문서는 향후 누가 프로젝트를 이어받든 "지금까지 무엇을 어떻게 했고, 지금 어떻게 돌아가며, 무엇을 제공하는가"를 한 번에 파악할 수 있는 단일 참조점이다. 프로젝트 구조가 크게 변경될 때 `REBUILD15.md`로 이어 작성 권장.