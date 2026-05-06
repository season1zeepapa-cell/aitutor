// 통합 추론 테스터 — "매장 로컬 AI" 컨셉
//
// 통합 service 구조:
//   - 일심동체 (Express + Ollama 같은 컨테이너, localhost RTT ~1ms)
//   - 한 개 엔진 (Ollama) + 최소 3 모델 (학습 앱 전용 내장 AI)
//   - default qwen2.5:3b (한국어 강 + 영어 번역 가능)
//
// /api/local-infer 호출:
//   POST { model_key, messages, maxTokens, temperature }
//   GET  ?action=models / ?action=memory / ?action=health
//   POST ?action=unload-all / ?action=restart-container

import { useState, useEffect, useMemo, useRef } from 'react';
import QuestionPicker from '../../components/lab/QuestionPicker';
import PromptEditor from '../../components/lab/PromptEditor';
import ParamSliders from '../../components/lab/ParamSliders';
import MemoryCard from '../../components/lab/MemoryCard';
import { buildLabMessages } from '../../lib/lab/promptBuilder';

// 백엔드 응답 도달 전 임시 표시용 fallback (3 모델). /api/local-infer?action=models 가 진실 소스.
const FALLBACK_MODELS = [
  { key: 'qwen25-3b', name: 'Qwen 2.5 3B', org: 'Alibaba', size: '~1.9GB', note: '범용 / 한국어 강 / 영어 번역 강 (default)' },
  { key: 'gemma2-2b', name: 'Gemma 2 2B', org: 'Google',   size: '~1.6GB', note: '경량 / 다국어 / Qwen fallback' },
  { key: 'qwen35-4b', name: 'Qwen 3.5 4B', org: 'Alibaba', size: '~2.5GB', note: '고성능 / 한국어 강 / 영어 번역 강' },
];
const FALLBACK_DEFAULT_KEY = 'qwen25-3b';

export default function LocalGcpTester() {
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelKey, setModelKey] = useState(FALLBACK_DEFAULT_KEY);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [meta, setMeta] = useState(null);
  const [running, setRunning] = useState(false);
  // 구조화 에러 — { message, status, code, cause, elapsedMs, userAction, raw }
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState(0.3);
  const [catalogError, setCatalogError] = useState('');
  const [healthBusy, setHealthBusy] = useState(false);
  const t0Ref = useRef(0);
  const lastReqRef = useRef(null);

  const currentModel = useMemo(
    () => models.find(m => m.key === modelKey) || models[0],
    [models, modelKey]
  );

  // ─── 페이지 로드 시 백엔드 카탈로그 조회 (3 모델 + 동적 가용성) ─────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/local-infer?action=models', { credentials: 'include' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (Array.isArray(d?.models) && d.models.length > 0) {
          setModels(d.models);
          const nextDefault = d.default_model_key || d.default_model || d.default || FALLBACK_DEFAULT_KEY;
          // default 모델이 unavailable 이면 첫 사용 가능 모델로 fallback
          const nextKey =
            d.models.find(m => m.key === nextDefault && m.available !== false)?.key
            || d.models.find(m => m.available !== false)?.key
            || d.models[0]?.key
            || FALLBACK_DEFAULT_KEY;
          setModelKey(nextKey);
          setCatalogError('');
        }
      } catch (e) {
        setCatalogError(`카탈로그 로드 실패 (fallback 사용): ${e.message}`);
      }
    })();
  }, []);

  // ─── QuestionPicker 변경 시 응답 클리어 ───────────────────────────
  const handleQuestionChange = (q) => {
    setQuestion(q);
    setAnswer('');
    setMeta(null);
    setError(null);
  };

  // ─── 추론 호출 — Ollama 단일 엔진, engine 파라미터 없음 ────
  const handleRun = async (customMessages = null) => {
    if (!question) return;
    setAnswer('');
    setMeta(null);
    setError(null);
    setRunning(true);
    t0Ref.current = Date.now();

    const messages = customMessages || buildLabMessages(question);
    lastReqRef.current = { customMessages };

    let res, rawBody = '', data = null;
    try {
      res = await fetch('/api/local-infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model_key: modelKey,
          messages,
          maxTokens,
          temperature,
        }),
      });
    } catch (netErr) {
      const totalMs = Date.now() - t0Ref.current;
      setError({
        message: `브라우저-서버 연결 실패: ${netErr?.message || 'unknown'}`,
        code: 'CLIENT_NETWORK',
        cause: netErr?.message,
        elapsedMs: totalMs,
        userAction: '인터넷 연결 확인 후 다시 시도하거나, [서버 분리] 모드로 시도해주세요.',
      });
      setRunning(false);
      return;
    }

    try { rawBody = await res.text(); } catch {}
    try { data = JSON.parse(rawBody); } catch { data = null; }

    const totalMs = Date.now() - t0Ref.current;

    if (res.ok && data) {
      setAnswer(data.answer || '');
      setMeta({ ...data.meta, client_total_ms: totalMs });
      setHistory(h => [{
        time: new Date().toLocaleTimeString(),
        engine: data.meta?.engine || 'ollama',
        modelKey: data.meta?.model_key,
        modelName: data.meta?.model_name,
        infer_ms: data.meta?.infer_ms,
        total_ms: data.meta?.total_ms,
        chars: (data.answer || '').length,
      }, ...h].slice(0, 10));
    } else {
      const detail = data?.detail || {};
      setError({
        message: detail.message || data?.message || data?.error || `HTTP ${res.status}`,
        status: res.status,
        code: detail.code || data?.error || null,
        cause: detail.cause || null,
        elapsedMs: totalMs,
        userAction: res.status === 503
          ? 'Ollama 가 응답하지 않습니다. 컨테이너 cold start 일 수 있으니 30초 후 재시도해주세요.'
          : '다시 시도하거나 다른 모델을 선택해보세요.',
        raw: rawBody?.slice(0, 1500) || null,
      });
    }
    setRunning(false);
  };

  const handleRetry = () => handleRun(lastReqRef.current?.customMessages || null);

  const handleHealthCheck = async () => {
    setHealthBusy(true);
    try {
      const r = await fetch('/api/local-infer?action=health', { credentials: 'include' });
      const d = await r.json();
      const lines = [
        `🏥 통합 service 상태`,
        `Ollama (11434): ${d.ollama?.reachable ? '✅ OK' : '❌ DOWN'}`,
        ``,
        d.hint || '',
      ];
      alert(lines.filter(Boolean).join('\n'));
    } catch (e) {
      alert(`헬스 체크 실패: ${e.message}`);
    } finally {
      setHealthBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text">☁️ 서버 통합 (매장 로컬 AI)</h1>
        <a href="/lab" className="text-xs text-primary hover:underline">← 실험실</a>
      </header>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/30 px-3 py-2.5 text-[11px] text-cyan-900 dark:text-cyan-200 leading-relaxed space-y-1.5">
        <div>
          ☁️ <b>매장 로컬 AI</b> — 학습 앱 전용 내장 AI (Express + Ollama 같은 Cloud Run 컨테이너, asia-southeast1, 24Gi/6CPU + L4 GPU, localhost RTT ~1ms)
        </div>
        <div className="opacity-90">
          ⚙️ <b>Ollama 단일 엔진</b> + 최소 3 모델 (한국어 강 + 영어 번역 가능). 본업(DB/메모/Gemini API)과 같은 컨테이너에서 추론.
          다양한 엔진/모델은 <a href="/lab/server-infer" className="underline hover:no-underline">서버 분리 모드 →</a>
        </div>
      </div>

      {catalogError && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
          ⚠ {catalogError}
        </div>
      )}

      {/* 엔진 정보 뱃지 — 단일 엔진 */}
      <div className="rounded-xl border border-border bg-card-bg p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold text-text">⚙️ 추론 엔진</p>
          <span className="text-[10px] text-text-secondary">단일 엔진</span>
        </div>
        <div className="mt-2 p-2.5 rounded-lg border-2 border-cyan-500 bg-cyan-500/10">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-sm font-bold text-text">Ollama</div>
            <div className="text-[10px] text-text-secondary">✅ active</div>
          </div>
          <div className="text-[10px] text-text-secondary mt-0.5">
            Go wrapper · 모델 자동관리 · 매장 로컬 AI 단일 엔진
          </div>
        </div>
      </div>

      {/* 메모리 상태 카드 — Ollama + RAM + GPU + 두 회수 옵션
            🗑️ 모두 언로드 (warm 유지) — GPU VRAM + weights 만 회수, 본업 영향 0
            ♻️ 인스턴스 재시작 (메모리 100%) — 컨테이너 자체 종료, 본업도 5~10초 다운 */}
      <MemoryCard
        title="📊 통합 서버 메모리 상태"
        service="aitutor"
        endpoint="/api/local-infer?action=memory"
        unloadEndpoint="/api/local-infer?action=unload-all"
        restartEndpoint="/api/local-infer?action=restart-container"
        restartImpactWarning="통합 service 는 학습 앱 본업 (DB / 메모 / Gemini AI 해설 등) 도 같은 컨테이너입니다. 재시작 동안 본업도 잠시 다운됩니다 (~5~10초). 사용자 트래픽 적은 시간대 권장."
      />

      {/* 모델 선택 — 매장 로컬 AI 모델 카탈로그 */}
      <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
        <p className="text-xs font-bold text-text">
          📦 모델 선택 — Ollama 호환 {models.length}종 (매장 로컬 AI)
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {models.map(m => {
            const unavailable = m.available === false;
            const cardDisabled = running || unavailable;
            return (
              <button
                key={m.key}
                onClick={() => !unavailable && setModelKey(m.key)}
                disabled={cardDisabled}
                title={unavailable ? m.unavailable_reason || '자원 부족' : ''}
                className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                  unavailable
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 cursor-not-allowed'
                    : modelKey === m.key
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-border hover:border-cyan-500/40'
                } ${(running && !unavailable) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className={`text-sm font-bold ${unavailable ? 'text-amber-800 dark:text-amber-300' : 'text-text'}`}>
                    {m.name}
                    {unavailable && ' ⚠'}
                  </div>
                  <div className="text-[10px] text-text-secondary">{m.org} · {m.size}</div>
                </div>
                <div className="text-[10px] text-text-secondary mt-0.5">{m.note}</div>
                {unavailable && (
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                    🚫 사용 불가: {m.unavailable_reason || '자원 부족'}
                  </div>
                )}
              </button>
            );
          })}
          {models.length === 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              ⚠️ 모델 카탈로그를 받지 못했습니다. 잠시 후 다시 시도해주세요.
            </p>
          )}
        </div>
        <p className="text-[10px] text-text-secondary opacity-70 pt-1 leading-relaxed">
          💡 첫 호출 시 Cloud Run 인스턴스 spawn + Ollama lazy pull (~30초). 이후 warm.
          <br />
          📚 한국어 학습 + 영어 번역 (TOEIC 어휘 등) 가능. 다양한 엔진/모델은 서버 분리 모드.
        </p>
      </div>

      {/* 콜드스타트 안내 */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        ⚠️ <b>첫 호출은 콜드</b> — Cloud Run 인스턴스 spawn + GPU mount + 모델 pull. min-instances=0 이라 idle 5분 후 다시 cold.
      </div>

      <QuestionPicker question={question} onChange={handleQuestionChange} />

      <ParamSliders
        temperature={temperature}
        onTemperatureChange={setTemperature}
        maxTokens={maxTokens}
        onMaxTokensChange={setMaxTokens}
        disabled={running}
      />

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
          className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold">
          {running
            ? `☁️ Ollama × ${currentModel?.name} 추론 중…`
            : `✨ Ollama × ${currentModel?.name} 로 해설 생성`}
        </button>
      )}

      {/* 메트릭 */}
      {meta && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1.5 text-xs">
          <p className="font-bold text-emerald-900 dark:text-emerald-200">📊 메트릭</p>
          <div>엔진: <b>{meta.engine || 'ollama'}</b></div>
          <div>모델: <b>{meta.model_name || meta.model_key}</b></div>
          <div>추론: <b>{meta.infer_ms} ms</b></div>
          <div>서버 총: <b>{meta.total_ms} ms</b> · 클라이언트: {meta.client_total_ms} ms</div>
        </div>
      )}

      {/* 응답 */}
      {answer && (
        <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/30 p-4">
          <p className="text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-2">☁️ Ollama × {currentModel?.name}</p>
          <p className="text-sm text-cyan-900 dark:text-cyan-100 whitespace-pre-wrap leading-relaxed">
            {answer}
          </p>
        </div>
      )}

      {/* 에러 — 구조화 에러 + 재시도/헬스체크 버튼 */}
      {error && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-900 dark:text-red-200 break-words">
                {error.message}
              </p>
              <p className="text-[10px] text-red-700 dark:text-red-300 mt-1">
                {error.status && `HTTP ${error.status} · `}
                {error.code && `code=${error.code} · `}
                {error.elapsedMs != null && `${error.elapsedMs}ms 후`}
              </p>
            </div>
          </div>

          {error.cause && (
            <p className="text-[11px] text-red-800 dark:text-red-200 pl-6">
              <span className="font-semibold">원인:</span> <code className="break-all">{error.cause}</code>
            </p>
          )}

          {error.userAction && (
            <p className="text-[11px] text-red-900 dark:text-red-100 pl-6 leading-relaxed">
              <span className="font-semibold">👉 다음 단계:</span> {error.userAction}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pl-6 pt-1">
            <button
              type="button"
              onClick={handleRetry}
              disabled={running}
              className="text-[11px] px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold"
            >
              🔁 다시 시도
            </button>
            <button
              type="button"
              onClick={handleHealthCheck}
              disabled={healthBusy}
              className="text-[11px] px-3 py-1 rounded-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold"
            >
              {healthBusy ? '확인 중…' : '🏥 백엔드 상태 확인'}
            </button>
            <a
              href="/lab/server-infer"
              className="text-[11px] px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-text font-bold hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              🧪 서버 분리 모드로 임시 회피
            </a>
            {error.raw && (
              <details className="w-full pt-1">
                <summary className="text-[10px] text-red-700 dark:text-red-300 cursor-pointer select-none">전체 응답 보기 (디버그)</summary>
                <pre className="mt-1 bg-bg p-2 rounded text-[10px] text-text overflow-x-auto whitespace-pre-wrap break-all max-h-48">{error.raw}</pre>
              </details>
            )}
          </div>
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
        매장 로컬 AI — Express + Ollama 같은 컨테이너, 단일 엔진, 최소 catalog
      </p>
    </div>
  );
}
