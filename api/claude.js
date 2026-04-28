// AWS Lambda Express 핸들러 — Claude/Anthropic API 프록시 (SSE 스트리밍 지원).
// REBUILD16 §8 — _llm/anthropic.js 공통 fetch 헬퍼 사용으로 단순화.
const { withAuth } = require('./middleware');
const anthropic = require('./_llm/anthropic');

const SYSTEM_PROMPT =
  '당신은 자격증 시험 전문 강사입니다. 주어진 문제를 분석하고 다음 형식으로 답변해주세요:\n\n' +
  '**정답**: [번호 및 내용]\n\n' +
  '**해설**: [상세한 해설]\n\n' +
  '**핵심 키워드**: [관련 법령, 용어 등]';

const ALLOWED_MODELS = [
  // Claude 4.6 (최신)
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  // Claude 4.5 / 4
  'claude-sonnet-4-5',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
];
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/** 사용자 입력(텍스트 + 선택 이미지)을 Anthropic 메시지 형식으로 변환 */
function buildUserContent({ text, imageBase64, mimeType }) {
  if (!imageBase64) return text;
  return [
    { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/png', data: imageBase64 } },
    { type: 'text', text },
  ];
}

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const {
      text, imageBase64, mimeType, model,
      temperature, maxTokens, stream: useStream,
    } = req.body || {};
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    const userContent = buildUserContent({ text, imageBase64, mimeType });
    const messages = [{ role: 'user', content: userContent }];
    const tokens = (maxTokens && parseInt(maxTokens) > 0) ? parseInt(maxTokens) : 2048;
    const temp = (temperature !== undefined && temperature !== null) ? parseFloat(temperature) : 0.3;

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      await anthropic.chatStream({
        model: selectedModel,
        system: SYSTEM_PROMPT,
        messages,
        maxTokens: tokens,
        temperature: temp,
        userId: req.user?.uid,
        action: 'card_explain',
        onText: (t) => res.write(`data: ${JSON.stringify({ text: t })}\n\n`),
        onDone: () => { res.write('data: [DONE]\n\n'); res.end(); },
        onError: (err) => {
          res.write(`data: [ERROR] ${err.message}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
      });
      return;
    }

    // 일반 모드
    const { text: answer } = await anthropic.chat({
      model: selectedModel,
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: tokens,
      temperature: temp,
      userId: req.user?.uid,
      action: 'card_explain',
    });
    res.json({ text: answer });
  } catch (err) {
    console.error('[Claude] 에러:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Claude API 오류' });
    }
  }
});
