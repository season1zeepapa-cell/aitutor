// 서버 추론 호출 클라이언트 (Lab) — REBUILD20
// Lambda Function URL (RESPONSE_STREAM) 직접 호출. SSE 응답 파싱 → onToken 콜백.
//
// API 경로:
//   POST /api/server-infer/{model_key}
//   body: { question: {body, choices, answer, id?}, maxTokens, temperature }
// 응답 (SSE):
//   data: { type: 'meta', model, family, rate_limit, load_time_ms }
//   data: { type: 'token', token: '안녕' }
//   data: { type: 'done', latency_ms, output_chars, output_tokens }
//   또는 에러: data: { error: 'rate_limit_exceeded', ... }

export async function serverInfer({ modelKey, question, maxTokens = 512, temperature = 0.3, onMeta, onToken, onDone }) {
  const url = `/api/server-infer/${modelKey}`;
  const t0 = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ question, maxTokens, temperature }),
  });

  if (!res.ok && !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  // SSE 파싱
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let meta = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 이벤트 단위 분리 (\n\n)
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;

        try {
          const data = JSON.parse(payload);
          if (data.error) {
            throw new Error(`${data.error}: ${data.reason || data.message || ''}`.trim());
          }
          if (data.type === 'meta') {
            meta = data;
            if (onMeta) onMeta(data);
          } else if (data.type === 'token' && data.token) {
            fullText += data.token;
            if (onToken) onToken(data.token);
          } else if (data.type === 'done') {
            if (onDone) onDone({ ...data, total_ms: Date.now() - t0, meta });
            return { fullText, meta, ...data };
          }
        } catch (e) {
          if (e.message.startsWith('rate_limit') || e.message.startsWith('unauthorized')) throw e;
          // JSON 파싱 실패는 무시 (다른 SSE 컨트롤 메시지)
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  return { fullText, meta, total_ms: Date.now() - t0 };
}

// 호출당 비용 추정 (UI 표시용)
export function estimateCost(modelKey, latencyMs) {
  // Lambda 10GB × $0.0000167/GB-sec = $0.000167/sec
  return (latencyMs / 1000) * 0.000167;
}

export const SERVER_MODELS = {
  'e2b': { label: 'Gemma 4 E2B', diskGB: 3.2, expectedSec: 12 },
  'e4b': { label: 'Gemma 4 E4B', diskGB: 4.9, expectedSec: 22 },
};
