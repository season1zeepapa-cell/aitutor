-- ============================================================================
-- Migration: 002_kisa_blank_type.sql
-- Purpose : KISA 문항에 단답형(blank) 유형 추가
-- Principle: 기존 kisa_questions 테이블에 컬럼 추가 + CHECK 제약 갱신.
--            mcq/diagnosis4 데이터는 영향 없음.
-- Target   : Supabase PostgreSQL 15+
-- Rollback : 002_kisa_blank_type_rollback.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) question_type CHECK 제약 갱신 ('blank' 추가)
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS kisa_questions_question_type_check;

ALTER TABLE kisa_questions
  ADD CONSTRAINT kisa_questions_question_type_check
  CHECK (question_type IN ('mcq', 'diagnosis4', 'blank'));

-- ----------------------------------------------------------------------------
-- 2) blank 전용 컬럼 2개 추가
--    - blank_template: 본문 내 빈칸 표시 템플릿. `{{1}}`, `{{2}}` 토큰 사용.
--      예: "Spring Security에서 {{1}} 필터는 {{2}} 공격을 방어한다."
--    - blank_answers: 각 빈칸 정답 목록과 유의어
--      예: [{"idx":1,"answers":["CsrfFilter"],"synonyms":["CsrfTokenFilter"]},
--           {"idx":2,"answers":["CSRF","Cross-Site Request Forgery"]}]
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  ADD COLUMN IF NOT EXISTS blank_template TEXT,
  ADD COLUMN IF NOT EXISTS blank_answers  JSONB;

-- ----------------------------------------------------------------------------
-- 3) blank 타입 필수필드 검증 제약
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS blank_requires_fields;

ALTER TABLE kisa_questions
  ADD CONSTRAINT blank_requires_fields CHECK (
    question_type <> 'blank' OR (
      blank_template IS NOT NULL AND
      blank_answers  IS NOT NULL AND
      jsonb_typeof(blank_answers) = 'array'
    )
  );

-- ----------------------------------------------------------------------------
-- 4) kisa_diagnosis_attempts 에 단답형 사용자 답 저장 컬럼 추가
--    - blank_answers_user: [{"idx":1,"text":"CsrfFilter"}, ...]
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_diagnosis_attempts
  ADD COLUMN IF NOT EXISTS blank_answers_user JSONB;

COMMENT ON COLUMN kisa_questions.blank_template IS 'blank 타입 문제: 빈칸 템플릿 ({{1}} {{2}} 토큰 사용)';
COMMENT ON COLUMN kisa_questions.blank_answers  IS 'blank 타입 문제: 빈칸별 정답 목록 + 유의어';
COMMENT ON COLUMN kisa_diagnosis_attempts.blank_answers_user IS 'blank 타입 답안: 사용자가 입력한 빈칸별 값';

COMMIT;
