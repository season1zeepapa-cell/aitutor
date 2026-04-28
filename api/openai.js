// AWS Lambda Express 핸들러 — OpenAI Chat Completions 프록시 (SSE 스트리밍).
// REBUILD16 §8 — _llm/openai-chat.js 공통 fetch 헬퍼 사용으로 단순화 (openai SDK 의존 제거).
const { withAuth } = require('./middleware');
const openai = require('./_llm/openai-chat');

const SYSTEM_PROMPT =
  '당신은 영상정보관리사 자격증 시험 전문 강사입니다. 주어진 문제를 분석하고 다음 형식으로 답변해주세요:\n\n' +
  '**정답**: [번호 및 내용]\n\n' +
  '**해설**: [상세한 해설]\n\n' +
  '**핵심 키워드**: [관련 법령, 용어 등]';

const DEFAULT_MODEL = 'gpt-4o';
const ALLOWED_MODELS = [
  // GPT-5.4 (최신 플래그십)
  'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano',
  // GPT-5.3 (ChatGPT 최신)
  'gpt-5.3-chat-latest',
  // GPT-5.x
  'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
  // o-시리즈
  'o3-pro', 'o4-mini', 'o3', 'o3-mini', 'o1-mini', 'o1',
  // GPT-4.1 / GPT-4o
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-4o', 'gpt-4o-mini',
];

/** 사용자 입력(텍스트 + 선택 이미지)을 OpenAI 메시지 형식으로 변환 */
function buildUserContent({ text, imageBase64, mimeType }) {
  if (!imageBase64) return text;
  return [
    { type: 'image_url', image_url: { url: `data:${mimeType || 'image/png'};base64,${imageBase64}` } },
    { type: 'text', text },
  ];
}

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });

  try {
    const {
      text, imageBase64, mimeType, model,
      temperature, reasoningEffort, maxTokens,
      stream: useStream,
    } = req.body || {};

    const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    const userContent = buildUserContent({ text, imageBase64, mimeType });
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },  // 헬퍼가 o-series 인 경우 'developer' 역할로 자동 변환
      { role: 'user', content: userContent },
    ];
    const tokens = (maxTokens && parseInt(maxTokens) > 0) ? parseInt(maxTokens) : 2048;

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      console.log('[OpenAI] 스트리밍 요청:', selectedModel,
        'reasoning:', reasoningEffort || '-',
        'temperature:', temperature ?? '-');

      let hasContent = false;
      let refusalText = '';
      await openai.chatStream({
        model: selectedModel,
        messages,
        maxTokens: tokens,
        temperature,
        reasoningEffort,
        userId: req.user?.uid,
        action: 'card_explain',
        onText: (t) => {
          hasContent = true;
          res.write(`data: ${JSON.stringify({ t })}\n\n`);
        },
        onRefusal: (r) => { refusalText += r; },
        onDone: () => {
          if (refusalText) {
            console.warn('[OpenAI] 모델 거부:', selectedModel, refusalText.slice(0, 200));
            res.write(`data: ${JSON.stringify({ error: '모델 거부: ' + refusalText })}\n\n`);
          } else if (!hasContent) {
            console.warn('[OpenAI] 빈 응답:', selectedModel);
            res.write(`data: ${JSON.stringify({ error: 'AI가 빈 응답을 반환했습니다. 다른 모델을 시도해주세요.' })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
        },
        onError: (err) => {
          console.error('[OpenAI] 스트리밍 에러:', err.message);
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
      });
      return;
    }

    // 일반 모드 (하위 호환)
    console.log('[OpenAI] 일반 모드 요청:', selectedModel);
    const { text: answer, refusal } = await openai.chat({
      model: selectedModel,
      messages,
      maxTokens: tokens,
      temperature,
      reasoningEffort,
      userId: req.user?.uid,
      action: 'card_explain',
    });
    if (refusal && !answer) {
      return res.status(400).json({ error: '모델 거부: ' + refusal });
    }
    res.json({ answer });
  } catch (err) {
    console.error('[OpenAI] 에러:', err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
