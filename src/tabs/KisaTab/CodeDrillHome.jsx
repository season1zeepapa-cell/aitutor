// 코드 약점드릴 — 전수 학습 랜딩 (REBUILD71 · UI 개선 REBUILD72 · 출처 다중선택 REBUILD74)  /kisa/code-drill
//   전체 303문항 또는 약점 분류 그룹별로 "전수" 풀이. 진도(이미 푼 문항수)를 표시하고,
//   중단한 지점부터 "이어서 학습하기"(미시도 문항 우선 서빙 → 자동 재개).
//   상단 출처(자료원) 칩을 다중선택하면 해당 출처 문항만 진도·출제 대상이 된다.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';

// 출처(자료원) 칩 라벨 — tags 에 저장된 출처 id 기준 (kisa-library sources 와 동일 체계)
const SOURCE_LABELS = {
  library: '진단가이드',
  kisec2026: '2026교재',
  jssec2023: 'JS가이드',
  devsec2021: '개발보안',
  pysec2023: 'Python가이드',
};
const SOURCE_ORDER = ['library', 'kisec2026', 'devsec2021', 'jssec2023', 'pysec2023'];

const CATEGORY_LABELS = {
  input_validation: '입력데이터 검증 및 표현',
  security_feature: '보안기능',
  time_state: '시간 및 상태',
  error_handling: '에러처리',
  code_error: '코드오류',
  encapsulation: '캡슐화',
  api_abuse: 'API오용',
  session_control: '세션통제',
};
// KISA 진단가이드 표준 구현약점 분류 순서 (알파벳순 아님)
const CATEGORY_ORDER = [
  'input_validation', 'security_feature', 'time_state', 'error_handling',
  'code_error', 'encapsulation', 'api_abuse', 'session_control',
];

// 진도에 따른 짧은 액션 라벨
function shortLabel(done, total) {
  if (total === 0) return '—';
  if (done === 0) return '시작';
  if (done >= total) return '복습';
  return '이어서';
}

export default function CodeDrillHome() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 출처 다중선택 — 빈 배열 = 전체 (필터 없음)
  const [selSources, setSelSources] = useState([]);
  // 중복 제거 토글 — ON 이면 출처 간 동일 코드를 1개로 합쳐 출제(대표 1개)
  const [dedup, setDedup] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams({ action: 'progress', type: 'codeid' });
    if (selSources.length > 0) p.set('sources', selSources.join(','));
    if (dedup) p.set('dedup', 'true');
    apiGet(`/api/kisa-drill?${p}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selSources, dedup]);

  const toggleSource = (src) => {
    setSelSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    );
  };

  const go = (category) => {
    const p = new URLSearchParams({ type: 'codeid', full: '1' });
    if (category) p.set('category', category);
    if (selSources.length > 0) p.set('sources', selSources.join(','));
    if (dedup) p.set('dedup', 'true');
    navigate(`/kisa/drill?${p}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => navigate('/kisa')} className="mt-3 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs">대시보드로</button>
      </div>
    );
  }

  const overall = data?.overall || { total: 0, attempted: 0 };
  const oDone = overall.attempted ?? 0;
  const oTotal = overall.total ?? 0;
  const oPct = oTotal > 0 ? Math.round((oDone / oTotal) * 100) : 0;

  // 표준 순서로 정렬 (미정의 분류는 뒤로)
  const byCat = (data?.byCategory || [])
    .filter((c) => c.total > 0)
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category);
      const ib = CATEGORY_ORDER.indexOf(b.category);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/kisa')} className="text-text-secondary hover:text-text" aria-label="뒤로">←</button>
        <h2 className="text-base font-bold">💻 코드 약점드릴</h2>
        <span className="ml-auto text-xs font-mono text-text-secondary">{oDone}/{oTotal} · {oPct}%</span>
      </div>

      {/* 출처(자료원) 다중선택 칩 — 선택한 출처의 문항만 진도·출제 대상 */}
      {(data?.bySource || []).length > 0 && (
        <div className="rounded-xl bg-card-bg border border-border p-2.5">
          <p className="text-[10px] font-bold text-text-secondary mb-1.5">출처 선택 (다중선택 가능)</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelSources([])}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-bold transition-all ${
                selSources.length === 0
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-text-secondary hover:border-primary/40'
              }`}
            >
              전체
            </button>
            {[...(data.bySource || [])]
              .sort((a, b) => {
                const ia = SOURCE_ORDER.indexOf(a.source);
                const ib = SOURCE_ORDER.indexOf(b.source);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
              })
              .map((s) => {
                const on = selSources.includes(s.source);
                return (
                  <button
                    key={s.source}
                    onClick={() => toggleSource(s.source)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-bold transition-all ${
                      on
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-text-secondary hover:border-primary/40'
                    }`}
                  >
                    {on ? '✓ ' : ''}{SOURCE_LABELS[s.source] || s.source} {s.attempted}/{s.total}
                  </button>
                );
              })}
          </div>
          {selSources.length > 0 && (
            <p className="text-[10px] text-primary/70 mt-1.5">
              선택한 {selSources.length}개 출처의 문항만 학습합니다 (아래 진도·그룹도 선택 기준으로 갱신)
            </p>
          )}
          {/* 중복 제거 토글 — 출처 간 동일 코드를 1개로 합침 */}
          <label className="flex items-center gap-2 mt-2 pt-2 border-t border-border cursor-pointer">
            <input
              type="checkbox"
              checked={dedup}
              onChange={(e) => setDedup(e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            <span className="text-[11px] text-text-secondary flex-1">
              중복 코드 제거 <span className="text-text-secondary/70">— 여러 출처에 나오는 같은 예시코드를 1문항으로</span>
            </span>
            <span className="text-[10px] font-mono text-primary/60">
              {dedup ? '중복제거 ON' : `전량 ${data?.overall?.total ?? ''}`}
            </span>
          </label>
        </div>
      )}

      {/* 전체 진도 + 전체 이어서 (콤팩트) */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-3">
        <div className="h-1.5 rounded-full bg-white/60 dark:bg-black/20 overflow-hidden mb-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${oPct}%` }} />
        </div>
        <button
          onClick={() => go('')}
          disabled={oTotal === 0}
          className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          전체 {oDone === 0 ? '학습 시작' : oDone >= oTotal ? '복습하기' : '이어서 학습하기'} →
        </button>
        <p className="text-[11px] text-text-secondary leading-snug mt-2">
          코드를 보고 ① 보안약점(49개 중) ② 안전/취약을 맞힙니다. 중단하면 <b>안 푼 문제부터</b> 이어지고, SRS·오답노트에 반영돼요.
        </p>
      </div>

      {/* 약점 분류 그룹별 — 카드 전체 탭 (콤팩트 2줄) */}
      <p className="text-[11px] font-bold text-text-secondary px-1 pt-1">약점 분류 그룹별</p>
      <div className="space-y-1.5">
        {byCat.map((c) => {
          const pct = c.total > 0 ? Math.round((c.attempted / c.total) * 100) : 0;
          const done = c.attempted >= c.total;
          return (
            <button
              key={c.category}
              onClick={() => go(c.category)}
              className="w-full text-left rounded-xl bg-card-bg border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-primary-light/40 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text truncate flex-1">{CATEGORY_LABELS[c.category] || c.category}</span>
                <span className="text-[11px] font-mono text-text-secondary shrink-0">{c.attempted}/{c.total}</span>
                <span className={`text-[11px] font-bold shrink-0 ${done ? 'text-green-600 dark:text-green-400' : 'text-primary'}`}>
                  {done ? '완주 ✓' : shortLabel(c.attempted, c.total) + ' →'}
                </span>
              </div>
              <div className="h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden mt-1.5">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* 빠른 퀴즈(비기록) 링크 */}
      <button
        onClick={() => navigate('/kisa/code-quiz')}
        className="w-full py-2 rounded-lg border border-border text-[11px] text-text-secondary hover:bg-card-bg-hover transition-colors"
      >
        ⚡ 기록 없이 빠르게 연습 (문항수 선택)
      </button>
    </div>
  );
}
