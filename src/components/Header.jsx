// 상단 헤더 — Quizlet 스타일 미니멀 디자인
import { getAuthUser } from '../lib/api';

export default function Header({ onLogout, theme, onToggleTheme }) {
  const user = getAuthUser();

  return (
    <header className="bg-card-bg border-b border-border px-4 pb-3 sticky top-0 z-40 shadow-sm safe-top">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {/* 로고 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-primary">AI Tutor</h1>
        </div>

        {/* 우측 액션 */}
        <div className="flex items-center gap-2.5">
          {user && (
            <span className="text-xs text-text-secondary font-medium hidden sm:inline">
              {user.name}
            </span>
          )}

          {/* 다크모드 토글 */}
          <button
            onClick={onToggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary
              hover:text-text hover:bg-card-bg-hover transition-all"
            title={theme === 'light' ? '다크모드' : '라이트모드'}
          >
            {theme === 'light' ? (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          {/* 로그아웃 */}
          <button
            onClick={onLogout}
            className="text-xs text-text-secondary hover:text-danger border border-border
              rounded-lg px-2.5 py-1.5 transition-colors font-medium"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
