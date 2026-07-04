// 코드식별 결과 영역 (REBUILD69)
// 약점(①)·안전여부(②) 각각의 정오답을 보여준다. 해설 본문은 ResultOverlay 공통 블록이 렌더.
export default function CodeidResult({ result, question }) {
  const b = result?.breakdown || {};
  const weaknessOk = !!b.weaknessOk;
  const safeOk = !!b.safeOk;

  const choices = Array.isArray(result?.choices) ? result.choices
    : (Array.isArray(question?.choices) ? question.choices : []);
  const ai = typeof result?.answer_index === 'number' ? result.answer_index : null;
  const us = typeof result?.user_selected === 'number' ? result.user_selected : null;
  const correctW = ai !== null ? (choices[ai]?.text || '—') : '—';
  const userW = us !== null ? (choices[us]?.text || '—') : '—';

  // 안전여부: is_safe_answer(정답, 코드가 안전한가), user_verdict_yn(사용자가 취약이라 판단)
  const isSafeAns = result?.is_safe_answer;         // true=안전, false=취약
  const userVerdict = result?.user_verdict_yn;       // true=사용자가 취약이라 판단
  const correctSafeText = isSafeAns === true ? '✅ 안전한 코드' : isSafeAns === false ? '⚠️ 취약한 코드' : '—';
  const userSafeText = userVerdict === true ? '⚠️ 취약한 코드' : userVerdict === false ? '✅ 안전한 코드' : '—';

  const Row = ({ label, ok, user, correct }) => (
    <div className={`rounded-lg border p-2.5 text-sm ${ok
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ok ? 'bg-green-500' : 'bg-red-500'} text-white`}>{ok ? 'O' : 'X'}</span>
        <span className="text-xs font-bold text-text-secondary">{label}</span>
      </div>
      <div className="text-[12px] flex flex-wrap gap-x-3 gap-y-0.5">
        <span className={ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>내 답: {user}</span>
        {!ok && <span className="text-green-700 dark:text-green-400 font-bold">정답: {correct}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <Row label="① 보안약점" ok={weaknessOk} user={userW} correct={correctW} />
      <Row label="② 안전/취약" ok={safeOk} user={userSafeText} correct={correctSafeText} />
    </div>
  );
}

/** 점수 헤더 옆 보조 — 약점/안전여부 O/X */
export function CodeidHeaderExtra({ result }) {
  const b = result?.breakdown || {};
  return (
    <div className="text-[11px] opacity-90 mt-0.5">
      약점 {b.weaknessOk ? '✓' : '✗'} · 안전여부 {b.safeOk ? '✓' : '✗'}
    </div>
  );
}
