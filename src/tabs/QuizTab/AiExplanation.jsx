// AI 해설 패널 — 버튼=항상 새 생성, 저장 버튼으로 수동 저장, 저장된 해설 조회/삭제
import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import useSSE from '../../hooks/useSSE';
import { llmSettings } from '../../constants/llm';
import TracePanel from './TracePanel';

const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4' },
  { key: 'openai', label: 'OpenAI', color: '#10a37f' },
  { key: 'claude', label: 'Claude', color: '#d97706' },
];

export default function AiExplanation({ questionId, questionBody, choices, answer, categoryName }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(null);
  const [lastResult, setLastResult] = useState(''); // 마지막 생성 결과 (미저장)
  const [savedExplanations, setSavedExplanations] = useState({}); // provider → {id, content, model}
  const [showSaved, setShowSaved] = useState(null); // 열람 중인 저장 해설 provider
  const [traceEvents, setTraceEvents] = useState([]);
  const traceStart = useRef(null);
  const { content, isStreaming, error, startStream, stopStream, reset } = useSSE();

  const addTrace = (entry) => {
    const ts = Date.now() - (traceStart.current || Date.now());
    setTraceEvents(prev => [...prev, { ...entry, ts }]);
  };

  // 저장된 해설 조회
  useEffect(() => {
    if (!questionId) return;
    apiGet(`/api/explanations?action=list&question_id=${questionId}`)
      .then(data => {
        const map = {};
        (data.explanations || []).forEach(e => { map[e.provider] = e; });
        setSavedExplanations(map);
      })
      .catch(() => {});
  }, [questionId]);

  // 해설 생성 — 항상 새로 생성
  const generateExplanation = async (provider) => {
    const p = PROVIDERS.find(x => x.key === provider);
    const providerSettings = llmSettings[provider] || {};
    const model = providerSettings.model || 'gemini-2.5-flash';
    setActiveTab(provider);
    setShowSaved(null);
    setLastResult('');
    reset();

    traceStart.current = Date.now();
    setTraceEvents([]);

    addTrace({ type: 'start', label: '해설 요청 시작', status: 'running',
      detail: `${p.label} | ${model} | 문제 #${questionId}` });

    const CIRCLE = ['①', '②', '③', '④', '⑤'];
    const rawChoices = (typeof choices === 'string' ? JSON.parse(choices) : choices || []);
    const choiceList = rawChoices.map(c => (typeof c === 'object' && c !== null) ? (c.text || c.label || '') : c);
    const choiceText = choiceList.map((c, i) => `${CIRCLE[i]} ${c}`).join('\n');
    const roleName = categoryName || '자격증 시험';
    const prompt = `당신은 ${roleName} 전문 강사입니다. 주어진 문제를 분석하고 다음 형식으로 답변해주세요:\n\n**정답**: [번호 및 내용]\n\n**해설**: [상세한 해설]\n\n**핵심 키워드**: [관련 법령, 용어 등]\n\n---\n\n[문제]\n${questionBody}\n\n[선택지]\n${choiceText}\n\n[정답] ${CIRCLE[answer - 1]}\n\n각 선택지가 왜 맞고 틀린지 간결하게 설명해주세요.`;

    addTrace({ type: 'prompt', label: 'LLM 프롬프트', status: 'ok',
      detail: `${p.label} (${model}) | temp=${providerSettings.temperature ?? 0.3} | max=${providerSettings.maxTokens || 2048}`,
      expandable: prompt });

    addTrace({ type: 'stream', label: 'SSE 스트리밍', status: 'running',
      detail: `POST /api/${provider}` });

    const t0 = Date.now() - traceStart.current;
    const result = await startStream({
      provider, model, prompt,
      temperature: providerSettings.temperature ?? 0.3,
      maxTokens: providerSettings.maxTokens || 2048,
      thinkingBudget: providerSettings.thinkingBudget,
      thinkingLevel: providerSettings.thinkingLevel,
      reasoningEffort: providerSettings.reasoningEffort,
    });
    const t1 = Date.now() - traceStart.current;

    if (result) {
      setLastResult(result);
      addTrace({ type: 'end', label: '응답 완료', status: 'ok',
        detail: `${result.length}자`, ts: t0, endTs: t1,
        expandable: result.substring(0, 500) + (result.length > 500 ? '...' : '') });
    } else {
      addTrace({ type: 'error', label: '응답 실패', status: 'error',
        detail: error || '응답 없음', ts: t0, endTs: t1 });
    }
  };

  // 저장
  const saveExplanation = async () => {
    if (!lastResult || !activeTab) return;
    const ps = llmSettings[activeTab] || {};
    const model = ps.model || 'gemini-2.5-flash';
    try {
      const data = await apiPost('/api/explanations', {
        action: 'save', question_id: questionId, provider: activeTab, model, content: lastResult,
      });
      setSavedExplanations(prev => ({
        ...prev,
        [activeTab]: { id: data.id, content: lastResult, provider: activeTab, model },
      }));
      addTrace({ type: 'save', label: 'DB 저장 완료', status: 'ok', detail: `ID: ${data.id}` });
      toast('해설이 저장되었습니다.', 'success');
    } catch (err) {
      toast('저장 실패: ' + err.message, 'error');
    }
  };

  // 삭제
  const deleteExplanation = async (provider) => {
    const saved = savedExplanations[provider];
    if (!saved?.id) return;
    if (!confirm('저장된 해설을 삭제하시겠습니까?')) return;
    try {
      await apiPost('/api/explanations', { action: 'delete', id: saved.id });
      setSavedExplanations(prev => { const n = { ...prev }; delete n[provider]; return n; });
      if (showSaved === provider) setShowSaved(null);
      toast('해설이 삭제되었습니다.', 'success');
    } catch (err) { toast('삭제 실패: ' + err.message, 'error'); }
  };

  // 표시할 내용
  const displayContent = isStreaming ? content : (showSaved ? savedExplanations[showSaved]?.content : (lastResult || content));
  const displayProvider = showSaved || activeTab;

  return (
    <div className="space-y-3">
      {/* 프로바이더 버튼 — 항상 새로 생성 */}
      <div className="flex gap-2">
        {PROVIDERS.map(p => {
          const hasSaved = !!savedExplanations[p.key];
          const isActive = activeTab === p.key && !showSaved;
          const ps = llmSettings[p.key] || {};
          const modelShort = (ps.model || '').replace('gemini-', '').replace('gpt-', '').replace('claude-', '').replace('-preview', '');
          return (
            <button key={p.key}
              onClick={() => generateExplanation(p.key)}
              disabled={isStreaming}
              className={`flex-1 py-2 px-1.5 rounded-xl text-center transition-all duration-200 border
                ${isActive ? 'border-current shadow-sm' : 'border-border hover:border-current/30'}
                ${isStreaming ? 'opacity-40 cursor-not-allowed' : ''}`}
              style={{ color: p.color, background: isActive ? `${p.color}10` : 'transparent' }}>
              <div className="text-xs font-bold">{p.label}</div>
              <div className="text-[9px] opacity-70 font-medium mt-0.5 truncate">{modelShort}</div>
              {hasSaved && <div className="text-[8px] mt-0.5 opacity-50">저장됨</div>}
            </button>
          );
        })}
      </div>

      {/* 저장된 해설 목록 */}
      {Object.keys(savedExplanations).length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(savedExplanations).map(([provider, exp]) => {
            const p = PROVIDERS.find(x => x.key === provider);
            const isViewing = showSaved === provider;
            return (
              <div key={provider} className="flex items-center gap-1">
                <button onClick={() => { setShowSaved(isViewing ? null : provider); setActiveTab(null); reset(); }}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all
                    ${isViewing ? 'border-current bg-current/10' : 'border-border hover:border-current/30'}`}
                  style={{ color: p?.color }}>
                  {p?.label} 저장본 {isViewing ? '닫기' : '보기'}
                </button>
                <button onClick={() => deleteExplanation(provider)}
                  className="text-[10px] text-text-secondary hover:text-danger transition-colors" title="삭제">
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 스트리밍 중 중지 */}
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
              {PROVIDERS.find(p => p.key === displayProvider)?.label} 해설
              {isStreaming && <span className="pulse-soft ml-1">생성 중...</span>}
              {showSaved && <span className="ml-1 text-text-secondary font-normal">(저장본)</span>}
            </span>
            {/* 저장 버튼 — 새로 생성된 결과가 있고, 스트리밍 중이 아닐 때 */}
            {!isStreaming && lastResult && !showSaved && activeTab && (
              <button onClick={saveExplanation}
                className="text-[11px] font-bold text-primary bg-card-bg border border-primary/30 px-3 py-1 rounded-lg hover:bg-primary hover:text-white transition-all">
                💾 저장
              </button>
            )}
          </div>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        </div>
      )}

      {/* 에러 */}
      {error && !isStreaming && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-danger fade-in">
          {error}
        </div>
      )}

      {/* 트래킹 */}
      <TracePanel events={traceEvents} />
    </div>
  );
}
