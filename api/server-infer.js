// REBUILD23 — server-ai / server-ai-gguf 실험실 백엔드 (Cloud Run 일심동체 통합)
//
// 변경 내역 (vs Lambda 시절):
//   - SigV4 invokeLambda 제거 (외부 inference Lambda 호출 X)
//   - 같은 컨테이너 내부 Ollama (port 11434) stream API 로 forward
//
// 클라이언트 호환성 유지:
//   - URL : POST /api/server-infer/{model_key}
//   - body: { question: {body, choices, answer, ...}, maxTokens, temperature }
//   - SSE 응답:
//       data: { type: 'meta',  model, family, label }
//       data: { type: 'token', token: '...' }
//       data: { type: 'done',  latency_ms, output_chars, output_tokens }
//
// model_key 매핑 (UI 호환):
//   e2b/e4b           — Gemma 3n E2B/E4B (server-ai 실험실: ONNX 컨셉을 GGUF 로 통합)
//   qwen35-4b         — Qwen 3 4B Instruct (server-ai 실험실)
//   e2b-gguf/e4b-gguf — Gemma 3n E2B/E4B (server-ai-gguf 실험실, 같은 모델 다른 라우트)

const { withCors } = require('./middleware');
const { extractToken, verifyToken } = require('./auth');

const OLLAMA_URL = `http://127.0.0.1:${process.env.OLLAMA_PORT || 11434}`;

// model_key → Ollama 모델 매핑 (Ollama 공식 라이브러리 태그)
const MODEL_MAP = {
  'e2b':       { ollama: 'gemma3n:e2b', label: 'Gemma 3n E2B',        family: 'gemma' },
  'e4b':       { ollama: 'gemma3n:e4b', label: 'Gemma 3n E4B',        family: 'gemma' },
  'qwen35-4b': { ollama: 'qwen3:4b',    label: 'Qwen 3 4B',           family: 'qwen'  },
  'e2b-gguf':  { ollama: 'gemma3n:e2b', label: 'Gemma 3n E2B (GGUF)', family: 'gemma' },
  'e4b-gguf':  { ollama: 'gemma3n:e4b', label: 'Gemma 3n E4B (GGUF)', family: 'gemma' },
};

// 자격증 시험 해설용 프롬프트 (LocalLambdaTester / ServerAiTester 와 동일 형식)
const CIRCLE = ['①', '②', '③', '④', '⑤'];

function buildPrompt(question) {
  const choices = question.choices || [];
  const choicesText = choices.map((c, i) => `${CIRCLE[i] || '·'} ${c}`).join('\n');
  const answerLabel = CIRCLE[(question.answer || 1) - 1] || '①';
  return `자격증 시험 강사로서 한국어로 정답 해설.
「법령명」 인용. 보기별 한 줄 설명.

[문제]
${question.body || ''}

[보기]
${choicesText}

[정답] ${answerLabel}

각 보기가 왜 맞고 틀린지 한 줄씩 설명해주세요.`;
}

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 만 허용' });
  }

  // 인증 (Bearer 토큰 또는 쿠키)
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // model_key 추출 (URL 의 마지막 path segment)
  const url = req.originalUrl || req.url || '';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const modelKey = parts[parts.length - 1];
  const meta = MODEL_MAP[modelKey];
  if (!meta) {
    return res.status(404).json({ error: 'unknown_model', modelKey, available: Object.keys(MODEL_MAP) });
  }

  const { question, maxTokens = 512, temperature = 0.3 } = req.body || {};
  if (!question || typeof question !== 'object') {
    return res.status(400).json({ error: 'question 객체가 필요합니다.' });
  }

  // SSE 헤더
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  // meta 이벤트 즉시 전송 (콜드 스타트 사용자 안내용)
  res.write(`data: ${JSON.stringify({
    type: 'meta',
    model: meta.ollama,
    family: meta.family,
    label: meta.label,
    rate_limit: null,
  })}\n\n`);
  if (typeof res.flush === 'function') res.flush();

  // keep-alive (긴 콜드 스타트 시 connection drop 방지)
  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch {}
  }, 25 * 1000);

  const t0 = Date.now();
  let outputChars = 0;
  let outputTokens = 0;

  try {
    // 모델 자동 pull (없으면) — 첫 호출 시 ~30s~7분 (모델 사이즈에 따라)
    const tagsResp = await fetch(`${OLLAMA_URL}/api/tags`);
    const { models = [] } = tagsResp.ok ? await tagsResp.json() : { models: [] };
    const has = models.some(m => m.name === meta.ollama || m.model === meta.ollama);
    if (!has) {
      res.write(`data: ${JSON.stringify({
        type: 'pull',
        message: `모델 다운로드 중: ${meta.ollama} (~수십초~수분)`,
      })}\n\n`);
      if (typeof res.flush === 'function') res.flush();

      const pullT0 = Date.now();
      const pullResp = await fetch(`${OLLAMA_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: meta.ollama, stream: false }),
      });
      if (!pullResp.ok) {
        const errText = await pullResp.text();
        clearInterval(keepAlive);
        res.write(`data: ${JSON.stringify({
          error: 'ollama_pull_failed',
          model: meta.ollama,
          body: errText.slice(0, 300),
        })}\n\n`);
        return res.end();
      }
      res.write(`data: ${JSON.stringify({
        type: 'pull_done',
        ms: Date.now() - pullT0,
      })}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    }

    const prompt = buildPrompt(question);

    // Ollama stream API 호출 (NDJSON)
    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: meta.ollama,
        messages: [
          { role: 'system', content: '당신은 한국어 자격증 시험 전문 강사입니다. 정답을 정확히 설명하고 관련 법령을 인용하세요.' },
          { role: 'user', content: prompt },
        ],
        stream: true,
        options: { num_predict: maxTokens, temperature },
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      clearInterval(keepAlive);
      res.write(`data: ${JSON.stringify({
        error: 'ollama_error',
        statusCode: upstream.status,
        body: errText.slice(0, 300),
      })}\n\n`);
      return res.end();
    }

    // Ollama NDJSON stream 파싱 (한 줄 = 한 chunk JSON)
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          const tokenText = chunk.message?.content || '';
          if (tokenText) {
            outputChars += tokenText.length;
            outputTokens += 1;
            res.write(`data: ${JSON.stringify({ type: 'token', token: tokenText })}\n\n`);
            if (typeof res.flush === 'function') res.flush();
          }
          if (chunk.done) {
            clearInterval(keepAlive);
            res.write(`data: ${JSON.stringify({
              type: 'done',
              latency_ms: Date.now() - t0,
              output_chars: outputChars,
              output_tokens: outputTokens,
            })}\n\n`);
          }
        } catch { /* JSON 파싱 실패는 stream 중 부분 chunk — skip */ }
      }
    }
    clearInterval(keepAlive);
    res.end();
  } catch (e) {
    clearInterval(keepAlive);
    console.error('[server-infer]', e);
    try {
      res.write(`data: ${JSON.stringify({ error: 'server_infer_failed', message: e.message })}\n\n`);
      res.end();
    } catch {}
  }
});
