// AI API 키 설정 엔드포인트 — BYOK (REBUILD67)
//
// GET  /api/ai-keys
//   → { mode, isAdmin, providers:{gemini:{label,hasKey,masked}, ...}, encReady }
//     · 관리자는 최초 진입 시 .env 키를 공용 슬롯으로 자동 seed
//
// POST /api/ai-keys
//   { action:'set_mode', mode:'shared'|'individual' }   (관리자 전용)
//   { action:'set_key',  provider, key }
//        · 관리자 → 공용/본인 키 저장
//        · 회원   → 개인 모드일 때만 본인 키 저장
//   { action:'clear_key', provider }                     (위와 동일 라우팅)

const { withAuth } = require('./middleware');
const keys = require('./_llm/apikeys');
const { hasSecret } = require('./_llm/crypto');

module.exports = withAuth(async (req, res) => {
  const user = req.user;

  if (req.method === 'GET') {
    if (user.admin) {
      try { await keys.seedFromEnv(user.uid); } catch (e) { console.warn('[ai-keys] seed 실패:', e.message); }
    }
    const status = await keys.getStatus(user);
    return res.json({ ...status, encReady: hasSecret() });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { action, provider, key, mode } = req.body || {};

  // ── 모드 전환 (관리자 전용) ──
  if (action === 'set_mode') {
    if (!user.admin) return res.status(403).json({ error: '관리자만 변경할 수 있습니다.' });
    const next = await keys.setMode(mode, user.uid);
    const status = await keys.getStatus(user);
    return res.json({ ok: true, ...status, mode: next });
  }

  // ── 키 저장 / 삭제 ──
  if (action === 'set_key' || action === 'clear_key') {
    if (!keys.PROVIDERS.includes(provider)) return res.status(400).json({ error: 'unknown_provider' });
    if (action === 'set_key' && (typeof key !== 'string' || !key.trim() || key.length > 500)) {
      return res.status(400).json({ error: 'invalid_key' });
    }
    const val = action === 'clear_key' ? '' : key;

    if (user.admin) {
      await keys.setSharedKey(provider, val, user.uid);       // 관리자 = 공용/본인 슬롯
    } else {
      const curMode = await keys.getMode();
      if (curMode !== 'individual') {
        return res.status(403).json({ error: '현재 공용 키 모드입니다. 개인 키를 설정할 수 없습니다.' });
      }
      await keys.setUserKey(user.uid, provider, val);         // 회원 = 개인 슬롯
    }
    const status = await keys.getStatus(user);
    return res.json({ ok: true, ...status });
  }

  return res.status(400).json({ error: 'unknown_action' });
});
