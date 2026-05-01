// HF Inference Providers 실험실 — REBUILD22 §x (Phase 3 — 동적 카탈로그)
//
// 모델 카탈로그는 /api/hf-models 에서 동적 fetch (122개 router live 모델, 1h 캐시).
// 운전면허 문항 무작위 + 정답 토글 + 프롬프트 보기 + 메트릭 + 이력 (lab 공통 패턴).
// 자유 프롬프트 모드 — 영상정보관리사 5종 + 일반 평가 4종 프리셋

import { useState, useEffect, useRef } from 'react';
import {
  PROMPT_PRESETS, CIRCLE,
  buildExamMessages, calcCost, usdToKrw, fmtCtx, fmtPrice, CAPABILITY_META,
} from './lib/models';
import { chat as hfChat, fetchModelCatalog } from './lib/hfClient';
import ModelCatalog from './components/ModelCatalog';
import QuestionPicker from '../../components/lab/QuestionPicker';
import ParamSliders from '../../components/lab/ParamSliders';
import PromptEditor from '../../components/lab/PromptEditor';

const TABS = [
  { id: 'exam', label: '🎓 시험 문제 모드', desc: '운전면허 무작위 문항으로 추론 비교' },
  { id: 'prompt', label: '💬 자유 프롬프트', desc: '영상정보관리사 / 일반 평가 프리셋' },
];

// fallback default — 카탈로그 fetch 실패 시
const FALLBACK_MODEL_ID = 'google/gemma-4-31B-it';

export default function HfPlayground() {
  // ─── 카탈로그 ─────────────────────────────
  const [catalog, setCatalog] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedId, setSelectedId] = useState(FALLBACK_MODEL_ID);

  useEffect(() => {
    setLoadingCatalog(true);
    fetchModelCatalog()
      .then(data => {
        setCatalog(data.models || []);
        setCacheInfo({
          cacheHit: data.cacheHit,
          cacheAgeMs: data.cacheAgeMs,
          total: data.total,
        });
        // 첫 로드 시 자동 선택 — 안전한 default 가 카탈로그에 있으면 그걸로, 없으면 첫 번째 모델
        if (data.models?.length) {
          const has = data.models.find(m => m.id === FALLBACK_MODEL_ID);
          if (!has) setSelectedId(data.models[0].id);
        }
      })
      .catch(e => setCatalogError(e.message || String(e)))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const selectedModel = catalog.find(m => m.id === selectedId);

  // ─── 모드/공통 입력 상태 ─────────────────────────────
  const [tab, setTab] = useState('exam');
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [systemMsg, setSystemMsg] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(1024);  // REBUILD29 — 외부 API (HF Inference) 토큰당 과금 → 보수적 유지

  // ─── 추론/응답/이력 ─────────────────────────────
  const [stream, setStream] = useState('');
  const [meta, setMeta] = useState(null);
  const [done, setDone] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const t0Ref = useRef(0);
  const firstTokenAtRef = useRef(0);
  const abortRef = useRef(null);

  // REBUILD29 §19 — QuestionPicker 가 문항 로딩 담당
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setError('');
    setStream('');
    setMeta(null);
    setDone(null);
    setShowAnswer(false);
  };

  function applyPreset(preset) {
    setSystemMsg(preset.system);
    setUserMsg(preset.user);
  }

  // REBUILD30 §18 — handleRun 이 customMessages 받게 변경 (PromptEditor 호환).
  // exam 모드에서 PromptEditor 가 messages 보내면 그대로 사용, 아니면 기존 build.
  const handleRun = async (customMessages = null) => {
    setStream('');
    setMeta(null);
    setDone(null);
    setError('');
    setRunning(true);
    t0Ref.current = Date.now();
    firstTokenAtRef.current = 0;

    let messages;
    if (customMessages) {
      messages = customMessages;
    } else if (tab === 'exam') {
      if (!question) { setRunning(false); return; }
      const built = buildExamMessages(question);
      messages = [
        { role: 'system', content: built.system },
        { role: 'user',   content: built.user },
      ];
    } else {
      if (!userMsg.trim()) { setRunning(false); return; }
      messages = [];
      if (systemMsg.trim()) messages.push({ role: 'system', content: systemMsg });
      messages.push({ role: 'user', content: userMsg });
    }

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await hfChat({
        model: selectedId,
        messages,
        temperature, maxTokens,
        action: 'lab_hf_chat',
        signal: ac.signal,
        onMeta: (m) => setMeta(m),
        onText: (t) => {
          if (!firstTokenAtRef.current) {
            firstTokenAtRef.current = Date.now() - t0Ref.current;
          }
          setStream(prev => prev + t);
        },
      });
      const finalDone = {
        first_token_ms: firstTokenAtRef.current,
        latency_ms: r.serverLatencyMs || r.totalMs,
        total_ms: r.totalMs,
        ttft_ms: r.ttftMs,
        input_tokens: r.inputTokens,
        output_tokens: r.outputTokens,
        output_chars: r.fullText.length,
        cost: calcCost({
          model: selectedModel,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
        }),
      };
      setDone(finalDone);
      setHistory(h => [{
        time: new Date().toLocaleTimeString(),
        modelId: selectedId,
        modelName: selectedModel?.name || selectedId,
        tab,
        ...finalDone,
      }, ...h].slice(0, 10));
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  const examPrompt = tab === 'exam' && question ? buildExamMessages(question) : null;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">🤗 외부 추론 라우팅 (HF Inference)</h1>
        <div className="flex items-center gap-2">
          <a href="/lab/hf/compare" className="text-xs px-2 py-1 rounded-full bg-primary-light text-primary border border-primary/40 font-semibold hover:bg-primary hover:text-white transition-colors">
            ⚖️ 비교 모드
          </a>
          <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
        </div>
      </header>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        🤗 <b>Hugging Face Inference Providers</b> — Together / SambaNova / Groq / Novita 등 14개 provider 자동 라우팅.
        외부 inference 서비스 사용 (요청 본문이 외부로 전송됨에 유의).
      </div>

      {/* 카탈로그 로드 상태 */}
      {loadingCatalog && (
        <div className="text-center text-xs text-text-secondary py-4">
          📚 모델 카탈로그 로드 중…
        </div>
      )}
      {catalogError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/30 p-3 text-xs text-red-900 dark:text-red-200">
          ⚠ 카탈로그 로드 실패: {catalogError}
        </div>
      )}

      {/* 현재 선택된 모델 — 항상 표시 */}
      {!loadingCatalog && selectedModel && (
        <div className="rounded-xl border-2 border-primary bg-primary-light p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[10px] text-text-secondary">현재 선택</div>
              <div className="text-base font-bold text-text break-all leading-tight">
                {selectedModel.name}
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">{selectedModel.org}</div>
            </div>
            <button
              onClick={() => setShowCatalog(s => !s)}
              disabled={running}
              className="text-[11px] px-2.5 py-1 rounded-full bg-card-bg border border-primary/40 text-primary font-semibold hover:bg-primary hover:text-white transition-colors disabled:opacity-40"
            >
              {showCatalog ? '✕ 닫기' : '📚 모델 변경'}
            </button>
          </div>

          {/* capability 배지 */}
          {(() => {
            const caps = Object.keys(selectedModel.capabilities).filter(k => selectedModel.capabilities[k]);
            return caps.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {caps.map(cap => (
                  <span key={cap} className={`text-[10px] px-2 py-0.5 rounded-full border ${CAPABILITY_META[cap].color}`}>
                    {CAPABILITY_META[cap].label}
                  </span>
                ))}
              </div>
            ) : null;
          })()}

          {/* meta */}
          <div className="grid grid-cols-3 gap-2 text-[10px] text-text-secondary pt-1 border-t border-primary/20">
            <div>
              <div className="opacity-70">컨텍스트</div>
              <div className="text-text font-bold text-sm">{fmtCtx(selectedModel.maxContextLength)}</div>
            </div>
            <div>
              <div className="opacity-70">입력 (저렴)</div>
              <div className="text-text font-bold text-sm">{fmtPrice(selectedModel.pricing.minIn)}</div>
            </div>
            <div>
              <div className="opacity-70">Live Provider</div>
              <div className="text-text font-bold text-sm">{selectedModel.liveProviderCount} / {selectedModel.providerCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* 카탈로그 (펼치기) */}
      {showCatalog && !loadingCatalog && catalog.length > 0 && (
        <ModelCatalog
          catalog={catalog}
          selectedId={selectedId}
          cacheInfo={cacheInfo}
          disabled={running}
          onSelect={(id) => {
            setSelectedId(id);
            setShowCatalog(false);
          }}
        />
      )}

      {/* 모드 탭 */}
      <div className="flex gap-1.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={running}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? 'bg-primary text-white' : 'bg-card-bg border border-border text-text hover:border-primary/40'
            } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-text-secondary text-center -mt-2">
        {TABS.find(t => t.id === tab)?.desc}
      </p>

      {/* === 시험 문제 모드 — REBUILD29 §19 통합 QuestionPicker === */}
      {tab === 'exam' && (
        <QuestionPicker question={question} onChange={handleQuestionChange} />
      )}

      {/* REBUILD30 §18 — exam 모드에서 PromptEditor (Qwen 강제 4 섹션 + 미리보기) */}
      {tab === 'exam' && question && (
        <PromptEditor
          question={question}
          model={selectedId}
          running={running}
          onSubmit={(messages) => handleRun(messages)}
        />
      )}

      {/* === 자유 프롬프트 모드 === */}
      {tab === 'prompt' && (
        <div className="rounded-xl border border-border bg-card-bg p-3 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-text-secondary mb-1">프리셋</label>
            <select
              onChange={e => {
                const sel = e.target.value;
                if (!sel) return;
                const [gi, pi] = sel.split(':').map(Number);
                const p = PROMPT_PRESETS[gi]?.items[pi];
                if (p) applyPreset(p);
              }}
              disabled={running}
              defaultValue=""
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50"
            >
              <option value="">— 프리셋 선택 / 직접 입력 —</option>
              {PROMPT_PRESETS.map((g, gi) => (
                <optgroup key={gi} label={g.group}>
                  {g.items.map((p, pi) => (
                    <option key={pi} value={`${gi}:${pi}`}>{p.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary mb-1">시스템 메시지 (선택)</label>
            <textarea
              value={systemMsg}
              onChange={e => setSystemMsg(e.target.value)}
              disabled={running}
              rows={2}
              placeholder="모델 역할/태도 정의…"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50 resize-y font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary mb-1">사용자 메시지 *</label>
            <textarea
              value={userMsg}
              onChange={e => setUserMsg(e.target.value)}
              disabled={running}
              rows={5}
              placeholder="질문 / 지시문…"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-border text-xs text-text disabled:opacity-50 resize-y font-mono"
            />
          </div>
        </div>
      )}

      {/* 파라미터 — REBUILD30 §0.4 #4 ParamSliders 통합 */}
      <ParamSliders
        temperature={temperature}
        onTemperatureChange={setTemperature}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        disabled={running}
      />

      {/* 추론 / 중지 */}
      {running ? (
        <button onClick={handleCancel}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-sm font-bold">
          ⏹ 중지
        </button>
      ) : (
        <button onClick={handleRun}
          disabled={!selectedModel || (tab === 'exam' ? !question : !userMsg.trim())}
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold">
          ✨ {selectedModel?.name || '모델 선택 필요'} 로 {tab === 'exam' ? '해설 생성' : '응답 생성'}
        </button>
      )}

      {/* 최종 입력 프롬프트 */}
      {((tab === 'exam' && question) || (tab === 'prompt' && userMsg.trim())) && (
        <div className="rounded-xl border border-border bg-card-bg">
          <button type="button" onClick={() => setShowPrompt(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-text">
            <span>🔍 최종 입력 프롬프트 보기</span>
            <span className="text-text-secondary">{showPrompt ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {showPrompt && (() => {
            let promptText;
            if (tab === 'exam' && examPrompt) {
              promptText = `[system]\n${examPrompt.system}\n\n[user]\n${examPrompt.user}`;
            } else {
              promptText = `${systemMsg ? `[system]\n${systemMsg}\n\n` : ''}[user]\n${userMsg}`;
            }
            return (
              <div className="px-4 pb-3 border-t border-border">
                <div className="flex items-center justify-between mt-2 mb-1">
                  <span className="text-[10px] text-text-secondary">{promptText.length}자</span>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(promptText)}
                    className="text-[10px] text-primary hover:underline">📋 복사</button>
                </div>
                <pre className="text-[11px] bg-bg p-2 rounded whitespace-pre-wrap break-words leading-relaxed text-text max-h-72 overflow-y-auto border border-border">
{promptText}
                </pre>
              </div>
            );
          })()}
        </div>
      )}

      {/* 메트릭 */}
      {(meta || done) && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1.5 text-xs">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">📊 메트릭</p>
          {meta && (
            <>
              <div>모델: <b>{meta.model || selectedId}</b></div>
              {meta.id && <div className="text-text-secondary">request id: {meta.id}</div>}
            </>
          )}
          {done && (
            <>
              <div>첫 토큰: <b>{done.first_token_ms} ms</b></div>
              <div>전체 응답: <b>{done.latency_ms} ms</b> {done.total_ms !== done.latency_ms && <span className="text-text-secondary">(client {done.total_ms} ms)</span>}</div>
              <div>출력: {done.output_chars}자{done.output_tokens ? ` · ${done.output_tokens} 토큰` : ''}</div>
              {done.input_tokens && <div className="text-text-secondary">입력: {done.input_tokens} 토큰</div>}
              <div>추정 비용: <b>${done.cost.toFixed(6)}</b> <span className="text-text-secondary">≈ {usdToKrw(done.cost).toFixed(2)}원</span></div>
            </>
          )}
        </div>
      )}

      {/* 응답 */}
      {(stream || running) && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-4">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-2">
            🤗 {selectedModel?.name || selectedId} {tab === 'exam' ? '해설' : '응답'}
            {running && <span className="ml-1 pulse-soft">생성 중...</span>}
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap leading-relaxed">
            {stream || '대기 중…'}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-xs text-red-900 dark:text-red-200">
          ⚠ {error}
        </div>
      )}

      {/* 호출 이력 */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card-bg p-3">
          <p className="text-xs font-bold text-text mb-2">🕒 최근 호출 ({history.length})</p>
          <div className="space-y-1 text-[11px]">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 py-1 border-b border-border last:border-0 flex-wrap">
                <span className="text-text-secondary">{h.time}</span>
                <span className="text-[9px] px-1 rounded bg-bg text-text-secondary">{h.tab === 'exam' ? '시험' : '프롬'}</span>
                <span className="font-bold text-text">{h.modelName}</span>
                <span className="text-text-secondary">
                  첫토큰 {h.first_token_ms}ms · 전체 {h.latency_ms}ms · ${h.cost.toFixed(6)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-secondary text-center pt-4">
        REBUILD22 §x — HF Inference Providers (router.huggingface.co/v1)
      </p>
    </div>
  );
}
