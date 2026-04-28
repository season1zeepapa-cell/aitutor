// HF 모델 카탈로그 가져오기 (router /v1/models, 백엔드 1h 캐시 통과)
export async function fetchModelCatalog() {
  const res = await fetch('/api/hf-models', { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();  // { models, total, cachedAt, cacheAgeMs, ttlMs, cacheHit }
}

// HF API 호출 + SSE 파싱 클라이언트 (REBUILD22 §x)
// 백엔드 /api/hf 프록시를 호출. 메시지 흐름:
//   data: { meta: {model, id} }                 — provider 라우팅 결과
//   data: { t: "토큰" }                          — 텍스트 chunk
//   data: { done: true, inputTokens, outputTokens, latencyMs }  — 종료 메타
//   data: { error: "..." }                       — 오류
//   data: [DONE]                                  — 스트림 종료 마커

export async function chat({
  model,
  messages,
  temperature = 0.3,
  maxTokens = 1024,
  action = 'lab_hf_chat',
  signal,
  onMeta,
  onText,
  onDone,
  onError,
}) {
  const t0 = Date.now();
  let firstByteAt = null;

  const res = await fetch('/api/hf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      model, messages,
      temperature, maxTokens,
      stream: true, action,
    }),
    signal,
  });

  if (!res.ok && !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let metaInfo = null;
  let doneInfo = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstByteAt === null) firstByteAt = Date.now();
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          if (data.error) {
            if (onError) onError(new Error(data.error));
            throw new Error(data.error);
          }
          if (data.meta) {
            metaInfo = data.meta;
            if (onMeta) onMeta(data.meta);
          } else if (data.t) {
            fullText += data.t;
            if (onText) onText(data.t, fullText);
          } else if (data.done) {
            doneInfo = data;
          }
        } catch (e) {
          if (e.message?.startsWith('HTTP') || e.message?.length > 0 && line.includes('error')) throw e;
          // JSON parse 실패는 무시
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const result = {
    fullText,
    meta: metaInfo,
    inputTokens: doneInfo?.inputTokens || null,
    outputTokens: doneInfo?.outputTokens || null,
    serverLatencyMs: doneInfo?.latencyMs || null,
    ttftMs: firstByteAt ? firstByteAt - t0 : null,
    totalMs: Date.now() - t0,
  };
  if (onDone) onDone(result);
  return result;
}
