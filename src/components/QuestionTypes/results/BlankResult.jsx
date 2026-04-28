// 단답형(blank) 결과 영역 — REBUILD16 R3 마무리.

export default function BlankResult({ result }) {
  if (!Array.isArray(result?.blank_detail)) return null;
  const b = result.breakdown || {};
  const total = b.blankTotal ?? result.blank_detail.length;
  const correct = b.blankCorrect ?? 0;
  const allRight = correct === total;
  const someRight = correct > 0;

  return (
    <div className="rounded-lg border border-border bg-card-bg p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold">빈칸 채점</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          allRight
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : someRight
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}>
          {correct} / {total}
        </span>
      </div>
      <div className="space-y-1.5">
        {result.blank_detail.map(d => (
          <div key={d.idx}
            className={`rounded-md px-2 py-1.5 text-sm flex flex-wrap items-center gap-2 ${
              d.ok
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              d.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>#{d.idx}</span>
            <span className="text-xs text-text-secondary">입력:</span>
            <span className={`font-mono text-xs ${
              d.ok
                ? 'text-green-700 dark:text-green-300 font-bold'
                : 'text-red-700 dark:text-red-400 line-through'
            }`}>
              {d.user || '(미입력)'}
            </span>
            {!d.ok && Array.isArray(d.expected) && d.expected.length > 0 && (
              <>
                <span className="text-xs text-text-secondary">정답:</span>
                <span className="font-mono text-xs font-bold text-green-700 dark:text-green-300">
                  {d.expected.join(' / ')}
                </span>
              </>
            )}
            <span className="ml-auto text-sm">{d.ok ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 점수 헤더 옆 보조 정보 — 빈칸 정답 N/M */
export function BlankHeaderExtra({ result }) {
  const b = result?.breakdown || {};
  if (!b.blankTotal) return null;
  return (
    <div className="text-[11px] opacity-90 mt-0.5">
      빈칸 정답 {b.blankCorrect}/{b.blankTotal}
    </div>
  );
}
