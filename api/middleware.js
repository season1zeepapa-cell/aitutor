// API 미들웨어 통합 — CORS + 인증 + 에러 핸들링
const { setCorsHeaders } = require('./cors');
const { verifyToken, extractToken } = require('./auth');

// withCors — CORS + OPTIONS 처리만 (공개 API용)
function withCors(handler) {
  return async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[API] ${req.url} 에러:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  };
}

// withAuth — CORS + 인증 필수 (로그인 사용자용)
function withAuth(handler) {
  return async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    const payload = verifyToken(extractToken(req));
    if (!payload) return res.status(401).json({ error: '로그인이 필요합니다.' });
    req.user = payload;
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[API] ${req.url} 에러:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  };
}

// withAdmin — CORS + 관리자 권한 필수
function withAdmin(handler) {
  return async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    const payload = verifyToken(extractToken(req));
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    if (!payload.admin) return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    req.user = payload;
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[API] ${req.url} 에러:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  };
}

module.exports = { withCors, withAuth, withAdmin };
