// LLM 설정 패널 — docstore와 동일한 기능
import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { GEMINI_CATALOG, OPENAI_CATALOG, CLAUDE_CATALOG, TIER_COLORS } from '../../constants/models';
import { llmSettings, saveLlmSettings, DEFAULT_LLM_SETTINGS, getActiveProvider, setActiveProvider as saveActiveProvider } from '../../constants/llm';

const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4', catalog: GEMINI_CATALOG },
  { key: 'openai', label: 'OpenAI', color: '#10a37f', catalog: OPENAI_CATALOG },
  { key: 'claude', label: 'Claude', color: '#d97706', catalog: CLAUDE_CATALOG },
];

export default function LlmSettingsPanel() {
  const toast = useToast();
  const [activeProvider, setActiveProviderState] = useState(getActiveProvider);
  const [settings, setSettings] = useState(() => ({
    gemini: { ...llmSettings.gemini },
    openai: { ...llmSettings.openai },
    claude: { ...llmSettings.claude },
  }));

  const current = settings[activeProvider] || {};
  const provider = PROVIDERS.find(p => p.key === activeProvider);
  const catalog = provider?.catalog || [];
  const selectedModel = catalog.find(m => m.id === current.model);

  // Gemini 3.x / 2.5 판별
  const isGemini3 = activeProvider === 'gemini' && current.model?.includes('gemini-3');
  const isGemini25 = activeProvider === 'gemini' && current.model?.includes('gemini-2.5');
  // OpenAI o-시리즈 판별
  const isOSeries = activeProvider === 'openai' && /^o[0-9]/.test(current.model || '');
  // temperature 사용 여부
  const showTemperature = !isOSeries;

  // 설정값 변경
  const update = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [activeProvider]: { ...prev[activeProvider], [key]: value },
    }));
  };

  // 모델 변경 시 기본값 적용
  const handleModelChange = (modelId) => {
    const newSettings = { ...settings[activeProvider], model: modelId };

    if (activeProvider === 'gemini') {
      if (modelId.includes('gemini-3')) {
        newSettings.temperature = 0.3;
        newSettings.thinkingLevel = 'medium';
        delete newSettings.thinkingBudget;
      } else if (modelId.includes('gemini-2.5')) {
        newSettings.temperature = 0.3;
        newSettings.thinkingBudget = 4096;
        delete newSettings.thinkingLevel;
      } else {
        newSettings.temperature = 0.3;
        delete newSettings.thinkingLevel;
        delete newSettings.thinkingBudget;
      }
    } else if (activeProvider === 'openai' && /^o[0-9]/.test(modelId)) {
      newSettings.reasoningEffort = 'medium';
      delete newSettings.temperature;
    } else {
      newSettings.temperature = 0.3;
    }

    setSettings(prev => ({ ...prev, [activeProvider]: newSettings }));
  };

  // 저장
  const handleSave = () => {
    saveLlmSettings(settings);
    toast('LLM 설정이 저장되었습니다.', 'success');
  };

  // 초기화
  const handleReset = () => {
    const defaults = {
      gemini: { ...DEFAULT_LLM_SETTINGS.gemini },
      openai: { ...DEFAULT_LLM_SETTINGS.openai },
      claude: { ...DEFAULT_LLM_SETTINGS.claude },
    };
    setSettings(defaults);
    saveLlmSettings(defaults);
    toast('기본값으로 초기화되었습니다.', 'info');
  };

  const selectClass = "w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all";
  const labelClass = "block text-xs font-semibold text-text-secondary mb-1.5";

  return (
    <div className="space-y-4">
      {/* 프로바이더 탭 */}
      <div className="flex gap-1 bg-badge-bg rounded-xl p-1">
        {PROVIDERS.map(p => (
          <button key={p.key} onClick={() => { setActiveProviderState(p.key); saveActiveProvider(p.key); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeProvider === p.key ? 'bg-card-bg shadow-sm' : 'text-text-secondary hover:text-text'}`}
            style={activeProvider === p.key ? { color: p.color } : {}}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      {/* 모델 선택 */}
      <div>
        <label className={labelClass}>모델</label>
        <select value={current.model || ''} onChange={e => handleModelChange(e.target.value)} className={selectClass}>
          {catalog.map(m => (
            <option key={m.id} value={m.id}>
              {m.id} — {m.desc}
            </option>
          ))}
        </select>
        {/* 모델 정보 배지 */}
        {selectedModel && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: TIER_COLORS[selectedModel.tier] || '#6b7280' }}>
              {selectedModel.tier}
            </span>
            <span className="text-[10px] text-text-secondary">
              입력 {selectedModel.inputP} / 출력 {selectedModel.outputP}
            </span>
            {selectedModel.thinking && (
              <span className="text-[10px] font-semibold text-primary bg-primary-light px-1.5 py-0.5 rounded">Thinking</span>
            )}
            {selectedModel.reasoning && (
              <span className="text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded">Reasoning</span>
            )}
          </div>
        )}
      </div>

      {/* Temperature (o-시리즈 제외) */}
      {showTemperature && (
        <div>
          <label className={labelClass}>
            Temperature <span className="text-text-secondary/60 font-normal ml-1">{current.temperature ?? 0.3}</span>
          </label>
          <input type="range" min="0" max="2" step="0.1"
            value={current.temperature ?? 0.3}
            onChange={e => update('temperature', parseFloat(e.target.value))}
            className="w-full" />
          <div className="flex justify-between text-[10px] text-text-secondary mt-1">
            <span>정확 (0)</span>
            <span>균형 (0.3)</span>
            <span>창의적 (2)</span>
          </div>
        </div>
      )}

      {/* Max Tokens */}
      <div>
        <label className={labelClass}>최대 토큰</label>
        <select value={current.maxTokens || 2048} onChange={e => update('maxTokens', Number(e.target.value))} className={selectClass}>
          <option value={512}>512 (짧은 답변)</option>
          <option value={1024}>1,024 (보통)</option>
          <option value={2048}>2,048 (상세, 기본)</option>
          <option value={4096}>4,096 (매우 상세)</option>
          <option value={8192}>8,192 (최대)</option>
        </select>
      </div>

      {/* Gemini 3.x: Thinking Level */}
      {isGemini3 && (
        <div>
          <label className={labelClass}>Thinking Level</label>
          <select value={current.thinkingLevel || 'medium'} onChange={e => update('thinkingLevel', e.target.value)} className={selectClass}>
            <option value="low">Low — 빠름 (최소 추론)</option>
            <option value="medium">Medium — 균형 (기본)</option>
            <option value="high">High — 최고 정확 (심층 추론)</option>
          </select>
        </div>
      )}

      {/* Gemini 2.5: Thinking Budget */}
      {isGemini25 && selectedModel?.thinking && (
        <div>
          <label className={labelClass}>
            Thinking Budget <span className="text-text-secondary/60 font-normal ml-1">{current.thinkingBudget ?? 0} tokens</span>
          </label>
          <select value={current.thinkingBudget ?? 0} onChange={e => update('thinkingBudget', Number(e.target.value))} className={selectClass}>
            <option value={0}>OFF (즉시 응답)</option>
            <option value={1024}>1,024 (가벼운 추론)</option>
            <option value={4096}>4,096 (일반 추론)</option>
            <option value={8192}>8,192 (심층 추론)</option>
            <option value={16384}>16,384 (최대 추론)</option>
          </select>
        </div>
      )}

      {/* OpenAI o-시리즈: Reasoning Effort */}
      {isOSeries && (
        <div>
          <label className={labelClass}>Reasoning Effort</label>
          <select value={current.reasoningEffort || 'medium'} onChange={e => update('reasoningEffort', e.target.value)} className={selectClass}>
            <option value="low">Low — 빠름 (저비용)</option>
            <option value="medium">Medium — 균형 (기본)</option>
            <option value="high">High — 최고 정확 (고비용)</option>
          </select>
        </div>
      )}

      {/* 저장/초기화 버튼 */}
      <div className="flex gap-2 pt-2">
        <button onClick={handleSave}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors hover:opacity-90"
          style={{ background: provider?.color }}>
          설정 저장
        </button>
        <button onClick={handleReset}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-text-secondary border border-border hover:bg-card-bg-hover transition-colors">
          초기화
        </button>
      </div>
    </div>
  );
}
