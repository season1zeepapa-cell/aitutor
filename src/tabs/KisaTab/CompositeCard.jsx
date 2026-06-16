// 복합실기(composite) 풀이 카드 — 마이그 005 신규 유형.
// 구성:
//   1. 문제 본문(body)
//   2. 산출물(artifacts) 3종 — 탭 전환 (요구사항정의서/아키텍처설계서/개발가이드)
//      · 개발가이드의 code 는 CodeBlock 으로 표시
//   3. report_template.sections 기반 진단보고서 작성 textarea(들)
//   onSubmit({ report_text }) 로 작성 보고서 전달.
import { useMemo, useState } from 'react';
import CodeBlock from '../../components/CodeBlock';

export default function CompositeCard({ question, onSubmit, disabled }) {
  const artifacts = Array.isArray(question.artifacts) ? question.artifacts : [];
  const sections = Array.isArray(question.report_template?.sections)
    ? question.report_template.sections
    : [];

  const [activeTab, setActiveTab] = useState(0);
  // 섹션별 작성 내용 — { [섹션key]: text }
  const [sectionText, setSectionText] = useState({});

  // report_template.sections 가 있으면 섹션별 textarea, 없으면 단일 textarea
  const useSections = sections.length > 0;
  const [singleText, setSingleText] = useState('');

  // 섹션 라벨/키 정규화 (문자열 또는 {title}/{label} 객체 모두 지원)
  const sectionList = useMemo(() => sections.map((s, i) => {
    if (typeof s === 'string') return { key: `s${i}`, label: s };
    return { key: s.key || s.id || `s${i}`, label: s.title || s.label || s.name || `섹션 ${i + 1}`, hint: s.hint || s.placeholder };
  }), [sections]);

  // 보고서 텍스트 합성 (섹션이 있으면 "## 라벨\n내용" 형태로 조합)
  const composeReport = () => {
    if (!useSections) return singleText.trim();
    return sectionList
      .map(s => {
        const t = (sectionText[s.key] || '').trim();
        return t ? `## ${s.label}\n${t}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
  };

  const reportText = composeReport();
  const canSubmit = reportText.length > 0 && !disabled;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ report_text: reportText });
  };

  return (
    <div className="space-y-3">
      {/* 문제 본문 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{question.body}</div>
      </div>

      {/* 산출물 — 탭 전환 */}
      {artifacts.length > 0 && (
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <div className="text-xs font-bold text-text-secondary mb-2">📦 산출물</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {artifacts.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === i
                    ? 'bg-primary text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary'
                }`}
              >
                {a.type || a.title || `산출물 ${i + 1}`}
              </button>
            ))}
          </div>
          {artifacts[activeTab] && <ArtifactView artifact={artifacts[activeTab]} language={question.code_language || question.language} />}
        </div>
      )}

      {/* 진단보고서 작성 */}
      <div className="rounded-xl bg-card-bg border border-border p-3 space-y-2">
        <div className="text-xs font-bold text-text-secondary">📝 진단보고서 작성</div>
        {useSections ? (
          sectionList.map(s => (
            <div key={s.key}>
              <div className="text-xs font-bold mb-1">{s.label}</div>
              <textarea
                value={sectionText[s.key] || ''}
                onChange={(e) => setSectionText(prev => ({ ...prev, [s.key]: e.target.value }))}
                disabled={disabled}
                placeholder={s.hint || '내용을 작성하세요...'}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </div>
          ))
        ) : (
          <textarea
            value={singleText}
            onChange={(e) => setSingleText(e.target.value)}
            disabled={disabled}
            placeholder="진단보고서를 작성하세요 (정탐/오탐 판정, 근거, 조치 방안 등)..."
            rows={8}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card-bg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
      >
        제출
      </button>
    </div>
  );
}

/** 산출물 1종 표시 — title/content + (개발가이드) code 는 CodeBlock */
export function ArtifactView({ artifact, language }) {
  if (!artifact) return null;
  return (
    <div className="space-y-2">
      {artifact.title && (
        <div className="text-sm font-bold">{artifact.title}</div>
      )}
      {artifact.content && (
        <div className="text-xs leading-relaxed whitespace-pre-wrap text-text-secondary"
             style={{ wordBreak: 'keep-all' }}>
          {artifact.content}
        </div>
      )}
      {artifact.code && (
        <CodeBlock code={artifact.code} language={artifact.code_language || language} />
      )}
    </div>
  );
}
