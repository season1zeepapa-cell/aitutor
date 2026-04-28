// AWS Lambda 회원가입 API (이메일 기반)
// username 컬럼에 이메일을 저장하여 하위 호환성 유지
// 회원가입 성공 시 JWT 토큰을 HttpOnly 쿠키로 자동 발급 → 바로 로그인 상태 진입
//
// 회원가입 차단 여부는 DB 의 aitutor_settings.signup_disabled 로 관리 (관리자 UI 토글).
const crypto = require('crypto');
const { query } = require('./db');
const { signToken, TOKEN_SECRET } = require('./auth');
const { isSignupDisabled } = require('./_runtime/settings');

// scrypt 파라미터: N=16384, r=8, p=1, keyLen=64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const SCRYPT_KEYLEN = 64;

// 비밀번호 해싱 (scrypt — GPU brute-force 내성)
// 저장 형식: "scrypt:salt:hash"
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derived.toString('hex')}`);
    });
  });
}

const { withCors } = require('./middleware');

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  // 회원가입 차단 — DB 토글 (관리자가 설정 → 회원관리에서 즉시 변경 가능)
  if (await isSignupDisabled()) {
    return res.status(503).json({
      error: '회원가입은 현재 준비중입니다. 잠시만 기다려주세요.',
      code: 'SIGNUP_DISABLED',
    });
  }

  const { email, name, code } = req.body || {};

  // 필수 필드 검증 (비밀번호 불필요 — 인증코드 로그인 방식)
  if (!email || !name || !code) {
    return res.status(400).json({ error: '이메일, 이름, 인증코드를 모두 입력해주세요.' });
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
  }

  if (name.length > 20) {
    return res.status(400).json({ error: '이름은 20자 이내로 입력해주세요.' });
  }

  // 인증코드 확인
  const verification = await query(
    `SELECT id FROM email_verifications
     WHERE email = $1 AND code = $2 AND used = false AND expires_at > NOW()`,
    [email, code]
  );
  if (verification.rows.length === 0) {
    return res.status(400).json({ error: '인증코드가 유효하지 않습니다.' });
  }

  // 이메일 중복 확인 (username과 email 둘 다 체크)
  const existing = await query('SELECT id FROM public.users WHERE username = $1 OR email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
  }

  // DB 저장 (비밀번호 없이 — 인증코드 로그인 방식)
  // RETURNING으로 방금 생성된 row의 id/is_admin을 바로 받아 토큰 페이로드에 사용
  const insertResult = await query(
    'INSERT INTO public.users (username, email, name) VALUES ($1, $1, $2) RETURNING id, is_admin',
    [email, name]
  );
  const user = insertResult.rows[0];

  // 인증코드 사용 처리
  await query(
    'UPDATE email_verifications SET used = true WHERE email = $1 AND code = $2',
    [email, code]
  );

  // 🆕 자동 로그인: HMAC JWT 발급 → HttpOnly 쿠키로 전송 (login.js와 동일)
  const token = signToken(
    { sub: email, email, uid: user.id, name, admin: !!user.is_admin },
    TOKEN_SECRET,
    '7d'
  );
  // Lambda/Vercel/Production 환경에서는 Secure 플래그 필수 (HTTPS 전제)
  const isProduction = process.env.NODE_ENV === 'production'
    || process.env.VERCEL
    || process.env.AWS_LAMBDA_FUNCTION_NAME;
  res.setHeader('Set-Cookie', [
    `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isProduction ? '; Secure' : ''}`,
  ]);

  console.log(`[Auth] 회원가입 성공: ${email} (${name}) — 자동 로그인 토큰 발급`);
  res.json({ name, admin: !!user.is_admin, message: '회원가입이 완료되었습니다!' });
});
