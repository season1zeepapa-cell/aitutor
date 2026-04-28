// LLM 사용량 로깅 — REBUILD16 §12.2-C
// 모든 _llm/* 헬퍼가 chat/chatStream 호출 후 logUsage 를 호출.
// DB(llm_usage_log) 에 1행 INSERT. 실패 시 본 호출 결과에는 영향 주지 않음 (try/catch silent).

let _query;
function getQuery() {
  if (_query) return _query;
  try {
    _query = require('../db').query;
  } catch (_) {
    _query = null;
  }
  return _query;
}

// 모델별 단가 (USD per 1K tokens). 2026-04 시점 공개 가격 기준 추정값.
// 정확한 청구액과 차이가 있을 수 있어 추정치(estimated_cost)로만 사용.
const PRICING = {
  // Anthropic Claude
  'claude-opus-4-6':            { in: 0.015,  out: 0.075 },
  'claude-sonnet-4-6':          { in: 0.003,  out: 0.015 },
  'claude-sonnet-4-5':          { in: 0.003,  out: 0.015 },
  'claude-sonnet-4-20250514':   { in: 0.003,  out: 0.015 },
  'claude-haiku-4-5-20251001':  { in: 0.001,  out: 0.005 },

  // OpenAI
  'gpt-4o':                     { in: 0.0025, out: 0.010 },
  'gpt-4o-mini':                { in: 0.00015,out: 0.0006 },
  'gpt-4.1':                    { in: 0.002,  out: 0.008 },
  'gpt-4.1-mini':               { in: 0.0004, out: 0.0016 },
  'gpt-4.1-nano':               { in: 0.0001, out: 0.0004 },
  'gpt-5':                      { in: 0.005,  out: 0.020 },
  'gpt-5-mini':                 { in: 0.001,  out: 0.004 },
  'gpt-5-nano':                 { in: 0.0002, out: 0.0008 },
  'gpt-5.1':                    { in: 0.005,  out: 0.020 },
  'gpt-5.2':                    { in: 0.005,  out: 0.020 },
  'gpt-5.3-chat-latest':        { in: 0.005,  out: 0.020 },
  'gpt-5.4':                    { in: 0.005,  out: 0.020 },
  'gpt-5.4-mini':               { in: 0.001,  out: 0.004 },
  'gpt-5.4-nano':               { in: 0.0002, out: 0.0008 },
  'o3':                         { in: 0.030,  out: 0.060 },
  'o3-pro':                     { in: 0.060,  out: 0.120 },
  'o3-mini':                    { in: 0.001,  out: 0.004 },
  'o4-mini':                    { in: 0.001,  out: 0.004 },
  'o1':                         { in: 0.015,  out: 0.060 },
  'o1-mini':                    { in: 0.003,  out: 0.012 },

  // Google Gemini
  'gemini-2.5-pro':             { in: 0.00125,out: 0.005 },
  'gemini-2.5-flash':           { in: 0.000075,out:0.0003 },
  'gemini-2.5-flash-lite':      { in: 0.00004,out: 0.00015 },
  'gemini-2.0-flash':           { in: 0.0001, out: 0.0004 },
  'gemini-2.0-flash-lite':      { in: 0.00004,out: 0.00015 },
  'gemini-3-flash-preview':     { in: 0.0001, out: 0.0004 },
  'gemini-3.1-flash-lite-preview': { in: 0.00004,out: 0.00015 },
  'gemini-3.1-pro-preview':     { in: 0.00125,out: 0.005 },

  // Hugging Face Inference Providers (router /v1/models 검증된 ID, 2026-04-28)
  // 🆕 2026 최신
  'google/gemma-4-31B-it':                              { in: 0.0006,  out: 0.0006  },
  'google/gemma-4-26B-A4B-it':                          { in: 0.0003,  out: 0.0003  },
  'Qwen/Qwen3-235B-A22B-Thinking-2507':                 { in: 0.0012,  out: 0.003   },
  'Qwen/Qwen3-235B-A22B-Instruct-2507':                 { in: 0.001,   out: 0.001   },
  'Qwen/Qwen3-32B':                                     { in: 0.0005,  out: 0.0005  },
  'Qwen/Qwen3-Coder-30B-A3B-Instruct':                  { in: 0.0004,  out: 0.0004  },
  'Qwen/Qwen3-8B':                                      { in: 0.00018, out: 0.00018 },
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct':      { in: 0.0007,  out: 0.0007  },
  'meta-llama/Llama-4-Scout-17B-16E-Instruct':          { in: 0.0003,  out: 0.0003  },
  // 🏆 2024-2025 검증된 모델
  'meta-llama/Llama-3.3-70B-Instruct':                  { in: 0.00088, out: 0.00088 },
  'deepseek-ai/DeepSeek-R1-0528':                       { in: 0.003,   out: 0.007   },
  'Qwen/Qwen2.5-72B-Instruct':                          { in: 0.0009,  out: 0.0009  },
  'Qwen/Qwen2.5-7B-Instruct':                           { in: 0.00018, out: 0.00018 },
};

/** 모델 ID 로 단가 조회. 없으면 conservative default 반환. */
function getPricing(model) {
  if (PRICING[model]) return PRICING[model];
  // 모델 패밀리별 fallback
  if (model?.startsWith('claude-haiku')) return { in: 0.001, out: 0.005 };
  if (model?.startsWith('claude-sonnet')) return { in: 0.003, out: 0.015 };
  if (model?.startsWith('claude-opus')) return { in: 0.015, out: 0.075 };
  if (model?.startsWith('gpt-4o-mini')) return { in: 0.00015, out: 0.0006 };
  if (model?.startsWith('gpt-4o')) return { in: 0.0025, out: 0.010 };
  if (model?.startsWith('gemini-2.5-flash')) return { in: 0.000075, out: 0.0003 };
  if (model?.startsWith('gemini-2.5-pro')) return { in: 0.00125, out: 0.005 };
  // HF 오픈 모델 패밀리 fallback
  if (model?.startsWith('google/gemma-4-31'))    return { in: 0.0006,  out: 0.0006 };
  if (model?.startsWith('google/gemma-4-26'))    return { in: 0.0003,  out: 0.0003 };
  if (model?.startsWith('google/gemma-'))        return { in: 0.0003,  out: 0.0003 };
  if (model?.startsWith('Qwen/Qwen3-235B'))      return { in: 0.001,   out: 0.002 };
  if (model?.startsWith('Qwen/Qwen3-Coder'))     return { in: 0.0004,  out: 0.0004 };
  if (model?.startsWith('Qwen/Qwen3-32'))        return { in: 0.0005,  out: 0.0005 };
  if (model?.startsWith('Qwen/Qwen3-30'))        return { in: 0.0004,  out: 0.0004 };
  if (model?.startsWith('Qwen/Qwen3-8'))         return { in: 0.00018, out: 0.00018 };
  if (model?.startsWith('Qwen/Qwen3'))           return { in: 0.0003,  out: 0.0003 };
  if (model?.startsWith('Qwen/Qwen2.5-72B'))     return { in: 0.0009,  out: 0.0009 };
  if (model?.startsWith('Qwen/'))                return { in: 0.00018, out: 0.00018 };
  if (model?.startsWith('meta-llama/Llama-4'))   return { in: 0.0007,  out: 0.0007 };
  if (model?.startsWith('meta-llama/Llama-3.3')) return { in: 0.00088, out: 0.00088 };
  if (model?.startsWith('meta-llama/Llama-3.1')) return { in: 0.00018, out: 0.00018 };
  if (model?.startsWith('deepseek-ai/'))         return { in: 0.003,   out: 0.007 };
  if (model?.startsWith('mistralai/'))           return { in: 0.002,   out: 0.006 };
  // 알 수 없으면 보수적 추정 (claude-sonnet 기준)
  return { in: 0.003, out: 0.015 };
}

/** input/output 토큰 수 + 모델로 비용 계산 (USD). */
function calcCost({ model, inputTokens = 0, outputTokens = 0 }) {
  const p = getPricing(model);
  const cost = (Number(inputTokens) || 0) * p.in / 1000
             + (Number(outputTokens) || 0) * p.out / 1000;
  return Math.round(cost * 1_000_000) / 1_000_000;  // 6자리 소수
}

/**
 * LLM 호출 1건 사용량 기록.
 * @param {object} payload
 * @param {string} payload.provider — 'anthropic'|'openai'|'gemini'
 * @param {string} payload.model
 * @param {string} [payload.action]      — 'kisa_explain'|'kisa_grade'|'card_explain'|'pool_extract'
 * @param {number} [payload.userId]      — req.user?.uid
 * @param {string} [payload.questionId]
 * @param {number} [payload.inputTokens]
 * @param {number} [payload.outputTokens]
 * @param {number} [payload.latencyMs]
 * @param {boolean} [payload.success]    — 기본 true
 * @param {string} [payload.errorMessage]
 * @param {object} [payload.meta]        — { streaming: true } 등
 */
async function logUsage(payload) {
  const q = getQuery();
  if (!q) return;  // DB 미연결 환경(스크립트 등)에서는 silent skip
  try {
    const cost = calcCost(payload);
    await q(`
      INSERT INTO llm_usage_log
        (user_id, provider, model, action, question_id,
         input_tokens, output_tokens, estimated_cost, latency_ms,
         success, error_message, meta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    `, [
      payload.userId || null,
      payload.provider,
      payload.model,
      payload.action || null,
      payload.questionId || null,
      payload.inputTokens || null,
      payload.outputTokens || null,
      cost || null,
      payload.latencyMs || null,
      payload.success !== false,
      payload.errorMessage || null,
      payload.meta ? JSON.stringify(payload.meta) : null,
    ]);
  } catch (e) {
    // 로깅 실패는 본 호출에 영향 X. console 만 남김.
    console.warn('[llm/usage] 로깅 실패:', e.message);
  }
}

module.exports = { logUsage, calcCost, getPricing, PRICING };
