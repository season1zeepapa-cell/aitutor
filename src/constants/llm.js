// LLM 설정 상수 및 저장/로드 함수

const STORAGE_KEY = 'aitutor_llm_settings';

export const DEFAULT_LLM_SETTINGS = {
  gemini: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 2048, thinkingBudget: 0 },
  openai: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 2048 },
  claude: { model: 'claude-sonnet-4-20250514', temperature: 0.3, maxTokens: 2048 },
  // 디바이스 AI (REBUILD18) — 브라우저 WebGPU 추론. model 키는 MODEL_REGISTRY 의 size key
  local:  { model: 'qwen35-2b', temperature: 0.3, maxTokens: 512 },
};

// 전역 설정 객체 (ESM import에서 참조 공유)
export let llmSettings = loadLlmSettings();

// 설정 로드 (localStorage)
export function loadLlmSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 기본값과 머지 (누락 키 보완)
      return {
        gemini: { ...DEFAULT_LLM_SETTINGS.gemini, ...parsed.gemini },
        openai: { ...DEFAULT_LLM_SETTINGS.openai, ...parsed.openai },
        claude: { ...DEFAULT_LLM_SETTINGS.claude, ...parsed.claude },
        local:  { ...DEFAULT_LLM_SETTINGS.local,  ...parsed.local },
      };
    }
  } catch {}
  return { ...DEFAULT_LLM_SETTINGS };
}

// 설정 저장 (localStorage)
export function saveLlmSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
  // 전역 객체 업데이트
  Object.assign(llmSettings, settings);
}

// 전역 설정 업데이트 (저장 없이)
export function updateLlmSettings(newSettings) {
  Object.assign(llmSettings, newSettings);
}

// 활성 프로바이더 로드
export function getActiveProvider() {
  if (typeof window === 'undefined') return 'gemini';
  return localStorage.getItem('aitutor_active_provider') || 'gemini';
}

// 활성 프로바이더 저장
export function setActiveProvider(provider) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('aitutor_active_provider', provider);
  }
}
