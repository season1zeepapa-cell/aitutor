// 그림으로 약점 맞히기 — /kisa/diagram-quiz
// 취약점 개요 다이어그램(공격흐름도)을 보여주고, 어떤 보안약점인지 4지선다로 맞힌다.
//   - 약점 맞히기: JS 시큐어코딩 가이드(jssec2023) 자료원에서 image 가 있는 항목.
//   - 유형 맞히기: typeImages 가 있는 항목(예: XSS 의 Reflective/Persistent/DOM)에서 유형 그림 → 유형명.
//   - 오답 보기: 같은 자료원의 다른 약점/유형 제목에서 무작위.
//   - DB/API 무변경 — 번들(kisa-library.json) 직참조.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import libData from '../../data/kisa-library.json';
import { useImageModal } from '../../App'; // 이미지 탭하여 전체화면 확대(원본 줌)

// 배열을 무작위로 섞는다(Fisher–Yates).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 제목에서 영문 괄호 부분을 떼어 간결화 ("크로스사이트 스크립트(XSS)" → "크로스사이트 스크립트")
const shortTitle = (t) => String(t || '').replace(/\s*\(.*\)\s*$/, '').trim();

// 보기(4지선다) 구성: 정답 + 무작위 오답 3
function makeOptions(answer, pool) {
  const distractors = shuffle(pool.filter((t) => t !== answer)).slice(0, 3);
  return shuffle([answer, ...distractors]);
}

export default function DiagramQuiz() {
  const navigate = useNavigate();
  const openImage = useImageModal(); // 문제 다이어그램 확대용

  // 1) 문제 풀 준비 — 약점 맞히기 + 유형 맞히기
  const questions = useMemo(() => {
    const items = libData.sources.find((s) => s.id === 'jssec2023')?.items || [];
    const titlePool = [...new Set(items.map((it) => shortTitle(it.title)))];

    // (A) 약점 맞히기: image 가 있는 항목
    const measureOf = (it) => (it.detail || []).find((d) => d.label === '보안대책')?.text || '';
    const weaknessQs = items
      .filter((it) => it.image)
      .map((it) => {
        const answer = shortTitle(it.title);
        return {
          kind: 'weakness',
          id: it.id,
          image: it.image,
          answer,
          options: makeOptions(answer, titlePool),
          cwe: it.cwe || '',
          summary: it.summary || '',     // 개요(번들 직참조)
          measure: measureOf(it),         // 안전한 코딩기법
          prompt: '아래 공격 흐름도는 어떤 보안약점일까요?',
        };
      });

    // (B) 유형 맞히기: typeImages 가 있는 항목(예: XSS)
    const typePool = items.flatMap((it) => (it.typeImages || []).map((t) => t.type));
    const typeQs = items.flatMap((it) =>
      (it.typeImages || []).map((t) => ({
        kind: 'type',
        id: it.id,
        image: t.image,
        answer: t.type,
        options: makeOptions(t.type, [...new Set(typePool)]),
        desc: t.desc || '',
        parent: shortTitle(it.title),
        prompt: `아래 그림은 ${shortTitle(it.title)}의 어떤 유형일까요?`,
      })),
    );

    return shuffle([...weaknessQs, ...typeQs]);
  }, []);

  // 2) 진행 상태
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-300">
          ℹ️ 아직 등록된 개요 다이어그램이 없습니다. 약점 자료에 그림이 추가되면 자동으로 문제가 생성됩니다.
        </div>
        <button onClick={() => navigate('/kisa/study')} className="w-full py-2 rounded-lg border border-border text-sm text-text-secondary">
          ← 학습 목록으로
        </button>
      </div>
    );
  }

  const q = questions[idx];

  const handlePick = (opt) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.answer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (idx + 1 >= questions.length) setDone(true);
    else { setIdx((i) => i + 1); setPicked(null); }
  };

  if (done) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-primary-light border border-primary/20 p-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold text-primary mb-1">그림 퀴즈 완료!</h2>
          <p className="text-sm text-text-secondary">
            총 {questions.length}문제 중 <span className="font-bold text-primary">{score}문제</span> 정답
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setIdx(0); setPicked(null); setScore(0); setDone(false); }}
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

  return (
    <div className="space-y-3">
      {/* 헤더 + 진행도 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🖼️</span>
          <h2 className="text-base font-bold text-primary">그림으로 약점 맞히기</h2>
          <span className="ml-auto text-xs font-mono text-text-secondary">{idx + 1} / {questions.length}</span>
        </div>
        <p className="text-xs text-text-secondary">{q.prompt}</p>
      </div>

      {/* 문제: 다이어그램 이미지 (탭하면 전체화면 확대 — 모바일 좁은 폭 대응) */}
      <div className="rounded-xl bg-card-bg border border-border p-3">
        <div className="relative cursor-pointer" onClick={() => openImage(q.image)} title="탭하여 크게 보기">
          <img
            src={q.image}
            alt="보안약점 공격 흐름도"
            className="w-full rounded-lg border border-border bg-white"
            loading="lazy"
          />
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium pointer-events-none">
            🔍 탭하여 크게
          </span>
        </div>
      </div>

      {/* 보기 4지선다 */}
      <div className="space-y-2">
        {q.options.map((opt) => {
          let cls = 'border-border bg-card-bg hover:bg-primary-light';
          if (picked) {
            if (opt === q.answer) cls = 'border-green-400 bg-green-50 dark:bg-green-900/20';
            else if (opt === picked) cls = 'border-red-400 bg-red-50 dark:bg-red-900/20';
            else cls = 'border-border bg-card-bg opacity-60';
          }
          return (
            <button
              key={opt}
              onClick={() => handlePick(opt)}
              disabled={!!picked}
              className={`w-full text-left px-3 py-3 rounded-xl border text-sm font-medium transition-all active:scale-[0.99] ${cls}`}
            >
              {opt}
              {picked && opt === q.answer && <span className="ml-2 text-green-600 dark:text-green-400">✓ 정답</span>}
              {picked && opt === picked && opt !== q.answer && <span className="ml-2 text-red-600 dark:text-red-400">✗</span>}
            </button>
          );
        })}
      </div>

      {/* 채점 후: 해설 + 다음 버튼 */}
      {picked && (
        <div className="space-y-2">
          <div className={`rounded-xl border p-3 text-sm ${picked === q.answer ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}`}>
            <p className="font-bold mb-1">
              {picked === q.answer ? '✅ 정답입니다!' : `❌ 오답입니다. 정답은 "${q.answer}"`}
            </p>
            <p className="text-xs text-text-secondary">
              {q.kind === 'type'
                ? <>이 그림은 <span className="font-bold text-text">{q.parent}</span>의 <span className="font-bold text-text">{q.answer}</span> 유형입니다. {q.desc}</>
                : <>이 그림은 <span className="font-bold text-text">{q.answer}</span>{q.cwe ? ` (${q.cwe})` : ''} 의 공격 흐름도입니다.</>}
            </p>
            {/* 약점 문제: 개요 + 안전한 코딩기법을 번들에서 직접 노출(학습 활용) */}
            {q.kind === 'weakness' && (q.summary || q.measure) && (
              <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5">
                {q.summary && (
                  <p className="text-[11px] leading-relaxed text-text-secondary">
                    <span className="font-bold text-text">개요 </span>{q.summary}
                  </p>
                )}
                {q.measure && (
                  <p className="text-[11px] leading-relaxed text-text-secondary">
                    <span className="font-bold text-green-700 dark:text-green-400">안전한 코딩기법 </span>{q.measure}
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {idx + 1 >= questions.length ? '결과 보기 →' : '다음 문제 →'}
          </button>
        </div>
      )}
    </div>
  );
}
