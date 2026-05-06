// 메모리 상태 아코디언 카드 (격리 + 통합 양쪽 재활용)
//
// 사용:
//   <MemoryCard
//     title="📊 격리 서버 메모리 상태"
//     service="aitutor-server-infer"
//     endpoint="/api/iso-infer?action=memory"
//     unloadEndpoint="/api/iso-infer?action=unload-all"           // optional (warm 유지, GPU VRAM 회수)
//     restartEndpoint="/api/iso-infer?action=restart-container"   // optional (메모리 100% 회수, cold start)
//     restartImpactWarning="..."                                  // optional (통합 본업 영향 경고용)
//   />
//
// 동작:
//   - 닫힘 상태: 단순 라벨 ("펼쳐서 확인")
//   - 펼칠 때: 항상 새로 fetch (사용자 명시 — 캐시 안 함)
//   - [🔄 새로고침] 버튼: 수동 재조회
//   - [🗑️ 모두 언로드] 버튼: unloadEndpoint 있을 때만 노출 (warm 유지, GPU VRAM + weights 회수)
//   - [♻️ 인스턴스 재시작] 버튼: restartEndpoint 있을 때만 노출 (메모리 100% 회수)
//
// 통합 service 도 격리와 동일하게 두 회수 옵션 노출.
//   restartImpactWarning prop 으로 본업 영향(통합) / 영향 0(격리) 차별화.

import { useState } from 'react';

// ─── helpers ─────────────────────────────────────────────
const fmtBytes = (b) => {
  if (!b || b <= 0) return '0';
  if (b < 1024) return `${b}B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)}MB`;
  return `${(b / 1024 ** 3).toFixed(2)}GB`;
};

const fmtMb = (mb) => {
  if (!mb || mb <= 0) return '0';
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
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

const PaletteBar = ({ percent, color = 'violet' }) => {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const colorMap = {
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="h-1.5 bg-bg rounded-full overflow-hidden">
      <div className={`h-full transition-all ${colorMap[color] || colorMap.violet}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

// ─── MemoryCard 컴포넌트 ─────────────────────────────────
export default function MemoryCard({
  title = '📊 메모리 상태',
  service,
  endpoint,
  unloadEndpoint,
  restartEndpoint,
  restartImpactWarning,  // 통합 service 본업 영향 경고용 추가 메시지
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unloading, setUnloading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState(null);

  const fetchMemory = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(endpoint, { credentials: 'include' });
      const txt = await r.text();
      let d;
      try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
      if (!r.ok) throw new Error(d?.message || d?.error || `HTTP ${r.status}`);
      setData(d);
      setLastFetchAt(new Date());
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!open) {
      // 펼침 시 항상 새로 fetch (사용자 명시 — 캐시 안 함)
      setOpen(true);
      await fetchMemory();
    } else {
      setOpen(false);
    }
  };

  const handleUnloadAll = async () => {
    if (!unloadEndpoint) return;
    if (!confirm('현재 로드된 모든 모델을 즉시 unload 합니다.\n컨테이너는 유지되며 (warm) 다음 호출은 모델만 재로드 (~30초~2분).\n\n메모리 100% 회수가 필요하면 [♻️ 인스턴스 재시작] 을 사용하세요.\n\n계속하시겠습니까?')) return;
    setUnloading(true);
    try {
      const r = await fetch(unloadEndpoint, { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || d?.error || `HTTP ${r.status}`);
      const unloaded = d.unloaded || [];
      const errs = d.errors || [];
      const lines = [
        `🗑️ 언로드 결과 (warm 유지)`,
        `해제된 모델: ${unloaded.length ? unloaded.join(', ') : '(없음)'}`,
        ``,
        `⚠ GPU VRAM + weights 만 회수됩니다.`,
        `컨테이너 RAM (디스크 페이지 캐시) 은 유지될 수 있습니다.`,
      ];
      if (errs.length) lines.push(`에러: ${errs.join(' / ')}`);
      alert(lines.join('\n'));
      await fetchMemory();
    } catch (e) {
      alert(`언로드 실패: ${e?.message || e}`);
    } finally {
      setUnloading(false);
    }
  };

  // 컨테이너 자체 종료 (메모리 100% 회수, 다음 호출 cold start)
  const handleRestartContainer = async () => {
    if (!restartEndpoint) return;
    const baseMsg =
      '🚨 컨테이너 자체를 강제 종료합니다.\n\n' +
      '[ 효과 ]\n' +
      '✅ 메모리 100% 회수 (디스크 캐시 + Go runtime + Python heap 모두)\n' +
      '✅ Cloud Run 이 다음 호출 시 새 인스턴스 spawn (완전 cold start)\n\n' +
      '[ 비용 ]\n' +
      '⏱ 다음 호출 ~30초~2분 (모델 lazy pull 포함)\n' +
      '⚠ 진행 중인 다른 사용자 요청 있으면 중단됨\n';
    // 통합 service 의 본업 영향 경고 (격리는 빈 문자열)
    const impactMsg = restartImpactWarning
      ? `\n[ ⚠ 본업 영향 ]\n${restartImpactWarning}\n`
      : '';
    if (!confirm(baseMsg + impactMsg + '\n계속하시겠습니까?')) return;

    setRestarting(true);
    try {
      const r = await fetch(restartEndpoint, { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || d?.error || `HTTP ${r.status}`);
      alert(
        '♻️ 인스턴스 재시작 예약됨\n\n' +
        `${d.message || '컨테이너 곧 종료'}\n` +
        `${d.next_call_warning || ''}\n\n` +
        '5초 후 메모리 상태 자동 새로고침합니다.\n' +
        '(이 시점에는 인스턴스 종료 중이라 503 가능 — 정상)'
      );
      // 5초 후 자동 새로고침 — Cloud Run 인스턴스 종료 후 새 인스턴스 spawn 안 했을 가능성 → 503 가능
      setTimeout(() => { fetchMemory(); }, 5000);
    } catch (e) {
      alert(`재시작 요청 실패: ${e?.message || e}`);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card-bg overflow-hidden">
      {/* 헤더 (클릭 → 펼침/접힘) */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-bg/50 transition-colors text-left"
      >
        <span className="text-xs font-bold text-text">
          <span className="inline-block w-3">{open ? '▼' : '▶'}</span> {title}
        </span>
        <span className="text-[10px] text-text-secondary">
          {service && <span className="font-mono opacity-70">{service}</span>}
          {service && ' · '}
          {open ? '접기' : '펼쳐서 확인'}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* 상태 라인 */}
          <div className="flex items-center justify-between pt-2 text-[10px]">
            <span className="text-text-secondary">
              {loading ? '🔄 갱신 중…' : lastFetchAt ? `갱신: ${lastFetchAt.toLocaleTimeString()}` : ''}
            </span>
            <button
              type="button"
              onClick={fetchMemory}
              disabled={loading}
              className="px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-200 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 disabled:opacity-50 font-bold"
            >
              🔄 새로고침
            </button>
          </div>

          {error && (
            <div className="text-[11px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              ⚠ {error}
            </div>
          )}

          {data && (
            <>
              {/* 컨테이너 RAM */}
              {data.container?.total_mb > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] text-text">
                    <span className="font-bold">컨테이너 RAM</span>
                    <span>{fmtMb(data.container.used_mb)} / {fmtMb(data.container.total_mb)} ({data.container.percent}%)</span>
                  </div>
                  <PaletteBar percent={data.container.percent} color="violet" />
                </div>
              )}

              {/* GPU VRAM */}
              {data.gpu?.total_mb > 0 ? (
                <div>
                  <div className="flex justify-between text-[11px] text-text">
                    <span className="font-bold">GPU L4 VRAM</span>
                    <span>{fmtMb(data.gpu.used_mb)} / {fmtMb(data.gpu.total_mb)} ({data.gpu.percent}%)</span>
                  </div>
                  <PaletteBar percent={data.gpu.percent} color="emerald" />
                  <div className="text-[10px] text-text-secondary mt-1">
                    GPU 사용률 {data.gpu.util_percent}% · 온도 {data.gpu.temp_c}°C
                  </div>
                </div>
              ) : data.gpu?.error ? (
                <div className="text-[10px] text-text-secondary">
                  GPU 정보 미수집: {data.gpu.error}
                </div>
              ) : null}

              {/* Ollama 로드 모델 */}
              {data.ollama && (
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] font-bold text-text mb-1.5">
                    Ollama 로드 모델 ({data.ollama.loaded?.length || 0})
                    {!data.ollama.reachable && <span className="text-amber-700 dark:text-amber-300 ml-1">· ❌ unreachable</span>}
                  </p>
                  {data.ollama.loaded?.length > 0 ? (
                    <ul className="space-y-1">
                      {data.ollama.loaded.map((m, i) => (
                        <li key={i} className="text-[10px] text-text-secondary leading-relaxed">
                          • <span className="font-mono text-text font-bold">{m.name}</span>
                          {' · '}
                          {fmtBytes(m.size_total)}
                          {m.size_vram > 0 && <> (VRAM <span className="text-emerald-600 dark:text-emerald-400">{fmtBytes(m.size_vram)}</span>)</>}
                          {m.expires_at && <> · <span className="opacity-70">{fmtExpiresAt(m.expires_at)}</span></>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[10px] text-text-secondary opacity-70">로드된 모델 없음 (cold start 상태)</p>
                  )}
                </div>
              )}

              {/* Python sub-server (메인 통합 모드만 노출됨) */}
              {data.sub_server && (
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] font-bold text-text mb-1.5">
                    Python sub-server
                    {' · '}
                    {data.sub_server.reachable ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✅ active</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">❌ unreachable</span>
                    )}
                    {' · 모델 '}{data.sub_server.loaded?.length || 0}
                  </p>
                  {data.sub_server.loaded?.length > 0 ? (
                    <ul className="space-y-1">
                      {data.sub_server.loaded.map((m, i) => (
                        <li key={i} className="text-[10px] text-text-secondary">
                          • {m.engine} · <span className="font-mono text-text">{m.model_key}</span>
                          {m.daemon && <span className="ml-1 opacity-70">(daemon)</span>}
                        </li>
                      ))}
                    </ul>
                  ) : data.sub_server.reachable ? (
                    <p className="text-[10px] text-text-secondary opacity-70">in-memory 모델 없음</p>
                  ) : null}
                </div>
              )}

              {/* Lazy daemons (메인 통합 모드만 — llama-server, vLLM) */}
              {data.daemons && Object.keys(data.daemons).length > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] font-bold text-text mb-1">Lazy daemons</p>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {Object.entries(data.daemons).map(([name, d]) => (
                      <div key={name} className="text-text-secondary">
                        {d.reachable ? '✅' : '⚪'} {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 모두 언로드 버튼 (격리만) — warm 유지 */}
              {unloadEndpoint && (
                <button
                  type="button"
                  onClick={handleUnloadAll}
                  disabled={unloading || restarting || !data.ollama?.loaded?.length}
                  className="w-full mt-1 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 text-[11px] font-bold text-red-900 dark:text-red-200 transition-colors"
                  title={!data.ollama?.loaded?.length ? '로드된 모델 없음' : '모든 모델 즉시 unload (warm 유지)'}
                >
                  {unloading ? '🗑️ 언로드 중…' : '🗑️ 모두 언로드 (warm 유지)'}
                </button>
              )}

              {/* 인스턴스 재시작 버튼 — 메모리 100% 회수 */}
              {restartEndpoint && (
                <button
                  type="button"
                  onClick={handleRestartContainer}
                  disabled={unloading || restarting}
                  className="w-full py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 text-[11px] font-bold text-amber-900 dark:text-amber-200 transition-colors"
                  title="컨테이너 자체 종료 → 다음 호출은 cold start (~30초~2분)"
                >
                  {restarting ? '♻️ 재시작 중…' : '♻️ 인스턴스 재시작 (메모리 100% 회수)'}
                </button>
              )}

              {restartEndpoint && (
                <p className="text-[10px] text-text-secondary opacity-70 leading-relaxed">
                  💡 <b>모두 언로드</b>: GPU VRAM + weights 만 회수, 컨테이너 warm 유지 (다음 호출 빠름)
                  <br />
                  💡 <b>인스턴스 재시작</b>: 컨테이너 자체 종료 → 메모리 100% 회수, 다음 호출 cold start
                </p>
              )}
            </>
          )}

          {!data && !loading && !error && (
            <p className="text-[11px] text-text-secondary opacity-70">새로고침 버튼으로 정보 조회</p>
          )}
        </div>
      )}
    </div>
  );
}
