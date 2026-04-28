// 해설이 없는 문제에 AI 해설을 일괄 생성하는 배치 스크립트
// pool-import.js로 문제 등록 후 2차 작업으로 실행
// 사용법:
//   node pool-explain.js --exam-id=4
//   node pool-explain.js --exam-id=4 --limit=10
//   node pool-explain.js --exam-id=4 --dry-run
//   node pool-explain.js --all              (해설 없는 전체 문제)
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('./api/db');

// ── CLI 인자 파싱 ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ALL = args.includes('--all');
const getArg = (name) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};

const EXAM_ID = getArg('exam-id') ? parseInt(getArg('exam-id')) : null;
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : 0;
const PROVIDER = getArg('provider') || 'gemini';

if (!EXAM_ID && !ALL) {
  console.error('사용법:');
  console.error('  node pool-explain.js --exam-id=4 [--limit=10] [--dry-run]');
  console.error('  node pool-explain.js --all [--limit=10] [--dry-run]');
  console.error('  node pool-explain.js --exam-id=4 --provider=gemini');
  process.exit(1);
}

// ── Gemini 클라이언트 ──
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const CIRCLE = ['①', '②', '③', '④', '⑤'];

// ── 해설 생성 ──
async function generateExplanation(q, categoryName) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const choices = typeof q.choices === 'string' ? JSON.parse(q.choices) : (q.choices || []);
  const choiceText = choices.map((c, i) => {
    const text = typeof c === 'object' ? (c.text || c.label || '') : c;
    return `${CIRCLE[i]} ${text}`;
  }).join('\n');

  const answerNum = parseInt(q.answer) || 0;
  const roleName = categoryName || '자격증 시험';

  const prompt = `당신은 ${roleName} 전문 강사입니다.
아래 문제의 해설을 작성해주세요.

[문제]
${q.body}

[선택지]
${choiceText}

[정답] ${answerNum > 0 ? CIRCLE[answerNum - 1] : '미정'}

다음 형식으로 답변하세요:
**정답**: 번호 및 선택지 내용
**해설**: 왜 이것이 정답인지 상세히 설명
**오답 분석**: 각 선택지가 왜 맞거나 틀린지 간결하게
**핵심 키워드**: 관련 법령, 용어, 개념`;

  const result = await model.generateContent([{ text: prompt }]);
  return result.response.text().trim();
}

// ── 메인 ──
async function main() {
  // 해설 없는 문제 조회
  let sql = `
    SELECT q.id, q.body, q.choices, q.answer, q.question_number, q.original_number,
           e.title as exam_title, c.name as category_name
    FROM questions q
    LEFT JOIN exams e ON q.exam_id = e.id
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE q.explanation IS NULL
  `;
  const params = [];

  if (EXAM_ID) {
    params.push(EXAM_ID);
    sql += ` AND q.exam_id = $${params.length}`;
  }

  sql += ' ORDER BY q.question_number';

  if (LIMIT > 0) {
    params.push(LIMIT);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await query(sql, params);
  const questions = result.rows;

  if (questions.length === 0) {
    console.log('해설이 필요한 문제가 없습니다.');
    process.exit(0);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`해설 생성 대상: ${questions.length}개 문제`);
  if (EXAM_ID) console.log(`시험 ID: ${EXAM_ID}`);
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (미리보기)' : '실제 저장'}`);
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `[${i + 1}/${questions.length}] #${q.original_number || q.question_number}`;

    try {
      console.log(`\n${label} 해설 생성 중...`);
      console.log(`   ${q.body.substring(0, 60)}...`);

      const explanation = await generateExplanation(q, q.category_name);

      if (DRY_RUN) {
        console.log(`   [미리보기] 해설 길이: ${explanation.length}자`);
        console.log(`   ${explanation.substring(0, 100)}...`);
      } else {
        // questions 테이블의 explanation 컬럼에 저장
        await query(
          'UPDATE questions SET explanation = $1, updated_at = NOW() WHERE id = $2',
          [explanation, q.id]
        );

        // question_explanations 테이블에도 저장 (AI 해설 관리용)
        await query(
          `INSERT INTO question_explanations (question_id, provider, model, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [q.id, PROVIDER, 'gemini-2.5-flash', explanation]
        );

        console.log(`   [저장 완료] ${explanation.length}자`);
      }

      success++;

      // API 속도 제한 방지: 1초 대기
      if (i < questions.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }

    } catch (err) {
      console.error(`   [오류] ${label}: ${err.message}`);
      failed++;
      // 오류 시 2초 대기 후 계속
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log(`해설 생성 완료`);
  console.log(`  성공: ${success}개`);
  console.log(`  실패: ${failed}개`);
  if (DRY_RUN) console.log('  (DRY-RUN 모드 — 실제 저장되지 않았습니다)');
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
