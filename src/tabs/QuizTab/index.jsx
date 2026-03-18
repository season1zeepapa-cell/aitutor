// 문제풀이 탭 — Quizlet 스타일 플래시카드 학습
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import QuizCard from './QuizCard';

export default function QuizTab() {
  const [meta, setMeta] = useState({ categories: [], exams: [], subjects: [] });
  const [categoryId, setCategoryId] = useState('');
  const [examId, setExamId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // 메타 데이터 로드 (카테고리, 시험 목록)
  useEffect(() => {
    apiPost('/api/questions', { action: 'meta' })
      .then(data => setMeta(data))
      .catch(err => console.error('[Quiz] 메타 로드 실패:', err));
  }, []);

  // 문제 목록 로드
  const loadQuestions = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      let url = `/api/questions?page=${pageNum}&limit=20`;
      if (categoryId) url += `&category_id=${categoryId}`;
      if (examId) url += `&exam_id=${examId}`;
      const data = await apiGet(url);
      const items = data.questions || [];
      setQuestions(prev => append ? [...prev, ...items] : items);
      setHasMore(items.length === 20);
      setPage(pageNum);
    } catch (err) {
      console.error('[Quiz] 문제 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryId, examId]);

  useEffect(() => {
    loadQuestions(1);
  }, [loadQuestions]);

  // 카테고리별 시험 필터
  const filteredExams = categoryId
    ? (meta.exams || []).filter(e => e.category_id == categoryId)
    : (meta.exams || []);

  // 카드 펼치기/접기
  const toggleCard = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4 fade-in">
      {/* 필터 영역 */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setExamId(''); }}
          className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm
            focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        >
          <option value="">전체 카테고리</option>
          {(meta.categories || []).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={examId}
          onChange={e => setExamId(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm
            focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        >
          <option value="">전체 시험</option>
          {filteredExams.map(e => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      {/* 문제 수 + 진행률 */}
      {questions.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-text-secondary">
            {questions.length}문항 {hasMore && '(더 있음)'}
          </span>
        </div>
      )}

      {/* 문제 카드 목록 */}
      {loading && questions.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" count={5} />
        </div>
      ) : questions.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-lg font-semibold text-text mb-2">문제가 없습니다</p>
          <p className="text-sm text-text-secondary">필터 조건을 변경하거나 문제를 추가하세요.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const catName = (meta.categories || []).find(c => c.id == categoryId)?.name || '';
            return (
              <QuizCard
                key={q.id}
                question={q}
                index={idx + 1}
                isExpanded={expandedId === q.id}
                onToggle={() => toggleCard(q.id)}
                categoryName={catName}
              />
            );
          })}

          {/* 더보기 버튼 */}
          {hasMore && (
            <button
              onClick={() => loadQuestions(page + 1, true)}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold
                hover:bg-card-bg-hover transition-all disabled:opacity-50"
            >
              {loading ? '로딩 중...' : '더 불러오기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
