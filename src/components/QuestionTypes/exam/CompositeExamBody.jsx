// 복합실기(composite) 시험 본문 — 간소 버전.
// DiagnosisExamBody 패턴: { question, answer, onChange } 시그니처, autosave 호환.
// 산출물은 탭으로 열람 + 진단보고서 단일 textarea(report_text) 작성.
import { useState } from 'react';
import CodeBlock from '../../CodeBlock';

export default function CompositeExamBody({ question, answer, onChange }) {
  const artifacts = Array.isArray(question.artifacts) ? question.artifacts : [];
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-2">
      {/* 산출물 탭 (열람용) */}
      {artifacts.length > 0 && (
        <div>
          <div className="text-xs font-bold mb-1">📦 산출물</div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {artifacts.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  activeTab === i
                    ? 'bg-primary text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary'
                }`}
              >
                {a.type || a.title || `산출물 ${i + 1}`}
              </button>
            ))}
          </div>
          {artifacts[activeTab] && (
            <div className="rounded-lg border border-border bg-card-bg p-2 space-y-1.5">
              {artifacts[activeTab].title && (
                <div className="text-sm font-bold">{artifacts[activeTab].title}</div>
              )}
              {artifacts[activeTab].content && (
                <div className="text-xs leading-relaxed whitespace-pre-wrap text-text-secondary"
                     style={{ wordBreak: 'keep-all' }}>
                  {artifacts[activeTab].content}
                </div>
              )}
              {artifacts[activeTab].code && (
                <CodeBlock
                  code={artifacts[activeTab].code}
                  language={artifacts[activeTab].code_language || question.code_language || question.language}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* 진단보고서 작성 */}
      <div>
        <div className="text-xs font-bold mb-1">📝 진단보고서</div>
        <textarea
          value={answer.report_text || ''}
          onChange={(e) => onChange({ report_text: e.target.value })}
          rows={6}
          placeholder="진단보고서를 작성하세요 (정탐/오탐 판정, 근거, 조치 방안 등)..."
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-card-bg"
        />
      </div>
    </div>
  );
}
