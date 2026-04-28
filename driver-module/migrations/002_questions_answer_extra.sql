-- ============================================================================
-- Migration: driver-module/002_questions_answer_extra.sql
-- Purpose : 복수 정답 문항 지원 (예: "정답: 2, 4")
-- Reason  : 운전면허 학과시험에는 2개 정답 문항이 296개 존재. 3개 이상은 없음.
--           기존 answer INTEGER 단일 컬럼 그대로 두고 answer_extra 추가.
-- Compat  : answer_extra IS NULL → 단일 정답 (영상정보관리사 1,489개 영향 0)
--           answer_extra IS NOT NULL → 복수 정답 (운전면허 296개)
-- Target  : Supabase PostgreSQL 15+
-- ============================================================================

BEGIN;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS answer_extra INTEGER;

COMMENT ON COLUMN questions.answer_extra IS '복수 정답 두 번째 번호. NULL=단일 정답. 운전면허 학과시험 등에 사용';

COMMIT;
