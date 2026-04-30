// 사용자별 lab 설정 저장 (REBUILD28 §11)
//
// 엔드포인트:
//   GET  /api/user-settings        → 본인의 모든 lab 설정 dict 반환
//   POST /api/user-settings        → { key, value } 저장 (whitelist 키만)
//
// 테이블 user_lab_settings (자동 생성):
//   user_id BIGINT, key TEXT, value TEXT, updated_at TIMESTAMPTZ
//   복합 PK (user_id, key)
//
// 키 화이트리스트 — 임의 키 차단:
//   - ollama_bridge_url     사용자 PC Ollama 의 base URL (예: http://localhost:11434)
//   - ollama_bridge_model   기본 모델 태그 (예: qwen3:4b)

const { withAuth } = require('./middleware');
const { query } = require('./db');

const ALLOWED_KEYS = new Set([
  'ollama_bridge_url',
  'ollama_bridge_model',
]);

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_lab_settings (
      user_id BIGINT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    )
  `);
  _ensured = true;
}

module.exports = withAuth(async (req, res) => {
  await ensureTable();
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: 'unauthenticated' });

  if (req.method === 'GET') {
    const r = await query(
      'SELECT key, value FROM user_lab_settings WHERE user_id = $1',
      [userId]
    );
    const out = {};
    for (const row of r.rows) out[row.key] = row.value;
    return res.json(out);
  }

  if (req.method === 'POST') {
    const { key, value } = req.body || {};
    if (!key || !ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'unknown_setting_key', allowed: [...ALLOWED_KEYS] });
    }
    if (typeof value !== 'string' || value.length > 500) {
      return res.status(400).json({ error: 'value_must_be_string_max_500' });
    }
    await query(
      `INSERT INTO user_lab_settings (user_id, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [userId, key, value]
    );
    return res.json({ ok: true, key, value });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
});
