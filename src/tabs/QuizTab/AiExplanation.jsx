// AI 해설 패널 — 3개 프로바이더 탭 + SSE 스트리밍
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import useSSE from '../../hooks/useSSE';

const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4', defaultModel: 'gemini-2.5-flash' },
  { key: 'openai', label: 'OpenAI', color: '#10a37f', defaultModel: 'gpt-4o-mini' },
  { key: 'claude', label: 'Claude', color: '#d97706', defaultModel: 'claude-sonnet-4-20250514' },
];

export default function AiExplanation({ questionId, questionBody, choices, answer }) {
  const [activeTab, setActiveTab] = useState(null);
  const [savedExplanations, setSavedExplanations] = useState({});
  const { content, isStreaming, error, startStream, stopStream, reset } = useSSE();

  // 저장된 해설 조회
  useEffect(() => {
    if (!questionId) return;
    apiGet(`/api/explanations?question_id=${questionId}`)
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
    setActiveTab(provider);
    reset();

    const CIRCLE = ['①', '②', '③', '④', '⑤'];
    const choiceList = (typeof choices === 'string' ? JSON.parse(choices) : choices || []);
    const choiceText = choiceList.map((c, i) => `${CIRCLE[i]} ${c}`).join('\n');

    const prompt = `다음 문제의 정답과 해설을 작성해주세요.\n\n[문제]\n${questionBody}\n\n[선택지]\n${choiceText}\n\n[정답] ${CIRCLE[answer - 1]}\n\n각 선택지가 왜 맞고 틀린지 간결하게 설명해주세요.`;

    const result = await startStream({
      provider,
      model: p.defaultModel,
      prompt,
      systemPrompt: '시험 문제 해설 전문가입니다. 간결하고 정확하게 설명합니다.',
      temperature: 0.3,
    });

    // 결과 저장
    if (result) {
      try {
        await apiPost('/api/explanations', {
          question_id: questionId,
          provider,
          model: p.defaultModel,
          content: result,
        });
        setSavedExplanations(prev => ({
          ...prev,
          [provider]: { content: result, provider, model: p.defaultModel },
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
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border
                ${isActive
                  ? 'border-current shadow-sm'
                  : 'border-border hover:border-current/30'
                }
                ${isStreaming && activeTab !== p.key ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              style={{ color: p.color, background: isActive ? `${p.color}10` : 'transparent' }}
            >
              {hasSaved ? `${p.label} ✓` : p.label}
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
