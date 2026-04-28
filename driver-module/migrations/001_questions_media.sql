-- ============================================================================
-- Migration: driver-module/001_questions_media.sql
-- Purpose : questions 테이블에 동영상 문항 지원 컬럼 추가
-- Reason  : 운전면허 학과시험은 동영상 문항이 포함됨. 영상정보관리사 트랙 영향 0.
-- Target  : Supabase PostgreSQL 15+
-- ============================================================================

BEGIN;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS video_url     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS duration_sec  INTEGER;

COMMENT ON COLUMN questions.video_url    IS '동영상 문항 URL (예: /q-images/driver/v001.mp4). NULL 이면 동영상 없음';
COMMENT ON COLUMN questions.duration_sec IS '동영상 재생시간(초). UI 에서 진행바 등 표시용 (선택)';

COMMIT;
