// 법령 검색 패널 — 국가법령정보 API 연동
import { useState } from 'react';
import { apiPost } from '../../lib/api';

export default function LawSearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  // 법령 검색
  const searchLaw = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setDetail(null);
    try {
      const data = await apiPost('/api/law', { action: 'search', query: query.trim() });
      setResults(data.laws || []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 법령 상세 조회
  const loadDetail = async (mst, name) => {
    setLoading(true);
    try {
      const data = await apiPost('/api/law', { action: 'detail', mst });
      setDetail({ name, ...(data.law || data) });
    } catch (err) {
      setDetail({ name, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 검색 입력 */}
      <div className="flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchLaw()}
          placeholder="법령명을 검색하세요..."
          className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm
            placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
        <button onClick={searchLaw} disabled={loading || !query.trim()}
          className="px-4 py-2.5 rounded-xl bg-warning text-white text-sm font-bold hover:bg-warning/90 transition-colors disabled:opacity-40 flex-shrink-0">
          {loading ? '...' : '검색'}
        </button>
      </div>

      {/* 검색 결과 */}
      {results.length > 0 && !detail && (
        <div className="bg-badge-bg rounded-xl overflow-hidden border border-border">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-bold text-text-secondary">검색 결과 ({results.length}건)</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {results.map((law, i) => (
              <button key={i} onClick={() => loadDetail(law.mst || law.MST, law.name || law.법령명한글)}
                className="w-full text-left px-3 py-2 text-sm text-text hover:bg-card-bg-hover transition-colors border-b border-border last:border-b-0">
                <span className="font-medium">{law.name || law.법령명한글}</span>
                {(law.type || law.법령구분) && (
                  <span className="text-[10px] text-text-secondary ml-2">({law.type || law.법령구분})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 법령 상세 */}
      {detail && (
        <div className="bg-badge-bg rounded-xl border border-border fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-bold text-text">📜 {detail.name}</span>
            <div className="flex gap-1.5">
              <a href={`https://www.law.go.kr/법령/${encodeURIComponent(detail.name)}`} target="_blank" rel="noopener"
                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 no-underline transition-colors">
                🔗 법제처
              </a>
              <button onClick={() => setDetail(null)}
                className="text-[10px] text-text-secondary hover:text-text px-1.5 transition-colors">&times;</button>
            </div>
          </div>
          <div className="px-3 py-2 max-h-60 overflow-y-auto">
            {detail.error ? (
              <p className="text-xs text-danger">{detail.error}</p>
            ) : detail.articles ? (
              <div className="space-y-2">
                {detail.articles.map((art, i) => (
                  <div key={i} className="text-xs text-text">
                    <span className="font-bold text-primary">{art.title || art.조문제목}</span>
                    <p className="text-text-secondary mt-0.5 whitespace-pre-wrap">{art.content || art.조문내용}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-secondary whitespace-pre-wrap">
                {typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 빈 결과 */}
      {results.length === 0 && query && !loading && !detail && (
        <p className="text-xs text-text-secondary text-center py-3">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}
