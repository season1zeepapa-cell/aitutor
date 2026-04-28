# KISA 진단원 이수시험 드릴 모듈 — 기능 사양서 (FEATURE_SPEC)

본 문서는 기존 **AI TutorTwo** 앱에 추가할 **KISA 2025 소프트웨어 보안약점 진단원 이수시험** 학습 모듈의 제품 사양이다. 구현 전 반드시 `INTEGRATION_GUIDE.md`를 먼저 읽고 조사 체크리스트를 수행할 것.

## 1. 제품 목표

사용자가 KISA 이수시험(이론 30문항 60분 + 실기 15문항 100분, 합격 종합 70점)에 합격할 수 있도록, 47개 SW 보안약점에 대한 반복 드릴·스페이스드 리피티션·실전 모의고사·진단보고서 작성 훈련을 제공하는 학습 모듈이다.

## 2. 기본 원칙 (반드시 준수)

1. **기존 서비스 무영향**: 기존 `categories`, `exams`, `subjects`, `questions`, `question_memos`, `question_bookmarks`, `exam_results`, `question_explanations` 테이블은 **읽기만** 가능. 스키마 변경·컬럼 추가·트리거 추가 **금지**.
2. **독립 모듈**: 모든 신규 기능은 `kisa_` 접두어 테이블·`/kisa/*` 라우트·`api/kisa-*.js` 핸들러·`src/tabs/KisaTab/` 폴더에 격리.
3. **기존 공통 자산 재사용**: `Header`, `BottomNav`, `ui/*`, `hooks/useTheme`, `hooks/useSSE`, `lib/api.js`, `middleware.withAuth`, `middleware.withAdmin`, `middleware.withCors`, S3 presigned 업로드 유틸, 3종 LLM 스트리밍 핸들러(`api/gemini.js`, `api/openai.js`, `api/claude.js`).
4. **상태관리 규칙 준수**: React Context + `localStorage`만 사용. Redux/Zustand/Recoil 도입 금지.
5. **스타일 규칙 준수**: Tailwind 전용. shadcn/ui·Material·Bootstrap 도입 금지. 기존 CSS 변수(다크모드)와 Quizlet purple(#4255ff) 계열 유지.

## 3. 사용자 스토리

### US-1. 이론 드릴
> KISA 이수자로서, 객관식 문항 30개를 카테고리·언어·난이도로 필터링해 반복 풀이하고 즉시 정답·해설을 확인하고 싶다.

### US-2. 실기(진단) 드릴
> 나는 코드 스니펫을 보고 ①취약 여부(Y/N) ②취약 라인 ③근거 ④수정 코드 또는 방안 4단계로 답을 작성하고, 시스템이 모범답안·필수 키워드와 대조해 자가채점 결과를 주기를 원한다.

### US-3. 스페이스드 리피티션
> 틀린 문항·자가평가 낮은 문항은 1·3·7·15·30일 간격으로 자동 재출제되어야 한다.

### US-4. 실전 모의
> 이론 30문항 60분 / 실기 15문항 100분 타이머가 있는 모의시험을 선택해 실제 시험 환경처럼 연습하고 싶다.

### US-5. 진단보고서 작성
> 실기 문항을 풀고 나면 KISA 안내서 붙임2 양식(보안약점·보안요구사항·현황 및 문제점·해결방안·관련 산출물·증적자료·개선방안·이행담당자·보완조치내역)으로 **DOCX 내보내기**가 가능해야 한다.

### US-6. 진도·약점 통계
> 약점 분류별 정답률, 주간 문항 수, 자주 틀리는 TOP 5, 다음 복습 예정 문항 수를 대시보드로 보고 싶다.

### US-7. LLM 보조 해설·채점
> 기존 Gemini/OpenAI/Claude 중 하나를 선택해 ①문항별 추가 해설 생성 ②내가 쓴 서술 답안을 평가받을 수 있어야 한다.

## 4. 논리 데이터 모델 (스택 무관)

> 물리 스키마는 `migrations/001_kisa_module.sql` 참조. 본 섹션은 논리적 관점만 기술.

### 4.1 Entity: `KisaQuestion`
| 필드 | 타입 | 설명 |
|---|---|---|
| id | UUID | PK |
| question_type | enum('mcq','diagnosis4') | 이론/실기 구분 |
| weakness_category | enum(7대분류) | 입력검증/보안기능/시간·상태/에러처리/코드오류/캡슐화/API오용 |
| weakness_code | string | KISA 약점 ID (예: `SR-020301`) 또는 내부 ID |
| weakness_name_ko | string | 약점 한글명 (예: "SQL 삽입") |
| language | enum('java','python','javascript','mobile','etc') | 언어 필터 |
| difficulty | enum('하','중','상') | 난이도 |
| body | text | 문제 본문(마크다운) |
| vulnerable_code | text | 제시 코드 전문(라인 번호 포함된 원문) |
| code_language | string | 하이라이팅용 언어 키 |
| choices | jsonb (nullable) | MCQ 선택지 `[{num,text}]` |
| answer_index | int (nullable) | MCQ 정답 (0-based) |
| vulnerable_lines | int[] | 취약 라인 번호 배열 |
| rationale_keywords | text[] | 서술형 필수 키워드 |
| fix_keywords | text[] | 수정 방안 필수 키워드 |
| safe_code | text | 안전한 코드 전문 |
| model_answer | jsonb | `{rationale, fix_description, report_fields}` |
| reference | string | 참고 가이드 문서·절 번호 |
| tags | text[] | 자유 태그 |
| created_at, updated_at | timestamp | |

### 4.2 Entity: `KisaAttempt` (사용자별 풀이 기록)
| 필드 | 설명 |
|---|---|
| id (UUID PK), user_id (FK users.id), question_id (FK kisa_questions.id) |
| mode | enum('drill','exam','review') |
| mcq_selected | int (nullable) |
| verdict_yn | boolean (nullable) |
| cited_lines | int[] |
| rationale_text | text |
| fix_text | text |
| fix_code | text |
| auto_score | int 0-100 |
| keyword_hits | jsonb `{rationale:[matched], fix:[matched]}` |
| llm_score | int (nullable) 0-100 |
| llm_feedback | text (nullable) |
| self_grade | enum('again','hard','good','easy') |
| time_spent_sec | int |
| submitted_at | timestamp |

### 4.3 Entity: `KisaReview` (SM-2 SRS 큐)
| 필드 | 설명 |
|---|---|
| user_id + question_id = 복합 PK |
| ease_factor | float default 2.5 |
| interval_days | int default 0 |
| repetitions | int default 0 |
| next_review_at | timestamp |
| last_reviewed_at | timestamp |
| suspended | boolean default false |

### 4.4 Entity: `KisaReport` (진단보고서 저장)
| 필드 | 설명 |
|---|---|
| id, user_id, question_id (nullable — 자유작성도 허용) |
| template_type | enum('simple','composite') |
| payload | jsonb — 보고서 양식 필드 |
| docx_s3_key | string (nullable) |
| created_at |

### 4.5 Entity: `KisaExamSession` (모의고사 세션)
| 필드 | 설명 |
|---|---|
| id, user_id, type enum('theory60','practical100','full3h') |
| started_at, ended_at, total_score, theory_score, practical_score |
| state | enum('in_progress','submitted','expired') |
| answers | jsonb — 문항별 응답 스냅샷 |

## 5. UI 화면 및 라우팅

기존 BottomNav에 **5번째 탭 "KISA"** 추가(권장). 또는 Settings → "학습 모듈" 섹션에서 KISA를 activate하면 나타나는 옵션 탭으로도 가능. 다음 라우트를 구현한다.

- `/kisa` — 대시보드(진도·복습 예정·약점별 정답률·시작 버튼 3개: 드릴/실전모의/보고서작성)
- `/kisa/drill?type=mcq|diagnosis&category=&language=&difficulty=&srs=true|false` — 드릴 세션
- `/kisa/exam?mode=theory60|practical100|full3h` — 실전 타이머 모의고사
- `/kisa/report/new?questionId=` — 진단보고서 빌더
- `/kisa/report/list` — 내 보고서 목록
- `/kisa/stats` — 상세 통계
- `/kisa/admin/questions` — (admin 전용) KISA 문항 CRUD

### 5.1 DrillSession 화면 (핵심)

상단: 진행률(3/10), 남은 시간(선택), 약점 한글명 배지, 언어 배지, 난이도 배지.
본문(좌/우 분할, 모바일은 상/하):
- **좌**: 문제 본문 + `<CodeBlock>` 컴포넌트(라인 번호 + 신택스 하이라이팅, Prism.js 또는 highlight.js 중 번들 가장 가벼운 것). 라인 클릭 시 `cited_lines`에 토글 추가(실기만).
- **우(실기 diagnosis4)**: 4단계 입력 폼
  1. 취약 여부: Y/N 토글
  2. 취약 라인: 좌측 코드 클릭으로 자동 채워지되 수기 입력도 허용 (예: "7, 9")
  3. 근거 서술: `<textarea>` + 실시간 필수 키워드 힌트(익명화: "핵심 키워드 3개 중 1개 포함" 식의 카운터, 실제 키워드는 숨김)
  4. 수정 방안: 탭 전환 `[서술]/[코드]`. 코드 탭은 `<CodeEditor>`(CodeMirror 6 또는 단순 `<textarea>` + monospace).
- **우(이론 mcq)**: 라디오 선택지.

제출 시 `POST /api/kisa-attempt`로 전송 → 결과 오버레이(자가채점 점수 + 모범답안 + 필수 키워드 체크리스트 + 안전한 코드 diff 뷰) 표시 → `[다시] [어려움] [괜찮음] [쉬움]` 4개 버튼으로 self_grade 입력 → 다음 문항.

### 5.2 ExamMode 화면

기존 `ExamMode.jsx`는 건드리지 않음. 별도 `KisaExamMode.jsx` 신규. 100분 실기 모드의 제출·자동저장 주기(30초) 구현. 네트워크 단절 시 로컬스토리지 draft 복구.

### 5.3 ReportBuilder 화면

`report-template.json`을 읽어 동적으로 폼 생성. 필수 필드 미기입·필수 키워드 3요소(무엇을/어떻게/어느 위치) 미포함 시 제출 버튼 disabled + 툴팁 안내. 제출 시:
1. `POST /api/kisa-report` (payload 저장)
2. 서버에서 `docx` npm 라이브러리로 DOCX 생성
3. S3 업로드 후 presigned URL 반환 → 다운로드 트리거

### 5.4 Stats 화면

recharts 재사용(이미 번들에 있는지 조사 필요, 없으면 경량 SVG 직접 그림). 차트 3종:
- 7대분류별 누적 정답률(bar)
- 주간 학습 문항 수(line)
- 복습 예정 히트맵(캘린더, 없으면 단순 막대)

## 6. 4단계 답안 자동채점 알고리즘

실기 diagnosis4 전용. 결정론적 `keyword score` + 선택적 `llm score`의 가중 평균.

### 6.1 결정론적 채점 (auto_score, 0–100)

```
verdictPoints   = 20 if verdict_yn == model_answer.verdict else 0
linePoints      = 20 * |intersection(cited_lines, vulnerable_lines)| / |vulnerable_lines|
rationalePoints = 30 * hits(rationale_text, rationale_keywords) / len(rationale_keywords)
fixPoints       = 30 * hits(fix_text ∥ fix_code, fix_keywords) / len(fix_keywords)

auto_score = round(verdictPoints + linePoints + rationalePoints + fixPoints)
```

`hits(text, keywords)`는 대소문자 무시 + 공백/전각반각 정규화 + 각 키워드가 원형 또는 지정된 유의어(모델답안 `synonyms` 필드) 중 하나라도 포함되면 1 카운트.

### 6.2 LLM 보조 채점 (선택, `llm_score`)

사용자가 설정에서 "LLM 보조채점 활성화"를 켠 경우에만 호출. 모델/프로바이더는 사용자 기본값 사용. 프롬프트(한국어, system):

```
너는 KISA 소프트웨어 보안약점 진단원 이수시험 채점관이다.
아래 [모범답안]과 [응시자답안]을 비교하여 0~100점을 매기고 JSON으로만 응답하라.
채점 기준: ①취약여부 정확성 20 ②라인 지목 정확성 20 ③근거의 기술적 타당성 30 ④수정방안의 구체성 30.
필수 키워드 누락은 감점. 과한 서술은 감점하지 않음.
출력: {"score": int, "strengths": string[], "weaknesses": string[], "missing_keywords": string[]}
```

서버는 응답을 파싱해 `llm_score`, `llm_feedback`에 저장한다. 타임아웃 20초, 실패 시 `auto_score`만 표시.

### 6.3 최종 표시 점수

- LLM 비활성: `auto_score`
- LLM 활성: `round(auto_score * 0.4 + llm_score * 0.6)`

## 7. 스페이스드 리피티션 (SM-2 경량판)

제출 시 `self_grade`에 따라 `kisa_review` 업데이트:

```
again → repetitions=0, interval=1, ease=max(1.3, ease-0.2), next = now+1d
hard  → repetitions+=1, interval=max(1, round(interval*1.2)), ease=max(1.3, ease-0.15), next=now+interval d
good  → repetitions+=1, interval = repetitions==1 ? 1 : repetitions==2 ? 3 : round(interval*ease),
        ease unchanged, next=now+interval d
easy  → repetitions+=1, interval = round(interval*ease*1.3), ease=ease+0.15, next=now+interval d
```

드릴 필터에 `srs=true` 지정 시 `next_review_at <= now()` 문항만 출제. 없으면 신규 미학습 문항.

## 8. 채점 스니펫 샘플 UX

결과 오버레이는 다음 구조로 렌더:

```
[자가채점 82점]   [LLM 평가 78점]   [종합 80점]
▌취약 여부       ✅ 정확
▌라인 지목       ⚠ 부분 정답 (맞춘 라인 2/3)
▌근거            ✅ 필수 키워드 3/3 포함
▌수정 방안       ⚠ 필수 키워드 2/3 포함 (누락: "PreparedStatement")
[모범답안 보기] [안전한 코드 보기] [DIFF]
[다시] [어려움] [괜찮음] [쉬움]
```

## 9. API 엔드포인트 (신규)

모두 `withCors` + `withAuth` 적용. admin 전용은 `withAdmin`.

| Method | Path | 설명 |
|---|---|---|
| GET  | `/api/kisa-drill?action=next` | 다음 문항(필터 쿼리 반영) |
| POST | `/api/kisa-attempt` | 답안 제출 + 채점 |
| POST | `/api/kisa-attempt?action=llm-grade` | LLM 보조채점 (별도 호출) |
| GET  | `/api/kisa-review?action=queue` | 복습 예정 목록 |
| GET  | `/api/kisa-review?action=stats` | 약점별 통계 |
| GET  | `/api/kisa-exam?action=start&mode=` | 세션 시작 |
| POST | `/api/kisa-exam?action=submit` | 세션 제출 |
| POST | `/api/kisa-report` | 보고서 저장 + DOCX 생성 |
| GET  | `/api/kisa-report?action=list` | 내 보고서 |
| GET  | `/api/kisa-report?action=download&id=` | DOCX presigned URL |
| GET  | `/api/kisa-admin?action=list` | (admin) KISA 문항 목록 |
| POST | `/api/kisa-admin?action=upsert` | (admin) 생성/수정 |
| POST | `/api/kisa-admin?action=seed` | (admin) `seed.json` 일괄 임포트 |
| DELETE | `/api/kisa-admin?action=delete` | (admin) 삭제 |

기존 handler 패턴(`module.exports = (req, res) => {}` + `withCors`/`withAuth` 래핑) 그대로 따를 것.

## 10. 신규 프론트 컴포넌트

- `src/tabs/KisaTab/index.jsx` (라우팅 허브)
- `src/tabs/KisaTab/Dashboard.jsx`
- `src/tabs/KisaTab/DrillSession.jsx`
- `src/tabs/KisaTab/DiagnosisCard.jsx`
- `src/tabs/KisaTab/McqCard.jsx`
- `src/tabs/KisaTab/ResultOverlay.jsx`
- `src/tabs/KisaTab/KisaExamMode.jsx`
- `src/tabs/KisaTab/ReportBuilder.jsx`
- `src/tabs/KisaTab/ReportList.jsx`
- `src/tabs/KisaTab/Stats.jsx`
- `src/tabs/KisaTab/AdminQuestions.jsx`
- `src/components/CodeBlock.jsx` (공통 — 라인 넘버, 라인 클릭 이벤트)
- `src/hooks/useKisaSrs.js`
- `src/lib/kisaScorer.js` (결정론적 채점 클라 미리보기용)

## 11. 도입할 외부 라이브러리 (필요 시 사용자 승인 후)

- `docx` (npm) — 서버 DOCX 생성. Apache-2.0. 번들 대상 아님.
- `prismjs` 또는 `highlight.js` — 클라이언트 신택스 하이라이팅 중 기존에 사용 중인 것 있으면 그대로. 없으면 `prismjs` 권장.
- `diff` (npm) — 안전 코드 DIFF 뷰.

**추가 리스트에 없는 라이브러리를 Claude Code가 도입하려 할 경우, 먼저 BELL에게 승인 요청할 것.**

## 12. 수용 기준 (Testable)

반드시 `tests/kisa/*.spec.js` 밑에 Playwright E2E + Vitest 단위 테스트 작성.

1. `seed.json` 30문항이 `kisa-admin?action=seed` 호출로 모두 등록되고 `kisa_questions` count == 30.
2. 비로그인 사용자가 `/kisa/*` 접근 시 로그인 페이지로 리다이렉트.
3. `/kisa/drill` 에서 MCQ 문항 정답 선택 시 `auto_score == 100` 응답.
4. diagnosis4 문항에서 모범답안과 동일한 답안을 모두 제출하면 `auto_score == 100`.
5. `verdict_yn` 반대 선택·라인 미지목·근거·수정 모두 공란 제출 시 `auto_score == 0`.
6. `self_grade='again'` 제출 시 `kisa_review.interval_days == 1` 로 갱신.
7. `kisa_exam?mode=theory60` 시작 시 30분 경과 후 `time_left` 응답이 남은 시간 반영.
8. 보고서 생성 시 S3에 DOCX가 업로드되고 presigned URL로 정상 다운로드.
9. 기존 `/quiz/card`, `/manage`, `/settings` 경로가 모든 기능에서 **정상 동작**(회귀 없음).
10. 기존 `questions`, `exams`, `categories` 테이블 row count가 마이그레이션 전후 동일.

## 13. 단계별 구현 순서 (Claude Code 권장 흐름)

각 단계 완료 시 커밋 + 테스트 통과 확인 후 다음 단계 진행.

1. `INTEGRATION_GUIDE.md` 조사 체크리스트 수행 후 BELL에게 조사 결과 보고·승인 대기.
2. `migrations/001_kisa_module.sql` 적용 (운영 DB는 수기, 로컬·스테이징은 자동). **기존 테이블 영향 없음 재검증**.
3. `api/kisa-admin.js` + `seed.json` 임포트. 관리자 로그인으로 seed 호출해 30문항 등록.
4. `api/kisa-drill.js` + `api/kisa-attempt.js` + 결정론적 채점(`lib/kisaScorer.js`).
5. `KisaTab/Dashboard` + `DrillSession` + `CodeBlock` + `McqCard` + `DiagnosisCard` + `ResultOverlay`.
6. SM-2 SRS(`api/kisa-review.js` + `useKisaSrs`).
7. `api/kisa-exam.js` + `KisaExamMode`.
8. LLM 보조 채점 (기존 `api/gemini.js` 등을 재사용한 내부 호출).
9. `report-template.json` + `ReportBuilder` + `api/kisa-report.js`(DOCX 생성 + S3).
10. `Stats` 대시보드.
11. 문서화(`docs/kisa-module.md` 또는 `PIPELINE.md` 내 섹션 추가).
12. 회귀 테스트 24종 전부 pass 확인 + 신규 kisa 테스트 작성.
13. BottomNav에 KISA 탭 추가(최종). 이 전까지는 `/kisa` 직접 URL로만 접근 가능하도록 해 기존 UX에 티끌도 영향 주지 않음.

## 14. 위험 및 대응

- **Supabase 풀 연결 초과**: `kisa-*` 핸들러에서 pg Pool 인스턴스 재사용. 신규 Pool 생성 금지.
- **Lambda 6MB 응답 한도**: 문항 목록 API는 페이지네이션 기본 limit=20 상한 100.
- **DOCX 생성 시간**: 동기 생성 시 Lambda 타임아웃 가능. 복잡 보고서는 100KB 이하 유지.
- **LLM 비용 폭주**: 사용자당 LLM 채점 호출 1일 50회 rate limit.

## 15. 비목표 (Out of Scope)

- 기존 app의 UX 개선·리팩토링.
- Anki export.
- 협업/공유 기능.
- 오프라인 모드(별도 프로젝트).
- i18n.
