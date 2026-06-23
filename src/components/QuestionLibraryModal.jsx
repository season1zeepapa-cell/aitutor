// 문제 풀이 중 "관련 지식 라이브러리" 검색·조회 모달
// - 현재 문제의 chapter_code로 정확매칭 항목을 찾고, 그 키워드·분류로 관련 항목들을 "검색"해 목록 제공
// - 상단 검색창으로 전체 라이브러리(진단가이드+교재) 추가 검색 가능
// - 코드 렌더는 LibraryFab의 CodeSection을 재사용 (중복 구현 금지)
// - 바텀시트 스타일(기존 LibraryFab 드로어와 동일 톤)
import { useState, useMemo } from 'react';
import libData from '../data/kisa-library.json';
import { CodeSection } from './LibraryFab';

const SOURCE_BADGE = {
  library: { label: '진단가이드', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  course: { label: '교재', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  kisec2026: { label: '2026교재', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
};

const norm = (s) => (s || '').toLowerCase();

// 항목 상세 본문 (요약 → 상세 → 취약/안전 코드 → 키워드)
function ItemDetail({ item }) {
  return (
    <div className="space-y-2 pt-1">
      {item.summary && <p className="leading-relaxed whitespace-pre-line">{item.summary}</p>}
      {(item.detail || []).map((d, i) => (
        <div key={i}>
          <span className="font-semibold text-primary/80">{d.label}</span>
          <p className="leading-relaxed whitespace-pre-line mt-0.5">{d.text}</p>
        </div>
      ))}
      <CodeSection item={item} />
      {(item.keywords || []).length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {item.keywords.map((k) => (
            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70">
              #{k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 접이식 항목 행 (헤더 클릭 시 상세 펼침). defaultOpen=true 면 펼친 채 시작.
function CollapsibleItem({ item, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const badge = SOURCE_BADGE[item.source] || { label: item.source, cls: 'bg-gray-500/15 text-gray-500' };
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 py-2 px-2 text-left hover:bg-primary/5"
      >
        <span className="text-primary/50 text-xs mt-0.5">{open ? '▾' : '▸'}</span>
        <span className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        <span className="flex-1 text-[13px] leading-snug font-medium">{item.title}</span>
        <span className="shrink-0 text-[10px] text-primary/40 font-mono">{item.id}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {item.category && (
            <div className="text-[11px] text-primary/60 pt-1">
              분류 · {item.category}{item.cwe ? ` · ${item.cwe}` : ''}
            </div>
          )}
          <ItemDetail item={item} />
        </div>
      )}
    </div>
  );
}

export default function QuestionLibraryModal({ chapterCode, onClose }) {
  const [query, setQuery] = useState('');
  const allItems = useMemo(() => libData.sources.flatMap((s) => s.items), []);

  // 1) 현재 문제와 정확히 일치하는 진단가이드 항목
  const exact = useMemo(
    () => allItems.find((it) => it.source === 'library' && it.id === chapterCode) || null,
    [allItems, chapterCode]
  );

  // 2) 관련 항목 검색 — exact 의 키워드 교집합(×2) + 같은 분류(+1) 점수순 상위 8개
  const related = useMemo(() => {
    if (!exact) return [];
    const exKw = new Set((exact.keywords || []).map(norm));
    return allItems
      .filter((it) => it.id !== exact.id)
      .map((it) => {
        const overlap = (it.keywords || []).map(norm).filter((k) => exKw.has(k)).length;
        const sameCat = it.category && it.category === exact.category ? 1 : 0;
        return { it, score: overlap * 2 + sameCat };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.it);
  }, [allItems, exact]);

  // 3) 검색창 입력 시: 전체 라이브러리에서 제목·분류·키워드·요약 매칭
  const searchResults = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return null;
    return allItems
      .filter(
        (it) =>
          norm(it.title).includes(q) ||
          norm(it.category).includes(q) ||
          norm(it.id).includes(q) ||
          (it.keywords || []).some((k) => norm(k).includes(q)) ||
          norm(it.summary).includes(q)
      )
      .slice(0, 30);
  }, [allItems, query]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-h-[85vh] bg-card-bg rounded-t-2xl flex flex-col shadow-2xl">
        {/* 드래그 핸들 (바텀시트) */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
          <h2 className="font-bold text-sm flex-1">
            📚 관련 지식
            {exact && <span className="ml-1 text-primary/50 font-mono font-normal">{exact.id}</span>}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/10"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색창 */}
        <div className="px-4 py-2 border-b border-border shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지식 검색 (제목·키워드·분류)…"
            className="w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-bg focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* 현재 문제 키워드 — 탭하면 그 키워드로 자료 검색·조회 */}
        {exact && (exact.keywords || []).length > 0 && (
          <div className="px-4 py-2 border-b border-border shrink-0">
            <div className="text-[10px] text-primary/60 mb-1">이 문제 키워드 — 탭하여 자료 조회</div>
            <div className="flex flex-wrap gap-1">
              {exact.keywords.map((k) => {
                const active = norm(query) === norm(k);
                return (
                  <button
                    key={k}
                    onClick={() => setQuery(active ? '' : k)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-primary/10 text-primary/80 border-primary/20 hover:bg-primary/20'
                    }`}
                  >
                    #{k}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 safe-pb text-xs space-y-3 text-current/80">
          {searchResults ? (
            /* === 검색 모드 === */
            <>
              <div className="text-[11px] text-primary/60">
                검색 결과 {searchResults.length}건{searchResults.length === 30 ? ' (상위 30)' : ''}
              </div>
              {searchResults.length === 0 ? (
                <p className="text-sm text-primary/50 text-center py-10">검색 결과가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((it) => (
                    <CollapsibleItem key={it.source + it.id} item={it} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* === 기본(현재 문제 관련) 모드 === */
            <>
              {/* 현재 문제 핵심 자료 (정확매칭, 펼친 상태) */}
              {exact ? (
                <div>
                  <div className="text-[11px] font-semibold text-primary/70 mb-1">이 문제의 핵심 자료</div>
                  <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
                    <h3 className="text-sm font-bold text-primary leading-snug">{exact.title}</h3>
                    {exact.category && (
                      <div className="mt-0.5 text-[11px] text-primary/60">
                        분류 · {exact.category}{exact.cwe ? ` · ${exact.cwe}` : ''}
                      </div>
                    )}
                    <ItemDetail item={exact} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-primary/50 text-center py-6">
                  이 문제와 정확히 일치하는 자료가 없습니다. 위 검색창으로 찾아보세요.
                </p>
              )}

              {/* 관련 지식 (검색된 연관 항목 목록) */}
              {related.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-primary/70 mb-1">
                    관련 지식 {related.length}건
                  </div>
                  <div className="space-y-2">
                    {related.map((it) => (
                      <CollapsibleItem key={it.source + it.id} item={it} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
