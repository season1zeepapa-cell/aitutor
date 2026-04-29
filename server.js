// Express 앱 — 로컬 개발 서버 + Lambda Container의 서빙 엔진 공용
// Lambda 환경에서는 lambda.js가 이 모듈을 require하고 app.listen은 호출되지 않음.
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Cloud Run/Lambda/CloudFront 등 프록시 뒤에서 실제 클라이언트 IP 복원
app.set('trust proxy', true);
app.set('etag', false);

// pool-upload가 최대 20MB 업로드하므로 여유 있게 25MB
app.use(express.json({ limit: '25mb' }));

// 공통 보안 헤더 (Function URL이 CloudFront 없이 직접 공개되므로 앱에서 직접 주입)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// API 라우트 등록
const apiFiles = [
  'login', 'signup', 'auth', 'send-verification', 'forgot-password', 'delete-account',
  'questions', 'explanations', 'categories',
  'memos', 'memo-files', 'bookmarks', 'exam-results',
  'gemini', 'openai', 'claude',
  // Hugging Face Inference Providers (REBUILD22 §x) — 오픈 모델 라우팅 (Llama/Qwen/DeepSeek/Mistral/Gemma)
  'hf',
  // HF 모델 카탈로그 (router /v1/models 동적 fetch + 1h 메모리 캐시)
  'hf-models',
  // Lambda 내부 GGUF 추론 (REBUILD22 §x — 일심동체, 외부 API 0)
  'local-infer',
  // 디바이스 AI 사용량 기록 (REBUILD18 §3.4) — 프론트가 전송
  'usage-log',
  // 서버 추론 프록시 (REBUILD21) — Raw HTTP + SigV4 (의존성 0)
  // ※ REBUILD22 §x: 프로덕션 트래픽은 CloudFront 가 /api/server-infer/* 를 별도
  //   라우터 Lambda Function URL (RESPONSE_STREAM) 로 분기시킨다.
  //   본 라우트는 로컬 개발 / ALB 직접 호출 시 fallback 으로 유지.
  'server-infer',
  'law', 'admin', 'import-docstore', 'pool-upload',
  'upload-sign',
  // 공개 런타임 설정 (회원가입 차단 토글 등)
  'config',
  // KISA 진단원 이수시험 드릴 모듈 (REBUILD13 이식)
  'kisa-admin', 'kisa-drill', 'kisa-attempt', 'kisa-review', 'kisa-exam',
  // KISA 학습 자료 (REBUILD14 확장 — 이론 학습 모드)
  'kisa-study',
];

apiFiles.forEach(name => {
  try {
    const handler = require(`./api/${name}`);
    app.all(`/api/${name}`, (req, res) => handler(req, res));
    app.all(`/api/${name}/*`, (req, res) => handler(req, res));
  } catch (err) {
    console.warn(`[Server] api/${name}.js 로드 실패:`, err.message);
  }
});

// 정적 파일 (Vite 빌드 산출물 dist/, q-images 포함)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, {
  etag: false,
  setHeaders: (res, filePath) => {
    const rel = path.relative(distPath, filePath).replace(/\\/g, '/');
    if (rel === 'index.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (rel.startsWith('assets/') || rel.startsWith('q-images/')) {
      // Vite hash 파일명 / 변경 없는 이미지는 immutable 1년
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// SPA 폴백 (/api/* 제외)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distPath, 'index.html'));
});

// 로컬 실행 시에만 listen (Lambda에서는 lambda.js가 이 모듈을 그대로 래핑)
if (require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 8080;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI TutorTwo] listening on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;
