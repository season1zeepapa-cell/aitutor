// REBUILD18 §3.4 — 디바이스 AI 호출량 기록 (프론트 직접 호출용)
//
// 백엔드 _llm/* 헬퍼는 자체적으로 logUsage() 호출하지만, 디바이스 AI 는 백엔드 미경유 (프론트
// transformers.js + WebGPU 직접 추론). 프론트가 추론 끝낸 후 본 엔드포인트로 통계 보냄.
//
// 보안:
//   - provider 화이트리스트: 'local-' 접두 또는 외부 3개 (가짜 provider 입력 차단)
//   - 인증: 미들웨어 (다른 API 와 동일 패턴 — req.user 채워짐)
//   - 토큰/비용 0 강제 (악의적 청구 흐름 방지)

const { query } = require('./db');
const { withCors } = require('./middleware');

const PROVIDER_WHITELIST = /^(local-[a-z0-9-]+|gemini|openai|claude)$/;
const ACTION_WHITELIST = new Set(['card_explain', 'card_explain_server', 'kisa_explain', 'kisa_grade', 'pool_extract']);

module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 만 허용' });
  }

  const {
    provider, model, action,
    question_id, input_tokens, output_tokens, latency_ms,
  } = req.body || {};

  if (!provider || !model || !action) {
    return res.status(400).json({ error: 'provider, model, action 은 필수입니다.' });
  }
  if (!PROVIDER_WHITELIST.test(provider)) {
    return res.status(400).json({ error: '허용되지 않은 provider' });
  }
  if (!ACTION_WHITELIST.has(action)) {
    return res.status(400).json({ error: '허용되지 않은 action' });
  }

  // 디바이스 AI 는 비용 0 강제 — 외부 모델은 백엔드에서 자체 logUsage 가 정확한 단가 적용
  const estimated_cost = provider.startsWith('local-') ? 0 : 0;

  // 토큰은 정수 클램프 (음수/유효성 차단)
  const inTok = Math.max(0, parseInt(input_tokens, 10) || 0);
  const outTok = Math.max(0, parseInt(output_tokens, 10) || 0);
  const lat = Math.max(0, parseInt(latency_ms, 10) || 0);

  try {
    const result = await query(
      `INSERT INTO llm_usage_log
        (user_id, provider, model, action, question_id,
         input_tokens, output_tokens, estimated_cost, latency_ms,
         success, error_message, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, null, $10)
       RETURNING id, created_at`,
      [
        req.user?.id || null,
        provider,
        model,
        action,
        question_id || null,
        inTok,
        outTok,
        estimated_cost,
        lat,
        JSON.stringify({ source: provider.startsWith('local-') ? 'frontend-webgpu' : 'frontend-direct' }),
      ]
    );
    return res.json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (e) {
    // 통계 실패는 사용자 흐름에 영향 X — 200 으로 silent fail (단, 로그는 남김)
    console.warn('[usage-log] insert 실패:', e.message);
    return res.json({ id: null, error: e.message });
  }
});
