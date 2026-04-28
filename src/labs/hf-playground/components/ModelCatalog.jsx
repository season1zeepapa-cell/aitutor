// HF 모델 카탈로그 — 검색/필터/정렬 가능한 카드 grid (REBUILD22 §x)
//
// 각 카드: 요약(이름, org, capability 배지, context, 가격) + 펼치기(provider별 비교)
import { useMemo, useState } from 'react';
import { CAPABILITY_META, fmtCtx, fmtPrice, sortModels } from '../lib/models';

const CAPS = ['vision', 'audio', 'tools', 'thinking', 'coder', 'moe'];

export default function ModelCatalog({
  catalog,
  selectedId,                    // single 모드용
  selectedIds,                   // multi 모드용 (Set)
  mode = 'single',               // 'single' | 'multi'
  maxMulti = 6,                  // multi 모드 최대 선택 수
  onSelect,                      // single 모드용 (id) => void
  onToggle,                      // multi 모드용 (id) => void
  disabled,
  cacheInfo,
}) {
  const isSelected = (id) => mode === 'multi' ? !!selectedIds?.has(id) : id === selectedId;
  const limitReached = mode === 'multi' && selectedIds && selectedIds.size >= maxMulti;
  const handleCardClick = (id) => {
    if (mode === 'multi') {
      // 이미 선택돼 있으면 해제, 새로 선택은 한도 체크
      if (!selectedIds?.has(id) && limitReached) return;
      onToggle?.(id);
    } else {
      onSelect?.(id);
    }
  };
  const [q, setQ] = useState('');
  const [activeCaps, setActiveCaps] = useState({});  // {vision: true, ...}
  const [sortBy, setSortBy] = useState('org');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    let arr = catalog || [];
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter(m =>
        m.id.toLowerCase().includes(s) ||
        m.org.toLowerCase().includes(s) ||
        m.name.toLowerCase().includes(s)
      );
    }
    const required = Object.keys(activeCaps).filter(k => activeCaps[k]);
    if (required.length) {
      arr = arr.filter(m => required.every(k => m.capabilities[k]));
    }
    return sortModels(arr, sortBy);
  }, [catalog, q, activeCaps, sortBy]);

  const toggleCap = (cap) => setActiveCaps(s => ({ ...s, [cap]: !s[cap] }));

  return (
    <div className="rounded-xl border border-border bg-card-bg p-3 space-y-3">
      {/* 헤더 + 캐시 상태 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-bold text-text">
          📦 모델 카탈로그
          <span className="ml-1.5 text-[10px] text-text-secondary font-normal">
            ({filtered.length} / {catalog?.length || 0}{mode === 'multi' ? ` · 선택 ${selectedIds?.size || 0}/${maxMulti}` : ''})
          </span>
        </p>
        {cacheInfo && (
          <span className="text-[9px] text-text-secondary opacity-60">
            {cacheInfo.cacheHit ? '⚡ 캐시' : '🔄 fresh'} · {Math.round((cacheInfo.cacheAgeMs || 0) / 1000)}s 전
          </span>
        )}
      </div>

      {/* 검색바 */}
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="🔍 이름 / 조직 검색 (예: gemma, qwen, deepseek)"
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50 placeholder:text-text-secondary placeholder:opacity-60"
      />

      {/* capability 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {CAPS.map(cap => {
          const meta = CAPABILITY_META[cap];
          const on = !!activeCaps[cap];
          return (
            <button
              key={cap}
              onClick={() => toggleCap(cap)}
              disabled={disabled}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                on ? meta.color : 'bg-bg border-border text-text-secondary opacity-60 hover:opacity-100'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* 정렬 */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-text-secondary">정렬:</span>
        {[
          ['org', '조직'],
          ['name', '이름'],
          ['price', '저렴'],
          ['context', '컨텍스트 ↓'],
          ['providers', 'Provider 수'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSortBy(v)}
            disabled={disabled}
            className={`px-1.5 py-0.5 rounded ${
              sortBy === v
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 카드 grid */}
      <div className="grid grid-cols-1 gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map(m => {
          const sel = isSelected(m.id);
          const cardDisabled = disabled || (mode === 'multi' && !sel && limitReached);
          return (
            <ModelCard
              key={m.id}
              model={m}
              selected={sel}
              mode={mode}
              expanded={expandedId === m.id}
              onSelect={() => handleCardClick(m.id)}
              onToggleExpand={() => setExpandedId(eid => eid === m.id ? null : m.id)}
              disabled={cardDisabled}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-text-secondary py-4">
            조건에 맞는 모델 없음
          </p>
        )}
      </div>
    </div>
  );
}

function ModelCard({ model, selected, expanded, onSelect, onToggleExpand, disabled, mode = 'single' }) {
  const m = model;
  const caps = Object.keys(m.capabilities).filter(k => m.capabilities[k]);

  return (
    <div className={`rounded-lg border-2 transition-all ${
      selected ? 'border-primary bg-primary-light' : 'border-border bg-card-bg/50'
    }`}>
      {/* 요약 (항상 표시) */}
      <div
        onClick={disabled ? undefined : onSelect}
        className={`p-2 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg/30'}`}
      >
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {mode === 'multi' && (
              <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-bold ${
                selected
                  ? 'bg-primary border-primary text-white'
                  : 'border-text-secondary/40 text-transparent'
              }`}>✓</span>
            )}
            <div className="text-sm font-bold text-text break-all">{m.name}</div>
          </div>
          <div className="text-[10px] text-text-secondary">{m.org}</div>
        </div>

        {/* capability 배지 */}
        {caps.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {caps.map(cap => (
              <span
                key={cap}
                className={`text-[9px] px-1.5 py-0 rounded-full border ${CAPABILITY_META[cap].color}`}
              >
                {CAPABILITY_META[cap].label}
              </span>
            ))}
          </div>
        )}

        {/* meta line */}
        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-secondary">
          <span>📐 ctx <b className="text-text">{fmtCtx(m.maxContextLength)}</b></span>
          <span>🏷️ <b className="text-text">{fmtPrice(m.pricing.minIn)}</b> in</span>
          <span>🌐 <b className="text-text">{m.liveProviderCount}</b> live</span>
        </div>
      </div>

      {/* 펼치기 / 접기 토글 + 상세 */}
      <button
        onClick={onToggleExpand}
        disabled={disabled}
        className="w-full text-[10px] text-primary py-1 border-t border-border hover:bg-bg/30 disabled:opacity-50"
      >
        {expanded ? '▲ Provider 비교 닫기' : '▼ Provider 비교 (' + m.providerCount + ')'}
      </button>

      {expanded && (
        <div className="border-t border-border px-2 py-1.5 space-y-0.5">
          {m.providers.length === 0 && (
            <p className="text-[10px] text-text-secondary">provider 없음</p>
          )}
          {m.providers.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-border last:border-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                p.status === 'live' ? 'bg-success' : 'bg-text-secondary opacity-30'
              }`} />
              <span className="font-bold text-text w-20 truncate">{p.provider}</span>
              <span className="text-text-secondary">{fmtCtx(p.contextLength)}</span>
              {p.pricing && (
                <>
                  <span className="text-text-secondary">in {fmtPrice((p.pricing.input || 0) / 1000)}</span>
                  <span className="text-text-secondary">out {fmtPrice((p.pricing.output || 0) / 1000)}</span>
                </>
              )}
              {p.supportsTools && <span className="text-blue-400">🔧</span>}
              {p.supportsStructuredOutput && <span className="text-emerald-400">{`{}`}</span>}
            </div>
          ))}
          <div className="text-[9px] text-text-secondary opacity-60 pt-1">
            ID: <code className="select-all">{m.id}</code>
          </div>
        </div>
      )}
    </div>
  );
}
