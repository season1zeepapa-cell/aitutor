// MCQ 시험 본문 — KisaExamMode 의 QuestionBody 분기를 분리.

export default function McqExamBody({ question, answer, onChange }) {
  if (!Array.isArray(question.choices)) return null;
  return (
    <div className="space-y-1.5">
      {question.choices.map((choice, idx) => (
        <label
          key={idx}
          className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-sm ${
            answer.mcq_selected === idx ? 'border-primary bg-primary-light' : 'border-border'
          }`}
        >
          <input
            type="radio"
            name={`mcq-${question.id}`}
            checked={answer.mcq_selected === idx}
            onChange={() => onChange({ mcq_selected: idx })}
            className="mt-0.5"
          />
          <span>{choice.text || choice}</span>
        </label>
      ))}
    </div>
  );
}
