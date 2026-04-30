// 문항 미리보기 카드 — QuestionPicker 가 선택/파싱한 결과 표시 (REBUILD29 §19)

import { answerLabel } from '../../lib/lab/parseQuestion';

const CIRCLE = ['①','②','③','④','⑤'];

export default function QuestionPreview({ question, onClear, compact = false }) {
  if (!question) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card-bg/50 p-4 text-center text-xs text-text-secondary">
        문항을 선택하거나 붙여넣어 주세요
      </div>
    );
  }

  const choices = Array.isArray(question.choices)
    ? question.choices
    : (() => { try { return JSON.parse(question.choices || '[]'); } catch { return []; } })();
  const answer = question.answer;

  return (
    <div className={`rounded-xl border border-border bg-card-bg ${compact ? 'p-3' : 'p-4'} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-secondary">
          {question.exam_title && `${question.exam_title}`}
          {question.question_number && ` #${question.question_number}`}
          {question.subject_name && ` · ${question.subject_name}`}
          {question._source === 'paste' && ' · 붙여넣기'}
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-text-secondary hover:text-danger hover:underline"
          >
            ✕ 클리어
          </button>
        )}
      </div>

      <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium leading-relaxed text-text whitespace-pre-wrap`}>
        {question.body}
      </p>

      <ul className="space-y-1">
        {choices.map((c, i) => {
          const isAnswer = answer && (i + 1 === answer || i + 1 === question.answer_extra);
          return (
            <li
              key={i}
              className={`flex gap-2 ${compact ? 'text-[11px]' : 'text-sm'} ${
                isAnswer ? 'text-success font-bold' : 'text-text'
              }`}
            >
              <span>{CIRCLE[i]}</span>
              <span className="flex-1">{c}</span>
              {isAnswer && <span className="text-[10px] text-success">✓ 정답</span>}
            </li>
          );
        })}
      </ul>

      {answer && (
        <p className="text-[10px] text-text-secondary opacity-70">
          정답: <span className="font-bold text-success">{answerLabel(answer)}</span>
          {question.answer_extra && <span> + {answerLabel(question.answer_extra)}</span>}
        </p>
      )}
    </div>
  );
}
