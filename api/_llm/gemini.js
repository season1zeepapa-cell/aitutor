// Google Gemini (generateContent) fetch 헬퍼.
// REST API v1beta 사용. SDK(`@google/generative-ai`) 미사용 — 통일된 fetch 패턴.

const { parseSseBody, ensureOk, withTimeout } = require('./_utils');
const { logUsage } = require('./usage');

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const PROVIDER = 'gemini';

/**
 * Gemini 호출 본문 빌드 — Anthropic/OpenAI 와 다르게 contents 배열 형식.
 * 입력: { messages, system } (OpenAI 형식)
 *   → contents:[{role,parts:[{text}]}], systemInstruction:{parts:[{text}]}
 *
 * 멀티모달(이미지)은 parts 에 inlineData 추가.
 */
function buildContents(messages) {
  const contents = [];
  for (const m of messages || []) {
    if (m.role === 'system') continue;  // systemInstruction 으로 별도 전달
    const role = m.role === 'assistant' ? 'model' : 'user';
    const parts = [];
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'text' && c.text) parts.push({ text: c.text });
        else if (c.type === 'image' && c.source?.data) {
          parts.push({
            inlineData: {
              mimeType: c.source.media_type || 'image/png',
              data: c.source.data,
            },
          });
        } else if (c.type === 'image_url' && c.image_url?.url) {
          // OpenAI 형식의 data URL → inlineData 변환
          const m2 = /^data:([^;]+);base64,(.+)$/.exec(c.image_url.url);
          if (m2) parts.push({ inlineData: { mimeType: m2[1], data: m2[2] } });
        }
      }
    }
    contents.push({ role, parts });
  }
  return contents;
}

function buildSystemInstruction(messages) {
  const sys = (messages || []).find(m => m.role === 'system');
  if (!sys || !sys.content) return undefined;
  const text = typeof sys.content === 'string' ? sys.content : '';
  return text ? { parts: [{ text }] } : undefined;
}

function genCfg({ maxTokens, temperature, extra }) {
  const cfg = {};
  if (maxTokens) cfg.maxOutputTokens = Number(maxTokens);
  if (temperature !== undefined && temperature !== null) cfg.temperature = Number(temperature);
  if (extra && typeof extra === 'object') Object.assign(cfg, extra);  // thinkingConfig, responseMimeType 등
  return Object.keys(cfg).length ? cfg : undefined;
}

/** 단발 호출 (generateContent) */
async function chat({
  model,
  messages,
  maxTokens = 2048,
  temperature,
  generationConfigExtra,
  apiKey = process.env.GEMINI_API_KEY,
  timeout = 60000,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY 미설정');
  const { signal, cancel } = withTimeout(timeout);
  const t0 = Date.now();
  try {
    const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: buildContents(messages),
      systemInstruction: buildSystemInstruction(messages),
      generationConfig: genCfg({ maxTokens, temperature, extra: generationConfigExtra }),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      let errMsg = '';
      try { errMsg = (await res.text()).slice(0, 300); } catch {}
      await logUsage({ provider: PROVIDER, model, action, userId, questionId,
        latencyMs: Date.now() - t0, success: false,
        errorMessage: `HTTP ${res.status}: ${errMsg}` });
      const e = new Error(`Gemini ${res.status}${errMsg ? ': ' + errMsg : ''}`);
      e.status = res.status;
      throw e;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const um = data?.usageMetadata || {};
    await logUsage({
      provider: PROVIDER, model, action, userId, questionId,
      inputTokens: um.promptTokenCount,
      outputTokens: um.candidatesTokenCount,
      latencyMs: Date.now() - t0,
      success: true,
    });
    return { text, raw: data };
  } finally {
    cancel();
  }
}

/** 스트리밍 (streamGenerateContent + alt=sse) */
async function chatStream({
  model,
  messages,
  maxTokens = 2048,
  temperature,
  generationConfigExtra,
  apiKey = process.env.GEMINI_API_KEY,
  timeout = 120000,
  onText,
  onError,
  onDone,
  userId,
  action,
  questionId,
}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY 미설정');
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
    const url = `${BASE_URL}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: buildContents(messages),
      systemInstruction: buildSystemInstruction(messages),
      generationConfig: genCfg({ maxTokens, temperature, extra: generationConfigExtra }),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      let detail = '';
      try { const t = await res.text(); detail = t.slice(0, 300); } catch {}
      const err = new Error(`Gemini ${res.status}${detail ? ': ' + detail : ''}`);
      err.status = res.status;
      await finalize({ success: false, errorMessage: err.message });
      if (onError) onError(err); else throw err;
      return;
    }

    await parseSseBody(res, (line) => {
      if (!line.startsWith('data: ')) return;
      const payload = line.slice(6);
      try {
        const parsed = JSON.parse(payload);
        const text = parsed?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        if (text) onText(text);
        if (parsed?.usageMetadata) {
          inTok = parsed.usageMetadata.promptTokenCount ?? inTok;
          outTok = parsed.usageMetadata.candidatesTokenCount ?? outTok;
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

module.exports = { chat, chatStream, buildContents, buildSystemInstruction, BASE_URL };
