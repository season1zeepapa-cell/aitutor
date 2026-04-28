// 메모리 확보 도움말 카드 — 라이트/다크 테마 통일
//
// 노출 조건:
//   - fit ❌ 또는 ⚠️ 인 모델이 1개 이상
//   - 전체 ✅ 면 카드 자체 비표시 (소음 줄이기)

import { useEffect, useState } from 'react';
import { MODEL_REGISTRY, MODEL_KEYS, MODEL_URLS, deleteModelCache, getModelCacheStatus } from '../lib/inference';
import { getMemoryInfo } from '../lib/deviceCheck';
import { fitVerdict } from '../lib/memoryFit';

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const PLATFORM_TIPS = {
  ios: [
    { icon: '🚪', text: '홈 버튼 두 번 또는 위로 스와이프 → 백그라운드 앱 모두 종료' },
    { icon: '🗂', text: 'Safari 의 다른 탭 모두 닫기 (탭 아이콘 길게 눌러 "X 개 탭 모두 닫기")' },
    { icon: '🔋', text: '저전력 모드 OFF (설정 > 배터리) — GPU 클럭 제한 해제' },
    { icon: '🔄', text: '재부팅 (전원 + 음량↑ 길게) — 메모리 단편화 해결, 가장 확실' },
    { icon: '📲', text: '"공유 → 홈 화면에 추가" 로 PWA 설치 시 브라우저 UI 메모리 약간 절감' },
  ],
  android: [
    { icon: '🚪', text: '최근 앱 버튼 → "모두 닫기"' },
    { icon: '🗂', text: 'Chrome 의 다른 탭 모두 닫기 (탭 아이콘 → 메뉴 → "모든 탭 닫기")' },
    { icon: '🔋', text: '배터리 절약 모드 OFF — GPU 성능 제한 해제' },
    { icon: '🔄', text: '재부팅 — 메모리 단편화 해결' },
    { icon: '📲', text: 'Chrome 메뉴 → "홈 화면에 추가" 로 PWA 설치' },
  ],
  desktop: [
    { icon: '🗂', text: '브라우저의 다른 탭 모두 닫기 (특히 YouTube/Figma/Slack 같은 무거운 페이지)' },
    { icon: '⚙️', text: '다른 GPU 사용 앱 종료 (게임, 영상 편집, Docker Desktop 등)' },
    { icon: '🔄', text: '브라우저 재시작 — 메모리 단편화 해결' },
    { icon: '🌐', text: 'Chrome `chrome://gpu` 에서 WebGPU 활성 여부 확인' },
  ],
  unknown: [
    { icon: '🗂', text: '다른 탭 / 앱 모두 닫기' },
    { icon: '🔄', text: '재부팅' },
  ],
};

export default function MemoryHelpCard({ activeSize, onActivate, onAfterChange, disabled = false }) {
  const [mem, setMem] = useState(null);
  const [verdicts, setVerdicts] = useState({});
  const [otherCached, setOtherCached] = useState([]);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(true);
  const platform = detectPlatform();
  const tips = PLATFORM_TIPS[platform] || PLATFORM_TIPS.unknown;

  const refresh = async () => {
    const m = await getMemoryInfo();
    setMem(m);
    const v = {};
    for (const k of MODEL_KEYS) v[k] = fitVerdict(m, MODEL_REGISTRY[k]);
    setVerdicts(v);

    const cached = [];
    for (const k of MODEL_KEYS) {
      if (k === activeSize) continue;
      const st = await getModelCacheStatus(MODEL_URLS[k]);
      if (st.cached) cached.push({ key: k, size: st.size });
    }
    setOtherCached(cached);
  };

  useEffect(() => { refresh(); }, [activeSize]);

  const hasIssue = Object.values(verdicts).some(v => v && v.ok !== true);
  if (!hasIssue) return null;

  const bestFitKey = MODEL_KEYS
    .filter(k => verdicts[k]?.ok === true)
    .sort((a, b) => MODEL_REGISTRY[b].approxSizeGB - MODEL_REGISTRY[a].approxSizeGB)[0];
  const bestFit = bestFitKey ? MODEL_REGISTRY[bestFitKey] : null;

  const handleClearOthers = async () => {
    if (otherCached.length === 0) return;
    const totalGB = (otherCached.reduce((s, x) => s + x.size, 0) / 1024 / 1024 / 1024).toFixed(2);
    const list = otherCached.map(x => MODEL_REGISTRY[x.key].label).join(', ');
    if (!confirm(`다음 모델의 디스크 캐시를 삭제합니다 (~${totalGB}GB 회수):\n${list}\n\n계속할까요?`)) return;
    setBusy('clear');
    try {
      for (const x of otherCached) await deleteModelCache(MODEL_URLS[x.key]);
      await refresh();
      if (onAfterChange) onAfterChange();
    } finally {
      setBusy('');
    }
  };

  const totalCachedGB = (otherCached.reduce((s, x) => s + x.size, 0) / 1024 / 1024 / 1024).toFixed(2);

  return (
    <div className="rounded-xl border-2 border-warning/60 dark:border-warning/40 bg-amber-50 dark:bg-amber-900/20">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-amber-900 dark:text-amber-200"
      >
        <span>🆘 메모리 확보 도움말</span>
        <span className="text-xs text-amber-700 dark:text-amber-300/80 font-normal">
          {platform === 'ios' && '📱 iOS'}
          {platform === 'android' && '📱 Android'}
          {platform === 'desktop' && '💻 데스크탑'}
          <span className="ml-1.5">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-amber-200 dark:border-amber-800/50">
          {/* 빠른 액션 */}
          <div className="space-y-2 pt-2">
            {bestFit && bestFitKey !== activeSize && (
              <button
                onClick={() => onActivate?.(bestFitKey)}
                disabled={!!busy || disabled}
                className="w-full text-left rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white px-3 py-2.5 disabled:opacity-50 transition-colors"
              >
                <p className="text-xs font-bold">👉 가장 큰 ✅ 모델로 전환</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {bestFit.label} ({bestFit.params}, ~{bestFit.approxSizeGB}GB) — 이 디바이스에서 안전
                </p>
              </button>
            )}

            {otherCached.length > 0 && (
              <button
                onClick={handleClearOthers}
                disabled={!!busy || disabled}
                className="w-full text-left rounded-lg bg-primary hover:bg-primary-hover text-white px-3 py-2.5 disabled:opacity-50 transition-colors"
              >
                <p className="text-xs font-bold">
                  🗑 다른 모델 캐시 정리 (~{totalCachedGB}GB 회수)
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {otherCached.map(x => MODEL_REGISTRY[x.key].label).join(', ')} 디스크에서 삭제
                  {busy === 'clear' ? ' — 진행 중…' : ''}
                </p>
              </button>
            )}
          </div>

          {/* 사용자 직접 액션 — 디바이스별 */}
          <div className="rounded-lg bg-card-bg border border-border p-3">
            <p className="text-xs font-bold text-text mb-1.5">
              👇 직접 메모리 확보 (효과 큰 순)
            </p>
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-[11.5px] text-text-secondary leading-relaxed">
                  <span className="flex-shrink-0">{tip.icon}</span>
                  <span className="flex-1">{tip.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 한계 안내 */}
          <p className="text-[10px] text-amber-800 dark:text-amber-300/80 leading-relaxed bg-card-bg border border-border rounded-lg px-3 py-2">
            ℹ️ 브라우저 페이지는 OS 가 관리하는 GPU·RAM 한계를 직접 늘릴 수 없습니다.
            모바일은 통합 GPU 메모리를 OS·다른 앱과 공유하므로 위 조치가 최선입니다.
            {platform !== 'desktop' && (
              <> REBUILD17 §12.3-C 검증 결과 모바일 WebGPU 는 메모리 한계가 빡빡해 더 작은 모델 권장.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
