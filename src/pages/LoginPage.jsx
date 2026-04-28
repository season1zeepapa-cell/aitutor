// 로그인 페이지 — 이메일 기반 인증 + 카드 없는 미니멀 디자인
import { useState, useEffect, useCallback } from 'react';
import { setAuthUser } from '../lib/api';

// 학습 일러스트 (인라인 SVG — 외부 CDN 의존 제거)
function StudyIllustration({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 책상 */}
      <rect x="30" y="110" width="140" height="8" rx="4" fill="var(--primary, #4255ff)" opacity="0.15" />
      {/* 책 1 — 펼쳐진 책 */}
      <path d="M60 108 L100 95 L140 108" stroke="var(--primary, #4255ff)" strokeWidth="2" fill="none" />
      <rect x="62" y="85" width="35" height="25" rx="2" fill="var(--primary, #4255ff)" opacity="0.12" />
      <rect x="103" y="85" width="35" height="25" rx="2" fill="var(--primary, #4255ff)" opacity="0.08" />
      {/* 책 페이지 줄 */}
      <line x1="68" y1="92" x2="90" y2="92" stroke="var(--primary, #4255ff)" strokeWidth="1" opacity="0.3" />
      <line x1="68" y1="97" x2="88" y2="97" stroke="var(--primary, #4255ff)" strokeWidth="1" opacity="0.25" />
      <line x1="68" y1="102" x2="85" y2="102" stroke="var(--primary, #4255ff)" strokeWidth="1" opacity="0.2" />
      <line x1="110" y1="92" x2="132" y2="92" stroke="var(--primary, #4255ff)" strokeWidth="1" opacity="0.3" />
      <line x1="110" y1="97" x2="130" y2="97" stroke="var(--primary, #4255ff)" strokeWidth="1" opacity="0.25" />
      {/* 쌓인 책들 */}
      <rect x="145" y="92" width="22" height="6" rx="1" fill="var(--primary, #4255ff)" opacity="0.25" transform="rotate(-5 145 92)" />
      <rect x="144" y="84" width="24" height="6" rx="1" fill="var(--primary, #4255ff)" opacity="0.35" transform="rotate(2 144 84)" />
      <rect x="143" y="76" width="26" height="6" rx="1" fill="var(--primary, #4255ff)" opacity="0.2" transform="rotate(-3 143 76)" />
      {/* 전구 아이콘 — 학습/아이디어 */}
      <circle cx="100" cy="40" r="18" fill="var(--primary, #4255ff)" opacity="0.1" />
      <circle cx="100" cy="40" r="12" stroke="var(--primary, #4255ff)" strokeWidth="2" fill="none" opacity="0.6" />
      <line x1="100" y1="52" x2="100" y2="58" stroke="var(--primary, #4255ff)" strokeWidth="2" opacity="0.4" />
      <line x1="96" y1="55" x2="104" y2="55" stroke="var(--primary, #4255ff)" strokeWidth="1.5" opacity="0.3" />
      {/* 빛 효과 */}
      <line x1="100" y1="20" x2="100" y2="14" stroke="var(--primary, #4255ff)" strokeWidth="1.5" opacity="0.3" />
      <line x1="116" y1="28" x2="121" y2="24" stroke="var(--primary, #4255ff)" strokeWidth="1.5" opacity="0.3" />
      <line x1="84" y1="28" x2="79" y2="24" stroke="var(--primary, #4255ff)" strokeWidth="1.5" opacity="0.3" />
      <line x1="120" y1="40" x2="126" y2="40" stroke="var(--primary, #4255ff)" strokeWidth="1.5" opacity="0.3" />
      <line x1="80" y1="40" x2="74" y2="40" stroke="var(--primary, #4255ff)" strokeWidth="1.5" opacity="0.3" />
      {/* 연필 */}
      <rect x="35" y="80" width="4" height="28" rx="1" fill="var(--primary, #4255ff)" opacity="0.3" transform="rotate(15 35 80)" />
      <polygon points="37,108 33,115 41,115" fill="var(--primary, #4255ff)" opacity="0.25" transform="rotate(15 37 112)" />
    </svg>
  );
}

// 타이머 포맷 (초 → MM:SS)
function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 비밀번호 보기/숨기기 토글 버튼
function PasswordToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text transition-colors"
      tabIndex={-1}
      aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
    >
      {show ? (
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
  );
}

// 공통 input 스타일
const inputCls = `w-full px-4 py-3.5 rounded-2xl border border-border bg-card-bg text-text
  placeholder:text-text-secondary/50 focus:outline-none focus:border-primary
  focus:ring-2 focus:ring-primary/20 transition-all text-sm`;

export default function LoginPage({ onLogin }) {
  // mode: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 회원가입 차단 여부 — 서버에서 fetch (관리자가 토글 가능)
  // null = 로딩 중(아직 결정 안 됨), true = 차단, false = 정상
  const [signupDisabled, setSignupDisabled] = useState(null);

  // 인증코드 타이머 (초)
  const [timer, setTimer] = useState(0);

  // 페이지 진입 시 1회: /api/config 로드 → signup_disabled 결정
  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        // 응답 실패 또는 누락 시 안전 기본값 = 차단 (실수로 가입 열리는 것 방지)
        setSignupDisabled(data?.signup_disabled !== false);
      })
      .catch(() => setSignupDisabled(true));
  }, []);

  // 타이머 카운트다운
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  // 모드 전환 시 상태 초기화
  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setStep(1);
    setEmail('');
    setPassword('');
    setName('');
    setCode('');
    setError('');
    setSuccess('');
    setShowPassword(false);
    setTimer(0);
  }, []);

  // --- API 호출 헬퍼 (로그인 전이므로 일반 fetch + credentials) ---
  // Lambda 콜드 스타트 대비: 404/502/503/504/네트워크 오류 발생 시 1회 자동 재시도
  const apiCall = async (url, body, retried = false) => {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      // 네트워크 오류 — 한 번 재시도
      if (!retried) {
        await new Promise(r => setTimeout(r, 1200));
        return apiCall(url, body, true);
      }
      throw networkErr;
    }
    // 콜드 스타트로 추정되는 상태코드(404/502/503/504)는 한 번 재시도
    if (!retried && [404, 502, 503, 504].includes(res.status)) {
      await new Promise(r => setTimeout(r, 1200));
      return apiCall(url, body, true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '요청 실패');
    return data;
  };

  // --- 로그인 처리 (이메일 + 인증코드) ---
  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/api/login', { email, code });
      setAuthUser({ name: data.name || email, admin: !!data.admin });
      // 쿠키 반영을 위해 페이지 새로고침
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 로그인 인증코드 발송 ---
  const handleSendLoginCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await apiCall('/api/send-verification', { email, type: 'login' });
      setSuccess('인증코드가 이메일로 발송되었습니다.');
      setTimer(600);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 로그인 인증코드 재발송 ---
  const handleResendLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await apiCall('/api/send-verification', { email, type: 'login' });
      setSuccess('인증코드가 다시 발송되었습니다.');
      setTimer(600);
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 회원가입 인증코드 발송 ---
  const handleSendCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const type = mode === 'signup' ? 'signup' : 'reset';
      await apiCall('/api/send-verification', { email, type });
      setSuccess('인증코드가 이메일로 발송되었습니다.');
      setTimer(600); // 10분
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 인증코드 확인 (step 2 → step 3) ---
  const handleVerifyCode = () => {
    if (code.length !== 6) {
      setError('6자리 인증코드를 입력해주세요.');
      return;
    }
    setError('');
    setSuccess('');
    setStep(3);
  };

  // --- 회원가입 완료 (자동 로그인) ---
  // 서버가 회원가입 성공 시 HttpOnly 토큰 쿠키를 같이 보내주므로
  // 로그인과 동일하게 authUser를 세팅하고 페이지를 리로드해서 바로 메인 진입
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/api/signup', { email, name, code });
      setAuthUser({ name: data.name || name, admin: !!data.admin });
      // 쿠키 반영을 위해 페이지 새로고침
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 비밀번호 재설정 완료 ---
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiCall('/api/forgot-password', { email, code, newPassword: password });
      setSuccess('비밀번호가 변경되었습니다. 로그인해주세요.');
      setTimeout(() => switchMode('login'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 인증코드 재발송 ---
  const handleResend = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const type = mode === 'signup' ? 'signup' : 'reset';
      await apiCall('/api/send-verification', { email, type });
      setSuccess('인증코드가 다시 발송되었습니다.');
      setTimer(600);
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===================== 렌더링 =====================

  // 메시지 영역
  const renderMessages = () => (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-danger rounded-2xl px-4 py-3 text-sm fade-in">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3 text-sm fade-in">
          {success}
        </div>
      )}
    </>
  );

  // 로그인 폼 (이메일 + 인증코드 2단계)
  const renderLoginForm = () => {
    // step 1: 이메일 입력 + 인증코드 발송
    if (step === 1) return (
      <div className="space-y-3.5">
        <div>
          <label htmlFor="login-email" className="sr-only">이메일</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
            className={inputCls}
          />
        </div>

        {renderMessages()}

        <button
          type="button"
          onClick={handleSendLoginCode}
          disabled={loading || !email}
          className="w-full btn-gradient py-3.5 text-sm font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              발송 중...
            </span>
          ) : '인증코드 발송'}
        </button>
      </div>
    );

    // step 2: 인증코드 입력 + 로그인
    return (
      <div className="space-y-3.5">
        <div className="text-center text-sm text-text-secondary mb-2">
          <span className="font-medium text-text">{email}</span>으로 발송된<br />
          6자리 인증코드를 입력해주세요.
        </div>

        <div>
          <label htmlFor="login-code" className="sr-only">인증코드</label>
          <input
            id="login-code"
            type="text"
            value={code}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
              setCode(v);
            }}
            placeholder="000000"
            maxLength={6}
            pattern="[0-9]*"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputCls} text-center text-2xl font-bold tracking-[0.5em]`}
          />
        </div>

        {timer > 0 && (
          <div className="text-center text-sm text-text-secondary">
            남은 시간: <span className={`font-mono font-bold ${timer <= 60 ? 'text-danger' : 'text-primary'}`}>{formatTimer(timer)}</span>
          </div>
        )}
        {timer === 0 && step === 2 && (
          <div className="text-center text-sm text-danger">
            인증코드가 만료되었습니다. 다시 발송해주세요.
          </div>
        )}

        {renderMessages()}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || code.length !== 6 || timer === 0}
          className="w-full btn-gradient py-3.5 text-sm font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              처리 중...
            </span>
          ) : '로그인'}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendLogin}
            disabled={loading}
            className="text-xs text-text-secondary hover:text-primary transition-colors"
          >
            인증코드 재발송
          </button>
        </div>
      </div>
    );
  };

  // 회원가입 / 비밀번호 재설정 — Step 1: 이메일 입력
  const renderStep1 = () => (
    <div className="space-y-3.5">
      <div>
        <label htmlFor="step1-email" className="sr-only">이메일</label>
        <input
          id="step1-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
          className={inputCls}
        />
      </div>

      {renderMessages()}

      <button
        type="button"
        onClick={handleSendCode}
        disabled={loading || !email}
        className="w-full btn-gradient py-3.5 text-sm font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            발송 중...
          </span>
        ) : '인증코드 발송'}
      </button>
    </div>
  );

  // 회원가입 / 비밀번호 재설정 — Step 2: 인증코드 입력
  const renderStep2 = () => (
    <div className="space-y-3.5">
      <div className="text-center text-sm text-text-secondary mb-2">
        <span className="font-medium text-text">{email}</span>으로 발송된<br />
        6자리 인증코드를 입력해주세요.
      </div>

      <div>
        <label htmlFor="verify-code" className="sr-only">인증코드</label>
        <input
          id="verify-code"
          type="text"
          value={code}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            setCode(v);
          }}
          placeholder="000000"
          maxLength={6}
          pattern="[0-9]*"
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputCls} text-center text-2xl font-bold tracking-[0.5em]`}
        />
      </div>

      {/* 타이머 */}
      {timer > 0 && (
        <div className="text-center text-sm text-text-secondary">
          남은 시간: <span className={`font-mono font-bold ${timer <= 60 ? 'text-danger' : 'text-primary'}`}>{formatTimer(timer)}</span>
        </div>
      )}
      {timer === 0 && step === 2 && (
        <div className="text-center text-sm text-danger">
          인증코드가 만료되었습니다. 다시 발송해주세요.
        </div>
      )}

      {renderMessages()}

      <button
        type="button"
        onClick={handleVerifyCode}
        disabled={loading || code.length !== 6 || timer === 0}
        className="w-full btn-gradient py-3.5 text-sm font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        인증 확인
      </button>

      {/* 재발송 */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="text-xs text-text-secondary hover:text-primary transition-colors"
        >
          인증코드 재발송
        </button>
      </div>
    </div>
  );

  // 회원가입 — Step 3: 이름 입력
  const renderSignupStep3 = () => (
    <form onSubmit={handleSignup} className="space-y-3.5">
      <div>
        <label htmlFor="signup-name" className="sr-only">이름</label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="이름 (닉네임)"
          autoComplete="name"
          required
          className={inputCls}
        />
      </div>

      {renderMessages()}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full btn-gradient py-3.5 text-sm font-bold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            처리 중...
          </span>
        ) : '가입하기'}
      </button>
    </form>
  );

  // 비밀번호 재설정 — Step 3: 새 비밀번호
  const renderForgotStep3 = () => (
    <form onSubmit={handleResetPassword} className="space-y-3.5">
      <div className="relative">
        <label htmlFor="reset-password" className="sr-only">새 비밀번호</label>
        <input
          id="reset-password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="새 비밀번호"
          autoComplete="new-password"
          required
          minLength={8}
          className={`${inputCls} pr-12`}
        />
        <PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
      </div>

      <p className="text-xs text-text-secondary px-1">8자 이상, 영문+숫자 포함</p>

      {renderMessages()}

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
        ) : '변경하기'}
      </button>
    </form>
  );

  // 현재 모드에 맞는 폼 렌더링
  const renderCurrentForm = () => {
    if (mode === 'login') return renderLoginForm();

    // signup step 플로우
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    if (step === 3) return renderSignupStep3();
  };

  // 서브타이틀
  const getSubtitle = () => {
    if (mode === 'login') return 'AI 기반 학습 플랫폼';
    return '회원가입';
  };

  // 하단 모드 전환 링크
  const renderModeSwitch = () => {
    // 로딩 중에는 깜빡임 방지 — 회원가입 링크 자체를 임시 숨김
    if (signupDisabled === null) return null;

    if (mode === 'login') {
      if (signupDisabled) {
        return (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="회원가입은 현재 준비중입니다."
            className="text-sm text-text-secondary/70 font-medium cursor-not-allowed select-none"
          >
            회원가입 (준비중)
          </button>
        );
      }
      return (
        <button
          onClick={() => switchMode('signup')}
          className="text-sm text-text-secondary hover:text-primary font-medium transition-colors"
        >
          계정이 없으신가요? 회원가입
        </button>
      );
    }
    return (
      <button
        onClick={() => switchMode('login')}
        className="text-sm text-text-secondary hover:text-primary font-medium transition-colors"
      >
        이미 계정이 있으신가요? 로그인
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm slide-up">

        {/* 일러스트 */}
        <div className="flex justify-center mb-8">
          <StudyIllustration className="w-48 h-48 sm:w-56 sm:h-56" />
        </div>

        {/* 로고 + 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-text">AI TutorTwo</h1>
          <p className="mt-1.5 text-text-secondary text-sm">{getSubtitle()}</p>
        </div>

        {/* 폼 */}
        {renderCurrentForm()}

        {/* 하단 전환 링크 */}
        <div className="mt-6 text-center">
          {renderModeSwitch()}
        </div>
      </div>
    </div>
  );
}
