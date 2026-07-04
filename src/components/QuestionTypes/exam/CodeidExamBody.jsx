// 코드식별 시험 본문 — KisaExamMode 제어형 (REBUILD69)
//   answer = { mcq_selected, verdict_yn }, onChange 로 부모 state patch.
import CodeBlock from '../../CodeBlock';

export default function CodeidExamBody({ question, answer, onChange }) {
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const isSafePicked = answer.verdict_yn === false; // 안전 선택 = verdict false
  const isVulnPicked = answer.verdict_yn === true;

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-border p-2 overflow-x-auto">
        <CodeBlock code={question.vulnerable_code} language={question.code_language || 'java'} />
      </div>

      {/* ① 약점 */}
      <div className="space-y-1.5">
        {choices.map((choice, idx) => (
          <label key={idx}
            className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-sm ${
              answer.mcq_selected === idx ? 'border-primary bg-primary-light' : 'border-border'}`}>
            <input type="radio" name={`codeid-exam-${question.id}`} checked={answer.mcq_selected === idx}
              onChange={() => onChange({ mcq_selected: idx })} className="mt-0.5" />
            <span>{choice.text || choice}</span>
          </label>
        ))}
      </div>

      {/* ② 안전/취약 */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onChange({ verdict_yn: false })}
          className={`py-2 rounded-lg border text-sm font-bold ${isSafePicked ? 'border-primary bg-primary-light' : 'border-border'}`}>
          ✅ 안전한 코드
        </button>
        <button type="button" onClick={() => onChange({ verdict_yn: true })}
          className={`py-2 rounded-lg border text-sm font-bold ${isVulnPicked ? 'border-primary bg-primary-light' : 'border-border'}`}>
          ⚠️ 취약한 코드
        </button>
      </div>
    </div>
  );
}
