// diagnosis4 (실기 진단) 시험 본문 — 4단계 입력 폼.
// CodeBlock 의 cited_lines/onLineClick 처리는 부모(QuestionBody)에서 question.question_type 으로 분기.

function ExamPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg border ${
        active ? 'border-primary bg-primary-light text-primary font-bold' : 'border-border text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

export default function DiagnosisExamBody({ answer, onChange }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-bold mb-1">취약 여부</div>
        <div className="flex gap-1">
          <ExamPill active={answer.verdict_yn === true} onClick={() => onChange({ verdict_yn: true })}>
            Y · 취약
          </ExamPill>
          <ExamPill active={answer.verdict_yn === false} onClick={() => onChange({ verdict_yn: false })}>
            N · 안전
          </ExamPill>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold mb-1">취약 라인 (클릭 또는 입력)</div>
        <input
          type="text"
          value={(answer.cited_lines || []).join(', ')}
          onChange={(e) => {
            const arr = e.target.value.split(/[,\s]+/)
              .map(s => parseInt(s.trim(), 10))
              .filter(n => !isNaN(n) && n > 0);
            onChange({ cited_lines: [...new Set(arr)].sort((a, b) => a - b) });
          }}
          placeholder="3, 4, 5"
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-card-bg"
        />
      </div>
      <div>
        <div className="text-xs font-bold mb-1">근거 서술</div>
        <textarea
          value={answer.rationale_text || ''}
          onChange={(e) => onChange({ rationale_text: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-card-bg"
        />
      </div>
      <div>
        <div className="text-xs font-bold mb-1">수정 방안</div>
        <textarea
          value={answer.fix_text || ''}
          onChange={(e) => onChange({ fix_text: e.target.value })}
          rows={3}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-card-bg"
        />
      </div>
    </div>
  );
}
