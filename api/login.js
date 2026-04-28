// AWS Lambda Express 핸들러 - 로그인 API (DB + HMAC JWT)
const crypto = require('crypto');
const { signToken, TOKEN_SECRET } = require('./auth');
const { query } = require('./db');

// 로그인 브루트포스 방어: DB 기반 IP 제한 (서버리스 환경 대응)
// login_attempts 테이블이 없으면 자동 생성
let tableChecked = false;
async function ensureRateLimitTable() {
  if (tableChecked) return;
  await query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 minute')
    )
  `);
  tableChecked = true;
}

async function checkLoginLimit(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  try {
    await ensureRateLimitTable();
    // 만료된 기록 삭제 + 현재 시도 횟수 확인/증가 (원자적)
    await query(`DELETE FROM login_attempts WHERE reset_at < NOW()`);
    const result = await query(`
      INSERT INTO login_attempts (ip, count, reset_at)
      VALUES ($1, 1, NOW() + INTERVAL '1 minute')
      ON CONFLICT (ip) DO UPDATE SET count = login_attempts.count + 1
      RETURNING count, EXTRACT(EPOCH FROM (reset_at - NOW()))::int AS retry_after
    `, [ip]);
    const { count, retry_after } = result.rows[0];
    if (count > 5) {
      res.status(429).json({ error: `로그인 시도가 너무 많습니다. ${retry_after}초 후 다시 시도해주세요.` });
      return true;
    }
  } catch (err) {
    // DB 오류 시 rate limit 건너뛰기 (로그인 자체는 허용)
    console.error('[RateLimit] DB 오류:', err.message);
  }
  return false;
}

// scrypt 파라미터 (signup.js와 동일)
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const SCRYPT_KEYLEN = 64;

// 비밀번호 검증 — 저장 형식에 따라 자동 분기
//   신규: "scrypt:salt:hash" → scrypt 검증
//   레거시: "salt:sha256hex" → SHA-256 검증 (하위 호환)
function verifyPassword(inputPassword, storedHash) {
  if (storedHash.startsWith('scrypt:')) {
    const [, salt, hash] = storedHash.split(':');
    return new Promise((resolve, reject) => {
      crypto.scrypt(inputPassword, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derived) => {
        if (err) return reject(err);
        const inputBuf = derived;
        const storedBuf = Buffer.from(hash, 'hex');
        if (inputBuf.length !== storedBuf.length) return resolve(false);
        resolve(crypto.timingSafeEqual(inputBuf, storedBuf));
      });
    });
  }
  // 레거시 SHA-256 형식
  const [salt, hash] = storedHash.split(':');
  const inputHash = crypto.createHash('sha256').update(salt + inputPassword).digest('hex');
  const inputBuf = Buffer.from(inputHash);
  const storedBuf = Buffer.from(hash);
  if (inputBuf.length !== storedBuf.length) return Promise.resolve(false);
  return Promise.resolve(crypto.timingSafeEqual(inputBuf, storedBuf));
}

const { withCors } = require('./middleware');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  // 브루트포스 방어: DB 기반 IP 제한 (1분 5회)
  if (await checkLoginLimit(req, res)) return;

  const { email, code, password, id } = req.body || {};

  // 하위 호환: email 또는 기존 id 필드 모두 허용
  const loginId = email || id;

  if (!loginId) {
    return res.status(400).json({ error: '이메일을 입력해주세요.' });
  }

  // 인증코드 방식 (code가 있으면) 또는 비밀번호 방식 (하위 호환)
  if (code) {
    // 인증코드 확인
    const verification = await query(
      `SELECT id FROM email_verifications
       WHERE email = $1 AND code = $2 AND type = 'login' AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [loginId, code]
    );
    if (verification.rows.length === 0) {
      return res.status(401).json({ error: '인증코드가 유효하지 않습니다.' });
    }
    // 인증코드 사용 처리
    await query('UPDATE email_verifications SET used = true WHERE id = $1', [verification.rows[0].id]);
  } else if (password) {
    // 비밀번호 방식 (하위 호환)
    const pwResult = await query(
      'SELECT id, password_hash FROM public.users WHERE username = $1 OR email = $1',
      [loginId]
    );
    if (pwResult.rows.length === 0 || !await verifyPassword(password, pwResult.rows[0].password_hash)) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
  } else {
    return res.status(400).json({ error: '인증코드 또는 비밀번호를 입력해주세요.' });
  }

  // 사용자 조회
  const result = await query(
    'SELECT id, username, email, name, is_admin FROM public.users WHERE username = $1 OR email = $1',
    [loginId]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: '가입되지 않은 이메일입니다.' });
  }

  const user = result.rows[0];

  // HMAC JWT 발급 (관리자 여부 포함, email 필드 추가)
  const token = signToken(
    { sub: user.username, email: user.username, uid: user.id, name: user.name, admin: !!user.is_admin },
    TOKEN_SECRET,
    '7d'
  );

  // HttpOnly 쿠키로 토큰 전송 (XSS 탈취 방지)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  res.setHeader('Set-Cookie', [
    `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isProduction ? '; Secure' : ''}`,
  ]);
  console.log(`[Auth] 로그인 성공: ${user.username} (${user.name}) admin=${!!user.is_admin}`);
  res.json({ name: user.name, admin: !!user.is_admin });
});
