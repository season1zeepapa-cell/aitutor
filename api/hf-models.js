// HF Inference Providers 모델 카탈로그 엔드포인트 — REBUILD22 §x
//
// GET /api/hf/models  →  { models: [...], cachedAt, hit }
// 인증된 사용자만 허용 (rate limit 약간만, 모델 메타라 민감도 낮음).

const { withAuth } = require('./middleware');
const { getCatalog } = require('./_runtime/hf-catalog');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다.' });
  }

  // 디버그용 force refresh
  const force = req.query?.force === '1';

  try {
    const { models, cachedAt, ttl, hit } = await getCatalog({ force });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      models,
      total: models.length,
      cachedAt,
      cacheAgeMs: Date.now() - cachedAt,
      ttlMs: ttl,
      cacheHit: hit,
    });
  } catch (err) {
    console.error('[hf-models] 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});
