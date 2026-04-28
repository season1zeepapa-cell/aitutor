// 스트리밍 응답 표시 + 복사 버튼
import { useEffect, useRef, useState } from 'react';

export default function ResponseView({ text, isStreaming, error }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  // 새 토큰 들어올 때 자동 스크롤
  useEffect(() => {
    if (ref.current && isStreaming) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [text, isStreaming]);

  function handleCopy() {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg bg-card-bg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card-bg/50">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-semibold">응답</span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              스트리밍 중
            </span>
          )}
          {!isStreaming && text && (
            <span className="opacity-60">완료</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          disabled={!text}
          className="text-[11px] px-2 py-1 rounded border border-border text-text-secondary hover:bg-bg disabled:opacity-30"
        >
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>

      <div
        ref={ref}
        className="p-4 max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed font-mono text-text"
      >
        {error && (
          <div className="text-red-400 text-sm mb-2">⚠️ {error}</div>
        )}
        {text || (
          <span className="text-text-secondary opacity-50 text-xs italic">
            응답이 여기에 표시됩니다…
          </span>
        )}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
