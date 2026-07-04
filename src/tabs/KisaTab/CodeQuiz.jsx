// 코드로 약점·안전여부 맞히기 — /kisa/code-quiz  (REBUILD68)
//
// 새 문제유형: 코드예시(취약/안전)를 보여주고,
//   ① 49개 구현단계 보안약점 중 무엇인지(4지선다)
//   ② 안전한 코드인지 취약한 코드인지(2지)
//   두 가지를 모두 맞히는 문제. 전수 생성된 kisa-code-quiz.json(303문항) 직참조.
//   해설은 빌드 시 조합 생성됨(약점 개요·보안대책 + 코드별 note). DB/API 무변경.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import quizData from '../../data/kisa-code-quiz.json';
import CodeBlock from '../../components/CodeBlock';
import MarkdownLite from '../../components/MarkdownLite';

// 배열 무작위 섞기(Fisher–Yates) — 런타임 출제 순서용.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "Java (JDBC)" 같은 lang 문자열 → CodeBlock 이 아는 언어 토큰. (javascript 를 java 보다 먼저 검사)
function langToken(lang) {
  const s = String(lang || '').toLowerCase();
  if (s.includes('javascript') || /\bjs\b/.test(s) || s.includes('node')) return 'javascript';
  if (s.includes('typescript') || /\bts\b/.test(s)) return 'typescript';
  if (s.includes('python')) return 'python';
  if (s.includes('c#') || s.includes('csharp') || s.includes('.net')) return 'csharp';
  if (s.includes('java')) return 'java';
  if (s.includes('c++') || /\bc\b/.test(s)) return 'c';
  return 'java';
}

const COUNT_OPTIONS = [10, 20, 50, 0]; // 0 = 전체

// 출처(자료원) 칩 라벨·순서 — CodeDrillHome 과 동일 체계 (REBUILD74/75)
const SOURCE_LABELS = {
  library: '진단가이드',
  kisec2026: '2026교재',
  jssec2023: 'JS가이드',
  devsec2021: '개발보안',
  pysec2023: 'Python가이드',
};
const SOURCE_ORDER = ['library', 'kisec2026', 'devsec2021', 'jssec2023', 'pysec2023'];

export default function CodeQuiz() {
  const navigate = useNavigate();

  // 전체 문제 + 분류 목록
  const allQuestions = quizData.questions || [];
  const categories = useMemo(
    () => [...new Set(allQuestions.map((q) => q.category))].filter(Boolean),
    [allQuestions],
  );
  // 출처 목록 (문항 보유분만, 표준 순서)
  const sourceList = useMemo(() => {
    const cnt = {};
    for (const q of allQuestions) cnt[q.source] = (cnt[q.source] || 0) + 1;
    return SOURCE_ORDER.filter((s) => cnt[s] > 0).map((s) => ({ id: s, n: cnt[s] }));
  }, [allQuestions]);

  // 단계: 설정 → 풀이 → 결과
  const [phase, setPhase] = useState('config');
  const [cat, setCat] = useState('전체');
  const [selSources, setSelSources] = useState([]); // 출처 다중선택 — 빈 배열 = 전체
  const [dedup, setDedup] = useState(false);        // 출처 간 동일코드 중복 제거
  const [count, setCount] = useState(20);
  const [quiz, setQuiz] = useState([]);

  const toggleSource = (src) =>
    setSelSources((prev) => (prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]));
  // 출처 + 분류 필터 + (옵션) 중복제거를 함께 적용한 출제 풀.
  //   dedup: dedupKey 별 대표 1개(먼저 오는 출처 = 배열 순서상 SOURCE_ORDER 우선)만 남김.
  const filterPool = () => {
    let pool = allQuestions.filter(
      (q) =>
        (selSources.length === 0 || selSources.includes(q.source)) &&
        (cat === '전체' || q.category === cat)
    );
    if (dedup) {
      const rank = (s) => { const i = SOURCE_ORDER.indexOf(s); return i < 0 ? 99 : i; };
      const best = new Map();
      for (const q of pool) {
        const k = q.dedupKey || q.id;
        const cur = best.get(k);
        if (!cur || rank(q.source) < rank(cur.source)) best.set(k, q);
      }
      pool = [...best.values()];
    }
    return pool;
  };

  // 풀이 상태
  const [idx, setIdx] = useState(0);
  const [pickW, setPickW] = useState(null);   // 선택한 약점 id
  const [pickS, setPickS] = useState(null);   // 선택한 안전여부(true=안전)
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);      // 두 정답 모두 맞힌 문제 수

  const startQuiz = () => {
    const pool = filterPool();
    const shuffled = shuffle(pool);
    const picked = count === 0 ? shuffled : shuffled.slice(0, count);
    setQuiz(picked);
    setIdx(0); setPickW(null); setPickS(null); setSubmitted(false); setScore(0);
    setPhase('quiz');
  };

  // ── 설정 화면 ──
  if (phase === 'config') {
    const poolCount = filterPool().length;
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💻</span>
            <h2 className="text-base font-bold text-primary">코드로 약점·안전여부 맞히기</h2>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            코드를 보고 ① <b>어떤 구현단계 보안약점</b>인지(49개 중), ② <b>안전한 코드인지 취약한 코드인지</b> 맞히는 퀴즈입니다.
            총 <b>{allQuestions.length}</b>문항 — 5개 문서 코드예시 전수(출처 간 중복 포함, 중복제거 토글 제공).
          </p>
        </div>

        {/* 출처(자료원) 다중선택 */}
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <p className="text-xs font-bold text-text mb-2">출처 <span className="font-normal text-text-secondary">(다중선택 가능)</span></p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelSources([])}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selSources.length === 0 ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text-secondary hover:bg-primary-light'
              }`}
            >
              전체
            </button>
            {sourceList.map((s) => {
              const on = selSources.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    on ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text-secondary hover:bg-primary-light'
                  }`}
                >
                  {on ? '✓ ' : ''}{SOURCE_LABELS[s.id] || s.id} {s.n}
                </button>
              );
            })}
          </div>
          {/* 중복 제거 토글 */}
          <label className="flex items-center gap-2 mt-2 pt-2 border-t border-border cursor-pointer">
            <input type="checkbox" checked={dedup} onChange={(e) => setDedup(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
            <span className="text-[11px] text-text-secondary flex-1">
              중복 코드 제거 <span className="text-text-secondary/70">— 여러 출처의 같은 예시코드를 1문항으로</span>
            </span>
          </label>
        </div>

        {/* 분류 선택 */}
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <p className="text-xs font-bold text-text mb-2">분류</p>
          <div className="flex flex-wrap gap-1.5">
            {['전체', ...categories].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  cat === c ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text-secondary hover:bg-primary-light'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 문항 수 */}
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <p className="text-xs font-bold text-text mb-2">문항 수 <span className="font-normal text-text-secondary">(현재 선택 {poolCount}문항)</span></p>
          <div className="flex gap-1.5">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  count === n ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text-secondary hover:bg-primary-light'
                }`}
              >
                {n === 0 ? '전체' : n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startQuiz}
          disabled={poolCount === 0}
          className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          퀴즈 시작 →
        </button>
        <button onClick={() => navigate('/kisa/study')} className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary">
          ← 학습 목록으로
        </button>
      </div>
    );
  }

  // ── 결과 화면 ──
  if (phase === 'done') {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-primary-light border border-primary/20 p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold text-primary mb-1">코드 퀴즈 완료!</h2>
          <p className="text-sm text-text-secondary">
            총 {quiz.length}문제 중 <span className="font-bold text-primary">{score}문제</span> 정답
            <span className="block text-xs mt-1">(약점·안전여부 둘 다 맞힌 경우만 정답 처리)</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPhase('config')}
            className="py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
          >
            🔄 다시 풀기
          </button>
          <button onClick={() => navigate('/kisa/study')} className="py-2.5 rounded-lg border border-border text-sm text-text-secondary">
            학습 목록으로
          </button>
        </div>
      </div>
    );
  }

  // ── 풀이 화면 ──
  const q = quiz[idx];
  if (!q) return null;

  const canSubmit = pickW !== null && pickS !== null && !submitted;
  const weaknessCorrect = pickW === q.answerWeaknessId;
  const safeCorrect = pickS === q.answerIsSafe;
  const bothCorrect = weaknessCorrect && safeCorrect;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    if (weaknessCorrect && safeCorrect) setScore((s) => s + 1);
  };
  const handleNext = () => {
    if (idx + 1 >= quiz.length) { setPhase('done'); return; }
    setIdx((i) => i + 1); setPickW(null); setPickS(null); setSubmitted(false);
  };

  // 안전/취약 버튼 색 클래스
  const safeBtnCls = (val) => {
    if (!submitted) return pickS === val ? 'border-primary bg-primary text-white' : 'border-border bg-card-bg text-text hover:bg-primary-light';
    if (val === q.answerIsSafe) return 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
    if (pickS === val) return 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
    return 'border-border bg-card-bg opacity-60 text-text-secondary';
  };

  return (
    <div className="space-y-3">
      {/* 헤더 + 진행도 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">💻</span>
          <h2 className="text-base font-bold text-primary">코드로 약점·안전여부 맞히기</h2>
          <span className="ml-auto text-xs font-mono text-text-secondary">{idx + 1} / {quiz.length}</span>
        </div>
        <p className="text-xs text-text-secondary">아래 코드를 보고 ① 보안약점과 ② 안전/취약 여부를 고르세요.</p>
      </div>

      {/* 코드 */}
      <div className="rounded-xl bg-card-bg border border-border p-2 overflow-x-auto">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[11px] font-mono text-text-secondary">{q.lang}</span>
        </div>
        <CodeBlock code={q.code} language={langToken(q.lang)} />
      </div>

      {/* ① 약점 4지선다 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <p className="text-xs font-bold text-text mb-2">① 어떤 보안약점일까요?</p>
        <div className="space-y-2">
          {q.options.map((opt) => {
            let cls = 'border-border bg-card-bg hover:bg-primary-light';
            if (!submitted && pickW === opt.id) cls = 'border-primary bg-primary text-white';
            if (submitted) {
              if (opt.id === q.answerWeaknessId) cls = 'border-green-400 bg-green-50 dark:bg-green-900/20';
              else if (opt.id === pickW) cls = 'border-red-400 bg-red-50 dark:bg-red-900/20';
              else cls = 'border-border bg-card-bg opacity-60';
            }
            return (
              <button
                key={opt.id}
                onClick={() => !submitted && setPickW(opt.id)}
                disabled={submitted}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.99] ${cls}`}
              >
                {opt.title}
                {submitted && opt.id === q.answerWeaknessId && <span className="ml-2 text-green-600 dark:text-green-400">✓ 정답</span>}
                {submitted && opt.id === pickW && opt.id !== q.answerWeaknessId && <span className="ml-2 text-red-600 dark:text-red-400">✗</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ② 안전/취약 */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <p className="text-xs font-bold text-text mb-2">② 이 코드는?</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => !submitted && setPickS(true)} disabled={submitted}
            className={`py-2.5 rounded-xl border text-sm font-bold transition-all active:scale-[0.99] ${safeBtnCls(true)}`}>
            ✅ 안전한 코드
            {submitted && q.answerIsSafe === true && <span className="ml-1">✓</span>}
          </button>
          <button onClick={() => !submitted && setPickS(false)} disabled={submitted}
            className={`py-2.5 rounded-xl border text-sm font-bold transition-all active:scale-[0.99] ${safeBtnCls(false)}`}>
            ⚠️ 취약한 코드
            {submitted && q.answerIsSafe === false && <span className="ml-1">✓</span>}
          </button>
        </div>
      </div>

      {/* 제출 버튼 */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {pickW === null || pickS === null ? '① 약점과 ② 안전여부를 모두 선택하세요' : '제출하고 채점 →'}
        </button>
      )}

      {/* 채점 후: 해설 + 다음 */}
      {submitted && (
        <div className="space-y-2">
          <div className={`rounded-xl border p-3 ${bothCorrect ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}`}>
            <p className="font-bold text-sm mb-1">
              {bothCorrect ? '✅ 둘 다 정답입니다!' : '❌ 아쉬워요'}
              <span className="ml-2 text-xs font-normal text-text-secondary">
                약점 {weaknessCorrect ? '✓' : '✗'} · 안전여부 {safeCorrect ? '✓' : '✗'}
              </span>
            </p>
            <div className="text-xs text-text leading-relaxed markdown-body">
              <MarkdownLite source={q.explanation} />
            </div>
            <button
              onClick={() => navigate(`/kisa/theory/${q.answerWeaknessId}`)}
              className="mt-2 w-full py-2 rounded-lg border border-primary/40 text-primary bg-card-bg hover:bg-primary/10 text-xs font-bold transition-colors"
            >
              📖 이 약점 이론 학습하기 (2026 교재) →
            </button>
          </div>
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {idx + 1 >= quiz.length ? '결과 보기 →' : '다음 문제 →'}
          </button>
        </div>
      )}
    </div>
  );
}
