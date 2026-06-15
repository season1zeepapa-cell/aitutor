// 자료 라이브러리 플로팅 메뉴 (REBUILD45)
// - 우측 하단 플로팅 버튼(상단이동 버튼 위, 겹치지 않음)
// - 아코디언: 자료원(진단가이드/교재) → 분류/단원 → 항목
// - 검색: 제목·키워드·분류·요약 전체 필터
// - 새 자료원은 src/data/kisa-library.json 의 sources 에 추가만 하면 자동 노출
import { useState, useMemo } from 'react';
import libData from '../data/kisa-library.json';

const SOURCE_BADGE = {
  library: { label: '진단가이드', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  course: { label: '교재', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
};

// 한 항목 행 (클릭 시 상세 펼침)
function ItemRow({ item, expanded, onToggle }) {
  const badge = SOURCE_BADGE[item.source] || { label: item.source, cls: 'bg-gray-500/15 text-gray-500' };
  return (
    <div className="border-b border-border/60">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 py-2 px-1 text-left hover:bg-primary/5 rounded"
      >
        <span className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        <span className="flex-1 text-sm leading-snug">{item.title}</span>
        <span className="shrink-0 text-[10px] text-primary/50 font-mono">{item.id}</span>
      </button>
      {expanded && (
        <div className="px-2 pb-3 pt-1 text-xs space-y-2 text-current/80">
          {item.category && (
            <div><span className="text-primary/60">분류</span> · {item.category}{item.cwe ? ` · ${item.cwe}` : ''}</div>
          )}
          {item.summary && <p className="leading-relaxed whitespace-pre-line">{item.summary}</p>}
          {(item.detail || []).map((d, i) => (
            <div key={i}>
              <span className="font-semibold text-primary/80">{d.label}</span>
              <p className="leading-relaxed whitespace-pre-line mt-0.5">{d.text}</p>
            </div>
          ))}
          {(item.keywords || []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {item.keywords.map((k) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70">#{k}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LibraryFab() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [openGroups, setOpenGroups] = useState({});

  const allItems = useMemo(() => libData.sources.flatMap((s) => s.items), []);

  // 자료원 → 그룹 → 항목 (아코디언용)
  const grouped = useMemo(
    () =>
      libData.sources.map((s) => {
        const groups = {};
        s.items.forEach((it) => {
          (groups[it.group] = groups[it.group] || []).push(it);
        });
        return { ...s, groupEntries: Object.entries(groups) };
      }),
    []
  );

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return allItems.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.summary || '').toLowerCase().includes(q) ||
        (it.keywords || []).some((k) => k.toLowerCase().includes(q))
    );
  }, [q, allItems]);

  const toggleGroup = (key) => setOpenGroups((p) => ({ ...p, [key]: !p[key] }));
  const toggleItem = (id) => setExpandedId((p) => (p === id ? null : id));

  return (
    <>
      {/* 플로팅 버튼 — 상단이동(bottom-20) 위, 겹치지 않게 bottom-32 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-32 z-50 w-10 h-10 rounded-full bg-card-bg border border-border text-primary shadow-lg
          flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
        aria-label="자료 라이브러리 열기"
        title="자료 라이브러리"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </button>

      {/* 우측 드로어 패널 */}
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-card-bg h-full flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <h2 className="font-bold text-sm flex-1">📚 자료 라이브러리 <span className="text-primary/50 font-normal">({allItems.length})</span></h2>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/10"
                aria-label="닫기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 검색 */}
            <div className="px-4 py-2 border-b border-border">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제목·키워드·분류 검색..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-3 py-2 safe-pb">
              {results ? (
                results.length ? (
                  <>
                    <p className="text-xs text-primary/50 px-1 pb-1">검색 결과 {results.length}건</p>
                    {results.map((it) => (
                      <ItemRow key={it.source + it.id} item={it} expanded={expandedId === it.source + it.id} onToggle={() => toggleItem(it.source + it.id)} />
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-primary/50 text-center py-10">검색 결과가 없습니다.</p>
                )
              ) : (
                grouped.map((s) => (
                  <div key={s.id} className="mb-3">
                    <div className="flex items-center gap-2 px-1 py-1.5 sticky top-0 bg-card-bg">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${SOURCE_BADGE[s.id]?.cls || ''}`}>{s.label}</span>
                      <span className="text-[11px] text-primary/40">{s.count}개</span>
                    </div>
                    {s.groupEntries.map(([g, items]) => {
                      const key = s.id + '/' + g;
                      const gopen = openGroups[key];
                      return (
                        <div key={key} className="ml-1">
                          <button
                            onClick={() => toggleGroup(key)}
                            className="w-full flex items-center gap-2 py-1.5 px-1 text-left text-xs font-medium hover:bg-primary/5 rounded"
                          >
                            <span className="text-primary/50">{gopen ? '▾' : '▸'}</span>
                            <span className="flex-1">{g}</span>
                            <span className="text-primary/40">{items.length}</span>
                          </button>
                          {gopen && (
                            <div className="ml-3">
                              {items.map((it) => (
                                <ItemRow key={it.source + it.id} item={it} expanded={expandedId === it.source + it.id} onToggle={() => toggleItem(it.source + it.id)} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
