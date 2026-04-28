// 모델 드롭다운 + 설명 카드
import { MODELS, TIER_LABEL, findModel } from '../lib/models';

export default function ModelPicker({ value, onChange, disabled }) {
  const current = findModel(value) || MODELS[0];

  // tier 별로 그룹화
  const grouped = MODELS.reduce((acc, m) => {
    (acc[m.tier] = acc[m.tier] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-text-secondary">모델</label>
      <select
        value={value || current.id}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg bg-card-bg border border-border text-sm text-text disabled:opacity-50"
      >
        {Object.keys(grouped).map(tier => (
          <optgroup key={tier} label={TIER_LABEL[tier] || tier}>
            {grouped[tier].map(m => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.org}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="text-[11px] text-text-secondary leading-relaxed px-1">
        <span className="font-medium text-text">{current.note}</span>
        <span className="opacity-60"> · </span>
        <span>입력 ${current.pricing.in}/1K · 출력 ${current.pricing.out}/1K</span>
      </div>
    </div>
  );
}
