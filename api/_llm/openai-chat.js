// OpenAI Chat Completions API fetch 헬퍼.
// SDK(`openai`) 의존 제거 + 표준 fetch 로 통일.
// o-series / GPT-5 계열의 파라미터 차이를 직접 처리한다.

const { extractJson, parseSseBody, ensureOk, withTimeout } = require('./_utils');
const { logUsage } = require('./usage');

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const PROVIDER = 'openai';

// o-series + GPT-5.4: temperature 미지원, reasoning_effort 지원, max_completion_tokens
const O_SERIES = new Set([
  'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano',
  'o3-pro', 'o4-mini', 'o3', 'o3-mini', 'o1-mini', 'o1',
]);
// GPT-5 계열: max_tokens 대신 max_completion_tokens 사용
const GPT5_SERIES = new Set([
  'gpt-5.3-chat-latest', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
]);

/** 모델별 파라미터 정규화 */
function buildBody({ model, messages, maxTokens = 2048, temperature, reasoningEffort, stream }) {
  const isOSeries = O_SERIES.has(model);
  const isGPT5 = GPT5_SERIES.has(model);

  const body = { model, messages };

  if (isOSeries) {
    const VALID = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high' };
    body.reasoning_effort = VALID[reasoningEffort] || 'high';
    body.max_completion_tokens = maxTokens;
  } else if (isGPT5) {
    body.max_completion_tokens = maxTokens;
    if (temperature !== undefined && temperature !== null) body.temperature = Number(temperature);
  } else {
    body.max_tokens = maxTokens;
    if (temperature !== undefined && temperature !== null) body.temperature = Number(temperature);
  }

  if (stream) body.stream = true;
  return { body, isOSeries, isGPT5 };
}

/** o-series 는 system 역할 미지원 → developer 역할로 변환 */
function normalizeMessages(messages, model) {
  const isOSeries = O_SERIES.has(model);
  if (!isOSeries) return messages;
  return messages.map(m => m.role === 'system' ? { ...m, role: 'developer' } : m);
}

/** OpenAI Chat 단발 호출 */
async function chat({
  model,
  messages,
  maxTokens,
  temperature,
  reasoningEffort,
  apiKey = process.env.OPENAI_API_KEY,
  timeout = 60000,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY 미설정');
  const { signal, cancel } = withTimeout(timeout);
  const t0 = Date.now();
  try {
    const normalized = normalizeMessages(messages, model);
    const { body } = buildBody({ model, messages: normalized, maxTokens, temperature, reasoningEffort });
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
      let errMsg = '';
      try { errMsg = (await res.text()).slice(0, 300); } catch {}
      await logUsage({ provider: PROVIDER, model, action, userId, questionId,
        latencyMs: Date.now() - t0, success: false,
        errorMessage: `HTTP ${res.status}: ${errMsg}` });
      const e = new Error(`OpenAI ${res.status}${errMsg ? ': ' + errMsg : ''}`);
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
      refusal: msg?.refusal || '',
      finish: data?.choices?.[0]?.finish_reason,
      raw: data,
    };
  } finally {
    cancel();
  }
}

/** OpenAI Chat 스트리밍 호출 */
async function chatStream({
  model,
  messages,
  maxTokens,
  temperature,
  reasoningEffort,
  apiKey = process.env.OPENAI_API_KEY,
  timeout = 120000,
  onText,
  onRefusal,
  onError,
  onDone,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY 미설정');
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
    const normalized = normalizeMessages(messages, model);
    const { body } = buildBody({ model, messages: normalized, maxTokens, temperature, reasoningEffort, stream: true });
    // OpenAI 스트리밍 응답에 사용량 포함시키기 (gpt-4o 이상 지원)
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
      let detail = '';
      try { const t = await res.text(); detail = t.slice(0, 300); } catch {}
      const err = new Error(`OpenAI ${res.status}${detail ? ': ' + detail : ''}`);
      err.status = res.status;
      await finalize({ success: false, errorMessage: err.message });
      if (onError) onError(err); else throw err;
      return;
    }

    await parseSseBody(res, (line) => {
      if (!line.startsWith('data: ')) return;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta;
        if (delta?.refusal && onRefusal) onRefusal(delta.refusal);
        if (delta?.content) onText(delta.content);
        if (parsed?.usage) {
          inTok = parsed.usage.prompt_tokens ?? inTok;
          outTok = parsed.usage.completion_tokens ?? outTok;
        }
      } catch { /* skip malformed */ }
    });
    await finalize({ success: true });
    if (onDone) onDone();
  } catch (err) {
    await finalize({ success: false, errorMessage: err.message });
    if (onError) onError(err); else throw err;
  } finally {
    cancel();
  }
}

module.exports = {
  chat,
  chatStream,
  buildBody,
  normalizeMessages,
  O_SERIES,
  GPT5_SERIES,
  ENDPOINT,
};
