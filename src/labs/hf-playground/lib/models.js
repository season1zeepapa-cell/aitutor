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
