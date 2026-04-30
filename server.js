// Express 앱 — 로컬 개발 서버 + Cloud Run 컨테이너의 서빙 엔진 공용 (REBUILD23 마이그)
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Cloud Run 프록시 뒤에서 실제 클라이언트 IP 복원
app.set('trust proxy', true);
app.set('etag', false);

// pool-upload가 최대 20MB 업로드하므로 여유 있게 25MB
app.use(express.json({ limit: '25mb' }));

// 공통 보안 헤더 (Cloud Run 이 직접 외부 노출되므로 앱에서 직접 주입)
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
  // Cloud Run 일심동체 추론 (REBUILD23~26 — 앱+모델 같은 컨테이너, 외부 API 0, GPU L4)
  'local-infer',
  // 격리 추론 service 프록시 (REBUILD26 §3.2 — aitutor-inference Cloud Run 으로 forward)
  'iso-infer',
  // 디바이스 AI 사용량 기록 (REBUILD18 §3.4) — 프론트가 전송
  'usage-log',
  // server-infer 라우트 폐기 (REBUILD26 §7-1) — 일심동체 Ollama forward 만 하던 legacy.
  // 신규: /api/local-infer (일심동체) + /api/iso-infer (격리) 가 대체.
  'law', 'admin', 'import-docstore', 'pool-upload',
  'upload-sign',
  // 공개 런타임 설정 (회원가입 차단 토글 등)
  'config',
  // 사용자별 lab 설정 (REBUILD28 §11 — Ollama bridge URL/모델 등)
  'user-settings',
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

// 로컬 실행 시 + Cloud Run 컨테이너 모두 동일하게 listen (REBUILD23 이후)
if (require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 8080;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI TutorTwo] listening on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;
