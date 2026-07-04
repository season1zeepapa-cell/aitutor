// 코드식별 카드 — 드릴용 단일 문항 (REBUILD69)
// 코드를 보여주고 ① 보안약점(4지) ② 안전/취약(2지)을 고른다.
//   onSubmit({ mcq_selected, verdict_yn })  — verdict_yn: true=사용자가 "취약"으로 판단
import { useState } from 'react';
import CodeBlock from '../../components/CodeBlock';

export default function CodeidCard({ question, onSubmit, disabled }) {
  const [wIdx, setWIdx] = useState(null);      // 약점 보기 index
  const [isSafe, setIsSafe] = useState(null);  // true=안전 선택, false=취약 선택
  const choices = Array.isArray(question.choices) ? question.choices : [];

  const canSubmit = wIdx !== null && isSafe !== null && !disabled;
  const submit = () => {
    if (wIdx === null || isSafe === null) return;
    onSubmit({ mcq_selected: wIdx, verdict_yn: isSafe === false });
  };

  return (
    <div className="rounded-xl bg-card-bg border border-border p-4 space-y-4">
      {question.body && <div className="text-sm leading-relaxed whitespace-pre-wrap">{question.body}</div>}

      {/* 코드 */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-border p-2 overflow-x-auto">
        {question.code_language && (
          <div className="px-1 pb-1 text-[11px] font-mono text-text-secondary">{question.language || question.code_language}</div>
        )}
        <CodeBlock code={question.vulnerable_code} language={question.code_language || 'java'} />
      </div>

      {/* ① 약점 4지선다 */}
      <div>
        <p className="text-xs font-bold text-text mb-2">① 어떤 보안약점일까요?</p>
        <div className="space-y-2">
          {choices.map((choice, idx) => (
            <label key={idx}
              className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                wIdx === idx ? 'border-primary bg-primary-light' : 'border-border hover:bg-neutral-50 dark:hover:bg-neutral-800'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
              <input type="radio" name={`codeid-${question.id}`} checked={wIdx === idx}
                onChange={() => setWIdx(idx)} disabled={disabled} className="mt-1" />
              <span className="text-sm">{choice.text || choice}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ② 안전/취약 */}
      <div>
        <p className="text-xs font-bold text-text mb-2">② 이 코드는?</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => !disabled && setIsSafe(true)} disabled={disabled}
            className={`py-2.5 rounded-xl border text-sm font-bold transition-all active:scale-[0.99] ${
              isSafe === true ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text hover:bg-primary-light'
            } ${disabled ? 'opacity-60' : ''}`}>
            ✅ 안전한 코드
          </button>
          <button type="button" onClick={() => !disabled && setIsSafe(false)} disabled={disabled}
            className={`py-2.5 rounded-xl border text-sm font-bold transition-all active:scale-[0.99] ${
              isSafe === false ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text hover:bg-primary-light'
            } ${disabled ? 'opacity-60' : ''}`}>
            ⚠️ 취약한 코드
          </button>
        </div>
      </div>

      <button onClick={submit} disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all">
        {wIdx === null || isSafe === null ? '① 약점과 ② 안전여부를 모두 선택' : '제출'}
      </button>
    </div>
  );
}
