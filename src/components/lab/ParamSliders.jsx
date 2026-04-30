// REBUILD30 §0.4 #4 — temperature / maxTokens 슬라이더 통합 컴포넌트 (2026-04-30)
//
// 4 lab (LocalGcp / ServerInfer / HfPlayground / HfCompare) 의 동일 마크업을 통합.
// WebllmPanel 은 number input 사양이라 제외.
//
// 사용:
//   <ParamSliders
//     temperature={temperature} onTemperatureChange={setTemperature}
//     maxTokens={maxTokens} onMaxTokensChange={setMaxTokens}
//     disabled={running}
//   />

export default function ParamSliders({
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  disabled = false,
  tempMin = 0,
  tempMax = 2,
  tempStep = 0.05,
  tokensMin = 64,
  tokensMax = 4096,
  tokensStep = 64,
}) {
  return (
    <div className="rounded-xl border border-border bg-card-bg p-3 grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] font-bold text-text-secondary mb-1">
          Temperature <span className="text-primary font-mono">{temperature.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={tempMin}
          max={tempMax}
          step={tempStep}
          value={temperature}
          onChange={e => onTemperatureChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-text-secondary mb-1">
          Max Tokens <span className="text-primary font-mono">{maxTokens}</span>
        </label>
        <input
          type="range"
          min={tokensMin}
          max={tokensMax}
          step={tokensStep}
          value={maxTokens}
          onChange={e => onMaxTokensChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="w-full"
        />
      </div>
    </div>
  );
}
