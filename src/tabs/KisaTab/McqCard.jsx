// MCQ 카드 — 이론 문항 객관식
import { useState } from 'react';

export default function McqCard({ question, onSubmit, disabled }) {
  const [selected, setSelected] = useState(null);

  const handleSubmit = () => {
    if (selected === null) return;
    onSubmit({ mcq_selected: selected });
  };

  return (
    <div className="rounded-xl bg-card-bg border border-border p-4 space-y-4">
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{question.body}</div>

      {question.choices && (
        <div className="space-y-2">
          {question.choices.map((choice, idx) => (
            <label
              key={idx}
              className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                selected === idx
                  ? 'border-primary bg-primary-light'
                  : 'border-border hover:bg-neutral-50 dark:hover:bg-neutral-800'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="mcq"
                checked={selected === idx}
                onChange={() => setSelected(idx)}
                disabled={disabled}
                className="mt-1"
              />
              <span className="text-sm">{choice.text || choice}</span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={selected === null || disabled}
        className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
      >
        제출
      </button>
    </div>
  );
}
