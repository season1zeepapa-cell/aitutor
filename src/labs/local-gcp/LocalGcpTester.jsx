// REBUILD23~26 / REBUILD28 — Cloud Run 일심동체 추론 테스터 (앱+모델 같은 컨테이너, 6 엔진 동거)
//
// /api/local-infer 호출 + model_key + engine 선택.
// REBUILD28 (2026-04-30) — 6 엔진 전수 (Ollama / llama-server / vLLM / llama-cpp-python / onnxruntime-genai / transformers).
// SGLang / TensorRT-LLM 은 사용 패턴 미스매치로 deferred (placeholder 완전 제거).
//
// Cloud Run 인스턴스 안의 daemon 은 살아있는 동안 warm. min-instances=0 이라 idle 5분 후 종료 →
// 다시 첫 호출 cold (~30~60s, GPU+모델 mount 시간).

import { useState, useEffect, useRef } from 'react';
import QuestionPicker from '../../components/lab/QuestionPicker';
import PromptEditor from '../../components/lab/PromptEditor';
import { buildLabMessages, buildPromptPreview } from '../../lib/lab/promptBuilder';
import { LAB_MODELS } from '../../lib/lab/models';

// 추론 엔진 (REBUILD28 §0.3 — 일심동체 6 엔진 전수)
const ENGINES = [
  { key: 'ollama',            label: 'Ollama',            status: 'active',  note: 'Go wrapper, 모델 자동관리 ⭐' },
  { key: 'llama-server',      label: 'llama-server',      status: 'active',  note: 'C++ native, GGUF 가장 빠름' },
  { key: 'vllm',              label: 'vLLM',              status: 'active',  note: 'GPU 최강, PagedAttention' },
  { key: 'llama-cpp-python',  label: 'llama-cpp-python',  status: 'active',  note: 'Python CUDA wheel (sub-server)' },
  { key: 'onnxruntime-genai', label: 'onnxruntime-genai', status: 'active',  note: 'Microsoft ONNX CUDA' },
  { key: 'transformers',      label: 'transformers',      status: 'active',  note: 'HF PyTorch (sub-server)' },
];

const MODELS = LAB_MODELS;

export default function LocalGcpTester() {
  const [engineKey, setEngineKey] = useState('ollama');
  const [modelKey, setModelKey] = useState(MODELS[0].key);
  const [question, setQuestion] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [answer, setAnswer] = useState('');
  const [meta, setMeta] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [history, setHistory] = useState([]);
  const [maxTokens, setMaxTokens] = useState(2048);  // REBUILD29 — Qwen 한국어 해설은 256 으로 잘림 사례 (2026-04-30)
  const [temperature, setTemperature] = useState(0.3);
  const t0Ref = useRef(0);

  const currentEngine = ENGINES.find(e => e.key === engineKey) || ENGINES[0];
  const currentModel  = MODELS.find(m => m.key === modelKey)   || MODELS[0];

  // REBUILD29 §19 — QuestionPicker 가 문항 로딩 담당. 자체 fetchRandomQuestion 폐기.
  // 문항 변경 시 응답 클리어
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setAnswer('');
    setMeta(null);
    setError('');
    setShowAnswer(false);
  };

  // REBUILD29 §26 — PromptEditor 가 customMessages 전달 시 우선 사용, 없으면 기본 빌드
  const handleRun = async (customMessages = null) => {
    if (!question) return;
    setAnswer('');
    setMeta(null);
    setError('');
    setRunning(true);
    t0Ref.current = Date.now();

    // REBUILD29 §22 / §26 — 통합 promptBuilder (강력한 system + 보기별 해설 형식)
    // PromptEditor 가 사용자 편집 messages 전달 시 그것 우선 (system/user 사용자 정의)
    const messages = customMessages || buildLabMessages(question);

    try {
      const res = await fetch('/api/local-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          engine: engineKey,
          model_key: modelKey,
          messages,
          maxTokens,
          temperature,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);

      const totalMs = Date.now() - t0Ref.current;
      setAnswer(data.answer || '');
      setMeta({ ...data.meta, client_total_ms: totalMs });
      setHistory(h => [{
        time: new Date().toLocaleTimeString(),
        engine: data.meta?.engine,
        modelKey: data.meta?.model_key,
        modelName: data.meta?.model_name,
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
        <h1 className="text-lg font-bold text-text">☁️ 서버 통합 (서비스+추론엔진+모델)</h1>
        <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
      </header>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/30 px-3 py-2 text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed">
        ☁️ <b>일심동체 — 앱 + 모델 같은 Cloud Run 컨테이너</b> — 외부 API 0, GPU L4 24GB. 8 엔진 동거 (Phase 5-2: 6 active, 2 planned).
      </div>

      {/* 추론 엔진 선택 (REBUILD23 §3.4) */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">⚙️ 추론 엔진 ({ENGINES.length}종)</p>
        <div className="grid grid-cols-1 gap-1.5">
          {ENGINES.map(e => {
            const isActive = e.status === 'active';
            const isSelected = engineKey === e.key;
            return (
              <button
                key={e.key}
                onClick={() => isActive && setEngineKey(e.key)}
                disabled={running || !isActive}
                className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-border hover:border-emerald-500/40'
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

      {/* 모델 선택 카드 grid */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">📦 모델 선택 ({MODELS.length}종)</p>
        <div className="grid grid-cols-1 gap-1.5">
          {MODELS.map(m => (
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
          💡 첫 호출 시 Cloud Run 인스턴스 spawn + 모델 자동 다운로드(Ollama)로 ~30~60s 소요. 이후 호출은 warm.
        </p>
      </div>

      {/* 콜드스타트 안내 */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        ⚠️ <b>첫 호출은 콜드</b> — Cloud Run 인스턴스 spawn + GPU mount + 모델 다운로드. min-instances=0 이므로 idle 5분 후 다시 cold.
      </div>

      {/* REBUILD29 §19 — 문항 입력 (DB 선택 + 외부 붙여넣기 통합) */}
      <QuestionPicker question={question} onChange={handleQuestionChange} />


      {/* 파라미터 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-text-secondary mb-1">
            Temperature <span className="text-primary font-mono">{temperature.toFixed(2)}</span>
          </label>
          <input type="range" min={0} max={2} step={0.05} value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))} disabled={running} className="w-full" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary mb-1">
            Max Tokens <span className="text-primary font-mono">{maxTokens}</span>
          </label>
          <input type="range" min={64} max={4096} step={64} value={maxTokens}
            onChange={e => setMaxTokens(parseInt(e.target.value, 10))} disabled={running} className="w-full" />
        </div>
      </div>

      {/* REBUILD29 §26 — PromptEditor (섹션별 편집 + 최종 메시지 미리보기, 펼침 기본 접힘) */}
      {question && (
        <PromptEditor
          question={question}
          model={modelKey}
          running={running}
          onSubmit={(messages) => handleRun(messages)}
        />
      )}

      {/* 추론 시작 (default 빠른 호출) */}
      {question && (
        <button onClick={() => handleRun()} disabled={running}
          className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold">
          {running
            ? `☁️ ${currentEngine.label} × ${currentModel.name} 추론 중…`
            : `✨ ${currentEngine.label} × ${currentModel.name} 로 해설 생성 (default)`}
        </button>
      )}

      {/* 프롬프트 보기 */}
      {question && (
        <div className="rounded-xl border border-border bg-card-bg">
          <button type="button" onClick={() => setShowPrompt(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-text">
            <span>🔍 최종 입력 프롬프트 보기</span>
            <span className="text-text-secondary">{showPrompt ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {showPrompt && (() => {
            const promptText = buildPromptPreview(question);
            return (
              <div className="px-4 pb-3 border-t border-border">
                <pre className="text-[11px] bg-bg p-2 rounded whitespace-pre-wrap break-words leading-relaxed text-text max-h-72 overflow-y-auto border border-border mt-2">
{promptText}
                </pre>
              </div>
            );
          })()}
        </div>
      )}

      {/* 메트릭 */}
      {meta && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1.5 text-xs">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">📊 메트릭</p>
          <div>엔진: <b>{meta.engine || '-'}</b></div>
          <div>모델: <b>{meta.model_name || meta.model_key}</b></div>
          <div>추론: <b>{meta.infer_ms} ms</b></div>
          <div>서버 총: <b>{meta.total_ms} ms</b> · 클라이언트: {meta.client_total_ms} ms</div>
        </div>
      )}

      {/* 응답 */}
      {answer && (
        <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/30 p-4">
          <p className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-2">☁️ {currentEngine.label} × {currentModel.name}</p>
          <p className="text-sm text-cyan-900 dark:text-cyan-100 whitespace-pre-wrap leading-relaxed">
            {answer}
          </p>
        </div>
      )}

      {/* 에러 */}
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
                <span className="font-bold text-text text-[10px]">{h.engine} × {h.modelName}</span>
                <span className="text-text-secondary">
                  추론 {h.infer_ms}ms · 총 {h.total_ms}ms · {h.chars}자
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-secondary text-center pt-4">
        REBUILD29 §22 — 서버 통합 (서비스+추론엔진+모델 한 Cloud Run 컨테이너, 6 엔진)
      </p>
    </div>
  );
}
