// LLM 공통 유틸 — _llm/* 헬퍼들이 공유.
// 모든 프로바이더가 fetch 직접 호출하는 통일 패턴을 지원하기 위한 SSE 파싱·에러 표준화.

/** 응답 본문에서 JSON 블록만 추출 (Claude/OpenAI 가 ```json ...``` 감싸는 경우 대응) */
function extractJson(text) {
  if (!text) return null;
  const s = String(text).trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch {}
  }
  return null;
}

/**
 * SSE 응답 본문(ReadableStream | Response.body) 을 라인 단위 이벤트로 파싱.
 * fetch 응답의 .body 를 받아 콜백을 호출.
 *
 * @param {Response} response — fetch 의 Response 객체
 * @param {(line:string)=>void} onLine — SSE 한 줄(`event:` 또는 `data:` 등)마다 호출
 */
async function parseSseBody(response, onLine) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line) onLine(line);
      }
    }
    // 잔여
    const tail = buffer.trim();
    if (tail) onLine(tail);
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

/**
 * fetch 응답이 4xx/5xx 일 때 본문을 안전하게 파싱해 표준 Error 로 던진다.
 * Node 18+ 의 native fetch 가정.
 */
async function ensureOk(response, label = 'LLM') {
  if (response.ok) return;
  let detail = '';
  try {
    const text = await response.text();
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message || j?.error?.code || j?.message || text.slice(0, 300);
    } catch {
      detail = text.slice(0, 300);
    }
  } catch { /* ignore */ }
  const err = new Error(`${label} ${response.status}${detail ? ': ' + detail : ''}`);
  err.status = response.status;
  throw err;
}

/** AbortController 와 timeout 묶음. Node 18+ 의 fetch 와 함께 사용. */
function withTimeout(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${ms}ms`)), ms);
  return {
    signal: ctrl.signal,
    cancel: () => clearTimeout(timer),
  };
}

module.exports = { extractJson, parseSseBody, ensureOk, withTimeout };
