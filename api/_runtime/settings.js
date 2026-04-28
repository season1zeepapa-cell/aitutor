// 런타임 설정 헬퍼 — DB 기반 무재배포 토글 (REBUILD16 §3.4 대안)
//
// 패턴:
//   - DB 의 aitutor_settings 테이블에서 key/value 읽기
//   - 30초 in-memory cache 로 핫 패스 DB 부하 최소화
//   - setSetting 호출 시 즉시 캐시 무효화 → 같은 Lambda 인스턴스에선 즉시 반영
//   - 다른 Lambda 인스턴스는 최대 30초 후 반영 (eventual consistency, 실용적 허용)
//
// 사용 예:
//   const { isSignupDisabled, setSetting } = require('./_runtime/settings');
//   if (await isSignupDisabled()) { ... }
//   await setSetting('signup_disabled', false, req.user.uid);

const { query } = require('../db');

const TTL_MS = 30 * 1000;          // 캐시 유효시간 30초 (Lambda 인스턴스 한정)
const cache = new Map();           // key → { value, expires }

/** 단일 설정값 조회 (cache → DB fallback) */
async function getSetting(key, defaultValue = null) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    const r = await query('SELECT value FROM aitutor_settings WHERE key = $1', [key]);
    const value = r.rows[0]?.value ?? defaultValue;
    cache.set(key, { value, expires: Date.now() + TTL_MS });
    return value;
  } catch (err) {
    // DB 장애 시 안전한 기본값 반환 (회원가입은 차단된 채로 유지)
    console.error(`[settings] getSetting('${key}') 실패:`, err.message);
    return defaultValue;
  }
}

/** 전체 설정 조회 (관리자 UI용) */
async function getAllSettings() {
  const r = await query(
    `SELECT key, value, updated_at, updated_by
     FROM aitutor_settings
     ORDER BY key`
  );
  return r.rows;
}

/** 설정 저장 — INSERT ... ON CONFLICT UPDATE + 캐시 즉시 무효화 */
async function setSetting(key, value, updatedBy = null) {
  // value 는 항상 TEXT 로 저장. boolean 은 'true'/'false' 문자열로 통일.
  const stringValue = typeof value === 'boolean' ? String(value) : String(value ?? '');
  await query(
    `INSERT INTO aitutor_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [key, stringValue, updatedBy]
  );
  cache.delete(key);  // 같은 Lambda 인스턴스는 다음 호출에서 즉시 새 값 반영
}

// ─── 편의 함수 ───

/** 회원가입 차단 여부. 키 누락 시 안전 기본값 = true (차단) */
async function isSignupDisabled() {
  const v = await getSetting('signup_disabled', 'true');
  return v === 'true';
}

module.exports = {
  getSetting,
  getAllSettings,
  setSetting,
  isSignupDisabled,
};
