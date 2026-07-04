// AES-256-GCM 대칭 암호화 — API 키를 DB에 저장할 때 사용 (REBUILD67)
//
// 목적: DB(aitutor_settings, aitutor_user_api_keys)에 저장되는 외부 LLM API 키를
//   평문이 아닌 "암호문"으로 보관한다. DB 백업/덤프가 유출돼도 이 비밀키가 없으면
//   키 자체는 복호화 불가 → 실사용 불가.
//
// 비밀키 출처: process.env.API_KEY_ENC_SECRET (없으면 기존 AUTH_TOKEN_SECRET 재사용).
//   실제 32바이트 대칭키는 scrypt 로 파생하므로 비밀키 길이는 자유롭다.
//   ⚠️ 비밀키가 바뀌면 기존 암호문은 복호화 불가(=키 재입력 필요) — 운영 시 고정 유지.
//
// 저장 포맷: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"

const crypto = require('crypto');

const RAW_SECRET = (process.env.API_KEY_ENC_SECRET || process.env.AUTH_TOKEN_SECRET || '').trim();

let _key = null;
function getKey() {
  if (_key) return _key;
  if (!RAW_SECRET) {
    throw new Error('API_KEY_ENC_SECRET(또는 AUTH_TOKEN_SECRET) 미설정 — API 키 암호화 불가');
  }
  // salt 고정 — 같은 비밀키 → 같은 파생키(복호화 재현성 필요). 비밀키 자체가 진짜 비밀.
  _key = crypto.scryptSync(RAW_SECRET, 'aitutor-apikey-enc-v1', 32);
  return _key;
}

/** 평문 → "v1:iv:tag:cipher"(base64). 빈 값이면 빈 문자열 반환. */
function encrypt(plain) {
  if (plain == null || plain === '') return '';
  const iv = crypto.randomBytes(12);                        // GCM 권장 IV 길이 12바이트
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                          // 위·변조 감지 태그
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** "v1:iv:tag:cipher" → 평문. 손상/비밀키 변경 등 실패 시 null. */
function decrypt(blob) {
  if (!blob || typeof blob !== 'string') return null;
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('[crypto] decrypt 실패:', err.message);
    return null;
  }
}

/** 암호화 비밀키가 설정돼 있는지 (UI 경고용) */
function hasSecret() { return !!RAW_SECRET; }

module.exports = { encrypt, decrypt, hasSecret };
