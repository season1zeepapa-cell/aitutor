// WebLLM 추론 패널 — transformers.js 와 별도 엔진 (브라우저 WebGPU)
// 모델 다운로드 → 활성화 → 추론까지 self-contained.
// transformers.js 영역과 격리 (state, 캐시 모두 분리).
//
// transformers.js 패널과 동등한 UX 리디자인.
//   1. 활성 카드 강화 (메모리 사용 표시 + 단일 모델 정책 안내)
//   2. 캐시된 모델 목록 + 활성화/언로드/삭제 액션
//   3. 메모리/캐시 종합 카드 (RAM / GPU / 디스크)
//   4. DeviceCheck 배지 (WebGPU 지원 + 적합성)
//   5. 전체 캐시 비우기
//   6. 자동 언로드 토글 (페이지 떠날 때 — OllamaBridge 패턴)

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WEBLLM_REGISTRY, WEBLLM_KEYS, WEBLLM_META,
  loadWebllmPipe, explainWebllm, disposeWebllmPipe, webllmFitVerdict,
  getCachedWebllmModels, deleteWebllmModelCache, clearAllWebllmCache,
  getWebllmStorageEstimate,
} from '../lib/inference-webllm';
import { getMemoryInfo } from '../lib/deviceCheck';
import { applyQwenStrict } from '../../../lib/qwen';
import { buildLabMessages } from '../../../lib/lab/promptBuilder';
import PromptEditor from '../../../components/lab/PromptEditor';

function fmtGB(bytes) {
  if (!bytes) return '–';
  return (bytes / 1e9).toFixed(2) + ' GB';
}

export default function WebllmPanel({ question }) {
  const [modelKey, setModelKey] = useState('qwen25-7b');
  const [pipe, setPipe] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activating, setActivating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState(0.3);
  const [mem, setMem] = useState(null);

  // 캐시 / 메모리 / 자동 해제 state
  const [cachedModels, setCachedModels] = useState([]);   // [{key, model_id, label, approxSizeGB, cached}]
  const [storageEst, setStorageEst] = useState(null);     // {usage, quota}
  const [showMemPanel, setShowMemPanel] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheMsg, setCacheMsg] = useState('');
  const [autoUnloadOnLeave, setAutoUnloadOnLeave] = useState(true);
  const pipeRef = useRef(null);

  // 디바이스 정보 + 캐시 상태 초기 로드
  useEffect(() => { getMemoryInfo().then(setMem); }, []);

  const refreshCacheState = useCallback(async () => {
    try {
      const [models, est] = await Promise.all([
        getCachedWebllmModels(),
        getWebllmStorageEstimate(),
      ]);
      setCachedModels(models);
      setStorageEst(est);
    } catch (err) {
      console.warn('[webllm] cache state refresh 실패:', err);
    }
  }, []);

  useEffect(() => { refreshCacheState(); }, [refreshCacheState]);

  // 페이지 이탈 시 자동 언로드 (OllamaBridge 패턴 통일)
  useEffect(() => {
    return () => {
      if (autoUnloadOnLeave && pipeRef.current) {
        disposeWebllmPipe(pipeRef.current).catch(() => {});
      }
    };
  }, [autoUnloadOnLeave]);

  const meta = WEBLLM_REGISTRY[modelKey];
  const verdict = mem ? webllmFitVerdict(mem, meta) : null;

  const activate = async () => {
    setActivating(true);
    setError('');
    setProgress({ status: 'init', text: '모델 다운로드 시작…', progress: 0 });
    try {
      // 단일 모델 정책 — 다른 모델 활성 상태면 unload (사용자에게 자동 안내)
      if (pipeRef.current && pipeRef.current.key !== modelKey) {
        await disposeWebllmPipe(pipeRef.current);
        pipeRef.current = null;
        setPipe(null);
      }
      const newPipe = await loadWebllmPipe(modelKey, (report) => {
        setProgress({
          status: report.progress >= 1 ? 'ready' : 'loading',
          text: report.text || '로딩 중…',
          progress: report.progress || 0,
          timeElapsed: report.timeElapsed || 0,
        });
      });
      pipeRef.current = newPipe;
      setPipe(newPipe);
      setProgress({ status: 'ready', text: '활성화 완료', progress: 1 });
      await refreshCacheState();
    } catch (err) {
      console.error('[webllm] activate 실패:', err);
      setError(err.message || String(err));
      setProgress({ status: 'error', text: err.message });
    } finally {
      setActivating(false);
    }
  };

  const unload = async () => {
    if (pipeRef.current) await disposeWebllmPipe(pipeRef.current);
    pipeRef.current = null;
    setPipe(null);
    setProgress(null);
    setExplanation('');
  };

  // 모델별 캐시 삭제 (IndexedDB + Cache API)
  const deleteOneCache = async (key) => {
    setCacheBusy(true);
    setCacheMsg('');
    try {
      // 활성 모델이면 먼저 unload
      if (pipeRef.current && pipeRef.current.key === key) {
        await unload();
      }
      await deleteWebllmModelCache(key);
      setCacheMsg(`✓ [${WEBLLM_REGISTRY[key].label}] 캐시 삭제됨`);
      await refreshCacheState();
    } catch (err) {
      setCacheMsg(`❌ 삭제 실패: ${err.message}`);
    } finally {
      setCacheBusy(false);
    }
  };

  // 전체 캐시 비우기
  const clearAllCache = async () => {
    if (!confirm('모든 WebLLM 모델 캐시를 삭제할까요? 다음 활성화 시 다시 다운로드 (~5GB/모델).')) return;
    setCacheBusy(true);
    setCacheMsg('');
    try {
      if (pipeRef.current) await unload();
      const res = await clearAllWebllmCache();
      setCacheMsg(`✓ ${res.deleted.length}개 모델 캐시 삭제됨${res.failed.length ? ` (실패: ${res.failed.length})` : ''}`);
      await refreshCacheState();
    } catch (err) {
      setCacheMsg(`❌ 전체 삭제 실패: ${err.message}`);
    } finally {
      setCacheBusy(false);
    }
  };

  const generate = async (customMessages = null) => {
    if (!pipe || !question) return;
    setGenerating(true);
    setExplanation('');
    setError('');
    try {
      const choices = Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]');
      const baseMessages = customMessages || buildLabMessages({
        body: question.body,
        choices,
        answer: question.answer,
        answer_extra: question.answer_extra,
      });
      const messages = applyQwenStrict(baseMessages, modelKey);
      await explainWebllm(pipe, messages, {
        maxTokens, temperature,
        onToken: (delta) => setExplanation(prev => prev + delta),
      });
    } catch (err) {
      console.error('[webllm] generate 실패:', err);
      setError(err.message || String(err));
    } finally {
      setGenerating(false);
    }
  };

  // 캐시된 모델 / 적재 가능 모델 판별
  const cachedCount = cachedModels.filter(m => m.cached).length;
  const cachedSizeGB = cachedModels.filter(m => m.cached).reduce((s, m) => s + m.approxSizeGB, 0);

  return (
    <div className="space-y-3">
      {/* ─── 1) 디바이스 능력 배지 (DeviceCheckBadge 인라인) ─── */}
      {mem && (
        <div className="rounded-lg border border-border bg-card-bg px-3 py-2 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold text-text">🖥️ 디바이스</span>
          <span className={mem.gpu?.adapter === 'requested' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
            WebGPU {mem.gpu?.adapter === 'requested' ? '✅' : '❌'}
          </span>
          {mem.deviceMemoryGB && <span className="text-text-secondary">RAM <b className="text-text">{mem.deviceMemoryGB} GB</b></span>}
          {mem.gpu?.maxBufferSize && (
            <span className="text-text-secondary">GPU buf <b className="text-text">{(mem.gpu.maxBufferSize / 1024).toFixed(1)} GB</b></span>
          )}
        </div>
      )}

      {/* ─── 2) 메모리 / 캐시 종합 카드 (펼치기) ─── */}
      <div className="rounded-xl border border-border bg-card-bg">
        <button
          type="button"
          onClick={() => setShowMemPanel(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-text"
        >
          <span>🧠 메모리 / 캐시 현황 — 캐시된 모델 {cachedCount}개 ({cachedSizeGB.toFixed(1)} GB)</span>
          <span className="text-text-secondary">{showMemPanel ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {showMemPanel && (
          <div className="px-3 pb-3 border-t border-border space-y-2 text-[11px]">
            {/* 메모리 정보 */}
            {mem && (
              <div className="grid grid-cols-2 gap-2 text-text-secondary">
                <div>디바이스 RAM: <b className="text-text">{mem.deviceMemoryGB || '?'} GB</b></div>
                {mem.heap && <div>JS Heap: <b className="text-text">{(mem.heap.usedMB || 0).toFixed(0)} MB</b> / {(mem.heap.limitMB || 0).toFixed(0)} MB</div>}
                {mem.gpu?.maxBufferSize && <div>WebGPU GPU 한계: <b className="text-text">{(mem.gpu.maxBufferSize / 1024).toFixed(1)} GB</b></div>}
                {storageEst && <div>브라우저 디스크: <b className="text-text">{fmtGB(storageEst.usage)}</b> / {fmtGB(storageEst.quota)}</div>}
              </div>
            )}

            {/* 캐시된 모델 목록 + 액션 */}
            <div className="space-y-1 pt-1">
              <p className="text-[10.5px] font-bold text-text">📦 캐시된 모델</p>
              {cachedModels.map(m => {
                const isActive = pipeRef.current?.key === m.key;
                return (
                  <div key={m.key} className={`rounded p-2 text-[11px] flex items-center justify-between gap-2 ${
                    m.cached ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-bg'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-text truncate">
                        {isActive ? '🟢' : (m.cached ? '✅' : '⚪')} {m.label}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        ~{m.approxSizeGB} GB · {m.cached ? (isActive ? '활성 (메모리)' : '캐시 보유') : '미다운로드'}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {m.cached && (
                        <button
                          type="button"
                          onClick={() => deleteOneCache(m.key)}
                          disabled={cacheBusy}
                          className="px-2 py-0.5 rounded text-[10px] border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
                          title={`${m.label} 캐시 삭제 (재활성화 시 재다운로드)`}
                        >
                          🗑 삭제
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 전체 캐시 비우기 + 새로고침 */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={refreshCacheState}
                disabled={cacheBusy}
                className="px-2.5 py-1 rounded text-[10.5px] border border-border bg-bg hover:bg-card-bg disabled:opacity-50"
              >
                🔄 새로고침
              </button>
              <button
                type="button"
                onClick={clearAllCache}
                disabled={cacheBusy || cachedCount === 0}
                className="px-2.5 py-1 rounded text-[10.5px] border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                🗑️ 전체 캐시 비우기 ({cachedCount}개)
              </button>
            </div>
            {cacheMsg && (
              <div className="rounded p-1.5 bg-bg border border-border text-[10.5px] text-text whitespace-pre-line">
                {cacheMsg}
              </div>
            )}

            {/* 자동 언로드 토글 (OllamaBridge 패턴 통일) */}
            <label className="flex items-center gap-2 text-[10.5px] text-text cursor-pointer pt-1 border-t border-border">
              <input
                type="checkbox"
                checked={autoUnloadOnLeave}
                onChange={e => setAutoUnloadOnLeave(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span>
                <b>페이지 떠날 때 자동 언로드</b>
                <span className="text-text-secondary ml-1">(메모리만 — 디스크 캐시는 유지)</span>
              </span>
            </label>
          </div>
        )}
      </div>

      {/* ─── 3) 모델 선택 카드 (활성 전 — 단일 모델 정책 안내 통합) ─── */}
      {!pipe && (
        <div className="rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 p-3.5">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-200 mb-2">🚀 WebLLM 모델 선택</p>
          <div className="space-y-1.5">
            {WEBLLM_KEYS.map(k => {
              const m = WEBLLM_REGISTRY[k];
              const v = mem ? webllmFitVerdict(mem, m) : null;
              const isCached = cachedModels.find(c => c.key === k)?.cached;
              const selected = modelKey === k;
              const badge = !v ? '…' : v.ok === true ? '✅' : v.ok === 'warn' ? '⚠️' : '❌';
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setModelKey(k)}
                  disabled={activating}
                  className={`w-full text-left rounded-lg border-2 px-3 py-2 transition-all disabled:opacity-50 ${
                    selected
                      ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                      : 'border-violet-200 dark:border-violet-800 bg-card-bg text-text hover:border-violet-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{m.label}</span>
                    {isCached && (
                      <span className={`text-[9px] px-1 rounded ${selected ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'}`}>
                        💾 캐시
                      </span>
                    )}
                    <span className="ml-auto text-[11px]" title={v?.reason}>{badge}</span>
                  </div>
                  <p className={`text-[10.5px] mt-0.5 ${selected ? 'text-white/90' : 'text-text-secondary'}`}>
                    {m.params} · 약 {m.approxSizeGB}GB · {m.note}
                  </p>
                </button>
              );
            })}
          </div>

          {verdict && verdict.ok !== true && (
            <div className={`mt-2 rounded-lg border p-2 text-[11px] ${
              verdict.ok === false
                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                : 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
            }`}>
              <p className="font-bold">{verdict.ok === false ? '❌ 적재 불가능' : '⚠️ 메모리 빠듯'}</p>
              <p className="text-[10.5px] mt-0.5">{verdict.reason}</p>
            </div>
          )}

          <ul className="mt-2 text-[10.5px] text-violet-900 dark:text-violet-200 space-y-0.5 list-disc pl-4">
            <li>첫 실행 ~5GB 다운로드 (와이파이 권장, 10~30분)</li>
            <li>다음 방문 시 IndexedDB 캐시에서 즉시 로드</li>
            <li>데이터 외부 전송 0 — 모두 브라우저 안에서 처리</li>
            <li>충전 + 환기 권장 (GPU 전력 사용 큼)</li>
          </ul>

          <div className="mt-2 rounded-lg p-2 bg-white/60 dark:bg-black/30 text-[10px] text-violet-900 dark:text-violet-200 leading-relaxed">
            ℹ️ <b>단일 모델 정책</b> — WebLLM 도 동시에 1개 모델만 메모리(GPU)에 보관합니다.
            다른 모델 활성화 시 기존 모델은 자동 언로드 (디스크 캐시는 유지 → 재활성화 빠름).
          </div>

          <button
            onClick={activate}
            disabled={activating || verdict?.ok === false}
            className="mt-3 w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {activating ? '준비 중…' : `${meta?.label} 활성화하기`}
          </button>
        </div>
      )}

      {/* ─── 4) 진행률 카드 (다운로드 중) ─── */}
      {progress && progress.status !== 'ready' && (
        <div className={`rounded-xl border p-3.5 space-y-2 ${
          progress.status === 'error'
            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30'
            : 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30'
        }`}>
          <p className={`text-sm font-bold ${
            progress.status === 'error'
              ? 'text-red-900 dark:text-red-200'
              : 'text-violet-900 dark:text-violet-200'
          }`}>
            {progress.status === 'error' ? '⚠️ 로드 실패' : '🚀 WebLLM 준비 중…'}
          </p>
          <p className="text-[11px] text-text-secondary break-words">{progress.text}</p>
          {progress.status !== 'error' && (
            <div className="w-full bg-card-bg rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${Math.round((progress.progress || 0) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── 5) 활성 카드 강화 (메모리 사용 + 액션 버튼 격상) ─── */}
      {pipe && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-sm font-bold text-violet-900 dark:text-violet-200">
                🟢 {WEBLLM_META[modelKey]?.label} 활성
              </span>
              <p className="text-[10px] text-violet-700 dark:text-violet-300 mt-0.5">
                메모리 사용: ~{meta?.vramGB || meta?.approxSizeGB} GB · GPU 가속 ✅
              </p>
            </div>
            <button
              type="button"
              onClick={unload}
              className="px-3 py-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-white/60 dark:bg-black/30 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-800 dark:text-violet-200 text-xs font-bold"
              title="메모리에서 모델 해제 (디스크 캐시는 유지)"
            >
              ⏏ 언로드
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <label className="flex flex-col gap-0.5">
              <span className="text-text-secondary">max_tokens</span>
              <input
                type="number" min="64" max="4096" step="64"
                value={maxTokens}
                onChange={e => setMaxTokens(Number(e.target.value))}
                className="rounded px-2 py-1 border border-border bg-card-bg text-text"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-text-secondary">temperature</span>
              <input
                type="number" min="0" max="2" step="0.1"
                value={temperature}
                onChange={e => setTemperature(Number(e.target.value))}
                className="rounded px-2 py-1 border border-border bg-card-bg text-text"
              />
            </label>
          </div>
          <button
            onClick={() => generate()}
            disabled={generating || !question}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold"
          >
            {generating ? '✨ 생성 중…' : `✨ ${WEBLLM_META[modelKey]?.label} 로 해설 생성`}
          </button>

          {/* PromptEditor (섹션별 편집) */}
          {question && (
            <PromptEditor
              question={question}
              model={modelKey}
              running={generating}
              onSubmit={(messages) => generate(messages)}
            />
          )}
        </div>
      )}

      {/* ─── 6) 해설 출력 ─── */}
      {explanation && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 p-4">
          <p className="text-xs font-bold text-violet-900 dark:text-violet-200 mb-2">📝 WebLLM 해설</p>
          <p className="text-sm text-violet-900 dark:text-violet-100 whitespace-pre-wrap leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* 에러 */}
      {error && !progress && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-xs text-red-900 dark:text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
