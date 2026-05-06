// 엔진 선택 카드 — transformers.js (ONNX/WebGPU, 현재) vs WebLLM (MLC/WebGPU, 7B+ 큰 모델)
// 엔진 선택 (transformers.js vs WebLLM)

const ENGINES = [
  {
    key: 'transformers',
    icon: '⚡',
    title: 'transformers.js (현재)',
    summary: 'HuggingFace ONNX · 0.6~4B 모델 · 모든 데스크톱 + 일부 고사양 모바일',
    detail: '@huggingface/transformers v4 · ONNX q4f16 · WebGPU 전용 · Gemma 4 / Qwen 3.5 5종',
    pros: '가벼움 · 즉시 사용 · 모바일 일부 지원',
    cons: '7B+ 큰 모델 ONNX 변환본 부재',
    palette: 'amber',
  },
  {
    key: 'webllm',
    icon: '🚀',
    title: 'WebLLM (큰 모델)',
    summary: 'MLC AI · 7~9B 모델 · 데스크톱 WebGPU 전용 · OpenAI 호환 API',
    detail: '@mlc-ai/web-llm · MLC 컴파일 모델 q4f16_1 · Qwen 2.5 7B / DeepSeek R1 7B / Llama 3.1 8B',
    pros: '큰 모델 · 추론 최적화 (KV cache · 41 t/s on M3 Max)',
    cons: '데스크톱만 · 다운로드 ~5GB · VRAM 6GB+',
    palette: 'violet',
  },
];

const PALETTE = {
  amber: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    selectedBorder: 'border-amber-600',
    selectedBg: 'bg-amber-600 text-white',
    title: 'text-amber-900 dark:text-amber-200',
  },
  violet: {
    border: 'border-violet-300 dark:border-violet-700',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    selectedBorder: 'border-violet-600',
    selectedBg: 'bg-violet-600 text-white',
    title: 'text-violet-900 dark:text-violet-200',
  },
};

export default function EngineSwitcher({ engine, onChange, webllmEligible, disabled }) {
  return (
    <div className="rounded-xl border border-border bg-card-bg p-3">
      <p className="text-xs font-bold text-text mb-2">🎚 추론 엔진 선택</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ENGINES.map(e => {
          const selected = engine === e.key;
          const p = PALETTE[e.palette];
          const webllmDisabled = e.key === 'webllm' && !webllmEligible;
          const allDisabled = disabled || webllmDisabled;
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => !allDisabled && onChange?.(e.key)}
              disabled={allDisabled}
              className={`text-left rounded-lg border-2 p-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? `${p.selectedBorder} ${p.selectedBg}`
                  : `${p.border} ${p.bg} hover:shadow-sm`
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg">{e.icon}</span>
                <span className={`text-xs font-bold ${selected ? '' : p.title}`}>{e.title}</span>
                {e.key === 'webllm' && webllmDisabled && (
                  <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    데스크톱 전용
                  </span>
                )}
              </div>
              <p className={`text-[10.5px] leading-relaxed mb-1 ${selected ? 'text-white/90' : 'text-text-secondary'}`}>
                {e.summary}
              </p>
              <p className={`text-[9.5px] leading-tight ${selected ? 'text-white/70' : 'text-text-secondary opacity-70'}`}>
                {e.detail}
              </p>
            </button>
          );
        })}
      </div>

      {/* 선택된 엔진의 장단점 */}
      {(() => {
        const e = ENGINES.find(x => x.key === engine);
        if (!e) return null;
        return (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px]">
            <div className="rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">✓ 장점</span>
              <p className="text-emerald-900 dark:text-emerald-200 mt-0.5">{e.pros}</p>
            </div>
            <div className="rounded border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-2 py-1.5">
              <span className="font-bold text-orange-700 dark:text-orange-300">⚠ 한계</span>
              <p className="text-orange-900 dark:text-orange-200 mt-0.5">{e.cons}</p>
            </div>
          </div>
        );
      })()}

      {!webllmEligible && (
        <p className="text-[10px] text-text-secondary opacity-70 mt-2 leading-relaxed">
          💡 WebLLM 은 <b>데스크톱 + WebGPU + RAM 8GB+</b> 환경에서만 활성화됩니다.
        </p>
      )}
    </div>
  );
}
