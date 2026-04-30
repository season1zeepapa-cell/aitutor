// REBUILD26 §3.2 — 격리 추론 service (aitutor-inference) 프록시
//
// 메인 service 의 SA (aitutor-run) 가 Cloud Run metadata server 에서
// ID Token 을 발급받아 격리 service 에 인증된 호출을 forward.
//
// 클라이언트 호출:
//   GET  /api/iso-infer?action=models       → 격리 service /infer/models
//   POST /api/iso-infer                     → 격리 service /infer
//   GET  /api/iso-infer?action=health       → 격리 service /healthz
//
// 환경변수:
//   ISO_INFER_URL    격리 service base URL (예: https://aitutor-inference-58235609672.us-east4.run.app)
//   ISO_INFER_TOKEN  옵션 — 설정 시 X-Internal-Token 헤더로 추가 검증

const { withAuth } = require('./middleware');
const { applyQwenStrict } = require('./_runtime/qwen');

const ISO_INFER_URL   = (process.env.ISO_INFER_URL || '').replace(/\/+$/, '');
const ISO_INFER_TOKEN = process.env.ISO_INFER_TOKEN || '';

// ─── ID Token 캐시 (50분 유효, 토큰 1시간 만료 직전 재발급) ─
let _cachedToken = null;
let _cachedExpireAt = 0;

async function getIdToken(audience) {
  const now = Date.now();
  if (_cachedToken && now < _cachedExpireAt) return _cachedToken;

  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  const resp = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`metadata fetch failed (HTTP ${resp.status}): ${t.slice(0, 200)}`);
  }
  const token = (await resp.text()).trim();
  _cachedToken = token;
  _cachedExpireAt = now + 50 * 60 * 1000;  // 50분 (토큰은 1시간 유효)
  return token;
}

// ─── 격리 service 로 forward ───────────────────────────────
async function forward(method, path, body) {
  if (!ISO_INFER_URL) {
    throw new Error('ISO_INFER_URL 환경변수가 설정되지 않음');
  }
  const url = `${ISO_INFER_URL}${path}`;
  const token = await getIdToken(ISO_INFER_URL);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (ISO_INFER_TOKEN) headers['X-Internal-Token'] = ISO_INFER_TOKEN;

  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  // REBUILD29 §17 — 격리 service cold start (429) retry 로직
  // Cloud Run idle 5분 후 새 instance startup 중에는 429 반환 → 최대 3회 retry
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;
  let lastResp = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429 || attempt === MAX_RETRIES - 1) {
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { status: resp.status, data };
    }
    // 429 — 격리 service 기동 중. 지수 backoff 대기 (2초, 4초, 8초)
    await new Promise(res => setTimeout(res, BASE_DELAY_MS * Math.pow(2, attempt)));
  }
  return lastResp;  // unreachable, 위 루프가 처리
}

module.exports = withAuth(async (req, res) => {
  if (!ISO_INFER_URL) {
    return res.status(503).json({
      error: 'iso_infer_disabled',
      message: 'ISO_INFER_URL 환경변수가 설정되지 않았습니다 (메인 service deploy 시 --set-env-vars 로 추가 필요).',
    });
  }

  try {
    if (req.method === 'GET') {
      const action = req.query?.action || 'models';
      if (action === 'health') {
        const { status, data } = await forward('GET', '/healthz');
        return res.status(status).json(data);
      }
      if (action === 'ready') {
        const { status, data } = await forward('GET', '/readyz');
        return res.status(status).json(data);
      }
      // default: models 카탈로그
      const { status, data } = await forward('GET', '/infer/models');
      return res.status(status).json(data);
    }

    if (req.method === 'POST') {
      const { engine, model_key, messages, max_tokens, maxTokens, temperature } = req.body || {};
      // REBUILD29 §13 / §16 — Qwen 한국어 강제 + thinking 비활성
      const finalMessages = applyQwenStrict(messages, model_key);
      const body = {
        engine,
        model_key,
        messages: finalMessages,
        max_tokens: max_tokens || maxTokens || 512,
        temperature: temperature ?? 0.3,
      };
      const { status, data } = await forward('POST', '/infer', body);
      return res.status(status).json(data);
    }

    return res.status(405).json({ error: 'GET / POST 만 허용' });
  } catch (err) {
    console.error('[iso-infer] 에러:', err);
    return res.status(502).json({
      error: 'iso_infer_proxy_failed',
      message: err.message,
    });
  }
});
