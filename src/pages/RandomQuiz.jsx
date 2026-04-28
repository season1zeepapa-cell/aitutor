// 랜덤 학습 — 조건 선택 후 무작위 출제
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import MultiSelect from '../components/ui/MultiSelect';
import useFilterState from '../hooks/useFilterState';
import QuizCard from '../tabs/QuizTab/QuizCard';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import shuffle from '../lib/shuffle';

// ─── 수평 카운터 휠 피커 (계기판 스타일 — 컴팩트) ───
const ITEM_W = 36; // 각 숫자 칸 너비(px)
const PICKER_H = 48; // 피커 높이(px)

function CountPicker({ value, onChange, max }) {
  const scrollRef = useRef(null);
  const skipRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current || max < 1) return;
    const idx = Math.max(0, Math.min(max - 1, value - 1));
    const target = idx * ITEM_W;
    if (Math.abs(scrollRef.current.scrollLeft - target) < 2) return;
    skipRef.current = true;
    scrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
    setTimeout(() => { skipRef.current = false; }, 400);
  }, [value, max]);

  const handleScroll = () => {
    if (skipRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollLeft / ITEM_W);
      const v = Math.max(1, Math.min(max, idx + 1));
      if (v !== value) onChange(v);
    }, 80);
  };

  if (max < 1) return (
    <div className="text-center py-4 text-text-secondary text-sm">문제가 없습니다</div>
  );

  return (
    <div className="flex items-center gap-3">
      {/* 피커 영역 */}
      <div className="flex-1 min-w-0">
        {/* ▼ 삼각형 바늘 */}
        <div className="flex justify-center mb-0.5">
          <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid var(--primary)' }} />
        </div>

        {/* 피커 본체 */}
        <div className="relative rounded-xl overflow-hidden"
          style={{ height: PICKER_H, border: '1px solid var(--border)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
          {/* 강조 밴드 */}
          <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 z-10 pointer-events-none bg-primary/10 border-x-2 border-primary/40"
            style={{ width: ITEM_W + 4 }} />

          <div className="h-full overflow-hidden">
            <div ref={scrollRef} onScroll={handleScroll} className="flex items-center"
              style={{
                height: 'calc(100% + 20px)', overflowX: 'scroll', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
                maskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
              }}>
              <div className="flex-shrink-0" style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} />
              {Array.from({ length: max }, (_, i) => {
                const n = i + 1;
                const isMajor = n % 5 === 0 || n === 1 || n === max;
                return (
                  <div key={n} className="flex-shrink-0 flex flex-col items-center justify-center select-none"
                    style={{ width: ITEM_W, height: PICKER_H, scrollSnapAlign: 'center' }}>
                    <span className={`leading-none ${isMajor ? 'text-xs font-bold text-text' : 'text-[10px] font-medium text-text-secondary/40'}`}>{n}</span>
                    <div className={`mt-0.5 rounded-full ${isMajor ? 'w-[1.5px] h-2 bg-text/25' : 'w-px h-1 bg-text-secondary/15'}`} />
                  </div>
                );
              })}
              <div className="flex-shrink-0" style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} />
            </div>
          </div>
        </div>

        {/* ▲ 하단 삼각형 */}
        <div className="flex justify-center mt-0.5">
          <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid var(--primary)' }} />
        </div>
      </div>

      {/* 선택값 표시 */}
      <div className="flex-shrink-0 text-right" style={{ minWidth: 64 }}>
        <span className="text-2xl font-black text-primary">{value}</span>
        <span className="text-xs text-text-secondary ml-0.5 font-semibold">문제</span>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───
export default function RandomQuiz() {
  const navigate = useNavigate();

  // 모드: setup(조건 선택) / quiz(풀이)
  const [mode, setMode] = useState('setup');

  // setup 상태
  const [meta, setMeta] = useState({ categories: [], exams: [] });
  const { categoryIds, setCategoryIds, examIds, setExamIds } = useFilterState('random');
  const [count, setCount] = useState(5);
  const [metaLoading, setMetaLoading] = useState(true);
  const [totalAvailable, setTotalAvailable] = useState(0);

  // quiz 상태
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // 메타 데이터 로드
  useEffect(() => {
    apiPost('/api/questions', { action: 'meta' })
      .then(data => setMeta(data))
      .catch(err => console.error('[Random] 메타 로드 실패:', err))
      .finally(() => setMetaLoading(false));
  }, []);

  // 카테고리/시험 변경 시 전체 문제 수 조회
  useEffect(() => {
    let url = '/api/questions?page=1&limit=1';
    if (categoryIds.length > 0) url += `&category_id=${categoryIds.join(',')}`;
    if (examIds.length > 0) url += `&exam_id=${examIds.join(',')}`;
    apiGet(url)
      .then(data => {
        const total = data.total || 0;
        setTotalAvailable(total);
        // 현재 선택값이 전체보다 크면 조정
        setCount(prev => total > 0 && prev > total ? total : prev);
      })
      .catch(() => setTotalAvailable(0));
  }, [categoryIds, examIds]);

  // 카테고리별 시험 필터
  const filteredExams = categoryIds.length > 0
    ? (meta.exams || []).filter(e => categoryIds.includes(String(e.category_id)))
    : (meta.exams || []);

  // 시작 버튼 핸들러
  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/questions?page=1&limit=500';
      if (categoryIds.length > 0) url += `&category_id=${categoryIds.join(',')}`;
      if (examIds.length > 0) url += `&exam_id=${examIds.join(',')}`;
      const data = await apiGet(url);
      const items = data.questions || [];

      const shuffled = shuffle(items);
      const sliced = shuffled.slice(0, count);

      setQuestions(sliced);
      setMode('quiz');
    } catch (err) {
      console.error('[Random] 문제 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryIds, examIds, count]);

  // 카드 펼치기/접기
  const toggleCard = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // 카테고리 이름 (AI 해설용)
  const catName = categoryIds.length === 1
    ? ((meta.categories || []).find(c => String(c.id) === categoryIds[0])?.name || '')
    : '';

  // === setup 모드 ===
  if (mode === 'setup') {
    return (
      <div className="space-y-5 fade-in">
        {/* 뒤로가기 */}
        <button
          onClick={() => navigate('/quiz')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          학습 허브
        </button>

        <h2 className="text-lg font-bold text-text">랜덤 학습</h2>

        {/* 카테고리/시험 선택 */}
        <Card className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">카테고리</label>
            {metaLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <MultiSelect
                options={meta.categories || []}
                selected={categoryIds}
                onChange={setCategoryIds}
                placeholder="전체 카테고리"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">시험</label>
            {metaLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <MultiSelect
                options={filteredExams}
                selected={examIds}
                onChange={setExamIds}
                placeholder="전체 시험"
              />
            )}
          </div>

          {/* 문제 수 — 수평 카운터 휠 피커 */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">문제 수</label>
            {totalAvailable > 0 ? (
              <CountPicker
                value={count}
                onChange={v => setCount(v)}
                max={totalAvailable}
              />
            ) : (
              <Skeleton className="h-24 w-full rounded-2xl" />
            )}
          </div>
        </Card>

        {/* 시작 버튼 */}
        <button
          onClick={handleStart}
          disabled={loading || totalAvailable < 1}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base
            hover:bg-primary-dark transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          학습 시작
        </button>
        <LoadingOverlay isOpen={loading} message="문제를 준비하고 있어요" />
      </div>
    );
  }

  // === quiz 모드 ===
  return (
    <div className="space-y-4 fade-in">
      {/* 상단 바 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMode('setup')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          다시 설정
        </button>
        <span className="text-sm font-semibold text-text-secondary">
          {questions.length}문항 (랜덤)
        </span>
      </div>

      {/* 문제 카드 목록 */}
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <QuizCard
            key={q.id}
            question={q}
            index={idx + 1}
            isExpanded={expandedId === q.id}
            onToggle={() => toggleCard(q.id)}
            categoryName={catName}
          />
        ))}
      </div>
    </div>
  );
}
