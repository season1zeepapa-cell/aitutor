# Claude Code 핸드오프 지시문 — KISA 드릴 모듈 이식

> **이 문서는 AI TutorTwo 저장소 루트에서 Claude Code를 기동한 뒤 첫 메시지로 복사해 넣기 위한 지시문이다.**
> 마크다운 전체를 그대로 붙여넣어도 되고, 핵심 문단만 복사해도 된다.

---

안녕. 지금부터 AI TutorTwo에 **KISA 진단원 이수시험 드릴 모듈**을 이식한다. 아래 지시를 순서대로 엄격히 따라라.

## 1. 준비된 파일

저장소 루트의 `kisa-module/` 디렉터리에 다음 파일들이 놓여 있다. 먼저 전부 Read 하여 내용을 파악하라.

```
kisa-module/
├── README.md                            ← 본 이식 작업 전체 안내
├── FEATURE_SPEC.md                      ← 기능 사양서 (반드시 정독)
├── INTEGRATION_GUIDE.md                 ← 구현 가드레일·사전 조사 체크리스트
├── HANDOFF_PROMPT.md                    ← (지금 이 문서)
├── migrations/
│   ├── 001_kisa_module.sql              ← 신규 테이블 4개 + 인덱스
│   └── 001_kisa_module_rollback.sql
├── seed.json                            ← 초기 문항 33개
└── report-template.json                 ← 진단보고서 양식
```

## 2. 가장 중요한 원칙

**"기존 서비스 무영향"**이 최우선이다. 다음 중 하나라도 위반하면 즉시 멈추고 BELL에게 보고한다.

- 기존 테이블 스키마 수정 금지 (`categories`, `exams`, `subjects`, `questions`, `question_memos`, `question_bookmarks`, `exam_results`, `question_explanations`, `users`, 기타).
- 기존 API 파일(`api/*.js`) 수정 금지. 신규 `api/kisa-*.js` 파일만 추가.
- 기존 프론트 컴포넌트(`src/tabs/QuizTab/*`, `ManageTab/*`, `ImportTab/*`, `SettingsTab/*`, `pages/*`, `components/Header.jsx`, `components/BottomNav.jsx`, `components/ui/*`) 파일 수정 금지. 단, `BottomNav.jsx`는 **전체 구현이 끝난 후 마지막 단계에서** KISA 탭 링크 한 줄만 추가하되 반드시 BELL의 승인을 받고 수정한다.
- 상태관리 라이브러리 신규 도입 금지(Redux/Zustand 등). React Context + localStorage만 사용.
- 스타일 라이브러리 신규 도입 금지(shadcn/ui, Material 등). Tailwind 전용.
- 새 npm 라이브러리를 추가해야 할 때는 BELL에게 승인 요청 후 설치.

## 3. 실행 순서

### STEP 0 — 문서 숙지
1. `kisa-module/FEATURE_SPEC.md`를 끝까지 읽어라.
2. `kisa-module/INTEGRATION_GUIDE.md`를 끝까지 읽어라.
3. `kisa-module/seed.json`과 `kisa-module/report-template.json` 스키마를 파악하라.
4. `migrations/001_kisa_module.sql`의 테이블 정의를 확인하라.

### STEP 1 — 사전 조사 (코드 변경 금지)
`INTEGRATION_GUIDE.md` §1의 17개 조사 항목을 전부 확인하고, 결과를 마크다운 표로 BELL에게 보고한다. 예시:

```
# KISA 모듈 사전 조사 결과

## 확인한 사실
| # | 항목 | 파일/위치 | 결과 |
|---|---|---|---|
| 1 | package.json 주요 dep | ./package.json | react@18.x, vite@6.0.x, tailwind@3.4, pg@8.11, docx 미설치, prismjs 미설치 |
| 2 | vite config | ./vite.config.js | port 5173, proxy /api → :3000 |
...

## FEATURE_SPEC과의 차이
- (없으면 "없음")

## 신규 설치 필요 라이브러리
| 이름 | 용도 | 대안 | 승인 필요 |
|---|---|---|---|
| docx | 서버 측 DOCX 생성 | 직접 OOXML 생성 불가능 | YES |
| prismjs | 코드 하이라이팅 | highlight.js | YES (경량 쪽 추천) |

## 제안하는 구현 순서 변경
(없으면 "없음")

## 질문
1. ...
```

보고 후 **BELL의 "진행해도 좋다" 명시 승인을 기다린다.** 승인 전에는 파일을 생성·수정하지 않는다.

### STEP 2 — DB 마이그레이션 검토 (SQL 실행은 BELL이 수행)
로컬에서 `psql`로 `migrations/001_kisa_module.sql`을 실행해 테이블이 정상 생성되는지 확인하고, 기존 테이블 row count에 영향이 없음을 검증하라. 운영/스테이징 DB에는 직접 적용하지 말고 BELL이 Supabase SQL Editor로 수동 적용할 수 있도록 문서화만 한다.

### STEP 3 — 백엔드 스켈레톤 (feat 커밋 단위)

커밋 순서:

```
feat(kisa): add kisa-admin handler with seed import
feat(kisa): add kisa-drill and kisa-attempt with deterministic scorer
feat(kisa): add kisa-review with SM-2
feat(kisa): add kisa-exam with timer sessions
feat(kisa): add LLM-assisted grading via existing providers
feat(kisa): add kisa-report handler with DOCX export
```

각 핸들러는 기존 컨벤션(`module.exports = (req, res)`, `withCors`/`withAuth` 래핑, parameterized SQL, 기존 `pg` Pool 재사용) 그대로. 새 pg Pool 생성 금지.

### STEP 4 — 프론트엔드

```
feat(kisa): add KisaTab dashboard and CodeBlock
feat(kisa): add DrillSession with 4-step diagnosis UI
feat(kisa): add MCQ card and ResultOverlay
feat(kisa): add KisaExamMode with timer and autosave
feat(kisa): add ReportBuilder with DOCX download
feat(kisa): add stats dashboard
```

- 모든 신규 파일은 `src/tabs/KisaTab/` 또는 `src/components/CodeBlock.jsx`에만 추가.
- 라우팅은 `App.jsx`에 `/kisa/*` 한 블록만 추가(기존 라우트 손대지 말 것).
- 다크모드는 기존 CSS 변수 그대로 사용.

### STEP 5 — 시드 임포트

`api/kisa-admin.js`의 seed 엔드포인트로 `kisa-module/seed.json`을 POST하여 33문항을 등록한다. 관리자 계정으로만 호출 가능해야 한다.

### STEP 6 — 테스트

`tests/kisa/` 하위에 Playwright 스펙과 Vitest 단위 테스트를 추가한다. `FEATURE_SPEC.md` §12 수용 기준 10개를 전부 통과시켜라. 기존 Playwright 24종 테스트도 전부 통과해야 한다.

### STEP 7 — 문서화

`docs/kisa-module.md` 작성:
- 운영자용 seed 재임포트 절차
- LLM 보조채점 켜고 끄기
- 롤백 방법
- FAQ

`PIPELINE.md`에 "REBUILD13 — KISA 드릴 모듈" 섹션을 추가한다.

### STEP 8 — 네비게이션 노출 (최종, BELL 승인 후)

`src/components/BottomNav.jsx`에 KISA 탭 링크 한 줄을 추가한다. 이 전까지는 `/kisa` 직접 URL로만 접근 가능했으므로 기존 UX에 일절 영향이 없다. 이 커밋만큼은 별도 PR로 분리한다: `feat(nav): expose KISA tab in bottom navigation`.

## 4. 진행 중 질문 처리

- 구현 중 결정이 필요한 사항(예: "CodeBlock에 prismjs와 highlight.js 중 어느 쪽?", "세션 쿠키 이름 변경 필요?")은 **추측 금지**. BELL에게 옵션을 제시해 답을 받고 진행한다.
- 기본값(UTC 저장, 페이지네이션 20, LLM provider=사용자 설정 우선)은 `INTEGRATION_GUIDE.md` §9에 명시된 그대로 사용하며 질문하지 않는다.

## 5. 완료 정의

1. `FEATURE_SPEC.md` 수용 기준 10개 pass.
2. 기존 테스트 24개 pass.
3. 신규 테스트 pass.
4. BELL이 스테이징에서 수동 점검 후 "GO" 승인.
5. `docs/kisa-module.md` 작성 완료.
6. `PIPELINE.md`에 REBUILD13 섹션 추가.

---

## 첫 응답에 포함해야 할 것

이 지시문을 읽자마자 다음 순서로 한 번에 응답하라.

1. "KISA 모듈 이식 작업 착수합니다. 우선 `kisa-module/` 디렉터리의 문서를 전부 읽고 사전 조사를 진행합니다." 한 줄.
2. `kisa-module/FEATURE_SPEC.md`, `kisa-module/INTEGRATION_GUIDE.md`, `kisa-module/seed.json`(상단 100줄 요약), `kisa-module/report-template.json`, `kisa-module/migrations/001_kisa_module.sql` 순차 Read.
3. `INTEGRATION_GUIDE.md` §1 사전 조사 체크리스트 17항목을 실제로 수행하여 표로 보고.
4. BELL의 승인 대기.

이 순서를 건너뛰고 바로 파일을 수정·생성하면 안 된다.

---

**Ready. 시작해라.**
