-- 006 롤백 — codeid 문항 제거 + CHECK 원복(005 상태)
BEGIN;

DELETE FROM kisa_questions WHERE question_type = 'codeid';
DROP INDEX IF EXISTS idx_kisa_questions_codeid_chapter;

ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS kisa_questions_question_type_check;
ALTER TABLE kisa_questions
  ADD CONSTRAINT kisa_questions_question_type_check
  CHECK (question_type IN ('mcq', 'diagnosis4', 'blank', 'composite'));

COMMIT;
