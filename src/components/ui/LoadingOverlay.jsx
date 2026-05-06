// 로딩 오버레이 — 긴 작업 진행 시 표시하는 대기 화면
import { useState, useEffect } from 'react';

const TIPS = [
  '잠시만 기다려주세요...',
  'AI가 열심히 작업 중입니다',
  '거의 다 됐어요!',
  '조금만 더 기다려주세요',
  '최선의 결과를 만들고 있어요',
];

// 귀여운 학습 캐릭터 애니메이션 (인라인 SVG)
function StudyAnimation() {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {/* 배경 원 (부드러운 펄스) */}
      <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '3s' }} />
      <div className="absolute inset-4 rounded-full bg-primary/10" />

      <svg viewBox="0 0 200 200" className="relative w-full h-full" fill="none">
        {/* 책상 */}
        <rect x="40" y="140" width="120" height="6" rx="3" fill="var(--primary)" opacity="0.15" />

        {/* 노트북 */}
        <rect x="60" y="105" width="50" height="35" rx="4" fill="var(--primary)" fillOpacity="0.12" stroke="var(--primary)" strokeWidth="1.5" strokeOpacity="0.3" />
        <rect x="63" y="108" width="44" height="26" rx="2" fill="var(--primary)" opacity="0.06" />
        {/* 노트북 화면 줄 (타이핑 애니메이션) */}
        <line x1="68" y1="116" x2="92" y2="116" stroke="var(--primary)" strokeWidth="1.5" opacity="0.4">
          <animate attributeName="x2" values="68;92;68" dur="2s" repeatCount="indefinite" />
        </line>
        <line x1="68" y1="122" x2="85" y2="122" stroke="var(--primary)" strokeWidth="1.5" opacity="0.25">
          <animate attributeName="x2" values="68;85;68" dur="2.5s" repeatCount="indefinite" />
        </line>
        <line x1="68" y1="128" x2="78" y2="128" stroke="var(--primary)" strokeWidth="1.5" opacity="0.15">
          <animate attributeName="x2" values="68;78;68" dur="1.8s" repeatCount="indefinite" />
        </line>

        {/* 커피컵 */}
        <rect x="125" y="120" width="16" height="20" rx="3" fill="var(--primary)" opacity="0.2" />
        <path d="M141 126 Q148 128 141 134" stroke="var(--primary)" strokeWidth="1.5" fill="none" opacity="0.15" />
        {/* 커피 김 */}
        <path d="M130 118 Q132 110 134 118" stroke="var(--primary)" strokeWidth="1" opacity="0.2">
          <animate attributeName="d" values="M130 118 Q132 110 134 118;M130 115 Q132 107 134 115;M130 118 Q132 110 134 118" dur="2s" repeatCount="indefinite" />
        </path>
        <path d="M135 116 Q137 108 139 116" stroke="var(--primary)" strokeWidth="1" opacity="0.15">
          <animate attributeName="d" values="M135 116 Q137 108 139 116;M135 113 Q137 105 139 113;M135 116 Q137 108 139 116" dur="2.3s" repeatCount="indefinite" />
        </path>

        {/* 연필 (회전 애니메이션) */}
        <g transform="translate(50, 115)" opacity="0.3">
          <animateTransform attributeName="transform" type="rotate" values="-5,50,115;5,50,115;-5,50,115" dur="1.5s" repeatCount="indefinite" additive="sum" />
          <rect x="-2" y="-20" width="4" height="18" rx="1" fill="var(--primary)" />
          <polygon points="0,-22 -3,-20 3,-20" fill="var(--primary)" opacity="0.8" />
        </g>

        {/* 전구 (반짝임) */}
        <g>
          <circle cx="100" cy="45" r="16" fill="var(--primary)" opacity="0.08">
            <animate attributeName="opacity" values="0.05;0.15;0.05" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="45" r="10" stroke="var(--primary)" strokeWidth="1.5" fill="none" opacity="0.5">
            <animate attributeName="r" values="10;12;10" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* 빛살 */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + Math.cos(rad) * 18;
            const y1 = 45 + Math.sin(rad) * 18;
            const x2 = 100 + Math.cos(rad) * 24;
            const y2 = 45 + Math.sin(rad) * 24;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--primary)" strokeWidth="1" strokeLinecap="round">
                <animate attributeName="opacity" values="0.1;0.5;0.1" dur="2s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
              </line>
            );
          })}
        </g>

        {/* 기어 (돌아가는 설정 아이콘) */}
        <g transform="translate(155, 80)">
          <animateTransform attributeName="transform" type="rotate" values="0,155,80;360,155,80" dur="8s" repeatCount="indefinite" />
          <circle cx="0" cy="0" r="8" stroke="var(--primary)" strokeWidth="1.5" fill="none" opacity="0.2"
            transform="translate(155,80)" />
          {[0, 60, 120, 180, 240, 300].map((a, i) => {
            const r2 = (a * Math.PI) / 180;
            return (
              <rect key={i} x={155 + Math.cos(r2) * 10 - 2} y={80 + Math.sin(r2) * 10 - 2} width="4" height="4" rx="1"
                fill="var(--primary)" opacity="0.2" />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default function LoadingOverlay({ isOpen, message }) {
  const [tipIdx, setTipIdx] = useState(0);

  // 팁 메시지 자동 순환 (5초마다)
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 backdrop-blur-sm fade-in">
      <div className="text-center px-6 max-w-sm">
        {/* 애니메이션 일러스트 */}
        <StudyAnimation />

        {/* 메인 메시지 */}
        <p className="text-lg font-bold text-text mt-4">{message || '작업 진행 중'}</p>

        {/* 로딩 바 */}
        <div className="w-48 h-1.5 mx-auto mt-4 bg-border/30 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{
            animation: 'loading-bar 2s ease-in-out infinite',
          }} />
        </div>

        {/* 팁 메시지 (자동 전환) */}
        <p className="text-sm text-text-secondary mt-3 fade-in" key={tipIdx}>
          {TIPS[tipIdx]}
        </p>

        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; margin-left: 0; }
            50% { width: 70%; margin-left: 15%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    </div>
  );
}
