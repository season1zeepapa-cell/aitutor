// 모델 관리 패널 — 라이트/다크 테마 통일
//
// 상태별 액션:
//   - 미다운로드           → "📥 다운로드 + 활성화"
//   - 다운로드됨, 비활성   → "🧠 활성화", "🗑 삭제"
//   - 활성 (메모리 적재)   → "⏏ 언로드", "🗑 삭제"

import { useEffect, useState } from 'react';
import {
  MODEL_URLS, MODEL_META, MODEL_KEYS, MODEL_REGISTRY,
  getModelCacheStatus, getModelCacheFiles, getStorageEstimate,
  deleteModelCache, clearAllCache,
  disposePipe, getLastUsedDevice,
} from '../lib/inference';
import { getMemoryInfo } from '../lib/deviceCheck';
import { fitVerdict, fitBadge } from '../lib/memoryFit';

const SIZES = MODEL_KEYS;

// family 별 색상 (라이트/다크 페어)
const FAMILY_BADGE = {
  'gemma4':  'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'qwen3.5': 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
};
const FAMILY_LABEL = { 'gemma4': 'Google', 'qwen3.5': 'Alibaba' };

// fit 카드 보더 — 라이트/다크 페어
const FIT_BORDER = {
  true:   'border-emerald-300 dark:border-emerald-700',
  warn:   'border-amber-300   dark:border-amber-700',
  false:  'border-red-300     dark:border-red-700',
};

// fit 인라인 박스 — 라이트/다크 페어
const FIT_INLINE = {
  true:   'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
  warn:   'bg-amber-50   dark:bg-amber-900/30   text-amber-800   dark:text-amber-200   border-amber-200   dark:border-amber-800',
  false:  'bg-red-50     dark:bg-red-900/30     text-red-800     dark:text-red-200     border-red-200     dark:border-red-800',
};

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function ModelManagerPanel({
  activeSize, pipeReady, onActivate, onUnload, onAfterChange,
  disabled = false,   // 다운로드 중 락 — 모든 액션 버튼 비활성화
}) {
  const [statuses, setStatuses] = useState({});
  const [estimate, setEstimate] = useState(null);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const [filesBySize, setFilesBySize] = useState({});
  const [filesOpen, setFilesOpen] = useState({});
  const [mem, setMem] = useState(null);

  const refresh = async () => {
    const s = {};
    const f = {};
    for (const size of SIZES) {
      s[size] = await getModelCacheStatus(MODEL_URLS[size]);
      f[size] = await getModelCacheFiles(MODEL_URLS[size]);
    }
    setStatuses(s);
    setFilesBySize(f);
    setEstimate(await getStorageEstimate());
    setMem(await getMemoryInfo());
  };

  useEffect(() => { refresh(); }, []);

  const handleDelete = async (size) => {
    const isLoaded = pipeReady && activeSize === size;
    const msg = isLoaded
      ? `${MODEL_META[size].label} 을 메모리에서 언로드하고 디스크 캐시도 삭제합니다.\n계속할까요?`
      : `${MODEL_META[size].label} 의 디스크 캐시를 삭제합니다.\n(다음 사용 시 다시 다운로드 필요)`;
    if (!confirm(msg)) return;
    setBusy(`delete-${size}`);
    try {
      if (isLoaded) {
        try { disposePipe(); } catch { /* 무시 */ }
        if (onUnload) onUnload();
      }
      await deleteModelCache(MODEL_URLS[size]);
      await refresh();
      if (onAfterChange) onAfterChange();
    } finally {
      setBusy('');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('모든 모델 캐시를 초기화합니다.\n(디스크 + 메모리 모두 정리)')) return;
    setBusy('clear-all');
    try {
      try { disposePipe(); } catch { /* 무시 */ }
      if (onUnload) onUnload();
      await clearAllCache();
      await refresh();
      if (onAfterChange) onAfterChange();
    } finally {
      setBusy('');
    }
  };

  const handleUnload = () => {
    if (!pipeReady) return;
    if (!confirm('메모리에서 모델을 언로드합니다.\n(디스크 캐시는 유지 — 다음 활성화 시 즉시 적재)')) return;
    if (onUnload) onUnload();
  };

  return (
    <div className="rounded-xl border border-border bg-card-bg">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-text"
      >
        <span>🛠 모델 관리</span>
        <span className="text-xs text-text-secondary">
          {open ? '접기 ▲' : '펼치기 ▼'}
          {pipeReady && activeSize && (
            <span className="ml-2 text-success">
              ● {MODEL_META[activeSize]?.label} 활성
              {getLastUsedDevice() && (
                <span className="ml-1 text-[10px] bg-badge-bg text-text-secondary px-1 rounded">
                  {getLastUsedDevice()?.toUpperCase()}
                </span>
              )}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {SIZES.map((size) => {
            const meta = MODEL_META[size];
            const st = statuses[size] || { cached: false, size: 0 };
            const files = filesBySize[size] || [];
            const isLoaded = pipeReady && activeSize === size;
            const recommendedSize = meta.approxSizeGB;

            const verdict = mem ? fitVerdict(mem, MODEL_REGISTRY[size]) : null;
            const badge = fitBadge(verdict);
            const fitBorder = verdict ? FIT_BORDER[verdict.ok] : 'border-border';
            const fitInline = verdict ? FIT_INLINE[verdict.ok] : 'bg-bg text-text-secondary border-border';
            const familyBadge = FAMILY_BADGE[meta.family] || 'bg-badge-bg text-text-secondary';

            return (
              <div key={size}
                className={`rounded-lg border p-3 transition-colors ${
                  isLoaded
                    ? 'border-success bg-emerald-50 dark:bg-emerald-900/20'
                    : `${fitBorder} bg-card-bg`
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-text">
                    {meta.label} <span className="text-xs text-text-secondary">({meta.params})</span>
                    {meta.family && (
                      <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded ${familyBadge}`}>
                        {FAMILY_LABEL[meta.family]}
                      </span>
                    )}
                    {isLoaded && (
                      <span className="ml-1.5 text-[10px] bg-success text-white px-1.5 py-0.5 rounded">
                        ✓ 사용 중
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-text-secondary" title="q4f16 quantization (WebGPU 데스크탑 전용)">
                    ~{recommendedSize}GB <span className="text-[10px] opacity-70">(q4f16)</span>
                  </span>
                </div>
                {meta.note && (
                  <p className="text-[10px] text-text-secondary mb-1.5">{meta.note}</p>
                )}

                {/* 메모리 적합성 인라인 */}
                {verdict && (
                  <div className={`mb-2 rounded border px-2 py-1.5 text-[10.5px] flex items-center gap-1.5 ${fitInline}`}>
                    <span className="text-sm">{badge.icon}</span>
                    <div className="flex-1 leading-tight">
                      <span className="font-bold">이 디바이스: {badge.label}</span>
                      <span className="opacity-75 ml-1">
                        (필요 ~{verdict.requiredGB.toFixed(1)}GB)
                      </span>
                      {verdict.reason && (
                        <span className="block opacity-80 text-[9.5px] mt-0.5">{verdict.reason}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 상태 라인 */}
                <p className="text-xs text-text-secondary mb-2">
                  {st.cached
                    ? <>✅ 다운로드됨 — <b className="text-text">{formatBytes(st.size)}</b> · 파일 {files.length}개 <span className="text-[10px] opacity-70">(실측)</span></>
                    : '⬇️ 미다운로드'}
                </p>

                {/* 파일 상세 */}
                {st.cached && files.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <button
                        type="button"
                        onClick={() => setFilesOpen(p => ({ ...p, [size]: !(p[size] ?? true) }))}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        {(filesOpen[size] ?? true) ? '▲ 파일 목록 접기' : `▼ 파일 목록 보기 (${files.length}개)`}
                      </button>
                      <a
                        href={`https://huggingface.co/${MODEL_URLS[size].split('huggingface.co/')[1]}/tree/main`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-text-secondary hover:underline"
                      >
                        🔗 HuggingFace 원본
                      </a>
                    </div>
                    {(filesOpen[size] ?? true) && (
                      <div className="rounded border border-border bg-bg p-2 text-[10px] font-mono space-y-0.5">
                        <div className="flex justify-between gap-2 pb-1 mb-1 border-b border-border font-semibold text-text-secondary text-[10px]">
                          <span>파일명</span>
                          <span>실측 사이즈</span>
                        </div>
                        {files.map((f, i) => (
                          <div key={i} className="flex justify-between gap-2 hover:bg-card-bg">
                            <span className="truncate text-text-secondary" title={f.url}>{f.name}</span>
                            <span className="flex-shrink-0 text-text-secondary tabular-nums">{formatBytes(f.size)}</span>
                          </div>
                        ))}
                        <div className="pt-1 mt-1 border-t border-border flex justify-between font-bold text-text text-[11px]">
                          <span>합계 ({files.length}개)</span>
                          <span className="tabular-nums">{formatBytes(files.reduce((a, b) => a + b.size, 0))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex flex-wrap gap-1.5">
                  {!st.cached ? (
                    <button
                      onClick={() => onActivate?.(size)}
                      disabled={!!busy || disabled}
                      className="flex-1 text-xs px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white disabled:opacity-40 font-bold">
                      📥 다운로드 + 활성화
                    </button>
                  ) : isLoaded ? (
                    <>
                      <button
                        onClick={handleUnload}
                        disabled={!!busy || disabled}
                        className="flex-1 text-xs px-3 py-1.5 rounded bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 disabled:opacity-40">
                        ⏏ 메모리 언로드
                      </button>
                      <button
                        onClick={() => handleDelete(size)}
                        disabled={!!busy || disabled}
                        className="text-xs px-3 py-1.5 rounded bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 disabled:opacity-40">
                        {busy === `delete-${size}` ? '삭제 중…' : '🗑 삭제'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onActivate?.(size)}
                        disabled={!!busy || disabled}
                        className="flex-1 text-xs px-3 py-1.5 rounded bg-success hover:opacity-90 text-white disabled:opacity-40 font-bold">
                        🧠 활성화
                      </button>
                      <button
                        onClick={() => handleDelete(size)}
                        disabled={!!busy || disabled}
                        className="text-xs px-3 py-1.5 rounded bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 disabled:opacity-40">
                        {busy === `delete-${size}` ? '삭제 중…' : '🗑 삭제'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* 디스크 사용량 */}
          {estimate && (
            <div className="text-[11px] text-text-secondary px-1 pt-1 border-t border-border">
              💾 디스크: <b className="text-text">{formatBytes(estimate.usage)}</b> / {formatBytes(estimate.quota)} 사용 중
              {estimate.quota > 0 && (
                <span className="ml-1 opacity-70">
                  ({((estimate.usage / estimate.quota) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          )}

          {/* 전역 액션 — 전체 초기화 */}
          <button
            onClick={handleClearAll}
            disabled={!!busy || disabled}
            className="w-full text-xs py-2 rounded-lg bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 disabled:opacity-40">
            {busy === 'clear-all' ? '초기화 중…' : '🗑 전체 캐시 초기화 (디스크+메모리)'}
          </button>
          {disabled && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400 text-center mt-1">
              🔒 다운로드 진행 중 — 액션 비활성화
            </p>
          )}
        </div>
      )}
    </div>
  );
}
