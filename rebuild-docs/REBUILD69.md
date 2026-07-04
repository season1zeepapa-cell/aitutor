# REBUILD69 — 코드식별 퀴즈 DB 정규 문항 승격 (SRS·오답노트 편입)

> **작성**: 2026-07-02 KST
> **범위**: `kisa-module/migrations/006_kisa_codeid_type.sql`(+rollback, 신규), `scripts/build-kisa-codeid-seed.mjs`·`scripts/kisa-seed-codeid.mjs`(신규), `kisa-module/seed/codeid/codeid.seed.json`(신규), `src/tabs/KisaTab/CodeidCard.jsx`·`src/components/QuestionTypes/results/CodeidResult.jsx`·`src/components/QuestionTypes/exam/CodeidExamBody.jsx`(신규), `src/components/QuestionTypes/registry.js`, `api/_kisa/scorer.js`, `api/kisa-attempt.js`, `api/kisa-drill.js`, `api/kisa-review.js`, `src/tabs/KisaTab/WrongNotes.jsx`, `src/tabs/KisaTab/DrillSession.jsx`, `src/tabs/KisaTab/Dashboard.jsx`
> **목적**: REBUILD68의 클라이언트 전용 코드식별 퀴즈(303문항)를 **DB 정규 문항유형 `codeid`로 승격**하여 실기 드릴(diagnosis4)처럼 **자동채점·SRS 복습큐·오답노트**에 편입한다.

---

## §1. 배경

REBUILD68은 코드식별 퀴즈를 `CodeQuiz.jsx`(정적 JSON 직참조, DB/API 무연동)로 구현했다. 요청: **실기 드릴처럼 SRS·오답노트에 편입**. → 층위 A(DB `kisa_questions` 정규 문항)로 승격.

## §2. 설계 원칙 — 기존 컬럼 재사용(신규 컬럼 0)

`codeid`는 진단(diagnosis4)/객관식(mcq) 컬럼을 재활용해 스키마 변경을 최소화:

| 데이터 | 저장 컬럼 |
|---|---|
| 코드 | `vulnerable_code` |
| 하이라이팅 언어 | `code_language`(csharp/c 등 정밀) |
| DB 언어 enum | `language`(java/python/javascript/kotlin/swift/**etc**) — csharp/c는 `etc` |
| 4개 약점 보기 | `choices` JSONB `[{num,text,wid}]` |
| 정답 약점 | `answer_index` |
| 정답 안전여부 | `model_answer.is_safe`(JSONB) |
| 해설(평문) | `explanation` |
| 고유 시드키 | `chapter_code` = `CQ-XXXX` |
| 약점 코드(이론 연계) | `weakness_code` = `IMP-XX` |
| 사용자답 | `mcq_selected`(약점), `verdict_yn`(취약=true) — 기존 attempt 컬럼 |

## §3. 마이그레이션 006

- `question_type` CHECK에 `'codeid'` 추가(005 패턴). 신규 컬럼 없음.
- codeid 전용 부분 인덱스 `idx_kisa_questions_codeid_chapter (chapter_code) WHERE question_type='codeid'`.
- 롤백: codeid 행 삭제 + CHECK 원복. **운영 Supabase 적용 완료**(CHECK 갱신 확인).

## §4. 시드 파이프라인 (303문항)

- `build-kisa-codeid-seed.mjs`: `src/data/kisa-code-quiz.json` → `kisa-module/seed/codeid/codeid.seed.json`. 한글 분류→`weakness_category` enum 매핑, 마크다운 해설→평문(ResultOverlay는 pre-wrap 평문 렌더), `language`는 enum·`code_language`는 정밀 토큰 분리.
- `kisa-seed-codeid.mjs`(전용 적재): 기존 `kisa-seed-import.js`는 `(weakness_code+language+difficulty)` UPSERT라 한 약점당 다문항인 codeid를 덮어씀 → **`chapter_code(CQ-XXXX)` 기준 UPSERT** 전용 스크립트. 멱등.
- 적용 결과: **codeid 303문항 적재 완료**(운영 DB). 채점 검증: 둘 다 정답 100 / 약점만 50 / 오답 0.
- ⚠️ 함정 기록: `kisa_questions_language_check`(java/python/javascript/kotlin/swift/etc)로 인해 csharp/c가 1차 실패 → `language`를 enum(`etc`)으로 매핑해 해결.

## §5. 채점·연동 (백엔드)

- `scorer.js`: `scoreCodeid` — 약점(50: `mcq_selected===answer_index`) + 안전여부(50: `verdict_yn===!model_answer.is_safe`), 합산 0/50/100. `scoreAttempt` 분기 + export 추가.
- `kisa-attempt.js`: 채점 후 응답에 codeid 정답 공개(`answer_index`/`user_selected`/`is_safe_answer`/`user_verdict_yn`/`choices`) 추가. body는 이미 `mcq_selected`/`verdict_yn` 수용.
- `kisa-drill.js`: `ALLOWED_TYPES`에 `codeid` 추가. `publicQuestion`은 choices·vulnerable_code 노출/정답 숨김이라 무수정.
- `kisa-review.js`(오답노트 쿼리): SELECT에 `model_answer`·`vulnerable_code`·`code_language` 추가(정답 안전여부 표시용).

## §6. 렌더 (프론트, registry 기반)

- 신규 컴포넌트 3종: `CodeidCard`(드릴 풀이 — 코드+2단 정답), `CodeidResult`(+`CodeidHeaderExtra` — 약점·안전여부 O/X), `CodeidExamBody`(시험 제어형).
- `registry.js`: `codeid` 등록(label '코드식별', icon 💻, `showLlmGrade:false`, `hasAnswer: mcq_selected+verdict_yn 존재`). → DrillSession/ExamMode/ResultOverlay 자동 분기.
- `DrillSession.jsx`: 자가평가(self_grade) 재전송 시 codeid는 `mcq_selected+verdict_yn` 둘 다 재전송(재채점 점수 보존).
- `WrongNotes.jsx`: `renderUserAnswer`·`correctAnswerText`에 codeid 분기(내 답/정답 약점·안전여부 표시).
- `Dashboard.jsx`: "코드 약점드릴" 진입 → `/kisa/drill?type=codeid`(SRS·오답노트 기록). REBUILD68의 빠른 퀴즈(`/kisa/code-quiz`, Study 버튼)는 병행 유지.

## §7. SRS·오답노트 자동 동작

- **SRS**: `kisa_review_queue`(user_id, question_id)·`applySrs`는 유형 무관 → self_grade 전송만으로 편입. 무수정.
- **오답노트**: 백엔드 wrong_notes 쿼리는 유형 무관 자동 포함(auto_score<70). 프론트 렌더 분기만 추가.

## §8. 검증 / 후속

- 마이그레이션·시드 운영 적용 완료, 채점 로직 단위검증 통과, `build:fe` 정상.
- 시험모드(`kisa-exam.js`) 편입은 이번 범위 밖(원할 시 config 샘플링·점수합산에 codeid 추가).
- REBUILD68 정적 퀴즈와 codeid DB 문항은 같은 303 코드 소스에서 파생(정적=빠른연습, DB=SRS 드릴).
