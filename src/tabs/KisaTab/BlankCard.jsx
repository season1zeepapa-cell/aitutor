// 단답형(blank) 카드 — 문장 내 빈칸({{1}}, {{2}}...)에 들어갈 용어를 기입
// 서버가 제공하는 blank_template 을 토큰 단위로 분할하여 input을 inline으로 렌더.
import { useMemo, useState } from 'react';

// "Spring Security에서 {{1}} 필터는 {{2}} 공격을 방어한다."
// → 파싱 결과: [{text:"Spring Security에서 "}, {blank:1}, {text:" 필터는 "}, {blank:2}, {text:" 공격을 방어한다."}]
function parseTemplate(template) {
  if (!template || typeof template !== 'string') return [];
  const parts = [];
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(template)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ text: template.slice(lastIndex, m.index) });
    }
    parts.push({ blank: Number(m[1]) });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < template.length) {
    parts.push({ text: template.slice(lastIndex) });
  }
  return parts;
}

export default function BlankCard({ question, onSubmit, disabled }) {
  const parts = useMemo(() => parseTemplate(question.blank_template), [question.blank_template]);

  // 각 blank idx → 사용자 입력 문자열
  const blankIdxs = useMemo(() => {
    const set = new Set();
    for (const p of parts) if (typeof p.blank !== 'undefined') set.add(p.blank);
    return [...set].sort((a, b) => a - b);
  }, [parts]);

  const [values, setValues] = useState(() =>
    Object.fromEntries(blankIdxs.map(i => [i, '']))
  );

  const allFilled = blankIdxs.every(i => (values[i] || '').trim().length > 0);

  const handleSubmit = () => {
    if (!allFilled || disabled) return;
    const blank_answers_user = blankIdxs.map(i => ({
      idx: i,
      text: (values[i] || '').trim(),
    }));
    onSubmit({ blank_answers_user });
  };

  return (
    <div className="rounded-xl bg-card-bg border border-border p-4 space-y-4">
      {/* 문제 지시문 */}
      {question.body && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
          {question.body}
        </div>
      )}

      {/* 빈칸 포함 문장 — text 조각은 그대로, blank는 input으로 치환 */}
      <div className="text-base leading-loose">
        {parts.length === 0 ? (
          <span className="text-muted">문항 템플릿이 비어있습니다.</span>
        ) : (
          parts.map((p, i) => {
            if (typeof p.blank !== 'undefined') {
              return (
                <input
                  key={`blank-${i}`}
                  type="text"
                  value={values[p.blank] || ''}
                  onChange={e => setValues(v => ({ ...v, [p.blank]: e.target.value }))}
                  disabled={disabled}
                  aria-label={`빈칸 ${p.blank}`}
                  className="inline-block mx-1 px-2 py-1 w-28 text-sm rounded-md border border-primary bg-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                  placeholder={`#${p.blank}`}
                />
              );
            }
            return <span key={`t-${i}`}>{p.text}</span>;
          })
        )}
      </div>

      {/* 힌트 — 채워진 빈칸 개수 */}
      <div className="text-xs text-muted">
        빈칸 {blankIdxs.filter(i => (values[i] || '').trim()).length} / {blankIdxs.length} 입력됨
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allFilled || disabled}
        className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
      >
        제출
      </button>
    </div>
  );
}
