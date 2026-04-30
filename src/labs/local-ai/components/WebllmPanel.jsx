// WebLLM 추론 패널 — transformers.js 와 별도 엔진 (REBUILD28 §11)
// 모델 다운로드 → 활성화 → 추론까지 self-contained.
// transformers.js 영역과 격리 (state, 캐시 모두 분리).

import { useState, useEffect, useRef } from 'react';
import {
  WEBLLM_REGISTRY, WEBLLM_KEYS, WEBLLM_META,
  loadWebllmPipe, explainWebllm, disposeWebllmPipe, webllmFitVerdict,
} from '../lib/inference-webllm';
import { getMemoryInfo } from '../lib/deviceCheck';
import { buildSinglePrompt } from '../lib/prompts';
import { applyQwenStrict } from '../../../lib/qwen';
import { buildLabMessages } from '../../../lib/lab/promptBuilder';
import PromptEditor from '../../../components/lab/PromptEditor';

const CIRCLE = ['①','②','③','④','⑤'];

export default function WebllmPanel({ question }) {
  const [modelKey, setModelKey] = useState('qwen25-7b');
  const [pipe, setPipe] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activating, setActivating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [maxTokens, setMaxTokens] = useState(2048);  // REBUILD29 — Qwen 한국어 해설은 512 으로도 빠듯 (2026-04-30)
  const [temperature, setTemperature] = useState(0.3);
  const [mem, setMem] = useState(null);
  const pipeRef = useRef(null);

  useEffect(() => { getMemoryInfo().then(setMem); }, []);
  useEffect(() => () => { if (pipeRef.current) disposeWebllmPipe(pipeRef.current); }, []);

  const meta = WEBLLM_REGISTRY[modelKey];
  const verdict = mem ? webllmFitVerdict(mem, meta) : null;

  const activate = async () => {
    setActivating(true);
    setError('');
    setProgress({ status: 'init', text: '모델 다운로드 시작…', progress: 0 });
    try {
      // 다른 모델이 활성 상태면 unload
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

  const generate = async (customMessages = null) => {
    if (!pipe || !question) return;
    setGenerating(true);
    setExplanation('');
    setError('');
    try {
      // REBUILD29 §22 / §26 — PromptEditor customMessages 우선
      const choices = Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices || '[]');
      const baseMessages = customMessages || buildLabMessages({
        body: question.body,
        choices,
        answer: question.answer,
        answer_extra: question.answer_extra,
      });
      // REBUILD29 §13 / §16 — Qwen 한국어 강제 + thinking 비활성
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

  return (
    <div className="space-y-3">
      {/* 모델 선택 카드 */}
      {!pipe && (
        <div className="rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 p-3.5">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-200 mb-2">🚀 WebLLM 모델 선택</p>
          <div className="space-y-1.5">
            {WEBLLM_KEYS.map(k => {
              const m = WEBLLM_REGISTRY[k];
              const v = mem ? webllmFitVerdict(mem, m) : null;
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
                    <span className={`text-xs font-bold`}>{m.label}</span>
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

          <button
            onClick={activate}
            disabled={activating || verdict?.ok === false}
            className="mt-3 w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {activating ? '준비 중…' : `${meta?.label} 활성화하기`}
          </button>
        </div>
      )}

      {/* 진행률 카드 */}
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

      {/* 활성 상태 + 추론 컨트롤 */}
      {pipe && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-900 dark:text-violet-200">
              🟢 {WEBLLM_META[modelKey]?.label} 활성
            </span>
            <button onClick={unload} className="text-[11px] text-violet-700 dark:text-violet-300 hover:underline">
              언로드
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
            {generating ? '✨ 생성 중…' : `✨ ${WEBLLM_META[modelKey]?.label} 로 해설 생성 (default)`}
          </button>

          {/* REBUILD29 §26 — PromptEditor (섹션별 편집) */}
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

      {/* 해설 출력 */}
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
