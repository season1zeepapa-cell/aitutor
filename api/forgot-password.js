// AWS Lambda Express 핸들러 — 비밀번호 재설정
const crypto = require('crypto');
const { query } = require('./db');
const { withCors } = require('./middleware');

// scrypt 파라미터 (signup.js와 동일)
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const SCRYPT_KEYLEN = 64;

// 비밀번호 해싱
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derived.toString('hex')}`);
    });
  });
}

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const { email, code, newPassword } = req.body || {};

  // 필수 필드 검증
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: '이메일, 인증코드, 새 비밀번호를 모두 입력해주세요.' });
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
  }

  // 비밀번호 정책: 8자 이상 + 영문 + 숫자
  if (newPassword.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상으로 입력해주세요.' });
  }
  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: '비밀번호는 영문과 숫자를 모두 포함해야 합니다.' });
  }

  // 인증코드 확인 (type=reset)
  const verification = await query(
    `SELECT id FROM email_verifications
     WHERE email = $1 AND code = $2 AND type = 'reset' AND used = false AND expires_at > NOW()`,
    [email, code]
  );
  if (verification.rows.length === 0) {
    return res.status(400).json({ error: '인증코드가 유효하지 않습니다.' });
  }

  // 사용자 존재 확인 (username 또는 email 컬럼)
  const userResult = await query('SELECT id FROM public.users WHERE username = $1 OR email = $1', [email]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: '가입되지 않은 이메일입니다.' });
  }

  // 비밀번호 해싱 + DB 업데이트
  const passwordHash = await hashPassword(newPassword);
  await query(
    'UPDATE public.users SET password_hash = $1 WHERE username = $2 OR email = $2',
    [passwordHash, email]
  );

  // 인증코드 사용 처리
  await query(
    `UPDATE email_verifications SET used = true WHERE email = $1 AND code = $2`,
    [email, code]
  );

  console.log(`[Auth] 비밀번호 재설정 완료: ${email}`);
  res.json({ message: '비밀번호가 변경되었습니다.' });
});
