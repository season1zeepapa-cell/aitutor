-- ============================================================================
-- Migration: 001_kisa_module.sql
-- Purpose : KISA 진단원 이수시험 드릴 모듈 — 신규 테이블 4개 추가
-- Principle: 기존 테이블(categories, exams, subjects, questions,
--            question_memos, question_bookmarks, exam_results,
--            question_explanations, users 등)은 일절 수정하지 않는다.
-- Target   : Supabase PostgreSQL 15+
-- Rollback : 001_kisa_module_rollback.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 사전 조건 확인 (uuid 확장)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1) kisa_questions — KISA 문항 (MCQ 이론 + diagnosis4 실기)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kisa_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_type       VARCHAR(16)  NOT NULL CHECK (question_type IN ('mcq','diagnosis4')),
  weakness_category   VARCHAR(32)  NOT NULL CHECK (weakness_category IN (
                        'input_validation','security_feature','time_state',
                        'error_handling','code_error','encapsulation','api_abuse'
                      )),
  weakness_code       VARCHAR(32),                 -- 예: 'SR-020301' 또는 내부 ID
  weakness_name_ko    VARCHAR(64)  NOT NULL,       -- '비밀번호 관리' 등
  language            VARCHAR(16)  NOT NULL CHECK (language IN (
                        'java','python','javascript','kotlin','swift','etc'
                      )),
  difficulty          VARCHAR(4)   NOT NULL CHECK (difficulty IN ('하','중','상')),

  body                TEXT         NOT NULL,       -- 문제 본문(마크다운)
  vulnerable_code     TEXT,                        -- 제시 코드 전문 (line 번호 포함 원문)
  code_language       VARCHAR(16),                 -- highlighting 키 (java, python, js, ...)

  -- MCQ 필드
  choices             JSONB,                       -- [{"num":1,"text":"..."}]
  answer_index        INT,                         -- 0-based

  -- diagnosis4 필드
  vulnerable_lines    INT[],                       -- [7, 9]
  rationale_keywords  TEXT[],                      -- 근거 필수 키워드
  fix_keywords        TEXT[],                      -- 수정 방안 필수 키워드
  safe_code           TEXT,
  model_answer        JSONB,                       -- 구조화된 모범답안

  -- 메타
  reference           TEXT,                        -- 참고 가이드 문서·절
  tags                TEXT[]       DEFAULT '{}',
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by          INTEGER,                     -- users.id (FK 제약은 걸지 않음: 향후 users 스키마 변동 방지)
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- MCQ/diagnosis4 필수필드 검증
  CONSTRAINT mcq_requires_choices CHECK (
    question_type <> 'mcq' OR (choices IS NOT NULL AND answer_index IS NOT NULL)
  ),
  CONSTRAINT diag_requires_fields CHECK (
    question_type <> 'diagnosis4' OR (
      vulnerable_code IS NOT NULL AND
      vulnerable_lines IS NOT NULL AND
      rationale_keywords IS NOT NULL AND
      fix_keywords IS NOT NULL AND
      safe_code IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_kisa_questions_filter
  ON kisa_questions (question_type, weakness_category, language, difficulty, is_active);

CREATE INDEX IF NOT EXISTS idx_kisa_questions_weakness
  ON kisa_questions (weakness_code);

CREATE INDEX IF NOT EXISTS idx_kisa_questions_tags
  ON kisa_questions USING GIN (tags);

COMMENT ON TABLE kisa_questions IS 'KISA 진단원 이수시험 드릴 문항 (MCQ + diagnosis4)';

-- ----------------------------------------------------------------------------
-- 2) kisa_diagnosis_attempts — 사용자별 풀이·채점 결과
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kisa_diagnosis_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          INTEGER NOT NULL,              -- users.id 참조 (FK 제약 없음, 실제 users.id는 INTEGER)
  question_id      UUID   NOT NULL REFERENCES kisa_questions(id) ON DELETE CASCADE,
  mode             VARCHAR(16) NOT NULL CHECK (mode IN ('drill','exam','review')),
  exam_session_id  UUID,                          -- kisa_exam_sessions.id (선택)

  -- MCQ
  mcq_selected     INT,

  -- diagnosis4
  verdict_yn       BOOLEAN,
  cited_lines      INT[]       DEFAULT '{}',
  rationale_text   TEXT        DEFAULT '',
  fix_text         TEXT        DEFAULT '',
  fix_code         TEXT        DEFAULT '',

  -- 채점
  auto_score       INT         CHECK (auto_score BETWEEN 0 AND 100),
  keyword_hits     JSONB,                          -- {"rationale":[...],"fix":[...]}
  llm_score        INT         CHECK (llm_score BETWEEN 0 AND 100),
  llm_feedback     JSONB,                          -- {"strengths":[],"weaknesses":[],"missing_keywords":[]}
  final_score      INT         CHECK (final_score BETWEEN 0 AND 100),

  -- 자가평가(SM-2용)
  self_grade       VARCHAR(8)  CHECK (self_grade IN ('again','hard','good','easy')),

  -- 메타
  time_spent_sec   INT         DEFAULT 0,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kisa_attempts_user_time
  ON kisa_diagnosis_attempts (user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_kisa_attempts_question
  ON kisa_diagnosis_attempts (question_id, user_id);

CREATE INDEX IF NOT EXISTS idx_kisa_attempts_exam
  ON kisa_diagnosis_attempts (exam_session_id)
  WHERE exam_session_id IS NOT NULL;

COMMENT ON TABLE kisa_diagnosis_attempts IS 'KISA 드릴/실전 풀이 기록 및 채점 결과';

-- ----------------------------------------------------------------------------
-- 3) kisa_review_queue — SM-2 스페이스드 리피티션 큐
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kisa_review_queue (
  user_id          INTEGER NOT NULL,
  question_id      UUID   NOT NULL REFERENCES kisa_questions(id) ON DELETE CASCADE,
  ease_factor      REAL   NOT NULL DEFAULT 2.5,
  interval_days    INT    NOT NULL DEFAULT 0,
  repetitions      INT    NOT NULL DEFAULT 0,
  next_review_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  suspended        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_kisa_review_due
  ON kisa_review_queue (user_id, next_review_at)
  WHERE suspended = FALSE;

COMMENT ON TABLE kisa_review_queue IS 'SM-2 경량판 스페이스드 리피티션 큐';

-- ----------------------------------------------------------------------------
-- 4) kisa_exam_sessions — 실전 모의고사 세션
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kisa_exam_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         INTEGER NOT NULL,
  exam_type       VARCHAR(16) NOT NULL CHECK (exam_type IN ('theory60','practical100','full3h')),
  state           VARCHAR(16) NOT NULL DEFAULT 'in_progress'
                   CHECK (state IN ('in_progress','submitted','expired','abandoned')),
  question_ids    UUID[]      NOT NULL DEFAULT '{}',
  answers         JSONB       NOT NULL DEFAULT '{}'::JSONB,
  total_score     INT,
  theory_score    INT,
  practical_score INT,
  time_limit_sec  INT         NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  expired_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kisa_exam_user_state
  ON kisa_exam_sessions (user_id, state, started_at DESC);

COMMENT ON TABLE kisa_exam_sessions IS 'KISA 실전 모의고사 세션';

-- ----------------------------------------------------------------------------
-- 5) kisa_reports — 진단보고서 저장 + DOCX 메타
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kisa_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       INTEGER NOT NULL,
  question_id   UUID REFERENCES kisa_questions(id) ON DELETE SET NULL,
  attempt_id    UUID REFERENCES kisa_diagnosis_attempts(id) ON DELETE SET NULL,
  template_type VARCHAR(16) NOT NULL CHECK (template_type IN ('simple','composite')),
  title         VARCHAR(200),
  payload       JSONB       NOT NULL,        -- report-template.json 구조
  docx_s3_key   VARCHAR(512),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kisa_reports_user
  ON kisa_reports (user_id, created_at DESC);

COMMENT ON TABLE kisa_reports IS 'KISA 진단보고서 — 붙임2 양식 저장 및 DOCX 내보내기 메타';

-- ----------------------------------------------------------------------------
-- updated_at 자동 갱신 트리거 (신규 테이블 한정)
-- 기존 테이블 트리거는 건드리지 않음.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kisa_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kisa_questions_updated ON kisa_questions;
CREATE TRIGGER trg_kisa_questions_updated
  BEFORE UPDATE ON kisa_questions
  FOR EACH ROW EXECUTE FUNCTION kisa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_kisa_review_updated ON kisa_review_queue;
CREATE TRIGGER trg_kisa_review_updated
  BEFORE UPDATE ON kisa_review_queue
  FOR EACH ROW EXECUTE FUNCTION kisa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_kisa_reports_updated ON kisa_reports;
CREATE TRIGGER trg_kisa_reports_updated
  BEFORE UPDATE ON kisa_reports
  FOR EACH ROW EXECUTE FUNCTION kisa_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 검증 쿼리 (마이그레이션 후 수동 확인)
-- ----------------------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'kisa_%'
-- ORDER BY table_name;
--
-- 예상 결과: kisa_diagnosis_attempts, kisa_exam_sessions,
--            kisa_questions, kisa_reports, kisa_review_queue

COMMIT;
