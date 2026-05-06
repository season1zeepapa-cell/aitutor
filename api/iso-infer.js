// REBUILD26 §3.2 — 격리 추론 service (aitutor-inference) 프록시
//
// 메인 service 의 SA (aitutor-run) 가 Cloud Run metadata server 에서
// ID Token 을 발급받아 격리 service 에 인증된 호출을 forward.
//
// 클라이언트 호출:
//   GET  /api/iso-infer?action=models           → 격리 service /infer/models
//   POST /api/iso-infer                         → 격리 service /infer
//   GET  /api/iso-infer?action=health           → 격리 service /healthz
//   GET  /api/iso-infer?action=memory           → 격리 service /memory
//   POST /api/iso-infer?action=unload-all       → 격리 service /memory/unload-all (warm 유지)
//   POST /api/iso-infer?action=restart-container→ 격리 service /memory/restart-container (cold start, 메모리 100% 회수)
//
// 환경변수:
//   ISO_INFER_URL    격리 service base URL (예: https://aitutor-inference-58235609672.us-east4.run.app)
//   ISO_INFER_TOKEN  옵션 — 설정 시 X-Internal-Token 헤더로 추가 검증

const { withAuth } = require('./middleware');
// REBUILD32 §15 B-1 — applyQwenStrict 제거: server.py 에서만 적용 (이중 삽입 방지)

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
  // B-4: lastResp 유령 변수 제거 — 마지막 attempt 에서 무조건 return 하므로 루프 후 코드 도달 불가
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
  // 여기까지 도달 불가 (위 루프가 항상 return) — 타입 안전을 위한 fallback
  return { status: 503, data: { error: 'max_retries_exceeded' } };
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
      // B-3: action=ready 제거 — server.py 에 /readyz 없음 (항상 404), 호출처도 없는 dead code
      // REBUILD32 — UI MemoryCard 용 메모리 상태 (Ollama 로드 + RAM + GPU VRAM)
      if (action === 'memory') {
        const { status, data } = await forward('GET', '/memory');
        return res.status(status).json(data);
      }
      // default: models 카탈로그
      const { status, data } = await forward('GET', '/infer/models');
      return res.status(status).json(data);
    }

    if (req.method === 'POST') {
      // REBUILD32 — 격리 service 의 모든 모델 즉시 unload (warm 컨테이너 유지)
      if (req.query?.action === 'unload-all') {
        const { status, data } = await forward('POST', '/memory/unload-all');
        return res.status(status).json(data);
      }
      // REBUILD32 §15.5 — 격리 service 컨테이너 강제 재시작 (메모리 100% 회수, 다음 호출 cold start)
      if (req.query?.action === 'restart-container') {
        const { status, data } = await forward('POST', '/memory/restart-container');
        return res.status(status).json(data);
      }
      // REBUILD32 — engine 파라미터 제거 (격리 service 가 Ollama 단일 엔진).
      // 격리 service /infer Pydantic InferRequest 는 engine 필드 없음. 클라이언트 (ServerInferTester)
      // 도 더 이상 engine 을 body 에 포함하지 않으나, 안전을 위해 명시적으로 추출 X.
      const { model_key, messages, max_tokens, maxTokens, temperature } = req.body || {};
      // REBUILD32 §15 B-1 — applyQwenStrict 이중 적용 제거. server.py 가 단독 처리.
      // (DeepSeek 도 server.py 의 apply_qwen_strict 가 올바르게 처리)
      const body = {
        model_key,
        messages,
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
