"""Rate Limit 4단계 — ONNX 핸들러의 rate_limit.py 와 동일 (provider 명만 다름: local-{key})"""
import os
import psycopg2
from psycopg2 import pool
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

LIMITS = {
    'user_daily':       int(os.environ.get('RL_USER_DAILY', '30')),
    'user_e4b_daily':   int(os.environ.get('RL_USER_E4B_DAILY', '10')),
    'user_other_daily': int(os.environ.get('RL_USER_OTHER_DAILY', '30')),
    'account_daily':    int(os.environ.get('RL_ACCOUNT_DAILY', '1000')),
}

_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.SimpleConnectionPool(1, 2, dsn=os.environ['DATABASE_URL'], sslmode='require')
    return _pool


def _query_one(sql, params=()):
    p = _get_pool()
    conn = p.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()
    finally:
        p.putconn(conn)


def _execute(sql, params=()):
    p = _get_pool()
    conn = p.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
    finally:
        p.putconn(conn)


def _next_midnight_iso():
    return (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def check_rate_limit(user_id, model_key: str) -> Dict[str, Any]:
    if not user_id:
        return {'exceeded': True, 'reason': 'no_user_id', 'resetAt': None}

    r1 = _query_one(
        """SELECT COUNT(*) FROM llm_usage_log
           WHERE user_id = %s AND created_at >= CURRENT_DATE AND provider LIKE 'local-%%'""",
        (user_id,),
    )
    user_used = r1[0] if r1 else 0
    if user_used >= LIMITS['user_daily']:
        return {'exceeded': True, 'reason': 'user_daily_limit', 'limit': LIMITS['user_daily'], 'used': user_used, 'resetAt': _next_midnight_iso()}

    is_e4b = 'e4b' in model_key
    model_limit = LIMITS['user_e4b_daily'] if is_e4b else LIMITS['user_other_daily']
    r2 = _query_one(
        """SELECT COUNT(*) FROM llm_usage_log
           WHERE user_id = %s AND created_at >= CURRENT_DATE AND provider = %s""",
        (user_id, f'local-{model_key}'),
    )
    model_used = r2[0] if r2 else 0
    if model_used >= model_limit:
        return {'exceeded': True, 'reason': 'user_model_limit', 'model': model_key, 'limit': model_limit, 'used': model_used, 'resetAt': _next_midnight_iso()}

    r3 = _query_one(
        """SELECT COUNT(*) FROM llm_usage_log
           WHERE created_at >= CURRENT_DATE AND provider LIKE 'local-%%'""",
    )
    account_used = r3[0] if r3 else 0
    if account_used >= LIMITS['account_daily']:
        try:
            _execute(
                """INSERT INTO aitutor_settings(key, value, updated_at)
                   VALUES('provider_local_enabled', 'false', NOW())
                   ON CONFLICT(key) DO UPDATE SET value = 'false', updated_at = NOW()""",
            )
        except Exception: pass
        return {'exceeded': True, 'reason': 'account_daily_limit', 'limit': LIMITS['account_daily'], 'used': account_used, 'resetAt': _next_midnight_iso()}

    return {
        'exceeded': False,
        'user_used': user_used, 'user_limit': LIMITS['user_daily'],
        'model_used': model_used, 'model_limit': model_limit,
        'account_used': account_used, 'account_limit': LIMITS['account_daily'],
    }


def log_usage(user_id, provider: str, model: str, action: str,
              latency_ms: int, output_tokens: int = 0, estimated_cost: float = 0.0,
              question_id=None):
    try:
        _execute(
            """INSERT INTO llm_usage_log
                 (user_id, provider, model, action, question_id,
                  input_tokens, output_tokens, estimated_cost, latency_ms,
                  success, meta)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, true,
                       '{"source":"server-py-gguf"}'::jsonb)""",
            (user_id, provider, model, action, question_id,
             0, output_tokens, estimated_cost, latency_ms),
        )
    except Exception: pass
