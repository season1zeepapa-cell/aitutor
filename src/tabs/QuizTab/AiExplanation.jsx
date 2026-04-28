// AI 해설 패널 — 버튼=항상 새 생성, 저장 버튼으로 수동 저장, 저장된 해설 조회/삭제
// REBUILD18: 'local' 4번째 프로바이더 추가 — 디바이스 AI (WebGPU 온디바이스 추론)
import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import useSSE from '../../hooks/useSSE';
import { llmSettings } from '../../constants/llm';
import TracePanel from './TracePanel';
import mdToHtml from '../../lib/mdToHtml';
import useDeviceAi from './local-ai-bridge/useDeviceAi';
import DeviceAiCard from './local-ai-bridge/DeviceAiCard';

const PROVIDERS = [
  { key: 'gemini', label: 'Gemini', color: '#4285f4' },
  { key: 'openai', label: 'OpenAI', color: '#10a37f' },
  { key: 'claude', label: 'Claude', color: '#d97706' },
  { key: 'local',  label: '온디바이스 AI', color: '#16a34a', deviceLocal: true },
];

export default function AiExplanation({ questionId, questionBody, choices, answer, categoryName, imageUrl }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(null);
  const [lastResult, setLastResult] = useState('');
  const [savedExplanations, setSavedExplanations] = useState({});
  const [showSaved, setShowSaved] = useState(null);
  const [traceEvents, setTraceEvents] = useState([]);
  const [includeImage, setIncludeImage] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('');
  const traceStart = useRef(null);
  const { content, isStreaming, error, startStream, stopStream, reset } = useSSE();

  // 디바이스 AI (REBUILD18) — 외부 API 와 별도 흐름 (백엔드 미경유)
  const deviceAi = useDeviceAi();
  const [localStreamText, setLocalStreamText] = useState('');
  const [localGenerating, setLocalGenerating] = useState(false);

  // 관리자 글로벌 토글 — /api/config 에서 enabled 플래그 받아 PROVIDERS 필터링
  // (REBUILD18 §11 후속 — LlmProviderToggleCard 와 연동)
  const [providerEnabled, setProviderEnabled] = useState({
    gemini: true, openai: true, claude: true, local: true,
  });
  useEffect(() => {
    apiGet('/api/config').then(cfg => {
      setProviderEnabled({
        gemini: cfg.provider_gemini_enabled !== false,
        openai: cfg.provider_openai_enabled !== false,
        claude: cfg.provider_claude_enabled !== false,
        local:  cfg.provider_local_enabled  !== false,
      });
    }).catch(() => {});
  }, []);
  const visibleProviders = PROVIDERS.filter(p => providerEnabled[p.key]);

  // 이미지를 base64로 변환
  const fetchImageBase64 = async (src) => {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

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

  // 디바이스 AI 해설 생성 (백엔드 미경유, useDeviceAi 훅 사용)
  const generateLocalExplanation = async () => {
    if (!deviceAi.pipeReady) return;
    setActiveTab('local');
    setShowSaved(null);
    setLastResult('');
    setLocalStreamText('');
    reset();
    traceStart.current = Date.now();
    setTraceEvents([]);

    const rawChoices = (typeof choices === 'string' ? JSON.parse(choices) : choices || []);
    const choiceList = rawChoices.map(c => (typeof c === 'object' && c !== null) ? (c.text || c.label || '') : c);
    const modelLabel = deviceAi.MODEL_META[deviceAi.activeSize]?.label || 'Local';

    addTrace({ type: 'start', label: '디바이스 AI 해설 시작', status: 'running',
      detail: `${modelLabel} | 문제 #${questionId} | WebGPU 추론` });

    setLocalGenerating(true);
    const t0 = Date.now() - traceStart.current;
    let acc = '';
    try {
      const result = await deviceAi.generate({
        question: { id: questionId, body: questionBody, choices: choiceList, answer },
        maxTokens: 512,
        temperature: 0.3,
        onToken: (t) => {
          acc += t;
          setLocalStreamText(acc);
        },
      });
      const t1 = Date.now() - traceStart.current;
      setLastResult(result);
      addTrace({ type: 'end', label: '응답 완료', status: 'ok',
        detail: `${result.length}자 · ${((t1 - t0) / 1000).toFixed(1)}s · 외부 전송 0`,
        ts: t0, endTs: t1, expandable: result });
    } catch (e) {
      addTrace({ type: 'error', label: '응답 실패', status: 'error', detail: e.message });
    } finally {
      setLocalGenerating(false);
    }
  };

  // 해설 생성 — 항상 새로 생성
  const generateExplanation = async (provider) => {
    // 디바이스 AI 분기 (백엔드 미경유)
    if (provider === 'local') {
      // 활성화 안 된 경우 — 활성화 카드 표시 (DeviceAiCard 가 처리)
      if (!deviceAi.pipeReady) {
        setActiveTab('local');
        return;
      }
      return generateLocalExplanation();
    }

    const p = PROVIDERS.find(x => x.key === provider);
    const providerSettings = llmSettings[provider] || {};
    const model = providerSettings.model || 'gemini-2.5-flash';
    setActiveTab(provider);
    setShowSaved(null);
    setLastResult('');
    setLocalStreamText('');
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
    let prompt = `당신은 ${roleName} 전문 강사입니다. 주어진 문제를 분석하고 다음 형식으로 답변해주세요:\n\n**정답**: [번호 및 내용]\n\n**해설**: [상세한 해설]\n\n**핵심 키워드**: [관련 법령, 용어 등]\n\n---\n\n[문제]\n${questionBody}\n\n[선택지]\n${choiceText}\n\n[정답] ${CIRCLE[answer - 1]}\n\n각 선택지가 왜 맞고 틀린지 간결하게 설명해주세요.`;
    if (extraPrompt.trim()) {
      prompt += `\n\n[추가 지시사항]\n${extraPrompt.trim()}`;
    }

    // 이미지 base64 변환 (이미지 포함 체크 시)
    let imageBase64 = null;
    let mimeType = null;
    if (includeImage && imageUrl) {
      addTrace({ type: 'start', label: '이미지 변환 중', status: 'running', detail: imageUrl });
      imageBase64 = await fetchImageBase64(imageUrl);
      mimeType = 'image/png';
      addTrace({ type: 'start', label: imageBase64 ? '이미지 변환 완료' : '이미지 변환 실패', status: imageBase64 ? 'ok' : 'error',
        detail: imageBase64 ? `base64 ${(imageBase64.length / 1024).toFixed(0)}KB` : '이미지를 불러올 수 없음' });
    }

    addTrace({ type: 'prompt', label: 'LLM 프롬프트', status: 'ok',
      detail: `${p.label} (${model}) | temp=${providerSettings.temperature ?? 0.3} | max=${providerSettings.maxTokens || 2048} | 이미지: ${imageBase64 ? '✅' : '❌'}`,
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
      imageBase64, mimeType,
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

  // 저장 — local 인 경우 provider='local-{size}', model=HF id 형태로
  const saveExplanation = async () => {
    if (!lastResult || !activeTab) return;
    let providerVal, modelVal;
    if (activeTab === 'local') {
      const sz = deviceAi.activeSize;
      providerVal = `local-${sz}`;
      modelVal = deviceAi.MODEL_REGISTRY[sz]?.id || sz;
    } else {
      const ps = llmSettings[activeTab] || {};
      providerVal = activeTab;
      modelVal = ps.model || 'gemini-2.5-flash';
    }
    try {
      const htmlContent = mdToHtml(lastResult);
      const data = await apiPost('/api/explanations', {
        action: 'save', question_id: questionId, provider: providerVal, model: modelVal, content: htmlContent,
      });
      setSavedExplanations(prev => ({
        ...prev,
        [providerVal]: { id: data.id, content: lastResult, provider: providerVal, model: modelVal },
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

  // 표시할 내용 — local 인 경우 deviceAi 의 스트림 텍스트
  const isLocalActive = activeTab === 'local';
  const isLocalStreaming = isLocalActive && localGenerating;
  const localContent = localStreamText || lastResult;

  const displayContent = isLocalActive
    ? (showSaved ? savedExplanations[showSaved]?.content : localContent)
    : (isStreaming ? content : (showSaved ? savedExplanations[showSaved]?.content : (lastResult || content)));
  const displayProvider = showSaved || activeTab;
  const anyStreaming = isStreaming || isLocalStreaming;

  return (
    <div className="space-y-3">
      {/* 옵션: 이미지 포함 + 추가 지시사항 */}
      <div className="flex items-center gap-3 flex-wrap">
        {imageUrl && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeImage} onChange={e => setIncludeImage(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer" />
            <span className="text-xs text-text-secondary font-medium">이미지 포함</span>
          </label>
        )}
        <input value={extraPrompt} onChange={e => setExtraPrompt(e.target.value)}
          placeholder="AI 추가 지시사항 입력 (예: 관련 법령 조문도 알려줘, 쉽게 설명해줘)"
          autoCapitalize="none" autoCorrect="off" autoComplete="off"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-border bg-input-bg text-text text-xs
            placeholder:text-text-secondary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
      </div>

      {/* 프로바이더 버튼 — 항상 새로 생성 */}
      <div className="flex gap-2">
        {visibleProviders.map(p => {
          // local 은 device.supported === false 면 버튼 숨김 (REBUILD18 §8 위험 완화)
          if (p.key === 'local' && deviceAi.device && !deviceAi.device.supported) return null;
          // 저장본 키 — 외부는 'gemini' 등, 로컬은 'local-{size}'
          const savedKey = p.key === 'local'
            ? Object.keys(savedExplanations).find(k => k.startsWith('local-'))
            : p.key;
          const hasSaved = !!(savedKey && savedExplanations[savedKey]);
          const isActive = activeTab === p.key && !showSaved;
          const ps = llmSettings[p.key] || {};
          // local 은 활성 모델 라벨, 외부는 기본 모델명
          const modelShort = p.key === 'local'
            ? (deviceAi.activeSize ? deviceAi.MODEL_META[deviceAi.activeSize]?.label?.replace('Qwen 3.5 ', 'Q').replace('Gemma 4 ', 'G') : '미활성')
            : (ps.model || '').replace('gemini-', '').replace('gpt-', '').replace('claude-', '').replace('-preview', '');
          const localActiveBadge = p.key === 'local' && deviceAi.pipeReady ? '⚡' : '';
          return (
            <button key={p.key}
              onClick={() => generateExplanation(p.key)}
              disabled={anyStreaming}
              className={`flex-1 py-2 px-1.5 rounded-xl text-center transition-all duration-200 border
                ${isActive ? 'border-current shadow-sm' : 'border-border hover:border-current/30'}
                ${anyStreaming ? 'opacity-40 cursor-not-allowed' : ''}`}
              style={{ color: p.color, background: isActive ? `${p.color}10` : 'transparent' }}>
              <div className="text-xs font-bold">
                {p.key === 'local' ? '📱 ' : ''}{p.label}{localActiveBadge && ` ${localActiveBadge}`}
              </div>
              <div className="text-[9px] opacity-70 font-medium mt-0.5 truncate">{modelShort}</div>
              {hasSaved && <div className="text-[8px] mt-0.5 opacity-50">저장됨</div>}
            </button>
          );
        })}
      </div>

      {/* 디바이스 AI — local 탭 활성 + 활성화 안 됨 시 카드 표시 (REBUILD18) */}
      {activeTab === 'local' && !showSaved && (
        <DeviceAiCard
          device={deviceAi.device}
          verdicts={deviceAi.verdicts}
          activeSize={deviceAi.activeSize}
          pipeReady={deviceAi.pipeReady}
          progress={deviceAi.progress}
          activating={deviceAi.activating}
          isDownloading={deviceAi.isDownloading}
          generating={localGenerating}
          error={deviceAi.error}
          MODEL_REGISTRY={deviceAi.MODEL_REGISTRY}
          MODEL_META={deviceAi.MODEL_META}
          onActivate={async (size) => {
            const ok = await deviceAi.activate(size);
            // 활성화 성공 + 문제 있으면 즉시 추론 (사용자 흐름 짧게)
            if (ok && questionId) await generateLocalExplanation();
          }}
          onGenerate={generateLocalExplanation}
        />
      )}

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
              {/* local 의 경우 활성 모델 라벨 표시 */}
              {displayProvider === 'local' || displayProvider?.startsWith?.('local-')
                ? `📱 ${deviceAi.MODEL_META[deviceAi.activeSize]?.label || '온디바이스 AI'} 해설`
                : `${PROVIDERS.find(p => p.key === displayProvider)?.label} 해설`}
              {anyStreaming && <span className="pulse-soft ml-1">생성 중...</span>}
              {showSaved && <span className="ml-1 text-text-secondary font-normal">(저장본)</span>}
            </span>
            {/* 저장 버튼 — 새로 생성된 결과가 있고, 스트리밍 중이 아닐 때 */}
            {!anyStreaming && lastResult && !showSaved && activeTab && (
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
