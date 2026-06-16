-- ============================================================================
-- Rollback: 005_kisa_question_rebuild_rollback.sql
-- Purpose : 005 적용 되돌리기.
-- 주의    : stage/chapter_code/explanation 은 드리프트 명시화라 되돌리지 않는다
--           (001 이후 코드가 계속 사용 중 — 삭제 시 런타임 깨짐).
-- ============================================================================

BEGIN;

-- composite 답안 컬럼 제거
ALTER TABLE kisa_diagnosis_attempts
  DROP COLUMN IF EXISTS report_text,
  DROP COLUMN IF EXISTS rubric_hits;

-- composite 제약·컬럼 제거
ALTER TABLE kisa_questions DROP CONSTRAINT IF EXISTS composite_requires_fields;
ALTER TABLE kisa_questions
  DROP COLUMN IF EXISTS choice_explanations,
  DROP COLUMN IF EXISTS artifacts,
  DROP COLUMN IF EXISTS rubric,
  DROP COLUMN IF EXISTS report_template;

-- question_type CHECK 을 002 상태(mcq/diagnosis4/blank)로 복원
--   ※ composite 행이 남아있으면 실패하므로, 먼저 비활성/삭제 필요.
ALTER TABLE kisa_questions DROP CONSTRAINT IF EXISTS kisa_questions_question_type_check;
ALTER TABLE kisa_questions
  ADD CONSTRAINT kisa_questions_question_type_check
  CHECK (question_type IN ('mcq', 'diagnosis4', 'blank'));

COMMIT;
