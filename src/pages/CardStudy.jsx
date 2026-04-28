// 카드 학습 — 플래시카드 방식 + 풀스크린 몰입 모드 + 스와이프 제스처
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import ErrorCard from '../components/ui/ErrorCard';
import MultiSelect from '../components/ui/MultiSelect';
import useFilterState from '../hooks/useFilterState';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import QuizCard from '../tabs/QuizTab/QuizCard';
import shuffle from '../lib/shuffle';

export default function CardStudy() {
  const navigate = useNavigate();

  // 모드: setup(조건 선택) / study(학습)
  const [mode, setMode] = useState('setup');
  const [fullscreen, setFullscreen] = useState(false);

  // setup 상태
  const [meta, setMeta] = useState({ categories: [], exams: [] });
  const { categoryIds, setCategoryIds, examIds, setExamIds } = useFilterState('card');
  const [metaLoading, setMetaLoading] = useState(true);
  const [error, setError] = useState(null);

  // study 상태
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // 스와이프 제스처
  const touchRef = useRef({ startX: 0, startY: 0 });

  // 메타 데이터 로드
  const loadMeta = useCallback(() => {
    setError(null);
    setMetaLoading(true);
    apiPost('/api/questions', { action: 'meta' })
      .then(data => setMeta(data))
      .catch(() => setError('메타 데이터를 불러오지 못했습니다.'))
      .finally(() => setMetaLoading(false));
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // 카테고리별 시험 필터
  const filteredExams = categoryIds.length > 0
    ? (meta.exams || []).filter(e => categoryIds.includes(String(e.category_id)))
    : (meta.exams || []);

  // 시작 버튼 핸들러
  const handleStart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/questions?page=1&limit=500';
      if (categoryIds.length > 0) url += `&category_id=${categoryIds.join(',')}`;
      if (examIds.length > 0) url += `&exam_id=${examIds.join(',')}`;
      const data = await apiGet(url);
      const items = data.questions || [];
      if (items.length === 0) { setError('문제가 없습니다. 필터를 변경해보세요.'); return; }
      setQuestions(shuffle(items));
      setCurrentIndex(0);
      setMode('study');
      setFullscreen(true);
    } catch {
      setError('문제를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [categoryIds, examIds]);

  // 이전/다음 문제 이동
  const goPrev = useCallback(() => setCurrentIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1)), [questions.length]);

  // 스와이프 핸들러
  const onTouchStart = (e) => {
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    // 수평 스와이프가 수직보다 크고 최소 60px 이상일 때만 동작
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx > 0) goPrev(); else goNext();
    }
  };

  // 풀스크린 토글 시 헤더/네비 숨김
  useEffect(() => {
    const header = document.querySelector('header');
    const nav = document.querySelector('nav[aria-label]');
    const main = document.querySelector('main');
    if (fullscreen && mode === 'study') {
      if (header) header.style.display = 'none';
      if (nav) nav.style.display = 'none';
      if (main) {
        main.style.paddingLeft = '8px';
        main.style.paddingRight = '8px';
        main.style.paddingBottom = '8px';
        main.style.paddingTop = 'max(12px, env(safe-area-inset-top, 12px))';
        main.style.maxWidth = '100%';
      }
    }
    return () => {
      if (header) header.style.display = '';
      if (nav) nav.style.display = '';
      if (main) {
        main.style.padding = '';
        main.style.maxWidth = '';
      }
    };
  }, [fullscreen, mode]);

  // setup으로 돌아갈 때 풀스크린 해제
  const exitStudy = () => { setMode('setup'); setFullscreen(false); };

  const catName = categoryIds.length === 1
    ? ((meta.categories || []).find(c => String(c.id) === categoryIds[0])?.name || '')
    : '';
  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // === setup 모드 ===
  if (mode === 'setup') {
    return (
      <div className="space-y-5 fade-in">
        <button onClick={() => navigate('/quiz')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          학습 허브
        </button>

        <h2 className="text-lg font-bold text-text">카드 학습</h2>

        {error && <ErrorCard message={error} onRetry={loadMeta} />}

        <Card className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-1.5">카테고리</label>
            {metaLoading ? <Skeleton className="h-10 w-full rounded-xl" /> : (
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
            {metaLoading ? <Skeleton className="h-10 w-full rounded-xl" /> : (
              <MultiSelect
                options={filteredExams}
                selected={examIds}
                onChange={setExamIds}
                placeholder="전체 시험"
              />
            )}
          </div>
        </Card>

        <button onClick={handleStart} disabled={loading || metaLoading}
          className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-all disabled:opacity-50 active:scale-[0.98]">
          학습 시작
        </button>
        <LoadingOverlay isOpen={loading} message="카드를 준비하고 있어요" />
      </div>
    );
  }

  // === study 모드 ===
  if (!currentQ) {
    return <ErrorCard message="문제가 없습니다." onRetry={exitStudy} />;
  }

  return (
    <div className="fade-in" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* 상단 바 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={exitStudy}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors" aria-label="학습 종료">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          나가기
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-secondary">
            {currentIndex + 1} / {questions.length}
          </span>
          {/* 풀스크린 토글 */}
          <button onClick={() => setFullscreen(f => !f)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-primary-light transition-all"
            aria-label={fullscreen ? '일반 모드' : '몰입 모드'}>
            {fullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4M9 15l-5 5m0 0h4m-4 0v-4m11-6l5-5m0 0h-4m4 0v4" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="w-full h-1.5 bg-border/30 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* 스와이프 힌트 (첫 문제일 때만) */}
      {currentIndex === 0 && questions.length > 1 && (
        <p className="text-center text-xs text-text-secondary/50 mb-2">좌우로 스와이프하여 이동</p>
      )}

      {/* 문제 카드 */}
      <QuizCard key={currentQ.id} question={currentQ} index={currentIndex + 1}
        isExpanded={true} onToggle={() => {}} categoryName={catName} />

      {/* 이전/다음 버튼 */}
      <div className="flex gap-3 mt-4">
        <button onClick={goPrev} disabled={currentIndex === 0}
          className="flex-1 py-3 rounded-xl border border-border text-text font-semibold text-sm hover:bg-card-bg-hover transition-all disabled:opacity-30 active:scale-[0.98]" aria-label="이전 문제">
          이전 문제
        </button>
        <button onClick={goNext} disabled={currentIndex === questions.length - 1}
          className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition-all disabled:opacity-30 active:scale-[0.98]" aria-label="다음 문제">
          다음 문제
        </button>
      </div>
    </div>
  );
}
