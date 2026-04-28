-- ============================================================================
-- Rollback: 001_kisa_module_rollback.sql
-- 신규 KISA 테이블·트리거·함수 전체 제거.
-- 기존 테이블에는 어떤 영향도 없다.
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_kisa_reports_updated   ON kisa_reports;
DROP TRIGGER IF EXISTS trg_kisa_review_updated    ON kisa_review_queue;
DROP TRIGGER IF EXISTS trg_kisa_questions_updated ON kisa_questions;

DROP TABLE IF EXISTS kisa_reports            CASCADE;
DROP TABLE IF EXISTS kisa_exam_sessions      CASCADE;
DROP TABLE IF EXISTS kisa_review_queue       CASCADE;
DROP TABLE IF EXISTS kisa_diagnosis_attempts CASCADE;
DROP TABLE IF EXISTS kisa_questions          CASCADE;

DROP FUNCTION IF EXISTS kisa_touch_updated_at();

COMMIT;
