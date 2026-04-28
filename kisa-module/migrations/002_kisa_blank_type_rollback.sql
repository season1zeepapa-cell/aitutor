-- ============================================================================
-- Rollback: 002_kisa_blank_type_rollback.sql
-- Purpose : 002_kisa_blank_type.sql 적용을 되돌린다.
--           기 등록된 blank 문항은 삭제되므로 주의.
-- ============================================================================

BEGIN;

-- 1) blank 타입 데이터 삭제 (CHECK 제약을 원복하기 위해)
DELETE FROM kisa_diagnosis_attempts
  WHERE question_id IN (SELECT id FROM kisa_questions WHERE question_type = 'blank');

DELETE FROM kisa_review_queue
  WHERE question_id IN (SELECT id FROM kisa_questions WHERE question_type = 'blank');

DELETE FROM kisa_reports
  WHERE question_id IN (SELECT id FROM kisa_questions WHERE question_type = 'blank');

DELETE FROM kisa_questions WHERE question_type = 'blank';

-- 2) blank 필수필드 CHECK 제약 제거
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS blank_requires_fields;

-- 3) blank 컬럼 제거
ALTER TABLE kisa_questions
  DROP COLUMN IF EXISTS blank_template,
  DROP COLUMN IF EXISTS blank_answers;

ALTER TABLE kisa_diagnosis_attempts
  DROP COLUMN IF EXISTS blank_answers_user;

-- 4) question_type CHECK 제약 원복
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS kisa_questions_question_type_check;

ALTER TABLE kisa_questions
  ADD CONSTRAINT kisa_questions_question_type_check
  CHECK (question_type IN ('mcq', 'diagnosis4'));

COMMIT;
