// 문제관리 탭 — 테이블 + CRUD 모달 + 일괄작업
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';
import MultiSelect from '../../components/ui/MultiSelect';
import useFilterState from '../../hooks/useFilterState';
import QuestionForm from './QuestionForm';

export default function ManageTab() {
  const toast = useToast();
  const [meta, setMeta] = useState({ categories: [], exams: [], subjects: [] });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { categoryIds, setCategoryIds, examIds, setExamIds } = useFilterState('manage');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [editModal, setEditModal] = useState(null); // null | 'new' | question object
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkSubjectId, setBulkSubjectId] = useState('');

  useEffect(() => {
    apiPost('/api/questions', { action: 'meta' }).then(setMeta).catch(() => {});
  }, []);

  const loadQuestions = useCallback(async (p = 1, append = false) => {
    setLoading(true);
    try {
      let url = `/api/questions?page=${p}&limit=30`;
      if (categoryIds.length > 0) url += `&category_id=${categoryIds.join(',')}`;
      if (examIds.length > 0) url += `&exam_id=${examIds.join(',')}`;
      const data = await apiGet(url);
      const items = data.questions || [];
      setQuestions(prev => append ? [...prev, ...items] : items);
      setHasMore(items.length === 30);
      setPage(p);
      if (!append) setCheckedIds(new Set());
    } catch (err) { console.error('[Manage]', err); }
    finally { setLoading(false); }
  }, [categoryIds, examIds]);

  useEffect(() => { loadQuestions(1); }, [loadQuestions]);

  // 문제 삭제
  const deleteQuestion = async (id) => {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/questions', { action: 'delete', id });
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast('문제가 삭제되었습니다.', 'success');
    } catch (err) { toast('삭제 실패: ' + err.message, 'error'); }
  };

  // 일괄 삭제
  const bulkDelete = async () => {
    if (checkedIds.size === 0) return;
    if (!confirm(`${checkedIds.size}개 문제를 삭제하시겠습니까?`)) return;
    for (const id of checkedIds) {
      try { await apiPost('/api/questions', { action: 'delete', id }); } catch {}
    }
    toast(`${checkedIds.size}개 문제 삭제 완료`, 'success');
    loadQuestions(1);
  };

  // 일괄 과목 지정
  const bulkAssignSubject = async () => {
    if (checkedIds.size === 0 || !bulkSubjectId) return;
    try {
      await apiPost('/api/questions', {
        action: 'assignSubject',
        ids: [...checkedIds],
        subject_id: Number(bulkSubjectId),
      });
      toast(`${checkedIds.size}개 문제에 과목 지정 완료`, 'success');
      loadQuestions(page);
    } catch (err) { toast('과목 지정 실패: ' + err.message, 'error'); }
  };

  // 전체선택
  const toggleAll = (checked) => {
    setCheckedIds(checked ? new Set(questions.map(q => q.id)) : new Set());
  };
  const toggleOne = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 저장 후 새로고침
  const onSaved = () => {
    setEditModal(null);
    loadQuestions(1);
    toast('문제가 저장되었습니다.', 'success');
  };

  const filteredExams = categoryIds.length > 0
    ? (meta.exams || []).filter(e => categoryIds.includes(String(e.category_id)))
    : (meta.exams || []);
  const filteredSubjects = categoryIds.length > 0
    ? (meta.subjects || []).filter(s => categoryIds.includes(String(s.category_id)))
    : (meta.subjects || []);
  const allChecked = questions.length > 0 && checkedIds.size === questions.length;

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">문제 관리</h2>
        <button onClick={() => setEditModal('new')}
          className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors">
          + 문제 추가
        </button>
      </div>

      {/* 필터 (다중 선택) */}
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

      {/* 일괄 작업 바 */}
      {checkedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-primary-light border border-primary/20 rounded-xl px-3 py-2 fade-in">
          <span className="text-xs font-bold text-primary">{checkedIds.size}개 선택</span>
          <select value={bulkSubjectId} onChange={e => setBulkSubjectId(e.target.value)}
            className="px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-xs">
            <option value="">과목 선택</option>
            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={bulkAssignSubject} disabled={!bulkSubjectId}
            className="px-2 py-1 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-40 hover:bg-primary-hover transition-colors">과목지정</button>
          <button onClick={bulkDelete}
            className="px-2 py-1 rounded-lg bg-danger text-white text-xs font-semibold hover:bg-danger-hover transition-colors">삭제</button>
        </div>
      )}

      {/* 문제 목록 */}
      {loading && questions.length === 0 ? (
        <div className="space-y-2"><Skeleton className="h-14 w-full" count={8} /></div>
      ) : questions.length === 0 ? (
        <Card className="text-center py-12"><p className="text-text-secondary text-sm">표시할 문제가 없습니다.</p></Card>
      ) : (
        <div className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-card">
          {/* 헤더 행 */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-badge-bg">
            <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer" />
            <span className="text-xs font-semibold text-text-secondary flex-1">{questions.length}문항</span>
          </div>
          {questions.map((q, i) => (
            <div key={q.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-card-bg-hover transition-colors
                ${i < questions.length - 1 ? 'border-b border-border' : ''}`}>
              <input type="checkbox" checked={checkedIds.has(q.id)} onChange={() => toggleOne(q.id)}
                className="w-4 h-4 rounded cursor-pointer flex-shrink-0" />
              <span className="w-8 h-8 rounded-lg bg-primary-light text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {q.question_number || i + 1}
              </span>
              <span className="flex-1 text-sm text-text truncate min-w-0 cursor-pointer hover:text-primary transition-colors"
                onClick={() => setEditModal(q)}>
                {String(q.body || '').substring(0, 50)}
              </span>
              <span className="text-xs text-text-secondary flex-shrink-0">
                {['①','②','③','④','⑤'][q.answer - 1] || '?'}
              </span>
              <button onClick={() => setEditModal(q)}
                className="p-1.5 text-text-secondary hover:text-primary rounded-lg hover:bg-primary-light transition-all flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
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

      {hasMore && (
        <button onClick={() => loadQuestions(page + 1, true)} disabled={loading}
          className="w-full py-3 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-card-bg-hover transition-all">
          더 불러오기
        </button>
      )}

      {/* 문제 추가/수정 모달 */}
      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)}
        title={editModal === 'new' ? '문제 추가' : '문제 수정'} size="lg">
        {editModal && (
          <QuestionForm
            question={editModal === 'new' ? null : editModal}
            meta={meta}
            onSaved={onSaved}
            onCancel={() => setEditModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
