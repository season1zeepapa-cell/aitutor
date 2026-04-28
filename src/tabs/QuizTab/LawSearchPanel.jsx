// 법령 검색 패널 — 국가법령정보 API 연동
import { useState } from 'react';
import { apiPost } from '../../lib/api';

export default function LawSearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [useAiLaw, setUseAiLaw] = useState(false);

  // 법령 검색
  const searchLaw = async () => {
    if (!query.trim()) return;

    // AI 법령정보 체크 시 → 클립보드 복사 + AI 법령정보 페이지 오픈
    if (useAiLaw) {
      navigator.clipboard.writeText(query.trim()).catch(() => {});
      window.open('https://www.law.go.kr/LSW/ais/main.do', '_blank');
      return;
    }

    setLoading(true);
    setDetail(null);
    try {
      // 백엔드 응답: { totalCount, results: [{ id, name, ministry, ... }] }
      const data = await apiPost('/api/law', { action: 'search', query: query.trim() });
      setResults(data.results || []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 법령 상세 조회
  // 인자명은 그대로 두지만 의미는 '법령일련번호(id)' — 백엔드는 lawId 키 기대
  const loadDetail = async (lawId, name) => {
    setLoading(true);
    try {
      // 백엔드 응답: { info: {...}, articles: [...] }
      const data = await apiPost('/api/law', { action: 'detail', lawId });
      setDetail({ name, info: data.info, articles: data.articles });
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
          autoCapitalize="none" autoCorrect="off" autoComplete="off"
          className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm
            placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
        <button onClick={searchLaw} disabled={loading || !query.trim()}
          className="px-4 py-2.5 rounded-xl bg-warning text-white text-sm font-bold hover:bg-warning/90 transition-colors disabled:opacity-40 flex-shrink-0">
          {loading ? '...' : '검색'}
        </button>
        <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={useAiLaw} onChange={e => setUseAiLaw(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer" />
          <span className="text-xs text-text-secondary font-medium whitespace-nowrap">AI 법령정보</span>
        </label>
      </div>

      {/* 검색 결과 */}
      {results.length > 0 && !detail && (
        <div className="bg-badge-bg rounded-xl overflow-hidden border border-border">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-bold text-text-secondary">검색 결과 ({results.length}건)</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {results.map((law, i) => (
              <button key={law.id || i} onClick={() => loadDetail(law.id, law.name)}
                className="w-full text-left px-3 py-2 text-sm text-text hover:bg-card-bg-hover transition-colors border-b border-border last:border-b-0">
                <span className="font-medium">{law.name}</span>
                {law.ministry && (
                  <span className="text-[10px] text-text-secondary ml-2">({law.ministry})</span>
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
                {/* articles 각 항목: { number, title, content, hang } — 백엔드 정규화 결과 */}
                {detail.articles.map((art, i) => (
                  <div key={i} className="text-xs text-text">
                    {(art.number || art.title) && (
                      <span className="font-bold text-primary">
                        {art.number ? `제${art.number}조` : ''}
                        {art.title ? ` ${art.title}` : ''}
                      </span>
                    )}
                    <p className="text-text-secondary mt-0.5 whitespace-pre-wrap">{art.content}</p>
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
