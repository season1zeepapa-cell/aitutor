// HF 모델 카탈로그 — 검색 + 그룹 + 최근 사용 모델 반영
//
// 8 Phase 통합:
//  1. 추천 큐레이션 칩 (한국어 강세/저렴/Thinking/Coder/Vision/Tools/LongCtx/Fast)
//  2. 시리즈 빠른 필터 (Qwen/Llama/DeepSeek/Gemma/Mistral/Phi/GLM/Aya)
//  3. 조직별 그룹 헤더 + 펼침/접기
//  4. 2-cols grid (데스크톱) + 1-col (모바일)
//  5. provider 가격 메인 카드 표시 (최저/평균)
//  6. 시리즈별 특징 설명 (FAMILY_INFO)
//  7. ⭐ 즐겨찾기 (localStorage)
//  8. ⏱ 최근 사용 (localStorage)
import { useMemo, useState, useEffect } from 'react';
import {
  CAPABILITY_META, fmtCtx, fmtPrice, sortModels,
  CURATED_PRESETS, SERIES_FILTERS, FAMILY_INFO, DEFAULT_FAMILY_INFO, getFamilyInfo,
  getFavorites, toggleFavorite, getRecentModels,
} from '../lib/models';

const CAPS = ['vision', 'audio', 'tools', 'thinking', 'coder', 'moe'];

export default function ModelCatalog({
  catalog,
  selectedId,
  selectedIds,
  mode = 'single',
  maxMulti = 6,
  onSelect,
  onToggle,
  disabled,
  cacheInfo,
}) {
  const isSelected = (id) => mode === 'multi' ? !!selectedIds?.has(id) : id === selectedId;
  const limitReached = mode === 'multi' && selectedIds && selectedIds.size >= maxMulti;
  const handleCardClick = (id) => {
    if (mode === 'multi') {
      if (!selectedIds?.has(id) && limitReached) return;
      onToggle?.(id);
    } else {
      onSelect?.(id);
    }
  };

  // 검색 / 필터 / 정렬 state
  const [q, setQ] = useState('');
  const [activeCaps, setActiveCaps] = useState({});
  const [sortBy, setSortBy] = useState('org');
  const [expandedId, setExpandedId] = useState(null);
  const [activeCurated, setActiveCurated] = useState(null);  // CURATED_PRESETS key
  const [activeSeries, setActiveSeries] = useState('all');   // SERIES_FILTERS key
  const [collapsedOrgs, setCollapsedOrgs] = useState({});    // {org: true(접힘)}
  const [showFilters, setShowFilters] = useState(false);

  // 즐겨찾기 + 최근 사용 (localStorage)
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [recentIds, setRecentIds] = useState(() => getRecentModels());

  // 즐겨찾기 토글 + 최근 갱신 (다른 컴포넌트가 갱신했을 때 sync)
  useEffect(() => {
    const onStorage = () => {
      setFavorites(getFavorites());
      setRecentIds(getRecentModels());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleToggleFav = (id) => setFavorites(toggleFavorite(id));

  // ─── 필터링 파이프라인 ─────────────────
  const filtered = useMemo(() => {
    let arr = catalog || [];

    // 1) 큐레이션 칩 (활성 시 우선 적용)
    if (activeCurated) {
      const preset = CURATED_PRESETS.find(p => p.key === activeCurated);
      if (preset) arr = preset.apply(arr);
    }

    // 2) 시리즈 빠른 필터
    if (activeSeries !== 'all') {
      const series = SERIES_FILTERS.find(s => s.key === activeSeries);
      if (series) arr = arr.filter(series.match);
    }

    // 3) 검색
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter(m =>
        m.id.toLowerCase().includes(s) ||
        m.org.toLowerCase().includes(s) ||
        m.name.toLowerCase().includes(s)
      );
    }

    // 4) capability 필터
    const required = Object.keys(activeCaps).filter(k => activeCaps[k]);
    if (required.length) {
      arr = arr.filter(m => required.every(k => m.capabilities[k]));
    }

    return sortModels(arr, sortBy);
  }, [catalog, q, activeCaps, sortBy, activeCurated, activeSeries]);

  // ─── 즐겨찾기 + 최근 사용 모델 (전체 catalog 에서 추출) ───
  const favModels = useMemo(
    () => (catalog || []).filter(m => favorites.has(m.id)),
    [catalog, favorites]
  );
  const recentModels = useMemo(
    () => recentIds.map(id => (catalog || []).find(m => m.id === id)).filter(Boolean),
    [catalog, recentIds]
  );

  // ─── 조직별 그룹 (활성 큐레이션/시리즈 없을 때만) ───
  const groupedByOrg = useMemo(() => {
    if (sortBy !== 'org') return null;  // 정렬이 'org' 일 때만 그룹 헤더
    const groups = {};
    for (const m of filtered) {
      if (!groups[m.org]) groups[m.org] = [];
      groups[m.org].push(m);
    }
    return Object.entries(groups);  // [[org, [models]], ...]
  }, [filtered, sortBy]);

  const toggleCap = (cap) => setActiveCaps(s => ({ ...s, [cap]: !s[cap] }));
  const toggleOrgCollapse = (org) => setCollapsedOrgs(s => ({ ...s, [org]: !s[org] }));

  // 카드 렌더 헬퍼
  const renderCard = (m) => {
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
        onToggleFav={() => handleToggleFav(m.id)}
        isFav={favorites.has(m.id)}
        disabled={cardDisabled}
      />
    );
  };

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

      {/* ─── Phase 1A: 추천 큐레이션 칩 ─── */}
      <div>
        <p className="text-[10px] text-text-secondary mb-1">💡 추천 — 클릭으로 자동 필터</p>
        <div className="flex flex-wrap gap-1.5">
          {CURATED_PRESETS.map(p => {
            const on = activeCurated === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setActiveCurated(on ? null : p.key)}
                disabled={disabled}
                title={p.desc}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  on
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg border-border text-text-secondary hover:text-text hover:border-primary/40'
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {activeCurated && (
            <button
              type="button"
              onClick={() => setActiveCurated(null)}
              className="text-[11px] px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              ✕ 큐레이션 해제
            </button>
          )}
        </div>
      </div>

      {/* ─── Phase 3G/H: 즐겨찾기 + 최근 사용 (데이터 있을 때만) ─── */}
      {(favModels.length > 0 || recentModels.length > 0) && (
        <div className="space-y-2">
          {favModels.length > 0 && (
            <div>
              <p className="text-[10px] text-text-secondary mb-1">⭐ 즐겨찾기 ({favModels.length})</p>
              <div className="flex flex-wrap gap-1">
                {favModels.slice(0, 8).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleCardClick(m.id)}
                    disabled={disabled}
                    title={m.id}
                    className={`text-[10px] px-2 py-0.5 rounded border ${
                      isSelected(m.id) ? 'bg-primary text-white border-primary' : 'bg-bg border-border text-text hover:border-primary/40'
                    }`}
                  >
                    ⭐ {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recentModels.length > 0 && (
            <div>
              <p className="text-[10px] text-text-secondary mb-1">⏱ 최근 사용 ({recentModels.length})</p>
              <div className="flex flex-wrap gap-1">
                {recentModels.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleCardClick(m.id)}
                    disabled={disabled}
                    title={m.id}
                    className={`text-[10px] px-2 py-0.5 rounded border ${
                      isSelected(m.id) ? 'bg-primary text-white border-primary' : 'bg-bg border-border text-text hover:border-primary/40'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Phase 1B: 시리즈 빠른 필터 ─── */}
      <div>
        <p className="text-[10px] text-text-secondary mb-1">🏷 시리즈</p>
        <div className="flex flex-wrap gap-1">
          {SERIES_FILTERS.map(s => {
            const on = activeSeries === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSeries(s.key)}
                disabled={disabled}
                className={`text-[10.5px] px-2 py-0.5 rounded ${
                  on ? 'bg-primary text-white' : 'bg-bg border border-border text-text-secondary hover:text-text'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 검색바 + 필터 토글 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 이름 / 조직 검색"
          disabled={disabled}
          className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50 placeholder:text-text-secondary placeholder:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShowFilters(s => !s)}
          className="px-2.5 py-1 rounded-lg border border-border bg-bg text-[10.5px] text-text-secondary hover:text-text"
        >
          {showFilters ? '필터 ▲' : '필터 ▼'}
        </button>
      </div>

      {/* capability 필터 + 정렬 (펼침) */}
      {showFilters && (
        <div className="space-y-2 rounded-lg bg-bg/40 p-2 border border-border">
          <div>
            <p className="text-[10px] text-text-secondary mb-1">기능</p>
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
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-text-secondary">정렬:</span>
            {[
              ['org', '조직별 그룹'],
              ['name', '이름'],
              ['price', '저렴 ↑'],
              ['context', '컨텍스트 ↓'],
              ['providers', 'Provider 多'],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setSortBy(v)}
                disabled={disabled}
                className={`px-1.5 py-0.5 rounded ${
                  sortBy === v ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Phase 1C/2E: 카드 grid (조직별 그룹 + 2-cols) ─── */}
      <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-2">
        {/* 조직별 그룹 (sortBy='org' 일 때만) */}
        {groupedByOrg ? (
          groupedByOrg.length === 0 ? (
            <p className="text-center text-xs text-text-secondary py-4">조건에 맞는 모델 없음</p>
          ) : (
            groupedByOrg.map(([org, models]) => {
              const family = FAMILY_INFO[org] || DEFAULT_FAMILY_INFO;
              const collapsed = collapsedOrgs[org];
              return (
                <div key={org} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleOrgCollapse(org)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded bg-bg/60 hover:bg-bg text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-text">
                        {collapsed ? '▶' : '▼'} {family.flag} {family.tag} — {org}
                        <span className="ml-1.5 text-[10px] text-text-secondary font-normal">({models.length})</span>
                      </p>
                      {!collapsed && family.note && (
                        <p className="text-[10px] text-text-secondary mt-0.5 italic">💡 {family.note}</p>
                      )}
                    </div>
                  </button>
                  {!collapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {models.map(renderCard)}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          // 그룹 없이 평면 grid (sortBy != 'org')
          filtered.length === 0 ? (
            <p className="text-center text-xs text-text-secondary py-4">조건에 맞는 모델 없음</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {filtered.map(renderCard)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ModelCard — 카드 1개. 제 2D: 가격 메인 표시 + ⭐ 즐겨찾기 토글
// ─────────────────────────────────────────────────────────────────────────
function ModelCard({ model, selected, expanded, onSelect, onToggleExpand, onToggleFav, isFav, disabled, mode = 'single' }) {
  const m = model;
  const caps = Object.keys(m.capabilities).filter(k => m.capabilities[k]);
  const family = getFamilyInfo(m);

  return (
    <div className={`rounded-lg border-2 transition-all ${
      selected ? 'border-primary bg-primary-light' : 'border-border bg-card-bg/50'
    }`}>
      {/* 요약 */}
      <div
        onClick={disabled ? undefined : onSelect}
        className={`p-2 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg/30'}`}
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {mode === 'multi' && (
              <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-bold ${
                selected
                  ? 'bg-primary border-primary text-white'
                  : 'border-text-secondary/40 text-transparent'
              }`}>✓</span>
            )}
            <div className="text-sm font-bold text-text break-all leading-tight">{m.name}</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[9.5px] text-text-secondary">{family.flag} {family.tag}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFav?.(); }}
              className={`text-[12px] leading-none px-1 ${isFav ? 'text-amber-400' : 'text-text-secondary opacity-40 hover:opacity-80'}`}
              title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              {isFav ? '⭐' : '☆'}
            </button>
          </div>
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

        {/* meta line — 가격 메인 (Phase 2D) */}
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-text-secondary">
          <span>📐 ctx <b className="text-text">{fmtCtx(m.maxContextLength)}</b></span>
          <span>🌐 <b className="text-text">{m.liveProviderCount}</b> live</span>
          {m.pricing.minIn != null && (
            <span className="text-emerald-700 dark:text-emerald-400">
              💰 최저 <b>{fmtPrice(m.pricing.minIn)}</b>
            </span>
          )}
          {m.pricing.avgIn != null && m.pricing.avgIn !== m.pricing.minIn && (
            <span className="opacity-70">평균 {fmtPrice(m.pricing.avgIn)}</span>
          )}
        </div>
      </div>

      {/* Provider 비교 (펼침) */}
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
