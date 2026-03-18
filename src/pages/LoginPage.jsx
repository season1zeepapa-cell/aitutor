// 로그인 페이지 — Quizlet 스타일 클린 디자인
import { useState } from 'react';
import { apiFetch, setAuthToken, setAuthUser } from '../lib/api';

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

      // 로그인 성공 — API 응답: { token, name, admin }
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md slide-up">
        {/* 로고 영역 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-text">AI Tutor</h1>
          <p className="mt-2 text-text-secondary text-sm">AI 기반 학습 플랫폼</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-card-bg rounded-2xl border border-border shadow-card p-8">
          <h2 className="text-xl font-bold text-text mb-6">
            {isSignup ? '회원가입' : '로그인'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1.5">아이디</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                required
                className="w-full px-4 py-3 rounded-xl border border-border bg-input-bg text-text
                  placeholder:text-text-secondary/50 focus:outline-none focus:border-primary
                  focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-secondary mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-input-bg text-text
                    placeholder:text-text-secondary/50 focus:outline-none focus:border-primary
                    focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-danger rounded-xl px-4 py-3 text-sm fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gradient py-3.5 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
            >
              {isSignup ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
