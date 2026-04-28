// 시스템 메시지 + 사용자 프롬프트 + 파라미터 + 프리셋 선택
import { useState } from 'react';
import { PROMPT_PRESETS } from '../lib/models';

export default function PromptArea({
  systemMsg, setSystemMsg,
  userMsg, setUserMsg,
  temperature, setTemperature,
  maxTokens, setMaxTokens,
  disabled,
  onSubmit, onCancel, isStreaming,
}) {
  const [presetGroup, setPresetGroup] = useState('');

  function applyPreset(preset) {
    setSystemMsg(preset.system);
    setUserMsg(preset.user);
  }

  return (
    <div className="space-y-3">
      {/* 프리셋 선택 */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">프롬프트 프리셋</label>
        <select
          value={presetGroup}
          onChange={e => {
            const sel = e.target.value;
            setPresetGroup(sel);
            if (!sel) return;
            const [groupIdx, itemIdx] = sel.split(':').map(Number);
            const preset = PROMPT_PRESETS[groupIdx]?.items[itemIdx];
            if (preset) applyPreset(preset);
          }}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg bg-card-bg border border-border text-sm text-text disabled:opacity-50"
        >
          <option value="">— 직접 입력 —</option>
          {PROMPT_PRESETS.map((g, gi) => (
            <optgroup key={gi} label={g.group}>
              {g.items.map((p, pi) => (
                <option key={pi} value={`${gi}:${pi}`}>{p.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 시스템 메시지 */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">시스템 메시지 (선택)</label>
        <textarea
          value={systemMsg}
          onChange={e => setSystemMsg(e.target.value)}
          placeholder="모델의 역할/태도를 정의 (비워두면 사용자 메시지만 전송)"
          disabled={disabled}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-card-bg border border-border text-sm text-text disabled:opacity-50 resize-y font-mono"
        />
      </div>

      {/* 사용자 메시지 */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">사용자 메시지 *</label>
        <textarea
          value={userMsg}
          onChange={e => setUserMsg(e.target.value)}
          placeholder="질문 / 지시문을 입력하세요…"
          disabled={disabled}
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-card-bg border border-border text-sm text-text disabled:opacity-50 resize-y font-mono"
        />
      </div>

      {/* 파라미터 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Temperature <span className="text-primary font-mono">{temperature.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0} max={2} step={0.05}
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Max Tokens <span className="text-primary font-mono">{maxTokens}</span>
          </label>
          <input
            type="range"
            min={64} max={4096} step={64}
            value={maxTokens}
            onChange={e => setMaxTokens(parseInt(e.target.value, 10))}
            disabled={disabled}
            className="w-full"
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/20"
          >
            중지
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={disabled || !userMsg.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-primary/90"
          >
            전송
          </button>
        )}
      </div>
    </div>
  );
}
