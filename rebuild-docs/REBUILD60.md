# REBUILD60 — 약점 항목별 학습 메모 기능 (question_memos chapter_code 확장)

> **작성**: 2026-06-26 KST
> **트리거**: 사용자 요청 — 이론학습(약점 학습 화면)에서 기출문제 메모처럼 **약점 항목별 메모**(첨부파일 포함)를 남기고 싶다.
> **결과**: 기존 기출문제 메모 인프라(`question_memos` + `MemoPanel`)를 **약점 코드(chapter_code) 기준**으로 확장 재사용. 저장 방식은 사용자 선택대로 **DB(Supabase)**.

---

## §0. 결론 요약

| 작업 | 파일 | 결과 |
|------|------|------|
| DB 스키마 확장 | `scripts/migrate-chapter-memos.cjs` | `question_memos`에 `chapter_code TEXT` 추가, `question_id` nullable, 인덱스 |
| API 분기 | `api/memos.js` | list/save 가 `question_id` 또는 `chapter_code` 지원 |
| 컴포넌트 범용화 | `src/tabs/QuizTab/MemoPanel.jsx` | `chapterCode` prop 추가(기존 `questionId`와 양립) |
| 학습 화면 통합 | `src/tabs/KisaTab/StudyDetail.jsx` | "📝 메모" 섹션 추가(`<MemoPanel chapterCode={chapterCode} />`) |

---

## §1. 배경

- 기출문제(`QuizCard`)에는 이미 메모 기능이 있음: `MemoPanel`(메모 CRUD + 첨부파일) + `api/memos.js`(`question_memos` 테이블) + `api/memo-files.js`.
- 약점 학습 화면(`/kisa/study/:chapterCode`, `StudyDetail`)에는 메모가 없었음. 사용자가 동일 UI(메모 입력+첨부+추가, 빈 상태 "메모가 없습니다")를 약점별로 원함.
- 약점 식별자는 `IMP-IV-01` 같은 **문자열**인데 `question_memos.question_id`는 questions(기출) **정수 FK NOT NULL** → 그대로는 불가.

## §2. DB 스키마 확장 (`migrate-chapter-memos.cjs`)

```sql
ALTER TABLE question_memos ADD COLUMN IF NOT EXISTS chapter_code TEXT;
ALTER TABLE question_memos ALTER COLUMN question_id DROP NOT NULL;  -- 약점 메모는 question_id 없음
CREATE INDEX IF NOT EXISTS idx_question_memos_chapter ON question_memos(chapter_code);
```

- 운영 Supabase에 직접 실행 완료(2026-06-26). 한 메모 row 는 `question_id`(기출) 또는 `chapter_code`(약점) 중 하나로 귀속.
- 첨부파일(`memo-files`)은 `memo_id`(=question_memos.id) FK 기반이라 **무변경으로 약점 메모에도 그대로 동작**.

## §3. API (`api/memos.js`)

- `action=list`: `chapter_code` 쿼리 있으면 `WHERE chapter_code=$1`, 없으면 기존 `question_id` 경로.
- `action=save`: body 에 `chapter_code` 있으면 `INSERT (chapter_code, content)`, 없으면 기존 `question_id`. `content` 만 필수로 완화.
- `update`/`delete`/`counts` 는 변경 없음(id·question_id 기반).

## §4. 컴포넌트 (`MemoPanel`, `StudyDetail`)

- `MemoPanel({ questionId, chapterCode })` — `chapterCode` 우선. list URL·save key 를 식별자에 따라 분기(`encodeURIComponent`로 한글/특수문자 안전).
- `StudyDetail` — 참조 자료 다음에 `<Section title="📝 메모"><MemoPanel chapterCode={chapterCode} /></Section>`. `ToastProvider`(App 전역)·기존 컴포넌트 재사용으로 위험 최소.

## §5. 검증

- 빌드 `build:fe` 에러 0 ✅
- 운영 Supabase 에 `chapter_code` 메모 INSERT/SELECT/DELETE 동작 확인 ✅
- 화면: 로컬은 `kisa-study` API 가 서버 쿠키 인증을 요구해 StudyDetail 직접 확인 불가 → **배포 후 로그인 상태에서 확인**. MemoPanel 은 기출에서 검증된 컴포넌트 재사용.

## §6. 남은 작업

- 약점 학습 목록에 메모 개수 배지(원하면 `counts`에 chapter_code 일괄 조회 추가).
- jssec2023 약점(번들, DB 없음)도 학습 상세를 지원하면 거기에도 메모 노출 가능.
