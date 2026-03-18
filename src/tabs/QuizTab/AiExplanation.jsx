// AI 해설 패널 — 3개 프로바이더 탭 + SSE 스트리밍
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import useSSE from '../../hooks/useSSE';
import { llmSettings } from '../../constants/llm';

const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4' },
  { key: 'openai', label: 'OpenAI', color: '#10a37f' },
  { key: 'claude', label: 'Claude', color: '#d97706' },
];

export default function AiExplanation({ questionId, questionBody, choices, answer }) {
  const [activeTab, setActiveTab] = useState(null);
  const [savedExplanations, setSavedExplanations] = useState({});
  const { content, isStreaming, error, startStream, stopStream, reset } = useSSE();

  // 저장된 해설 조회
  useEffect(() => {
    if (!questionId) return;
    apiGet(`/api/explanations?action=list&question_id=${questionId}`)
      .then(data => {
        const map = {};
        (data.explanations || []).forEach(e => {
          map[e.provider] = e;
        });
        setSavedExplanations(map);
      })
      .catch(() => {});
  }, [questionId]);

  // 해설 생성 요청
  const generateExplanation = async (provider) => {
    const p = PROVIDERS.find(x => x.key === provider);
    const providerSettings = llmSettings[provider] || {};
    setActiveTab(provider);
    reset();

    const CIRCLE = ['①', '②', '③', '④', '⑤'];
    const rawChoices = (typeof choices === 'string' ? JSON.parse(choices) : choices || []);
    const choiceList = rawChoices.map(c => (typeof c === 'object' && c !== null) ? (c.text || c.label || '') : c);
    const choiceText = choiceList.map((c, i) => `${CIRCLE[i]} ${c}`).join('\n');

    const prompt = `다음 문제의 정답과 해설을 작성해주세요.\n\n[문제]\n${questionBody}\n\n[선택지]\n${choiceText}\n\n[정답] ${CIRCLE[answer - 1]}\n\n각 선택지가 왜 맞고 틀린지 간결하게 설명해주세요.`;

    const result = await startStream({
      provider,
      model: providerSettings.model || 'gemini-2.5-flash',
      prompt,
      temperature: providerSettings.temperature ?? 0.3,
      maxTokens: providerSettings.maxTokens || 2048,
      thinkingBudget: providerSettings.thinkingBudget,
      thinkingLevel: providerSettings.thinkingLevel,
      reasoningEffort: providerSettings.reasoningEffort,
    });

    // 결과 저장
    if (result) {
      try {
        await apiPost('/api/explanations', {
          action: 'save',
          question_id: questionId,
          provider,
          model: providerSettings.model || 'gemini-2.5-flash',
          content: result,
        });
        setSavedExplanations(prev => ({
          ...prev,
          [provider]: { content: result, provider, model: providerSettings.model },
        }));
      } catch (err) {
        console.error('[AI] 해설 저장 실패:', err);
      }
    }
  };

  // 표시할 내용 결정
  const displayContent = activeTab
    ? (isStreaming ? content : (savedExplanations[activeTab]?.content || content))
    : null;

  return (
    <div className="space-y-3">
      {/* 프로바이더 탭 버튼 */}
      <div className="flex gap-2">
        {PROVIDERS.map(p => {
          const hasSaved = !!savedExplanations[p.key];
          const isActive = activeTab === p.key;
          const ps = llmSettings[p.key] || {};
          const modelShort = (ps.model || '').replace('gemini-', '').replace('gpt-', '').replace('claude-', '').replace('-preview', '');
          return (
            <button
              key={p.key}
              onClick={() => {
                if (hasSaved) {
                  setActiveTab(p.key);
                  reset();
                } else {
                  generateExplanation(p.key);
                }
              }}
              disabled={isStreaming && activeTab !== p.key}
              className={`flex-1 py-2 px-1.5 rounded-xl text-center transition-all duration-200 border
                ${isActive
                  ? 'border-current shadow-sm'
                  : 'border-border hover:border-current/30'
                }
                ${isStreaming && activeTab !== p.key ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              style={{ color: p.color, background: isActive ? `${p.color}10` : 'transparent' }}
            >
              <div className="text-xs font-bold">{hasSaved ? `${p.label} ✓` : p.label}</div>
              <div className="text-[9px] opacity-70 font-medium mt-0.5 truncate">{modelShort}</div>
            </button>
          );
        })}
      </div>

      {/* 스트리밍 중 중지 버튼 */}
      {isStreaming && (
        <div className="flex justify-center">
          <button onClick={stopStream}
            className="text-xs text-danger font-semibold px-3 py-1 rounded-lg border border-danger/30 hover:bg-danger/10 transition-colors">
            생성 중지
          </button>
        </div>
      )}

      {/* 해설 내용 */}
      {displayContent && (
        <div className="bg-primary-light border border-primary/10 rounded-xl p-4 fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary">
              {PROVIDERS.find(p => p.key === activeTab)?.label} 해설
              {isStreaming && <span className="pulse-soft ml-1">생성 중...</span>}
            </span>
          </div>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-danger fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
