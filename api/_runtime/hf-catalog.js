// HF Inference Providers /v1/models 카탈로그 — 메모리 캐시 (REBUILD22 §x)
//
// router.huggingface.co/v1/models 는 약 122개 모델 + provider별 가격/capability 정보 제공.
// 메인 Lambda 컨테이너 메모리에 1시간 TTL로 캐시 → cold start 외에는 fetch 0회.
// HF_API_KEY 가 필요 (lambda.js 가 SSM 에서 부팅 시 주입).

let _cache = null;
let _cachedAt = 0;
let _inflight = null;  // 동시 요청 합치기 (thundering herd 방지)
const TTL_MS = 60 * 60 * 1000;  // 1 hour

const ROUTER_URL = 'https://router.huggingface.co/v1/models';

/** 원본 router 응답을 클라이언트 친화적 형태로 가공 */
function transformModel(m) {
  const providers = (m.providers || []).map(p => ({
    provider: p.provider,
    status: p.status,
    contextLength: p.context_length || null,
    pricing: p.pricing || null,  // { input, output } per 1M tokens
    supportsTools: !!p.supports_tools,
    supportsStructuredOutput: !!p.supports_structured_output,
  }));

  // 평균/최저 가격 계산 (USD per 1K tokens — pricing 은 per 1M)
  const livePrices = providers.filter(p => p.status === 'live' && p.pricing);
  const avgIn = livePrices.length
    ? livePrices.reduce((s, p) => s + (p.pricing.input || 0), 0) / livePrices.length / 1000
    : null;
  const avgOut = livePrices.length
    ? livePrices.reduce((s, p) => s + (p.pricing.output || 0), 0) / livePrices.length / 1000
    : null;
  const minIn = livePrices.length
    ? Math.min(...livePrices.map(p => p.pricing.input || Infinity)) / 1000
    : null;

  // 최대 컨텍스트
  const maxCtx = providers.reduce((mx, p) => Math.max(mx, p.contextLength || 0), 0) || null;

  // capability 종합
  const arch = m.architecture || {};
  const inputModalities = arch.input_modalities || ['text'];
  const outputModalities = arch.output_modalities || ['text'];

  // capability 자동 분류 (id 패턴 + arch 기반)
  const id = m.id || '';
  const hasVision = inputModalities.includes('image') || /VL|Vision/i.test(id);
  const hasAudio = inputModalities.includes('audio');
  const hasTools = providers.some(p => p.supportsTools);
  const isThinking = /Thinking|R1|Reasoning|Reasoner/i.test(id);
  const isCoder = /Coder|Code/i.test(id);
  const isMoe = /(MoE|A\d+B|x\d+E)/i.test(id);

  // org 추출
  const org = id.includes('/') ? id.split('/')[0] : 'unknown';

  return {
    id,
    org,
    name: id.split('/').pop(),
    inputModalities,
    outputModalities,
    capabilities: {
      vision: hasVision,
      audio: hasAudio,
      tools: hasTools,
      thinking: isThinking,
      coder: isCoder,
      moe: isMoe,
    },
    maxContextLength: maxCtx,
    pricing: {
      // USD per 1K tokens (avg / min)
      avgIn,
      avgOut,
      minIn,
    },
    providers,
    providerCount: providers.length,
    liveProviderCount: livePrices.length,
  };
}

async function fetchFromRouter() {
  const key = (process.env.HF_API_KEY || '').trim();
  if (!key) throw new Error('HF_API_KEY 미설정');
  const res = await fetch(ROUTER_URL, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HF router ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const models = (data.data || []).map(transformModel);
  return models;
}

/** 모델 카탈로그 가져오기 (캐시) */
async function getCatalog({ force = false } = {}) {
  const now = Date.now();
  if (!force && _cache && (now - _cachedAt) < TTL_MS) {
    return { models: _cache, cachedAt: _cachedAt, ttl: TTL_MS, hit: true };
  }
  if (_inflight) {
    return _inflight;  // 동시 호출 시 한 번만 fetch
  }
  _inflight = (async () => {
    try {
      const models = await fetchFromRouter();
      _cache = models;
      _cachedAt = Date.now();
      return { models, cachedAt: _cachedAt, ttl: TTL_MS, hit: false };
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** ID 화이트리스트 검증용 — Set 으로 빠른 lookup */
async function getAllowedIds() {
  const { models } = await getCatalog();
  return new Set(models.map(m => m.id));
}

/** 캐시 무효화 (admin 용) */
function invalidate() {
  _cache = null;
  _cachedAt = 0;
}

module.exports = { getCatalog, getAllowedIds, invalidate };
