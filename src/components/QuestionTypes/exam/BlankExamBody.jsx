// 단답형(blank) 시험 본문 — 기존 KisaExamMode 의 BlankTemplate 함수를 분리·승격.

function parseTemplate(template) {
  if (!template) return [];
  const parts = [];
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(template)) !== null) {
    if (m.index > lastIndex) parts.push({ text: template.slice(lastIndex, m.index) });
    parts.push({ blank: Number(m[1]) });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < template.length) parts.push({ text: template.slice(lastIndex) });
  return parts;
}

export default function BlankExamBody({ question, answer, onChange }) {
  const template = question.blank_template || '';
  const userValues = answer.blank_answers_user || [];
  const parts = parseTemplate(template);

  const getVal = (idx) => {
    const b = userValues.find(v => v.idx === idx);
    return b ? (b.text || '') : '';
  };
  const setVal = (idx, text) => {
    const map = new Map(userValues.map(v => [v.idx, v.text]));
    map.set(idx, text);
    const next = [...map.entries()].map(([i, t]) => ({ idx: i, text: t }));
    onChange({ blank_answers_user: next });
  };

  return (
    <div className="text-base leading-loose">
      {parts.map((p, i) => (
        typeof p.blank !== 'undefined' ? (
          <input
            key={`b-${i}`}
            type="text"
            value={getVal(p.blank)}
            onChange={e => setVal(p.blank, e.target.value)}
            aria-label={`빈칸 ${p.blank}`}
            className="inline-block mx-1 px-2 py-1 w-28 text-sm rounded-md border border-primary bg-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={`#${p.blank}`}
          />
        ) : <span key={`t-${i}`}>{p.text}</span>
      ))}
    </div>
  );
}
