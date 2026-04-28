// 메모리 현황 카드 — 휴대폰/데스크탑 모두 지원
//
// 표시 항목:
//   1) 디바이스 RAM (전체)              — navigator.deviceMemory
//   2) JS Heap (현재 페이지)            — performance.memory (Chromium only)
//   3) WebGPU GPU 메모리 한계          — adapter.limits
//   4) 디스크 캐시                      — navigator.storage.estimate
//
// 모델 예상 메모리 = approxSizeGB × 1.5 (GPU 작업버퍼 + KV 캐시 마진)
//
// 색상 정책: 컨테이너는 CSS 변수 (라이트/다크 자동), 의미색만 라이트+다크 페어

import { useEffect, useState } from 'react';
import { getMemoryInfo } from '../lib/deviceCheck';
import { MODEL_REGISTRY } from '../lib/inference';
import { fitVerdict } from '../lib/memoryFit';

function fmtMB(mb) {
  if (mb == null) return '미제공';
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function fmtBytes(b) {
  if (b == null) return '미제공';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(0)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const FIT_STYLE = {
  true:   'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
  warn:   'text-amber-800   dark:text-amber-200   bg-amber-50   dark:bg-amber-900/30   border-amber-200   dark:border-amber-800',
  false:  'text-red-800     dark:text-red-300     bg-red-50     dark:bg-red-900/30     border-red-200     dark:border-red-800',
};

export default function MemoryStatus() {
  const [mem, setMem] = useState(null);
  const [open, setOpen] = useState(true);   // 기본 펼침 — 사용자가 진입 즉시 메모리 보고 모델 선택
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getMemoryInfo().then(setMem);
  }, [refreshKey]);

  if (!mem) {
    return <div className="text-xs text-text-secondary px-1">메모리 정보 수집 중…</div>;
  }

  const ramText = mem.ram?.total != null ? `${mem.ram.total} GB` : '미제공 (Safari/Firefox)';
  const heapPct = mem.jsHeap
    ? Math.min(100, Math.round((mem.jsHeap.used / mem.jsHeap.limit) * 100))
    : null;

  return (
    <div className="rounded-xl border border-border bg-card-bg">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-text"
      >
        <span>💾 메모리 현황</span>
        <span className="text-xs text-text-secondary font-normal">
          RAM {ramText}
          {mem.gpu?.maxBufferSize && (
            <span className="ml-2 text-[10px] bg-primary-light text-primary px-1.5 py-0.5 rounded">
              GPU {(mem.gpu.maxBufferSize / 1024).toFixed(1)}GB
            </span>
          )}
          <span className="ml-1.5 text-text-secondary">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {/* 1) RAM (디바이스 전체) — 의미색은 정보(파랑)/성공(초록)/주(보라) */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-primary-light border border-border p-2 min-w-0">
              <p className="text-primary font-bold mb-0.5 truncate">디바이스 RAM</p>
              <p className="text-base font-bold text-text truncate">{ramText}</p>
              <p className="text-[9px] text-text-secondary mt-0.5 break-all leading-tight">
                {mem.ram.source || '브라우저 미제공'}
              </p>
            </div>

            {/* 2) JS Heap (현재 페이지) */}
            <div className="rounded-lg border border-border p-2 bg-emerald-50 dark:bg-emerald-900/20 min-w-0">
              <p className="text-emerald-700 dark:text-emerald-300 font-bold mb-0.5 truncate">JS Heap</p>
              {mem.jsHeap ? (
                <>
                  <p className="text-base font-bold text-text tabular-nums truncate">
                    {fmtMB(mem.jsHeap.used)}
                  </p>
                  <p className="text-[9px] text-text-secondary mt-0.5 break-all leading-tight">
                    한계 {fmtMB(mem.jsHeap.limit)} · {heapPct}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-secondary">미제공</p>
                  <p className="text-[9px] text-text-secondary mt-0.5">Chromium 전용</p>
                </>
              )}
            </div>

            {/* 3) WebGPU 한계 */}
            <div className="rounded-lg border border-border p-2 bg-purple-50 dark:bg-purple-900/20 min-w-0">
              <p className="text-purple-700 dark:text-purple-300 font-bold mb-0.5 truncate">WebGPU 버퍼</p>
              {mem.gpu?.maxBufferSize ? (
                <>
                  <p className="text-base font-bold text-text tabular-nums truncate">
                    {fmtMB(mem.gpu.maxBufferSize)}
                  </p>
                  <p className="text-[9px] text-text-secondary mt-0.5 break-all leading-tight">
                    Storage {fmtMB(mem.gpu.maxStorageBufferBindingSize)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-secondary">어댑터 없음</p>
                  <p className="text-[9px] text-text-secondary mt-0.5">WebGPU 미지원</p>
                </>
              )}
            </div>
          </div>

          {/* GPU 어댑터 상세 */}
          {(mem.gpu?.vendor || mem.gpu?.device) && (
            <div className="text-[10px] text-text-secondary px-1">
              🎮 GPU: {mem.gpu.vendor || '?'}
              {mem.gpu.architecture && <span> · {mem.gpu.architecture}</span>}
              {mem.gpu.device && <span> · {mem.gpu.device}</span>}
            </div>
          )}

          {/* WebGPU 한계 — 어댑터 천장 vs 사양 디폴트 비교 */}
          {mem.gpu?.adapter === 'requested' && (
            <details className="rounded-lg bg-bg border border-border p-2.5">
              <summary className="cursor-pointer text-[10.5px] font-bold text-text">
                🔬 WebGPU 한계 상세
              </summary>
              <div className="mt-2 space-y-1.5 text-[10px]">
                <div className="flex justify-between border-b border-border pb-1">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">어댑터 절대 최대 ⭐ (하드웨어 천장)</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {mem.gpu.maxBufferSize ? `${(mem.gpu.maxBufferSize / 1024).toFixed(2)} GB` : '?'}
                  </span>
                </div>
                {mem.gpu.webgpuSpecDefault && (
                  <div className="flex justify-between border-b border-border pb-1">
                    <span className="text-text-secondary">WebGPU 사양 디폴트 (보수적)</span>
                    <span className="font-mono text-text-secondary tabular-nums">
                      {(mem.gpu.webgpuSpecDefault.maxBufferSize / 1024).toFixed(2)} GB
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b border-border pb-1">
                  <span className="text-text-secondary">Storage Buffer Binding 최대</span>
                  <span className="font-mono text-text tabular-nums">
                    {mem.gpu.maxStorageBufferBindingSize
                      ? `${(mem.gpu.maxStorageBufferBindingSize / 1024).toFixed(2)} GB`
                      : '?'}
                  </span>
                </div>
                <p className="text-[9px] text-text-secondary leading-relaxed pt-1">
                  💡 <b>어댑터 최대</b> = 하드웨어 천장. <b>사양 디폴트(256MB)</b> = `requiredLimits` 미지정 시 받는 보수적 값.
                  라이브러리(transformers.js / ORT-Web)가 명시 안 하면 디폴트만 받아 손해.
                  Inspector 의 console 에 "Device failed at creation" 이 안 보이면 어댑터 최대치 사용 중.
                </p>
                <p className="text-[9px] text-text-secondary">
                  ✅ powerPreference: <b>high-performance</b> 적용 중 (외장/고성능 GPU 우선)
                </p>
              </div>
            </details>
          )}

          {/* JS Heap 진행 막대 */}
          {mem.jsHeap && (
            <div>
              <div className="flex justify-between text-[10px] text-text-secondary mb-0.5">
                <span>JS Heap 사용량</span>
                <span className="tabular-nums">
                  {fmtMB(mem.jsHeap.used)} / {fmtMB(mem.jsHeap.limit)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-badge-bg rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${heapPct > 80 ? 'bg-danger' : heapPct > 50 ? 'bg-warning' : 'bg-success'}`}
                  style={{ width: `${heapPct}%` }}
                />
              </div>
            </div>
          )}

          {/* 4) 디스크 캐시 */}
          {mem.storage && (
            <div>
              <div className="flex justify-between text-[10px] text-text-secondary mb-0.5">
                <span>💿 디스크 캐시 (모델 저장 공간)</span>
                <span className="tabular-nums">
                  {fmtBytes(mem.storage.usage)} / {fmtBytes(mem.storage.quota)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-badge-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${mem.storage.quota > 0 ? Math.min(100, (mem.storage.usage / mem.storage.quota) * 100) : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* 모델별 적재 가능성 */}
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-bold text-text mb-1.5">📊 모델별 적재 가능성 (추정)</p>
            <div className="space-y-1">
              {Object.entries(MODEL_REGISTRY).map(([key, model]) => {
                const v = fitVerdict(mem, model);
                const style = FIT_STYLE[v.ok];
                const icon = v.ok === true ? '✅' : v.ok === 'warn' ? '⚠️' : '❌';
                return (
                  <div key={key}
                    className={`flex items-center justify-between text-[11px] rounded border px-2 py-1.5 ${style}`}>
                    <span className="flex-1 truncate">
                      {icon} <b>{model.label}</b>
                      <span className="ml-1 text-[10px] opacity-75">
                        ~{model.approxSizeGB}GB · 필요 ~{(model.approxSizeGB * 1.5).toFixed(1)}GB
                      </span>
                    </span>
                    {v.reason && (
                      <span className="text-[9px] opacity-80 ml-2 truncate" title={v.reason}>
                        {v.reason}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-text-secondary mt-2 leading-relaxed">
              💡 필요 메모리 = 모델 사이즈 × 1.5 (KV 캐시·작업버퍼 마진).
              Safari/Firefox 는 RAM 정보 미제공이라 GPU 버퍼 한계로만 판정.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setRefreshKey(k => k + 1)}
              className="text-[10px] text-primary hover:underline"
            >
              ↻ 메모리 다시 측정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
