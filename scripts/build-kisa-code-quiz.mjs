// KISA 코드식별 퀴즈 전수 생성 (REBUILD68)
//
// 무엇을: kisa-codebank.json(코드뱅크) → 코드식별 퀴즈 문제 전수 생성.
//   각 코드 엔트리마다 문제 1개:
//     · 코드를 보여주고
//     · ① 49개 구현단계 약점 중 무엇인지(4지선다) ② 안전/취약 코드인지(2지)
//   해설은 라이브러리 내용(약점 개요·보안대책) + 코드별 note + 안전/취약 근거를 "조합"해 생성.
//
// 실행: node scripts/build-kisa-code-quiz.mjs  (build-kisa-codebank.mjs 이후)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bankFile = join(root, 'src/data/kisa-codebank.json');
const outDir = join(root, 'src/data');
const outFile = join(outDir, 'kisa-code-quiz.json');

const bank = JSON.parse(readFileSync(bankFile, 'utf8'));
const weaknesses = bank.weaknesses;
const byId = new Map(weaknesses.map((w) => [w.id, w]));

const SOURCE_LABEL = {
  library: '진단가이드(2021)',
  kisec2026: 'KISEC 2026 기본과정',
  devsec2021: '개발보안 가이드(2021)',
  jssec2023: 'JS 시큐어코딩 가이드(2023)',
  pysec2023: 'Python 시큐어코딩 가이드(2023)',
};

// 결정적(seeded) 셔플용 해시 — Math.random 미사용(빌드 재현성 → git diff 안정).
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// seed 로 배열을 안정 정렬(각 원소에 해시 부여 후 정렬)
function seededOrder(arr, seed) {
  return arr
    .map((v) => ({ v, k: hash(seed + '::' + (v.id || v)) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

// ── 4지선다 약점 보기: 정답 + 같은분류 우선 오답 3개 ──
function buildOptions(correct, seed) {
  const sameCat = weaknesses.filter((w) => w.id !== correct.id && w.category === correct.category);
  const otherCat = weaknesses.filter((w) => w.id !== correct.id && w.category !== correct.category);
  const distractors = [...seededOrder(sameCat, seed + ':same'), ...seededOrder(otherCat, seed + ':other')].slice(0, 3);
  const opts = seededOrder([correct, ...distractors], seed + ':opts');
  return opts.map((w) => ({ id: w.id, title: w.title }));
}

// ── 해설 조합 (Claude 작성 템플릿 + 라이브러리 실내용) ──
function buildExplanation(item, w) {
  const verdictWord = item.isSafe ? '안전한 코드' : '취약한 코드';
  const reason = item.isSafe
    ? `입력값 검증·정제 또는 안전한 API·기법을 적용해 **${w.title}**을(를) 방어하고 있습니다. 아래 '보안 대책'에서 요구하는 방식이 코드에 반영돼 있는지 확인하세요.`
    : `외부 입력값을 검증·정제하지 않고 그대로 사용하거나 안전한 API·기법을 쓰지 않아 **${w.title}** 공격에 노출됩니다.`;

  const lines = [];
  lines.push(`**정답** — 이 코드는 **${verdictWord}**이며, 해당 보안약점은 **${w.title}** (\`${w.id}\`${w.cwe ? ' · ' + w.cwe : ''})입니다.`);
  lines.push('');
  lines.push('**판별 포인트**');
  lines.push(reason);
  if (item.note) lines.push(`- ${item.note}`);
  lines.push('');
  if (w.summary) { lines.push('**약점 개요**'); lines.push(w.summary); lines.push(''); }
  if (w.measure) { lines.push('**보안 대책**'); lines.push(w.measure); lines.push(''); }
  lines.push(`*(분류: ${w.category} · 출처: ${SOURCE_LABEL[item.source] || item.source})*`);
  return lines.join('\n');
}

const questions = [];
for (const item of bank.items) {
  const w = byId.get(item.weaknessId);
  if (!w) continue;
  questions.push({
    id: item.id,
    code: item.code,
    lang: item.lang,
    category: item.category,
    source: item.source,
    dedupKey: item.dedupKey, // 런타임 중복제거 토글용
    // 정답
    answerWeaknessId: item.weaknessId,
    answerIsSafe: item.isSafe,
    // 보기
    options: buildOptions(w, item.id),
    // 해설(조합 생성)
    explanation: buildExplanation(item, w),
  });
}

// 분류 균형 확인용 통계
const byCat = {};
for (const q of questions) byCat[q.category] = (byCat[q.category] || 0) + 1;

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = {
  weaknesses, // 49개 (필터·통계용)
  questions,
  meta: {
    total: questions.length,
    vulnerable: questions.filter((q) => !q.answerIsSafe).length,
    safe: questions.filter((q) => q.answerIsSafe).length,
    byCategory: byCat,
  },
};
writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
console.log(`[code-quiz] 전수 문제: ${questions.length}개 (취약 ${out.meta.vulnerable} / 안전 ${out.meta.safe})`);
console.log(`[code-quiz] 분류별:`, JSON.stringify(byCat));
console.log(`[code-quiz] → ${outFile}`);
