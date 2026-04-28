// 실기 진단 카드 — FEATURE_SPEC §5.1
// 4단계 입력 폼:
//   1. 취약 여부 (Y/N)
//   2. 취약 라인 (코드 클릭 또는 수기 "3,4,5")
//   3. 근거 서술 (textarea + 힌트 카운터)
//   4. 수정 방안 [서술] / [코드] 탭
import { useState } from 'react';
import CodeBlock from '../../components/CodeBlock';
import { keywordHintText } from '../../lib/kisaScorer';

export default function DiagnosisCard({ question, onSubmit, disabled }) {
  const [verdict, setVerdict] = useState(null);       // true/false/null
  const [citedLines, setCitedLines] = useState([]);
  const [rationale, setRationale] = useState('');
  const [fixTab, setFixTab] = useState('text');       // 'text' | 'code'
  const [fixText, setFixText] = useState('');
  const [fixCode, setFixCode] = useState('');

  const handleCitedLinesInput = (str) => {
    // "3, 4, 5" 형태 문자열을 int 배열로
    const parsed = str.split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
    setCitedLines([...new Set(parsed)].sort((a, b) => a - b));
  };

  const canSubmit = verdict !== null && !disabled;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      verdict_yn: verdict,
      cited_lines: citedLines,
      rationale_text: rationale,
      fix_text: fixTab === 'text' ? fixText : '',
      fix_code: fixTab === 'code' ? fixCode : '',
    });
  };

  return (
    <div className="space-y-3">
      {/* 문제 본문 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{question.body}</div>
      </div>

      {/* 좌: 취약 코드 */}
      {question.vulnerable_code && (
        <CodeBlock
          code={question.vulnerable_code}
          language={question.code_language || question.language}
          citedLines={citedLines}
          onLineClick={disabled ? null : setCitedLines}
        />
      )}

      {/* 우: 4단계 입력 폼 */}
      <div className="space-y-3">
        {/* Step 1: 취약 여부 */}
        <FormStep num={1} label="취약 여부">
          <div className="flex gap-2">
            <Pill active={verdict === true} onClick={() => setVerdict(true)} disabled={disabled}>
              Y · 취약
            </Pill>
            <Pill active={verdict === false} onClick={() => setVerdict(false)} disabled={disabled}>
              N · 안전
            </Pill>
          </div>
        </FormStep>

        {/* Step 2: 취약 라인 */}
        <FormStep num={2} label="취약 라인" hint="코드 클릭 또는 직접 입력 (예: 3, 4, 5)">
          <input
            type="text"
            value={citedLines.join(', ')}
            onChange={(e) => handleCitedLinesInput(e.target.value)}
            disabled={disabled}
            placeholder="3, 4, 5"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
        </FormStep>

        {/* Step 3: 근거 서술 */}
        <FormStep
          num={3}
          label="근거 서술"
          hint={keywordHintText(rationale, question.rationale_keyword_count)}
        >
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            disabled={disabled}
            placeholder="약점의 원인과 공격 시나리오를 설명..."
            rows={4}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
        </FormStep>

        {/* Step 4: 수정 방안 — 탭 전환 */}
        <FormStep num={4} label="수정 방안" hint={keywordHintText(fixTab === 'text' ? fixText : fixCode, question.fix_keyword_count)}>
          <div className="flex gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => setFixTab('text')}
              disabled={disabled}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                fixTab === 'text' ? 'bg-primary text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary'
              }`}
            >
              서술
            </button>
            <button
              type="button"
              onClick={() => setFixTab('code')}
              disabled={disabled}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                fixTab === 'code' ? 'bg-primary text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary'
              }`}
            >
              코드
            </button>
          </div>
          {fixTab === 'text' ? (
            <textarea
              value={fixText}
              onChange={(e) => setFixText(e.target.value)}
              disabled={disabled}
              placeholder="어떻게 고쳐야 할지 서술하세요..."
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
          ) : (
            <textarea
              value={fixCode}
              onChange={(e) => setFixCode(e.target.value)}
              disabled={disabled}
              placeholder="// 안전한 코드 예시를 작성하세요..."
              rows={6}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
          )}
        </FormStep>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
        >
          제출
        </button>
      </div>
    </div>
  );
}

function FormStep({ num, label, hint, children }) {
  return (
    <div className="rounded-xl bg-card-bg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
          {num}
        </span>
        <span className="text-xs font-bold">{label}</span>
      </div>
      {children}
      {hint && <p className="mt-1.5 text-[10px] text-text-secondary">{hint}</p>}
    </div>
  );
}

function Pill({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-card-bg text-text border-border hover:bg-neutral-50 dark:hover:bg-neutral-800'
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
