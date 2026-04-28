// 디바이스 AI 카드 (REBUILD18 §4)
//
// 상태 분기:
//   1) device.supported === false    → 미지원 안내
//   2) !pipeReady && !activating     → 활성화 안 됨 카드 (모델 선택 → 활성화)
//   3) activating || downloading     → 진행률 표시 + 락 안내
//   4) pipeReady                     → "디바이스 AI 로 해설 생성" 버튼

import { useState } from 'react';

const FAMILY_DOT = {
  'gemma4':  'bg-blue-500',
  'qwen3.5': 'bg-orange-500',
};

function fmtPct(n) {
  return `${Math.min(100, Math.max(0, n)).toFixed(0)}%`;
}

export default function DeviceAiCard({
  device, verdicts, activeSize, pipeReady,
  progress, activating, isDownloading, generating, error,
  MODEL_REGISTRY, MODEL_META,
  onActivate, onGenerate,    // (size) => Promise<bool>, () => Promise<string>
}) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pendingSize, setPendingSize] = useState(null);

  // ─── 1) 미지원 디바이스 ───────────────────────────────────────
  if (device && !device.supported) {
    return (
      <div className="rounded-xl border border-border bg-card-bg p-3 text-xs">
        <p className="font-bold text-text mb-1">📱 온디바이스 AI 사용 불가</p>
        <p className="text-text-secondary leading-relaxed">
          {device.reason || 'WebGPU 미지원 환경'}. 데스크탑 Chrome / Edge 에서만 동작합니다.
        </p>
      </div>
    );
  }

  // ─── 3) 다운로드/적재 진행 중 ─────────────────────────────────
  if (isDownloading) {
    const pct = progress?.overallPercent || 0;
    const status = progress?.status;
    return (
      <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4 space-y-2">
        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
          📥 {MODEL_META[pendingSize || activeSize]?.label || '모델'} 준비 중…
        </p>
        <div className="w-full bg-card-bg rounded-full h-2 overflow-hidden">
          <div className="h-full bg-amber-500 transition-all duration-200" style={{ width: fmtPct(pct) }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-amber-900 dark:text-amber-200">
          <span className="truncate">{progress?.currentFile?.slice(0, 40) || status || '…'}</span>
          <span className="font-semibold tabular-nums">{fmtPct(pct)}</span>
        </div>
        <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
          🔒 페이지를 떠나지 마세요. 백그라운드 다운로드는 미지원이라 페이지 이동 시 다운로드가 중단됩니다.
        </p>
      </div>
    );
  }

  // ─── 4) 활성화 완료 → 해설 생성 버튼 ──────────────────────────
  if (pipeReady && activeSize) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            ⚡ {MODEL_META[activeSize]?.label} 활성 — 외부 전송 0
          </span>
          <button
            onClick={() => { setChooserOpen(true); setPendingSize(activeSize); }}
            className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline"
            disabled={generating}
          >
            모델 변경
          </button>
        </div>

        {chooserOpen && (
          <ModelChooser
            verdicts={verdicts}
            MODEL_REGISTRY={MODEL_REGISTRY}
            currentSize={activeSize}
            onCancel={() => setChooserOpen(false)}
            onSelect={async (size) => {
              setChooserOpen(false);
              setPendingSize(size);
              await onActivate(size);
              setPendingSize(null);
            }}
          />
        )}

        <button
          onClick={() => onGenerate()}
          disabled={generating}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
        >
          {generating ? '✨ 생성 중…' : `✨ ${MODEL_META[activeSize]?.label} 로 해설 생성`}
        </button>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-[11px] text-red-800 dark:text-red-200">
            {error}
          </div>
        )}
      </div>
    );
  }

  // ─── 2) 활성화 안 됨 — 모델 선택 카드 (기본) ───────────────────
  return (
    <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-3">
      <div>
        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">📱 온디바이스 AI 활성화</p>
        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
          외부 서버 없이 이 기기에서 AI 해설 생성. 첫 사용 시 모델 다운로드 (1회만) → 이후 캐시.
        </p>
      </div>

      <ModelChooser
        verdicts={verdicts}
        MODEL_REGISTRY={MODEL_REGISTRY}
        currentSize={null}
        showHelpLink
        onSelect={async (size) => {
          setPendingSize(size);
          await onActivate(size);
          setPendingSize(null);
        }}
      />

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-[11px] text-red-800 dark:text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// 모델 선택 서브 컴포넌트 (4개 모델 + 메모리 적합성)
// ───────────────────────────────────────────────────────────────────
function ModelChooser({ verdicts, MODEL_REGISTRY, currentSize, showHelpLink, onSelect, onCancel }) {
  // 권장: ✅ 모델 중 가장 큰 것 (UI 상단)
  const okSizes = Object.keys(MODEL_REGISTRY).filter(k => verdicts[k]?.ok === true);
  const recommendedKey = okSizes.sort((a, b) => MODEL_REGISTRY[b].approxSizeGB - MODEL_REGISTRY[a].approxSizeGB)[0];

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(MODEL_REGISTRY).map(([size, meta]) => {
          const v = verdicts[size];
          const icon = !v ? '⏳' : v.ok === true ? '✅' : v.ok === 'warn' ? '⚠️' : '❌';
          const isCurrent = size === currentSize;
          const isRecommended = size === recommendedKey;
          const dot = FAMILY_DOT[meta.family] || 'bg-gray-400';

          return (
            <button
              key={size}
              type="button"
              onClick={() => onSelect(size)}
              className={`text-left rounded-lg border-2 px-2 py-1.5 transition-all ${
                isCurrent
                  ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40'
                  : 'border-emerald-300 dark:border-emerald-700 bg-card-bg hover:border-emerald-500 dark:hover:border-emerald-500'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="text-[11px] font-bold text-text">{meta.label}</span>
                <span className="ml-auto text-[10px]" title={v?.reason || '측정 중'}>{icon}</span>
              </div>
              <p className="text-[9.5px] text-text-secondary mt-0.5">
                {meta.params} · 약 {meta.approxSizeGB}GB
                {isRecommended && <span className="ml-1 text-emerald-700 dark:text-emerald-400 font-bold">⭐</span>}
              </p>
            </button>
          );
        })}
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-[10px] text-text-secondary hover:underline"
        >
          취소
        </button>
      )}
      {showHelpLink && (
        <p className="text-[10px] text-text-secondary text-center">
          ⭐ 추천 = 이 디바이스에서 안전한 가장 큰 모델 ·
          <a href="/lab/local-ai" className="ml-1 text-primary hover:underline">상세 진단 →</a>
        </p>
      )}
    </div>
  );
}
