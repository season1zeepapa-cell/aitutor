// 경량 마크다운 렌더러 (의존성 0)
// 지원: #~#### 헤더, > 인용, GFM 표, -/* /숫자 리스트, **볼드**, `코드`, 문단, ``` 코드블록
// KISA 설계기준 실습(practice/*.md) 렌더용. 표·헤더·리스트 위주라 풀 마크다운 파서 불필요.

// 인라인 토큰: **볼드**, `코드`
function renderInline(text) {
  const parts = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      parts.push(
        <strong key={parts.length} className="font-semibold text-text">{m[2]}</strong>
      );
    } else if (m[3] !== undefined) {
      parts.push(
        <code key={parts.length} className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[0.85em] font-mono">{m[3]}</code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MarkdownLite({ source = '' }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (!line.trim()) { i++; continue; }

    // 헤더 (#~####)
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      const lvl = h[1].length;
      const cls = {
        1: 'text-lg font-bold mt-1 mb-2',
        2: 'text-base font-bold mt-4 mb-2 pb-1 border-b border-border',
        3: 'text-sm font-bold mt-3 mb-1 text-primary',
        4: 'text-sm font-semibold mt-2 mb-1',
      }[lvl];
      blocks.push(<div key={i} className={cls}>{renderInline(h[2])}</div>);
      i++; continue;
    }

    // 인용 (연속 > 줄)
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <div key={i} className="border-l-2 border-primary/30 pl-3 py-1 my-2 text-xs text-text-secondary space-y-0.5">
          {quote.map((q, qi) => <div key={qi}>{renderInline(q)}</div>)}
        </div>
      );
      continue;
    }

    // GFM 표 (| … | + 다음 줄이 |---| 구분행)
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const parseRow = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = parseRow(line);
      i += 2; // 헤더 + 구분행 스킵
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={i} className="my-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {header.map((c, ci) => (
                  <th key={ci} className="border border-border bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1.5 text-left font-semibold whitespace-nowrap">{renderInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className="border border-border px-2 py-1.5 align-top leading-relaxed">{renderInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 리스트 (연속 -/* /숫자.)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={i} className="my-1.5 space-y-1 list-disc pl-5 text-sm">
          {items.map((it, ii) => <li key={ii} className="leading-relaxed">{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }

    // 코드블록 폴백 (```)
    if (line.trim().startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // 닫는 ```
      blocks.push(
        <pre key={i} className="my-2 p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-xs font-mono overflow-x-auto">{code.join('\n')}</pre>
      );
      continue;
    }

    // 일반 문단
    blocks.push(<p key={i} className="my-1.5 text-sm leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="markdown-lite">{blocks}</div>;
}
