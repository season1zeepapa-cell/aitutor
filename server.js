// Express 로컬 개발 서버 — API 프록시 + 정적 파일 서빙
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3002;

// 미들웨어
app.use(express.json({ limit: '10mb' }));

// API 라우트 등록 — api/*.js 각각 마운트
const apiFiles = [
  'login', 'signup', 'auth',
  'questions', 'explanations', 'categories',
  'memos', 'memo-files',
  'gemini', 'openai', 'claude',
  'law', 'admin', 'import-docstore',
];

apiFiles.forEach(name => {
  try {
    const handler = require(`./api/${name}`);
    // GET + POST + OPTIONS 모두 등록
    app.all(`/api/${name}`, (req, res) => handler(req, res));
    app.all(`/api/${name}/*`, (req, res) => handler(req, res));
  } catch (err) {
    console.warn(`[Server] api/${name}.js 로드 실패:`, err.message);
  }
});

// 프로덕션: dist/ 정적 파일 서빙
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA 폴백
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[AI Tutor] http://localhost:${PORT}`);
});

module.exports = app;
