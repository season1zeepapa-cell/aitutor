// 북마크 학습 — 즐겨찾기한 문제만 풀기 + 태그 필터
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import ErrorCard from '../components/ui/ErrorCard';
import QuizCard from '../tabs/QuizTab/QuizCard';

// 태그별 색상/라벨
const TAG_CONFIG = {
  default: { label: '기본', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  wrong: { label: '틀린 문제', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  hard: { label: '어려운 문제', color: 'text-red-500', bg: 'bg-red-500/10' },
  review: { label: '다시 봐야 할 문제', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  important: { label: '중요 문제', color: 'text-purple-500', bg: 'bg-purple-500/10' },
};

export default function BookmarkStudy() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // 태그 목록 + 북마크 문제 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagData, qData] = await Promise.all([
        apiGet('/api/bookmarks?action=tags'),
        apiGet(`/api/bookmarks?action=questions${selectedTag ? `&tag=${selectedTag}` : ''}`),
      ]);
      setTags(tagData.tags || []);
      setQuestions(qData.questions || []);
    } catch {
      setError('북마크 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedTag]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleCard = (id) => setExpandedId(prev => prev === id ? null : id);
  const totalCount = tags.reduce((sum, t) => sum + Number(t.count), 0);

  return (
    <div className="space-y-5 fade-in">
      {/* 뒤로가기 */}
      <button onClick={() => navigate('/quiz')}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        학습 허브
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">북마크 학습</h2>
        <span className="text-sm text-text-secondary font-semibold">{totalCount}문제</span>
      </div>

      {/* 태그 필터 */}
      {tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedTag('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              !selectedTag ? 'bg-primary text-white' : 'bg-badge-bg text-text-secondary hover:text-text'
            }`}>
            전체 ({totalCount})
          </button>
          {tags.map(t => {
            const cfg = TAG_CONFIG[t.tag] || TAG_CONFIG.default;
            return (
              <button key={t.tag} onClick={() => setSelectedTag(t.tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  selectedTag === t.tag ? 'bg-primary text-white' : `${cfg.bg} ${cfg.color} hover:opacity-80`
                }`}>
                {cfg.label} ({t.count})
              </button>
            );
          })}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" count={3} />
        </div>
      )}

      {/* 에러 */}
      {error && <ErrorCard message={error} onRetry={loadData} />}

      {/* 빈 상태 */}
      {!loading && !error && questions.length === 0 && (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-yellow-400/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-sm text-text-secondary mb-1">북마크한 문제가 없습니다</p>
          <p className="text-xs text-text-secondary/60">문제 카드의 별표를 눌러 북마크하세요</p>
        </Card>
      )}

      {/* 문제 카드 목록 */}
      {!loading && questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <QuizCard
              key={q.id}
              question={q}
              index={idx + 1}
              isExpanded={expandedId === q.id}
              onToggle={() => toggleCard(q.id)}
              categoryName={q.category_name || ''}
              initialBookmarked={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
