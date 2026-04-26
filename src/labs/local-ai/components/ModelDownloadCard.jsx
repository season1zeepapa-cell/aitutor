// 모델 다운로드 진행률 + 활성화 카드
// 상태: init / downloading / cache_hit / initializing / ready / error

import { MODEL_META } from '../lib/inference';

function fmtMB(bytes) {
  if (!bytes || bytes <= 0) return '0';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)}GB`;
  return `${mb.toFixed(0)}MB`;
}

// WebGPU + q4f16 단일 정책 (데스크탑 전용)
function getRecommendedSize(meta) {
  return meta.approxSizeGB;
}

export default function ModelDownloadCard({ size = 'e2b', progress, onActivate, onRetry, onSelectSize, errorMessage, isLoading, isHidden, wakeLockActive }) {
  const meta = MODEL_META[size] || MODEL_META.e2b;
  const recommendedSize = getRecommendedSize(meta);
  const sizeApprox = `약 ${recommendedSize}GB`;

  // ─── 1) 진행 중 / 결과 카드 ───
  if (progress) {
    const overall = progress.overallPercent || 0;
    const status = progress.status;

    // 에러 상태 — 다운로드 카드 안에 통합
    if (status === 'error') {
      return (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-bold text-red-900">⚠️ 모델 로드 실패</p>
          {errorMessage && (
            <p className="text-xs text-red-800 break-words whitespace-pre-wrap">{errorMessage}</p>
          )}
          <p className="text-[11px] text-red-700">
            받은 데이터: {fmtMB(progress.overallLoaded)} / {fmtMB(progress.overallTotal || progress.overallLoaded)}
          </p>
          <button onClick={onRetry || onActivate} disabled={isLoading}
            className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">
            🔄 다시 시도
          </button>
        </div>
      );
    }

    // 캐시 히트 — 다운로드 0
    if (status === 'cache_hit') {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-900">⚡ 캐시에서 로드 — 다운로드 0</p>
          <p className="text-xs text-emerald-800 mt-1">{fmtMB(progress.overallLoaded)} 모델 즉시 로드</p>
        </div>
      );
    }

    // 청크 합치는 중
    if (status === 'assembling') {
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <p className="text-sm font-bold text-indigo-900">🧩 청크 합치는 중…</p>
          <p className="text-xs text-indigo-800">{progress.currentFile || '잠시만요…'}</p>
          <div className="w-full bg-white rounded-full h-2 overflow-hidden">
            <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      );
    }

    // 초기화 중
    if (status === 'initializing') {
      return (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
          <p className="text-sm font-bold text-purple-900">⚙️ 모델 초기화 중…</p>
          <p className="text-xs text-purple-800">{progress.currentFile || '잠시만요…'}</p>
          <div className="w-full bg-white rounded-full h-2 overflow-hidden">
            <div className="h-full bg-purple-500 animate-pulse" style={{ width: '100%' }} />
          </div>
          <p className="text-[10px] text-purple-700">
            첫 활성화는 메모리에 모델을 올리는 시간이 걸립니다 (수십 초)
          </p>
        </div>
      );
    }

    // ready — 곧 pipeReady=true 되어 카드 자체가 사라짐. 간결하게만 표시.
    const isReady = status === 'ready' || overall >= 99.5;
    if (isReady) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-900">✅ 모델 준비 완료 — 잠시 후 활성화됩니다</p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-blue-900">📥 모델 다운로드 중…</p>
          {wakeLockActive && (
            <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">🔆 화면 켜짐 유지</span>
          )}
        </div>

        <div className="w-full bg-white rounded-full h-3 overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, overall)).toFixed(1)}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-blue-900">
          <span>{progress.currentFile?.slice(0, 40) || `${progress.fileCount}개 파일`}</span>
          <span className="font-semibold">{overall.toFixed(0)}%</span>
        </div>
        {progress.overallTotal > 0 && (
          <div className="text-[11px] text-blue-800">
            {fmtMB(progress.overallLoaded)} / {fmtMB(progress.overallTotal)}
          </div>
        )}

        {isHidden && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
            ⚠️ 페이지가 백그라운드 — 다운로드가 일시정지됐을 수 있습니다.
          </div>
        )}

        <p className="text-[10px] text-blue-700">
          💡 다운로드 완료 후엔 캐시되어 다음 방문 시 즉시 로드됩니다.
        </p>
      </div>
    );
  }

  // ─── 2) 활성화 카드 (다운로드 시작 전) ───
  const SIZES = ['e2b', 'e4b'];

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900 mb-3">📱 디바이스 AI 활성화</p>

      {/* 모델 선택 세그먼트 */}
      <div className="mb-3">
        <p className="text-[11px] text-amber-900 font-semibold mb-1.5">모델 선택</p>
        <div className="flex rounded-lg border border-amber-300 overflow-hidden bg-white">
          {SIZES.map((s) => {
            const m = MODEL_META[s];
            const selected = size === s;
            const recSize = getRecommendedSize(m);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSize?.(s)}
                disabled={isLoading || !onSelectSize}
                className={`flex-1 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                  selected
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-amber-900 hover:bg-amber-50'
                }`}
              >
                {m.label}
                <span className={`block text-[10px] font-normal mt-0.5 ${selected ? 'text-amber-100' : 'text-amber-700'}`}>
                  {m.params} · 약 {recSize}GB
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-amber-800 mt-1.5">
          💡 <b>E4B</b>는 한국어 정확도 우수 (메모리 8GB+ 권장) · <b>E2B</b>는 빠르고 가벼움
        </p>
      </div>

      <ul className="text-xs text-amber-900 space-y-1 list-disc pl-5 mb-3">
        <li>첫 실행 시 모델 다운로드 ({sizeApprox}, <strong>와이파이 권장</strong>)</li>
        <li>이후엔 브라우저 캐시에서 즉시 로드 (다운로드 0)</li>
        <li>사용자 데이터는 외부로 전송되지 않습니다</li>
        <li>배터리·발열 평소보다 큼 — 충전 권장</li>
        <li><strong>다운로드 중 화면 꺼짐 / 다른 앱 전환</strong>은 다운로드가 멈출 수 있습니다</li>
      </ul>
      <button onClick={onActivate} disabled={isLoading}
        className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:opacity-50">
        {isLoading ? '준비 중…' : `${meta.label} 활성화하기`}
      </button>
    </div>
  );
}
