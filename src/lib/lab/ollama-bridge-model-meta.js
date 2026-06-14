// 외부 Ollama bridge 전용 모델 메타 카탈로그 (REBUILD39)
//
// 사용자 PC 에 설치된 임의의 Ollama 모델 태그(예: "qwen3:4b", "gemma4:26b") 를
// 정보 카드용 메타데이터로 매핑한다.
//
// REBUILD32 §15 R-3 (2026-05-05) — 통합/분리/브릿지 완전 독립 운영.
//   본 파일은 브릿지 전용. 통합(LAB_MODELS) / 분리(server.py MODELS) 와 자동 동기화
//   강제 금지. 이 카탈로그의 누락은 "버그" 가 아니라 "의도된 차이".
//
// 매칭 규칙: 사용자가 입력한 모델 태그를 lowercase 후 family prefix 로 룩업.
//   미지원 패밀리는 빈 메타(=정보 카드 미표시) 반환.
//
// 새 패밀리 추가 시:
//   1) OLLAMA_MODEL_META 배열에 항목 추가
//   2) match 정규식 또는 prefix 명시
//   3) capabilities.think_supported 등 정확히 표기 (사용자 신뢰의 직접 근거)

/**
 * @typedef {Object} OllamaModelCapabilities
 * @property {boolean} [think_supported]   - Ollama think:true 옵션 의미 있음 (reasoning 모델)
 * @property {boolean} [think_default]     - thinkMode='auto' 일 때 권장값 (true=on, false=off)
 * @property {boolean} [multimodal]        - 이미지 입력 지원
 * @property {boolean} [tools]             - function calling 지원
 * @property {boolean} [coder]             - 코드 특화
 * @property {number}  [context_k]         - 컨텍스트 길이 (K 단위)
 *
 * @typedef {Object} OllamaModelMeta
 * @property {RegExp}  match               - 모델 태그 매칭 정규식 (lowercase 기준)
 * @property {string}  name                - 표시 이름
 * @property {string}  org                 - 제작 조직
 * @property {string}  [size]              - 대표 사이즈 (정보용 — 실제 사이즈는 Ollama API 에서 받음)
 * @property {number}  [korean_strength]   - 한국어 강도 (1~5, 5=원어민급)
 * @property {OllamaModelCapabilities} [capabilities]
 * @property {{temperature?: number, top_p?: number, repeat_penalty?: number}} [params] - 권장 파라미터
 * @property {string}  [tips]              - 사용 팁 (한국어, 1~2문장)
 */

/** @type {OllamaModelMeta[]} */
export const OLLAMA_MODEL_META = [
  // ─── Qwen 3.5 (Alibaba 최신, 한국어 매우 강) ───────────────────
  // ⚠ Qwen 3.5 thinking 켜기 시 0자 응답 위험 (REBUILD33 §33.8 hotfix)
  {
    match: /^qwen3?\.5/i,
    name: 'Qwen 3.5',
    org: 'Alibaba',
    korean_strength: 5,
    capabilities: { think_supported: true, think_default: false, tools: true, context_k: 32 },
    params: { temperature: 0.3, top_p: 0.9, repeat_penalty: 1.1 },
    tips: '한국어 자격증 해설에 가장 안정적. thinking 은 끄기 권장 (켜면 빈 응답 위험).',
  },

  // ─── Qwen 3 (구세대 — 그래도 한국어 잘함) ─────────────────────
  {
    match: /^qwen3(?!\.5)/i,
    name: 'Qwen 3',
    org: 'Alibaba',
    korean_strength: 4,
    capabilities: { think_supported: true, think_default: false, tools: true, context_k: 32 },
    params: { temperature: 0.3, top_p: 0.9 },
    tips: 'Qwen 3 시리즈는 /no_think 토큰 자동 적용으로 thinking trace 안 나오게 처리됨.',
  },

  // ─── Qwen 2.5 (range 가 넓고 안정적, coder 변형 있음) ──────────
  {
    match: /^qwen2\.5-coder/i,
    name: 'Qwen 2.5 Coder',
    org: 'Alibaba',
    korean_strength: 3,
    capabilities: { coder: true, tools: true, context_k: 32 },
    params: { temperature: 0.2, top_p: 0.95 },
    tips: '코드 / SDK 예제 / API 사용법 질문에 강함. 자격증 한국어 해설은 Qwen 3.5 권장.',
  },
  {
    match: /^qwen2\.5/i,
    name: 'Qwen 2.5',
    org: 'Alibaba',
    korean_strength: 4,
    capabilities: { tools: true, context_k: 32 },
    params: { temperature: 0.3, top_p: 0.9 },
    tips: '범용 / 한국어 강. Qwen 3.5 가 없을 때 차선택.',
  },

  // ─── Gemma 4 (Google 신형, 멀티모달) ─────────────────────────
  // REBUILD41 (2026-05-07) — 사용자 보고: gemma4:e4b 가 reasoning 을 영문으로 출력 + thinking 필드로 빠짐
  //   → think_supported: true 로 토글 노출 + think_default: false 로 자동 OFF
  //   → 한국어 lock (REBUILD41) 으로 reasoning 자체를 한국어로 진행하게 강제
  {
    match: /^gemma4/i,
    name: 'Gemma 4',
    org: 'Google',
    korean_strength: 3,
    capabilities: { multimodal: true, context_k: 128, think_supported: true, think_default: false },
    params: { temperature: 0.3, top_p: 0.95, repeat_penalty: 1.05 },
    tips: 'Gemma 패밀리 / 멀티모달 / 128K. ⚠ thinking 켜면 reasoning trace 만 노출되고 답변이 빈 응답처럼 보임 — "끄기" 권장.',
  },

  // ─── Gemma 3 (안정 버전) ────────────────────────────────────
  // REBUILD41 — Gemma 3 도 일부 빌드가 thinking 모드 가짐. 동일하게 토글 노출 + 자동 OFF.
  {
    match: /^gemma3/i,
    name: 'Gemma 3',
    org: 'Google',
    korean_strength: 3,
    capabilities: { multimodal: true, context_k: 128, think_supported: true, think_default: false },
    params: { temperature: 0.3, top_p: 0.95 },
    tips: '128K + 멀티모달. 한국어는 Qwen 3.5 보다 약하지만 Gemma 4 보다 안정적. thinking "끄기" 권장.',
  },

  // ─── Gemma 2 (구세대 안정) ──────────────────────────────────
  {
    match: /^gemma2/i,
    name: 'Gemma 2',
    org: 'Google',
    korean_strength: 2,
    capabilities: { context_k: 8 },
    params: { temperature: 0.4, top_p: 0.95 },
    tips: '경량 / 다국어 기본. 한국어 약함 → 핵심 키워드만 쓰는 짧은 질문에 유리.',
  },

  // ─── DeepSeek R1 (reasoning 특화) ────────────────────────────
  // ⚠ thinking 끄기 시 토큰 반복 가능 (REBUILD33 §33.9)
  {
    match: /^deepseek-r1/i,
    name: 'DeepSeek R1',
    org: 'DeepSeek',
    korean_strength: 3,
    capabilities: { think_supported: true, think_default: true, context_k: 64 },
    params: { temperature: 0.6, top_p: 0.95, repeat_penalty: 1.15 },
    tips: 'Reasoning 특화. thinking 켜기 권장 (끄면 토큰 반복 degeneration 발생 가능).',
  },

  // ─── DeepSeek (R1 외 변형) ─────────────────────────────────
  {
    match: /^deepseek/i,
    name: 'DeepSeek',
    org: 'DeepSeek',
    korean_strength: 3,
    capabilities: { coder: true, context_k: 16 },
    params: { temperature: 0.3, top_p: 0.9 },
    tips: '코드 / 수학 강세. R1 계열이 아니면 thinking 옵션 없음.',
  },

  // ─── Llama 3.2 (Meta, 경량) ────────────────────────────────
  {
    match: /^llama3\.2/i,
    name: 'Llama 3.2',
    org: 'Meta',
    korean_strength: 2,
    capabilities: { tools: true, context_k: 128 },
    params: { temperature: 0.4, top_p: 0.95 },
    tips: '가벼운 영어 / 응답 속도 우선. 한국어 약 — 번역 보조 권장.',
  },

  // ─── Llama 3.1 (균형) ─────────────────────────────────────
  {
    match: /^llama3\.1/i,
    name: 'Llama 3.1',
    org: 'Meta',
    korean_strength: 2,
    capabilities: { tools: true, context_k: 128 },
    params: { temperature: 0.4, top_p: 0.95 },
    tips: '영어 일반 / TOEIC LC 강세. 한국어는 약 — 영어 답변 후 직접 번역하는 흐름 권장.',
  },

  // ─── Llama 3 (구세대) ─────────────────────────────────────
  {
    match: /^llama3/i,
    name: 'Llama 3',
    org: 'Meta',
    korean_strength: 2,
    capabilities: { context_k: 8 },
    params: { temperature: 0.5, top_p: 0.9 },
    tips: '영어 답변 우선. 한국어 자격증 해설은 Qwen 계열 권장.',
  },

  // ─── Phi-4 (Microsoft, reasoning 강) ────────────────────────
  {
    match: /^phi-?4/i,
    name: 'Phi-4',
    org: 'Microsoft',
    korean_strength: 2,
    capabilities: { context_k: 16 },
    params: { temperature: 0.3, top_p: 0.95 },
    tips: '영어 reasoning / 시나리오 분석 강. 한국어 약 — 번역 보조 또는 영어 질문 권장.',
  },

  // ─── Phi-3.5 (경량) ──────────────────────────────────────
  {
    match: /^phi-?3\.5/i,
    name: 'Phi-3.5',
    org: 'Microsoft',
    korean_strength: 2,
    capabilities: { context_k: 128 },
    params: { temperature: 0.3, top_p: 0.95 },
    tips: '경량 영어 추론 / TOEIC RC 강세. 한국어 약.',
  },

  // ─── Mistral (영어 다양성) ────────────────────────────────
  {
    match: /^mistral/i,
    name: 'Mistral',
    org: 'Mistral',
    korean_strength: 2,
    capabilities: { tools: true, context_k: 32 },
    params: { temperature: 0.4, top_p: 0.95 },
    tips: '영어 다양성. 한국어는 Qwen 계열 권장.',
  },

  // ─── GPT-OSS / GPT-OSS-Safeguard (OpenAI 오픈소스 안전 정책 모델) ───
  {
    match: /^gpt-oss-safeguard/i,
    name: 'GPT-OSS Safeguard',
    org: 'OpenAI',
    korean_strength: 3,
    capabilities: { context_k: 32 },
    params: { temperature: 0.2, top_p: 0.9 },
    tips: 'OpenAI 안전 정책 분류 특화. 자격증 해설보다 컨텐츠 검토 / 정책 분석에 적합.',
  },
  {
    match: /^gpt-oss/i,
    name: 'GPT-OSS',
    org: 'OpenAI',
    korean_strength: 3,
    capabilities: { tools: true, context_k: 32 },
    params: { temperature: 0.3, top_p: 0.9 },
    tips: 'OpenAI 오픈소스. 범용 강세 / 한국어 중간.',
  },

  // ─── Solar / Solar-Pro (Upstage, 한국 토종) ─────────────────
  {
    match: /^solar/i,
    name: 'Solar',
    org: 'Upstage',
    korean_strength: 5,
    capabilities: { context_k: 32 },
    params: { temperature: 0.3, top_p: 0.9 },
    tips: '한국 Upstage 제작 — 한국어 최강. 자격증 한국어 해설에 추천.',
  },

  // ─── EEVE (Yanolja, 한국어 특화) ───────────────────────────
  {
    match: /^eeve/i,
    name: 'EEVE',
    org: 'Yanolja',
    korean_strength: 5,
    capabilities: { context_k: 4 },
    params: { temperature: 0.3, top_p: 0.9 },
    tips: '야놀자 EEVE — 한국어 특화 한국 토종 모델. 컨텍스트 4K 짧음에 주의.',
  },
];

/** 알 수 없는 모델 태그용 빈 메타 — 정보 카드 미표시 */
const EMPTY_META = Object.freeze({});

/**
 * 모델 태그 → 메타데이터 매핑.
 * 매칭 실패 시 EMPTY_META (정보 카드 노출 조건 미충족 → 자동 숨김).
 *
 * @param {string} modelTag - 예: "qwen3:4b", "gemma4:26b"
 * @returns {OllamaModelMeta | {}} - 메타 또는 빈 객체
 */
export function getOllamaModelMeta(modelTag) {
  if (!modelTag) return EMPTY_META;
  const tag = String(modelTag).toLowerCase();
  for (const entry of OLLAMA_MODEL_META) {
    if (entry.match.test(tag)) {
      return entry;
    }
  }
  return EMPTY_META;
}

/**
 * thinkMode='auto' 일 때 적용할 실효 think 값 결정.
 * - 모델이 think_supported 가 아니면 → undefined (Ollama 가 처리)
 * - think_default 가 true → true
 * - 그 외 → false (안전 디폴트, REBUILD33 §33.8 Qwen 3.5 빈 응답 방지)
 *
 * @param {OllamaModelMeta | {}} meta
 * @returns {boolean | undefined}
 */
export function resolveAutoThink(meta) {
  if (!meta?.capabilities?.think_supported) return undefined;
  return !!meta.capabilities.think_default;
}
