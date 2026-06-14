// 사용자 PC Ollama 상태 정보 카드 (REBUILD40)
//
// 브릿지 페이지 전용 — 사용자 PC localhost:11434 의 Ollama API 만 사용.
// 통합/분리 서버용 MemoryCard 와 다른 점:
//   - 백엔드 endpoint 호출 없음 (브라우저 → localhost 직접)
//   - GPU 사용률 / CPU / 시스템 RAM 가용량 못 가져옴 (브라우저 보안 제약)
//   - navigator.deviceMemory 로 대략적 PC RAM 만 표시
//   - 합계 진행 바 + 디스크 모델 목록 (Ollama /api/tags) 포함
//
// 데이터:
//   loadedModels  - Ollama /api/ps 응답 (현재 메모리에 로딩된 모델)
//   diskModels    - Ollama /api/tags 응답 (다운로드된 전체 모델)
//   onRefresh     - 두 API 모두 새로 호출하는 콜백
//   ollamaVersion - Ollama /api/version 응답 (선택, 헤더에 표시)
//
// 사용:
//   <OllamaPcStatusCard
//     loadedModels={loadedModels}
//     diskModels={models}
//     ollamaVersion={pingResult?.version}
//     onRefresh={async () => { await ping(); await refreshLoadedModels(); }}
//   />

import { useState } from 'react';

// ─── helpers ─────────────────────────────────────────────
const fmtBytes = (b) => {
  if (!b || b <= 0) return '0';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

const fmtExpiresAt = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = t - Date.now();
  if (diff <= 0) return '곧 unload';
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (min > 0) return `${min}분 ${sec}초 후 unload`;
  return `${sec}초 후 unload`;
};

// 진행 바 — 0~100% 사이로 클램프, 색상 prop 으로 구분
const PaletteBar = ({ percent, color = 'violet' }) => {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const colorMap = {
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };
  return (
    <div className="h-1.5 bg-bg rounded-full overflow-hidden">
      <div className={`h-full transition-all ${colorMap[color] || colorMap.violet}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

// ─── 메인 컴포넌트 ──────────────────────────────────────
export default function OllamaPcStatusCard({
  loadedModels = [],
  diskModels = [],
  ollamaVersion,
  onRefresh,
}) {
  const [showDisk, setShowDisk] = useState(false);    // 디스크 모델 목록 펼침 (기본 닫힘 — 길어짐 방지)
  const [refreshing, setRefreshing] = useState(false);

  // 합계 계산 — 로딩된 모델들의 RAM/VRAM 총합
  // size       = 모델 가중치 전체 메모리 점유 (byte)
  // size_vram  = GPU VRAM 에 올라간 부분 (byte) — 0 이면 CPU 만
  const totalRam = loadedModels.reduce((acc, m) => acc + (m.size || 0), 0);
  const totalVram = loadedModels.reduce((acc, m) => acc + (m.size_vram || 0), 0);

  // 디스크 모델 합계
  const totalDiskBytes = diskModels.reduce((acc, m) => acc + (m.size || 0), 0);

  // 브라우저로 가져올 수 있는 PC 정보 — navigator.deviceMemory 만 (GB 단위, 4/8/16/32 식 반올림)
  // performance.memory 는 자바스크립트 힙만 보여주므로 PC RAM 과 무관 → 사용 안 함
  const deviceMemoryGb = (typeof navigator !== 'undefined' && navigator.deviceMemory) || null;

  // RAM 점유율 추정 — navigator.deviceMemory 기준 (정확하지 않음, 안내용)
  // navigator.deviceMemory 는 8 GB 이상 PC 에서 8 로 캡됨 (privacy) → 큰 PC 에서 % 가 100% 넘게 보일 수 있음
  const ramPercent = deviceMemoryGb && totalRam
    ? Math.min(100, (totalRam / (deviceMemoryGb * 1e9)) * 100)
    : null;

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card-bg p-3 space-y-2.5">
      {/* 헤더 — 라벨 + 새로고침 */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-text">
          📊 사용자 PC Ollama 상태
          {ollamaVersion && (
            <span className="ml-1.5 text-[10px] font-mono text-text-secondary opacity-70">
              v{ollamaVersion}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[10px] px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-200 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 disabled:opacity-50 font-bold"
          title="Ollama /api/ps + /api/tags 다시 호출"
        >
          {refreshing ? '🔄 갱신 중…' : '🔄 새로고침'}
        </button>
      </div>

      {/* 합계 — 로딩된 모델들의 RAM/VRAM */}
      {loadedModels.length > 0 ? (
        <div className="space-y-2 pt-1">
          {/* RAM 합계 */}
          <div>
            <div className="flex justify-between text-[11px] text-text">
              <span className="font-bold">로드된 모델 합계 RAM</span>
              <span>
                {fmtBytes(totalRam)}
                {deviceMemoryGb && (
                  <span className="opacity-70">
                    {' / '}≈{deviceMemoryGb} GB ({ramPercent.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
            <PaletteBar percent={ramPercent || 0} color={ramPercent > 80 ? 'rose' : 'violet'} />
          </div>

          {/* VRAM 합계 — VRAM 사용한 모델이 있을 때만 노출 */}
          {totalVram > 0 && (
            <div>
              <div className="flex justify-between text-[11px] text-text">
                <span className="font-bold">GPU VRAM 점유</span>
                <span>{fmtBytes(totalVram)}</span>
              </div>
              <PaletteBar percent={(totalVram / totalRam) * 100} color="emerald" />
              <p className="text-[10px] text-text-secondary opacity-70 mt-0.5">
                전체 모델 가중치 중 {((totalVram / totalRam) * 100).toFixed(0)}% 가 GPU VRAM 으로 오프로드됨
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-text-secondary opacity-70 py-1">
          ⚪ 메모리에 로드된 모델 없음
        </p>
      )}

      {/* 로드된 모델 목록 (이미 메모리 관리 카드에도 있으나 여기선 expires_at 표시) */}
      {loadedModels.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="text-[11px] font-bold text-text mb-1">
            🧠 메모리 적재 ({loadedModels.length})
          </p>
          <ul className="space-y-0.5">
            {loadedModels.map((m, i) => (
              <li key={i} className="text-[10px] text-text-secondary leading-relaxed">
                • <span className="font-mono text-text font-bold">{m.name}</span>
                {' · '}
                {fmtBytes(m.size)}
                {m.size_vram > 0 && (
                  <> (VRAM <span className="text-emerald-600 dark:text-emerald-400">{fmtBytes(m.size_vram)}</span>)</>
                )}
                {m.expires_at && (
                  <> · <span className="opacity-70">{fmtExpiresAt(m.expires_at)}</span></>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 디스크 모델 — 펼치기 토글 (다운로드된 전체 모델, ollama list 와 동일) */}
      {diskModels.length > 0 && (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setShowDisk(s => !s)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-text hover:text-primary"
          >
            <span>
              💾 디스크 모델 ({diskModels.length}개, 합계 {fmtBytes(totalDiskBytes)})
            </span>
            <span className="text-[10px] text-text-secondary">{showDisk ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {showDisk && (
            <ul className="space-y-0.5 mt-1.5">
              {diskModels.map((m, i) => {
                const isLoaded = loadedModels.some(lm => lm.name === m.name);
                return (
                  <li key={i} className="text-[10px] text-text-secondary leading-relaxed">
                    {isLoaded ? '🟢 ' : '⚪ '}
                    <span className="font-mono text-text">{m.name}</span>
                    {' · '}{fmtBytes(m.size)}
                    {m.details?.parameter_size && (
                      <span className="opacity-70"> · {m.details.parameter_size}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {showDisk && (
            <p className="text-[10px] text-text-secondary opacity-70 mt-1 leading-snug">
              🟢 = 메모리 적재 중 / ⚪ = 디스크에만 저장. 다운로드된 모델은 <code className="bg-bg px-1 rounded">~/.ollama/models/</code> 에 저장됨.
            </p>
          )}
        </div>
      )}

      {/* 시스템 정보 (브라우저로 가져올 수 있는 부분만) */}
      <div className="border-t border-border pt-2">
        <p className="text-[11px] font-bold text-text mb-1">🖥️ 시스템 정보 (브라우저 접근 가능 범위)</p>
        <div className="text-[10px] text-text-secondary space-y-0.5 leading-relaxed">
          {deviceMemoryGb ? (
            <p>
              • PC RAM (대략): <span className="font-mono text-text">{deviceMemoryGb} GB</span>
              <span className="opacity-70 ml-1">(navigator.deviceMemory · 4/8/16/32 단위로 반올림됨)</span>
            </p>
          ) : (
            <p>• PC RAM: <span className="opacity-70">브라우저 미지원</span></p>
          )}
          <p>
            • 시스템 RAM 사용률 / GPU 정보 / CPU 사용률:
            <span className="text-amber-700 dark:text-amber-300 ml-1">❌ 가져올 수 없음</span>
            <span className="opacity-70 ml-1">(브라우저 보안 제약)</span>
          </p>
          <p className="opacity-80 pt-0.5">
            💡 정확한 시스템 모니터링은 macOS <b>활성 상태 보기</b> / Windows <b>작업 관리자</b> /
            Linux <b>htop</b> 사용
          </p>
        </div>
      </div>
    </div>
  );
}
