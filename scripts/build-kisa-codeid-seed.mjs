// codeid 시드 생성 (REBUILD69)
// src/data/kisa-code-quiz.json (303문항) → kisa_questions 시드 JSON.
//   각 문항을 codeid 정규 문항으로 변환 (기존 컬럼 재사용):
//     vulnerable_code=코드, choices=4약점보기, answer_index=정답약점, model_answer.is_safe=안전여부,
//     chapter_code=CQ-XXXX(고유 시드키), weakness_code=IMP-XX(이론/지식 연계), explanation=해설.
//
// 실행: node scripts/build-kisa-codeid-seed.mjs → kisa-module/seed/codeid/codeid.seed.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const quizFile = join(root, 'src/data/kisa-code-quiz.json');
const outDir = join(root, 'kisa-module/seed/codeid');
const outFile = join(outDir, 'codeid.seed.json');

// 한글 분류 → DB weakness_category enum (001 CHECK)
const CAT_ENUM = {
  '입력데이터 검증 및 표현': 'input_validation',
  '보안기능': 'security_feature',
  '시간 및 상태': 'time_state',
  '에러처리': 'error_handling',
  '코드오류': 'code_error',
  '캡슐화': 'encapsulation',
  'API오용': 'api_abuse',
  '세션통제': 'session_control',
};

// "Java (JDBC)" → CodeBlock 하이라이팅 토큰 (CodeQuiz.jsx langToken 과 동일 규칙)
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
// DB language 컬럼 enum (kisa_questions_language_check: java/python/javascript/kotlin/swift/etc)
// CodeBlock 토큰 → 허용 enum. 미허용(csharp/c/typescript)은 'etc'.
function enumLang(tok) {
  return ['java', 'python', 'javascript', 'kotlin', 'swift'].includes(tok) ? tok : 'etc';
}

// 마크다운 → 평문 (ResultOverlay 해설은 whitespace-pre-wrap 평문 렌더이므로 기호 제거)
function stripMd(md) {
  return String(md || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')   // 볼드
    .replace(/`([^`]+)`/g, '$1')        // 인라인 코드
    .replace(/^\s*##+\s*/gm, '')        // 헤더
    .replace(/^\s*-\s+/gm, '· ')        // 리스트 → 불릿
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const quiz = JSON.parse(readFileSync(quizFile, 'utf8'));
const questions = [];
let skipped = 0;

for (const q of quiz.questions || []) {
  const cat = CAT_ENUM[q.category];
  if (!cat) { skipped++; continue; } // 매핑 불가 분류는 제외(안전장치)
  const codeLang = langToken(q.lang);      // 하이라이팅용 정밀 토큰
  const dbLang = enumLang(codeLang);       // DB enum 컬럼용
  // choices: [{num, text, wid}] — num 1-base, wid=약점 코드(이론 연계)
  const choices = q.options.map((o, i) => ({ num: i + 1, text: o.title, wid: o.id }));
  const answer_index = q.options.findIndex((o) => o.id === q.answerWeaknessId);
  if (answer_index < 0) { skipped++; continue; }

  questions.push({
    question_type: 'codeid',
    weakness_category: cat,
    weakness_code: q.answerWeaknessId,          // IMP-XX (이론/지식 라이브러리 연계)
    weakness_name_ko: q.options.find((o) => o.id === q.answerWeaknessId)?.title || q.answerWeaknessId,
    chapter_code: q.id,                          // CQ-XXXX (고유 시드키)
    language: dbLang,                            // DB enum (java/python/javascript/kotlin/swift/etc)
    code_language: codeLang,                     // CodeBlock 하이라이팅 (csharp/c 등 정밀)
    difficulty: '중',
    stage: 'implementation',
    body: '다음 코드를 보고 ① 어떤 구현단계 보안약점인지(49개 중)와 ② 안전한 코드인지 취약한 코드인지 판단하세요.',
    vulnerable_code: q.code,
    choices,
    answer_index,
    model_answer: { is_safe: !!q.answerIsSafe, weakness_id: q.answerWeaknessId },
    explanation: stripMd(q.explanation),
    tags: ['codeid', q.source],
    dedup_key: q.dedupKey || null, // 출처 무관 동일코드 판별(중복제거 토글용)
    is_active: true,
  });
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify({ questions }, null, 2), 'utf8');
console.log(`[codeid-seed] ${questions.length}문항 생성 (제외 ${skipped}) → ${outFile}`);
