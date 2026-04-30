// REBUILD26 §3.2 / REBUILD28 §0.2 — 격리 추론 실험실 (server-infer)
//
// 격리 service (aitutor-inference Cloud Run) 의 6 엔진 비교 모드 UI.
// /api/iso-infer 가 메인 service 의 SA 로 ID 토큰 발급해 격리 service 에 forward.
//
// 일심동체 (LocalGcpTester) 와 같은 model_key 사용 → 양쪽 비교 가능.
// REBUILD28 — SGLang / TensorRT-LLM 은 deferred 처리, placeholder 완전 제거.

import { useState, useEffect, useRef } from 'react';
import QuestionPicker from '../../components/lab/QuestionPicker';
import PromptEditor from '../../components/lab/PromptEditor';
import ParamSliders from '../../components/lab/ParamSliders';
import ErrorBanner from '../../components/lab/ErrorBanner';
import { buildLabMessages } from '../../lib/lab/promptBuilder';
import { LAB_MODELS } from '../../lib/lab/models';

// 엔진 카탈로그는 격리 service 의 /infer/models 응답으로 동적 로드.
// fallback (네트워크 실패 시 표시) — REBUILD29 §17: 6 엔진 모두 active (격리 service deploy 완료).
const FALLBACK_ENGINES = [
  { key: 'llama-cpp-python',  label: 'llama-cpp-python',  status: 'active', note: 'Phase 7-1 — Python wrapper' },
  { key: 'onnxruntime-genai', label: 'onnxruntime-genai', status: 'active', note: 'Phase 7-1 — Microsoft ONNX' },
  { key: 'transformers',      label: 'transformers',      status: 'active', note: 'Phase 7-1 — HF PyTorch' },
  { key: 'ollama',            label: 'Ollama',            status: 'active', note: 'Phase 7-2a — GPU L4' },
  { key: 'llama-server',      label: 'llama-server',      status: 'active', note: 'Phase 7-2b — REBUILD29 lazy spawn' },
  { key: 'vllm',              label: 'vLLM',              status: 'active', note: 'Phase 7-2c — GPU L4 lazy spawn' },
];

const FALLBACK_MODELS = LAB_MODELS;

export default function ServerInferTester() {
  const [engines, setEngines] = useState(FALLBACK_ENGINES);
  const [models,  setModels]  = useState(FALLBACK_MODELS);
  const [engineKey, setEngineKey] = useState('llama-cpp-python');
  const [modelKey,  setModelKey]  = useState('qwen3-1.7b');  // 격리 service CPU = 작은 모델 권장
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [answer, setAnswer] = useState('');
  const [meta, setMeta] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [history, setHistory] = useState([]);
  const [maxTokens, setMaxTokens] = useState(2048);  // REBUILD29 — Qwen 한국어 해설은 256 으로 잘림 사례 (2026-04-30)
  const [temperature, setTemperature] = useState(0.3);
  const [catalogError, setCatalogError] = useState('');
  const t0Ref = useRef(0);

  const currentEngine = engines.find(e => e.key === engineKey) || engines[0];
  const currentModel  = models.find(m => m.key === modelKey)   || models[0];

  // ─── 초기 로드: 격리 service 카탈로그 (REBUILD29 §17 — 429 cold start retry) ─────
  useEffect(() => {
    (async () => {
      // 격리 service idle 후 cold start 시 첫 호출이 429 → 최대 3회 retry (지수 backoff)
      const MAX_RETRIES = 3;
      const BASE_DELAY_MS = 2000;
      let lastErr = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const r = await fetch('/api/iso-infer?action=models', { credentials: 'include' });
          if (r.status === 429 && attempt < MAX_RETRIES - 1) {
            // Cold start retry — 2초, 4초, 8초 대기
            setCatalogError(`격리 service 기동 중... (${attempt + 1}/${MAX_RETRIES} 재시도)`);
            await new Promise(res => setTimeout(res, BASE_DELAY_MS * Math.pow(2, attempt)));
            continue;
          }
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || d.message || `HTTP ${r.status}`);
          if (Array.isArray(d.engines) && d.engines.length) setEngines(d.engines);
          if (Array.isArray(d.models)  && d.models.length)  setModels(d.models);
          if (d.default_engine) setEngineKey(d.default_engine);
          if (d.default_model)  setModelKey(d.default_model);
          setCatalogError('');  // 성공 시 에러 메시지 클리어
          return;
        } catch (e) {
          lastErr = e;
          if (attempt === MAX_RETRIES - 1) {
            setCatalogError(`카탈로그 로드 실패 (fallback 사용): ${e.message}`);
          }
        }
      }
    })();
  }, []);

  // REBUILD29 §19 — QuestionPicker 가 문항 로딩 담당. 변경 시 응답 클리어
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setAnswer('');
    setMeta(null);
    setError('');
    setShowAnswer(false);
  };

  // ─── 추론 호출 ───────────────────────────────────────
  const handleRun = async (customMessages = null) => {
    if (!question) return;
    setAnswer('');
    setMeta(null);
    setError('');
    setRunning(true);
    t0Ref.current = Date.now();

    // REBUILD29 §22 / §26 — PromptEditor customMessages 우선
    const messages = customMessages || buildLabMessages(question);

    try {
      const res = await fetch('/api/iso-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          engine: engineKey,
          model_key: modelKey,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail || data;
        throw new Error(detail.message || data.error || `HTTP ${res.status}`);
      }
      const totalMs = Date.now() - t0Ref.current;
      setAnswer(data.answer || '');
      setMeta({ ...data.meta, client_total_ms: totalMs });
      setHistory(h => [{
        time: new Date().toLocaleTimeString(),
        engine: data.meta?.engine,
        modelKey: data.meta?.model_key,
        infer_ms: data.meta?.infer_ms,
        total_ms: data.meta?.total_ms,
        chars: (data.answer || '').length,
      }, ...h].slice(0, 10));
    } catch (e) {
      const totalMs = Date.now() - t0Ref.current;
      setError(`${e.message} (${totalMs}ms 후)`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">🧪 서버 분리 (추론엔진+모델)</h1>
        <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
      </header>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 px-3 py-2 text-[11px] text-violet-900 dark:text-violet-200 leading-relaxed">
        🧪 <b>격리 service (aitutor-inference)</b> — 메인 앱과 별도 Cloud Run (us-east4, GPU L4 24GB).
        <br />
        <span className="opacity-80">REBUILD29 — 6 엔진 모두 active 동거 (Ollama / llama-server / vLLM / llama-cpp-python / onnxruntime-genai / transformers). 양쪽 비교 가능.</span>
        <br />
        <span className="opacity-70 text-[10px]">⚠ idle 5분 후 인스턴스 종료 → 첫 호출 cold start (vLLM 1~3분, llama-server 30~60초). 429 시 자동 재시도.</span>
      </div>

      {catalogError && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
          ⚠ {catalogError}
        </div>
      )}

      {/* 엔진 선택 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">⚙️ 추론 엔진 ({engines.length}종)</p>
        <div className="grid grid-cols-1 gap-1.5">
          {engines.map(e => {
            const isActive = e.status === 'active';
            const isSelected = engineKey === e.key;
            return (
              <button
                key={e.key}
                onClick={() => isActive && setEngineKey(e.key)}
                disabled={running || !isActive}
                className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-border hover:border-violet-500/40'
                } ${(running || !isActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="text-sm font-bold text-text">{e.label}</div>
                  <div className="text-[10px] text-text-secondary">
                    {isActive ? '✅ active' : '⏳ planned'}
                  </div>
                </div>
                <div className="text-[10px] text-text-secondary mt-0.5">{e.note}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 모델 선택 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">📦 모델 선택 ({models.length}종)</p>
        <div className="grid grid-cols-1 gap-1.5">
          {models.map(m => (
            <button
              key={m.key}
              onClick={() => setModelKey(m.key)}
              disabled={running}
              className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                modelKey === m.key
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-border hover:border-cyan-500/40'
              } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="text-sm font-bold text-text">{m.name}</div>
                <div className="text-[10px] text-text-secondary">{m.org} · {m.size}</div>
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">{m.note}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-secondary opacity-70 pt-1">
          💡 첫 호출 시 격리 service 가 HuggingFace 에서 모델을 lazy 다운로드 → CPU 로 ~1~3분 소요. 이후 warm.
        </p>
      </div>

      {/* 콜드/CPU 안내 */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        ⚠ <b>Phase 7-2a 진행 중</b> — 격리 service GPU L4 활성. 4B 모델은 첫 호출 콜드 ~3분, 이후 warm. llama-server / vLLM (Phase 7-2b/c) 활성 후 더 빠른 속도 가능.
      </div>

      {/* REBUILD29 §19 — 문항 입력 (DB 선택 + 외부 붙여넣기 통합) */}
      <QuestionPicker question={question} onChange={handleQuestionChange} />


      {/* 파라미터 — REBUILD30 §0.4 #4 ParamSliders 통합 */}
      <ParamSliders
        temperature={temperature}
        onTemperatureChange={setTemperature}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        disabled={running}
      />

      {/* REBUILD29 §26 — PromptEditor (섹션별 편집) */}
      {question && (
        <PromptEditor
          question={question}
          model={modelKey}
          running={running}
          onSubmit={(messages) => handleRun(messages)}
        />
      )}

      {question && (
        <button onClick={() => handleRun()} disabled={running}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold">
          {running
            ? `🧪 ${currentEngine?.label} × ${currentModel?.name} 격리 추론 중…`
            : `🚀 ${currentEngine?.label} × ${currentModel?.name} 로 격리 추론 (default)`}
        </button>
      )}

      {/* REBUILD30 §0.4 #5 ErrorBanner 통합 (compact variant) */}
      <ErrorBanner message={error} icon="❌" variant="compact" />

      {answer && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-2">
          <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
            ✅ 격리 추론 결과 ({meta?.engine} · {meta?.infer_ms}ms / 총 {meta?.client_total_ms}ms)
          </p>
          <pre className="text-xs whitespace-pre-wrap leading-relaxed text-text">{answer}</pre>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card-bg p-3 space-y-1.5">
          <p className="text-xs font-bold text-text">📊 호출 이력 (최근 {history.length})</p>
          <ul className="space-y-1">
            {history.map((h, i) => (
              <li key={i} className="text-[10px] text-text-secondary font-mono flex justify-between">
                <span>{h.time} · {h.engine} · {h.modelKey}</span>
                <span>{h.infer_ms}ms / {h.chars}자</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
