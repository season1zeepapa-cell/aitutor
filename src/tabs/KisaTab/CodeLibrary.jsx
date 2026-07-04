// 예시코드 라이브러리 — /kisa/code-library
// 5개 공식 문서(자료원)별로 보안약점 49개 그룹(입력검증→…→API오용) 순서에 따라
// 취약(❌)/안전(✅) 예시 코드를 전수 조회하는 화면.
// 데이터: src/data/kisa-library.json (sources[].items[].codeExamples / diagnosisCode)
// 코드 렌더는 LibraryFab 의 CodeSection 을 재사용한다 (중복 구현 금지).
//
// REBUILD86 — 학습 레이어 3종 추가:
//   ① 읽기 진도: 항목 펼치면 자동 읽음(서버 저장), 칩에 진도, 이어보기 점프
//   ② 🎓 학습 모드: 라벨을 가린 코드의 취약/안전 블라인드 판별 (codebank 1,049블록, 위치·통계는 로컬)
//   ③ 약점별 드릴 연결: 항목에서 해당 약점 codeid 드릴 바로 시작 (weakness_code 필터)
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import libData from '../../data/kisa-library.json';
import codebank from '../../data/kisa-codebank.json';
import { CodeSection } from '../../components/LibraryFab';
import SharedCodeBlock from '../../components/CodeBlock';
import { apiGet, apiPost, isLoggedIn } from '../../lib/api';

// 자료원 칩 라벨·색 (코드예시 보유 자료원만 노출)
const SOURCE_META = {
  devsec2021: { label: '개발보안 가이드(2021)', short: '개발보안', lang: 'Java', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-400/40' },
  library: { label: '진단가이드(2021)', short: '진단가이드', lang: 'Java', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/40' },
  kisec2026: { label: '2026 기본과정 교재', short: '2026교재', lang: 'Java', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/40' },
  jssec2023: { label: 'JS 시큐어코딩 가이드(2023)', short: 'JS가이드', lang: 'JavaScript', cls: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-400/40' },
  pysec2023: { label: 'Python 시큐어코딩 가이드(2023)', short: 'Python가이드', lang: 'Python', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-400/40' },
};
// 문서 노출 순서 (공식 가이드 → 교재 → 언어별 가이드)
const SOURCE_ORDER = ['devsec2021', 'library', 'kisec2026', 'jssec2023', 'pysec2023'];

const CATEGORY_EMOJI = {
  '입력데이터 검증 및 표현': '🔍', 보안기능: '🔐', '시간 및 상태': '⏱️',
  에러처리: '⚠️', 코드오류: '🐛', 캡슐화: '📦', API오용: '🔧', 세션통제: '🎫',
};
// KISA 진단가이드 표준 약점 그룹 순서 — 출처와 무관하게 항상 이 순서로 그룹을 노출한다.
const CATEGORY_ORDER = [
  '입력데이터 검증 및 표현', '보안기능', '시간 및 상태', '에러처리',
  '코드오류', '캡슐화', 'API오용', '세션통제',
];
const catRank = (label) => {
  const i = CATEGORY_ORDER.indexOf(label);
  return i < 0 ? 99 : i;
};

// 항목이 조회할 코드(예시코드 또는 정탐/오탐 진단코드)를 갖고 있는지
const hasCode = (it) =>
  (it.codeExamples || []).length > 0 ||
  (it.diagnosisCode?.truePositive || []).length > 0 ||
  (it.diagnosisCode?.falsePositive || []).length > 0;

// 항목의 예시 코드 개수 (취약/안전 블록 단위)
const codeCount = (it) => {
  let n = 0;
  for (const c of it.codeExamples || []) {
    if (c.vulnerable) n += 1;
    if (c.safe) n += 1;
  }
  n += (it.diagnosisCode?.truePositive || []).length;
  n += (it.diagnosisCode?.falsePositive || []).length;
  return n;
};

// 검색어가 제목·코드·언어·분류에 포함되는지
const norm = (s) => (s || '').toLowerCase();
const matches = (it, q) =>
  norm(it.title).includes(q) ||
  norm(it.id).includes(q) ||
  norm(it.category).includes(q) ||
  (it.codeExamples || []).some(
    (c) => norm(c.lang).includes(q) || norm(c.vulnerable).includes(q) || norm(c.safe).includes(q) || norm(c.note).includes(q)
  );

// ── REBUILD86 학습 레이어 헬퍼 ─────────────────────────────────────────

// 읽음 키 (source/item_id)
const readKey = (source, itemId) => `${source}/${itemId}`;

// "Java (JDBC)" → CodeBlock 하이라이팅 토큰 (CodeQuiz.jsx langToken 과 동일 규칙)
const langToken = (lang) => {
  const s = String(lang || '').toLowerCase();
  if (s.includes('javascript') || /\bjs\b/.test(s) || s.includes('node')) return 'javascript';
  if (s.includes('typescript') || /\bts\b/.test(s)) return 'typescript';
  if (s.includes('python')) return 'python';
  if (s.includes('c#') || s.includes('csharp') || s.includes('.net')) return 'csharp';
  if (s.includes('java')) return 'java';
  if (s.includes('c++') || /\bc\b/.test(s)) return 'c';
  return 'java';
};

// 약점 제목 정규화 — 항목 제목 ↔ codebank 정본 약점 제목 매칭용
const normTitle = (s) => String(s || '').toLowerCase().replace(/[\s()[\]_\-·.]/g, '');

// codebank 파생 (모듈 스코프 1회 계산)
//   cardsBySource: 자료원별 블라인드 판별 카드 (CQ 발번순 = 약점 그룹 순서)
//   weaknessCount: 약점ID → 전체(전 문서) 코드블록 수 — 드릴 버튼 문항수 표시
//   titleToWeakness: 정본 약점 제목(정규화) → 약점ID
const cardsBySource = new Map();
const weaknessCount = new Map();
for (const it of codebank.items || []) {
  if (!cardsBySource.has(it.source)) cardsBySource.set(it.source, []);
  cardsBySource.get(it.source).push(it);
  weaknessCount.set(it.weaknessId, (weaknessCount.get(it.weaknessId) || 0) + 1);
}
const titleToWeakness = new Map();
for (const w of codebank.weaknesses || []) titleToWeakness.set(normTitle(w.title), w.id);
for (const it of codebank.items || []) titleToWeakness.set(normTitle(it.weaknessTitle), it.weaknessId);

// 항목 → codeid 드릴용 약점ID (IMP-XX-NN). id 가 정본 코드면 그대로, 아니면 제목 매칭.
const weaknessIdOf = (item) => {
  if (/^(DSG|IMP)-[A-Z]{2}-\d{2}$/.test(item.id)) {
    return weaknessCount.has(item.id) ? item.id : null;
  }
  return titleToWeakness.get(normTitle(item.title)) || null;
};

// 블라인드 판별 로컬 저장 (기기별 — 가벼운 즉석 학습이라 서버 채점 없음)
const POS_KEY = 'kisa-codelib-blind-pos-v1';    // {source: index}
const STATS_KEY = 'kisa-codelib-blind-stats-v1'; // {date, total, correct}
const JUDGED_KEY = 'kisa-codelib-blind-judged-v1'; // {source: {cardId: true|false}} — 약점별 진도·목차 표시용
const loadJson = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch { return fallback; }
};
const today = () => new Date().toISOString().slice(0, 10);
const loadStats = () => {
  const s = loadJson(STATS_KEY, null);
  return s && s.date === today() ? s : { date: today(), total: 0, correct: 0 };
};

// 접이식 약점 항목 행 — 펼치면 취약/안전 코드 전체 + 약점 드릴 연결
function WeaknessRow({ item, read, onRead, onDrill, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const wkId = weaknessIdOf(item);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !read) onRead(true); // 펼쳐보면 자동 읽음 (책갈피)
  };
  return (
    <div id={`lib-${item.source}-${item.id}`} className="border border-border/60 rounded-lg overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 py-2 px-2 text-left hover:bg-primary/5"
      >
        <span className="text-primary/50 text-xs">{open ? '▾' : '▸'}</span>
        <span className="shrink-0 text-[10px] font-mono text-text-secondary w-20 truncate">{item.id}</span>
        <span className="flex-1 text-[13px] leading-snug font-medium">{item.title}</span>
        {read && <span className="shrink-0 text-[11px] text-green-600 dark:text-green-400">✓</span>}
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70">
          코드 {codeCount(item)}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs">
          {item.cwe && <div className="text-[11px] text-primary/60 pt-1">{item.cwe}</div>}
          <CodeSection item={item} accordion />
          <div className="flex gap-2 mt-2">
            {wkId && (
              <button
                onClick={() => onDrill(wkId)}
                className="flex-1 py-1.5 rounded-lg border border-primary/30 text-primary text-[11px] font-semibold hover:bg-primary/5 active:scale-[0.99] transition-all"
              >
                🎯 이 약점 코드식별 드릴 (전 문서 {weaknessCount.get(wkId)}문항) →
              </button>
            )}
            {read && (
              <button
                onClick={() => onRead(false)}
                className="shrink-0 px-2 py-1.5 rounded-lg border border-border text-[11px] text-text-secondary hover:bg-primary/5"
              >
                읽음 해제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 🎓 학습 모드 — 블라인드 취약/안전 판별 세션 (자료원 단위, 약점 그룹 순서 진행)
// 부모에서 key={source} 로 마운트 — 출처 전환 시 위치·판정 상태가 새로 초기화된다
function BlindSession({ source, onExit }) {
  const cards = cardsBySource.get(source) || [];
  const [idx, setIdx] = useState(() => {
    const pos = loadJson(POS_KEY, {})[source] || 0;
    return pos < cards.length ? pos : 0;
  });
  const [pick, setPick] = useState(null); // null | 'vuln' | 'safe'
  const [stats, setStats] = useState(loadStats);
  const [srsState, setSrsState] = useState('idle'); // idle | saving | done
  const [tocOpen, setTocOpen] = useState(false); // 약점 목차 시트
  const [openCats, setOpenCats] = useState(() => new Set()); // 목차 카테고리 아코디언
  const [judged, setJudged] = useState(() => loadJson(JUDGED_KEY, {})[source] || {}); // {cardId: correct}
  const resultRef = useRef(null);
  const initialIdxRef = useRef(null); // 이어하기 안내용 — 세션 진입 시점 위치
  if (initialIdxRef.current === null) initialIdxRef.current = idx;
  const card = cards[idx];

  // 위치 저장 (이어하기)
  useEffect(() => {
    const pos = loadJson(POS_KEY, {});
    pos[source] = idx;
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* 저장 실패해도 학습엔 지장 없음 */ }
  }, [source, idx]);

  // 판정 직후 정답 배너로 자동 스크롤 — 긴 코드에서 배너가 화면 밖에 생기는 문제 방지
  useEffect(() => {
    if (pick) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pick]);

  // 약점 목차 — 카테고리 → 약점(첫 카드 위치·장수·판별수). cards 는 약점 그룹 순서라 첫 등장 인덱스가 곧 점프 지점.
  const toc = useMemo(() => {
    const catMap = new Map();
    cards.forEach((c, i) => {
      if (!catMap.has(c.category)) catMap.set(c.category, new Map());
      const wkMap = catMap.get(c.category);
      if (!wkMap.has(c.weaknessId)) wkMap.set(c.weaknessId, { title: c.weaknessTitle, firstIdx: i, count: 0, ids: [] });
      const w = wkMap.get(c.weaknessId);
      w.count++; w.ids.push(c.id);
    });
    return [...catMap.entries()].map(([cat, wkMap]) => ({
      cat,
      total: [...wkMap.values()].reduce((a, w) => a + w.count, 0),
      weaknesses: [...wkMap.entries()].map(([id, w]) => ({ id, ...w })),
    }));
  }, [cards]);

  const openToc = () => {
    setOpenCats(new Set(card ? [card.category] : [])); // 현재 카드의 분류는 펼친 채로
    setTocOpen(true);
  };
  const jumpTo = (firstIdx) => {
    setPick(null); setSrsState('idle'); setIdx(firstIdx); setTocOpen(false);
    initialIdxRef.current = -1; // 점프했으면 이어하기 안내 숨김
  };

  if (!card) {
    return (
      <div className="rounded-xl bg-card-bg border border-border p-6 text-center space-y-3">
        <p className="text-sm">이 문서에는 블라인드 판별 카드가 없습니다.</p>
        <button onClick={onExit} className="text-xs text-primary underline">조회 모드로</button>
      </div>
    );
  }

  // 같은 약점 안에서의 위치 (3/8 표기)
  const sameWk = cards.filter((c) => c.weaknessId === card.weaknessId);
  const wkPos = sameWk.findIndex((c) => c.id === card.id) + 1;

  const judge = (p) => {
    if (pick) return; // 이미 판정
    setPick(p);
    const correct = (p === 'vuln') === !card.isSafe;
    const next = { date: today(), total: stats.total + 1, correct: stats.correct + (correct ? 1 : 0) };
    setStats(next);
    try { localStorage.setItem(STATS_KEY, JSON.stringify(next)); } catch { /* 통계는 부가정보 */ }
    // 카드별 판별 기록 — 목차의 약점별 진도 표시용
    const nextJudged = { ...judged, [card.id]: correct };
    setJudged(nextJudged);
    try {
      const all = loadJson(JUDGED_KEY, {});
      all[source] = nextJudged;
      localStorage.setItem(JUDGED_KEY, JSON.stringify(all));
    } catch { /* 진도는 부가정보 */ }
  };
  const goNext = () => { setPick(null); setSrsState('idle'); setIdx((i) => Math.min(i + 1, cards.length)); };
  const goPrev = () => { setPick(null); setSrsState('idle'); setIdx((i) => Math.max(i - 1, 0)); };
  const addSrs = async () => {
    if (srsState !== 'idle') return;
    setSrsState('saving');
    try {
      await apiPost('/api/kisa-library?action=srs-add', { chapter_code: card.id });
      setSrsState('done');
    } catch {
      setSrsState('idle');
    }
  };

  const correct = pick ? (pick === 'vuln') === !card.isSafe : null;
  const done = idx >= cards.length - 1 && pick;

  return (
    <div className="space-y-3">
      {/* 진행/약점 헤더 — 약점명 탭하면 목차 시트 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <div className="flex items-center justify-between text-[11px] text-text-secondary mb-1">
          <span>{idx + 1} / {cards.length}</span>
          <span>오늘 판별 {stats.total} · 정답률 {stats.total ? Math.round((stats.correct / stats.total) * 100) : 0}%</span>
        </div>
        <div className="h-1 rounded-full bg-border overflow-hidden mb-2">
          <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
        </div>
        <button onClick={openToc} className="w-full text-left group">
          <div className="text-sm font-bold flex items-center gap-1">
            <span className="flex-1">{card.weaknessTitle} <span className="text-[10px] font-normal text-text-secondary">({wkPos}/{sameWk.length})</span></span>
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary group-hover:bg-primary/5">☰ 목차</span>
          </div>
          <div className="text-[10px] text-text-secondary">{card.category}{card.cwe ? ` · ${card.cwe}` : ''} · {card.lang}</div>
        </button>
        {initialIdxRef.current > 0 && idx === initialIdxRef.current && !pick && (
          <div className="mt-2 flex items-center gap-2 text-[11px] rounded-lg bg-primary/5 border border-primary/20 px-2 py-1.5">
            <span className="flex-1 text-primary">▶ {idx + 1}번째 카드부터 이어서 진행합니다</span>
            <button
              onClick={() => { initialIdxRef.current = -1; setPick(null); setIdx(0); }}
              className="shrink-0 px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/5"
            >
              처음부터
            </button>
          </div>
        )}
      </div>

      {/* 코드 — 취약/안전 라벨 없이 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <SharedCodeBlock code={card.code} language={langToken(card.lang)} />
      </div>

      {/* 판정 전: 2버튼 / 판정 후: 정답·해설·다음 */}
      {!pick ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => judge('vuln')}
            className="py-3 rounded-xl border-2 border-red-400/60 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all"
          >
            ❌ 취약하다
          </button>
          <button
            onClick={() => judge('safe')}
            className="py-3 rounded-xl border-2 border-green-400/60 text-green-600 dark:text-green-400 font-bold text-sm hover:bg-green-50 dark:hover:bg-green-900/20 active:scale-[0.98] transition-all"
          >
            ✅ 안전하다
          </button>
        </div>
      ) : (
        <div ref={resultRef} className={`rounded-xl border p-3 space-y-2 ${correct
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}
        >
          <div className="text-sm font-bold">
            {correct ? '⭕ 정답!' : '❌ 오답'} — 이 코드는 <span className={card.isSafe ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{card.isSafe ? '안전한 코드' : '취약한 코드'}</span>입니다
          </div>
          {card.note && <p className="text-xs leading-relaxed whitespace-pre-line">💡 {card.note}</p>}
          <div className="flex gap-2 pt-1">
            {done ? (
              <button onClick={() => { setPick(null); setIdx(0); }} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold active:scale-[0.98]">
                🎉 이 문서 끝! 처음부터 다시
              </button>
            ) : (
              <button onClick={goNext} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold active:scale-[0.98]">
                다음 코드 ▶
              </button>
            )}
            {isLoggedIn() && (
              <button
                onClick={addSrs}
                disabled={srsState !== 'idle'}
                className="shrink-0 px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:bg-primary/5 disabled:opacity-60"
              >
                {srsState === 'done' ? '✓ 복습 등록됨' : srsState === 'saving' ? '등록 중…' : '🔁 헷갈림 — 복습에 추가'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 하단 내비 */}
      <div className="flex gap-2">
        <button onClick={goPrev} disabled={idx === 0} className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary disabled:opacity-40">◀ 이전</button>
        {!pick && (
          <button onClick={goNext} className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary">건너뛰기 ▶</button>
        )}
        <div className="flex-1" />
        <button onClick={onExit} className="px-3 py-2 rounded-lg border border-border text-xs text-text-secondary">📖 조회 모드로</button>
      </div>

      {/* 약점 목차 바텀시트 — 카테고리 아코디언 → 약점 점프 (장수·판별 진도 표시) */}
      {tocOpen && (
        <div className="fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTocOpen(false)} />
          <div className="relative w-full max-h-[70vh] bg-card-bg rounded-t-2xl flex flex-col shadow-2xl">
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
              <h3 className="font-bold text-sm flex-1">☰ 약점 목차 <span className="text-primary/50 font-normal">({cards.length}장)</span></h3>
              <button onClick={() => setTocOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/10" aria-label="닫기">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 safe-pb">
              {toc.map((g) => {
                const opened = openCats.has(g.cat);
                return (
                  <div key={g.cat} className="mb-1">
                    <button
                      onClick={() => setOpenCats((prev) => {
                        const next = new Set(prev);
                        next.has(g.cat) ? next.delete(g.cat) : next.add(g.cat);
                        return next;
                      })}
                      className="w-full flex items-center gap-2 py-1.5 px-1 text-left text-sm font-semibold hover:bg-primary/5 rounded"
                    >
                      <span className="text-primary/50">{opened ? '▾' : '▸'}</span>
                      <span>{CATEGORY_EMOJI[g.cat] || '📂'}</span>
                      <span className="flex-1">{g.cat}</span>
                      <span className="text-[11px] text-primary/40">{g.total}장</span>
                    </button>
                    {opened && (
                      <div className="ml-4">
                        {g.weaknesses.map((w) => {
                          const done = w.ids.filter((id) => id in judged).length;
                          const isCurrent = card && w.id === card.weaknessId;
                          return (
                            <button
                              key={w.id}
                              onClick={() => jumpTo(w.firstIdx)}
                              className={`w-full flex items-center gap-2 py-1.5 px-2 text-left text-xs rounded hover:bg-primary/5 ${isCurrent ? 'bg-primary/10 font-semibold' : ''}`}
                            >
                              <span className="flex-1 leading-snug">{w.title}</span>
                              <span className="shrink-0 text-[10px] text-text-secondary">
                                {done > 0 ? `${done}/${w.count} 판별` : `${w.count}장`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CodeLibrary() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('view'); // 'view' | 'study'(블라인드 판별)
  const [readSet, setReadSet] = useState(() => new Set());
  const [lastRead, setLastRead] = useState(null); // {source, item_id} — 이어보기
  const [jumpKey, setJumpKey] = useState(null);   // 이어보기 점프 대상 (source/item_id)
  const loggedIn = isLoggedIn();

  // 코드예시 보유 자료원만, 노출 순서 고정
  const codeSources = useMemo(
    () =>
      SOURCE_ORDER.map((id) => libData.sources.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ ...s, codeItems: s.items.filter(hasCode) }))
        .filter((s) => s.codeItems.length > 0),
    []
  );
  const [activeId, setActiveId] = useState(codeSources[0]?.id || '');
  const active = codeSources.find((s) => s.id === activeId) || codeSources[0];

  // 읽음 진도 로드 (로그인 시)
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    (async () => {
      try {
        const r = await apiGet('/api/kisa-library?action=read');
        if (!alive) return;
        setReadSet(new Set((r.items || []).map((x) => readKey(x.source, x.item_id))));
        setLastRead(r.last || null);
      } catch { /* 진도는 부가정보 — 실패해도 조회 가능 */ }
    })();
    return () => { alive = false; };
  }, [loggedIn]);

  // 읽음 표시/해제 — 화면 즉시 반영 후 서버 저장 (낙관적 갱신)
  const setRead = (item, read) => {
    if (!loggedIn) return;
    const k = readKey(item.source, item.id);
    setReadSet((prev) => {
      const next = new Set(prev);
      read ? next.add(k) : next.delete(k);
      return next;
    });
    if (read) setLastRead({ source: item.source, item_id: item.id });
    apiPost('/api/kisa-library?action=read', { source: item.source, item_id: item.id, read }).catch(() => {});
  };

  // 이어보기 — 마지막 읽은 항목의 자료원으로 전환 후 스크롤·펼침
  const resume = () => {
    if (!lastRead) return;
    setMode('view');
    setActiveId(lastRead.source);
    setJumpKey(readKey(lastRead.source, lastRead.item_id));
  };
  useEffect(() => {
    if (!jumpKey) return;
    const [src, ...rest] = jumpKey.split('/');
    const el = document.getElementById(`lib-${src}-${rest.join('/')}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setJumpKey(null), 800);
    return () => clearTimeout(t);
  }, [jumpKey, activeId]);

  const startDrill = (wkId) => navigate(`/kisa/drill?type=codeid&chapter_code=${wkId}`);

  // 검색 필터 적용 후, 정렬 순서(order)를 유지한 채 분류(g2)별로 연속 그룹핑
  const groups = useMemo(() => {
    if (!active) return [];
    const q = norm(query.trim());
    const items = q ? active.codeItems.filter((it) => matches(it, q)) : active.codeItems;
    // 표준 약점 그룹으로 묶는다 — 출처가 무엇이든 항상 CATEGORY_ORDER 순서로 노출.
    //   그룹 키는 약점 분류(g2 우선, 없으면 category). 그룹 내부는 원본 order 로 정렬.
    const map = new Map();
    for (const it of items) {
      const key = it.g2 || it.category || it.g1 || '기타';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()]
      .map(([key, arr]) => ({ key, items: arr.sort((a, b) => (a.order || 0) - (b.order || 0)) }))
      .sort((a, b) => catRank(a.key) - catRank(b.key));
  }, [active, query]);

  if (!active) {
    return <p className="text-sm text-text-secondary text-center py-10">코드예시 자료가 없습니다.</p>;
  }

  const meta = SOURCE_META[active.id] || { label: active.label, lang: '' };
  const totalExamples = active.codeItems.reduce((a, it) => a + codeCount(it), 0);
  const readCountOf = (s) => s.codeItems.filter((it) => readSet.has(readKey(it.source, it.id))).length;
  const lastReadItem = lastRead
    ? codeSources.find((s) => s.id === lastRead.source)?.codeItems.find((it) => it.id === lastRead.item_id)
    : null;

  return (
    <div className="space-y-3">
      {/* 헤더 + 모드 토글 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">💾</span>
          <h2 className="text-base font-bold text-primary flex-1">예시코드 라이브러리</h2>
          <div className="flex rounded-lg border border-primary/30 overflow-hidden text-[11px] font-bold">
            <button
              onClick={() => setMode('view')}
              className={`px-2.5 py-1.5 ${mode === 'view' ? 'bg-primary text-white' : 'text-primary'}`}
            >
              📖 조회
            </button>
            <button
              onClick={() => setMode('study')}
              className={`px-2.5 py-1.5 ${mode === 'study' ? 'bg-primary text-white' : 'text-primary'}`}
            >
              🎓 학습
            </button>
          </div>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          {mode === 'view'
            ? `공식 문서 ${codeSources.length}종의 보안약점별 취약(❌)/안전(✅) 예시 코드를 원문 그대로 조회합니다. 항목을 펼치면 읽음으로 기록돼요.`
            : '라벨을 가린 코드를 보고 취약한지 안전한지 판별하는 훈련입니다. 진단 실기의 기본기 — 판정 후 해설을 확인하세요.'}
        </p>
        {mode === 'view' && lastReadItem && (
          <button
            onClick={resume}
            className="mt-2 w-full text-left text-[11px] px-2.5 py-2 rounded-lg bg-card-bg border border-primary/30 text-primary hover:bg-primary/5"
          >
            ▶ 이어보기: {SOURCE_META[lastRead.source]?.short || lastRead.source} · {lastReadItem.title}
          </button>
        )}
      </div>

      {/* 자료원(문서) 선택 칩 — 조회: 약점 읽기 진도 / 학습: 블라인드 카드 수 */}
      <div className="flex flex-wrap gap-1.5">
        {codeSources.map((s) => {
          const m = SOURCE_META[s.id] || { short: s.label, cls: '' };
          const selected = s.id === active.id;
          const rc = loggedIn ? readCountOf(s) : null;
          const cardCount = (cardsBySource.get(s.id) || []).length;
          const label = mode === 'study'
            ? `카드 ${cardCount}`
            : rc !== null ? `${rc}/${s.codeItems.length}` : s.codeItems.length;
          return (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border font-bold transition-all ${
                selected ? 'bg-primary text-white border-primary' : `${m.cls} hover:opacity-80`
              }`}
            >
              {m.short} ({label})
            </button>
          );
        })}
      </div>

      {mode === 'study' ? (
        // key=출처 — 칩 전환 시 세션(위치·판정 상태)을 그 출처 기준으로 새로 마운트
        <BlindSession key={active.id} source={active.id} onExit={() => setMode('view')} />
      ) : (
        <>
          {/* 선택 문서 정보 + 진도 + 검색 */}
          <div className="rounded-xl bg-card-bg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold">{meta.label}</span>
              {meta.lang && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/70">{meta.lang}</span>
              )}
              <span className="text-[10px] text-text-secondary">
                약점 {active.codeItems.length}개 · 코드 {totalExamples}개
              </span>
            </div>
            {loggedIn && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${active.codeItems.length ? (readCountOf(active) / active.codeItems.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-secondary shrink-0">읽음 {readCountOf(active)}/{active.codeItems.length}</span>
              </div>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="약점명·코드 내용·언어 검색…"
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-border bg-bg focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* 분류(그룹)별 약점 목록 — 표준 그룹 순서(order 정렬 유지) */}
          {groups.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-10">검색 결과가 없습니다.</p>
          ) : (
            groups.map((g, gi) => (
              <div key={g.key + gi} className="rounded-xl bg-card-bg border border-border p-3">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
                  <span>{CATEGORY_EMOJI[g.key] || '📂'}</span>
                  <span>{g.key}</span>
                  <span className="text-[10px] text-text-secondary">({g.items.length})</span>
                </h3>
                <div className="space-y-1.5">
                  {g.items.map((it) => {
                    const k = readKey(it.source, it.id);
                    return (
                      <WeaknessRow
                        key={k + (jumpKey === k ? '-jump' : '')}
                        item={it}
                        read={readSet.has(k)}
                        onRead={(v) => setRead(it, v)}
                        onDrill={startDrill}
                        initialOpen={jumpKey === k}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      <button
        onClick={() => navigate('/kisa')}
        className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary"
      >
        ← 대시보드로
      </button>
    </div>
  );
}
