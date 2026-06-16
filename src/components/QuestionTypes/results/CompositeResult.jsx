// 복합실기(composite) 결과 영역 — 마이그 005 신규 유형.
// 구성:
//   1. 루브릭(rubric) 항목별 hit/miss 표 (required_keywords 매칭)
//   2. 총점 (/8)
//   3. explanation (모범 진단보고서 + 정탐/오탐 판정) — ResultOverlay 의 공통 해설 블록과 별개로,
//      여기서는 루브릭/점수만 담당하고 explanation 본문은 ResultOverlay 가 노출.
//
// 채점 로직(scorer)은 다음 Phase. 여기서는 result 에 들어온 값으로 렌더만.
// 사용자 작성 보고서(report_text) 에서 키워드 포함 여부를 프론트에서 단순 매칭해 표시.

/** 보고서 텍스트에 키워드가 포함됐는지(대소문자·공백 무시) 검사 */
function matchKeyword(reportText, kw) {
  if (!kw) return false;
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
  return norm(reportText).includes(norm(kw));
}

export default function CompositeResult({ result, question }) {
  const rubric = Array.isArray(question?.rubric) ? question.rubric : [];
  const reportText = result?.report_text ?? result?.attempt?.report_text ?? '';

  // 서버가 rubric_hits 를 내려주면 우선 사용, 없으면 프론트에서 키워드 단순 매칭
  const serverHits = result?.rubric_hits;

  // 루브릭 항목별 매칭 계산
  const rows = rubric.map((r, i) => {
    const keywords = Array.isArray(r.required_keywords) ? r.required_keywords : [];
    let matched, total;
    if (serverHits && serverHits[i]) {
      matched = serverHits[i].matched || [];
      total = serverHits[i].total ?? keywords.length;
    } else {
      matched = keywords.filter(kw => matchKeyword(reportText, kw));
      total = keywords.length;
    }
    const hitCount = matched.length;
    const full = total > 0 && hitCount === total;
    const partial = hitCount > 0 && !full;
    const earned = total > 0 ? Math.round((r.points || 0) * (hitCount / total)) : (r.points || 0);
    return { ...r, idx: i, keywords, matched, total, hitCount, full, partial, earned };
  });

  // 총 배점 (rubric 합, 기본 8)
  const totalPoints = rubric.reduce((s, r) => s + (r.points || 0), 0) || 8;
  // 획득 점수 — 서버 점수 우선
  const earnedPoints = typeof result?.rubric_score === 'number'
    ? result.rubric_score
    : rows.reduce((s, r) => s + r.earned, 0);

  return (
    <div className="space-y-2">
      {/* 점수 요약 */}
      <div className="rounded-lg border border-border bg-card-bg p-3 flex items-center justify-between">
        <span className="text-sm font-bold">루브릭 채점</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          earnedPoints === totalPoints
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : earnedPoints > 0
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
        }`}>
          {earnedPoints} / {totalPoints}점
        </span>
      </div>

      {/* 루브릭 항목별 hit/miss */}
      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map(r => {
            const status = r.full ? 'ok' : r.partial ? 'partial' : 'fail';
            const icon = status === 'ok' ? '✅' : status === 'partial' ? '⚠️' : '❌';
            const color = status === 'ok'
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
              : status === 'partial'
              ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
            return (
              <div key={r.idx} className={`rounded-md px-2.5 py-2 text-sm border ${color}`}>
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="font-semibold flex-1">{r.item || `항목 ${r.idx + 1}`}</span>
                  {r.artifact_ref && (
                    <span className="text-[10px] font-mono text-text-secondary">{r.artifact_ref}</span>
                  )}
                  <span className="text-xs font-bold">{r.earned}/{r.points ?? 0}</span>
                </div>
                {r.total > 0 && (
                  <div className="mt-1 pl-6 text-[11px] text-text-secondary">
                    키워드 {r.hitCount}/{r.total}
                    {r.keywords.length > 0 && (
                      <span className="ml-1 flex flex-wrap gap-1 mt-0.5">
                        {r.keywords.map((kw, k) => {
                          const hit = r.matched.includes(kw);
                          return (
                            <span key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              hit
                                ? 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-text-secondary line-through'
                            }`}>
                              {kw}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 점수 헤더 옆 보조 정보 — 루브릭 점수 */
export function CompositeHeaderExtra({ result, question }) {
  const rubric = Array.isArray(question?.rubric) ? question.rubric : [];
  const totalPoints = rubric.reduce((s, r) => s + (r.points || 0), 0) || 8;
  const earned = typeof result?.rubric_score === 'number' ? result.rubric_score : null;
  if (earned === null) return null;
  return (
    <div className="text-[11px] opacity-90 mt-0.5">
      루브릭 {earned}/{totalPoints}
    </div>
  );
}
