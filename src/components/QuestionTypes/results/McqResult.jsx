// MCQ 결과 영역 — REBUILD16 R3 마무리.
// ResultOverlay 의 isMcq 분기 블록을 registry-기반 컴포넌트로 분리.

export default function McqResult({ result }) {
  const autoScore = result?.auto_score ?? 0;
  const ok = autoScore === 100;
  return (
    <div className={`rounded-lg border p-3 text-sm ${
      ok
        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    }`}>
      {ok ? (
        <div className="flex items-center gap-2">
          <span className="text-xl">✅</span>
          <div>
            <div className="font-bold text-green-700 dark:text-green-300">정답입니다!</div>
            <div className="text-[11px] text-green-700/80 dark:text-green-400/80">
              선택 답: {typeof result.user_selected === 'number' ? `${result.user_selected + 1}번` : '—'}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xl">❌</span>
          <div className="flex-1">
            <div className="font-bold text-red-700 dark:text-red-300">오답</div>
            <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="text-red-700/90 dark:text-red-400/90">
                선택: {typeof result.user_selected === 'number' ? `${result.user_selected + 1}번` : '—'}
              </span>
              <span className="text-green-700 dark:text-green-400 font-bold">
                정답: {result.answer_index + 1}번
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 점수 헤더 옆 보조 정보 */
export function McqHeaderExtra({ result }) {
  const ok = (result?.auto_score ?? 0) === 100;
  return (
    <div className="text-[11px] opacity-90 mt-0.5">
      {ok ? '정답' : '오답'}
    </div>
  );
}
