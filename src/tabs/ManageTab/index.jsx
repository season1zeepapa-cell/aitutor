// 문제관리 탭 — 테이블 + CRUD 모달
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';

export default function ManageTab() {
  const [meta, setMeta] = useState({ categories: [], exams: [], subjects: [] });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [examId, setExamId] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [editModal, setEditModal] = useState(null); // null or question object

  // 메타 로드
  useEffect(() => {
    apiPost('/api/questions', { action: 'meta' })
      .then(data => setMeta(data))
      .catch(() => {});
  }, []);

  // 문제 목록 로드
  const loadQuestions = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      let url = `/api/questions?page=${p}&limit=30`;
      if (categoryId) url += `&category_id=${categoryId}`;
      if (examId) url += `&exam_id=${examId}`;
      const data = await apiGet(url);
      setQuestions(data.questions || []);
      setHasMore((data.questions || []).length === 30);
      setPage(p);
    } catch (err) {
      console.error('[Manage] 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryId, examId]);

  useEffect(() => { loadQuestions(1); }, [loadQuestions]);

  // 문제 삭제
  const deleteQuestion = async (id) => {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/questions', { action: 'delete', id });
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const filteredExams = categoryId
    ? (meta.exams || []).filter(e => e.category_id == categoryId)
    : (meta.exams || []);

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">문제 관리</h2>
        <span className="text-xs text-text-secondary font-medium">{questions.length}문항</span>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setExamId(''); }}
          className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all">
          <option value="">전체 카테고리</option>
          {(meta.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={examId} onChange={e => setExamId(e.target.value)}
          className="flex-1 min-w-[130px] px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all">
          <option value="">전체 시험</option>
          {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {/* 문제 목록 */}
      {loading ? (
        <div className="space-y-2"><Skeleton className="h-14 w-full" count={8} /></div>
      ) : questions.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-text-secondary text-sm">표시할 문제가 없습니다.</p>
        </Card>
      ) : (
        <div className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-card">
          {questions.map((q, i) => (
            <div key={q.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-card-bg-hover transition-colors
                ${i < questions.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="w-8 h-8 rounded-lg bg-primary-light text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {q.question_number || i + 1}
              </span>
              <span className="flex-1 text-sm text-text truncate min-w-0">{(q.body || '').substring(0, 50)}</span>
              <span className="text-xs text-text-secondary flex-shrink-0">
                정답 {['①','②','③','④','⑤'][q.answer - 1] || '?'}
              </span>
              <button onClick={() => deleteQuestion(q.id)}
                className="p-1.5 text-text-secondary hover:text-danger rounded-lg hover:bg-red-50 transition-all flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 더보기 */}
      {hasMore && (
        <button onClick={() => loadQuestions(page + 1)} disabled={loading}
          className="w-full py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-card-bg-hover transition-all">
          더 불러오기
        </button>
      )}
    </div>
  );
}
