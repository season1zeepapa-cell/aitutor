// 모델 관리 패널 — 정리된 액션 (2026-04-26)
//
// 상태별 액션:
//   1. 미다운로드           → "📥 다운로드 + 활성화"
//   2. 다운로드됨, 비활성   → "🧠 활성화" (캐시→메모리), "🗑 삭제"
//   3. 활성 (메모리 적재)   → "⏏ 언로드", "🗑 삭제"
//   4. 다른 모델 활성 + 이 모델 다운로드됨 → "🧠 활성화" 누르면 기존 자동 언로드 후 전환

import { useEffect, useState } from 'react';
import {
  MODEL_URLS, MODEL_META,
  getModelCacheStatus, getModelCacheFiles, getStorageEstimate,
  deleteModelCache, clearAllCache,
  disposePipe, getLastUsedDevice,
} from '../lib/inference';

const SIZES = ['e2b', 'e4b'];

function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * @param {object} props
 * @param {string} props.activeSize - 메모리에 적재된 모델 ('e2b' | 'e4b' | null)
 * @param {boolean} props.pipeReady - 메모리 적재 여부
 * @param {(size: string) => void} props.onActivate - 다운로드 + 메모리 적재 (캐시 있으면 즉시)
 * @param {() => void} props.onUnload - 메모리에서 언로드 (디스크 캐시는 유지)
 * @param {() => void} props.onAfterChange - 캐시 변경 후 부모 새로고침
 */
export default function ModelManagerPanel({
  activeSize, pipeReady, onActivate, onUnload, onAfterChange,
}) {
  const [statuses, setStatuses] = useState({});
  const [estimate, setEstimate] = useState(null);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const [filesBySize, setFilesBySize] = useState({});      // { e2b: [files], e4b: [files] }
  const [filesOpen, setFilesOpen] = useState({});          // { e2b: bool, e4b: bool }

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
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
      >
        <span>🛠 모델 관리</span>
        <span className="text-xs text-gray-500">
          {open ? '접기 ▲' : '펼치기 ▼'}
          {pipeReady && activeSize && (
            <span className="ml-2 text-green-600">
              ● {MODEL_META[activeSize]?.label} 활성
              {getLastUsedDevice() && (
                <span className="ml-1 text-[10px] bg-gray-100 text-gray-700 px-1 rounded">
                  {getLastUsedDevice()?.toUpperCase()}
                </span>
              )}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {/* 모델별 카드 */}
          {SIZES.map((size) => {
            const meta = MODEL_META[size];
            const st = statuses[size] || { cached: false, size: 0 };
            const files = filesBySize[size] || [];
            const isLoaded = pipeReady && activeSize === size;
            const isFilesOpen = !!filesOpen[size];

            // q4f16 단일 quantization 정책 (WebGPU 데스크탑 전용)
            const recommendedSize = meta.approxSizeGB;

            return (
              <div key={size}
                className={`rounded-lg border p-3 ${isLoaded ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold">
                    {meta.label} <span className="text-xs text-gray-500">({meta.params})</span>
                    {isLoaded && (
                      <span className="ml-2 text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded">
                        ✓ 사용 중
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-gray-500" title="q4f16 quantization (WebGPU 데스크탑 전용)">
                    ~{recommendedSize}GB <span className="text-[10px] text-gray-400">(q4f16)</span>
                  </span>
                </div>

                {/* 상태 라인 */}
                <p className="text-xs text-gray-600 mb-2">
                  {st.cached
                    ? `✅ 다운로드됨 — ${formatBytes(st.size)} · 파일 ${files.length}개`
                    : '⬇️ 미다운로드'}
                </p>

                {/* 파일 상세 토글 — 캐시된 경우만 */}
                {st.cached && files.length > 0 && (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => setFilesOpen(p => ({ ...p, [size]: !p[size] }))}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      {isFilesOpen ? '▲ 파일 상세 접기' : `▼ 파일 상세 보기 (${files.length}개)`}
                    </button>
                    {isFilesOpen && (
                      <div className="mt-1.5 max-h-56 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 text-[10px] font-mono space-y-0.5">
                        {files.map((f, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <span className="truncate text-gray-700" title={f.url}>{f.name}</span>
                            <span className="flex-shrink-0 text-gray-500">{formatBytes(f.size)}</span>
                          </div>
                        ))}
                        <div className="pt-1 mt-1 border-t border-gray-200 flex justify-between font-bold text-gray-800">
                          <span>합계</span>
                          <span>{formatBytes(files.reduce((a, b) => a + b.size, 0))}</span>
                        </div>
                      </div>
                    )}
                    <a
                      href={`https://huggingface.co/${MODEL_URLS[size].split('huggingface.co/')[1]}/tree/main/onnx`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-2 text-[10px] text-gray-500 hover:underline"
                    >
                      🔗 HuggingFace
                    </a>
                  </div>
                )}

                {/* 액션 버튼 — 상태별로 명확하게 */}
                <div className="flex flex-wrap gap-1.5">
                  {!st.cached ? (
                    /* 미다운로드 → 통합 다운로드+활성화 */
                    <button
                      onClick={() => onActivate?.(size)}
                      disabled={!!busy}
                      className="flex-1 text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 font-bold">
                      📥 다운로드 + 활성화
                    </button>
                  ) : isLoaded ? (
                    /* 활성 (메모리 적재됨) → 언로드 / 삭제 */
                    <>
                      <button
                        onClick={handleUnload}
                        disabled={!!busy}
                        className="flex-1 text-xs px-3 py-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 disabled:opacity-40">
                        ⏏ 메모리 언로드
                      </button>
                      <button
                        onClick={() => handleDelete(size)}
                        disabled={!!busy}
                        className="text-xs px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-700 disabled:opacity-40">
                        {busy === `delete-${size}` ? '삭제 중…' : '🗑 삭제'}
                      </button>
                    </>
                  ) : (
                    /* 다운로드됨 비활성 → 활성화 / 삭제 */
                    <>
                      <button
                        onClick={() => onActivate?.(size)}
                        disabled={!!busy}
                        className="flex-1 text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 font-bold">
                        🧠 활성화
                      </button>
                      <button
                        onClick={() => handleDelete(size)}
                        disabled={!!busy}
                        className="text-xs px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-700 disabled:opacity-40">
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
            <div className="text-[11px] text-gray-600 px-1 pt-1 border-t border-gray-100">
              💾 디스크: <b>{formatBytes(estimate.usage)}</b> / {formatBytes(estimate.quota)} 사용 중
              {estimate.quota > 0 && (
                <span className="ml-1 text-gray-400">
                  ({((estimate.usage / estimate.quota) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          )}

          {/* 전역 액션 — 전체 초기화만 (개별 액션은 카드 안에) */}
          <button
            onClick={handleClearAll}
            disabled={!!busy}
            className="w-full text-xs py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-40">
            {busy === 'clear-all' ? '초기화 중…' : '🗑 전체 캐시 초기화 (디스크+메모리)'}
          </button>
        </div>
      )}
    </div>
  );
}
