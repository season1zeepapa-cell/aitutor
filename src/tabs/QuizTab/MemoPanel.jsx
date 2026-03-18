// 메모 패널 — 문제별 메모 CRUD + 첨부파일
import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiFetch, getAuthToken } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

export default function MemoPanel({ questionId }) {
  const toast = useToast();
  const [memos, setMemos] = useState([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]); // 새 메모에 첨부할 파일
  const fileInputRef = useRef(null);

  // 메모 로드
  useEffect(() => {
    if (!questionId) return;
    apiGet(`/api/memos?question_id=${questionId}`)
      .then(data => setMemos(data.memos || []))
      .catch(err => console.error('[Memo] 로드 실패:', err));
  }, [questionId]);

  // 파일 → base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 메모 추가 (+ 첨부파일)
  const addMemo = async () => {
    if (!newText.trim() && pendingFiles.length === 0) return;
    setLoading(true);
    try {
      const data = await apiPost('/api/memos', {
        question_id: questionId,
        content: newText.trim() || '(첨부파일)',
      });
      const memo = data.memo || { id: Date.now(), content: newText, created_at: new Date().toISOString(), files: [] };

      // 첨부파일 업로드
      if (pendingFiles.length > 0 && memo.id) {
        for (const file of pendingFiles) {
          try {
            const base64 = await fileToBase64(file);
            await apiPost('/api/memo-files', {
              memo_id: memo.id,
              filename: file.name,
              mime_type: file.type,
              size: file.size,
              data: base64,
            });
          } catch (err) {
            console.error('[Memo] 파일 업로드 실패:', err);
          }
        }
        // 파일 목록 재조회
        try {
          const filesData = await apiGet(`/api/memo-files?memo_id=${memo.id}`);
          memo.files = filesData.files || [];
        } catch {}
      }

      setMemos(prev => [memo, ...prev]);
      setNewText('');
      setPendingFiles([]);
      toast('메모가 저장되었습니다.', 'success');
    } catch (err) {
      toast('메모 추가 실패: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 메모 수정
  const updateMemo = async (memoId) => {
    if (!editText.trim()) return;
    try {
      await apiPost('/api/memos', { action: 'update', id: memoId, content: editText.trim() });
      setMemos(prev => prev.map(m => m.id === memoId ? { ...m, content: editText.trim() } : m));
      setEditingId(null);
      toast('메모 수정됨', 'success');
    } catch (err) { toast('수정 실패: ' + err.message, 'error'); }
  };

  // 메모 삭제
  const deleteMemo = async (memoId) => {
    if (!confirm('메모를 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/memos', { action: 'delete', id: memoId });
      setMemos(prev => prev.filter(m => m.id !== memoId));
      toast('메모 삭제됨', 'success');
    } catch (err) { toast('삭제 실패: ' + err.message, 'error'); }
  };

  // 파일 추가 (기존 메모에)
  const uploadFileToMemo = async (memoId, file) => {
    try {
      const base64 = await fileToBase64(file);
      const data = await apiPost('/api/memo-files', {
        memo_id: memoId,
        filename: file.name,
        mime_type: file.type,
        size: file.size,
        data: base64,
      });
      // 메모의 files 배열 업데이트
      setMemos(prev => prev.map(m => {
        if (m.id === memoId) {
          return { ...m, files: [...(m.files || []), data.file || { id: Date.now(), filename: file.name, mime_type: file.type, size: file.size }] };
        }
        return m;
      }));
      toast('파일 첨부됨', 'success');
    } catch (err) { toast('파일 업로드 실패: ' + err.message, 'error'); }
  };

  // 파일 삭제
  const deleteFile = async (memoId, fileId) => {
    try {
      await apiPost('/api/memo-files', { action: 'delete', id: fileId });
      setMemos(prev => prev.map(m => {
        if (m.id === memoId) {
          return { ...m, files: (m.files || []).filter(f => f.id !== fileId) };
        }
        return m;
      }));
      toast('파일 삭제됨', 'success');
    } catch (err) { toast('파일 삭제 실패: ' + err.message, 'error'); }
  };

  // 파일 다운로드
  const downloadFile = async (fileId, filename) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/memo-files?id=${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.file?.data) {
        const a = document.createElement('a');
        a.href = `data:${data.file.mime_type};base64,${data.file.data}`;
        a.download = filename;
        a.click();
      }
    } catch (err) { toast('다운로드 실패', 'error'); }
  };

  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1048576).toFixed(1) + 'MB';
  };

  const isImage = (mime) => mime && mime.startsWith('image/');

  return (
    <div className="space-y-3">
      {/* 메모 입력 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input type="text" value={newText} onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMemo()} placeholder="메모를 입력하세요..."
            className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm
              placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
          <button onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl border border-border bg-badge-bg text-text-secondary hover:text-primary hover:border-primary flex items-center justify-center transition-all flex-shrink-0"
            title="파일 첨부">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={e => setPendingFiles(prev => [...prev, ...Array.from(e.target.files)])} />
          <button onClick={addMemo} disabled={loading || (!newText.trim() && pendingFiles.length === 0)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
              hover:bg-primary-hover transition-colors disabled:opacity-40 flex-shrink-0">
            {loading ? '...' : '추가'}
          </button>
        </div>

        {/* 대기 중인 파일 목록 */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary text-xs rounded-lg">
                {f.name.substring(0, 15)}{f.name.length > 15 ? '...' : ''} ({formatSize(f.size)})
                <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                  className="hover:text-danger transition-colors">&times;</button>
              </span>
            ))}
          </div>
        )}
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
                  <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && updateMemo(memo.id)}
                    className="flex-1 px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary" autoFocus />
                  <button onClick={() => updateMemo(memo.id)} className="text-xs text-primary font-semibold">저장</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-text-secondary">취소</button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text">{memo.content}</p>
                      <p className="text-[10px] text-text-secondary mt-1">{formatDate(memo.created_at)}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => { const input = document.createElement('input'); input.type='file'; input.accept='image/*,.pdf,.doc,.docx,.txt'; input.onchange=e=> { if(e.target.files[0]) uploadFileToMemo(memo.id, e.target.files[0]); }; input.click(); }}
                        className="p-1 text-text-secondary hover:text-primary rounded transition-colors" title="파일 첨부">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                      <button onClick={() => { setEditingId(memo.id); setEditText(memo.content); }}
                        className="p-1 text-text-secondary hover:text-primary rounded transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => deleteMemo(memo.id)}
                        className="p-1 text-text-secondary hover:text-danger rounded transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* 첨부파일 목록 */}
                  {(memo.files || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {memo.files.map(f => (
                        <span key={f.id} className="inline-flex items-center gap-1 px-2 py-1 bg-card-bg border border-border text-xs rounded-lg group/file">
                          {isImage(f.mime_type) ? '🖼' : '📄'}
                          <button onClick={() => downloadFile(f.id, f.filename)}
                            className="text-text-secondary hover:text-primary transition-colors truncate max-w-[100px]">
                            {f.filename}
                          </button>
                          <span className="text-text-secondary/50">{formatSize(f.size)}</span>
                          <button onClick={() => deleteFile(memo.id, f.id)}
                            className="text-text-secondary/30 hover:text-danger transition-colors">&times;</button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
