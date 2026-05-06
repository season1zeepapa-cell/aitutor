// temperature / maxTokens 슬라이더 통합 컴포넌트 (lab 공용)
//
// 4 lab (LocalGcp / ServerInfer / HfPlayground / HfCompare) 의 동일 마크업을 통합.
// WebllmPanel 은 number input 사양이라 제외.
//
// 사용:
//   <ParamSliders
//     temperature={temperature} onTemperatureChange={setTemperature}
//     maxTokens={maxTokens} onMaxTokensChange={setMaxTokens}
//     disabled={running}
//
//     // 선택: thinking 모드 토글 (Qwen 3.5 / DeepSeek R1 같은 reasoning 모델)
//     thinkMode={thinkMode}                  // 'auto' | 'on' | 'off'
//     onThinkModeChange={setThinkMode}
//     thinkSupported={true|false}            // 모델이 think 옵션 지원
//     thinkRecommend={'on'|'off'}            // 모델의 권장값 (auto 일 때 적용될 값 표시)
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
  // thinking 토글 (선택적)
  thinkMode,
  onThinkModeChange,
  thinkSupported = false,
  thinkRecommend,
  // REBUILD33 §33.10 — 번역 보조 토글 (선택적, 한국어 약 모델 시만 노출)
  translateMode,                      // 'off' | 'on'
  onTranslateModeChange,
  translateSupported = false,         // 모델이 한국어 약 (korean_strength ≤ 2) 인지
  translatorName,                     // 번역 보조 모델 이름 (UI 표시용)
  translatorSize,                     // 번역 보조 모델 사이즈
}) {
  const showThinkToggle = thinkSupported && typeof onThinkModeChange === 'function';
  const showTranslateToggle = translateSupported && typeof onTranslateModeChange === 'function';

  return (
    <div className="rounded-xl border border-border bg-card-bg p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
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

      {/* Thinking 모드 토글 — 모델이 think 옵션 지원할 때만 노출 */}
      {showThinkToggle && (
        <div className="border-t border-border pt-2.5">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <label className="text-[11px] font-bold text-text-secondary">
              💭 Thinking 모드
            </label>
            {thinkRecommend && (
              <span className="text-[9px] text-text-secondary">
                권장: <span className="font-bold text-primary">{thinkRecommend === 'on' ? '켜기' : '끄기'}</span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { value: 'auto', label: '자동',  hint: '모델별 권장값 자동 적용' },
              { value: 'on',   label: '켜기',  hint: 'reasoning trace 활성 (응답 늘어짐)' },
              { value: 'off',  label: '끄기',  hint: '빠른 응답 (Qwen 3.5 빈 응답 방지)' },
            ].map(opt => {
              const active = thinkMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onThinkModeChange(opt.value)}
                  disabled={disabled}
                  title={opt.hint}
                  className={`text-[11px] py-1.5 px-2 rounded-lg border-2 transition-all ${
                    active
                      ? 'border-violet-500 bg-violet-500/10 text-text font-bold'
                      : 'border-border text-text-secondary hover:border-violet-400/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-text-secondary opacity-70 mt-1.5 leading-snug">
            ⚠ Qwen 3.5: 켜기 시 0자 응답 위험 / DeepSeek-R1: 끄기 시 토큰 반복 가능
          </p>
        </div>
      )}

      {/* REBUILD33 §33.10 — 번역 보조 토글 (모델이 한국어 약 시만 노출) */}
      {showTranslateToggle && (
        <div className="border-t border-border pt-2.5">
          <div className="flex items-baseline justify-between gap-2 mb-1.5 flex-wrap">
            <label className="text-[11px] font-bold text-text-secondary">
              🌐 번역 보조 (한↔영 양방향)
            </label>
            {translatorName && (
              <span className="text-[9px] text-text-secondary">
                보조 모델: <span className="font-bold text-primary">{translatorName}</span>
                {translatorSize && <span className="opacity-70"> ({translatorSize})</span>}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { value: 'off', label: 'OFF',           hint: '직접 추론 (영어 답변 그대로)' },
              { value: 'on',  label: 'ON 한↔영 양방향', hint: '한→영 → 추론 → 영→한 3단계 자동' },
            ].map(opt => {
              const active = translateMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTranslateModeChange(opt.value)}
                  disabled={disabled}
                  title={opt.hint}
                  className={`text-[11px] py-1.5 px-2 rounded-lg border-2 transition-all ${
                    active
                      ? 'border-emerald-500 bg-emerald-500/10 text-text font-bold'
                      : 'border-border text-text-secondary hover:border-emerald-400/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-text-secondary opacity-70 mt-1.5 leading-snug">
            💡 한국어 약 모델 (Phi/Llama/Mistral 등) 의 한국어 응답 품질을 번역 파이프라인으로 보강.
            <br />
            ⏱ ON 시 3단계 호출 (응답 시간 ↑ — 첫 호출 cold start 1~2분, warm ~15~30초).
          </p>
        </div>
      )}
    </div>
  );
}
