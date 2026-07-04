// 이론 객관식·단답형 등 드릴 시작 설정 — /kisa/drill-config?type=objective|blank|shortessay
//   ① 카테고리 다중선택(전체/개별) ② 출제 순서 토글(순서대로 ↔ 랜덤, 초기값 순서대로)
//   시작 → /kisa/drill?type=...&full=1&categories=...&order=guide(순서) | (없으면 랜덤)
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../lib/api';

const TYPE_META = {
  blank:      { emoji: '✍️', title: '단답형 드릴',        desc: '빈칸 채우기' },
  objective:  { emoji: '📝', title: '이론 객관식',        desc: '코드/설명 지문 + 4~5지선다' },
  shortessay: { emoji: '🖊️', title: '단순서술형',         desc: '보안약점 정·오탐 분석 서술' },
};
// 설계(20)/구현(49) 단계 선택
const STAGES = [
  { key: '', label: '전체' },
  { key: 'design', label: '설계' },
  { key: 'implementation', label: '구현' },
];
// 약점 7분류 — 표준 순서
const CATS = [
  { key: 'input_validation', emoji: '🔍', label: '입력데이터 검증 및 표현' },
  { key: 'security_feature', emoji: '🔐', label: '보안기능' },
  { key: 'time_state',       emoji: '⏱️', label: '시간 및 상태' },
  { key: 'error_handling',   emoji: '⚠️', label: '에러처리' },
  { key: 'code_error',       emoji: '🐛', label: '코드오류' },
  { key: 'encapsulation',    emoji: '📦', label: '캡슐화' },
  { key: 'api_abuse',        emoji: '🔧', label: 'API오용' },
  { key: 'session_control',  emoji: '🎫', label: '세션통제' },
];

const TYPE_KEYS = ['objective', 'blank', 'shortessay']; // 이 설정 화면이 다루는 유형

export default function DrillConfig() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [type, setType] = useState(TYPE_META[sp.get('type')] ? sp.get('type') : 'objective'); // 유형 선택 가능
  const meta = TYPE_META[type];
  // objective/shortessay 는 설계·구현이 섞여 stage 선택이 유의미
  const showStage = type === 'objective' || type === 'shortessay';

  // URL 로 초기 카테고리·단계 프리셋 (대시보드 "카테고리 바로 시작" 연결)
  const initCats = (sp.get('categories') || sp.get('category') || '')
    .split(',').map((s) => s.trim()).filter((s) => CATS.some((c) => c.key === s));
  const initStage = ['design', 'implementation'].includes(sp.get('stage')) ? sp.get('stage') : '';

  const [sel, setSel] = useState(initCats);    // 선택 카테고리 (빈 배열 = 전체)
  const [stage, setStage] = useState(initStage); // '' | 'design' | 'implementation'
  const [order, setOrder] = useState('guide'); // 'guide'(순서대로, 초기값) | 'random'
  const [counts, setCounts] = useState(null);  // 카테고리별 문항수
  const [total, setTotal] = useState(null);

  const stageQ = stage ? `&stage=${stage}` : '';
  // 카테고리별 문항수 조회 (전체 + 각 분류) — 선택 UI 에 개수 표시. stage 필터 반영.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const totalRes = await apiGet(`/api/kisa-drill?action=count&type=${type}${stageQ}`);
        if (alive) setTotal(totalRes.total || 0);
        const entries = await Promise.all(
          CATS.map(async (c) => {
            const r = await apiGet(`/api/kisa-drill?action=count&type=${type}&category=${c.key}${stageQ}`);
            return [c.key, r.total || 0];
          })
        );
        if (alive) setCounts(Object.fromEntries(entries));
      } catch { /* 개수는 부가정보 — 실패해도 시작 가능 */ }
    })();
    return () => { alive = false; };
  }, [type, stage]);

  const toggle = (key) => setSel((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // 선택 카테고리(없으면 전체) 문항수 합
  const selectedTotal = sel.length === 0
    ? total
    : (counts ? sel.reduce((a, k) => a + (counts[k] || 0), 0) : null);

  // 유형 변경 시 그 유형에 없는 stage 는 초기화(blank 은 단계 구분 없음)
  const changeType = (t) => {
    setType(t);
    if (t !== 'objective' && t !== 'shortessay') setStage('');
  };

  const start = () => {
    const p = new URLSearchParams({ type, full: '1' });
    if (sel.length > 0) p.set('categories', sel.join(','));
    if (stage) p.set('stage', stage);
    if (order === 'guide') p.set('order', 'guide'); // 랜덤은 파라미터 없음(서버 기본)
    navigate(`/kisa/drill?${p}`);
  };

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/kisa')} className="text-text-secondary hover:text-text" aria-label="뒤로">←</button>
        <h2 className="text-base font-bold">{meta.emoji} {meta.title}</h2>
        {total != null && <span className="ml-auto text-xs font-mono text-text-secondary">전체 {total}문항</span>}
      </div>

      {/* 문제유형 선택 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <p className="text-xs font-bold text-text mb-2">문제유형</p>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPE_KEYS.map((t) => {
            const m = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => changeType(t)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold border transition-all ${
                  type === t ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
                }`}
              >
                <span>{m.emoji}</span><span className="truncate">{m.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 설계/구현 단계 선택 (objective·shortessay) */}
      {showStage && (
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <p className="text-xs font-bold text-text mb-2">단계 <span className="font-normal text-text-secondary">(설계 20 · 구현 49 영역)</span></p>
          <div className="grid grid-cols-3 gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.key || 'all'}
                onClick={() => setStage(s.key)}
                className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                  stage === s.key ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 카테고리 선택 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-text">카테고리 <span className="font-normal text-text-secondary">(다중선택 · 미선택 시 전체)</span></p>
          {sel.length > 0 && (
            <button onClick={() => setSel([])} className="text-[10px] text-primary hover:underline">전체 해제</button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSel([])}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-bold transition-all ${
              sel.length === 0 ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
            }`}
          >
            전체 {total != null ? total : ''}
          </button>
          {CATS.map((c) => {
            const on = sel.includes(c.key);
            const n = counts?.[c.key];
            if (counts && !n) return null; // 문항 0인 분류는 숨김
            return (
              <button
                key={c.key}
                onClick={() => toggle(c.key)}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-bold transition-all ${
                  on ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
                }`}
              >
                {on ? '✓ ' : ''}{c.emoji} {c.label}{n != null ? ` ${n}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* 출제 순서 토글 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <p className="text-xs font-bold text-text mb-2">출제 순서</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setOrder('guide')}
            className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
              order === 'guide' ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
            }`}
          >
            📑 순서대로<span className="block text-[10px] font-normal opacity-80 mt-0.5">가이드 분류·번호순</span>
          </button>
          <button
            onClick={() => setOrder('random')}
            className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
              order === 'random' ? 'border-primary bg-primary text-white' : 'border-border text-text-secondary hover:border-primary/40'
            }`}
          >
            🔀 랜덤<span className="block text-[10px] font-normal opacity-80 mt-0.5">무작위 출제</span>
          </button>
        </div>
      </div>

      {/* 시작 */}
      <button
        onClick={start}
        disabled={selectedTotal === 0}
        className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
      >
        {meta.title} 시작{selectedTotal != null ? ` (${selectedTotal}문항)` : ''} →
      </button>
      <p className="text-[11px] text-text-secondary text-center leading-relaxed">
        {showStage && stage ? `${stage === 'design' ? '설계' : '구현'} · ` : ''}
        {sel.length === 0 ? '전체 카테고리' : `선택 ${sel.length}개 분류`} · {order === 'guide' ? '순서대로' : '랜덤'} 출제.
        중단해도 안 푼 문항부터 이어집니다.
      </p>

      <button onClick={() => navigate('/kisa')} className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary">
        ← 대시보드로
      </button>
    </div>
  );
}
