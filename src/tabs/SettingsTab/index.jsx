// 설정 탭 — 일반 사용자: 내 계정만 / 관리자: 전체 설정
import { useState, useEffect } from 'react';
import { apiGet, apiPost, getAuthUser, clearAuth } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import Card from '../../components/ui/Card';
import LlmSettingsPanel from './LlmSettingsPanel';
import LlmUsagePanel from './LlmUsagePanel';
import LlmProviderToggleCard from './LlmProviderToggleCard';

export default function SettingsTab() {
  const user = getAuthUser();
  const isAdmin = user?.admin;

  // 일반 사용자: 내 계정만
  const [activeSection, setActiveSection] = useState(isAdmin ? 'general' : 'account');

  const sections = isAdmin
    ? [
        { key: 'general', label: '일반' },
        { key: 'categories', label: '카테고리' },
        { key: 'ai', label: 'AI 설정' },
        { key: 'labs', label: '🧪 실험실' },
        { key: 'users', label: '회원관리' },
        { key: 'account', label: '내 계정' },
      ]
    : [
        { key: 'account', label: '내 계정' },
      ];

  return (
    <div className="space-y-4 fade-in">
      <h2 className="text-xl font-bold text-text">설정</h2>
      {sections.length > 1 && (
        <div className="flex gap-1 bg-badge-bg rounded-xl p-1">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeSection === s.key ? 'bg-card-bg text-primary shadow-sm' : 'text-text-secondary hover:text-text'}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      {activeSection === 'general' && <GeneralSection />}
      {activeSection === 'categories' && <CategorySection />}
      {activeSection === 'ai' && (
        <div className="space-y-4">
          {/* REBUILD18 §11 후속 — 프로바이더별 글로벌 활성화 토글 (관리자 전용) */}
          <LlmProviderToggleCard />
          <Card><LlmSettingsPanel /></Card>
          {/* 관리자 전용 — LlmUsagePanel 자체에서도 isAdmin 가드 (이중 안전) */}
          <LlmUsagePanel />
        </div>
      )}
      {activeSection === 'labs' && <LabsSection />}
      {activeSection === 'users' && <UsersSection />}
      {activeSection === 'account' && <AccountSection />}
    </div>
  );
}

// ─── 내 계정 (일반 사용자 + 관리자 공통) ───
function AccountSection() {
  const toast = useToast();
  const user = getAuthUser();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    clearAuth();
    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== '탈퇴합니다') {
      toast('"탈퇴합니다"를 정확히 입력해주세요.', 'error');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: '탈퇴합니다' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '탈퇴 실패');
      clearAuth();
      window.location.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 계정 정보 */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-text mb-3">내 계정</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">이름</span>
            <span className="text-text font-medium">{user?.name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">권한</span>
            <span className={`font-medium ${user?.admin ? 'text-primary' : 'text-text'}`}>
              {user?.admin ? '관리자' : '일반 사용자'}
            </span>
          </div>
        </div>
      </Card>

      {/* 캐시 삭제 */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-text mb-1">캐시 삭제</h3>
        <p className="text-xs text-text-secondary mb-3">필터 선택, AI 설정 등 로컬 저장 데이터를 초기화합니다.</p>
        <button
          onClick={() => {
            const keys = Object.keys(localStorage).filter(k => k !== 'user');
            keys.forEach(k => localStorage.removeItem(k));
            toast(`캐시 ${keys.length}건 삭제 완료`, 'success');
          }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-text-secondary border border-border hover:bg-card-bg-hover transition-all"
        >
          캐시 삭제
        </button>
      </Card>

      {/* 로그아웃 */}
      <Card className="p-4">
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl text-sm font-bold text-text-secondary border border-border hover:bg-card-bg-hover transition-all"
        >
          로그아웃
        </button>
      </Card>

      {/* 계정 탈퇴 */}
      <Card className="p-4 border-red-200 dark:border-red-900/30">
        <h3 className="text-sm font-bold text-danger mb-2">계정 탈퇴</h3>
        <p className="text-xs text-text-secondary mb-3">
          탈퇴하면 모든 데이터(메모, 북마크, 시험 결과)가 삭제되며 복구할 수 없습니다.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-danger border border-danger/30 hover:bg-danger/5 transition-all"
          >
            계정 탈퇴하기
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-danger font-medium">
              정말 탈퇴하시겠습니까? 아래에 <strong>"탈퇴합니다"</strong>를 입력해주세요.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="탈퇴합니다"
              className="w-full px-3 py-2.5 rounded-xl border border-danger/30 bg-white dark:bg-gray-900 text-text text-sm focus:outline-none focus:border-danger"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-text-secondary border border-border hover:bg-card-bg-hover transition-all"
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput !== '탈퇴합니다'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-all"
              >
                {deleting ? '처리 중...' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── 일반 설정 ───
function EffectToggle({ label, desc, storageKey }) {
  const [enabled, setEnabled] = useState(() => {
    const v = localStorage.getItem(storageKey);
    return v === null ? true : v === 'true';
  });
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(storageKey, String(next));
  };
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
      <div>
        <p className="text-sm text-text font-medium">{label}</p>
        <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
      </div>
      <button onClick={toggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${enabled ? 'bg-primary' : 'bg-border'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function GeneralSection() {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-bold text-text mb-3">학습 효과</p>
        <div className="space-y-2">
          <EffectToggle
            label="정답 애니메이션"
            desc="정답 시 폭죽 효과"
            storageKey="aitutor_effect_correct"
          />
          <EffectToggle
            label="오답 애니메이션"
            desc="오답 시 번개 효과"
            storageKey="aitutor_effect_wrong"
          />
        </div>
      </Card>
    </div>
  );
}

// ─── 아코디언 섹션 헬퍼 — 헤더 클릭으로 펼침/접힘 ───
//   하나의 active key 로 단일 활성 아코디언 (한 번에 한 섹션만 열림 — 화면 공간 효율).
function AccordionSection({ title, count, isOpen, onToggle, children }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-bg-hover transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text">{title}</span>
          {count !== undefined && (
            <span className="text-[11px] font-semibold text-text-secondary px-2 py-0.5 bg-badge-bg rounded-full">{count}</span>
          )}
        </div>
        <svg className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-3 border-t border-border">
          {children}
        </div>
      )}
    </Card>
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
  // filterCatId — 과목 관리 섹션의 카테고리 필터 + 추가 시 대상 카테고리.
  // 빈 문자열('')은 "전체" 의미. 특정 카테고리 선택 시 그 ID 의 문자열.
  const [filterCatId, setFilterCatId] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editName, setEditName] = useState('');

  // 아코디언 활성 섹션 — 첫 진입 시 카테고리 관리만 펼쳐짐
  const [openSection, setOpenSection] = useState('cat');
  const toggle = (key) => setOpenSection(prev => prev === key ? null : key);

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
  // filterCatId 로 추가 (필터에서 선택된 카테고리 = 추가 대상 카테고리)
  const addSubject = async () => {
    if (!newSubName.trim()) return;
    if (!filterCatId) {
      toast('카테고리를 먼저 선택하세요', 'error');
      return;
    }
    try {
      const data = await apiPost('/api/categories', { action: 'createSubject', category_id: Number(filterCatId), name: newSubName.trim() });
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

  const inputClass = "flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all";

  // 과목 관리 — 카테고리 필터 적용. 빈 filterCatId('') = 전체 표시.
  const filteredSubjects = filterCatId
    ? subjects.filter(s => String(s.category_id) === String(filterCatId))
    : subjects;
  const filterCatName = filterCatId
    ? (categories.find(c => String(c.id) === String(filterCatId))?.name || '')
    : '';

  return (
    <div className="space-y-3">
      {/* === 카테고리 관리 === */}
      <AccordionSection title="카테고리 관리" count={categories.length}
        isOpen={openSection === 'cat'} onToggle={() => toggle('cat')}>
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
                    <button onClick={() => { setEditingCat(c.id); setEditName(c.name); }} className="p-1 touch-target flex items-center justify-center text-text-secondary hover:text-primary transition-colors" aria-label="수정">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteCategory(c.id)} className="p-1 touch-target flex items-center justify-center text-text-secondary hover:text-danger transition-colors" aria-label="삭제">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-text-secondary text-center py-4">카테고리가 없습니다.</p>}
        </div>
      </AccordionSection>

      {/* === 과목 관리 — 카테고리 필터 + 필터된 카테고리에 추가 === */}
      <AccordionSection title="과목 관리" count={filteredSubjects.length}
        isOpen={openSection === 'sub'} onToggle={() => toggle('sub')}>
        {/* 카테고리 필터 — 선택 시 그 카테고리의 과목만 + 추가 시 그 카테고리에 추가 */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5">카테고리 선택</label>
          <select value={filterCatId} onChange={e => setFilterCatId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all">
            <option value="">— 카테고리를 선택하세요 (전체 보기) —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* 추가 영역 — 카테고리가 선택된 경우만 활성 */}
        <div className="flex gap-2 mb-3">
          <input value={newSubName} onChange={e => setNewSubName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()}
            placeholder={filterCatId ? `'${filterCatName}'에 추가할 새 과목명` : '카테고리를 먼저 선택하세요'}
            disabled={!filterCatId}
            className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`} />
          <button onClick={addSubject} disabled={!filterCatId || !newSubName.trim()}
            className="w-10 h-10 rounded-xl bg-primary text-white text-lg font-bold flex items-center justify-center hover:bg-primary-hover transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">+</button>
        </div>

        {/* 목록 — 필터 적용 */}
        <div className="space-y-1">
          {filteredSubjects.map(s => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-badge-bg rounded-xl group">
              {editingSubject === s.id ? (
                <div className="flex gap-2 flex-1">
                  <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditSubject(s.id)} className={inputClass} autoFocus />
                  <button onClick={() => saveEditSubject(s.id)} className="text-xs text-primary font-semibold">저장</button>
                  <button onClick={() => setEditingSubject(null)} className="text-xs text-text-secondary">취소</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    {/* 필터가 비어있을 때만 카테고리 배지 표시 (필터 시엔 동일 카테고리라 노이즈) */}
                    {!filterCatId && (
                      <span className="text-[10px] text-text-secondary bg-card-bg px-1.5 py-0.5 rounded shrink-0">
                        {categories.find(c => c.id === s.category_id)?.name || '-'}
                      </span>
                    )}
                    <span className="text-sm text-text truncate">{s.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => { setEditingSubject(s.id); setEditName(s.name); }} className="p-1 touch-target flex items-center justify-center text-text-secondary hover:text-primary transition-colors" aria-label="수정">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteSubject(s.id)} className="p-1 touch-target flex items-center justify-center text-text-secondary hover:text-danger transition-colors" aria-label="삭제">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filteredSubjects.length === 0 && (
            <p className="text-xs text-text-secondary text-center py-4">
              {filterCatId ? `'${filterCatName}' 카테고리에 등록된 과목이 없습니다.` : '과목이 없습니다.'}
            </p>
          )}
        </div>
      </AccordionSection>

      {/* === 시험별 카테고리 지정 === */}
      <AccordionSection title="시험별 카테고리 지정" count={exams.length}
        isOpen={openSection === 'exam'} onToggle={() => toggle('exam')}>
        <div className="space-y-1">
          {exams.map(e => (
            <div key={e.id} className="flex items-center gap-2 px-3 py-2 bg-badge-bg rounded-xl">
              <span className="text-sm text-text truncate flex-1 min-w-0">{e.title}</span>
              <select value={e.category_id || ''} onChange={ev => assignExamCategory(e.id, ev.target.value)}
                className="px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-xs flex-shrink-0">
                <option value="">미지정</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
          {exams.length === 0 && <p className="text-xs text-text-secondary text-center py-4">시험이 없습니다.</p>}
        </div>
      </AccordionSection>
    </div>
  );
}


// ─── 시스템 설정 카드 (회원관리 섹션 상단) ───
// DB 의 aitutor_settings 테이블을 관리자 UI 에서 직접 토글.
// 키 변경 시 즉시 DB 반영 + 30초 내 모든 Lambda 인스턴스에 전파.
function SystemSettingsCard() {
  const toast = useToast();
  const [settings, setSettings] = useState([]);     // [{ key, value, updated_at, updated_by }]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);       // 저장 중인 key

  useEffect(() => {
    apiGet('/api/admin?action=get_settings')
      .then(data => setSettings(data.settings || []))
      .catch(err => toast('시스템 설정 로드 실패: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  // 특정 key 값을 boolean 으로 조회
  const getBoolValue = (key) => {
    const row = settings.find(s => s.key === key);
    return row?.value === 'true';
  };

  // 토글: DB 갱신 → 로컬 state 즉시 업데이트
  const toggleBool = async (key) => {
    const newValue = !getBoolValue(key);
    setSaving(key);
    try {
      await apiPost('/api/admin', { action: 'set_setting', key, value: String(newValue) });
      setSettings(prev => {
        const idx = prev.findIndex(s => s.key === key);
        if (idx === -1) return [...prev, { key, value: String(newValue), updated_at: new Date().toISOString() }];
        const next = [...prev];
        next[idx] = { ...next[idx], value: String(newValue), updated_at: new Date().toISOString() };
        return next;
      });
      // 메시지: signup_disabled=false → 회원가입 활성화. true → 차단.
      if (key === 'signup_disabled') {
        toast(newValue ? '회원가입이 차단되었습니다.' : '회원가입이 활성화되었습니다.', 'success');
      } else if (key === 'lab_local_ai_enabled') {
        toast(newValue ? '🧪 실험실(디바이스 AI)이 활성화되었습니다.' : '실험실이 비활성화되었습니다.', 'success');
      } else if (key === 'lab_server_ai_enabled') {
        toast(newValue ? '☁️ 실험실(서버 추론)이 활성화되었습니다.' : '실험실(서버 추론)이 비활성화되었습니다.', 'success');
      } else {
        toast('설정이 변경되었습니다.', 'success');
      }
    } catch (err) {
      toast('변경 실패: ' + err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  // signup_disabled 의 의미를 사용자 친화적으로 뒤집어 표시 (가입 "활성화" 토글)
  // DB 값 true(차단) → UI 토글 OFF, false(허용) → UI 토글 ON
  const signupEnabled = !getBoolValue('signup_disabled');
  const isSavingSignup = saving === 'signup_disabled';

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-1">⚙️ 시스템 설정</p>
      <p className="text-xs text-text-secondary mb-3">
        DB 기반 즉시 반영 (신규 회원가입 화면 노출 영향 — 최대 30초)
      </p>

      {loading ? (
        <p className="text-xs text-text-secondary py-2">불러오는 중…</p>
      ) : (
        <div className="space-y-2">
          {/* 회원가입 활성화 토글 */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm text-text font-medium">신규 회원가입</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {signupEnabled
                  ? '🟢 누구나 회원가입 가능'
                  : '🔴 회원가입 차단 — 로그인 페이지에 "회원가입 (준비중)" 표시'}
              </p>
            </div>
            <button
              onClick={() => toggleBool('signup_disabled')}
              disabled={isSavingSignup}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                signupEnabled ? 'bg-primary' : 'bg-border'
              }`}
              aria-label={signupEnabled ? '회원가입 차단' : '회원가입 활성화'}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  signupEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

        </div>
      )}
    </Card>
  );
}

// ─── 🧪 실험실 (Labs) — 분리된 별도 탭 ───
function LabsSection() {
  const toast = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    apiGet('/api/admin?action=get_settings')
      .then(data => setSettings(data.settings || []))
      .catch(err => toast('실험실 설정 로드 실패: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const getBoolValue = (key) => {
    const row = settings.find(s => s.key === key);
    return row?.value === 'true';
  };

  const toggleBool = async (key) => {
    const newValue = !getBoolValue(key);
    setSaving(key);
    try {
      await apiPost('/api/admin', { action: 'set_setting', key, value: String(newValue) });
      setSettings(prev => {
        const idx = prev.findIndex(s => s.key === key);
        if (idx === -1) return [...prev, { key, value: String(newValue), updated_at: new Date().toISOString() }];
        const next = [...prev];
        next[idx] = { ...next[idx], value: String(newValue), updated_at: new Date().toISOString() };
        return next;
      });
      if (key === 'lab_local_ai_enabled') {
        toast(newValue ? '🧪 실험실(디바이스 AI)이 활성화되었습니다.' : '실험실이 비활성화되었습니다.', 'success');
      } else if (key === 'lab_server_ai_enabled') {
        toast(newValue ? '☁️ 실험실(서버 추론)이 활성화되었습니다.' : '실험실(서버 추론)이 비활성화되었습니다.', 'success');
      } else if (key === 'lab_hf_enabled') {
        toast(newValue ? '🤗 실험실(HF Inference)이 활성화되었습니다.' : '실험실(HF Inference)이 비활성화되었습니다.', 'success');
      }
    } catch (err) {
      toast('변경 실패: ' + err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const labLocalEnabled = getBoolValue('lab_local_ai_enabled');
  const isSavingLocal = saving === 'lab_local_ai_enabled';
  const labServerEnabled = getBoolValue('lab_server_ai_enabled');
  const isSavingServer = saving === 'lab_server_ai_enabled';
  const labGgufEnabled = getBoolValue('lab_server_ai_gguf_enabled');
  const isSavingGguf = saving === 'lab_server_ai_gguf_enabled';
  const labHfEnabled = getBoolValue('lab_hf_enabled');
  const isSavingHf = saving === 'lab_hf_enabled';

  return (
    <Card>
      <p className="text-sm font-bold text-text mb-1">🧪 실험실 (Labs)</p>
      <p className="text-xs text-text-secondary mb-3">
        관리자 검증용 시범 페이지. 토글 활성화 후 테스트 페이지 진입 가능.
      </p>

      {loading ? (
        <p className="text-xs text-text-secondary py-2">불러오는 중…</p>
      ) : (
        <div className="space-y-2">
          {/* 🧪 디바이스 AI 해설 (REBUILD17) */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm text-text font-medium">🧪 디바이스 AI 해설</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {labLocalEnabled
                  ? '🟢 활성화됨 — 모바일 PWA + Gemma 4 E4B 시범'
                  : '🔴 비활성 — 활성화 시 테스트 페이지 진입 가능 (관리자 검증용)'}
              </p>
              {labLocalEnabled && (
                <a
                  href="/lab/local-ai"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline"
                >
                  → 테스트 페이지 열기 (/lab/local-ai)
                </a>
              )}
            </div>
            <button
              onClick={() => toggleBool('lab_local_ai_enabled')}
              disabled={isSavingLocal}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                labLocalEnabled ? 'bg-primary' : 'bg-border'
              }`}
              aria-label={labLocalEnabled ? '디바이스 AI 실험실 비활성화' : '디바이스 AI 실험실 활성화'}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  labLocalEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* ☁️ 서버 추론 (REBUILD21) */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm text-text font-medium">☁️ 서버 추론 (Lambda + ONNX)</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {labServerEnabled
                  ? '🟢 활성화됨 — Gemma 4 E2B/E4B (서버 호스팅, Lambda + ONNX)'
                  : '🔴 비활성 — 활성화 시 테스트 페이지 진입 가능 (관리자 검증용)'}
              </p>
              {labServerEnabled && (
                <a
                  href="/lab/server-ai"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline"
                >
                  → 테스트 페이지 열기 (/lab/server-ai)
                </a>
              )}
            </div>
            <button
              onClick={() => toggleBool('lab_server_ai_enabled')}
              disabled={isSavingServer}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                labServerEnabled ? 'bg-primary' : 'bg-border'
              }`}
              aria-label={labServerEnabled ? '서버 추론 실험실 비활성화' : '서버 추론 실험실 활성화'}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  labServerEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* ⚡ 서버 추론 GGUF (REBUILD21 §17.x) */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm text-text font-medium">⚡ 서버 추론 GGUF (Lambda + llama.cpp)</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {labGgufEnabled
                  ? '🟢 활성화됨 — Gemma 4 E2B GGUF Q4_K_M (CPU 최적화)'
                  : '🔴 비활성 — 활성화 시 테스트 페이지 진입 가능 (관리자 검증용)'}
              </p>
              {labGgufEnabled && (
                <a
                  href="/lab/server-ai-gguf"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline"
                >
                  → 테스트 페이지 열기 (/lab/server-ai-gguf)
                </a>
              )}
            </div>
            <button
              onClick={() => toggleBool('lab_server_ai_gguf_enabled')}
              disabled={isSavingGguf}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                labGgufEnabled ? 'bg-primary' : 'bg-border'
              }`}
              aria-label={labGgufEnabled ? 'GGUF 실험실 비활성화' : 'GGUF 실험실 활성화'}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  labGgufEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* 🤗 HF Inference Providers (REBUILD22 §x) */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-badge-bg rounded-xl">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm text-text font-medium">🤗 HF Inference (오픈 모델 라우팅)</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {labHfEnabled
                  ? '🟢 활성화됨 — Llama 3.3 / Qwen 2.5 / DeepSeek R1 / Mistral / Gemma 7종'
                  : '🔴 비활성 — 활성화 시 다양한 오픈 모델 테스트 페이지 진입 가능'}
              </p>
              {labHfEnabled && (
                <a
                  href="/lab/hf"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline"
                >
                  → 테스트 페이지 열기 (/lab/hf)
                </a>
              )}
            </div>
            <button
              onClick={() => toggleBool('lab_hf_enabled')}
              disabled={isSavingHf}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50 ${
                labHfEnabled ? 'bg-primary' : 'bg-border'
              }`}
              aria-label={labHfEnabled ? 'HF 실험실 비활성화' : 'HF 실험실 활성화'}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  labHfEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </Card>
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
    <div className="space-y-4">
      {/* 시스템 설정 (회원가입 토글 등) */}
      <SystemSettingsCard />

      {/* 회원 목록 */}
      <Card>
      <p className="text-sm font-bold text-text mb-3">회원 관리 ({users.length}명)</p>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="px-3 py-2.5 bg-badge-bg rounded-xl">
            {/* 1줄: 이메일 + 권한 뱃지 */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm text-text break-all min-w-0 flex-1">{u.username}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${u.is_admin ? 'bg-primary/10 text-primary' : 'bg-card-bg text-text-secondary border border-border'}`}>
                {u.is_admin ? '관리자' : '일반'}
              </span>
            </div>
            {/* 2줄: 이름 + 액션 버튼 (항상 노출) */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{u.name || '-'}</span>
              <div className="flex gap-1">
                <button onClick={() => toggleAdmin(u.id)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-border text-text-secondary hover:text-primary hover:border-primary transition-all">
                  {u.is_admin ? '일반으로' : '관리자로'}
                </button>
                <button onClick={() => deleteUser(u.id, u.username)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-danger border border-danger/20 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-xs text-text-secondary text-center py-4">회원 정보를 불러오는 중...</p>}
      </div>
      </Card>
    </div>
  );
}
