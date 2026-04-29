// CORS 공통 헬퍼 — 허용된 Origin만 접근  [REBUILD23: AWS → GCP]
// 정규식/문자열 혼합 매칭 (해시 변동 도메인 대응)
const ALLOWED_ORIGINS = [
  // GCP Cloud Run (프로덕션 사용자 접점, REBUILD23)
  /^https:\/\/[a-z0-9-]+\.run\.app$/,
  /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z]{2}\.a\.run\.app$/,
  // Capacitor 네이티브 앱 내부 scheme (iOS/Android WebView)
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  // 기존 Vercel (롤백 대비 유지, 1~2주 후 제거)
  'https://aitutor-six.vercel.app',
  // AWS CloudFront (Phase 6 폐기 시까지 1~2주 병렬 운영)
  'https://d2dcsdi9b1j2rf.cloudfront.net',
  /^https:\/\/[a-z0-9]+\.cloudfront\.net$/,
  // 로컬 개발
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:8080',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(o =>
    typeof o === 'string' ? o === origin : o.test(origin)
  );
}

function setCorsHeaders(req, res) {
  const origin = req.headers?.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { setCorsHeaders, isAllowedOrigin, ALLOWED_ORIGINS };
