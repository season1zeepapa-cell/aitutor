// HF Inference Providers — 프롬프트 프리셋 + 가격/시험 헬퍼 (REBUILD22 §x)
//
// 모델 카탈로그는 /api/hf-models 에서 동적으로 받음 (lib/hfClient.js#fetchModelCatalog).
// 본 파일은 클라이언트가 받은 catalog 객체를 처리하는 헬퍼만 제공.

// 자유 프롬프트 모드용 프리셋 (영상정보관리사 5종 + 일반 4종)
export const PROMPT_PRESETS = [
  {
    group: '영상정보관리사',
    items: [
      {
        title: '개인영상정보 보호 — 정의',
        system: '당신은 영상정보관리사 자격증 시험 전문 강사입니다. 정답을 명확히 제시하고 관련 법령 조문을 인용하세요.',
        user: '개인영상정보의 정의를 개인정보보호법 기준으로 설명하고, 일반 개인정보와의 차이를 비교해주세요.',
      },
      {
        title: 'CCTV 설치 신고 절차',
        system: '당신은 영상정보관리사 자격증 시험 전문 강사입니다.',
        user: '공공기관이 공개된 장소에 CCTV를 설치할 때 거쳐야 하는 절차와 의무 사항을 단계별로 정리해주세요.',
      },
      {
        title: '영상정보 보존 기간',
        system: '당신은 영상정보관리사 자격증 시험 전문 강사입니다.',
        user: '영상정보의 보존 기간 산정 기준과 파기 절차를 법령 근거와 함께 설명해주세요.',
      },
      {
        title: '주관식 채점 (예시)',
        system: '당신은 영상정보관리사 시험 채점관입니다. 학생 답안을 1~10점으로 채점하고 핵심 누락사항을 지적하세요.',
        user: '문제: 영상정보처리기기 설치 시 안내판 의무 기재사항은?\n\n학생 답안: 설치 목적, 촬영 범위, 관리책임자 연락처를 적어야 합니다.',
      },
      {
        title: '오답 분석',
        system: '당신은 영상정보관리사 강사입니다. 학생이 왜 오답을 골랐는지 추정하고 올바른 학습 포인트를 제시하세요.',
        user: '문제: 다음 중 영상정보처리기기 운영자의 의무가 아닌 것은?\n① 안내판 설치  ② 운영방침 수립  ③ 영상의 무한 보관  ④ 위탁 시 계약서 작성\n\n학생 선택: ②  /  정답: ③',
      },
    ],
  },
  {
    group: '일반 평가',
    items: [
      {
        title: '한국어 능력',
        system: '당신은 정확한 한국어 사용을 검증하는 평가자입니다.',
        user: '다음 문장의 띄어쓰기/맞춤법을 교정하고 자연스럽게 다시 써주세요:\n\n"오늘은 비가많이와서 우산이없이 외출하기는 힘들것 같다."',
      },
      {
        title: '추론 능력',
        system: '단계별로 사고 과정을 보여주며 답하세요.',
        user: '한 농부가 늑대, 양, 양배추를 강 건너로 옮겨야 합니다. 보트는 농부 외에 한 가지만 실을 수 있고, 늑대는 양을, 양은 양배추를 먹습니다. 어떤 순서로 옮겨야 할까요?',
      },
      {
        title: '코드 생성',
        system: '간결하고 동작하는 코드만 제공하세요. 설명은 최소화.',
        user: 'JavaScript로 두 정렬된 배열을 병합해 단일 정렬 배열을 만드는 함수를 작성해주세요. 시간복잡도 O(n+m).',
      },
      {
        title: '요약',
        system: '핵심만 3개의 불릿으로 요약하세요.',
        user: 'CloudFront OAC 는 CloudFront 가 origin 으로 가는 모든 요청에 SigV4 서명을 자동으로 추가하는 기능입니다. S3 와 Lambda Function URL 같은 origin 이 IAM 인증을 요구할 때, 클라이언트가 직접 서명을 만들 수 없는 상황에서 CloudFront 가 service-linked credential 로 대신 서명해 호출을 가능하게 합니다.',
      },
    ],
  },
];

const CIRCLE = ['①','②','③','④','⑤'];
export { CIRCLE };

/** 시험 문제 모드 — 한국어 자격증 시험 해설 prompt 빌드 */
export function buildExamMessages(question) {
  const choices = question.choices || [];
  const choicesText = choices.map((c, i) => `${CIRCLE[i]} ${c}`).join('\n');
  const answerLabel = CIRCLE[(question.answer || 1) - 1] || '①';
  const userPrompt = `자격증 시험 강사로서 한국어로 정답 해설.
「법령명」 인용. 보기별 한 줄 설명.

[문제]
${question.body || ''}

[보기]
${choicesText}

[정답] ${answerLabel}

각 보기가 왜 맞고 틀린지 한 줄씩 설명해주세요.`;

  return {
    system: '당신은 한국어 자격증 시험 전문 강사입니다. 정답을 정확히 설명하고 관련 법령을 인용하세요.',
    user: userPrompt,
  };
}

/** USD → 원 환산 (대략 ~1400원, 표시용) */
export function usdToKrw(usd, rate = 1400) {
  return Math.round(usd * rate * 100) / 100;
}

/** 동적 카탈로그 모델 + 토큰 수 → USD 비용 (per 1K) */
export function calcCost({ model, inputTokens = 0, outputTokens = 0 }) {
  if (!model?.pricing) return 0;
  const pin = model.pricing.minIn ?? model.pricing.avgIn;
  const pout = model.pricing.avgOut ?? model.pricing.minIn;
  if (pin == null || pout == null) return 0;
  const cost = (inputTokens || 0) * pin / 1000 + (outputTokens || 0) * pout / 1000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** 컨텍스트 길이 친화 표시 (32K, 256K, 1M) */
export function fmtCtx(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** 가격 친화 표시 (USD per 1M tokens 형태) */
export function fmtPrice(usdPer1K) {
  if (usdPer1K == null) return '—';
  const per1M = usdPer1K * 1000;
  if (per1M < 0.01) return `$${per1M.toFixed(4)}/1M`;
  if (per1M < 1)   return `$${per1M.toFixed(2)}/1M`;
  return `$${per1M.toFixed(1)}/1M`;
}

/** capability 배지 정의 */
export const CAPABILITY_META = {
  vision:   { label: '🖼️ Vision',   color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  audio:    { label: '🔊 Audio',    color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  tools:    { label: '🔧 Tools',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  thinking: { label: '🧠 Thinking', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  coder:    { label: '💻 Coder',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  moe:      { label: '🌐 MoE',      color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
};

// ─────────────────────────────────────────────────────────────────────────
// REBUILD30 §33 (2026-05-03) — 시리즈 메타 + 큐레이션 + localStorage 헬퍼
// ─────────────────────────────────────────────────────────────────────────

/** 모델 시리즈별 특징 설명 (org 기반 자동 매칭) */
export const FAMILY_INFO = {
  Qwen:        { flag: '🇨🇳', tag: 'Alibaba',    note: '한국어/중국어 강세 · 자격증 해설 추천 ⭐' },
  meta:        { flag: '🇺🇸', tag: 'Meta',       note: '영어 표준 · 가장 다양한 fine-tune 생태계' },
  'meta-llama':{ flag: '🇺🇸', tag: 'Meta',       note: '영어 표준 · 가장 다양한 fine-tune 생태계' },
  deepseek:    { flag: '🇨🇳', tag: 'DeepSeek',   note: '코딩/수학 특화 · R1 reasoning 강세' },
  'deepseek-ai':{flag: '🇨🇳', tag: 'DeepSeek',   note: '코딩/수학 특화 · R1 reasoning 강세' },
  google:      { flag: '🇺🇸', tag: 'Google',     note: '효율적 · Gemma 4 부터 멀티모달 강화' },
  mistralai:   { flag: '🇫🇷', tag: 'Mistral AI', note: '유럽 · 범용 강세 · MoE 효율 (Mixtral)' },
  anthropic:   { flag: '🇺🇸', tag: 'Anthropic',  note: '안전성 + long context · Claude 시리즈' },
  openai:      { flag: '🇺🇸', tag: 'OpenAI',     note: 'GPT 시리즈 · 일반 표준' },
  microsoft:   { flag: '🇺🇸', tag: 'Microsoft',  note: 'Phi 시리즈 · 작아도 강한 SLM' },
  nvidia:      { flag: '🇺🇸', tag: 'NVIDIA',     note: 'Nemotron · GPU 최적화' },
  'nv-mistralai':{flag:'🇺🇸', tag: 'NVIDIA × Mistral', note: '하이브리드 튜닝' },
  cohere:      { flag: '🇨🇦', tag: 'Cohere',     note: '엔터프라이즈 RAG · Command 시리즈' },
  'CohereLabs':{ flag: '🇨🇦', tag: 'Cohere Labs', note: '엔터프라이즈 RAG · Command 시리즈' },
  'CohereForAI':{flag: '🇨🇦', tag: 'Cohere for AI', note: 'Aya 시리즈 · 다국어 강세' },
  'zai-org':   { flag: '🇨🇳', tag: 'Z.ai',       note: 'GLM-4.5 · 한국어 OK · MoE 효율' },
  'baidu':     { flag: '🇨🇳', tag: 'Baidu',      note: 'Ernie 시리즈 · 중국어 강세' },
  'moonshotai':{ flag: '🇨🇳', tag: 'Moonshot AI', note: 'Kimi 시리즈 · long context 강세' },
  'TheStage-AI':{flag: '🇺🇸', tag: 'TheStage AI', note: '특화 fine-tune' },
};

/** org 가 매칭 안 되면 fallback */
export const DEFAULT_FAMILY_INFO = { flag: '🌐', tag: '기타', note: '' };

/** 추천 큐레이션 칩 — 클릭 시 어떤 필터 자동 적용 */
export const CURATED_PRESETS = [
  {
    key: 'korean',
    label: '⭐ 한국어 강세',
    desc: 'Qwen / Aya / GLM 등 다국어 강세 시리즈',
    apply: (models) => models.filter(m => /Qwen|Aya|GLM|Yi|Solar|Kimi/i.test(m.id)),
  },
  {
    key: 'cheap',
    label: '💰 가장 저렴',
    desc: '$0.20/1M 이하 + live provider 보유',
    apply: (models) => models.filter(m => (m.pricing.minIn ?? Infinity) * 1000 <= 0.20 && m.liveProviderCount > 0)
      .sort((a, b) => (a.pricing.minIn ?? Infinity) - (b.pricing.minIn ?? Infinity)),
  },
  {
    key: 'thinking',
    label: '🧠 Thinking / Reasoning',
    desc: 'R1 / Reasoner / Thinking 시리즈',
    apply: (models) => models.filter(m => m.capabilities.thinking),
  },
  {
    key: 'coder',
    label: '💻 Coder',
    desc: '코드 생성 특화',
    apply: (models) => models.filter(m => m.capabilities.coder),
  },
  {
    key: 'vision',
    label: '🖼️ Vision (멀티모달)',
    desc: '이미지 입력 가능',
    apply: (models) => models.filter(m => m.capabilities.vision),
  },
  {
    key: 'tools',
    label: '🔧 Tools (Function calling)',
    desc: '도구 호출 지원',
    apply: (models) => models.filter(m => m.capabilities.tools),
  },
  {
    key: 'longctx',
    label: '📐 Long Context (128K+)',
    desc: '128K 이상 컨텍스트',
    apply: (models) => models.filter(m => (m.maxContextLength || 0) >= 128_000),
  },
  {
    key: 'fast',
    label: '⚡ 빠름 (provider 多)',
    desc: 'live provider 3개 이상',
    apply: (models) => models.filter(m => m.liveProviderCount >= 3)
      .sort((a, b) => b.liveProviderCount - a.liveProviderCount),
  },
];

/** 시리즈 빠른 필터 — 인기 series prefix 매칭 */
export const SERIES_FILTERS = [
  { key: 'all',      label: '전체',      match: () => true },
  { key: 'qwen',     label: 'Qwen',      match: (m) => /^Qwen|qwen/i.test(m.name) },
  { key: 'llama',    label: 'Llama',     match: (m) => /Llama|llama/i.test(m.name) },
  { key: 'deepseek', label: 'DeepSeek',  match: (m) => /DeepSeek|deepseek/i.test(m.name) },
  { key: 'gemma',    label: 'Gemma',     match: (m) => /Gemma|gemma/i.test(m.name) },
  { key: 'mistral',  label: 'Mistral',   match: (m) => /Mistral|Mixtral|mistral/i.test(m.name) },
  { key: 'phi',      label: 'Phi',       match: (m) => /^Phi|phi/i.test(m.name) },
  { key: 'glm',      label: 'GLM',       match: (m) => /^GLM|glm/i.test(m.name) },
  { key: 'aya',      label: 'Aya',       match: (m) => /^aya|Aya/i.test(m.name) },
];

/** 모델의 시리즈 정보 조회 (org → FAMILY_INFO) */
export function getFamilyInfo(model) {
  if (!model) return DEFAULT_FAMILY_INFO;
  return FAMILY_INFO[model.org] || DEFAULT_FAMILY_INFO;
}

// ─── localStorage 헬퍼 (즐겨찾기 + 최근 사용) ─────────────────
const FAV_KEY = 'hf_favorites';
const RECENT_KEY = 'hf_recent_models';
const RECENT_MAX = 5;

export function getFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

export function toggleFavorite(modelId) {
  const favs = getFavorites();
  if (favs.has(modelId)) favs.delete(modelId);
  else favs.add(modelId);
  try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favs))); } catch {}
  return favs;
}

export function getRecentModels() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function pushRecentModel(modelId) {
  if (!modelId) return;
  const recent = getRecentModels().filter(id => id !== modelId);
  recent.unshift(modelId);
  const trimmed = recent.slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed)); } catch {}
  return trimmed;
}

/** 모델 정렬/그룹화 헬퍼 */
export function sortModels(models, by = 'org') {
  const arr = [...models];
  switch (by) {
    case 'price':
      return arr.sort((a, b) => (a.pricing.minIn ?? Infinity) - (b.pricing.minIn ?? Infinity));
    case 'context':
      return arr.sort((a, b) => (b.maxContextLength || 0) - (a.maxContextLength || 0));
    case 'providers':
      return arr.sort((a, b) => b.liveProviderCount - a.liveProviderCount);
    case 'name':
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case 'org':
    default:
      return arr.sort((a, b) => (a.org + a.name).localeCompare(b.org + b.name));
  }
}
