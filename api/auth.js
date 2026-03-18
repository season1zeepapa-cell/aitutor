// 인증 유틸리티 — docstore/lib/auth.js와 동일한 HMAC-SHA256 JWT 구현
// jsonwebtoken 패키지 제거, 직접 구현으로 의존성 최소화
const crypto = require('crypto');

// AUTH_TOKEN_SECRET 필수 — 32자 이상 필수 (예측 불가능한 서명 보장)
const TOKEN_SECRET = (process.env.AUTH_TOKEN_SECRET || '').trim();
const TOKEN_SECRET_VALID = TOKEN_SECRET.length >= 32;
if (!TOKEN_SECRET_VALID) {
  console.error('[Auth] AUTH_TOKEN_SECRET이 설정되지 않았거나 32자 미만입니다.');
  console.error('[Auth] 최소 32자 이상의 랜덤 문자열을 환경변수로 설정해주세요.');
}

// Base64URL 인코딩/디코딩
function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString();
}

// JWT 토큰 서명 생성
function signToken(payload, secret, expiresIn = '7d') {
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_TOKEN_SECRET이 32자 미만입니다. 토큰 서명을 거부합니다.');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  // 만료 시간 계산
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = { d: 86400, h: 3600, m: 60, s: 1 }[match[2]];
    payload.exp = Math.floor(Date.now() / 1000) + num * unit;
  }
  payload.iat = Math.floor(Date.now() / 1000);

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload)),
  ];
  const signature = crypto.createHmac('sha256', secret).update(segments.join('.')).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  segments.push(signature);
  return segments.join('.');
}

// JWT 토큰 검증 → 성공 시 payload 반환, 실패 시 null
function verifyToken(token) {
  if (!token || !TOKEN_SECRET_VALID) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // 서명 검증 (타이밍 공격 방어: timingSafeEqual 사용)
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(parts[0] + '.' + parts[1]).digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(parts[2]);
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

    const payload = JSON.parse(base64urlDecode(parts[1]));

    // 만료 체크
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// req에서 토큰 추출 (Authorization 헤더만 허용 — URL 파라미터 노출 방지)
function extractToken(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

module.exports = { signToken, verifyToken, extractToken, TOKEN_SECRET };
