// 문제풀이 탭 — Quizlet 스타일 플래시카드 학습
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import QuizCard from './QuizCard';
import MultiSelect from '../../components/ui/MultiSelect';
import useFilterState from '../../hooks/useFilterState';

export default function QuizTab() {
  const [meta, setMeta] = useState({ categories: [], exams: [], subjects: [] });
  const { categoryIds, setCategoryIds, examIds, setExamIds } = useFilterState('quiz');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandAll, setExpandAll] = useState(false);

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
      if (categoryIds.length > 0) url += `&category_id=${categoryIds.join(',')}`;
      if (examIds.length > 0) url += `&exam_id=${examIds.join(',')}`;
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
  }, [categoryIds, examIds]);

  useEffect(() => {
    loadQuestions(1);
  }, [loadQuestions]);

  // 카테고리별 시험 필터 (다중 선택 지원)
  const filteredExams = categoryIds.length > 0
    ? (meta.exams || []).filter(e => categoryIds.includes(String(e.category_id)))
    : (meta.exams || []);

  // 카드 펼치기/접기
  const toggleCard = (id) => {
    if (expandAll) {
      // 전체 펼침 모드에서 개별 클릭 → 전체 모드 해제 + 해당 카드만 접기
      setExpandAll(false);
      setExpandedId(null);
    } else {
      setExpandedId(prev => prev === id ? null : id);
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* 필터 영역 (다중 선택) */}
      <div className="flex gap-2 flex-wrap">
        <MultiSelect
          options={meta.categories || []}
          selected={categoryIds}
          onChange={setCategoryIds}
          placeholder="전체 카테고리"
        />
        <MultiSelect
          options={filteredExams}
          selected={examIds}
          onChange={setExamIds}
          placeholder="전체 시험"
        />
      </div>

      {/* 문제 수 + 전체 펼치기 */}
      {questions.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-text-secondary">
            {questions.length}문항 {hasMore && '(더 있음)'}
          </span>
          <button
            onClick={() => { setExpandAll(prev => !prev); setExpandedId(null); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${expandAll
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-badge-bg text-text-secondary border border-transparent hover:text-text'}`}
          >
            {expandAll ? '전체 접기' : '전체 펼치기'}
            <svg className={`w-3.5 h-3.5 transition-transform ${expandAll ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
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
            const catName = categoryIds.length === 1 ? (meta.categories || []).find(c => String(c.id) === categoryIds[0])?.name || '' : '';
            return (
              <QuizCard
                key={q.id}
                question={q}
                index={idx + 1}
                isExpanded={expandAll || expandedId === q.id}
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
