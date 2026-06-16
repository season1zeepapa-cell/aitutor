-- ============================================================================
-- Migration: 005_kisa_question_rebuild.sql
-- Purpose : 문제풀 재구축(REBUILD53) — composite(복합서술형) 타입 + mcq 선지별 해설
--           + 스키마 드리프트 명시화(stage/chapter_code/explanation).
-- Principle: 기존 mcq/diagnosis4/blank 데이터 무손상. 컬럼 추가 + CHECK 갱신.
-- Target   : Supabase PostgreSQL 15+
-- Rollback : 005_kisa_question_rebuild_rollback.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) 스키마 드리프트 명시화
--    001 에는 없으나 코드(kisa-seed-import/scorer/kisa-attempt)가 사용 중인 컬럼.
--    IF NOT EXISTS 라 이미 있으면 no-op — repo SSOT 복구 목적.
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  ADD COLUMN IF NOT EXISTS stage        VARCHAR(16),
  ADD COLUMN IF NOT EXISTS chapter_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS explanation  TEXT;

-- ----------------------------------------------------------------------------
-- 2) question_type CHECK 갱신 ('composite' 추가)
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS kisa_questions_question_type_check;
ALTER TABLE kisa_questions
  ADD CONSTRAINT kisa_questions_question_type_check
  CHECK (question_type IN ('mcq', 'diagnosis4', 'blank', 'composite'));

-- ----------------------------------------------------------------------------
-- 3) 객관식 선지별 해설 (별도 컬럼)
--    [{ "num":1, "correct":false, "why":"이 진술이 맞는 이유 = 함정" }, ...]
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  ADD COLUMN IF NOT EXISTS choice_explanations JSONB;

-- ----------------------------------------------------------------------------
-- 4) composite(복합서술형) 전용 컬럼
--    - artifacts: 산출물 3종 [{type:'요구사항정의서'|'아키텍처설계서'|'개발가이드', title, content, code?}]
--    - rubric   : 채점 루브릭 [{item, points, required_keywords:[], artifact_ref, method}]  ← DSG diagnosis.checklist 유래
--    - report_template: 진단보고서 정형 양식(섹션 정의)
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  ADD COLUMN IF NOT EXISTS artifacts       JSONB,
  ADD COLUMN IF NOT EXISTS rubric          JSONB,
  ADD COLUMN IF NOT EXISTS report_template JSONB;

-- ----------------------------------------------------------------------------
-- 5) composite 필수필드 검증
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_questions
  DROP CONSTRAINT IF EXISTS composite_requires_fields;
ALTER TABLE kisa_questions
  ADD CONSTRAINT composite_requires_fields CHECK (
    question_type <> 'composite' OR (
      artifacts IS NOT NULL AND jsonb_typeof(artifacts) = 'array' AND
      rubric    IS NOT NULL AND jsonb_typeof(rubric)    = 'array'
    )
  );

-- ----------------------------------------------------------------------------
-- 6) kisa_diagnosis_attempts 에 composite 답안 저장 컬럼
-- ----------------------------------------------------------------------------
ALTER TABLE kisa_diagnosis_attempts
  ADD COLUMN IF NOT EXISTS report_text TEXT,
  ADD COLUMN IF NOT EXISTS rubric_hits JSONB;

COMMENT ON COLUMN kisa_questions.choice_explanations IS 'mcq 선지별 해설 [{num,correct,why}]';
COMMENT ON COLUMN kisa_questions.artifacts       IS 'composite: 산출물 3종 [{type,title,content,code}]';
COMMENT ON COLUMN kisa_questions.rubric          IS 'composite: 채점 루브릭 [{item,points,required_keywords,artifact_ref,method}]';
COMMENT ON COLUMN kisa_questions.report_template IS 'composite: 진단보고서 정형 양식';
COMMENT ON COLUMN kisa_diagnosis_attempts.report_text IS 'composite 답안: 작성한 진단보고서 본문';
COMMENT ON COLUMN kisa_diagnosis_attempts.rubric_hits IS 'composite 채점: 루브릭 항목별 hit 결과';

COMMIT;
