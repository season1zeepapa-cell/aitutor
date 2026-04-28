-- ============================================================================
-- Migration: 003_llm_usage_log.sql
-- Purpose : LLM 호출 비용·사용량 추적 (REBUILD16 §12.2-C)
-- Principle: 모든 _llm/ 헬퍼 호출 후 1행씩 INSERT.
--            user_id, provider, model, tokens, cost, success/error 기록.
-- Target   : Supabase PostgreSQL 15+
-- Rollback : 003_llm_usage_log_rollback.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS llm_usage_log (
  id              BIGSERIAL PRIMARY KEY,
  user_id         INTEGER,                            -- 호출 주체 (없으면 시스템/admin)
  provider        VARCHAR(20) NOT NULL,               -- 'anthropic'|'openai'|'gemini'
  model           VARCHAR(80) NOT NULL,               -- 'claude-haiku-4-5-20251001' 등
  action          VARCHAR(40),                        -- 'kisa_explain'|'kisa_grade'|'card_explain'|'pool_extract' 등
  question_id     UUID,                               -- kisa_questions.id (선택)
  input_tokens    INT,
  output_tokens   INT,
  estimated_cost  NUMERIC(10,6),                      -- USD, 모델별 단가표 적용
  latency_ms      INT,                                -- 호출 소요시간
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,                               -- success=false 시 에러
  meta            JSONB,                              -- streaming 여부 등 부가 정보
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_time
  ON llm_usage_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_time
  ON llm_usage_log (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_action_time
  ON llm_usage_log (action, created_at DESC);

COMMENT ON TABLE llm_usage_log IS 'LLM 호출 사용량/비용 기록 — REBUILD16 §12.2-C';

-- 일일 비용 집계 뷰 (운영 대시보드용)
CREATE OR REPLACE VIEW v_llm_daily_cost AS
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Seoul') AS usage_date,
  provider,
  model,
  count(*) AS calls,
  sum(input_tokens)  AS in_tokens,
  sum(output_tokens) AS out_tokens,
  round(sum(estimated_cost)::numeric, 4) AS total_cost_usd,
  count(*) FILTER (WHERE NOT success) AS errors
FROM llm_usage_log
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_cost_usd DESC;

COMMIT;
