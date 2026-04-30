// 모델 다운로드 진행률 + 활성화 카드 — 라이트/다크 테마 통일
// 상태: init / downloading / cache_hit / initializing / ready / error

import { useEffect, useState } from 'react';
import { MODEL_META, MODEL_KEYS, MODEL_REGISTRY } from '../lib/inference';
import { getMemoryInfo } from '../lib/deviceCheck';
import { fitVerdict, fitBadge } from '../lib/memoryFit';

function fmtMB(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getRecommendedSize(meta) {
  return meta.approxSizeGB;
}

export default function ModelDownloadCard({ size = 'e2b', progress, onActivate, onRetry, onSelectSize, errorMessage, isLoading, isHidden, wakeLockActive }) {
  const meta = MODEL_META[size] || MODEL_META.e2b;
  const recommendedSize = getRecommendedSize(meta);
  const sizeApprox = `약 ${recommendedSize}GB`;
  const [mem, setMem] = useState(null);
  useEffect(() => { getMemoryInfo().then(setMem); }, []);
  const selectedVerdict = mem ? fitVerdict(mem, MODEL_REGISTRY[size] || MODEL_REGISTRY.e2b) : null;

  // ─── 1) 진행 중 / 결과 카드 ───
  if (progress) {
    const overall = progress.overallPercent || 0;
    const status = progress.status;

    if (status === 'error') {
      return (
        <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-4 space-y-2">
          <p className="text-sm font-bold text-red-900 dark:text-red-200">⚠️ 모델 로드 실패</p>
          {errorMessage && (
            <p className="text-xs text-red-800 dark:text-red-300 break-words whitespace-pre-wrap">{errorMessage}</p>
          )}
          <p className="text-[11px] text-red-700 dark:text-red-300/80">
            받은 데이터: {fmtMB(progress.overallLoaded)} / {fmtMB(progress.overallTotal || progress.overallLoaded)}
          </p>
          <button onClick={onRetry || onActivate} disabled={isLoading}
            className="w-full py-2 rounded-xl bg-danger hover:bg-danger-hover text-white text-sm font-bold disabled:opacity-50">
            🔄 다시 시도
          </button>
        </div>
      );
    }

    if (status === 'cache_hit') {
      return (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 p-3">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">⚡ 캐시에서 로드 — 다운로드 0</p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">{fmtMB(progress.overallLoaded)} 모델 즉시 로드</p>
        </div>
      );
    }

    if (status === 'assembling') {
      return (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 p-4 space-y-2">
          <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">🧩 청크 합치는 중…</p>
          <p className="text-xs text-indigo-800 dark:text-indigo-300">{progress.currentFile || '잠시만요…'}</p>
          <div className="w-full bg-card-bg rounded-full h-2 overflow-hidden">
            <div className="h-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      );
    }

    if (status === 'initializing') {
      return (
        <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 p-4 space-y-2">
          <p className="text-sm font-bold text-purple-900 dark:text-purple-200">⚙️ 모델 초기화 중…</p>
          <p className="text-xs text-purple-800 dark:text-purple-300">{progress.currentFile || '잠시만요…'}</p>
          <div className="w-full bg-card-bg rounded-full h-2 overflow-hidden">
            <div className="h-full bg-purple-500 dark:bg-purple-400 animate-pulse" style={{ width: '100%' }} />
          </div>
          <p className="text-[10px] text-purple-700 dark:text-purple-300/80">
            첫 활성화는 메모리에 모델을 올리는 시간이 걸립니다 (수십 초)
          </p>
        </div>
      );
    }

    const isReady = status === 'ready' || overall >= 99.5;
    if (isReady) {
      return (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 p-3">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">✅ 모델 준비 완료 — 잠시 후 활성화됩니다</p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-200">📥 모델 다운로드 중…</p>
          {wakeLockActive && (
            <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/60 px-2 py-0.5 rounded-full">🔆 화면 켜짐 유지</span>
          )}
        </div>

        <div className="w-full bg-card-bg rounded-full h-3 overflow-hidden">
          <div className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, overall)).toFixed(1)}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-blue-900 dark:text-blue-200">
          <span>{progress.currentFile?.slice(0, 40) || `${progress.fileCount}개 파일`}</span>
          <span className="font-semibold">{overall.toFixed(0)}%</span>
        </div>

        <div className="text-[11px] text-blue-800 dark:text-blue-300">
          받는 중: <b className="tabular-nums">{fmtMB(progress.overallLoaded)}</b>
          {progress.overallTotal > 0 && (
            <>
              <span className="opacity-60 mx-1">/</span>
              <span className="opacity-90 tabular-nums">~{fmtMB(progress.overallTotal)}</span>
              <span className="text-[9px] opacity-70 ml-1">(추정)</span>
            </>
          )}
        </div>
        <p className="text-[10px] text-blue-600 dark:text-blue-300/70 italic">
          ※ 진행 사이즈는 서버 헤더 기준 추정치입니다. 정확한 디스크 사용량은 다운로드 완료 후 확인 가능합니다.
        </p>

        {isHidden && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-2 text-[11px] text-amber-900 dark:text-amber-200">
            ⚠️ 페이지가 백그라운드 — 다운로드가 일시정지됐을 수 있습니다.
          </div>
        )}

        <p className="text-[10px] text-blue-700 dark:text-blue-300/80">
          💡 다운로드 완료 후엔 캐시되어 다음 방문 시 즉시 로드됩니다.
        </p>
      </div>
    );
  }

  // ─── 2) 활성화 카드 (다운로드 시작 전) ───

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-3">📱 온디바이스 모델 활성화</p>

      <div className="mb-3">
        <p className="text-[11px] text-amber-900 dark:text-amber-200 font-semibold mb-1.5">모델 선택</p>
        <div className="grid grid-cols-2 gap-1.5">
          {MODEL_KEYS.map((s) => {
            const m = MODEL_META[s];
            const selected = size === s;
            const recSize = getRecommendedSize(m);
            const familyDot = m.family === 'qwen3.5' ? 'bg-orange-500' : 'bg-blue-500';
            const v = mem ? fitVerdict(mem, MODEL_REGISTRY[s]) : null;
            const b = fitBadge(v);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSize?.(s)}
                disabled={isLoading || !onSelectSize}
                className={`text-left rounded-lg border-2 px-2.5 py-2 transition-all disabled:opacity-50 ${
                  selected
                    ? 'border-amber-600 bg-amber-600 text-white shadow-sm'
                    : 'border-amber-300 dark:border-amber-700 bg-card-bg text-text hover:border-amber-500 dark:hover:border-amber-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${familyDot}`} />
                  <span className="text-xs font-bold">{m.label}</span>
                  <span className="ml-auto text-[11px]" title={v?.reason || '메모리 측정 중'}>
                    {b.icon}
                  </span>
                </div>
                <p className={`text-[10px] mt-0.5 ${selected ? 'text-amber-100' : 'text-text-secondary'}`}>
                  {m.params} · 약 {recSize}GB
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-1.5 leading-relaxed">
          💡 <b>Qwen 3.5 2B</b> (1.6GB) — 한국어 강세, 가벼움 · <b>Gemma 4 E4B</b> (4.9GB) — 멀티모달, RAM 8GB+ 권장
        </p>
      </div>

      <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1 list-disc pl-5 mb-3">
        <li>첫 실행 시 모델 다운로드 ({sizeApprox}, <strong>와이파이 권장</strong>)</li>
        <li>이후엔 브라우저 캐시에서 즉시 로드 (다운로드 0)</li>
        <li>사용자 데이터는 외부로 전송되지 않습니다</li>
        <li>배터리·발열 평소보다 큼 — 충전 권장</li>
        <li><strong>다운로드 중 화면 꺼짐 / 다른 앱 전환</strong>은 다운로드가 멈출 수 있습니다</li>
      </ul>

      {selectedVerdict && selectedVerdict.ok !== true && (
        <div className={`mb-2 rounded-lg border p-2 text-[11px] ${
          selectedVerdict.ok === false
            ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
            : 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200'
        }`}>
          <p className="font-bold">
            {selectedVerdict.ok === false ? '❌ 적재 불가능 가능성' : '⚠️ 메모리 빠듯'}
          </p>
          <p className="text-[10.5px] mt-0.5">{selectedVerdict.reason}</p>
          {selectedVerdict.ok === false && (
            <p className="text-[10px] mt-1 opacity-80">
              그래도 시도하시려면 활성화 버튼을 누르세요. 더 작은 모델 (Qwen 3.5 0.8B)을 권장합니다.
            </p>
          )}
        </div>
      )}

      <button onClick={onActivate} disabled={isLoading}
        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
        {isLoading ? '준비 중…' : `${meta.label} 활성화하기`}
      </button>
    </div>
  );
}
