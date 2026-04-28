// KISA 드릴 전용 CodeBlock — 라인 번호 + Prism 신택스 하이라이팅 + 라인 클릭 토글
// FEATURE_SPEC §5.1 요구사항:
//   - 좌측에 라인 번호
//   - 우측에 하이라이팅된 코드
//   - 라인 클릭 시 cited_lines에 토글 추가(실기만)
//   - 이미 지목한 라인은 시각적 강조
//
// 사용 예:
//   <CodeBlock code={question.vulnerable_code} language={question.code_language}
//              citedLines={cited} onLineClick={setCited} />
import { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
// 지원 언어들을 번들에 포함 (트리 셰이킹 방지)
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';

// 공용 언어 키 → Prism grammar 이름 매핑
const LANG_MAP = {
  java: 'java',
  python: 'python',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  kotlin: 'java',  // kotlin grammar 없으면 java로 폴백
  swift: 'java',
};

/** code 문자열을 라인 배열로 분리하고 선행 라인 번호(원문에 포함된)를 떼어냄 */
function normalizeLines(code) {
  if (!code) return [];
  // seed의 vulnerable_code는 "1  public User ...\n2  ..." 형태로 라인 번호가 이미 들어있음
  // 각 라인 첫 부분의 숫자+공백 패턴을 분리
  return code.split('\n').map((line, idx) => {
    const match = line.match(/^\s*(\d+)\s{1,4}(.*)$/);
    if (match) {
      return { lineNo: parseInt(match[1]), content: match[2] };
    }
    return { lineNo: idx + 1, content: line };
  });
}

export default function CodeBlock({
  code,
  language = 'java',
  citedLines = [],
  onLineClick = null,   // null이면 클릭 불가 (MCQ 같이 라인 지목 불필요한 경우)
  className = '',
}) {
  const lines = useMemo(() => normalizeLines(code), [code]);
  const grammar = Prism.languages[LANG_MAP[language] || 'java'] || Prism.languages.java;

  const toggleLine = (lineNo) => {
    if (!onLineClick) return;
    const set = new Set(citedLines);
    if (set.has(lineNo)) set.delete(lineNo);
    else set.add(lineNo);
    onLineClick([...set].sort((a, b) => a - b));
  };

  return (
    <div className={`kisa-code-block rounded-lg border border-border bg-card-bg overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-border text-[11px] text-text-secondary">
        <span className="font-mono">{language}</span>
        {onLineClick && (
          <span className="ml-auto text-[10px] text-text-secondary">
            💡 취약 라인을 클릭하세요
            {citedLines.length > 0 && ` · ${citedLines.length}줄 선택됨`}
          </span>
        )}
      </div>
      <pre className="m-0 p-0 text-[13px] leading-[1.6] overflow-x-auto">
        <code className="block font-mono">
          {lines.map(({ lineNo, content }) => {
            const highlighted = Prism.highlight(content || ' ', grammar, language);
            const isCited = citedLines.includes(lineNo);
            const clickable = !!onLineClick;
            return (
              <div
                key={lineNo}
                onClick={clickable ? () => toggleLine(lineNo) : undefined}
                className={`flex ${clickable ? 'cursor-pointer hover:bg-primary-light/50' : ''} ${
                  isCited ? 'bg-amber-100 dark:bg-amber-900/40' : ''
                } transition-colors`}
                role={clickable ? 'button' : undefined}
                aria-pressed={clickable ? isCited : undefined}
              >
                <span className="inline-block w-10 shrink-0 pl-2 pr-2 text-right text-text-secondary select-none border-r border-border">
                  {lineNo}
                </span>
                <span className="pl-3 pr-3 whitespace-pre" dangerouslySetInnerHTML={{ __html: highlighted }} />
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
