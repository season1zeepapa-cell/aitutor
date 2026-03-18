// AI 해설 트래킹 패널 — 요청/응답 과정 추적
import { useState } from 'react';

const TYPE_ICON = {
  start: '📤', prompt: '📝', stream: '💬', end: '✅', error: '❌', save: '💾',
};

const STATUS_STYLE = {
  ok: 'text-success',
  done: 'text-success',
  running: 'text-primary',
  error: 'text-danger',
};

function ExpandableText({ text, maxLen = 300, color = 'primary' }) {
  const [showFull, setShowFull] = useState(false);
  if (!text) return null;
  const isLong = text.length > maxLen;

  return (
    <div className="mt-1.5">
      <pre className="text-xs text-text-secondary bg-badge-bg rounded-lg p-2.5 whitespace-pre-wrap break-words max-h-60 overflow-y-auto font-mono leading-relaxed">
        {isLong && !showFull ? text.slice(0, maxLen) + '...' : text}
      </pre>
      {isLong && (
        <button onClick={e => { e.stopPropagation(); setShowFull(v => !v); }}
          className={`text-[10px] font-semibold mt-1 text-${color} hover:underline`}>
          {showFull ? '접기' : `전체 보기 (${text.length}자)`}
        </button>
      )}
    </div>
  );
}

function TraceItem({ evt }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = !!(evt.expandable || evt.detail);
  const icon = TYPE_ICON[evt.type] || '⚙️';
  const statusClass = STATUS_STYLE[evt.status] || 'text-text-secondary';
  const elapsed = evt.endTs ? `${((evt.endTs - evt.ts) / 1000).toFixed(1)}s` : null;

  return (
    <div className={`border-l-2 pl-3 py-1.5 ${evt.status === 'error' ? 'border-danger' : evt.status === 'running' ? 'border-primary' : 'border-border'}`}>
      <div className={`flex items-center gap-1.5 ${canExpand ? 'cursor-pointer' : ''}`}
        onClick={canExpand ? () => setExpanded(v => !v) : undefined}>
        {/* 타임스탬프 */}
        <span className="text-[9px] text-text-secondary/60 font-mono w-8 text-right flex-shrink-0">
          {(evt.ts / 1000).toFixed(1)}s
        </span>
        {/* 아이콘 */}
        <span className="text-xs">{icon}</span>
        {/* 레이블 */}
        <span className={`text-xs font-semibold flex-1 ${statusClass}`}>{evt.label}</span>
        {/* 실행 시간 */}
        {elapsed && <span className="text-[9px] text-text-secondary/60 font-mono">({elapsed})</span>}
        {/* 화살표 */}
        {canExpand && (
          <svg className={`w-3 h-3 text-text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* 접힌 상태: 한줄 요약 */}
      {!expanded && evt.detail && (
        <p className="text-[10px] text-text-secondary/70 truncate ml-[38px] mt-0.5">{evt.detail}</p>
      )}

      {/* 펼침 */}
      {expanded && (
        <div className="ml-[38px] mt-1 fade-in">
          {evt.detail && (
            <p className="text-[11px] text-text-secondary bg-badge-bg rounded-lg px-2.5 py-2 whitespace-pre-wrap mb-1.5">{evt.detail}</p>
          )}
          {evt.expandable && <ExpandableText text={evt.expandable} />}
        </div>
      )}
    </div>
  );
}

export default function TracePanel({ events }) {
  const [show, setShow] = useState(false);

  if (!events || events.length === 0) return null;

  return (
    <div className="mt-2">
      <button onClick={() => setShow(v => !v)}
        className="flex items-center gap-1.5 text-[10px] text-text-secondary font-semibold hover:text-text transition-colors">
        <svg className={`w-3 h-3 transition-transform ${show ? 'rotate-90' : ''}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        트래킹 ({events.length}단계)
      </button>

      {show && (
        <div className="mt-1.5 max-h-72 overflow-y-auto space-y-0 fade-in">
          {events.map((evt, i) => <TraceItem key={i} evt={evt} />)}
        </div>
      )}
    </div>
  );
}
