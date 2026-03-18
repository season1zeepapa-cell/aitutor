// DocStore 연동 탭 — 칸반 보드
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';

const STEPS = [
  { key: 'wait', label: '대상조회', color: '#4255ff', icon: '📋' },
  { key: 'imported', label: '문제이관', color: '#f59e0b', icon: '📥' },
  { key: 'done', label: '해설생성 및 완료', color: '#22c55e', icon: '✅' },
];

export default function ImportTab() {
  const [sourceExams, setSourceExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [waitQueue, setWaitQueue] = useState([]);
  const [importedList, setImportedList] = useState([]);
  const [doneList, setDoneList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [collapsedCols, setCollapsedCols] = useState({});

  // 소스 시험 목록 로드
  useEffect(() => {
    apiGet('/api/import-docstore')
      .then(data => {
        setSourceExams((data.exams || []).filter(e => e.question_count > 0));
      })
      .catch(() => {});
    apiGet('/api/categories')
      .then(data => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // 소스 시험 선택 → 문제 로드
  const onExamChange = async (examId) => {
    setSelectedExam(examId);
    setWaitQueue([]);
    setImportedList([]);
    setDoneList([]);
    if (!examId) return;

    setLoading(true);
    try {
      const data = await apiGet(`/api/import-docstore?examId=${examId}`);
      setWaitQueue((data.questions || []).map(q => ({
        sourceId: q.id, number: q.question_number, body: q.body,
        answer: q.answer, choices: q.choices, explanation: q.explanation,
      })));
    } catch (err) {
      console.error('[Import] 문제 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 컬럼 접기/펼치기
  const toggleCol = (key) => {
    setCollapsedCols(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 전체 접기/펼치기
  const toggleAll = () => {
    const allCollapsed = STEPS.every(s => collapsedCols[s.key]);
    const next = {};
    STEPS.forEach(s => { next[s.key] = !allCollapsed; });
    setCollapsedCols(next);
  };

  const columns = [
    { ...STEPS[0], items: waitQueue },
    { ...STEPS[1], items: importedList },
    { ...STEPS[2], items: doneList },
  ];

  return (
    <div className="space-y-4 fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-text">DocStore 연동</h2>
        <select value={selectedExam} onChange={e => onExamChange(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-sm
            focus:outline-none focus:border-primary transition-all min-w-[180px]">
          <option value="">소스 시험 선택</option>
          {sourceExams.map(e => (
            <option key={e.id} value={e.id}>
              {e.title || ''} {e.year || ''} {e.round ? e.round + '회' : ''} ({e.question_count}문항)
            </option>
          ))}
        </select>
      </div>

      {/* 단계 표시 + 전체 토글 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {STEPS.map((s, i) => (
            <span key={s.key} className="text-xs font-bold" style={{ color: s.color }}>
              {i + 1}.{s.label}
            </span>
          ))}
        </div>
        <button onClick={toggleAll}
          className="text-xs text-text-secondary font-medium px-2 py-1 rounded-lg border border-border hover:bg-card-bg-hover transition-all">
          {STEPS.every(s => collapsedCols[s.key]) ? '전체 펼치기' : '전체 접기'}
        </button>
      </div>

      {/* 칸반 컬럼 */}
      <div className="space-y-3">
        {columns.map(col => (
          <div key={col.key} className="bg-card-bg border border-border rounded-2xl overflow-hidden shadow-card">
            {/* 헤더 */}
            <button onClick={() => toggleCol(col.key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-bg-hover transition-colors"
              style={{ borderTop: `3px solid ${col.color}` }}>
              <span className="flex items-center gap-2 text-sm font-bold text-text">
                <svg className={`w-3 h-3 transition-transform ${collapsedCols[col.key] ? '-rotate-90' : ''}`}
                  fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {col.icon} {col.label}
              </span>
              <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: col.color }}>
                {col.items.length}
              </span>
            </button>

            {/* 바디 */}
            {!collapsedCols[col.key] && (
              <div className="px-3 pb-3 max-h-[50vh] overflow-y-auto space-y-2">
                {col.items.length === 0 ? (
                  <p className="text-center text-xs text-text-secondary py-6">
                    {col.key === 'wait' ? '소스 시험을 선택하세요' : '항목 없음'}
                  </p>
                ) : col.items.map(q => (
                  <div key={q.sourceId || q.id}
                    className="flex items-center gap-2 px-3 py-2 bg-badge-bg rounded-xl">
                    <span className="text-xs font-bold text-primary">#{q.number}</span>
                    <span className="text-xs text-text truncate flex-1">{String(q.body || '').substring(0, 40)}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ color: col.color, background: `${col.color}15` }}>
                      {['①','②','③','④','⑤'][q.answer - 1] || '?'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
