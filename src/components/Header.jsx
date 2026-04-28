// 상단 헤더 — 로고 + 응원 문구 + 다크모드 + 로그아웃
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAuthUser } from '../lib/api';

const CHEERS = [
  '힘내세요!', '화이팅!', '가즈아!', '오늘도 열공!',
  '할 수 있어요!', '파이팅!', '최고예요!', '대박 나세요!',
  '합격 기원!', '꾸준히!', '한 문제 더!', '거의 다 왔어요!',
  '포기하지 마세요!', '실력 UP!', '오늘의 목표 달성!',
  '천리길도 한 걸음!', '끝까지!', '자신감 MAX!',
];

export default function Header({ onLogout, theme, onToggleTheme }) {
  const user = getAuthUser();
  const location = useLocation();
  const [cheer, setCheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]);

  // 페이지 이동 시 문구 변경
  useEffect(() => {
    setCheer(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  }, [location.pathname]);

  return (
    <header className="bg-card-bg border-b border-border px-4 pt-1 pb-2 sticky top-0 z-40 shadow-sm safe-top">
      <div className="max-w-3xl mx-auto">
        {/* 1줄: 로고 + 응원 문구 + 이름 */}
        <div className="flex items-center justify-between">
          <a
            href="/quiz"
            onClick={(e) => { e.preventDefault(); window.location.href = '/quiz'; }}
            className="flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-primary">AI TutorTwo</h1>
          </a>
          {user && (
            <span className="text-xs font-medium">
              <span className="text-primary">{cheer}</span>
              <span className="text-text-secondary ml-1">{user.name}님</span>
            </span>
          )}
        </div>

        {/* 2줄: 다크모드 + 로그아웃 (우측 정렬) */}
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <button onClick={onToggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text hover:bg-card-bg-hover transition-all"
            title={theme === 'light' ? '다크모드' : '라이트모드'}
            aria-label={theme === 'light' ? '다크모드로 전환' : '라이트모드로 전환'}>
            {theme === 'light' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <button onClick={onLogout}
            className="text-[11px] text-text-secondary hover:text-danger border border-border rounded-lg px-2 py-1 transition-colors font-medium"
            aria-label="로그아웃">
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
