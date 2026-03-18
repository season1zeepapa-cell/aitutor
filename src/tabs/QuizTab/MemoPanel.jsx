// 메모 패널 — 문제별 메모 CRUD + 첨부파일
import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiFetch } from '../../lib/api';

export default function MemoPanel({ questionId }) {
  const [memos, setMemos] = useState([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // 메모 로드
  useEffect(() => {
    if (!questionId) return;
    apiGet(`/api/memos?question_id=${questionId}`)
      .then(data => setMemos(data.memos || []))
      .catch(err => console.error('[Memo] 로드 실패:', err));
  }, [questionId]);

  // 메모 추가
  const addMemo = async () => {
    if (!newText.trim()) return;
    setLoading(true);
    try {
      const data = await apiPost('/api/memos', {
        question_id: questionId,
        content: newText.trim(),
      });
      setMemos(prev => [data.memo || { id: Date.now(), content: newText, created_at: new Date().toISOString() }, ...prev]);
      setNewText('');
    } catch (err) {
      console.error('[Memo] 추가 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 메모 수정
  const updateMemo = async (memoId) => {
    if (!editText.trim()) return;
    try {
      await apiPost('/api/memos', {
        action: 'update',
        id: memoId,
        content: editText.trim(),
      });
      setMemos(prev => prev.map(m => m.id === memoId ? { ...m, content: editText.trim() } : m));
      setEditingId(null);
    } catch (err) {
      console.error('[Memo] 수정 실패:', err);
    }
  };

  // 메모 삭제
  const deleteMemo = async (memoId) => {
    if (!confirm('메모를 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/memos', { action: 'delete', id: memoId });
      setMemos(prev => prev.filter(m => m.id !== memoId));
    } catch (err) {
      console.error('[Memo] 삭제 실패:', err);
    }
  };

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="space-y-3">
      {/* 메모 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMemo()}
          placeholder="메모를 입력하세요..."
          className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm
            placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={addMemo}
          disabled={loading || !newText.trim()}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
            hover:bg-primary-hover transition-colors disabled:opacity-40"
        >
          {loading ? '...' : '추가'}
        </button>
      </div>

      {/* 메모 목록 */}
      {memos.length === 0 ? (
        <p className="text-xs text-text-secondary text-center py-4">메모가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {memos.map(memo => (
            <div key={memo.id} className="bg-badge-bg rounded-xl px-3 py-2.5 group">
              {editingId === memo.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && updateMemo(memo.id)}
                    className="flex-1 px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary"
                    autoFocus
                  />
                  <button onClick={() => updateMemo(memo.id)} className="text-xs text-primary font-semibold">저장</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-text-secondary">취소</button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text">{memo.content}</p>
                    <p className="text-[10px] text-text-secondary mt-1">{formatDate(memo.created_at)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => { setEditingId(memo.id); setEditText(memo.content); }}
                      className="p-1 text-text-secondary hover:text-primary rounded transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteMemo(memo.id)}
                      className="p-1 text-text-secondary hover:text-danger rounded transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
