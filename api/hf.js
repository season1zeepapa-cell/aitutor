// Hugging Face Inference Providers 프록시 — REBUILD22 §x
//   - 메인 Lambda 가 클라이언트 요청을 받아 HF API 로 forward
//   - SSE 스트리밍 지원 (메인 Lambda BUFFERED 라 client 도달까지 약간 지연되지만,
//     HF 응답 자체가 빠른 편이라 60s CloudFront timeout 안에 끝남)
//   - usage 자동 기록 (llm_usage_log 테이블)
//
// 호출 형태:
//   POST /api/hf
//   body: {
//     messages: [{role, content}, ...],
//     model: 'meta-llama/Llama-3.3-70B-Instruct',  // ALLOWED_MODELS 화이트리스트
//     temperature: 0.3,
//     maxTokens: 1024,
//     stream: true,
//     action: 'lab_hf_chat',  // usage-log 분류용
//   }

const { withAuth } = require('./middleware');
const hf = require('./_llm/hf-chat');
const { getAllowedIds } = require('./_runtime/hf-catalog');

// 카탈로그 fetch 실패 시 fallback default
const DEFAULT_MODEL = 'google/gemma-4-31B-it';

const ALLOWED_ACTIONS = new Set(['lab_hf_chat', 'card_explain', 'kisa_explain', 'kisa_grade']);

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  try {
    const {
      messages, model,
      temperature, maxTokens,
      stream: useStream,
      action,
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
    }

    // 동적 화이트리스트 — router /v1/models 에서 받은 ID 만 허용 (1h 캐시)
    let allowed;
    try {
      allowed = await getAllowedIds();
    } catch (e) {
      console.warn('[HF] 카탈로그 fetch 실패, default 모델 사용:', e.message);
      allowed = new Set([DEFAULT_MODEL]);
    }
    const selectedModel = allowed.has(model) ? model : DEFAULT_MODEL;
    const tokens = (maxTokens && parseInt(maxTokens, 10) > 0) ? parseInt(maxTokens, 10) : 1024;
    const actionTag = ALLOWED_ACTIONS.has(action) ? action : 'lab_hf_chat';

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      console.log('[HF] 스트리밍:', selectedModel, 'temp:', temperature ?? '-');

      let hasContent = false;
      await hf.chatStream({
        model: selectedModel,
        messages,
        maxTokens: tokens,
        temperature,
        userId: req.user?.uid,
        action: actionTag,
        onMeta: (meta) => {
          res.write(`data: ${JSON.stringify({ meta })}\n\n`);
        },
        onText: (t) => {
          hasContent = true;
          res.write(`data: ${JSON.stringify({ t })}\n\n`);
        },
        onDone: ({ inputTokens, outputTokens, latencyMs }) => {
          if (!hasContent) {
            console.warn('[HF] 빈 응답:', selectedModel);
            res.write(`data: ${JSON.stringify({ error: 'AI가 빈 응답을 반환했습니다. 다른 모델을 시도해주세요.' })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ done: true, inputTokens, outputTokens, latencyMs })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        onError: (err) => {
          console.error('[HF] 스트리밍 에러:', err.message);
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
      });
      return;
    }

    // 일반 모드 (단발)
    console.log('[HF] 일반:', selectedModel);
    const { text: answer, finish, usage } = await hf.chat({
      model: selectedModel,
      messages,
      maxTokens: tokens,
      temperature,
      userId: req.user?.uid,
      action: actionTag,
    });
    res.json({ answer, finish, usage });
  } catch (err) {
    console.error('[HF] 에러:', err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports.DEFAULT_MODEL = DEFAULT_MODEL;
