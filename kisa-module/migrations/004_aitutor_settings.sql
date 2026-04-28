-- ============================================================================
-- Migration: 004_aitutor_settings.sql
-- Purpose : aitutor 전용 런타임 설정 테이블 — DB 기반 무재배포 토글
-- Reason  : REBUILD16 §3.4 의 SSM 패턴 대신, 관리자 UI 에서 즉시 토글 가능한
--           DB 기반 패턴 채택. (1회용 플래그 무재배포 가치 + 관리자 UX 개선)
-- Note    : 기존 public.app_settings 는 DocStore 가 사용 중이므로 격리 위해
--           aitutor 전용 테이블(aitutor_settings)을 신설.
-- Target  : Supabase PostgreSQL 15+
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS aitutor_settings (
  key         VARCHAR(50) PRIMARY KEY,
  value       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INTEGER                                -- public.users.id (관리자 UID)
);

COMMENT ON TABLE  aitutor_settings IS 'aitutor 런타임 설정 — 관리자 UI 에서 토글 (REBUILD16 §3.4 대안)';
COMMENT ON COLUMN aitutor_settings.value      IS 'TEXT 로 저장. boolean 은 "true"/"false" 문자열, 숫자/문자열도 동일 컬럼 사용';
COMMENT ON COLUMN aitutor_settings.updated_by IS '마지막으로 변경한 관리자 user_id (감사용)';

-- 초기 시드 — 현재 운영 상태 보존 (회원가입 차단 유지)
INSERT INTO aitutor_settings (key, value)
VALUES ('signup_disabled', 'true')
ON CONFLICT (key) DO NOTHING;

COMMIT;
