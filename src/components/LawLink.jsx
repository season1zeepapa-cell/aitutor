// 법령 키워드 자동 링크 + 툴팁 — 「법령명」 패턴을 클릭 가능한 링크로 변환
import { useState, useRef, useEffect } from 'react';

// 「법령명」 패턴 매칭 → 텍스트와 법령 링크로 분리
const LAW_PATTERN = /「([^」]{2,40})」/g;

function cleanLawName(text) {
  return text.replace(/[「」『』\[\]]/g, '').trim();
}

// 법령 툴팁 팝업
function LawTooltip({ name, onClose }) {
  const ref = useRef(null);
  const encoded = encodeURIComponent(name);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const handleAiLaw = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(name).catch(() => {});
    window.open('https://www.law.go.kr/LSW/ais/main.do', '_blank');
  };

  return (
    <div ref={ref}
      className="absolute left-0 top-full mt-1.5 z-50 bg-card-bg border border-border rounded-xl shadow-lg p-3 min-w-[200px] fade-in"
      onClick={e => e.stopPropagation()}>
      <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
        📜 {name}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <a href={`https://www.law.go.kr/법령/${encoded}`} target="_blank" rel="noopener"
          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors no-underline"
          onClick={e => e.stopPropagation()}>
          🔗 법제처
        </a>
        <button onClick={handleAiLaw}
          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
          🤖 AI 법령정보 (복사+이동)
        </button>
      </div>
    </div>
  );
}

// 법령 키워드 스팬 (클릭 시 툴팁)
function LawKeyword({ name, fullText }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span className="relative inline">
      <span
        className="text-primary font-semibold cursor-pointer hover:underline decoration-primary/40 underline-offset-2"
        onClick={e => { e.stopPropagation(); setShowTooltip(v => !v); }}>
        {fullText}
      </span>
      {showTooltip && <LawTooltip name={name} onClose={() => setShowTooltip(false)} />}
    </span>
  );
}

// 텍스트에서 「법령명」을 자동으로 LawKeyword 컴포넌트로 변환
export default function LawLinkedText({ text }) {
  if (!text || typeof text !== 'string') return text || null;

  // 「」 패턴이 없으면 그냥 텍스트 반환
  if (!text.includes('「')) return text;

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(LAW_PATTERN.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    // 매치 이전 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // 법령 키워드
    parts.push(
      <LawKeyword key={match.index} name={cleanLawName(match[0])} fullText={match[0]} />
    );
    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
