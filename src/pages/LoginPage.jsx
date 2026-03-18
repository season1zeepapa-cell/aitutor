// 로그인 페이지 — 카드 없는 미니멀 디자인 + unDraw 일러스트
import { useState } from 'react';
import { apiFetch, setAuthToken, setAuthUser } from '../lib/api';

// unDraw 교육 일러스트 SVG URL
const ILLUSTRATION_URL = 'https://cdn.undraw.co/illustration/reading-notes_dg9z.svg';

export default function LoginPage({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = isSignup ? '/api/signup' : '/api/login';
      const body = isSignup
        ? { username, password }
        : { id: username, password };
      const res = await apiFetch(url, { method: 'POST', body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (isSignup ? '회원가입 실패' : '로그인 실패'));
      }

      if (isSignup) {
        setIsSignup(false);
        setError('');
        setPassword('');
        return;
      }

      setAuthToken(data.token);
      setAuthUser({ name: data.name || username, admin: !!data.admin });
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm slide-up">

        {/* 일러스트 */}
        <div className="flex justify-center mb-8">
          <img
            src={ILLUSTRATION_URL}
            alt="학습 일러스트"
            className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
          />
        </div>

        {/* 로고 + 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-text">AI Tutor</h1>
          <p className="mt-1.5 text-text-secondary text-sm">AI 기반 학습 플랫폼</p>
        </div>

        {/* 폼 (카드 없이 직접) */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디"
              autoComplete="username"
              required
              className="w-full px-4 py-3.5 rounded-2xl border border-border bg-card-bg text-text
                placeholder:text-text-secondary/50 focus:outline-none focus:border-primary
                focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              className="w-full px-4 py-3.5 pr-12 rounded-2xl border border-border bg-card-bg text-text
                placeholder:text-text-secondary/50 focus:outline-none focus:border-primary
                focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-danger rounded-2xl px-4 py-3 text-sm fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gradient py-3.5 text-sm font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중...
              </span>
            ) : (
              isSignup ? '회원가입' : '로그인'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsSignup(!isSignup); setError(''); }}
            className="text-sm text-text-secondary hover:text-primary font-medium transition-colors"
          >
            {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
}
