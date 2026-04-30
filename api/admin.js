// 관리자 API (REBUILD23 이후 Cloud Run Express 핸들러)
const { query } = require('./db');
const { withAdmin } = require('./middleware');
const { getAllSettings, setSetting } = require('./_runtime/settings');

// 토글 가능한 설정 키 화이트리스트 — 임의 키 set 차단
// REBUILD26 §7-1: lab_server_ai_enabled / lab_server_ai_gguf_enabled 제거
//   (server-ai/server-ai-gguf 실험실 폐기, DB row 는 history 보존, 토글 차단).
const ALLOWED_SETTING_KEYS = new Set([
  'signup_disabled',
  'lab_local_ai_enabled',     // /lab/local-ai 진입 허용 여부 (REBUILD17)
  'lab_hf_enabled',           // /lab/hf 진입 허용 여부 (REBUILD22 §x)
  'lab_local_lambda_enabled', // /lab/local-gcp 진입 허용 여부 (REBUILD23~26 — Cloud Run 일심동체.
                              //                                DB key 는 마이그 부담으로 lambda 명 유지)
  'lab_server_infer_enabled', // /lab/server-infer 진입 허용 여부 (REBUILD26 §3.2 — 격리 추론 service)
  'lab_ollama_bridge_enabled',// /lab/ollama-bridge 진입 허용 여부 (REBUILD28 §11 — 외부 Ollama bridge)
  // LLM 프로바이더 활성화 토글 (REBUILD18 §11 후속)
  // 외부 3개 비활성 시 비용 절감 / 로컬 비활성 시 온디바이스 AI 버튼 숨김
  'provider_gemini_enabled',
  'provider_openai_enabled',
  'provider_claude_enabled',
  'provider_local_enabled',
]);

module.exports = withAdmin(async (req, res) => {
  // GET 요청에 req.body 가 빈 객체 {}(truthy)로 들어올 수 있어 || 체이닝이 위험.
  // → query 우선, body fallback 으로 명시적 추출.
  const action = (req.query && req.query.action) || (req.body && req.body.action);

  // ── REBUILD16 §12.2-C — LLM 사용량/비용 대시보드 ──
  if (req.method === 'GET' && action === 'llm_usage') {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days || '7', 10)));
    const [daily, byProvider, byAction, recent] = await Promise.all([
      query(`SELECT * FROM v_llm_daily_cost WHERE usage_date >= CURRENT_DATE - INTERVAL '${days} days' ORDER BY usage_date DESC, total_cost_usd DESC`),
      query(`SELECT provider, count(*) AS calls,
                    sum(input_tokens) AS in_tokens,
                    sum(output_tokens) AS out_tokens,
                    round(sum(estimated_cost)::numeric, 4) AS cost_usd,
                    count(*) FILTER (WHERE NOT success) AS errors
             FROM llm_usage_log
             WHERE created_at > NOW() - INTERVAL '${days} days'
             GROUP BY provider ORDER BY cost_usd DESC NULLS LAST`),
      query(`SELECT action, count(*) AS calls,
                    round(sum(estimated_cost)::numeric, 4) AS cost_usd
             FROM llm_usage_log
             WHERE created_at > NOW() - INTERVAL '${days} days' AND action IS NOT NULL
             GROUP BY action ORDER BY cost_usd DESC NULLS LAST`),
      query(`SELECT id, user_id, provider, model, action, success, error_message,
                    input_tokens, output_tokens, estimated_cost, latency_ms, created_at
             FROM llm_usage_log
             ORDER BY created_at DESC LIMIT 50`),
    ]);
    return res.json({
      days,
      daily: daily.rows,
      byProvider: byProvider.rows,
      byAction: byAction.rows,
      recent: recent.rows,
    });
  }

  // ── 시스템 설정 조회 (회원가입 토글 등) ──
  if (req.method === 'GET' && action === 'get_settings') {
    const settings = await getAllSettings();
    return res.json({ settings });
  }

  // ── 시스템 설정 변경 — 화이트리스트 키만 허용 ──
  if (action === 'set_setting') {
    const { key, value } = req.body || {};
    if (!key || !ALLOWED_SETTING_KEYS.has(key)) {
      return res.status(400).json({ error: '허용되지 않은 설정 키입니다.' });
    }
    await setSetting(key, value, req.user.uid);
    console.log(`[Admin] 설정 변경: ${key}=${value} (by ${req.user.sub})`);
    return res.json({ ok: true, key, value: String(value) });
  }

  // 회원 목록 조회
  if (req.method === 'GET' || action === 'list') {
    const result = await query(
      'SELECT id, username, name, is_admin, created_at FROM public.users ORDER BY created_at DESC'
    );
    return res.json({ users: result.rows });
  }

  // 관리자 권한 토글
  if (action === 'toggleAdmin') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });

    if (userId === req.user.uid) {
      return res.status(400).json({ error: '자신의 관리자 권한은 변경할 수 없습니다.' });
    }

    const result = await query(
      'UPDATE public.users SET is_admin = NOT is_admin WHERE id = $1 RETURNING id, username, name, is_admin',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    const u = result.rows[0];
    console.log(`[Admin] 권한 변경: ${u.username} → admin=${u.is_admin} (by ${req.user.sub})`);
    return res.json({ user: u });
  }

  // 회원 삭제
  if (action === 'delete') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: '사용자 ID가 필요합니다.' });

    if (userId === req.user.uid) {
      return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    }

    const result = await query(
      'DELETE FROM public.users WHERE id = $1 RETURNING username, name',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    console.log(`[Admin] 회원 삭제: ${result.rows[0].username} (by ${req.user.sub})`);
    return res.json({ deleted: result.rows[0] });
  }

  res.status(400).json({ error: '알 수 없는 액션입니다.' });
});
