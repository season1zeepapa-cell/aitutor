// Anthropic Claude (Messages API) fetch 헬퍼.
// 프록시 엔드포인트(api/claude.js) 와 내부 LLM 호출자(_kisa/llmGrader.js) 가 공용.

const { extractJson, parseSseBody, ensureOk, withTimeout } = require('./_utils');
const { logUsage } = require('./usage');

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const PROVIDER = 'anthropic';

/** Anthropic Messages API 단발 호출 */
async function chat({
  model,
  system,
  messages,
  maxTokens = 1024,
  temperature,
  apiKey = process.env.ANTHROPIC_API_KEY,
  timeout = 60000,
  // 사용량 로깅용 (선택)
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 미설정');
  const { signal, cancel } = withTimeout(timeout);
  const t0 = Date.now();
  try {
    const body = { model, max_tokens: maxTokens, messages };
    if (system) body.system = system;
    if (temperature !== undefined && temperature !== null) body.temperature = Number(temperature);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': VERSION,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      // 에러도 사용량 로깅 (실패 기록)
      let errMsg = '';
      try { errMsg = (await res.text()).slice(0, 300); } catch {}
      await logUsage({ provider: PROVIDER, model, action, userId, questionId,
        latencyMs: Date.now() - t0, success: false,
        errorMessage: `HTTP ${res.status}: ${errMsg}` });
      const e = new Error(`Claude ${res.status}${errMsg ? ': ' + errMsg : ''}`);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    // 사용량 로깅 (성공)
    await logUsage({
      provider: PROVIDER, model, action, userId, questionId,
      inputTokens: data?.usage?.input_tokens,
      outputTokens: data?.usage?.output_tokens,
      latencyMs: Date.now() - t0,
      success: true,
    });
    return { text, raw: data };
  } finally {
    cancel();
  }
}

/**
 * 스트리밍 호출. SSE 이벤트 중 content_block_delta 만 onText 로 전달.
 * @param {object} params
 * @param {(chunk:string)=>void} params.onText
 * @param {(err:Error)=>void} [params.onError]
 * @param {()=>void} [params.onDone]
 */
async function chatStream({
  model,
  system,
  messages,
  maxTokens = 2048,
  temperature,
  apiKey = process.env.ANTHROPIC_API_KEY,
  timeout = 120000,
  onText,
  onError,
  onDone,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 미설정');
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
    const body = { model, max_tokens: maxTokens, messages, stream: true };
    if (system) body.system = system;
    if (temperature !== undefined && temperature !== null) body.temperature = Number(temperature);

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': VERSION,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      let detail = '';
      try { const t = await res.text(); detail = t.slice(0, 300); } catch {}
      const err = new Error(`Claude ${res.status}${detail ? ': ' + detail : ''}`);
      err.status = res.status;
      await finalize({ success: false, errorMessage: err.message });
      if (onError) onError(err); else throw err;
      return;
    }

    let currentEvent = '';
    await parseSseBody(res, (line) => {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        return;
      }
      if (!line.startsWith('data: ')) return;
      const payload = line.slice(6);
      try {
        const parsed = JSON.parse(payload);
        if (currentEvent === 'content_block_delta') {
          const t = parsed?.delta?.text;
          if (t) onText(t);
        } else if (currentEvent === 'message_start' && parsed?.message?.usage) {
          inTok = parsed.message.usage.input_tokens ?? inTok;
        } else if (currentEvent === 'message_delta' && parsed?.usage) {
          outTok = parsed.usage.output_tokens ?? outTok;
        }
      } catch { /* skip */ }
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

module.exports = { chat, chatStream, extractJson, ENDPOINT, VERSION };
