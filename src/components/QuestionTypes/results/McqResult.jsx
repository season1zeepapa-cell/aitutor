// MCQ 결과 영역 — REBUILD16 R3 마무리.
// ResultOverlay 의 isMcq 분기 블록을 registry-기반 컴포넌트로 분리.
// 신규: 채점 후 선지별 해설(choice_explanations) O/X 뱃지 + why 나열.

export default function McqResult({ result, question }) {
  const autoScore = result?.auto_score ?? 0;
  const ok = autoScore === 100;
  // 사용자가 고른 선지 / 정답 인덱스
  const userSelected = typeof result?.user_selected === 'number' ? result.user_selected : null;
  const answerIndex = typeof result?.answer_index === 'number' ? result.answer_index : null;

  // 선지·해설은 question 에서 (ResultOverlay 가 question 을 props 로 넘김)
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  const explanations = Array.isArray(question?.choice_explanations) ? question.choice_explanations : [];

  // num(1-base) 기준으로 해설 매핑
  const explByNum = {};
  explanations.forEach((e) => { if (e && typeof e.num === 'number') explByNum[e.num] = e; });

  return (
    <div className="space-y-2">
      {/* 정/오답 요약 배너 */}
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
                선택 답: {userSelected !== null ? `${userSelected + 1}번` : '—'}
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
                  선택: {userSelected !== null ? `${userSelected + 1}번` : '—'}
                </span>
                <span className="text-green-700 dark:text-green-400 font-bold">
                  정답: {answerIndex !== null ? `${answerIndex + 1}번` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 선지별 해설 — 4~5선지 전부를 O/X 뱃지 + why 로 나열 */}
      {choices.length > 0 && (
        <div className="rounded-lg border border-border bg-card-bg p-3 space-y-1.5">
          <div className="text-xs font-bold text-text-secondary mb-1">선지별 해설</div>
          {choices.map((choice, idx) => {
            const num = idx + 1;
            const expl = explByNum[num];
            // 정답 여부: choice_explanations[].correct 우선, 없으면 answer_index 로 판정
            const isCorrect = expl ? !!expl.correct : (answerIndex !== null && idx === answerIndex);
            const isPicked = userSelected !== null && idx === userSelected;
            const text = typeof choice === 'string' ? choice : (choice?.text ?? '');
            return (
              <div
                key={idx}
                className={`rounded-md px-2 py-1.5 text-sm border ${
                  isCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                } ${isPicked ? 'ring-2 ring-primary/60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {/* O/X 뱃지 */}
                  <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
                    isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {isCorrect ? 'O' : 'X'}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-text-secondary">{num}.</span>
                  <span className={`flex-1 ${
                    isCorrect ? 'text-green-800 dark:text-green-200' : 'text-text'
                  }`}>
                    {text}
                  </span>
                  {isPicked && (
                    <span className="shrink-0 text-[10px] font-bold text-primary">내 선택</span>
                  )}
                </div>
                {/* 선지 해설 본문 */}
                {expl?.why && (
                  <p className="mt-1 pl-7 text-[11px] leading-relaxed text-text-secondary"
                     style={{ wordBreak: 'keep-all' }}>
                    {expl.why}
                  </p>
                )}
              </div>
            );
          })}
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
