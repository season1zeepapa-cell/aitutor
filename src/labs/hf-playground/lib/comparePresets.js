// 비교 모드 추천 프리셋 (REBUILD22 §x Phase 4a)
//
// 카탈로그 fetch 후 동적으로 적용 — 모델 ID가 카탈로그에 없으면 무시.
// 한 클릭으로 4~5개 모델 자동 선택.

export const COMPARE_PRESETS = [
  {
    id: 'korean',
    label: '🇰🇷 한국어 비교',
    desc: '한국어 자격증 시험 적합도',
    modelIds: [
      'Qwen/Qwen3-32B',
      'Qwen/Qwen2.5-72B-Instruct',
      'CohereLabs/aya-expanse-32b',
      'google/gemma-4-31B-it',
    ],
  },
  {
    id: 'cheap',
    label: '💰 가성비 4종',
    desc: '운영 비용 최소화',
    modelIds: [
      'google/gemma-4-26B-A4B-it',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'Qwen/Qwen3-8B',
      'meta-llama/Llama-3.1-8B-Instruct',
    ],
  },
  {
    id: 'reason',
    label: '🧠 추론 강자',
    desc: '어려운 시험/논리 문제',
    modelIds: [
      'deepseek-ai/DeepSeek-R1-0528',
      'Qwen/Qwen3-235B-A22B-Thinking-2507',
      'moonshotai/Kimi-K2-Thinking',
      'google/gemma-4-31B-it',
    ],
  },
  {
    id: 'fast',
    label: '⚡ 빠른 응답',
    desc: '실시간 UX 검증',
    modelIds: [
      'google/gemma-4-26B-A4B-it',
      'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'Qwen/Qwen3-8B',
      'Qwen/Qwen3-Next-80B-A3B-Instruct',
    ],
  },
  {
    id: 'top',
    label: '🏆 최강 4종',
    desc: '플래그십만',
    modelIds: [
      'google/gemma-4-31B-it',
      'Qwen/Qwen3-235B-A22B-Instruct-2507',
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct',
      'deepseek-ai/DeepSeek-V4-Pro',
    ],
  },
];

/** 카탈로그 + 프리셋 → 카탈로그에 실제 존재하는 모델 ID 만 반환 */
export function resolvePreset(preset, catalog) {
  if (!preset || !catalog) return [];
  const ids = new Set(catalog.map(m => m.id));
  return preset.modelIds.filter(id => ids.has(id));
}

/** 시험 문제 모드 — 응답에서 정답 번호 자동 검출 */
const ANSWER_PATTERNS = [
  /(?:정답|답)[\s:은이]*([①②③④⑤])/,
  /(?:정답|답)[\s:은이]*([1-5])\s*번/,
  /^\s*([①②③④⑤])\s/m,
];
const CIRCLE_TO_NUM = { '①':1, '②':2, '③':3, '④':4, '⑤':5 };

export function extractAnswer(text) {
  if (!text) return null;
  const head = text.slice(0, 400);  // 응답 앞부분만
  for (const pat of ANSWER_PATTERNS) {
    const m = head.match(pat);
    if (m) {
      const v = m[1];
      if (CIRCLE_TO_NUM[v]) return CIRCLE_TO_NUM[v];
      const n = parseInt(v, 10);
      if (n >= 1 && n <= 5) return n;
    }
  }
  return null;
}
