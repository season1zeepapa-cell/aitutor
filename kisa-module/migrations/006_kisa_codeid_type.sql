-- 006_kisa_codeid_type.sql (REBUILD69)
-- 코드식별 문제유형 'codeid' 를 DB 정규 문항으로 추가.
--   코드를 보여주고 ① 49개 구현단계 약점 중 무엇인지(choices/answer_index 재사용)
--   ② 안전/취약 코드인지(model_answer.is_safe) 맞힌다.
-- Principle: 신규 컬럼 없이 기존 컬럼 재사용(choices/answer_index/model_answer/vulnerable_code/explanation).
--            기존 mcq/diagnosis4/blank/composite 데이터 무손상 — CHECK 값만 확장.

BEGIN;

-- question_type CHECK 에 'codeid' 추가
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS kisa_questions_question_type_check;
ALTER TABLE kisa_questions
  ADD CONSTRAINT kisa_questions_question_type_check
  CHECK (question_type IN ('mcq', 'diagnosis4', 'blank', 'composite', 'codeid'));

-- codeid 조회 성능 — chapter_code(=CQ-XXXX 고유 시드키) 인덱스는 001 의 weakness_code 인덱스로는
-- 부족하므로 부분 인덱스 추가(중복 시드 방지 UPSERT 조회 가속).
CREATE INDEX IF NOT EXISTS idx_kisa_questions_codeid_chapter
  ON kisa_questions (chapter_code)
  WHERE question_type = 'codeid';

COMMIT;
