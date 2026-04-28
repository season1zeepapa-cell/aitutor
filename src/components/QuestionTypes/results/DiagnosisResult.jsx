// diagnosis4 결과 영역 — REBUILD16 R3 마무리.
// 4단계 브레이크다운(취약여부/라인/근거/수정) + LLM 보조 채점 블록.
// LLM 채점 호출은 부모(ResultOverlay)가 관리해 props 로 주입.

function Row({ label, status, detail, points }) {
  const icon = { ok: '✅', partial: '⚠️', fail: '❌' }[status] || '·';
  const color = status === 'ok'
    ? 'text-green-600 dark:text-green-400'
    : status === 'partial'
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-border text-sm">
      <span className={`text-base ${color}`}>{icon}</span>
      <span className="font-semibold w-20">{label}</span>
      <span className="flex-1 text-text-secondary text-xs">{detail}</span>
      <span className={`text-xs font-bold ${color}`}>{points}</span>
    </div>
  );
}

function keywordStatus(hits) {
  if (!hits || !hits.total) return 'ok';
  if (hits.hits === hits.total) return 'ok';
  if (hits.hits > 0) return 'partial';
  return 'fail';
}

function formatHits(hits) {
  if (!hits || !hits.total) return '키워드 없음';
  return `필수 키워드 ${hits.hits}/${hits.total} 포함`;
}

/**
 * @param {object} props.result
 * @param {object} props.llm — { score, feedback, loading, error, onRequest:(provider)=>void }
 */
export default function DiagnosisResult({ result, llm }) {
  const b = result?.breakdown || {};
  const hits = result?.keyword_hits || {};

  return (
    <>
      {/* 4단계 채점 디테일 */}
      <div className="space-y-2 text-sm">
        <Row
          label="취약 여부"
          status={b.verdictPoints === 20 ? 'ok' : 'fail'}
          detail={b.verdictPoints === 20 ? '정확' : '반대로 판정'}
          points={`${b.verdictPoints ?? 0}/20`}
        />
        <Row
          label="라인 지목"
          status={b.linePoints === 20 ? 'ok' : b.linePoints > 0 ? 'partial' : 'fail'}
          detail={`${b.linePoints ?? 0}/20`}
          points={`${b.linePoints ?? 0}/20`}
        />
        <Row
          label="근거 서술"
          status={keywordStatus(hits.rationale)}
          detail={formatHits(hits.rationale)}
          points={`${b.rationalePoints ?? 0}/30`}
        />
        <Row
          label="수정 방안"
          status={keywordStatus(hits.fix)}
          detail={formatHits(hits.fix)}
          points={`${b.fixPoints ?? 0}/30`}
        />
      </div>

      {/* LLM 보조 채점 */}
      {llm && (
        <div className="rounded-lg border border-border p-3 bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-sm font-bold flex items-center gap-1">🤖 LLM 보조 채점</div>
            {typeof llm.score === 'number' && (
              <span className="text-xs font-bold text-primary">{llm.score}점</span>
            )}
          </div>
          {typeof llm.score !== 'number' ? (
            <>
              <p className="text-[11px] text-text-secondary mb-2">
                서술형 답안을 AI에게 평가받기 (하루 50회 제한)
              </p>
              <div className="flex gap-1">
                {['gemini', 'claude', 'openai'].map(p => (
                  <button
                    key={p}
                    onClick={() => llm.onRequest(p)}
                    disabled={llm.loading}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {llm.loading ? '...' : `${p[0].toUpperCase() + p.slice(1)}로 채점`}
                  </button>
                ))}
              </div>
              {llm.error && <p className="mt-1.5 text-[11px] text-red-500">{llm.error}</p>}
            </>
          ) : (
            <div className="text-xs text-text-secondary">
              {llm.feedback?.strengths?.length > 0 && (
                <p>👍 {llm.feedback.strengths.join(', ')}</p>
              )}
              {llm.feedback?.weaknesses?.length > 0 && (
                <p className="mt-1">👎 {llm.feedback.weaknesses.join(', ')}</p>
              )}
              {llm.feedback?.missing_keywords?.length > 0 && (
                <p className="mt-1">📌 누락 키워드: {llm.feedback.missing_keywords.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** 점수 헤더 우측 보조 — 자가채점 점수 */
export function DiagnosisHeaderExtra({ result }) {
  return <div>자가채점 {result?.auto_score ?? 0}</div>;
}
