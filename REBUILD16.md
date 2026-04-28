# REBUILD16 — Vercel→AWS 마이그레이션 후 코드베이스 정리 및 모듈 확장 가이드

작성일: 2026-04-25
범위: workspace/aitutor 전체

---

## 0. 요약 (TL;DR)

이 문서는 Vercel→AWS Lambda 컨테이너 이미지 환경으로 마이그레이션을 완료한 시점에서, 다음 3가지를 정리한다.

1. **현재 코드베이스 상태 진단** — 무엇이 살아 있고, 무엇이 잔존 흔적이며, 어디가 비효율인지
2. **모듈 확장(예: KISA 같은 새 자격증·과목 추가)을 위한 리팩토링 가이드** — 현재 KISA가 처음으로 추가된 모듈인데, 두 번째·세 번째 모듈을 더 빠르게 붙이려면 무엇을 표준화해야 하는지
3. **확장 가능한 신규 서비스 제안** — 학습 효과 향상, 운영 효율, 수익 모델 측면에서

배포는 AWS CodeBuild → ECR → Lambda(컨테이너) → CloudFront(d2dcsdi9b1j2rf.cloudfront.net) → ALB(aitutor-alb) 흐름이며, Vercel 자원은 모두 제거됨.

---

## 1. 현재 아키텍처 한눈에 보기

```
[CloudFront]  d2dcsdi9b1j2rf.cloudfront.net
     ↓
[ALB]  aitutor-alb-1012653397.ap-northeast-2.elb.amazonaws.com
     ↓
[Lambda 컨테이너]  ECR aitutor:latest
     ├─ lambda.js        ← serverless-express 어댑터
     ├─ server.js        ← Express 라우팅 (api/*.js mount)
     ├─ api/*.js         ← 도메인별 핸들러
     ├─ dist/            ← Vite 빌드 산출물 (정적 자산)
     └─ kisa-module/     ← 신규 모듈(데이터+SQL)
          ↓
[Cloud SQL/Supabase Postgres]  aws-1-us-east-2.pooler.supabase.com
[SSM Parameter Store]  /aitutor/* (DATABASE_URL, *_API_KEY 등)
[S3]  aitutor-files-794531974010 (업로드 파일)
[S3]  aitutor-codebuild-src-794531974010 (CodeBuild 소스 zip)
```

### 1.1 도메인별 모듈

| 모듈 | 위치 | 상태 |
|---|---|---|
| 영상정보관리사 기출 (`questions` 등) | `src/pages/CardStudy/ExamMode/RandomQuiz`, `api/{questions,categories,memos,bookmarks,explanations,exam-results}.js` | ✅ 운영 중 (1,489 문항) |
| KISA 진단원 이수시험 | `src/tabs/KisaTab/`, `api/kisa-*.js`, `kisa-module/` | ✅ 운영 중 (378 문항: MCQ 168 + blank 138 + diagnosis4 52, 추가 진행 중) |
| 관리자 도구 | `src/tabs/{ManageTab, ImportTab, SettingsTab}` | ✅ 운영 중 |
| 인증 | `api/{login,signup,send-verification,forgot-password,delete-account,auth}.js` | ✅ 운영 중 (회원가입 일시 차단 상태) |
| 모바일 (Capacitor) | `capacitor.config.json` + `cap:*` 스크립트 | ⚠ 셸만 있음 — 실배포 흔적 없음 |

### 1.2 의존성 현황 (package.json)

dependencies 21 / devDependencies 12. AWS 마이그레이션 후에도 정리되지 않은 항목 일부 존재 — §3.2 참고.

---

## 2. Vercel→AWS 마이그레이션 후 잔존 흔적

### 2.1 ✅ 이미 제거됨

- `vercel.json` → `vercel.json.bak` 으로 백업 (2026-04-24)
- `.vercel/` 디렉토리 삭제
- Vercel Vercel CLI 의존 제거 (npm 의존성 없음)

### 2.2 ⚠ 정리 필요 (낮은 우선순위 / 문서 위주)

#### A. `api/*.js` 파일의 "Vercel 서버리스 함수" 주석

10개 파일에 `// Vercel 서버리스 함수 - ...` 주석이 남아있다. 동작에 영향은 없지만 신규 개발자가 혼동할 수 있다.

대상:
```
api/categories.js, api/claude.js, api/explanations.js, api/law.js,
api/gemini.js, api/questions.js, api/forgot-password.js, api/signup.js,
api/exam-results.js, api/memos.js
```
※ 이미 `api/signup.js` 는 일괄 정리 시 표기 수정됨.

권고: 일괄 치환 1회 수행
```
"Vercel 서버리스 함수" → "AWS Lambda Express 핸들러"
```

#### B. `vercel.json.bak` 보관 정책

배포 자원 아니므로 git에서 제거하거나 `infra/legacy/vercel.json.bak` 같은 곳으로 이전 권고. `gitignore` 화도 한 옵션.

#### C. `dist/sw.js`, `workbox-*.js`, `registerSW.js` 빌드 후 삭제 단계

`build:fe` 스크립트가 `vite build && rm -f dist/sw.js dist/workbox-*.js dist/registerSW.js` 로 PWA Service Worker 산출물을 삭제하고 있다. 이는 Vercel 시절 PWA 가 의도치 않게 활성화되던 문제의 잔재로 보인다. Lambda+CloudFront 조합에서는 SW 비활성이 의도라면 `vite-plugin-pwa` 자체를 devDependencies 에서 제거하거나 vite.config.js 에서 비활성화하면 빌드 단순화가 가능하다.

### 2.3 🔴 환경/시크릿 관리 패턴 (마이그레이션 후 확정 필요)

- `lambda.js` 가 SSM `/aitutor/*` 를 콜드 스타트마다 모두 로드해 `process.env` 에 주입함 (good)
- 하지만 환경별(dev/prod) 분리가 없음 — 향후 스테이징 환경 도입 시 `/aitutor-prod/*`, `/aitutor-staging/*` 분리 권고
- `signup.js`, `send-verification.js`, `LoginPage.jsx` 의 `SIGNUP_DISABLED` 같은 운영 플래그가 코드 상수에 박혀 있음 → SSM 으로 이관해 무재배포 토글 가능하게 하면 좋음 (§3.4 참고)

---

## 3. 코드베이스 정리 권고

### 3.1 🚨 DB 차원 — 다른 프로젝트 잔존 테이블 39개

현재 `public` 스키마에 aitutor 와 무관한 테이블 다수가 잔존하고 있다. 이는 Supabase 인스턴스를 다른 프로젝트와 공유한 흔적으로 추정된다.

| 카테고리 | 테이블 (개수) | 비고 |
|---|---|---|
| `hairtag_*` | 3개 (hairtag_users, hairtag_looks, hairtag_presets) | 헤어태그 서비스 — aitutor 무관 |
| `lottoda_*` | 8개 (lottoda_users, lottoda_winning_numbers 등) | 로또 서비스 — aitutor 무관 |
| DocStore (RAG) | ~12개 (documents, document_chunks, knowledge_triples, entities, cross_references, rag_traces, chunking_patterns, chat_sessions, deidentify_words, ocr_engine_config 등) | 별도 docstore 프로젝트 |
| Crawl | 4개 (crawl_keywords, crawl_results, crawl_sources, crawl_exclusions) | DocStore 부속 |
| 기타 | api_key_status, api_usage, app_settings, communities, organizations, prompt_templates, rag_traces, rate_limits, tags | 일부는 aitutor 가 사용 중인지 검증 필요 |

⚠ **하나의 Supabase 인스턴스를 여러 프로젝트가 공유하는 구조는 aitutor 의 GDPR/저작권/감사 측면에서 위험**:
- 다른 서비스의 사용자 정보(hairtag_users, lottoda_users) 가 같은 DB 에 있음
- 백업·롤백 시 영향 범위가 불명확
- DB 비용 부담이 모든 서비스에 분산됨

권고:
1. **단기**: aitutor 가 어떤 테이블을 실제 사용하는지 코드 grep + log 분석으로 화이트리스트 작성
2. **중기**: aitutor 전용 Supabase 프로젝트 분리 → `pg_dump` 후 신규 인스턴스로 이관
3. **장기**: docstore/lottoda/hairtag 도 각자 독립 인스턴스 보유

### 3.2 의존성 정리 (package.json)

| 패키지 | 사용 여부 추정 | 권고 |
|---|---|---|
| `@aws-sdk/client-s3`, `s3-presigned-post`, `s3-request-presigner` | ✅ pool-upload, upload-sign 등 | 유지 |
| `@aws-sdk/client-ssm` | ✅ lambda.js 시크릿 로드 | 유지 |
| `@codegenie/serverless-express` | ✅ Lambda 어댑터 | 유지 |
| `@google/generative-ai` | ✅ gemini.js | 유지 |
| `openai` | ✅ openai.js | 유지 |
| `@anthropic-ai/sdk` | ❌ **누락** — claude.js 가 fetch 직접 호출 중일 가능성 | 검증 후 SDK 도입 권고 |
| `@capacitor/*` | ⚠ 모바일 셸만 있고 배포 흔적 없음 | 모바일 미사용 확정 시 제거 |
| `pdf-parse` | ⚠ 어디서 쓰는지 확인 필요 (DocStore 잔재일 가능성) | grep 후 미사용이면 제거 |
| `dompurify` | ⚠ 출력 sanitize 전반 사용 검증 | 유지 가능성 큼 |
| `prismjs` | ✅ KisaTab CodeBlock | 유지 |
| `recharts` | ✅ Stats.jsx | 유지 |
| `docx` | ⚠ FEATURE_SPEC §5.3 진단보고서 DOCX 생성 — 미구현 시 제거 | 우선순위 낮음 |
| `vite-plugin-pwa` | ⚠ 빌드 후 sw.js 삭제 중 — 모순 | 제거 권고 |

### 3.3 미사용/사용처 불명 코드 (코드 검증 필요)

다음은 grep 또는 동적 import 누락 가능성이 있는 항목으로, 한 번씩 사용처 검증 권고:

- `src/contexts/` 디렉토리 — **0 파일** (App.jsx 가 createContext 를 직접 사용 중) → 디렉토리 삭제 가능
- `api/import-docstore.js` — DocStore 프로젝트 import 도구. aitutor 와 도메인이 다름 → 분리 권고
- `api/admin.js` 와 `api/auth.js` 의 중복: `api/middleware.js` 에 `withAuth/withAdmin` 이 있는데 별도 admin.js 가 있는 이유 확인 필요
- `kisa-module/explanations/*.json` 5개 파일 — seed 임포트 후 더 이상 참조되지 않으면 archive 디렉토리로 이전

### 3.4 운영 플래그 SSM 이관 패턴

현재 `SIGNUP_DISABLED` 같은 플래그가 3개 파일에 동일 값으로 박혀 있어 토글 시 3번 수정+재배포가 필요하다.

권고 패턴:
```js
// api/_runtime/flags.js (신규)
const FLAG_PREFIX = 'flag.';
const cache = {};
function flag(key, defaultValue = false) {
  if (key in cache) return cache[key];
  const env = process.env[`FLAG_${key.toUpperCase()}`];
  return cache[key] = env === undefined ? defaultValue : env === 'true';
}
module.exports = { flag };

// 사용처
const { flag } = require('./_runtime/flags');
if (flag('signup_disabled')) { ... }
```

SSM 에 `/aitutor/FLAG_SIGNUP_DISABLED=true` 등록 → lambda.js 가 로드 → 무재배포 토글.

---

## 4. 모듈 확장(MultiModule) 리팩토링 가이드

### 4.1 현재 KISA 모듈이 도입한 패턴

KISA 는 다른 모듈을 추가할 때 따를 수 있는 **첫 번째 모범 사례**다. 다음 구조가 정착되어 있다:

```
api/                      DB 핸들러
  kisa-admin.js           CRUD/seed
  kisa-attempt.js         답안 제출 + 채점
  kisa-drill.js           문제 조회
  kisa-exam.js            모의고사 세션
  kisa-review.js          SRS + 통계 + 초기화
  kisa-study.js           학습 자료
  _kisa/
    scorer.js             결정론 채점
    srs.js                SM-2 알고리즘
    llmGrader.js          LLM 보조 채점

src/tabs/KisaTab/         프론트 (React)
  index.jsx               라우팅 허브
  Dashboard.jsx
  Study.jsx, StudyDetail.jsx
  DrillSession.jsx
  McqCard.jsx, BlankCard.jsx, DiagnosisCard.jsx
  ResultOverlay.jsx
  KisaExamMode.jsx
  Stats.jsx

kisa-module/              데이터/문서 (코드 외부)
  chapters/*.json
  explanations/*.json
  migrations/*.sql
  seed/*.json
```

### 4.2 두 번째 모듈을 더 빨리 붙이려면 — 5가지 리팩토링

#### R1. `tracks/` 추상화 도입

현재 KisaTab 은 모듈 코드/UI 가 모두 KISA 라는 이름에 박혀 있다. 신규 모듈을 추가하려면 코드 복제가 불가피하다. 다음과 같은 추상화 권고:

```
src/tabs/TrackTab/
  index.jsx               라우팅 허브
  TrackContext.jsx        현재 활성 트랙(kisa, aws, ...) Context
  Dashboard.jsx
  DrillSession.jsx        question_type 분기로 모든 트랙 공용
  cards/
    McqCard.jsx
    BlankCard.jsx
    DiagnosisCard.jsx     ← 코드 진단 — 트랙별 옵션화
  ResultOverlay.jsx
  ExamMode.jsx
  Stats.jsx

src/tracks/               트랙별 메타·상수
  kisa.js                  { id, name, color, examConfig, sectionMap, ... }
  aws-saa.js               (장래)
  iso27001.js              (장래)
```

API 도 동일 패턴:
```
api/track-{admin,attempt,drill,exam,review,study}.js
  ?track=kisa&action=...   ← 트랙 식별자를 쿼리/패스로
api/_track/
  scorer.js, srs.js, llmGrader.js  (트랙 무관 공용)
```

#### R2. DB 스키마 — `track_id` 컬럼 + 단일 테이블 패턴

현재 `kisa_questions, kisa_attempts, ...` 처럼 prefix 로 분리되어 있어 신규 모듈마다 5+ 개 테이블을 또 만들어야 한다.

권고: 통합 스키마 + `track_id` 디스크리미네이터
```sql
CREATE TABLE track_questions (
  id UUID PRIMARY KEY,
  track_id VARCHAR(20) NOT NULL,    -- 'kisa', 'aws-saa', ...
  question_type VARCHAR(20) NOT NULL,
  weakness_category VARCHAR(40),    -- 트랙별 의미 다름 (해석은 track_meta 참조)
  chapter_code VARCHAR(40),
  body TEXT NOT NULL,
  ...
  PRIMARY KEY (id),
  UNIQUE(track_id, weakness_code)
);
CREATE INDEX idx_track_questions_filter ON track_questions(track_id, question_type, chapter_code, is_active);

-- 마이그레이션: 기존 kisa_questions → track_id='kisa' 로 복사 후 view 로 호환
CREATE VIEW kisa_questions AS SELECT * FROM track_questions WHERE track_id = 'kisa';
```

attempts, review_queue, exam_sessions 도 동일 패턴.

⚠ 마이그레이션 비용이 적지 않으므로 **두 번째 모듈을 추가하는 시점에 한 번** 수행 권고. 그전에는 KISA 단독으로 운영.

#### R3. `question_type` 카드 컴포넌트 레지스트리

현재 DrillSession/ResultOverlay/ExamMode 가 각자 `if mcq / blank / diag` 분기를 한다. 신규 유형 추가 시 3곳 모두 수정해야 한다.

권고 패턴:
```js
// src/components/QuestionTypes/registry.js
import McqCard from './McqCard';
import BlankCard from './BlankCard';
import DiagnosisCard from './DiagnosisCard';

export const QUESTION_TYPES = {
  mcq:        { Card: McqCard,       Result: McqResult,       label: '이론',   icon: '🎯' },
  blank:      { Card: BlankCard,     Result: BlankResult,     label: '단답형', icon: '✍️' },
  diagnosis4: { Card: DiagnosisCard, Result: DiagnosisResult, label: '실기',   icon: '🧪' },
};
// 신규 유형 추가 시 여기 한 곳만 수정
```

DrillSession 사용:
```jsx
const { Card } = QUESTION_TYPES[question.question_type] || {};
return Card ? <Card question={question} onSubmit={handleSubmit} /> : null;
```

#### R4. Seed 자동화 표준 — `scripts/seed/{track}-{type}.js`

KISA 가 도입한 패턴:
- `scripts/generate-blank-seed.js` → `kisa-module/seed/blank-questions.json`
- `scripts/generate-mcq-seed.js` → `kisa-module/seed/mcq-extra-questions.json`

권고 구조:
```
scripts/seed/
  index.js                  공통 헬퍼 (shuffleKeep, buildQuestion 등)
  kisa-mcq.js
  kisa-blank.js
  kisa-diagnosis.js
  aws-saa-mcq.js  (장래)
```

또한 SQL 직접 작성 대신 seed JSON → admin.js `?action=seed` 엔드포인트로 통일 권고 (현재 절반은 직접 psql, 절반은 admin API). admin API 한 통로로 통일하면 권한 관리가 단순해진다.

#### R5. 트랙 메타 + 라우팅

현재 `App.jsx` 가 `/kisa/*` 만 KisaTab 으로 라우팅. 새 트랙 추가 시 동일 패턴 반복.

권고:
```jsx
// src/App.jsx
{TRACKS.map(t => (
  <Route key={t.id} path={`/${t.id}/*`} element={<TrackTab trackId={t.id} />} />
))}
```

`TRACKS` 는 `src/tracks/index.js` 에서 export 하며, 각 트랙은 별도 파일에 메타(이름·로고·색상·시험구성 등)를 정의.

### 4.3 단계적 적용 로드맵

| 단계 | 작업 | 영향 | 예상 공수 |
|---|---|---|---|
| Step 1 | 4.2-R3 카드 레지스트리 패턴 도입 | 코드만 변경, 외부 영향 0 | 1~2시간 |
| Step 2 | 4.2-R4 seed 표준화 | 운영자 도구 일관성 ↑ | 2~3시간 |
| Step 3 | 4.2-R5 트랙 메타/라우팅 추상화 | TrackContext 도입 | 4~6시간 |
| Step 4 | (두 번째 모듈 추가 시점) 4.2-R1 + R2 본격 리팩토링 | DB 마이그레이션 포함 | 1~2일 |

---

## 5. 신규 서비스 확장 제안

### 5.1 학습 효과 향상

#### A. 오답 노트 자동 생성 (이미 부분 구현 — 확장 가치 큼)
- 현재 `kisa_diagnosis_attempts` 에 모든 응시 기록이 남으나 사용자 친화 UI 가 없음
- **"내 오답 모음"** 페이지: 최근 30일간 자가채점 70 미만 문항 모음 + AI 가 작성한 "왜 틀렸는지" 분석 노트
- 응용: PDF 내보내기로 "나의 학습 보고서" 생성 (docx 라이브러리 이미 의존성)

#### B. 시험 전날 D-1 압축 모드
- 사용자가 시험 일정을 입력하면 D-7, D-3, D-1 시점에 맞춤 학습 플랜 자동 생성
- D-1: 자주 틀리는 약점만 모아 60분 mock 시험
- 푸시 알림: AWS SNS + 모바일 PWA 또는 카카오 알림톡 연동

#### C. 그룹 스터디 (협업)
- 직장 동료/스터디원 N명이 같은 트랙에 가입
- 공유 진도 대시보드, 약점 비교, 챕터별 1등 표시
- 동기 부여로 학습 지속률 향상

#### D. AI 면접 시뮬레이션 (KISA 특화)
- KISA 진단원 면접 단계 대비
- LLM 이 면접관 역할로 음성/텍스트 질문 → 사용자 답변 → 평가 + 피드백
- 실기 디버깅 화면 공유 (CodeBlock 재사용)

### 5.2 콘텐츠 다양화

#### E. 사용자 기여 문항 (Crowd-sourced Q&A)
- 학습자가 직접 문항을 만들고 제출 → 관리자 승인 → 공개 풀 추가
- 보상: 기여 포인트로 프리미엄 기능 잠금 해제
- 모더레이션: 기존 admin 도구 활용

#### F. 신규 트랙 추가 (MultiModule 가치 실현)
- AWS SAA / SAP / DOP / SCS — 클라우드 자격증 (한국어 자료 부족 → 차별화)
- ISMS-P / 정보보안기사 / 정보처리기사
- 컴퓨터활용능력 / 토익 등 일반 시험
- 4.2 의 리팩토링 완료 후 트랙 1개 추가 = 약 1주

### 5.3 운영 효율

#### G. 일일 KPI 대시보드 (관리자 전용)
- DAU/WAU/MAU, 트랙별 응시 수, 평균 점수, AI 비용
- Lambda CloudWatch 메트릭 + DB 쿼리 합쳐서 조회
- Slack/Telegram 일일 자동 보고

#### H. AI 비용 최적화
- 현재 LLM 호출이 분산되어 비용 추적 불가
- `kisa_question_llm_explanations` 테이블처럼 모든 LLM 호출에 비용 컬럼 추가
- 일일/월간 비용 알림 + 임계값 초과 시 자동 차단

#### I. CI/CD 자동화
- 현재 배포: 로컬 `npm run build:fe` → zip → S3 → CodeBuild → Lambda update (수동 4단계)
- GitHub Actions OIDC + AWS 통합 → push 만으로 자동 배포
- staging 환경 자동 PR 프리뷰

### 5.4 수익화 (선택)

#### J. 프리미엄 구독
- 무료: 트랙당 일일 10문제 + 광고
- 프리미엄: 무제한 + AI 개인 튜터(LLM 채점) + 오프라인 PWA + 광고 제거
- 결제: Toss Payments 또는 Stripe

#### K. B2B 기업 학습 라이선스
- 회사 단위로 가입 → 직원 진도 추적
- KISA 진단원 같은 자격증은 기업 보안팀 의무 교육이 됨
- 가격대: 직원당 월 1~3만원

---

## 6. 우선순위 제안

### 6.1 단기 (1~2주, 즉시 가치)

1. **§2.2 Vercel 주석 일괄 정리** + `vercel.json.bak`/`vite-plugin-pwa` 정리 — 1~2 시간
2. **§3.1 DB 분리 계획 수립** — 사용 테이블 화이트리스트 작성 → 별도 PR
3. **§4.2-R3 카드 레지스트리** — 신규 유형(객관식 단답형 매칭 등) 추가 부담 감소
4. **§5.1-A 오답노트** — 사용자 가시 가치 큼, 1~2일 작업

### 6.2 중기 (1~2개월, 운영 안정)

1. **§3.2 의존성 정리** — `@anthropic-ai/sdk` 추가, `@capacitor/*` 의사결정
2. **§3.4 SSM 운영 플래그** — SIGNUP_DISABLED 같은 플래그 무재배포 토글
3. **§4.2-R4 seed 표준화** — 두 번째 모듈 도입 전 공구 정비
4. **§5.3-I CI/CD 자동화** — 배포 안정성 + 인적 실수 감소

### 6.3 장기 (분기 단위, 신사업)

1. **§3.1 Supabase 인스턴스 분리** — 프로젝트별 격리
2. **§4.2-R1+R2 트랙 추상화 + DB 통합** — 두 번째 모듈 추가와 동시
3. **§5.2-F 신규 트랙 추가** — AWS SAA 또는 ISMS-P 우선 검토
4. **§5.4 수익화** — 사용자 베이스 확보 후 도입

---

## 7. 참고

- 마이그레이션 직전 상태: `REBUILD15.md` (v2 튜토리얼 기준)
- KISA 모듈 사양: `kisa-module/FEATURE_SPEC.md`
- DB 마이그레이션 이력: `kisa-module/migrations/{001,002}*.sql`
- 배포 인프라: `Dockerfile`, `buildspec.yml`, `lambda.js`
- 운영 URL: https://d2dcsdi9b1j2rf.cloudfront.net

---

## 8. 실제 수행 작업 기록 (Implementation Log)

### 8.1 vite-plugin-pwa 제거 + 정적 manifest 전환 (2026-04-25)

§2.2-C 권고 즉시 실행. PWA 설치 기능은 유지하면서 빌드를 단순화.

#### 변경 파일

1) **`public/manifest.webmanifest` 신규 생성**
   - 기존 vite-plugin-pwa 가 빌드 시 생성하던 동일 내용을 정적 파일로 작성
   - name, short_name, description, lang, start_url, scope, display: 'standalone',
     theme_color, background_color, icons(192/512/maskable/svg)

2) **`src/index.html`**
   - `<link rel="manifest" href="/manifest.webmanifest" />` 직접 추가
   - 주석 갱신: "PWA — Service Worker 미사용. manifest 만으로 설치 지원 (Chrome 87+/iOS Safari)"

3) **`vite.config.js`**
   - `import { VitePWA } from 'vite-plugin-pwa';` 제거
   - `VitePWA({...})` 플러그인 블록 (47줄) 제거
   - 사유 주석 추가 (REBUILD16 §2.2-C 인용)

4) **`package.json`**
   - `devDependencies` 에서 `vite-plugin-pwa` 제거
   - `build:fe` 스크립트 단순화:
     - 기존: `vite build && rm -f dist/sw.js dist/workbox-*.js dist/registerSW.js`
     - 변경: `vite build`
   - `npm uninstall vite-plugin-pwa` 실행으로 lockfile 갱신

#### 검증 결과

| 항목 | 결과 |
|---|---|
| 로컬 빌드 (`npm run build:fe`) | ✅ 1.50s 정상 (sw.js/workbox 산출물 없음) |
| `dist/manifest.webmanifest` | ✅ public 정적 파일 그대로 복사됨 (diff 일치) |
| `dist/index.html` 의 `<link rel="manifest">` | ✅ 정상 주입 |
| 라이브 `https://d2dcsdi9b1j2rf.cloudfront.net/manifest.webmanifest` | ✅ HTTP 200, content-type: application/manifest+json |
| 라이브 index.html 의 manifest 링크 | ✅ 정상 |
| Lambda digest | sha256:fa93a350...85c8 (Successful) |

#### PWA 설치 기능 영향

- **Chrome 87+ (모바일/데스크톱)**: ✅ 설치 가능 — manifest + HTTPS + 아이콘만으로 충족. 자동 install 배너는 SW 없으므로 안 뜰 수 있으나 사용자가 메뉴(...→ 앱 설치)에서 설치 가능. SW 는 이전부터 비활성 상태였으므로 변화 없음.
- **iOS Safari**: ✅ 동일 ("홈 화면에 추가" — SW 무관)
- **Edge / Samsung Internet**: ✅ Chrome 정책 동일

#### 효과

- 빌드 단계 1개 감소 (`rm -f` 제거)
- devDependencies 1개 감소 (`vite-plugin-pwa` 67 패키지 제거)
- vite.config.js 47줄 단순화
- 마이그레이션 직후의 모순(플러그인이 SW 만들고→스크립트가 삭제) 해소

### 8.2 회원가입 일시 차단 + "준비중" 표시 (2026-04-24)

별도 진행. `SIGNUP_DISABLED=true` 코드 상수로 `LoginPage.jsx`/`api/signup.js`/`api/send-verification.js` 3곳에 다층 차단. UI 는 "회원가입 (준비중)" 비활성 버튼으로 표시.
해제: 3개 파일의 `SIGNUP_DISABLED` 를 `false` 로 변경 후 재배포.

### 8.3 학습 통계 초기화 + StudyDetail 단답형 버튼 + 튜토리얼 v4 (2026-04-25)

별도 진행. KISA 트랙에 단답형(blank) 유형 추가에 따른 후속 정합성 작업.

### 8.7 Step 1·3 마무리 — registry 분기 통합 + TrackContext + 라우팅 추상화 (2026-04-25)

§10 의 단계 계획 중 Step 1 (R3 카드 레지스트리) 와 Step 3 (R5 트랙 메타/라우팅 추상화) 의 잔존 부분을 마무리.

#### Step 1 마무리 — registry 에 Result/ExamBody/HeaderExtra/hasAnswer 통합

신규 컴포넌트 (`src/components/QuestionTypes/`):
- `results/McqResult.jsx` — MCQ 정답/오답 피드백 (선택 번호 + 정답 번호)
- `results/BlankResult.jsx` — 빈칸별 채점 카드 + 정답률 배지
- `results/DiagnosisResult.jsx` — 4단계 브레이크다운 + LLM 보조 채점 통합
- `exam/McqExamBody.jsx` — 시험 모드 객관식 본문
- `exam/BlankExamBody.jsx` — 시험 모드 단답형 본문 (BlankTemplate 함수 분리)
- `exam/DiagnosisExamBody.jsx` — 시험 모드 4단계 입력 폼 (ExamPill 분리)

`registry.js` 확장 — 각 question_type 메타 필드:
```
{ Card, Result, HeaderExtra, ExamBody, label, icon, resultLabel,
  showLlmGrade, needsCodeBlockInteraction, hasAnswer }
```

리팩토링 결과:
| 파일 | Before | After | 변화 |
|---|---|---|---|
| `ResultOverlay.jsx` | 593 | 481 | **-112줄, isMcq/isBlank/isDiag 13곳 → 0 (주석만)** |
| `KisaExamMode.jsx` | 545 | 435 | **-110줄, question_type 직접 비교 8곳 → 0** |
| `DrillSession.jsx` | (이전 라운드) | — | self-grade 분기 1곳 잔존 (mcq vs other) |

→ **신규 question_type 추가 시 registry.js 1 파일 + 4 컴포넌트만 추가**하면 Card/Result/Exam 모두 자동 작동.

#### Step 3 마무리 — 트랙 메타 사용처 확장 + Context + 라우팅

A) **트랙 메타 확장** (`src/tracks/kisa.js`)
- `stages.{design|implementation}.categories[]` 추가 (Dashboard 가 사용하는 단계별 카테고리)

B) **Dashboard.jsx**
- `DESIGN_CATEGORIES`, `IMPL_CATEGORIES` 상수 제거
- `kisaTrack.stages[activeStage].categories` 사용
- 단일 진실 공급원 = `src/tracks/kisa.js`

C) **TrackContext** (`src/tracks/TrackContext.jsx`)
- `createContext`, `useTrack()`, `<TrackProvider trackId={id}>` 신설
- 향후 신규 트랙 컴포넌트가 어디서나 `useTrack()` 으로 메타 접근 가능

D) **App.jsx 라우팅 추상화**
```jsx
// Before:
<Route path="/kisa/*" element={<KisaTab />} />

// After:
{TRACK_IDS.map(id => (
  <Route key={id} path={`/${id}/*`} element={
    <TrackProvider trackId={id}>
      <KisaTab />
    </TrackProvider>
  } />
))}
```
신규 트랙 추가 시 `src/tracks/{trackId}.js` + TRACKS 등록만으로 라우트 자동 생성.

E) **StudyDetail.jsx** — 의도적 미변경
- 자체 `CATEGORY_LABEL` 의 키 체계가 chapter.category 와 정확히 매핑되어야 함 (예: "입력데이터 검증 및 표현" 등 더 풀네임)
- 트랙 메타의 `weaknessCategories` 와 라벨 체계가 다름 → 분리 유지가 정합

#### 검증

| 항목 | 결과 |
|---|---|
| ResultOverlay isMcq/isBlank/isDiag 분기 | ✅ **0건** (주석 1개) |
| KisaExamMode question_type 직접 비교 | ✅ **0건** |
| DrillSession registry.Card 사용 | ✅ |
| Dashboard 트랙 메타 사용 | ✅ |
| Stats 트랙 메타 사용 | ✅ (이전 라운드) |
| TrackContext + useTrack | ✅ 도입 완료 |
| App.jsx TRACK_IDS.map 라우팅 | ✅ 도입 완료 |
| 로컬 빌드 | ✅ 1.24s |
| CodeBuild | ✅ SUCCEEDED |
| Lambda update | ✅ sha256:cfbed6a7...9087 (Successful) |
| 라이브 `/`, `/kisa` | ✅ HTTP 200 |
| 라이브 `/api/{claude,openai,gemini,kisa-drill,kisa-review}` | ✅ 401 (정상) |

#### Step 1·3 진행률 갱신

| Step | Before | After |
|---|---|---|
| Step 1 R3 카드 레지스트리 | 🟡 60% | 🟢 **100%** (Card+Result+ExamBody+HeaderExtra+hasAnswer) |
| Step 3 R5 트랙 메타/라우팅 | 🟡 40% | 🟢 **100%** (메타 정의 + Dashboard·Stats 사용 + Context + 라우팅) |
| Step 4 R1+R2 본격 리팩토링 | ⚪ 0% | ⚪ 0% (두 번째 트랙 추가 시점 보류 유지) |

---

### 8.6 MultiModule 확장 구조 — Stage 3 + Stage 6 잔여 cleanup (2026-04-25)

이어서 실행. Stage 4 는 두 번째 트랙 추가 시점에 진행 권고로 보류.

#### Stage 3 — Seed 스크립트 통일 (R4) ✅

- 신규 `scripts/seed/_utils.js` (95줄) — 공통 헬퍼: `shuffleKeep`, `buildExplanation`, `writeSeedJson`, `importViaAdminApi`, `validateWeaknessCode`
- 파일 이전 + 헬퍼 사용:
  - `scripts/blank-explanations.js` → `scripts/seed/kisa-explanations.js`
  - `scripts/generate-blank-seed.js` → `scripts/seed/kisa-blank.js` (자체 path/fs 제거 → `writeSeedJson` 사용)
  - `scripts/generate-mcq-seed.js` → `scripts/seed/kisa-mcq.js` (자체 `shuffleKeep` 제거 → `_utils` 사용)
- 동작 검증: 두 스크립트 재실행 → blank 138 / mcq-extra 92 정상 생성
- 신규 트랙(예: aws-saa) 추가 시: `scripts/seed/aws-saa-{mcq,blank,...}.js` 동일 패턴

#### Stage 6 — 미사용 의존성 제거 ✅

3개 패키지를 사용처 0건 확인 후 제거:
- `pdf-parse` (0 사용처) — DocStore 잔재 의심
- `docx` (0 사용처) — FEATURE_SPEC 진단보고서 미구현
- `diff` (0 사용처) — 향후 ResultOverlay diff 뷰어용 의도였으나 미사용

⚠ 제거 시도했으나 유지한 패키지:
- `@capacitor/network` — `src/hooks/useNetwork.js` 의 동적 import (`import('@capacitor/network')`) 사용 발견 → 즉시 재설치
- `@capacitor/core` — `src/lib/capacitor.js` 사용 중 → 유지
- `dompurify` (1 사용처: QuizCard.jsx) → 유지
- `prismjs` (1 사용처: CodeBlock.jsx) → 유지

#### admin.js vs auth.js 검토

- `api/admin.js` — 관리자 API 핸들러(회원 목록 등)
- `api/auth.js` — JWT/HMAC 인증 유틸 라이브러리
- 역할 다름, 중복 아님. 그대로 유지.

#### 검증

| 항목 | 결과 |
|---|---|
| 의존성 카운트 | 21 → 18 (-3) |
| 로컬 빌드 | ✅ 1.35s 정상 |
| CodeBuild | ✅ SUCCEEDED |
| Lambda update | ✅ sha256:92bd28e2...bb30 (Successful) |
| 라이브 `/api/{claude,openai,gemini,kisa-drill,kisa-review}` | ✅ 모두 401 (정상) |

#### Stage 4 보류 결정

§4.2-R1 (TrackTab 추상화)는 두 번째 트랙 추가 시 가치 발현. 단일 트랙(KISA)만 운영 중인 현 시점에서 미리 추상화하면 오버엔지니어링. **두 번째 트랙 추가와 함께 일괄 진행** 권고. 그 시점에 R2(DB 통합)도 함께 처리.

---

### 8.5 MultiModule 확장 구조 — Stage 1·2·6 실행 (2026-04-25)

§10 의 단계 계획 중 위험도 낮은 Stage 1·2·6 light 를 한 라운드에 실행.

#### Stage 1 — 컴포넌트 레지스트리 (R3) ✅
- 신규 `src/components/QuestionTypes/registry.js` — `QUESTION_TYPES` 단일 진실 공급원
- `DrillSession.jsx` — 3개 if 분기 → `getQuestionType().Card` 한 줄
- `ResultOverlay.jsx` — 헤더 라벨 분기 → `getQuestionType().resultLabel` 한 줄
  (`isMcq/isBlank/isDiag` 변수는 다른 분기에서 여전히 사용 — 점진 마이그레이션, 동작 영향 0)
- 효과: 신규 question_type 추가 시 registry 1 파일만 수정하면 Card·라벨이 자동 적용됨

#### Stage 2 — 트랙 메타 추출 (R5) ✅
- 신규 `src/tracks/index.js` (TRACKS 레지스트리), `src/tracks/kisa.js` (KISA 메타)
- `kisa.js` 가 보유:
  - id, name, color, basePath, apiPrefix
  - `examConfig` (theory60 / practical100 / full3h) — `api/kisa-exam.js` 와 동기화 필요 정보
  - `weaknessCategories` (7대 분류) + `stages` (설계/구현)
  - `passing` (합격선)
- `Stats.jsx` — 하드코딩된 `CATEGORY_LABEL` → `Object.fromEntries(... kisaTrack.weaknessCategories ...)` 동적 생성
- `StudyDetail.jsx` — 자체 CATEGORY_LABEL 유지(chapter.category 가 다른 키 체계라 호환성 차원)
- 신규 트랙 추가 시: `src/tracks/{newTrack}.js` 생성 후 `src/tracks/index.js` 의 TRACKS 에 등록

#### Stage 6 light — 즉시 안전한 cleanup ✅
- **Vercel 주석 일괄 치환**: 11개 파일의 `// Vercel 서버리스 함수` → `// AWS Lambda Express 핸들러`
  (`api/{categories,claude,explanations,law,gemini,questions,forgot-password,exam-results,memos,login,bookmarks,send-verification,admin}.js`)
  ※ `api/import-docstore.js` 는 DocStore 제외 정책으로 미터치
- **빈 디렉토리 삭제**: `src/contexts/` (0 파일)
- **`.gitignore`**: `vercel.json.bak` 추가 (백업 파일 git 추적 제외)

#### 검증

| 항목 | 결과 |
|---|---|
| 로컬 빌드 (Stage 1) | ✅ 1.25s 정상 |
| 로컬 빌드 (Stage 2 + 6) | ✅ 1.25s 정상 |
| CodeBuild (Stage 1) | ✅ SUCCEEDED |
| CodeBuild (Stage 2+6) | ✅ SUCCEEDED |
| Lambda (Stage 1) | ✅ sha256:ab7f1e6e...5fcf1 (Successful) |
| Lambda (Stage 2+6) | ✅ sha256:5d497e39...2d87 (Successful) |
| 라이브 `/api/claude,openai,gemini,kisa-drill,kisa-review` | ✅ 모두 401 (withAuth 정상) |

#### 다음 단계 (별도 라운드)

- Stage 3 (seed 스크립트 통일) — 운영 도구, 배포 불필요
- Stage 4 (TrackTab 추상화) — 큰 작업, 4a/4b/4c 단계로 분할 진행 예정
- Stage 5 (DB 통합) — 두 번째 트랙 추가 시점에 일괄 (현재 보류)
- Stage 6 잔여 — 의존성 정리(`pdf-parse`, `dompurify`, `docx` 사용처 검증 후 제거),
  `api/admin.js` vs `api/auth.js` 중복 검토, Capacitor 사용 여부 결정

---

### 8.4 LLM 호출 fetch 패턴 통일 (2026-04-25)

§3.2 권고 + 별도 검토(SDK vs fetch 비교) 결과, LLM API 호출을 모두 **fetch 단일 패턴**으로 통일. 도메인 코드와 HTTP 호출 코드를 분리.

#### 신규 모듈 (`api/_llm/`)

| 파일 | 역할 | 줄 수 |
|---|---|---|
| `_llm/_utils.js` | SSE 파서 / 에러 표준화 / 타임아웃 | 82 |
| `_llm/anthropic.js` | Claude Messages API (chat / chatStream) | 116 |
| `_llm/openai-chat.js` | OpenAI Chat (o-series·GPT-5 분기 포함) | 153 |
| `_llm/gemini.js` | Gemini generateContent + thinkingConfig 확장 옵션 | 149 |

각 헬퍼는 OpenAI 형식 `messages` 배열을 입력으로 받아 프로바이더별 형식으로 변환. 이미지 멀티모달도 통일된 인터페이스(`{type:'image', source:{type:'base64', ...}}`)로 받음.

#### 마이그레이션된 호출처

| 파일 | 마이그레이션 전 | 마이그레이션 후 | 변화 |
|---|---|---|---|
| `api/claude.js` | Node `https.request` 직접 호출 | `_llm/anthropic.js` 사용 | **167 → 84 줄 (-50%)** |
| `api/openai.js` | `OpenAI` SDK | `_llm/openai-chat.js` 사용 | 167 → 120 줄 (o-series 분기 헬퍼로 이전) |
| `api/gemini.js` | `fetch` 직접 (로컬 SSE 파서 포함) | `_llm/gemini.js` 사용 | 147 → 111 줄 |
| `api/_kisa/llmGrader.js` | 3 프로바이더 fetch 직접 호출 | 3 헬퍼 모두 사용 | 225 → 166 줄 (-26%) |
| `api/pool-upload.js` | `@google/generative-ai` SDK | `_llm/gemini.js` Vision 호출 | 196 → 201 (시그니처 보존, 내부만 교체) |

#### 효과

- **코드 라인 합계**: 902 → 682 (-220줄, 헬퍼 500줄 신규 포함 시 net +280줄이지만 호출처는 평균 30% 단순)
- **호출 패턴 통일**: 4개 호출처 모두 동일 헬퍼 사용. 신규 LLM 라우트 추가 시 헬퍼 호출 1줄로 끝
- **이미지 멀티모달 형식 통일**: 3 프로바이더 모두 OpenAI 호환 메시지 형식으로 받음
- **에러 처리 표준화**: `_utils.ensureOk` 가 4xx/5xx 본문 파싱 + 표준 Error 던지기
- **SSE 파서 단일화**: `_utils.parseSseBody` 하나로 3 프로바이더 모두 처리
- **타임아웃 표준**: `_utils.withTimeout(ms)` 로 일관된 AbortController 패턴

#### SDK 의존성 처리

- ⏸ **`openai` 패키지 제거 보류**: `api/import-docstore.js` (DocStore 잔재) 가 여전히 사용 중. DocStore 분리 시점에 함께 제거.
- ⏸ **`@google/generative-ai` 패키지 제거 보류**: 동일 사유.
- ✅ **이번 마이그레이션 범위에서 새 SDK 도입 없음**. fetch 단일 패턴.

#### 검증

| 항목 | 결과 |
|---|---|
| 로컬 빌드 | ✅ 1.50s 정상 |
| 로컬 syntax check (5 파일) | ✅ 모두 OK |
| CodeBuild | ✅ SUCCEEDED |
| Lambda update | ✅ Successful (sha256:dfde1844...6868) |
| 라이브 `/api/claude` | ✅ HTTP 401 (withAuth 동작 정상) |
| 라이브 `/api/openai` | ✅ HTTP 401 |
| 라이브 `/api/gemini` | ✅ HTTP 401 |
| 라이브 `/api/kisa-drill` | ✅ HTTP 401 |

#### 후속 작업 (별도)

1. DocStore 코드(`api/import-docstore.js`) 별도 프로젝트로 분리 → 이후 `openai`, `@google/generative-ai` 의존성 npm uninstall
2. 운영 LLM 호출 모니터링 — 회귀 발견 시 헬퍼 1곳만 수정으로 일괄 적용
3. (선택) Gemini 의 `responseMimeType: 'application/json'` 강제 옵션을 헬퍼 레벨에서 더 깔끔하게 노출

---

## 10. MultiModule 확장 구조 개선 — 단계별 실행 계획 (2026-04-25 기획)

§4.2 의 R1~R5 권고를 **위험도 낮은 순서**로 5단계로 분리. 각 단계마다 빌드·배포·스모크 후 다음 단계 진행.

### Stage 1 — 컴포넌트 레지스트리 (R3) [LOW RISK]

**목표**: question_type 분기를 한 곳에 모아 신규 유형 추가 시 1 파일만 수정.

**작업**:
1. 신규 `src/components/QuestionTypes/registry.js` 생성
   ```js
   export const QUESTION_TYPES = {
     mcq:        { Card: McqCard,       label: '이론',   icon: '🎯' },
     blank:      { Card: BlankCard,     label: '단답형', icon: '✍️' },
     diagnosis4: { Card: DiagnosisCard, label: '실기',   icon: '🧪' },
   };
   ```
2. 기존 `KisaTab/{Mcq,Blank,Diagnosis}Card.jsx` → `components/QuestionTypes/cards/` 로 이전(또는 re-export)
3. `DrillSession.jsx` 의 if/else 분기를 `QUESTION_TYPES[type].Card` 사용으로 단순화
4. `KisaExamMode.jsx`, `ResultOverlay.jsx` 의 isMcq/isBlank/isDiag 분기도 동일하게 정리

**위험**: 매우 낮음 (UI 동작 동일, 내부 분기 패턴만 변경)
**예상 시간**: 1~1.5시간

### Stage 2 — 트랙 메타 추출 (R5) [LOW RISK]

**목표**: KISA 의 하드코딩된 메타(시험 구성·약점 카테고리 라벨·색상·시험명)를 한 파일로 추출. 신규 트랙 = 메타 파일 1개 추가로 정의 가능하게.

**작업**:
1. 신규 `src/tracks/index.js` + `src/tracks/kisa.js`
   ```js
   // src/tracks/kisa.js
   export default {
     id: 'kisa',
     name: 'KISA 진단원 이수시험',
     color: '#4255ff',
     basePath: '/kisa',
     examConfig: {
       theory60: { mcq: 20, blank: 10, practical: 0, time: 60*60 },
       practical100: { mcq: 0, blank: 0, practical: 15, time: 100*60 },
       full3h: { mcq: 20, blank: 10, practical: 15, time: 180*60 },
     },
     weaknessCategories: { input_validation: '입력검증', security_feature: '보안기능', ... },
     stages: { design: { label:'설계단계', total:20 }, implementation: { label:'구현단계', total:49 } },
   };
   ```
2. `Dashboard.jsx`, `Stats.jsx`, `StudyDetail.jsx`, `KisaExamMode.jsx` 가 하드코딩 대신 `track.weaknessCategories[k]` 같은 형태로 참조
3. 기존 동작 영향 0 (값 자체는 동일)

**위험**: 낮음
**예상 시간**: 2~3시간

### Stage 3 — Seed 스크립트 통일 (R4) [LOW RISK, 운영 도구]

**목표**: seed 생성 + DB 적재 패턴 통일. 신규 트랙의 시드 추가 시 동일 패턴 따르도록.

**작업**:
1. `scripts/seed/_utils.js` 신설 — 공통 헬퍼(shuffleKeep, buildExplanation, importViaAdmin 등)
2. `scripts/generate-blank-seed.js` → `scripts/seed/kisa-blank.js` (이전 + 헬퍼 사용)
3. `scripts/generate-mcq-seed.js` → `scripts/seed/kisa-mcq.js`
4. `scripts/seed/blank-explanations.js` → `scripts/seed/kisa-explanations.js` 로 트랙 prefix
5. (선택) admin `?action=seed` 호출 패턴 표준 — psql 직접 임포트 대신
6. 기존 스크립트는 deprecation 표시 후 1주 유지, 이후 제거

**위험**: 운영 도구 (런타임 영향 0)
**예상 시간**: 1~2시간

### Stage 4 — TrackTab 추상화 (R1) [MEDIUM RISK]

**목표**: `KisaTab` 의 트랙-agnostic 부분을 분리. 신규 트랙 추가 시 페이지 컴포넌트 재작성 불필요.

**작업** (하위 단계 4a → 4b → 4c):

4a) **Context + 비파괴적 추가**:
- 신규 `src/tabs/TrackTab/TrackContext.jsx`, `index.jsx`
- 기존 `KisaTab/*` 그대로 두고 `TrackTab` 이 KISA 메타로 동작하는 평행 구조 도입
- 새 라우트 `/track/kisa/*` 신설 (기존 `/kisa/*` 동시 유지)

4b) **점진 이전**:
- KisaTab/Dashboard/Stats/Study/StudyDetail/DrillSession/ExamMode/ResultOverlay 를 TrackTab 으로 이전 (기존 KisaTab 은 thin wrapper 가 됨)
- 라우트는 `/kisa/*` 그대로 유지 (사용자에게 영향 0)

4c) **API 표준화 (선택)**:
- `api/track-{admin,attempt,drill,exam,review,study}.js` 신설 (`?track=kisa`)
- 기존 `api/kisa-*.js` 는 → `api/track-*.js` 로 redirect 하는 thin wrapper
- 또는 KISA 단독 운영 동안은 알리어스 유지

**위험**: 중간 (기존 컴포넌트 이전, UI 회귀 가능성)
**예상 시간**: 6~8시간 (4a 2h + 4b 4h + 4c 2h)

### Stage 5 — DB 스키마 통합 (R2) [DEFER]

**판단**: §4.2-R2 의 권고대로 **두 번째 트랙 추가 시점에 일괄 수행**. 현재 KISA 단독 운영 중에는 마이그레이션 ROI 가 낮음. 별도 PR 로 분리.

### Stage 6 — 코드/리소스 정리 (cleanup) [LOW RISK]

§3.3 미사용 코드 정리. Stage 1~4 완료 후:

1. **빈 디렉토리**: `src/contexts/` (0 파일) → 삭제
2. **레거시 시드 스크립트**: Stage 3 후 deprecation 1주 → 제거
3. **의존성 점검**: `pdf-parse`, `dompurify`, `docx` 미사용 검증 후 제거
4. **`api/admin.js` vs `api/auth.js`** 중복 검토
5. **모바일(Capacitor)** 사용 여부 결정 → 미사용이면 `cap:*` 스크립트 + `@capacitor/*` 의존성 제거
6. **Vercel 주석 일괄 치환** (§2.2-A): 9개 파일의 "// Vercel 서버리스 함수" → "// AWS Lambda Express 핸들러"

**위험**: 낮음 (cleanup 단독)
**예상 시간**: 1~2시간

### 진행 순서 (단계 → 단계 → 배포 → 검증)

```
Stage 1 (R3, 1시간) → 빌드/배포/스모크 → 안정 1일 →
Stage 2 (R5, 2시간) → 배포 →
Stage 3 (R4, 1시간) → (배포 불필요, 운영 도구) →
Stage 4a (Context/평행, 2시간) → 배포 →
Stage 4b (점진 이전, 4시간) → 배포 →
Stage 4c (API 표준화, 2시간) → 배포 →
Stage 6 (cleanup) → 마지막 배포
```

총 **5~6회 배포**로 분산. 각 배포 사이 Lambda digest 보존으로 즉시 롤백 가능.

### 안전장치

- 각 단계마다 라이브 스모크: `/api/{claude,openai,gemini,kisa-drill,kisa-stats}` 401 응답 + 정상 페이지 로드
- 회귀 테스트 영역: 영상정보관리사 카드 학습 + KISA 드릴(MCQ/blank/diag) + 모의고사 + 통계 + 단답형 채점
- 회귀 발견 시 직전 Lambda digest 로 즉시 롤백 (이미지 디지스트 보존됨)

---

### 8.8 §12.2-C AI 비용 추적 + §12.2-D 오답 노트 (2026-04-25)

§12 권고 중 C(비용 추적)과 D(오답 노트) 동시 진행. 한 번 배포로 두 기능 동시 출시.

#### C — AI 비용 추적 강화

**A) DB 마이그레이션** — `kisa-module/migrations/003_llm_usage_log.sql`
- 신규 테이블 `llm_usage_log` (id, user_id, provider, model, action, question_id, input/output_tokens, estimated_cost, latency_ms, success, error_message, meta, created_at)
- 인덱스 3개 (user_time / provider_time / action_time)
- 일일 비용 집계 뷰 `v_llm_daily_cost` (KST 기준 날짜·provider·model 그룹핑)
- ✅ Supabase 적용 완료

**B) 헬퍼 + 자동 로깅** — `api/_llm/usage.js` 신설
- `PRICING` 표 — 30+ 모델 단가 (USD/1K tokens). 모델 패밀리별 fallback 포함
- `calcCost({model, inputTokens, outputTokens})` — 정확 모델 → fallback → 보수적 추정
- `logUsage({provider, model, action, userId, questionId, ...})` — DB INSERT (실패 silent)

**C) 자동 로깅 통합** — `api/_llm/{anthropic,openai-chat,gemini}.js`
- chat / chatStream 전부 호출 후 자동 logUsage
- 토큰 수: anthropic `usage.input_tokens/output_tokens`, openai `usage.prompt_tokens/completion_tokens` (stream_options.include_usage 활성), gemini `usageMetadata.{promptTokenCount, candidatesTokenCount}`
- 에러 시에도 로깅 (success=false, error_message)
- meta 에 `streaming: true` 표기

**D) 호출처 action 라벨링** — `api/{claude,openai,gemini}.js`, `api/_kisa/llmGrader.js`
- `action: 'card_explain'` (영상정보관리사 카드 학습 + KISA AI 추가 해설)
- `action: 'kisa_grade'` (KISA 실기 LLM 보조 채점) + questionId
- userId = req.user?.uid 자동 주입

**E) 관리자 대시보드 API** — `api/admin.js`
- `GET /api/admin?action=llm_usage&days=7` (관리자 전용)
- 응답: `{daily, byProvider, byAction, recent50}` — 일일 비용/프로바이더 분포/액션별 합계/최근 50건

#### D — 오답 노트

**A) 백엔드 API** — `api/kisa-review.js`
- `GET /api/kisa-review?action=wrong_notes&days=30&limit=100`
- DISTINCT ON (question_id) 으로 같은 문항의 가장 최근 오답만 (중복 제거)
- 조건: `auto_score IS NOT NULL AND auto_score < 70`
- 카테고리별 집계도 같이 반환 (`by_category`)

**B) 프론트엔드 페이지** — `src/tabs/KisaTab/WrongNotes.jsx` (신규, 약 240줄)
- 기간 선택: 7일 / 30일 / 90일
- 약점 분류별 요약 칩 (트랙 메타의 weaknessCategories 사용)
- 문항 카드: 유형 배지(registry icon/label), 챕터, 약점, 점수, 일시, 본문 일부, 내 답 vs 정답, 해설 토글, "이 챕터 다시 풀기" 버튼
- 빈 상태: 🎉 "선택한 기간에 오답이 없습니다!" 격려 메시지

**C) 라우팅 + 진입점** — `src/tabs/KisaTab/index.jsx`, `Dashboard.jsx`
- `/kisa/wrong-notes` 라우트 추가 (lazy loaded)
- Dashboard 시작 버튼 6개 → 7개 ("📝 오답 노트 — 틀린 문항 모음" 추가)

**D) 유형별 답 표시 로직**
- mcq: 사용자 선택 번호 vs 정답 번호
- blank: `#1=A, #2=B` 형태로 빈칸별 사용자 답 vs 정답 목록
- diagnosis4: 판정 Y/N + 라인 + 근거 일부

#### 검증

| 항목 | 결과 |
|---|---|
| DB 마이그레이션 003 | ✅ llm_usage_log 테이블 + 인덱스 3개 + v_llm_daily_cost 뷰 생성 |
| _llm/* 헬퍼 syntax | ✅ 모두 정상 |
| 로컬 빌드 | ✅ 1.51s 정상 |
| CodeBuild | ✅ SUCCEEDED |
| Lambda update | ✅ sha256:0d2440a5...b62c (Successful) |
| 라이브 `/api/claude,openai,gemini` | ✅ 401 (정상 인증 동작) |
| 라이브 `/api/kisa-review?action=wrong_notes` | ✅ 401 (정상) |
| 라이브 `/api/admin?action=llm_usage` | ✅ 401 (정상, withAdmin) |

#### 가시 효과

**비용 추적 (관리자만)**:
- 모든 LLM 호출이 자동으로 `llm_usage_log` 에 기록됨
- 단순 SQL 1줄로 일일 비용 확인: `SELECT * FROM v_llm_daily_cost WHERE usage_date = CURRENT_DATE;`
- Provider/Action/User 별 비용 가시화 가능
- 추후 cron 으로 임계값 초과 알림 (Telegram/Slack) 추가 가능

**오답 노트 (사용자)**:
- KISA 대시보드 → "📝 오답 노트" 클릭
- 자가채점 70 미만 문항이 챕터·약점별로 정리됨
- 각 문항: 내 답 vs 정답 + 해설 + 다시 풀기 버튼
- 학습 지속률 향상에 기여

---

### 8.9 LLM 사용량 / 비용 관리 UI — 관리자 SettingsTab (2026-04-25)

§8.8-C 에서 `llm_usage_log` 자동 로깅 + `/api/admin?action=llm_usage` 백엔드 API 만 만들고 UI 가 없었던 부분을 보강. **관리자만 볼 수 있는 LlmUsagePanel** 을 설정 → AI 설정 탭에 통합.

#### 신규 컴포넌트

`src/tabs/SettingsTab/LlmUsagePanel.jsx` (약 280줄)

- 기간 선택 칩 (7/30/90일) + 새로고침 버튼 (`refreshKey` 토글로 재요청 트리거)
- 요약 3장 카드 — 총 비용 / 총 호출 / 에러율
- 일일 비용 LineChart (recharts — 이미 의존성)
- Provider 별 BarChart (anthropic 주황 / openai 초록 / gemini 파랑) + 상세 표
- Action 별 리스트 (`card_explain` / `kisa_grade` 등)
- 최근 50건 테이블 (시간/Provider/Action/In·Out 토큰/비용/속도/✓·✗)

#### 비용 표기 헬퍼

```js
function fmtCost(usd) {
  if (n === 0)   return '$0';
  if (n < 0.01)  return `¢${(n * 100).toFixed(2)}`;
  if (n < 1)     return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
```

#### 권한 보호 (3중 가드)

| 레이어 | 보호 |
|---|---|
| UI | `SettingsTab/index.jsx` — 비관리자에겐 'ai' 탭 자체 비노출 |
| 컴포넌트 | `LlmUsagePanel.jsx:71` — `if (!isAdmin) return null` + useEffect 도 isAdmin 의존성 |
| API | `api/admin.js` — `withAdmin` 미들웨어 (401/403) |

#### 통합

`src/tabs/SettingsTab/index.jsx` L43~50:
```jsx
{activeSection === 'ai' && (
  <div className="space-y-4">
    <Card><LlmSettingsPanel /></Card>
    <LlmUsagePanel />
  </div>
)}
```

#### 검증

| 항목 | 결과 |
|---|---|
| 로컬 빌드 | ✅ 1.27s |
| recharts 코드 스플릿 | ✅ `BarChart-*.js` 별도 청크 (376kb gzip 112kb) — SettingsTab 진입 시만 로드 |
| 라이브 `/api/admin?action=llm_usage` (비인증) | ✅ HTTP 401 |
| 회귀 (`/api/claude` 등) | ✅ 모두 401 |
| Lambda digest | `sha256:f8a25b58...8922` |

---

### 8.10 회원가입 차단 토글 — DB 기반 무재배포 (REBUILD16 §3.4 대안, 2026-04-25)

§3.4 권고는 SSM 운영 플래그 패턴이었으나 **관리자 UI 토글이 더 실용적**이라 판단해 DB 기반으로 전환. SSM 비교:

| 항목 | §3.4 SSM 권고 | **§8.10 DB 채택안** |
|---|---|---|
| 토글 방법 | `aws ssm put-parameter` CLI | 관리자 UI 클릭 |
| 반영 시점 | Lambda 콜드스타트 후 | 즉시 (캐시 30초) |
| 감사 로그 | CloudTrail | DB `updated_by` 컬럼 |
| 추가 인프라 | SSM 키 등록 | DB 테이블 1개 |
| 1회용 가치 | ROI 낮음 | 동일 |
| **장기 가치** | 환경 분리 (staging/prod) | 다중 플래그 추가 즉시 |

#### 신규 자산

```
kisa-module/migrations/004_aitutor_settings.sql   ← 신규 테이블 + signup_disabled='true' 시드
api/_runtime/settings.js                          ← getSetting/setSetting/isSignupDisabled (30초 캐시)
api/config.js                                     ← 공개 GET /api/config (화이트리스트 플래그)
```

#### 테이블 설계 — DocStore 와 격리

`public.app_settings` 가 이미 DocStore 가 사용 중 (REBUILD16 §3.1 격리 정책 부합) → **별도 `aitutor_settings` 테이블** 신설:

```sql
CREATE TABLE aitutor_settings (
  key         VARCHAR(50) PRIMARY KEY,
  value       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INTEGER       -- 관리자 user_id
);
```

#### 백엔드 변경

| 파일 | 변경 |
|---|---|
| `api/signup.js` | 하드코딩 `SIGNUP_DISABLED = true` 제거 → `await isSignupDisabled()` |
| `api/send-verification.js` | 동일 |
| `api/admin.js` | `get_settings` GET + `set_setting` POST 액션 추가 — `ALLOWED_SETTING_KEYS = {'signup_disabled'}` 화이트리스트 |

#### 프론트엔드 변경

| 파일 | 변경 |
|---|---|
| `src/pages/LoginPage.jsx` | 하드코딩 제거 → 마운트 시 `fetch('/api/config')` → `signupDisabled` state 분기 |
| `src/tabs/SettingsTab/index.jsx` | `SystemSettingsCard` 신규 컴포넌트 (회원관리 섹션 상단 토글) |

#### 안전 기본값 — 다중 방어

| 위치 | 방어 |
|---|---|
| `getSetting` DB 장애 시 | 기본값 `'true'`(차단) 반환 |
| `isSignupDisabled` 키 누락 | 기본값 `true`(차단) |
| `LoginPage` `/api/config` 실패 | `signupDisabled = true` (catch) |
| `LoginPage` 응답 누락 | `data?.signup_disabled !== false` (정확히 false 가 아니면 차단) |

→ DB 장애·네트워크 실패·응답 변형 모든 케이스에서 **회원가입이 실수로 열리지 않음**.

#### 검증

| 항목 | 결과 |
|---|---|
| `/api/config` (비인증) | ✅ 200 + `{"signup_disabled":true}` |
| `/api/admin?action=get_settings` (비인증) | ✅ 401 |
| `/api/signup` POST | ✅ 503 + `code: 'SIGNUP_DISABLED'` |
| Lambda digest | `sha256:af63bf1c...5795` |

---

### 8.10b admin.js GET 분기 버그 수정 (2026-04-25)

§8.10 배포 직후 사용자 보고 — "토글 OFF 후 새로고침하면 다시 ON 상태로 표시됨". DB 는 정상 저장이지만 UI 가 잘못 표시되는 증상.

#### 원인 — `req.body || req.query` 패턴 위험성

```js
// admin.js (수정 전)
const { action } = req.body || req.query || {};
```

ALB → Lambda(serverless-express) 환경에서 GET 요청에 body 가 없어도 **`req.body`가 빈 객체 `{}`(truthy)** 로 들어옴. 그러면:
1. `req.body = {}` truthy → 우측 평가 안 함
2. `{action} = {}` → `action = undefined`
3. `req.method === 'GET' && action === 'get_settings'` → false
4. 다음 분기로 떨어져 **"회원 목록 조회"** (`req.method === 'GET'`) 가 잡힘
5. `{ users: [...] }` 반환 (settings 키 없음)
6. SystemSettingsCard 의 `data.settings || []` → **빈 배열**
7. `getBoolValue('signup_disabled')` undefined → false → `signupEnabled = !false = true`
8. **토글이 활성화 상태로 잘못 표시됨**

#### 수정 — 명시적 query 우선 추출

```js
// admin.js (수정 후)
const action = (req.query && req.query.action) || (req.body && req.body.action);
```

GET/POST 모두 안전. `llm_usage` 액션도 같이 정상화 (이전엔 데이터 0건이라 빈 차트로 보여서 문제 인식 안 됨).

#### 검증

| 항목 | 결과 |
|---|---|
| Lambda digest | `sha256:f92c182d...e99b135` |
| `/api/config` | ✅ 200 + `{"signup_disabled":true}` |
| 토글 새로고침 동작 | ✅ DB 값 유지 표시 |

---

### 8.11 운전면허 학과시험 트랙 도입 — 1차 (2종 자동, 2026-04-25)

#### 방향성 결정 — 영상정보관리사 트랙 그대로 활용

기획 초기에 KISA 패턴 복제 (별도 `driver_questions` 테이블 + `api/driver-*.js`) 를 검토했으나, **운전면허 학과시험은 단순 객관식**(SRS·진단실기·복잡 채점 불필요) 이라 **영상정보관리사 트랙(`questions` 테이블)** 을 그대로 활용. 코드 변경 거의 0.

| 항목 | KISA | 운전면허 |
|---|---|---|
| 문제 유형 | MCQ + blank + diagnosis4 | MCQ만 (+ 동영상) |
| 카테고리 분류 | 7대 약점 분류 (입력검증/보안기능/...) | 단순 과목 (교통법규/안전운전/표지·신호) |
| 채점 방식 | 결정론 + LLM 보조 | 정답 번호 일치 |
| SRS | 도입 | 불필요 |
| 모의고사 | 이론60/실기100/전체3h | 학과 40분 / 40문항 |
| **결론** | 별도 모듈 정당화 | **영상정보관리사 트랙 활용** ✓ |

#### 출처 + 라이선스

| 항목 | 값 |
|---|---|
| PDF | 1·2종 보통 + 1종 대형·특수 통합 (`1_2_bo_dae_teuk_2026_03.pdf`, 48MB, 331페이지) |
| 시행일 | 2026-03-09 |
| 다운로드 | safedriving.or.kr `FileDown.do?atchFileId=FID00137702` (302 redirect 따라가기 + JS form POST 분석) |
| 라이선스 | 공공데이터포털 "이용허락범위 제한 없음" (상업 가능) — safedriving 공지 "상업적 이용 금지" 와 모순. **1차는 개인학습 무료 운영** |
| **2종 자동변속** | 학과시험은 2종 보통과 100% 동일 문제은행 (실기 단계만 자동/수동 차이) → 같은 PDF |

#### DB 마이그레이션 3건

| 파일 | 내용 |
|---|---|
| `driver-module/migrations/001_questions_media.sql` | `video_url VARCHAR(255)`, `duration_sec INT` 추가 |
| `driver-module/migrations/002_questions_answer_extra.sql` | `answer_extra INTEGER` — 복수 정답 296건 지원 (3개 이상 정답 0건 확인) |
| `driver-module/migrations/003_questions_unique.sql` | `(exam_id, question_number)` UNIQUE 제약 — import 재실행 안전성 |

⚠ **003 도입 배경**: 첫 적재 시 `ON CONFLICT DO NOTHING` 이 unique constraint 부재로 작동 안 해 982 + 160 = 1,142 중복 발생. 중복 정리 후 unique 제약 추가 + import.js 의 ON CONFLICT 도 컬럼 명시.

#### 메타 등록

```sql
categories: '운전면허' (id=4, sort=5)
exams:      '2종 자동 학과시험 (2026.3월 시행)' (id=161)
subjects:   '교통법규' / '안전운전·차량관리' / '표지·신호' / '동영상 문제' (id=4~7)
```

#### 작업 산출물 (driver-module/)

```
driver-module/
├── README.md
├── source/1_2_bo_dae_teuk_2026_03.pdf      (48MB)
├── migrations/                             (001/002/003)
├── scripts/
│   ├── 02_extract.js                       PDF → 정규화 JSON
│   ├── 04_import.js                        DB INSERT + 이미지 복사
│   └── 05_wrap_laws.js                     법령 「」 자동 래핑
└── data/
    ├── raw-extracted.json                  985 문항
    └── images/                             294 이미지
```

#### 추출 결과 — 핵심 발견

> **PDF 에 정답 + 해설이 모두 포함**되어 있어 Claude Code 로 별도 해설 생성 불필요.

```
■ 정답：4
■ 해설：도로교통법 제82조 제1항 제6호에 따라 ...
```

| 통계 | 값 |
|---|---|
| 총 추출 | 985 문항 (PDF 결번 15건은 도로교통공단 운영상 폐기 — #15, #105~109, #344~347 등) |
| 이미지 매핑 | 130 건 (#459, #681~) |
| 동영상 검출 | 35 건 (#966~ "(홈페이지 참조)") |
| 복수 정답 | 281 건 ("정답: 2, 4" 형식) |
| 5지선다 | 184 건 (⑤ 사용) |
| 추출 정확도 | 985 - 데이터 부족 8건 = **97.7%** |

#### 추출 스크립트 핵심 트릭

| 이슈 | 해결 |
|---|---|
| 들여쓰기된 보기 (`    ① ...`) | choiceRegex `^\s*([①②③④⑤])\s*` (`\s*` 로 공백 0개도 허용 — `①"자동차전용도로"` 케이스) |
| 해설 안의 "1.", "가." 가 새 문항으로 오인 | 단조 증가 휴리스틱 (`candidateNo > lastAcceptedNo` + `<= lastAcceptedNo + 50`) |
| `①` 가 `ⓛ`(Latin L)로 추출됨 | NORMALIZE_MAP `'ⓛ' → '①'` 사전 치환 |
| 본문에 보기가 한 줄로 합쳐진 케이스 | 후처리: 본문에서 ①②③④ 위치 모두 찾아 분리 |

#### 적재 결과

```
$ node scripts/04_import.js
  성공: 982
  스킵:   3 (데이터 부족 — #418/#643/#964 페이지 분할 이슈)
  에러:   0
  이미지: 130개 → public/q-images/driver/
```

#### 미디어 배치 — 확장성 고려한 네이밍

```
public/q-images/driver/
├── q0459.jpg                   ← 그림 문항 (zero-padded 4자리)
├── q0681.jpg ~ q0980.jpg
└── (향후) v0966.mp4 ~          ← 동영상 후속 라운드
```

향후 다른 자격증 추가 시 `public/q-images/{license}/` 같은 평행 트리.

#### 카테고리 자동 분류 (subject_id)

| 조건 | subject |
|---|---|
| `is_video` | '동영상 문제' (id=7) |
| `image_file` 있음 | '표지·신호' (id=6) |
| 그 외 | '교통법규' (id=4) — 대다수 |

→ 1차 단순 휴리스틱. 운영 후 관리자 UI 에서 정밀 재분류 가능.

#### 영상정보관리사 영향 0 검증

```
✓ categories +1 row              (영상정보관리사 row 영향 0)
✓ exams +1 row
✓ subjects +4 rows
✓ questions +982 rows            (1,489 → 2,471)
✓ video_url, answer_extra, duration_sec 컬럼 — NULL 허용 (기존 데이터 영향 0)
✓ unique 제약 — 영상정보관리사에 충돌 없음 (사전 검증)
✓ public/q-images/q002.png 등 200 OK (회귀 검증)
✓ 코드 변경 0줄 (LearnHub 가 categories 자동 인식)
```

#### Lambda digest

`sha256:90a138db...0ded9` (CloudFront `I5RNHMVYR3904X76GXLY35PMHW` 무효화)

---

### 8.12 법령명 자동 「」 래핑 (2026-04-25)

#### 형식 차이

| 트랙 | 해설 형식 |
|---|---|
| 영상정보관리사 (기존) | "「개인정보 보호법」 제3조에 따라..." (한국식 따옴표) |
| 운전면허 (신규) | "도로교통법 제85조의2..." (따옴표 없음) |

LawLink 컴포넌트 정규식: `/「([^」]{2,40})」/g` — 따옴표 없는 운전면허는 자동 인식 안 됨.

#### 해결 — DB 데이터 표준화

`scripts/05_wrap_laws.js`: 9종 법령명 패턴을 SQL UPDATE 로 「」 래핑. lookbehind/lookahead 로 이미 「」 안인 것은 보호.

```js
const LAW_PATTERNS = [
  // 긴 것부터 (substring 충돌 방지)
  '환경친화적 자동차의 개발 및 보급 촉진에 관한 법률?',
  '특정범죄 가중처벌 등에 관한 법률',
  '교통사고처리 특례법',
  '자동차손해배상 보장법',
  '도로교통법\\s*시행규칙',     // 공백 0개 또는 다수
  '도로교통법\\s*시행령',
  '자동차관리법',
  '건설기계관리법',
  '도로교통법',                 // 짧으니 마지막
  '도로법',
];
const re = new RegExp(`(?<!「)(${pattern})(?!」)`, 'g');
```

#### 변환 결과

```
explanation: 549 건 변환 (982 중 56%)
body:        311 건 변환 (982 중 32%)
이미 「」 안: 23 건 보호 ("「도로교통 에 관한 협약」" 등)
```

코드 변경 0건, **재배포 불필요** (DB UPDATE만).

---

### 8.13 LawSearchPanel 키 불일치 4건 수정 (2026-04-25)

§8.12 적용 후 사용자 점검 요청. **LawLink (해설 안 「」 자동 링크) 와 LawSearchPanel (별도 검색 패널) 은 다른 컴포넌트** — LawLink 는 정상이지만 LawSearchPanel 은 **영상정보관리사 시절부터 동작 안 한 버그** 발견.

#### 키 불일치 4건 (모두 같은 파일)

| # | 파일·라인 | 잘못 | 실제 백엔드 응답 |
|---|---|---|---|
| 1 | `LawSearchPanel.jsx:27` | `data.laws` | `data.results` |
| 2 | `LawSearchPanel.jsx:39` body | `mst` | `lawId` |
| 3 | `LawSearchPanel.jsx:40` 응답 | `data.law \|\| data` | `data.info` + `data.articles` |
| 4 | `LawSearchPanel.jsx:77` 클릭 | `law.mst \|\| law.MST` | `law.id` (search 응답에 mst 없음) |

#### 라이브 호출 검증

```bash
$ curl -X POST .../api/law -d '{"action":"detail","mst":"281875"}'
{"error":"법령ID(lawId)가 필요합니다."}      ← 항상 에러

$ curl -X POST .../api/law -d '{"action":"detail","lawId":"281875"}'
{ "info": {...}, "articles": [...229개] }    ← 정상
```

#### 수정

```diff
- setResults(data.laws || []);
+ setResults(data.results || []);

- const data = await apiPost('/api/law', { action: 'detail', mst });
+ const data = await apiPost('/api/law', { action: 'detail', lawId: mst });

- setDetail({ name, ...(data.law || data) });
+ setDetail({ name, info: data.info, articles: data.articles });

- onClick={() => loadDetail(law.mst || law.MST, law.name || law.법령명한글)}
+ onClick={() => loadDetail(law.id, law.name)}
```

조문 렌더링도 정리: `art.title || art.조문제목` → `art.title` 단일 + `제N조` 표시 추가.

#### 검증

| 항목 | 결과 |
|---|---|
| `/api/law search "도로교통법"` | ✅ 3건 정상 (id, name, ministry, link) |
| `/api/law detail lawId=281875` | ✅ info + 229 조문 |
| Lambda digest | `sha256:6f0f7b85...02e00` |

---

### 8.14 SettingsTab 카테고리 아코디언 + 과목 필터 (2026-04-25)

운전면허 카테고리 추가로 카테고리·과목·시험-카테고리 3 카드가 모두 펼쳐진 상태가 길어져 화면 효율 저하. 단일 활성 아코디언으로 변경 + 과목 관리에 카테고리 필터 추가.

#### 신규 헬퍼

`AccordionSection` 컴포넌트 (SettingsTab/index.jsx 안에 정의):
- 헤더: 제목 + count 배지 + 펼침 화살표 (200ms rotate)
- 단일 활성 (`openSection: 'cat' | 'sub' | 'exam' | null`)
- 한 번에 한 섹션만 펼쳐짐

#### 과목 관리 — 카테고리 필터 동작

```
┌─ [카테고리 선택] 드롭다운 ────────────────┐
│ ▽ — 카테고리를 선택하세요 (전체 보기) —     │
│   영상정보관리사                           │
│   네트워크관리사1급                        │
│   네트워크관리사2급                        │
│   운전면허                                 │
└─────────────────────────────────────────┘

[새 과목 입력란]
  - 카테고리 미선택: 비활성 (회색 + "카테고리를 먼저 선택하세요")
  - 카테고리 선택  : "'운전면허'에 추가할 새 과목명" placeholder

[목록 — 필터 적용]
  - 필터 활성 시 카테고리 배지 숨김 (노이즈 제거)
  - 빈 상태: "'운전면허' 카테고리에 등록된 과목이 없습니다"
```

`addSubject` 도 `subCatId` 대신 `filterCatId` 사용 — 필터에서 선택된 카테고리로 자동 추가.

#### 검증

| 항목 | 결과 |
|---|---|
| 로컬 빌드 | ✅ 1.43s |
| Lambda digest | `sha256:c5b71620...43f5` |
| CloudFront 무효화 | `I6F99R4GA7L1GAS8R4UCU5RW6V` |

---

### 8.15 운전면허 해설 전수 점검 (2026-04-25)

982 문항 해설 품질 분포 점검. 사용자 보완 의사결정 단계.

| 구간 | 건수 | 비율 |
|---|---:|---:|
| 🔴 NULL/빈 | **3** | 0.3% (#418, #643, #964) |
| 🟡 1-29자 (법조항만) | **42** | 4.3% |
| 🟠 30-59자 | 123 | 12.5% |
| 🟢 60-149자 | 431 | 43.9% |
| 🟢 150자+ | 383 | 39.0% |

빈 3건 원인: PDF 페이지 분할 시 다음 문항 시작이 너무 빨리 검출돼 해설이 흡수됨.

42건 짧은 해설 패턴: "「도로교통법」 제2조" 같이 법조항 번호만 — PDF 원본 자체가 짧을 가능성 큼.

**보완 옵션** (사용자 의사결정 — 2026-04-25):
- A: 빈 3건만 (1~2분, Claude Code)
- B: 빈 3건 + 짧은 42건 (10~15분, ⭐ 권장)
- C: 전수 168건 (30~40분)
- ✅ **D: 그대로 — 보류 채택**

#### 보류 사유 / 향후 재검토 시점

- PDF 원본 자체가 "법조항 번호만" 적어둔 케이스가 다수라 추정. 추출 누락이 아닌 원본 부족.
- 사용자가 「법령명」 클릭 → 법제처 새 탭으로 이동해 직접 조문 확인 가능 (LawLink 정상 작동).
- 운영 후 사용자 신고/피드백 기반으로 우선 보완 대상 식별 후 재진행 권장.

---

## 11. 현재 상태 종합 요약 (2026-04-25 EOD)

이 문서가 길어졌으므로 한 곳에서 보는 요약 섹션을 둔다.

### 11.1 오늘(2026-04-25) 완료한 작업 — 16개 라운드

| # | 작업 | 효과 | Lambda Digest |
|---|---|---|---|
| 1 | KISA 단답형 미세 수정 (StudyDetail blank 버튼, chapter_code 백필) | 학습자료 → 단답형 풀이 연결 | b294f4c1 |
| 2 | 학습 통계 초기화 기능 | 사용자가 KISA 진도 리셋 가능 | 20018fae |
| 3 | vite-plugin-pwa 제거 + 정적 manifest 전환 (REBUILD16 §2.2-C, §8.1) | 빌드 단순화, 의존성 −1 | fa93a350 |
| 4 | LLM 호출 fetch 패턴 통일 (§8.4) | api/_llm/ 헬퍼 4개 신설, 5 파일 마이그레이션 | dfde1844 |
| 5 | Stage 1·2·6 light cleanup (§8.5) | registry/tracks 신설, Vercel 주석/빈폴더 정리 | 5d497e39 |
| 6 | Stage 3 + 의존성 정리 (§8.6) | seed 스크립트 통일, deps 21→18 | 92bd28e2 |
| 7 | LearnHub 인라인 통계 칩 (UX) | 상단 큰 카드 → 헤더 옆 칩 (공간 절약) | feb04ff7 |
| 8 | Step 1·3 마무리 (§8.7) | registry 통합, TrackContext, App.jsx TRACK_IDS.map | cfbed6a7 |
| 9 | §12.2-C/D AI 비용 추적 + 오답 노트 (§8.8) | llm_usage_log + 자동 로깅 + /kisa/wrong-notes | 0d2440a5 |
| 10 | LLM 사용량/비용 관리 UI (§8.9) | 관리자 SettingsTab AI 설정 탭에 LlmUsagePanel 통합 | f8a25b58 |
| 11 | 회원가입 DB 토글 (§3.4 대안, §8.10) | aitutor_settings 테이블 + 관리자 UI 토글 + /api/config | af63bf1c |
| 12 | admin.js GET 분기 버그 수정 (§8.10b) | req.body \|\| req.query 위험성 → query 우선 명시 | f92c182d |
| 13 | 운전면허 학과시험 트랙 도입 (§8.11) | 982문항 적재, driver-module/, 메타·이미지 130건 | 90a138db |
| 14 | 법령명 자동 「」 래핑 (§8.12) | 운전면허 explanation 549건 + body 311건 (DB UPDATE만) | (재배포 X) |
| 15 | LawSearchPanel 키 불일치 4건 수정 (§8.13) | 영상정보관리사 시절부터의 검색/상세 작동 안 됨 해결 | 6f0f7b85 |
| 16 | SettingsTab 카테고리 아코디언 + 과목 필터 (§8.14) | 3 카드 → 단일 활성 아코디언, 카테고리 드롭다운 필터 | c5b71620 |

### 11.2 코드베이스 상태 메트릭

```
src/ 전체 라인 수      : 10,582 + LlmUsagePanel 약 280 + SystemSettingsCard 등 ≒ 11,000
api/ 전체 라인 수      :  5,102 + _runtime/settings.js + config.js ≒ 5,200
package.json 의존성    : dependencies 18, devDependencies 11
REBUILD16.md 라인 수   : 1,500+
```

신규 도입된 디렉토리:
```
src/components/QuestionTypes/   7 파일  (registry + 3 cards + 3 results + 3 exam)
src/tracks/                     3 파일  (index, kisa, TrackContext)
api/_llm/                       5 파일  (_utils, anthropic, openai-chat, gemini, usage)
api/_runtime/                   1 파일  (settings) ← §8.10 신규
scripts/seed/                   4 파일  (_utils, kisa-blank, kisa-mcq, kisa-explanations)
driver-module/                  ← §8.11 신규
  ├─ source/                    (PDF 48MB)
  ├─ migrations/                (3 SQL)
  ├─ scripts/                   (extract, import, wrap_laws)
  └─ data/                      (raw-extracted.json + images/)
public/q-images/driver/         130 이미지 (운전면허 그림 문항)
```

### 11.3 라이브 인프라 상태 (AWS)

| 자원 | 값 |
|---|---|
| Lambda 함수 | `aitutor` (Active, Successful) |
| 현재 이미지 | `sha256:c5b716207d2a85e1e29cdc5ada6c1cd877b2102656fe1cc0906f870687ab43f5` |
| 마지막 갱신 | 2026-04-25 21:27 KST (§8.14 SettingsTab 아코디언) |
| ECR | `794531974010.dkr.ecr.ap-northeast-2.amazonaws.com/aitutor:latest` |
| CloudFront | `https://d2dcsdi9b1j2rf.cloudfront.net` |
| ALB | `aitutor-alb-1012653397.ap-northeast-2.elb.amazonaws.com` |
| CodeBuild | `aitutor-build` (S3 source: `aitutor-codebuild-src-794531974010/aitutor-src.zip`) |
| Supabase DB | `aws-1-us-east-2.pooler.supabase.com` (aitutor 소유 테이블 26개 + 다른 프로젝트 테이블 존재) |
| 주요 데이터 | **영상정보관리사 1,489 / 운전면허 982 / kisa_questions 378 (mcq 168 + blank 138 + diagnosis4 52) / users 2** |
| 신규 테이블 | `aitutor_settings` (§8.10), `llm_usage_log` (§8.8) |
| 신규 컬럼 | `questions.video_url` / `duration_sec` / `answer_extra` (§8.11) |
| 신규 제약 | `questions(exam_id, question_number)` UNIQUE (§8.11) |

### 11.4 §10 단계 계획 진행률 최종

| Step | 항목 | 진행 | 비고 |
|---|---|---|---|
| Step 1 | R3 카드 레지스트리 패턴 | 🟢 100% | Card+Result+ExamBody+HeaderExtra+hasAnswer 모두 registry 통합 |
| Step 2 | R4 seed 표준화 | 🟢 100% | scripts/seed/ + _utils 헬퍼 |
| Step 3 | R5 트랙 메타/라우팅 추상화 | 🟢 100% | tracks/ + TrackContext + App.jsx TRACK_IDS.map |
| Step 4 | R1+R2 본격 리팩토링 (TrackTab/DB 통합) | ⏸ **불필요로 재평가** | 운전면허는 영상정보관리사 트랙 그대로 활용해 해소 (§8.11). KISA 의 SRS·진단실기 같은 복잡 채점이 필요한 새 트랙이 등장할 때 재검토 |

### 11.5 운영 플래그 (DB 기반)

§3.4 SSM 권고는 §8.10 에서 **DB 기반 토글**로 대체. SSM 패턴은 미사용 — 신규 플래그 추가 시 DB 패턴 재사용 권장.

| 플래그 | 위치 | 현재 값 | 의미 |
|---|---|---|---|
| `signup_disabled` | `aitutor_settings` 테이블 (관리자 UI 토글) | `true` | 회원가입 일시 차단 (UI "준비중" + API 503) |

향후 추가 후보: `maintenance_mode`, `ai_budget_hard_cap_usd` (§5.3-H), `experimental_feature_*` 등.

### 11.6 알려진 잔존 이슈 (서비스 영향 없음)

| 항목 | 영향 | 우선순위 |
|---|---|---|
| LLM API 키 무효 (Gemini/Anthropic SSM) | AI 추가 해설 — OpenAI 만 동작 | 🔴 높음 (사용자가 키 재발급) |
| 운전면허 해설 부족 케이스 (§8.15) — NULL 3건 + 1-29자 42건 | 학습자 가치 일부 저하. LawLink 로 법제처 직접 확인 가능 | ⚪ 낮음 (보류 채택 — 운영 후 신고 기반 재진행) |
| 운전면허 동영상 35건 — `video_url=NULL` (PDF 외부) | 동영상 미재생, 텍스트로 풀이 가능 | 🟡 중간 (PC학과 프로그램에서 추출 후 매핑 후속 라운드) |
| `api/import-docstore.js` (DocStore 잔재) — `openai`/`@google/generative-ai` SDK 의존 | aitutor 와 무관 코드, 의존성 제거 차단 | 🟡 중간 (DocStore 분리 시 해결) |
| Supabase 인스턴스 공유 — hairtag/lottoda/docstore 테이블 잔존 39개 | GDPR/감사 측면 잠재 위험 | 🟡 중간 |
| 운전면허 라이선스 모순 — 공공데이터포털 "제한 없음" vs safedriving 공지 "상업 금지" | 향후 유료화 시 명확화 필요 | 🟡 중간 |
| `vercel.json.bak` 파일 보관 (`.gitignore` 처리됨) | 0 | ⚪ 낮음 |
| Capacitor (모바일) 미사용 흔적 — `cap:*` 스크립트 + `@capacitor/*` deps | 0 | ⚪ 낮음 (모바일 사용 결정 필요) |

---

## 12. 다음 작업 제안 (Suggested Next Actions)

오늘 16 라운드까지의 작업으로 코드베이스가 안정적이고 다중 트랙 운영 단계에 들어섰다. 다음 단계로 가치가 큰 항목을 우선순위 순으로 제안한다.

### 12.1 🔴 즉시 처리 권고

**A. LLM API 키 재발급 + SSM 갱신**  
- 현재 Gemini/Anthropic 키가 INVALID 상태 (실측 확인). OpenAI 만 정상.
- 작업: 사용자가 https://aistudio.google.com/app/apikey, https://console.anthropic.com/settings/keys 에서 재발급 → SSM 업데이트 1줄
- 소요: 5분 (키 받은 후)

**B. ~~운전면허 해설 보완~~** — ✅ **보류 채택 (2026-04-25)**
- §8.15 옵션 D 선택. 운영 후 신고/피드백 기반으로 재진행 권장.
- 사용자가 LawLink 자동 링크로 법제처 직접 확인 가능하므로 학습 가치 손실 제한적.

### 12.2 🟡 중기 권고 (1~2주)

**C. 운전면허 동영상 35건 매핑**
- 현재 `video_url=NULL` — 본문/정답/해설로 학습은 가능하지만 동영상 누락
- 도로교통공단 PC학과 시험 프로그램에서 동영상 추출 → `public/q-images/driver/v966.mp4` 등 배치
- DB UPDATE 로 video_url 매핑
- 효과: 1차 출시 완성도 ↑

**D. 운전면허 1종 보통 / 대형·특수 회차 추가**
- 같은 PDF 콘텐츠 재사용 — 새 `exams` row 추가만으로 가능
- 다만 학과시험 자체가 "1·2종 보통, 대형·특수 통합"이라 회차 분리 의미는 라벨링뿐
- 진짜 분리는 PDF 내에서 종별 마커가 있는 경우만 (확인 필요)

**E. 이륜자동차 학과시험 추가**
- 별도 PDF 다운로드 (800문항) + 같은 파이프라인 재실행
- 메타: '이륜자동차' 카테고리 또는 운전면허 카테고리 안의 별도 회차
- 미디어 트리: `public/q-images/driver-bike/`

**F. AI 비용 임계값 자동 차단 (§5.3-H)**
- §8.8 에서 `llm_usage_log` 자동 로깅, §8.9 에서 UI 도 만들었으니 다음은 알림/차단
- 일일/월간 비용 임계값 도달 시 Telegram/Slack 알림 + 자동 차단
- 알림 채널: 이미 사용자 환경에 Telegram MCP 있음

### 12.3 🟢 장기 권고 (분기 단위)

**G. Supabase 인스턴스 분리 + DocStore 코드 추출**
- 현재 다른 프로젝트(hairtag/lottoda/docstore)와 DB 공유 → 별도 Supabase 프로젝트로 분리
- `api/import-docstore.js` 도 DocStore 프로젝트로 이전 → `openai`, `@google/generative-ai` 의존성 제거 가능
- 효과: 데이터 격리, 백업/롤백 영향 범위 명확화, 의존성 트리 축소

**H. CI/CD 자동화 (GitHub Actions OIDC)**
- 현재 배포: 로컬 빌드 → S3 업로드 → CodeBuild → Lambda update (수동 4단계)
- GitHub Actions OIDC + AWS 통합 시 git push 만으로 자동 배포
- 효과: 운영 안정성 + 인적 실수 감소

**I. 모바일 결정 및 정리**
- Capacitor 셸은 있으나 실배포 흔적 없음
- 결정 필요: (1) PWA 만 유지 + Capacitor 제거 / (2) Capacitor 본격 도입 (App Store 등록)
- (1) 결정 시 `@capacitor/*` 의존성 + `cap:*` 스크립트 + `capacitor.config.json` 제거

### 12.4 권고하는 다음 1주 워크 플랜

```
Day 1         : §12.1-A LLM 키 재발급 (사용자 작업, 5분)
Day 2~3      : §12.2-C 운전면허 동영상 35건 추출·매핑
Day 4~5      : §12.2-F AI 비용 임계값 알림/차단 자동화
Day 6~7      : §12.2-D/E 운전면허 회차 추가(1종 보통 / 이륜자동차) 또는 정리
다음 분기   : §12.3 항목 (장기)

— 운전면허 해설 보완 (§12.1-B) 은 보류 채택. 운영 후 신고 기반 재진행.
```

---

## 9. 변경 이력

| 일자 | 내용 | 작성자 |
|---|---|---|
| 2026-04-25 | 최초 작성 — Vercel→AWS 마이그레이션 후 정리 가이드 | Claude Code |
| 2026-04-25 | §8.1 추가 — vite-plugin-pwa 제거 + 정적 manifest 전환 (실제 배포까지 완료) | Claude Code |
| 2026-04-25 | §8.4 추가 — LLM 호출 fetch 패턴 통일 (5 파일 마이그레이션 + `_llm/` 헬퍼 신설, 배포까지 완료) | Claude Code |
| 2026-04-25 | §10 신규 — MultiModule 확장 구조 단계별 계획 6단계 추가 | Claude Code |
| 2026-04-25 | §8.5 추가 — Stage 1(R3 레지스트리)·Stage 2(R5 트랙메타)·Stage 6 light(Vercel 주석/빈폴더/.gitignore) 실행 + 배포 완료 | Claude Code |
| 2026-04-25 | §8.6 추가 — Stage 3(R4 seed 통일) + 미사용 의존성 3개 제거 + 배포 완료. Stage 4 는 두 번째 트랙 추가 시 진행 결정 | Claude Code |
| 2026-04-25 | §8.7 추가 — Step 1·3 마무리: registry 통합(Result/ExamBody/HeaderExtra/hasAnswer) + TrackContext + App.jsx TRACK_IDS.map 라우팅. Step 1·3 진행률 100% 달성 | Claude Code |
| 2026-04-25 | §11 종합 요약 + §12 다음 작업 제안 추가 — 오늘 9 라운드 완료 정리, 인프라 상태, Step 진행률, 다음 1주 워크 플랜 | Claude Code |
| 2026-04-25 | §8.8 추가 — §12.2-C AI 비용 추적(llm_usage_log + 자동 로깅 + admin 대시보드 API) + §12.2-D 오답 노트(/kisa/wrong-notes) 동시 출시 | Claude Code |
| 2026-04-25 | §8.9 추가 — LLM 사용량/비용 관리 UI(LlmUsagePanel) 관리자 SettingsTab AI 설정 탭 통합. 기간/요약/차트/테이블 + 3중 권한 가드 | Claude Code |
| 2026-04-25 | §8.10 추가 — 회원가입 차단 토글 DB 기반 무재배포(§3.4 SSM 권고 대체). aitutor_settings 테이블 + getSetting/setSetting 헬퍼 + /api/config 공개 + 관리자 SystemSettingsCard | Claude Code |
| 2026-04-25 | §8.10b 추가 — admin.js GET 분기 버그(req.body \|\| req.query 위험성) 수정. action 추출 명시화로 settings/llm_usage 액션 정상화 | Claude Code |
| 2026-04-25 | §8.11 추가 — 운전면허 학과시험 트랙 도입(2종 자동 982문항, 1·2종 보통+대형·특수 PDF 48MB). driver-module/ + 마이그레이션 3건(video_url/answer_extra/unique). 영상정보관리사 트랙 그대로 활용(KISA 패턴 X). 영상정보관리사 영향 0 | Claude Code |
| 2026-04-25 | §8.12 추가 — 운전면허 해설 법령명 자동 「」 래핑(9종 법령 549건/body 311건 변환). lookbehind/lookahead 로 기존 「」 보호. 코드 변경 0건, 재배포 X | Claude Code |
| 2026-04-25 | §8.13 추가 — LawSearchPanel 키 불일치 4건 수정(영상정보관리사 시절부터의 버그). LawLink(자동 링크)는 별개 정상. 검색/상세/229 조문 모두 정상 동작 | Claude Code |
| 2026-04-25 | §8.14 추가 — SettingsTab 카테고리 탭 3 카드 → 단일 활성 아코디언 + 과목 관리 카테고리 드롭다운 필터. AccordionSection 헬퍼 신규 | Claude Code |
| 2026-04-25 | §8.15 추가 — 운전면허 해설 전수 점검(982문항 길이 분포). 빈 3건/짧은 42건/30-59자 123건. 보완 옵션 A~D 제시, 사용자 결정 대기 | Claude Code |
| 2026-04-25 | §11/§12 갱신 — 16 라운드로 표 갱신, 인프라 디지스트 c5b71620, 운영 플래그 DB 기반 전환, Step 4 보류 사유 갱신, 다음 작업 운전면허 후속 + AI 비용 자동화 + 동영상 추출 | Claude Code |
| 2026-04-25 | §8.15/§11.6/§12 갱신 — 운전면허 해설 보완 옵션 D(그대로) 채택. 보류 사유 명시(LawLink 로 법제처 직접 확인 가능) 및 우선순위 ⚪낮음 으로 하향. 1주 워크플랜 재구성 | Claude Code |
