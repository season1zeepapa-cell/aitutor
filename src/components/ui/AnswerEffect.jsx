// 정답/오답 애니메이션 효과 — 폭죽(정답) / 천둥번개(오답)
import { useMemo, useEffect } from 'react';

// localStorage에서 정답/오답 효과 각각 확인 (기본: 둘 다 활성)
export function isCorrectEffectEnabled() {
  const v = localStorage.getItem('aitutor_effect_correct');
  return v === null ? true : v === 'true';
}
export function isWrongEffectEnabled() {
  const v = localStorage.getItem('aitutor_effect_wrong');
  return v === null ? true : v === 'true';
}

export default function AnswerEffect({ type, onComplete }) {
  useEffect(() => {
    if (!type) return;
    const t = setTimeout(onComplete, 1600);
    return () => clearTimeout(t);
  }, [type, onComplete]);

  if (!type) return null;
  return type === 'correct' ? <Fireworks /> : <Thunder />;
}

// ─── 폭죽 애니메이션 (정답) ───
function Fireworks() {
  const particles = useMemo(() => {
    const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#01a3a4', '#f368e0', '#ff9f43', '#00d2d3'];
    return Array.from({ length: 55 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 130;
      const isConfetti = i > 40;
      return {
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - (isConfetti ? 0 : 20),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: isConfetti ? 3 + Math.random() * 3 : 4 + Math.random() * 5,
        delay: Math.random() * 0.35,
        dur: 0.6 + Math.random() * 0.5,
        rotation: Math.random() * 360,
        isConfetti,
      };
    });
  }, []);

  return (
    <div className="absolute inset-x-0 z-30 pointer-events-none flex items-center justify-center"
      style={{ top: 0, bottom: 0 }}>
      <div className="absolute rounded-full ans-glow"
        style={{ width: 60, height: 60, background: 'radial-gradient(circle, rgba(255,215,0,0.5) 0%, transparent 70%)' }} />
      {particles.map((p, i) => (
        <div key={i} className="absolute ans-particle"
          style={{
            width: p.isConfetti ? p.size * 2.5 : p.size,
            height: p.isConfetti ? p.size : p.size,
            backgroundColor: p.color,
            borderRadius: p.isConfetti ? '2px' : '50%',
            transform: p.isConfetti ? `rotate(${p.rotation}deg)` : 'none',
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--etx': `${p.tx}px`,
            '--ety': `${p.ty}px`,
          }} />
      ))}
      <style>{`
        .ans-glow { animation: ans-glow-kf 0.8s ease-out both; }
        @keyframes ans-glow-kf {
          0% { transform: scale(0); opacity: 1; }
          40% { transform: scale(2.5); opacity: 0.6; }
          100% { transform: scale(4); opacity: 0; }
        }
        .ans-particle { animation: ans-particle-kf 0.8s ease-out both; }
        @keyframes ans-particle-kf {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: translate(var(--etx), var(--ety)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── 천둥번개 애니메이션 (오답) ───
function Thunder() {
  const sparks = useMemo(() => {
    return Array.from({ length: 12 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 60;
      return {
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        delay: 0.1 + Math.random() * 0.3,
        dur: 0.3 + Math.random() * 0.3,
      };
    });
  }, []);

  return (
    <div className="absolute inset-x-0 z-30 pointer-events-none overflow-hidden rounded-xl"
      style={{ top: 0, bottom: 0 }}>
      <div className="absolute inset-0 ans-flash" />
      <div className="absolute inset-0 flex items-center justify-center ans-bolt">
        <svg className="w-16 h-16" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.6))' }}>
          <path d="M13 1L3 14h9l-1 10 10-13h-9l1-10z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.5" />
        </svg>
      </div>
      {sparks.map((s, i) => (
        <div key={i} className="absolute left-1/2 top-1/2 ans-spark"
          style={{
            width: 3, height: 3, backgroundColor: '#93c5fd', borderRadius: '50%',
            boxShadow: '0 0 6px 2px rgba(147,197,253,0.8)',
            animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`,
            '--etx': `${s.tx}px`, '--ety': `${s.ty}px`,
          }} />
      ))}
      <style>{`
        .ans-flash { animation: ans-flash-kf 1s ease-out both; }
        @keyframes ans-flash-kf {
          0% { background: rgba(255,255,255,0.7); }
          8% { background: rgba(147,197,253,0.5); }
          16% { background: rgba(255,255,255,0.4); }
          30% { background: rgba(147,197,253,0.15); }
          50% { background: rgba(255,255,255,0.1); }
          100% { background: transparent; }
        }
        .ans-bolt { animation: ans-bolt-kf 1s ease-out both; }
        @keyframes ans-bolt-kf {
          0% { opacity: 0; transform: scale(0.3) rotate(-10deg); }
          8% { opacity: 1; transform: scale(1.3) rotate(5deg); }
          16% { opacity: 0.2; transform: scale(1) rotate(-3deg); }
          28% { opacity: 1; transform: scale(1.1) rotate(2deg); }
          45% { opacity: 0.6; transform: scale(1) rotate(0); }
          100% { opacity: 0; transform: scale(0.7) rotate(0); }
        }
        .ans-spark { animation: ans-spark-kf 0.4s ease-out both; }
        @keyframes ans-spark-kf {
          0% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--etx)), calc(-50% + var(--ety))) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
