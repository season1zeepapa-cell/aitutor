// AWS Lambda Express 핸들러 — 이메일 인증코드 발송
//
// 실행 전 DB 테이블 생성 필요:
// CREATE TABLE IF NOT EXISTS email_verifications (
//   id SERIAL PRIMARY KEY,
//   email VARCHAR(255) NOT NULL,
//   code VARCHAR(6) NOT NULL,
//   type VARCHAR(20) DEFAULT 'signup',
//   expires_at TIMESTAMP NOT NULL,
//   used BOOLEAN DEFAULT false,
//   created_at TIMESTAMP DEFAULT NOW()
// );
// CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);

const { query } = require('./db');
const { withCors } = require('./middleware');
const { isSignupDisabled } = require('./_runtime/settings');

// 인메모리 Rate limit (1분 2회, IP 기준)
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  if (entry.count > 2) return true;
  return false;
}

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const { email, type = 'signup' } = req.body || {};

  // signup 타입만 회원가입 차단 적용. password reset 등 type 은 그대로 동작.
  if (type === 'signup' && await isSignupDisabled()) {
    return res.status(503).json({
      error: '회원가입은 현재 준비중입니다. 잠시만 기다려주세요.',
      code: 'SIGNUP_DISABLED',
    });
  }

  if (!email) {
    return res.status(400).json({ error: '이메일을 입력해주세요.' });
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
  }

  // Rate limit (1분 2회)
  const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  if (checkRateLimit(ip)) {
    return res.status(429).json({ error: '요청이 너무 잦습니다. 1분 후 다시 시도해주세요.' });
  }

  // type에 따른 중복/미가입 체크 (username 또는 email 컬럼)
  const existing = await query('SELECT id FROM public.users WHERE username = $1 OR email = $1', [email]);

  if (type === 'signup' && existing.rows.length > 0) {
    return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
  }
  if ((type === 'reset' || type === 'login') && existing.rows.length === 0) {
    return res.status(404).json({ error: '가입되지 않은 이메일입니다.' });
  }

  // 6자리 인증코드 생성
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // DB에 저장 (10분 유효)
  await query(
    `INSERT INTO email_verifications (email, code, type, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
    [email, code, type]
  );

  // Resend로 이메일 발송
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[Verify] RESEND_API_KEY 미설정');
    return res.status(500).json({ error: '이메일 서비스를 사용할 수 없습니다.' });
  }

  const purposeLabel = type === 'login' ? '로그인' : type === 'reset' ? '비밀번호 재설정' : '회원가입';

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'AI TutorTwo <noreply@newsstand.blog>',
      to: [email],
      subject: `[AI TutorTwo] ${purposeLabel} 인증코드: ${code}`,
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
          <h2 style="color:#6366f1;margin-bottom:8px">AI TutorTwo ${purposeLabel}</h2>
          <p style="color:#555;font-size:14px">아래 인증코드를 입력해주세요.</p>
          <div style="background:#f0f4ff;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4f46e5">${code}</span>
          </div>
          <p style="color:#888;font-size:12px">이 코드는 10분간 유효합니다.</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const errData = await emailRes.json().catch(() => ({}));
    console.error('[Verify] Resend 발송 실패:', errData);
    return res.status(500).json({ error: '인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }

  console.log(`[Verify] 인증코드 발송: ${email} (type=${type})`);
  res.json({ message: '인증코드가 발송되었습니다. 이메일을 확인해주세요.' });
});
