// AWS Lambda Express 핸들러 — Gemini API 프록시 (SSE 스트리밍 지원).
// REBUILD16 §8 — _llm/gemini.js 공통 fetch 헬퍼 사용으로 단순화.
const { withAuth } = require('./middleware');
const gemini = require('./_llm/gemini');

const SYSTEM_PROMPT =
  '당신은 영상정보관리사 자격증 시험 전문 강사입니다. 주어진 문제를 분석하고 다음 형식으로 답변해주세요:\n\n' +
  '**정답**: [번호 및 내용]\n\n' +
  '**해설**: [상세한 해설]\n\n' +
  '**핵심 키워드**: [관련 법령, 용어 등]';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const ALLOWED_MODELS = [
  // Gemini 3.x
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  // Gemini 2.5
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // Gemini 2.0
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];
// Thinking 지원 모델 prefix
const THINKING_MODEL_PREFIX = ['gemini-3', 'gemini-2.5'];

/** 모델별 thinking 옵션 → generationConfig.extra 로 변환 */
function buildThinkingExtra(model, { thinkingBudget, thinkingLevel }) {
  const supportsThinking = THINKING_MODEL_PREFIX.some(p => model.startsWith(p));
  if (!supportsThinking) return undefined;
  const isGemini3 = model.startsWith('gemini-3');
  if (isGemini3 && thinkingLevel && ['low', 'medium', 'high'].includes(thinkingLevel)) {
    return { thinkingConfig: { thinkingLevel } };
  }
  if (!isGemini3) {
    const budget = parseInt(thinkingBudget) || 0;
    if (budget > 0) return { thinkingConfig: { thinkingBudget: budget } };
  }
  return undefined;
}

/** 사용자 입력 + (선택) 이미지를 헬퍼 메시지 형식으로 변환 */
function buildMessages({ text, imageBase64, mimeType }) {
  const userContent = [{ type: 'text', text: SYSTEM_PROMPT + '\n\n' + (text || '') }];
  if (imageBase64) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType || 'image/png', data: imageBase64 },
    });
  }
  return [{ role: 'user', content: userContent }];
}

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용됩니다.' });

  try {
    const {
      text, imageBase64, mimeType, model,
      temperature, thinkingBudget, thinkingLevel, maxTokens,
      stream: useStream,
    } = req.body || {};

    const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    const messages = buildMessages({ text, imageBase64, mimeType });
    const generationConfigExtra = buildThinkingExtra(selectedModel, { thinkingBudget, thinkingLevel });

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      await gemini.chatStream({
        model: selectedModel,
        messages,
        maxTokens: parseInt(maxTokens) || 2048,
        temperature,
        generationConfigExtra,
        userId: req.user?.uid,
        action: 'card_explain',
        onText: (t) => res.write(`data: ${JSON.stringify({ t })}\n\n`),
        onDone: () => { res.write('data: [DONE]\n\n'); res.end(); },
        onError: (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
      });
      return;
    }

    // 일반 모드
    const { text: answer } = await gemini.chat({
      model: selectedModel,
      messages,
      maxTokens: parseInt(maxTokens) || 2048,
      temperature,
      generationConfigExtra,
      userId: req.user?.uid,
      action: 'card_explain',
    });
    res.json({ answer: answer || '응답 없음' });
  } catch (err) {
    console.error('[Gemini] 에러:', err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
