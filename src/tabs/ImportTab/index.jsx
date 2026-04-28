// ImportTab — DocStore 연동 + 파일 업로드 서브탭 래퍼
import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiFetch } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import PoolUpload from './PoolUpload';

const SUB_TABS = [
  { key: 'docstore', label: 'DocStore 연동', icon: '📥' },
  { key: 'upload', label: '파일 업로드', icon: '📄' },
];

export default function ImportTab() {
  const [subTab, setSubTab] = useState('docstore');

  return (
    <div>
      {/* 서브탭 전환 */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
        {SUB_TABS.map(t => (
          <button key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
              ${subTab === t.key
                ? 'bg-white dark:bg-gray-700 shadow text-primary'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'docstore' ? <DocStoreImport /> : <PoolUpload />}
    </div>
  );
}

// ── DocStore 연동 (기존 코드 그대로) ──
const STEPS = [
  { key: 'wait', label: '대상조회', color: '#4255ff', icon: '📋' },
  { key: 'imported', label: '문제이관', color: '#f59e0b', icon: '📥' },
  { key: 'done', label: '해설생성 및 완료', color: '#22c55e', icon: '✅' },
];

function DocStoreImport() {
  const toast = useToast();
  const [sourceExams, setSourceExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [waitQueue, setWaitQueue] = useState([]);
  const [importedList, setImportedList] = useState([]);
  const [doneList, setDoneList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [collapsedCols, setCollapsedCols] = useState({ wait: true, imported: true, done: true });
  const [checkedWait, setCheckedWait] = useState(new Set());
  const [checkedImported, setCheckedImported] = useState(new Set());
  const [llmProvider, setLlmProvider] = useState('gemini');
  const [progress, setProgress] = useState(null); // {text, percent}
  const [logs, setLogs] = useState([]);
  const [showLog, setShowLog] = useState(false);

  // 초기 로드
  useEffect(() => {
    apiGet('/api/import-docstore').then(data => setSourceExams((data.exams || []).filter(e => e.question_count > 0))).catch(() => {});
    apiGet('/api/categories').then(data => setCategories(data.categories || [])).catch(() => {});
  }, []);

  // 소스 시험 선택
  const onExamChange = async (examId) => {
    setSelectedExam(examId);
    setWaitQueue([]); setImportedList([]); setDoneList([]);
    setCheckedWait(new Set()); setCheckedImported(new Set());
    if (!examId) return;
    try {
      const data = await apiGet(`/api/import-docstore?examId=${examId}`);
      setWaitQueue((data.questions || []).map(q => ({
        sourceId: q.id, number: q.question_number, body: q.body,
        answer: q.answer, choices: q.choices, explanation: q.explanation,
      })));
    } catch (err) { toast('문제 조회 실패: ' + err.message, 'error'); }
  };

  // 로그 추가
  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs(prev => [...prev, { type, message, time }]);
  };

  // ─── 이관 ───
  const importQuestions = async () => {
    if (!categoryId) { toast('카테고리를 선택하세요.', 'warn'); return; }
    if (!examTitle.trim()) { toast('시험 이름을 입력하세요.', 'warn'); return; }

    const ids = checkedWait.size > 0 ? [...checkedWait] : waitQueue.map(q => q.sourceId);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}개 문제를 '${examTitle}'로 이관하시겠습니까?`)) return;

    setProgress({ text: '이관 중...', percent: 20 });
    try {
      // 시험 생성/조회
      const examRes = await apiPost('/api/questions', {
        action: 'createExam', title: examTitle.trim(), category_id: Number(categoryId)
      });
      const targetExamId = examRes.id || examRes.exam?.id;

      const res = await apiPost('/api/import-docstore', {
        action: 'import', sourceExamId: Number(selectedExam), targetExamId, questionIds: ids
      });
      setProgress({ text: `${res.imported}개 문제 이관 완료!`, percent: 100 });
      addLog('success', `${res.imported}개 문제 이관 완료 (${examTitle})`);
      toast(`${res.imported}개 문제 이관 완료`, 'success');

      // 이관된 문제를 imported로 이동
      const moved = waitQueue.filter(q => ids.includes(q.sourceId));
      setWaitQueue(prev => prev.filter(q => !ids.includes(q.sourceId)));
      setImportedList(prev => [...prev, ...moved.map(q => ({ ...q, id: q.sourceId }))]);
      setCheckedWait(new Set());

      // 이관된 문제 상태 새로고침
      const statusRes = await apiPost('/api/import-docstore', {
        action: 'status', targetExamId
      });
      if (statusRes.questions) {
        const noExp = [], hasExp = [];
        statusRes.questions.forEach(q => {
          (q.has_explanation ? hasExp : noExp).push(q);
        });
        setImportedList(noExp);
        setDoneList(hasExp);
      }
    } catch (err) {
      addLog('error', '이관 실패: ' + err.message);
      toast('이관 실패: ' + err.message, 'error');
    }
    setTimeout(() => setProgress(null), 3000);
  };

  // ─── 해설 생성 ───
  const generateExplanations = async () => {
    const ids = checkedImported.size > 0
      ? importedList.filter(q => checkedImported.has(q.id || q.sourceId))
      : importedList;
    if (ids.length === 0) return;

    const modelMap = { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini', claude: 'claude-sonnet-4-20250514' };
    if (!confirm(`${ids.length}개 문제의 해설을 생성하시겠습니까?\nAI API를 호출합니다.`)) return;

    let done = 0;
    setProgress({ text: `해설 생성 중... (0/${ids.length})`, percent: 0 });

    for (const q of ids) {
      const qId = q.id || q.sourceId;
      try {
        await apiPost('/api/import-docstore', {
          action: 'generate-explanation', questionId: qId,
          provider: llmProvider, model: modelMap[llmProvider]
        });
        done++;
        setProgress({ text: `해설 생성 중... (${done}/${ids.length})`, percent: Math.round(done / ids.length * 100) });
        addLog('success', `#${q.number || qId} 해설 생성 완료`);

        // imported → done 이동
        setImportedList(prev => prev.filter(x => (x.id || x.sourceId) !== qId));
        setDoneList(prev => [...prev, q]);
      } catch (err) {
        addLog('error', `#${q.number || qId} 해설 생성 실패: ${err.message}`);
      }
    }
    setProgress({ text: `해설 생성 완료! (${done}/${ids.length})`, percent: 100 });
    setCheckedImported(new Set());
    toast(`해설 ${done}개 생성 완료`, 'success');
    setTimeout(() => setProgress(null), 3000);
  };

  // ─── 소스 삭제 ───
  const deleteFromSource = async () => {
    const ids = checkedWait.size > 0 ? [...checkedWait] : [];
    if (ids.length === 0) { toast('삭제할 문제를 선택하세요.', 'warn'); return; }
    if (!confirm(`${ids.length}개 문제를 소스(docstore)에서 삭제하시겠습니까?\n복구 불가능합니다.`)) return;
    try {
      const res = await apiPost('/api/import-docstore', { action: 'delete-questions', questionIds: ids });
      setWaitQueue(prev => prev.filter(q => !ids.includes(q.sourceId)));
      setCheckedWait(new Set());
      addLog('info', `${res.deleted}개 문제 소스에서 삭제`);
      toast(`${res.deleted}개 문제 삭제`, 'success');
      // 빈 시험 그룹 제거
      if (res.deletedExams?.length) {
        setSourceExams(prev => prev.filter(e => !res.deletedExams.includes(e.id)));
        if (res.deletedExams.includes(Number(selectedExam))) {
          setSelectedExam(''); setWaitQueue([]);
        }
      }
    } catch (err) {
      addLog('error', '삭제 실패: ' + err.message);
      toast('삭제 실패: ' + err.message, 'error');
    }
  };

  // 체크박스 헬퍼
  const toggleCheck = (set, setFn, id) => {
    setFn(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAllWait = (checked) => setCheckedWait(checked ? new Set(waitQueue.map(q => q.sourceId)) : new Set());
  const toggleAllImported = (checked) => setCheckedImported(checked ? new Set(importedList.map(q => q.id || q.sourceId)) : new Set());

  // 컬럼 토글
  const toggleCol = (key) => setCollapsedCols(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleAll = () => {
    const allCollapsed = STEPS.every(s => collapsedCols[s.key]);
    const next = {};
    STEPS.forEach(s => { next[s.key] = !allCollapsed; });
    setCollapsedCols(next);
  };

  const columns = [
    { ...STEPS[0], items: waitQueue, idKey: 'sourceId' },
    { ...STEPS[1], items: importedList, idKey: 'id' },
    { ...STEPS[2], items: doneList, idKey: 'id' },
  ];

  return (
    <div className="space-y-4 fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-text">DocStore 연동</h2>
        <select value={selectedExam} onChange={e => onExamChange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary transition-all min-w-[180px]">
          <option value="">소스 시험 선택</option>
          {sourceExams.map(e => (
            <option key={e.id} value={e.id}>
              {e.title || ''} {e.year || ''} {e.round ? e.round + '회' : ''} ({e.question_count}문항)
            </option>
          ))}
        </select>
      </div>

      {/* 진행 상태 바 */}
      {progress && (
        <div className="bg-card-bg border border-border rounded-xl px-4 py-3 fade-in">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text">{progress.text}</span>
            <span className="text-xs text-text-secondary">{progress.percent}%</span>
          </div>
          <div className="w-full h-2 bg-badge-bg rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: progress.percent + '%' }} />
          </div>
        </div>
      )}

      {/* 단계 표시 + 전체 토글 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {STEPS.map((s, i) => (
            <span key={s.key} className="text-xs font-bold" style={{ color: s.color }}>{i + 1}.{s.label}</span>
          ))}
        </div>
        <button onClick={toggleAll}
          className="text-xs text-text-secondary font-medium px-2 py-1 rounded-lg border border-border hover:bg-card-bg-hover transition-all">
          {STEPS.every(s => collapsedCols[s.key]) ? '전체 펼치기' : '전체 접기'}
        </button>
      </div>

      {/* 칸반 컬럼 */}
      <div className="space-y-3">
        {columns.map((col, ci) => (
          <div key={col.key} className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-card">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-card-bg-hover transition-colors"
              style={{ borderTop: `3px solid ${col.color}` }} onClick={() => toggleCol(col.key)}>
              <span className="flex items-center gap-2 text-sm font-bold text-text">
                <svg className={`w-3 h-3 transition-transform ${collapsedCols[col.key] ? '-rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {col.icon} {col.label}
              </span>
              <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: col.color }}>{col.items.length}</span>
            </div>

            {/* 툴바 (대상조회) */}
            {col.key === 'wait' && !collapsedCols[col.key] && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border flex-wrap" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={waitQueue.length > 0 && checkedWait.size === waitQueue.length}
                  onChange={e => toggleAllWait(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-xs min-w-[100px]">
                  <option value="">카테고리</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input value={examTitle} onChange={e => setExamTitle(e.target.value)} placeholder="시험 이름 (예: 2026년 1회차)"
                  autoCapitalize="none" autoCorrect="off" autoComplete="off"
                  className="flex-1 min-w-[120px] px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-xs" />
                <button onClick={importQuestions} disabled={waitQueue.length === 0}
                  className="px-2 py-1 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-colors" style={{ background: STEPS[1].color }}>
                  문제이관
                </button>
                <button onClick={deleteFromSource} disabled={checkedWait.size === 0}
                  className="px-2 py-1 rounded-lg bg-danger text-white text-xs font-bold disabled:opacity-40 hover:bg-danger-hover transition-colors">
                  소스삭제
                </button>
              </div>
            )}

            {/* 툴바 (문제이관) */}
            {col.key === 'imported' && !collapsedCols[col.key] && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-border flex-wrap" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={importedList.length > 0 && checkedImported.size === importedList.length}
                  onChange={e => toggleAllImported(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
                <select value={llmProvider} onChange={e => setLlmProvider(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-border bg-input-bg text-text text-xs">
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
                <button onClick={generateExplanations} disabled={importedList.length === 0}
                  className="px-2 py-1 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-colors" style={{ background: STEPS[1].color }}>
                  해설생성
                </button>
              </div>
            )}

            {/* 카드 목록 */}
            {!collapsedCols[col.key] && (
              <div className="px-3 pb-3 max-h-[50vh] overflow-y-auto space-y-1.5">
                {col.items.length === 0 ? (
                  <p className="text-center text-xs text-text-secondary py-6">
                    {col.key === 'wait' ? '소스 시험을 선택하세요' : '항목 없음'}
                  </p>
                ) : col.items.map(q => {
                  const qId = q[col.idKey] || q.sourceId || q.id;
                  const isChecked = col.key === 'wait' ? checkedWait.has(qId) : col.key === 'imported' ? checkedImported.has(qId) : false;
                  return (
                    <div key={qId} className="flex items-center gap-2 px-3 py-2 bg-badge-bg rounded-xl">
                      {(col.key === 'wait' || col.key === 'imported') && (
                        <input type="checkbox" checked={isChecked}
                          onChange={() => col.key === 'wait' ? toggleCheck(checkedWait, setCheckedWait, qId) : toggleCheck(checkedImported, setCheckedImported, qId)}
                          className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0" />
                      )}
                      <span className="text-xs font-bold text-primary">#{q.number}</span>
                      <span className="text-xs text-text truncate flex-1">{String(q.body || '').substring(0, 40)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ color: col.color, background: `${col.color}15` }}>
                        {['①','②','③','④','⑤'][q.answer - 1] || '?'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 처리 로그 */}
      <div className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-card">
        <button onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-bg-hover transition-colors">
          <span className="text-sm font-bold text-text flex items-center gap-2">
            📋 처리 로그 <span className="text-xs text-text-secondary font-normal">({logs.length}건)</span>
          </span>
          <svg className={`w-3 h-3 transition-transform ${showLog ? '' : '-rotate-90'}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {showLog && (
          <div className="px-4 pb-3 space-y-1 max-h-48 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-4">로그 없음</p>
            ) : logs.map((l, i) => (
              <div key={i} className={`text-xs px-2 py-1 rounded ${
                l.type === 'error' ? 'text-danger bg-red-50' :
                l.type === 'success' ? 'text-success bg-green-50' : 'text-primary bg-blue-50'
              }`}>[{l.time}] {l.message}</div>
            ))}
            {logs.length > 0 && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => { navigator.clipboard.writeText(logs.map(l => `[${l.time}] [${l.type}] ${l.message}`).join('\n')); toast('로그 복사됨', 'info'); }}
                  className="text-[10px] text-primary font-semibold">복사</button>
                <button onClick={() => setLogs([])} className="text-[10px] text-text-secondary">초기화</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
