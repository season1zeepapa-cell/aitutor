# AI TutorTwo 이식 가이드 — KISA 드릴 모듈

> 이 문서는 Claude Code가 **구현 전** 반드시 수행·확인·준수해야 할 사항을 규정한다. `FEATURE_SPEC.md`의 기능 요건과 병행 준수한다.

## 0. 가장 중요한 원칙 — "기존 서비스 무영향"

이 모듈은 AI TutorTwo의 **확장(additive)**이지 **변경(modification)**이 아니다. 다음을 위반하면 즉시 롤백 대상이다.

- 기존 테이블(`categories`, `exams`, `subjects`, `questions`, `question_memos`, `question_bookmarks`, `exam_results`, `question_explanations`, `users`, `email_verifications`, `login_attempts`, `memo_files`) 스키마 변경, 트리거·외래키 추가, RLS 정책 변경 **금지**.
- 기존 API 핸들러 파일의 시그니처·반환 스키마 변경 **금지**. 내부 리팩토링도 이번 작업 범위 밖이다.
- 기존 프론트 컴포넌트(`QuizTab/*`, `ManageTab/*`, `ImportTab/*`, `SettingsTab/*`, `pages/LoginPage`, `components/Header`, `components/BottomNav`, `components/ui/*`) 파일 수정 **금지**. 단, `BottomNav`는 **최종 마지막 단계에서** KISA 탭 링크 한 줄 추가만 허용(이조차도 BELL 승인 후).
- 기존 라우트 경로(`/login`, `/manage`, `/quiz/card`, `/exam-mode`, `/settings`, `/import` 등)와의 충돌 **금지**.
- 기존 환경변수·시크릿을 덮어쓰기 **금지**. KISA 전용 변수는 `KISA_` 접두어 사용.

## 1. 사전 조사 체크리스트 (구현 착수 전 필수)

아래 17개 항목을 확인하고, 결과를 BELL에게 마크다운 표로 보고한 뒤 **명시적 "진행해도 좋다" 승인**을 받고 구현을 시작할 것. 조사 중 FEATURE_SPEC이 가정한 내용과 다른 사실이 발견되면 반드시 보고에 포함한다.

### 1-A. 스택·빌드

1. `package.json`의 `dependencies` 및 `devDependencies` 전체 목록. 특히 `docx`, `prismjs`, `highlight.js`, `react-markdown`, `diff`, `recharts`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `pg` 포함 여부.
2. `vite.config.js`, `tailwind.config.js`, `postcss.config.js` 현재 설정.
3. Node.js 버전(`package.json` engines 또는 `.nvmrc`), npm vs pnpm vs yarn.
4. 테스트 러너(Playwright·Vitest·Jest 중 무엇, 설정 파일 위치).

### 1-B. DB·배포

5. Supabase 연결 방식 실제 파일(`api/db.js` 내용). Pool 옵션·max·timeout.
6. 운영 DB 마이그레이션 관리 방식(수기 SQL·Supabase CLI·Prisma 여부). **기존 방식 그대로 따를 것.**
7. AWS 배포 파이프라인 상세(`Dockerfile`, `lambda.js`, `@codegenie/serverless-express` 버전, CodeBuild 트리거). 신규 `api/kisa-*.js` 파일이 현재 빌드 단계에서 자동 포함되는지.
8. CloudFront·ALB 라우팅 규칙. `/api/kisa-*`가 별도 설정 없이 전달되는지.
9. SSM Parameter Store에서 KISA 전용 신규 파라미터 추가 절차(예: `KISA_LLM_DAILY_LIMIT`).

### 1-C. 인증·권한

10. `middleware.withAuth`, `middleware.withAdmin` 실제 구현 및 `req.user` 구조(필드명: `id` vs `userId`, `admin` vs `is_admin`).
11. JWT 만료/갱신 로직.
12. CORS 화이트리스트 위치 및 `capacitor://` 처리 방식.

### 1-D. 프론트 공통

13. React Router 버전·사용 중인 라우터(`BrowserRouter` vs `HashRouter`) 및 라우팅 정의 위치(`App.jsx`?).
14. 기존 `Header`/`BottomNav`가 라우트를 어떻게 수신하는지. 탭 추가 시 고려할 props.
15. `useSSE`, `useTheme`, `lib/api.js` 시그니처.
16. `components/ui/*` 파일 목록과 재사용 가능한 컴포넌트(Button, Modal, Toast, ImageModal, Card, Skeleton 등).

### 1-E. 기존 업로드 파이프라인

17. `api/upload-sign.js`와 `pool-upload.js`의 S3 presigned URL 패턴. DOCX 업로드에 재사용 가능한지.

## 2. 보고 형식 (조사 후 BELL에게 제출)

```
# KISA 모듈 사전 조사 결과

## 확인한 사실
| # | 항목 | 파일/위치 | 결과 |
|---|---|---|---|
| 1 | package.json 주요 dep | package.json | react@18.x, vite@6, tailwind@3.4, pg@8.x, docx 미설치, prismjs 미설치 ... |
...

## FEATURE_SPEC과의 차이
- [ ] ...
- [ ] ...

## 신규 설치 필요 라이브러리
| 이름 | 용도 | 대안 | BELL 승인 필요 |

## 제안하는 구현 순서 변경
(없으면 "없음")

## 질문
- ...
```

## 3. 준수할 기존 규약

REBUILD1~12 문서에서 확인된 규약. 이 중 위반 시 PR 자동 반려로 간주한다.

1. **API 핸들러**: `module.exports = (req, res) => { ... }` 또는 `module.exports = async (req, res) => ...`. Express와 Vercel serverless 양쪽에서 동작. `withCors → withAuth → (withAdmin?) → 핸들러` 순 래핑.
2. **에러 응답**: 일관된 `{ error: "message" }` + HTTP 상태(`400` client, `401` unauthenticated, `403` unauthorized, `404` not found, `429` rate limit, `500` server, `503` upstream). 스택트레이스 노출 금지.
3. **SQL**: 전부 parameterized(`$1, $2, …`). ORM 금지(유지: 생짜 `pg` Pool).
4. **신규 Pool 금지**: `api/db.js`의 기존 Pool 재사용.
5. **환경변수**: SSM/Env. 코드에 하드코딩 금지. 신규 변수는 `KISA_*` 접두어.
6. **상태관리**: React Context + `localStorage` 외 금지. Redux/Zustand/Recoil 도입 금지. 이미 있는 `AuthContext`·`ToastContext`·`ImageModalContext` 재사용.
7. **스타일**: Tailwind 전용. CSS 변수로 다크모드. 컬러 팔레트 유지.
8. **이름 규칙**: DB 컬럼 snake_case, JS 변수 camelCase. 액션 파라미터 `?action=verb`.
9. **SSE**: `useSSE` 훅 사용. 300s 타임아웃 인지.
10. **CORS 화이트리스트**: 신규 도메인 추가 금지. 기존 목록 그대로.
11. **파일 업로드**: S3 presigned URL 방식 유지. Lambda 직접 multipart 수신 금지.
12. **로그**: `console.log`로 민감 정보(토큰·비밀번호) 출력 금지. 로깅이 필요하면 req.id 같은 식별자만.
13. **React Context 경계**: 신규 Context는 `/kisa` 라우트 하위에서만 Provider 마운트. 전역 Provider 추가 금지.
14. **Playwright 테스트**: 기존 24종 테스트가 전부 pass하는 상태를 깨뜨리지 않아야 한다.

## 4. 파일·폴더 규칙

신규 파일만 아래 위치에 추가한다.

```
api/
  kisa-admin.js
  kisa-attempt.js
  kisa-drill.js
  kisa-exam.js
  kisa-report.js
  kisa-review.js
  _kisa/
    scorer.js          (서버측 결정론적 채점)
    srs.js             (SM-2)
    reportDocx.js      (DOCX 생성)
    llmGrader.js       (LLM 보조 채점, gemini/openai/claude 재사용)

src/
  tabs/KisaTab/...
  components/CodeBlock.jsx          (공통 — KISA 외에는 사용 안 함)
  hooks/useKisaSrs.js
  lib/kisaScorer.js                 (클라 미리보기 채점)

migrations/
  001_kisa_module.sql

docs/
  kisa-module.md                    (간단 운영 가이드)

tests/
  kisa/
    drill.spec.js
    attempt.spec.js
    srs.spec.js
    report.spec.js
    regression-existing.spec.js     (기존 핵심 경로 회귀)

kisa-seed/
  seed.json
  report-template.json
```

## 5. DB 마이그레이션 절차

1. 로컬 DB에서 `migrations/001_kisa_module.sql` 적용 → `psql \d kisa_questions` 등으로 테이블·인덱스 확인.
2. 기존 테이블 row count 스냅샷 저장(예: `select 'categories' as t, count(*) from categories union all ...`). 마이그레이션 후 동일해야 함.
3. 스테이징/운영은 BELL이 수기로 Supabase SQL Editor에서 실행. Claude Code는 **SQL을 실행하지 말 것**. 코드에 SQL 문자열만 커밋.
4. 롤백 SQL을 `migrations/001_kisa_module_rollback.sql`로 함께 제공한다(신규 테이블 DROP + INDEX DROP).

## 6. 커밋 전략 (Conventional Commits)

순차 머지될 수 있도록 기능 단위 작은 커밋.

```
feat(kisa): add migration 001 for kisa_* tables
feat(kisa): add kisa-admin handler + seed endpoint
feat(kisa): add kisa-drill and kisa-attempt handlers
feat(kisa): add KisaTab dashboard + DrillSession + CodeBlock
feat(kisa): add deterministic scorer
feat(kisa): add SM-2 spaced repetition
feat(kisa): add KisaExamMode timer
feat(kisa): add LLM-assisted grading
feat(kisa): add ReportBuilder + DOCX export
feat(kisa): add stats dashboard
test(kisa): add playwright + vitest coverage
chore(kisa): add docs and seed import guide
feat(nav): add KISA tab to BottomNav  ← 최종 단계, BELL 승인 후
```

브랜치 명: `feat/kisa-module`. main 직접 푸시 금지, PR로 리뷰 후 머지.

## 7. 테스트 전략

- **단위**: `lib/kisaScorer.js`와 `_kisa/srs.js`는 Vitest로 테이블 드리븐 테스트. 모든 분기(again/hard/good/easy × repetitions 0–5) 커버.
- **통합**: Express 테스트 서버 띄워 `supertest`로 핸들러 호출(기존 패턴 있으면 그대로 따름).
- **E2E**: Playwright 신규 스펙.
  - `regression-existing.spec.js`: 로그인 → 기존 `/quiz/card` 문항 풀이 → 메모 저장 → 북마크 → 로그아웃이 모두 통과.
  - `drill.spec.js`: 로그인 → `/kisa/drill?type=diagnosis` → 모범답안 대로 입력 → `auto_score=100`.
  - `srs.spec.js`: 'again' 제출 → `kisa-review?action=queue` 응답에 해당 문항 포함.
  - `report.spec.js`: 보고서 작성 → DOCX 다운로드 URL 200 OK.
- **성능**: `/api/kisa-drill?action=next` p95 < 500ms(지역 리전 기준). 문항 100개 상태에서 측정.

## 8. 롤백·장애 대응

- 신규 기능에 심각한 버그 발생 시 `BottomNav`의 KISA 탭 링크만 제거하면 기존 UX에 영향 없이 숨겨짐. DB 마이그레이션은 그대로 두어도 무방.
- DB 자체를 되돌리고 싶으면 `001_kisa_module_rollback.sql` 실행.

## 9. 질문이 필요한 경우 처리

Claude Code가 구현 중 결정이 필요한 상황을 만나면 **코드를 추측으로 진행하지 말고** BELL에게 옵션을 제시해 선택받는다. 단, 아래 기본값은 질문 없이 적용:

- 시간은 UTC로 저장, 표시 시 Asia/Seoul로 변환.
- 페이지네이션 기본 20, 상한 100.
- 언어 필터 기본: 전체.
- SRS 미설정 사용자 기본값: ease_factor=2.5, interval=0.
- 기본 LLM provider: 사용자 설정에 `preferred_llm`이 있으면 그것, 없으면 `gemini`.

## 10. 완료 정의 (Definition of Done)

1. `FEATURE_SPEC.md` 수용 기준 10개 전부 pass.
2. 기존 24개 Playwright 테스트 pass.
3. 신규 Playwright·Vitest 테스트 작성 및 pass.
4. 기존 주요 경로 회귀 테스트 pass.
5. `docs/kisa-module.md` 운영 가이드 작성.
6. BELL이 스테이징에서 수동 점검 후 승인.
7. CHANGELOG 또는 PIPELINE.md에 REBUILD13 섹션 추가.

---

**이 가이드와 FEATURE_SPEC을 전부 읽고 §1 체크리스트 결과를 먼저 보고하라. 그 전에는 어떤 파일도 생성하거나 수정하지 마라.**
