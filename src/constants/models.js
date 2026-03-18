// AI 모델 카탈로그 — docstore와 동일

export const GEMINI_CATALOG = [
  { id: 'gemini-3.1-pro-preview', tier: '최신', inputP: '$2.50', outputP: '$15.00', thinking: true, desc: '최고 성능 · 추론 특화' },
  { id: 'gemini-3-flash-preview', tier: '최신', inputP: '$0.15', outputP: '$0.60', thinking: true, desc: 'Pro급 추론 + Flash 속도' },
  { id: 'gemini-3.1-flash-lite-preview', tier: '최신', inputP: '$0.02', outputP: '$0.10', thinking: false, desc: '저비용 고속' },
  { id: 'gemini-2.5-pro', tier: '고성능', inputP: '$1.25~2.50', outputP: '$10.00~15.00', thinking: true, desc: '최고 성능 · 장문 멀티모달' },
  { id: 'gemini-2.5-flash', tier: '추천', inputP: '$0.15~0.30', outputP: '$0.60~2.50', thinking: true, desc: '최고 가성비 · 기본 권장' },
  { id: 'gemini-2.5-flash-lite', tier: '저비용', inputP: '$0.02', outputP: '$0.10', thinking: false, desc: '최저 비용' },
];

export const OPENAI_CATALOG = [
  { id: 'gpt-5.4', tier: '최신', inputP: '$2.50', outputP: '$10.00', desc: '1.05M 컨텍스트 · 추론 모델' },
  { id: 'gpt-5-mini', tier: '추천', inputP: '$0.40', outputP: '$1.60', desc: '빠르고 저렴' },
  { id: 'gpt-5-nano', tier: '저비용', inputP: '$0.10', outputP: '$0.40', desc: '최저 비용' },
  { id: 'o4-mini', tier: '추론', inputP: '$1.10', outputP: '$4.40', reasoning: true, desc: '최신 경량 추론' },
  { id: 'o3-pro', tier: '최고급', inputP: '$20.00', outputP: '$80.00', reasoning: true, desc: '최강 추론 성능' },
  { id: 'o3', tier: '추론', inputP: '$2.00', outputP: '$8.00', reasoning: true, desc: '강력한 추론' },
  { id: 'o3-mini', tier: '추론', inputP: '$1.10', outputP: '$4.40', reasoning: true, desc: '경제적 추론' },
  { id: 'gpt-4o', tier: '중간', inputP: '$2.50', outputP: '$10.00', desc: '멀티모달 · 영상 이해' },
  { id: 'gpt-4o-mini', tier: '저비용', inputP: '$0.15', outputP: '$0.60', desc: '가성비 멀티모달' },
];

export const CLAUDE_CATALOG = [
  { id: 'claude-sonnet-4-20250514', tier: '추천', inputP: '$3.00', outputP: '$15.00', desc: '균형잡힌 성능' },
  { id: 'claude-haiku-4-5-20251001', tier: '저비용', inputP: '$0.80', outputP: '$4.00', desc: '빠르고 저렴' },
];

export const TIER_COLORS = {
  '최신': '#e11d48',
  '추천': '#10b981',
  '저비용': '#06b6d4',
  '중간': '#6b7280',
  '고성능': '#3b82f6',
  '최고급': '#8b5cf6',
  '추론': '#f59e0b',
};
