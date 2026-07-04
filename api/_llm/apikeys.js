// 외부 LLM API 키 저장/조회/해석 — DB 기반 BYOK(Bring Your Own Key) (REBUILD67)
//
// ── 두 가지 모드 (aitutor_settings.api_key_mode) ──
//   'shared'     : 모든 회원이 관리자 공용키를 함께 사용 (기본값)
//   'individual' : 관리자는 본인키, 다른 회원은 각자 입력한 개인키 사용
//                  (개인 모드 전환 시 모든 회원 개인키가 리셋됨)
//
// ── 저장 위치 ──
//   관리자/공용키 : aitutor_settings 의 shared_api_key_<provider> (암호문)
//   회원 개인키   : aitutor_user_api_keys(user_id, provider, key_enc) (암호문)
//
// ── 무중단 전환 ──
//   최초 1회 seedFromEnv() 가 .env 의 키를 공용키 슬롯으로 이관한다.
//   (관리자가 처음 AI설정을 열 때 자동 실행 — 이후 .env 는 무시)

const { query } = require('../db');
const { getSetting, setSetting } = require('../_runtime/settings');
const { encrypt, decrypt } = require('./crypto');

const PROVIDERS = ['gemini', 'openai', 'claude'];
const ENV_MAP = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
};
const PROVIDER_LABEL = { gemini: 'Gemini', openai: 'OpenAI', claude: 'Claude' };

function isProvider(p) { return PROVIDERS.includes(p); }
function sharedKeyName(provider) { return `shared_api_key_${provider}`; }

let _ensured = false;
async function ensureTable() {
  if (_ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS aitutor_user_api_keys (
      user_id BIGINT NOT NULL,
      provider TEXT NOT NULL,
      key_enc TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, provider)
    )
  `);
  _ensured = true;
}

// ─── 모드 ───
async function getMode() {
  const v = await getSetting('api_key_mode', 'shared');
  return v === 'individual' ? 'individual' : 'shared';
}

/** 모드 전환. individual 로 바꾸면 전 회원 개인키 리셋(관리자 요구). */
async function setMode(mode, adminUid) {
  const next = mode === 'individual' ? 'individual' : 'shared';
  await setSetting('api_key_mode', next, adminUid);
  if (next === 'individual') {
    await ensureTable();
    await query('DELETE FROM aitutor_user_api_keys');   // 모든 회원 개인키 초기화
  }
  return next;
}

// ─── 공용(관리자) 키 ───
async function setSharedKey(provider, plainKey, adminUid) {
  if (!isProvider(provider)) throw new Error('unknown_provider');
  const enc = plainKey ? encrypt(String(plainKey).trim()) : '';
  await setSetting(sharedKeyName(provider), enc, adminUid);
}
async function getSharedKeyRaw(provider) {
  const enc = await getSetting(sharedKeyName(provider), '');
  return enc ? decrypt(enc) : null;
}

// ─── 회원 개인 키 ───
async function setUserKey(userId, provider, plainKey) {
  if (!isProvider(provider)) throw new Error('unknown_provider');
  await ensureTable();
  const trimmed = String(plainKey || '').trim();
  if (!trimmed) {   // 빈 값 저장 = 삭제
    await query('DELETE FROM aitutor_user_api_keys WHERE user_id=$1 AND provider=$2', [userId, provider]);
    return;
  }
  const enc = encrypt(trimmed);
  await query(
    `INSERT INTO aitutor_user_api_keys (user_id, provider, key_enc, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (user_id, provider)
     DO UPDATE SET key_enc=EXCLUDED.key_enc, updated_at=NOW()`,
    [userId, provider, enc]
  );
}
async function getUserKeyRaw(userId, provider) {
  await ensureTable();
  const r = await query('SELECT key_enc FROM aitutor_user_api_keys WHERE user_id=$1 AND provider=$2', [userId, provider]);
  const enc = r.rows[0]?.key_enc;
  return enc ? decrypt(enc) : null;
}

// ─── 핵심: 요청자에게 적용할 실제 키 해석 ───
//   프록시/채점 등 모든 LLM 호출 직전에 호출한다. 없으면 null.
async function resolveApiKey(provider, user) {
  if (!isProvider(provider)) return null;
  const mode = await getMode();
  if (mode === 'shared') {
    return await getSharedKeyRaw(provider);              // 전원 공용키
  }
  // individual
  if (user?.admin) return await getSharedKeyRaw(provider); // 관리자 = 본인(공용 슬롯) 키
  if (!user?.uid) return null;
  return await getUserKeyRaw(user.uid, provider);          // 회원 = 개인키
}

/** 키 누락 시 프론트에 내려줄 표준 에러 객체 (친절한 한글 안내 + code) */
function missingKeyError(provider) {
  const label = PROVIDER_LABEL[provider] || provider;
  return {
    code: 'no_api_key',
    provider,
    error: `${label} API 키가 설정되지 않았습니다. 설정 화면의 'AI API 키'에서 키를 입력해 주세요.`,
  };
}

/** 마스킹(앞4+뒤4, 나머지 ●). 원문은 절대 프론트로 내보내지 않음. */
function maskKey(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (s.length <= 8) return '●'.repeat(s.length);
  return `${s.slice(0, 4)}${'●'.repeat(Math.min(8, s.length - 8))}${s.slice(-4)}`;
}

/** UI 상태 — 원문 미포함, 존재 여부 + 마스킹만. */
async function getStatus(user) {
  const mode = await getMode();
  const isAdmin = !!user?.admin;
  const providers = {};
  for (const p of PROVIDERS) {
    let raw;
    if (isAdmin) raw = await getSharedKeyRaw(p);            // 관리자는 공용 슬롯 = 본인 키
    else if (mode === 'individual') raw = await getUserKeyRaw(user.uid, p);
    else raw = null;                                       // 회원 + shared: 개인 입력 불필요
    providers[p] = { label: PROVIDER_LABEL[p], hasKey: !!raw, masked: maskKey(raw) };
  }
  return { mode, isAdmin, providers };
}

/** 최초 1회 .env → 공용키 이관 (무중단 전환). 이미 seed 됐으면 no-op. */
async function seedFromEnv(adminUid) {
  const seeded = await getSetting('api_key_seeded', 'false');
  if (seeded === 'true') return;
  for (const p of PROVIDERS) {
    const existing = await getSetting(sharedKeyName(p), '');
    const envVal = (process.env[ENV_MAP[p]] || '').trim();
    if (!existing && envVal) {
      await setSetting(sharedKeyName(p), encrypt(envVal), adminUid);
    }
  }
  await setSetting('api_key_seeded', 'true', adminUid);
}

module.exports = {
  PROVIDERS, PROVIDER_LABEL,
  resolveApiKey, missingKeyError,
  getMode, setMode,
  setSharedKey, setUserKey,
  getStatus, seedFromEnv, maskKey,
};
