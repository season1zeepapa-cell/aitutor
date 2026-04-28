-- ============================================================================
-- Migration: driver-module/003_questions_unique.sql
-- Purpose : (exam_id, question_number) 복합 UNIQUE 제약 추가
-- Reason  : import 스크립트 재실행 시 중복 INSERT 방지 (ON CONFLICT 동작 보장)
-- Verified: 영상정보관리사 + 운전면허 데이터 모두 검사 — 중복 0건 확인 후 추가
-- Target  : Supabase PostgreSQL 15+
-- ============================================================================

BEGIN;

ALTER TABLE questions
  ADD CONSTRAINT questions_exam_qno_uniq UNIQUE (exam_id, question_number);

COMMIT;
