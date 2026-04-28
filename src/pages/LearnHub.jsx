// 학습 허브 — 대시보드 + 학습 유형 선택 페이지
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';
import Card from '../components/ui/Card';
import { useTutorial } from '../App';

export default function LearnHub() {
  const navigate = useNavigate();
  const { openGuide } = useTutorial();
  const [meta, setMeta] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);

  // 메타 데이터 + 총 문제수 로드
  useEffect(() => {
    Promise.all([
      apiPost('/api/questions', { action: 'meta' }),
      apiGet('/api/questions?page=1&limit=1'),
    ])
      .then(([metaData, qData]) => {
        setMeta(metaData);
        setTotalQuestions(qData.total || 0);
      })
      .catch(err => console.error('[LearnHub] 데이터 로드 실패:', err))
      .finally(() => setLoading(false));
  }, []);

  // 통계 수치 계산
  const totalCategories = meta?.categories?.length || 0;
  const totalExams = meta?.exams?.length || 0;

  // 학습 유형 카드 정의
  const studyTypes = [
    {
      title: '카테고리 학습',
      desc: '카테고리·시험별로 문제를 순서대로 풀어보세요',
      path: '/quiz/category',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '랜덤 학습',
      desc: '무작위로 섞인 문제로 실전처럼 연습하세요',
      path: '/quiz/random',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: '카드 학습',
      desc: '한 문제씩 집중해서 플래시카드로 학습하세요',
      path: '/quiz/card',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: '북마크 학습',
      desc: '즐겨찾기한 문제만 모아서 복습하세요',
      path: '/quiz/bookmark',
      icon: (
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: '모의고사',
      desc: '제한 시간 내 풀고 자동 채점받으세요',
      path: '/quiz/exam',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-6 fade-in">
      {/* 학습 유형 — 헤더 옆에 인라인 통계 칩 (REBUILD16: 상단 3칼럼 대시보드 제거, 컨텍스트 인라인화) */}
      <div>
        <div className="flex items-start sm:items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold text-text">학습 유형</h2>
            {loading ? (
              <span className="text-[11px] text-text-secondary opacity-60">불러오는 중…</span>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-text-secondary" aria-label="학습 통계">
                <span><b className="text-primary text-xs font-bold">{totalCategories}</b> 카테고리</span>
                <span className="opacity-40">·</span>
                <span><b className="text-primary text-xs font-bold">{totalExams}</b> 시험</span>
                <span className="opacity-40">·</span>
                <span><b className="text-primary text-xs font-bold">{totalQuestions.toLocaleString()}</b> 문제</span>
              </div>
            )}
          </div>
          <button
            onClick={() => openGuide('general')}
            className="text-[11px] px-2.5 py-1 rounded-full bg-card-bg border border-primary/40 text-primary font-semibold hover:bg-primary hover:text-white transition-colors"
            aria-label="기출문제 학습 가이드 열기"
          >
            ❓ 가이드
          </button>
        </div>
        <div className="space-y-3">
          {studyTypes.map(st => (
            <button
              key={st.path}
              onClick={() => navigate(st.path)}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-4 p-4 hover:border-primary/40 transition-all cursor-pointer active:scale-[0.98]">
                <div className={`p-3 rounded-xl ${st.bgColor} ${st.color}`}>
                  {st.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text">{st.title}</p>
                  <p className="text-sm text-text-secondary mt-0.5">{st.desc}</p>
                </div>
                <svg className="w-5 h-5 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
