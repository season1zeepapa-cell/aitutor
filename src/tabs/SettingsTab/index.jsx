// 설정 탭 — 카테고리/과목 CRUD + 시험 카테고리 지정 + 회원관리
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { getAuthUser } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import LlmSettingsPanel from './LlmSettingsPanel';

export default function SettingsTab() {
  const [activeSection, setActiveSection] = useState('categories');
  const user = getAuthUser();
  const sections = [
    { key: 'categories', label: '카테고리' },
    { key: 'ai', label: 'AI 설정' },
    ...(user?.admin ? [{ key: 'users', label: '회원관리' }] : []),
  ];

  return (
    <div className="space-y-4 fade-in">
      <h2 className="text-xl font-bold text-text">설정</h2>
      <div className="flex gap-1 bg-badge-bg rounded-xl p-1">
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSection === s.key ? 'bg-card-bg text-primary shadow-sm' : 'text-text-secondary hover:text-text'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {activeSection === 'categories' && <CategorySection />}
      {activeSection === 'ai' && <Card><LlmSettingsPanel /></Card>}
      {activeSection === 'users' && <UsersSection />}
    </div>
  );
}

// ─── 카테고리 + 과목 + 시험 카테고리 지정 ───
function CategorySection() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    apiGet('/api/categories').then(data => {
      setCategories(data.categories || []);
      setSubjects(data.subjects || []);
    }).catch(() => {});
    apiPost('/api/questions', { action: 'meta' }).then(data => setExams(data.exams || [])).catch(() => {});
  }, []);

  // 카테고리 CRUD
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const data = await apiPost('/api/categories', { action: 'create', name: newCatName.trim() });
      setCategories(prev => [...prev, data.category]);
      setNewCatName('');
      toast('카테고리 추가됨', 'success');
    } catch (err) { toast('추가 실패: ' + err.message, 'error'); }
  };

  const saveEditCategory = async (id) => {
    if (!editName.trim()) return;
    try {
      await apiPost('/api/categories', { action: 'update', id, name: editName.trim() });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c));
      setEditingCat(null);
      toast('카테고리 수정됨', 'success');
    } catch (err) { toast('수정 실패: ' + err.message, 'error'); }
  };

  const deleteCategory = async (id) => {
    if (!confirm('카테고리를 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/categories', { action: 'delete', id });
      setCategories(prev => prev.filter(c => c.id !== id));
      toast('카테고리 삭제됨', 'success');
    } catch (err) { toast('삭제 실패: ' + err.message, 'error'); }
  };

  // 과목 CRUD
  const addSubject = async () => {
    if (!newSubName.trim() || !subCatId) return;
    try {
      const data = await apiPost('/api/categories', { action: 'createSubject', category_id: Number(subCatId), name: newSubName.trim() });
      setSubjects(prev => [...prev, data.subject]);
      setNewSubName('');
      toast('과목 추가됨', 'success');
    } catch (err) { toast('추가 실패: ' + err.message, 'error'); }
  };

  const saveEditSubject = async (id) => {
    if (!editName.trim()) return;
    try {
      await apiPost('/api/categories', { action: 'updateSubject', id, name: editName.trim() });
      setSubjects(prev => prev.map(s => s.id === id ? { ...s, name: editName.trim() } : s));
      setEditingSubject(null);
      toast('과목 수정됨', 'success');
    } catch (err) { toast('수정 실패: ' + err.message, 'error'); }
  };

  const deleteSubject = async (id) => {
    if (!confirm('과목을 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/categories', { action: 'deleteSubject', id });
      setSubjects(prev => prev.filter(s => s.id !== id));
      toast('과목 삭제됨', 'success');
    } catch (err) { toast('삭제 실패: ' + err.message, 'error'); }
  };

  // 시험-카테고리 지정
  const assignExamCategory = async (examId, catId) => {
    try {
      await apiPost('/api/categories', { action: 'assignExam', exam_id: Number(examId), category_id: catId ? Number(catId) : null });
      setExams(prev => prev.map(e => e.id === examId ? { ...e, category_id: catId ? Number(catId) : null } : e));
      toast('카테고리 지정됨', 'success');
    } catch (err) { toast('지정 실패: ' + err.message, 'error'); }
  };

  const inputClass = "flex-1 px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all";

  return (
    <div className="space-y-4">
      {/* 카테고리 관리 */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">카테고리 관리</p>
        <div className="flex gap-2 mb-3">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="새 카테고리명" className={inputClass} />
          <button onClick={addCategory} className="w-10 h-10 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary-hover transition-colors flex-shrink-0">+</button>
        </div>
        <div className="space-y-1">
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl group">
              {editingCat === c.id ? (
                <div className="flex gap-2 flex-1">
                  <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditCategory(c.id)} className={inputClass} autoFocus />
                  <button onClick={() => saveEditCategory(c.id)} className="text-xs text-primary font-semibold">저장</button>
                  <button onClick={() => setEditingCat(null)} className="text-xs text-text-secondary">취소</button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-text font-medium">{c.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCat(c.id); setEditName(c.name); }} className="p-1 text-text-secondary hover:text-primary transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteCategory(c.id)} className="p-1 text-text-secondary hover:text-danger transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-text-secondary text-center py-4">카테고리가 없습니다.</p>}
        </div>
      </Card>

      {/* 과목 관리 */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">과목 관리</p>
        <div className="flex gap-2 mb-3">
          <select value={subCatId} onChange={e => setSubCatId(e.target.value)}
            className="w-[120px] px-2 py-2 rounded-xl border border-border bg-input-bg text-text text-sm">
            <option value="">카테고리</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={newSubName} onChange={e => setNewSubName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="새 과목명" className={inputClass} />
          <button onClick={addSubject} className="w-10 h-10 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary-hover transition-colors flex-shrink-0">+</button>
        </div>
        <div className="space-y-1">
          {subjects.map(s => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl group">
              {editingSubject === s.id ? (
                <div className="flex gap-2 flex-1">
                  <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditSubject(s.id)} className={inputClass} autoFocus />
                  <button onClick={() => saveEditSubject(s.id)} className="text-xs text-primary font-semibold">저장</button>
                  <button onClick={() => setEditingSubject(null)} className="text-xs text-text-secondary">취소</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-secondary bg-card-bg px-1.5 py-0.5 rounded">{categories.find(c => c.id === s.category_id)?.name || '-'}</span>
                    <span className="text-sm text-text">{s.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingSubject(s.id); setEditName(s.name); }} className="p-1 text-text-secondary hover:text-primary transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteSubject(s.id)} className="p-1 text-text-secondary hover:text-danger transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {subjects.length === 0 && <p className="text-xs text-text-secondary text-center py-4">과목이 없습니다.</p>}
        </div>
      </Card>

      {/* 시험별 카테고리 지정 */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">시험별 카테고리 지정</p>
        <div className="space-y-1">
          {exams.map(e => (
            <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl">
              <span className="text-sm text-text truncate flex-1">{e.title}</span>
              <select value={e.category_id || ''} onChange={ev => assignExamCategory(e.id, ev.target.value)}
                className="px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-xs min-w-[100px]">
                <option value="">미지정</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
          {exams.length === 0 && <p className="text-xs text-text-secondary text-center py-4">시험이 없습니다.</p>}
        </div>
      </Card>
    </div>
  );
}


// ─── 회원관리 ───
function UsersSection() {
  const toast = useToast();
  const [users, setUsers] = useState([]);

  useEffect(() => { apiGet('/api/admin').then(data => setUsers(data.users || [])).catch(() => {}); }, []);

  const toggleAdmin = async (userId) => {
    try {
      await apiPost('/api/admin', { action: 'toggleAdmin', userId });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !u.is_admin } : u));
      toast('권한 변경됨', 'success');
    } catch (err) { toast('권한 변경 실패: ' + err.message, 'error'); }
  };

  const deleteUser = async (userId, username) => {
    if (!confirm(`'${username}' 회원을 삭제하시겠습니까?`)) return;
    try {
      await apiPost('/api/admin', { action: 'delete', userId });
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast('회원 삭제됨', 'success');
    } catch (err) { toast('삭제 실패: ' + err.message, 'error'); }
  };

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-3">회원 관리</p>
      <div className="space-y-1">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl group">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text">{u.username}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.is_admin ? 'bg-primary/10 text-primary' : 'bg-badge-bg text-text-secondary border border-border'}`}>
                {u.is_admin ? '관리자' : '일반'}
              </span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleAdmin(u.id)}
                className="px-2 py-1 rounded-lg text-xs font-semibold border border-border text-text-secondary hover:text-primary hover:border-primary transition-all">
                {u.is_admin ? '일반으로' : '관리자로'}
              </button>
              <button onClick={() => deleteUser(u.id, u.username)}
                className="px-2 py-1 rounded-lg text-xs font-semibold text-danger hover:bg-red-50 transition-all">
                삭제
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-xs text-text-secondary text-center py-4">회원 정보를 불러오는 중...</p>}
      </div>
    </Card>
  );
}
