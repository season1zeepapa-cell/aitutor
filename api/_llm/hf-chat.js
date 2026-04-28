// Hugging Face Inference Providers (OpenAI 호환) chat helper — REBUILD22 §x
// router.huggingface.co/v1/chat/completions 로 단발/스트리밍 호출 + usage 로깅.
//
// 특징:
//   - OpenAI 형식과 완전 호환 → buildBody 매우 단순 (o-series 분기 불필요)
//   - provider 자동 라우팅 (Together / SambaNova / Groq / Replicate 등)
//   - SSE 응답에 usage 필드 포함 (stream_options.include_usage)

const { parseSseBody, withTimeout } = require('./_utils');
const { logUsage } = require('./usage');

const ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';
const PROVIDER = 'hf';

function buildBody({ model, messages, maxTokens = 1024, temperature, stream }) {
  const body = { model, messages, max_tokens: maxTokens };
  if (temperature !== undefined && temperature !== null) {
    body.temperature = Number(temperature);
  }
  if (stream) body.stream = true;
  return body;
}

/** 단발 호출 (non-streaming) */
async function chat({
  model,
  messages,
  maxTokens,
  temperature,
  apiKey = process.env.HF_API_KEY,
  timeout = 60000,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('HF_API_KEY 미설정');
  const { signal, cancel } = withTimeout(timeout);
  const t0 = Date.now();
  try {
    const body = buildBody({ model, messages, maxTokens, temperature });
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const errMsg = (await res.text().catch(() => '')).slice(0, 400);
      await logUsage({
        provider: PROVIDER, model, action, userId, questionId,
        latencyMs: Date.now() - t0,
        success: false,
        errorMessage: `HTTP ${res.status}: ${errMsg}`,
      });
      const e = new Error(`HF ${res.status}${errMsg ? ': ' + errMsg : ''}`);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    await logUsage({
      provider: PROVIDER, model, action, userId, questionId,
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
      latencyMs: Date.now() - t0,
      success: true,
    });
    return {
      text: msg?.content || '',
      finish: data?.choices?.[0]?.finish_reason,
      usage: data?.usage,
      raw: data,
    };
  } finally {
    cancel();
  }
}

/** 스트리밍 호출 (SSE) */
async function chatStream({
  model,
  messages,
  maxTokens,
  temperature,
  apiKey = process.env.HF_API_KEY,
  timeout = 120000,
  onText,
  onMeta,
  onError,
  onDone,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('HF_API_KEY 미설정');
  if (typeof onText !== 'function') throw new Error('onText 콜백 필요');

  const { signal, cancel } = withTimeout(timeout);
  const t0 = Date.now();
  let inTok = null;
  let outTok = null;
  let logged = false;

  const finalize = async ({ success, errorMessage }) => {
    if (logged) return;
    logged = true;
    await logUsage({
      provider: PROVIDER, model, action, userId, questionId,
      inputTokens: inTok, outputTokens: outTok,
      latencyMs: Date.now() - t0,
      success, errorMessage,
      meta: { streaming: true },
    });
  };

  try {
    const body = buildBody({ model, messages, maxTokens, temperature, stream: true });
    body.stream_options = { include_usage: true };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 400);
      const err = new Error(`HF ${res.status}${detail ? ': ' + detail : ''}`);
      err.status = res.status;
      await finalize({ success: false, errorMessage: err.message });
      if (onError) onError(err); else throw err;
      return;
    }

    let metaSent = false;

    await parseSseBody(res, (line) => {
      if (!line.startsWith('data: ')) return;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        if (!metaSent && (parsed.model || parsed.id) && onMeta) {
          metaSent = true;
          onMeta({ model: parsed.model, id: parsed.id });
        }
        const delta = parsed?.choices?.[0]?.delta;
        if (delta?.content) onText(delta.content);
        if (parsed?.usage) {
          inTok = parsed.usage.prompt_tokens ?? inTok;
          outTok = parsed.usage.completion_tokens ?? outTok;
        }
      } catch { /* skip malformed */ }
    });
    await finalize({ success: true });
    if (onDone) onDone({ inputTokens: inTok, outputTokens: outTok, latencyMs: Date.now() - t0 });
  } catch (err) {
    await finalize({ success: false, errorMessage: err.message });
    if (onError) onError(err); else throw err;
  } finally {
    cancel();
  }
}

module.exports = { chat, chatStream, buildBody, ENDPOINT };
