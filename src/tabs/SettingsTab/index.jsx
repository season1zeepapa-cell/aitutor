// 설정 탭 — 카테고리/과목/AI설정
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { getAuthUser } from '../../lib/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

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

      {/* 서브 탭 */}
      <div className="flex gap-1 bg-badge-bg rounded-xl p-1">
        {sections.map(s => (
          <button key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
              ${activeSection === s.key
                ? 'bg-card-bg text-primary shadow-sm'
                : 'text-text-secondary hover:text-text'
              }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* 섹션 내용 */}
      {activeSection === 'categories' && <CategorySection />}
      {activeSection === 'ai' && <AiSettingsSection />}
      {activeSection === 'users' && <UsersSection />}
    </div>
  );
}

// ─── 카테고리 관리 섹션 ───
function CategorySection() {
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [subCatId, setSubCatId] = useState('');

  useEffect(() => {
    apiGet('/api/categories')
      .then(data => {
        setCategories(data.categories || []);
        setSubjects(data.subjects || []);
      })
      .catch(() => {});
  }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const data = await apiPost('/api/categories', { action: 'create', name: newCatName.trim() });
      setCategories(prev => [...prev, data.category]);
      setNewCatName('');
    } catch (err) { alert('추가 실패: ' + err.message); }
  };

  const deleteCategory = async (id) => {
    if (!confirm('카테고리를 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/categories', { action: 'delete', id });
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) { alert('삭제 실패: ' + err.message); }
  };

  const addSubject = async () => {
    if (!newSubName.trim() || !subCatId) return;
    try {
      const data = await apiPost('/api/categories', { action: 'createSubject', category_id: Number(subCatId), name: newSubName.trim() });
      setSubjects(prev => [...prev, data.subject]);
      setNewSubName('');
    } catch (err) { alert('추가 실패: ' + err.message); }
  };

  return (
    <div className="space-y-4">
      {/* 카테고리 추가 */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">카테고리 관리</p>
        <div className="flex gap-2 mb-3">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="새 카테고리명" className="flex-1 px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all" />
          <button onClick={addCategory} className="w-10 h-10 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary-hover transition-colors">+</button>
        </div>
        <div className="space-y-1">
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl group">
              <span className="text-sm text-text font-medium">{c.name}</span>
              <button onClick={() => deleteCategory(c.id)}
                className="text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-text-secondary text-center py-4">카테고리가 없습니다.</p>}
        </div>
      </Card>

      {/* 과목 추가 */}
      <Card>
        <p className="text-sm font-bold text-text mb-3">과목 관리</p>
        <div className="flex gap-2 mb-3">
          <select value={subCatId} onChange={e => setSubCatId(e.target.value)}
            className="w-[120px] px-2 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all">
            <option value="">카테고리</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={newSubName} onChange={e => setNewSubName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()}
            placeholder="새 과목명" className="flex-1 px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all" />
          <button onClick={addSubject} className="w-10 h-10 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary-hover transition-colors">+</button>
        </div>
        <div className="space-y-1">
          {subjects.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-badge-bg rounded-xl">
              <span className="text-[10px] text-text-secondary">{categories.find(c => c.id === s.category_id)?.name || '-'}</span>
              <span className="text-sm text-text">{s.name}</span>
            </div>
          ))}
          {subjects.length === 0 && <p className="text-xs text-text-secondary text-center py-4">과목이 없습니다.</p>}
        </div>
      </Card>
    </div>
  );
}

// ─── AI 설정 섹션 ───
function AiSettingsSection() {
  return (
    <Card>
      <p className="text-sm font-bold text-text mb-3">AI 모델 설정</p>
      <p className="text-xs text-text-secondary mb-4">AI 해설 생성 시 사용할 기본 모델을 선택합니다.</p>
      <div className="space-y-3">
        {[
          { label: 'Gemini', model: 'gemini-2.5-flash', color: '#4285f4' },
          { label: 'OpenAI', model: 'gpt-4o-mini', color: '#10a37f' },
          { label: 'Claude', model: 'claude-sonnet-4-20250514', color: '#d97706' },
        ].map(ai => (
          <div key={ai.label} className="flex items-center justify-between px-4 py-3 bg-badge-bg rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: ai.color }} />
              <span className="text-sm font-semibold text-text">{ai.label}</span>
            </div>
            <span className="text-xs text-text-secondary font-mono">{ai.model}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── 회원관리 섹션 ───
function UsersSection() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    apiGet('/api/admin')
      .then(data => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-3">회원 관리</p>
      <div className="space-y-1">
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl">
            <span className="text-sm text-text">{u.username}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              u.is_admin ? 'bg-primary/10 text-primary' : 'bg-badge-bg text-text-secondary'
            }`}>
              {u.is_admin ? '관리자' : '일반'}
            </span>
          </div>
        ))}
        {users.length === 0 && <p className="text-xs text-text-secondary text-center py-4">회원 정보를 불러오는 중...</p>}
      </div>
    </Card>
  );
}
