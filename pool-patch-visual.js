// pool-patch-visual.js — 기존 문제 중 표/그림 누락 문제를 식별하고 재처리
// 기존 DB 데이터에서 <표>, <그림> 마커 또는 시각 자료 키워드가 있는 문제를 찾아
// Gemini에게 표 내용 재구성을 요청하여 body를 업데이트
//
// 사용법:
//   node pool-patch-visual.js --scan               ← 영향받는 문제 목록만 조회
//   node pool-patch-visual.js --patch              ← Gemini로 표 내용 재구성 후 DB 업데이트
//   node pool-patch-visual.js --patch --exam-id=136  ← 특정 시험만
//   node pool-patch-visual.js --patch --limit=10     ← 최대 N개만
//   node pool-patch-visual.js --dry-run --patch      ← 미리보기

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('./api/db');

const args = process.argv.slice(2);
const SCAN = args.includes('--scan');
const PATCH = args.includes('--patch');
const DRY_RUN = args.includes('--dry-run');
const getArg = (name) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};
const EXAM_ID = getArg('exam-id') ? parseInt(getArg('exam-id')) : null;
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : 0;

if (!SCAN && !PATCH) {
  console.error('pool-patch-visual: 기존 문제 표/그림 보완 도구\n');
  console.error('사용법:');
  console.error('  node pool-patch-visual.js --scan                 ← 영향받는 문제 조회');
  console.error('  node pool-patch-visual.js --patch                ← AI로 표 재구성 후 업데이트');
  console.error('  node pool-patch-visual.js --patch --exam-id=136  ← 특정 시험만');
  console.error('  node pool-patch-visual.js --patch --limit=10     ← 최대 10개');
  console.error('  node pool-patch-visual.js --dry-run --patch      ← 미리보기');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── 표/그림 마커가 있는 문제 검색 ──
async function findVisualQuestions() {
  let sql = `
    SELECT q.id, q.exam_id, q.question_number, q.original_number,
           q.body, q.choices, q.answer,
           e.title as exam_title, c.name as category_name
    FROM questions q
    LEFT JOIN exams e ON q.exam_id = e.id
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE (
      q.body LIKE '%<표>%'
      OR q.body LIKE '%<그림>%'
      OR q.body LIKE '%다음 표%'
      OR q.body LIKE '%아래 표%'
      OR q.body LIKE '%구성도%'
      OR q.body LIKE '%다이어그램%'
      OR q.body LIKE '%토폴로지%'
      OR q.body LIKE '%[표]%'
    )
  `;
  const params = [];

  if (EXAM_ID) {
    params.push(EXAM_ID);
    sql += ` AND q.exam_id = $${params.length}`;
  }

  sql += ' ORDER BY q.exam_id, q.question_number';

  if (LIMIT > 0) {
    params.push(LIMIT);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await query(sql, params);
  return result.rows;
}

// ── Gemini로 표 내용 재구성 ──
async function reconstructTable(q) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const choices = typeof q.choices === 'string' ? JSON.parse(q.choices) : (q.choices || []);
  const choiceText = choices.map((c, i) => {
    const text = typeof c === 'object' ? (c.text || c.label || '') : c;
    return `${i + 1}. ${text}`;
  }).join('\n');

  const prompt = `다음 시험 문제에 표가 포함되어야 하지만, 원본에서 텍스트 추출 시 표 데이터가 손실되었습니다.
문제의 맥락과 선택지를 분석하여, 원래 있어야 할 표의 내용을 추론하여 텍스트 형태로 재구성해주세요.

[문제]
${q.body}

[선택지]
${choiceText}

[정답] ${q.answer || '미정'}

[카테고리] ${q.category_name || ''} / ${q.exam_title || ''}

다음 JSON 형식으로만 답변하세요:
{
  "table_description": "표 내용을 텍스트로 정리 (행과 열을 | 구분자로 표현)",
  "reconstructed_body": "표 내용이 포함된 문제 본문 전체 (기존 body에 표 데이터 삽입)",
  "confidence": "high/medium/low (표 내용 재구성 확신도)",
  "note": "재구성 근거 또는 불확실한 부분 설명"
}`;

  const result = await model.generateContent([{ text: prompt }]);
  const responseText = result.response.text();

  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('JSON 추출 실패');

  return JSON.parse(jsonMatch[1]);
}

// ── 메인 ──
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`pool-patch-visual: 기존 문제 표/그림 보완`);
  console.log('='.repeat(60));

  // 영향받는 문제 검색
  const questions = await findVisualQuestions();

  if (questions.length === 0) {
    console.log('\n표/그림 마커가 있는 문제가 없습니다.');
    process.exit(0);
  }

  // 시험별 그룹핑
  const byExam = {};
  for (const q of questions) {
    const key = `${q.exam_id} (${q.exam_title})`;
    if (!byExam[key]) byExam[key] = [];
    byExam[key].push(q);
  }

  console.log(`\n영향받는 문제: ${questions.length}개`);
  console.log('─'.repeat(40));
  for (const [exam, qs] of Object.entries(byExam)) {
    console.log(`  시험 ${exam}: ${qs.length}개`);
    for (const q of qs) {
      console.log(`    #${q.original_number}: ${q.body.substring(0, 60)}...`);
    }
  }

  if (SCAN) {
    // 스캔 모드: 목록만 출력하고 종료
    console.log(`\n${'='.repeat(60)}`);
    console.log(`스캔 완료 — 총 ${questions.length}개 문제에 표/그림 보완 필요`);
    console.log('패치를 실행하려면: node pool-patch-visual.js --patch');
    console.log('='.repeat(60));
    process.exit(0);
  }

  // PATCH 모드: Gemini로 표 내용 재구성
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`패치 모드${DRY_RUN ? ' (DRY-RUN)' : ''}: Gemini로 표 재구성 시작`);
  console.log('─'.repeat(40));

  let patched = 0, failed = 0, skipped = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `[${i + 1}/${questions.length}] 시험${q.exam_id} #${q.original_number}`;

    try {
      console.log(`\n${label} 표 재구성 중...`);

      const result = await reconstructTable(q);

      if (result.confidence === 'low') {
        console.log(`   [건너뜀] 확신도 낮음 — ${result.note}`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`   [미리보기] 확신도: ${result.confidence}`);
        console.log(`   표: ${(result.table_description || '').substring(0, 100)}...`);
        console.log(`   본문: ${(result.reconstructed_body || '').substring(0, 100)}...`);
        if (result.note) console.log(`   비고: ${result.note}`);
        patched++;
      } else {
        // DB 업데이트 — body에 재구성된 표 데이터 추가
        const newBody = result.reconstructed_body || q.body;
        await query(
          'UPDATE questions SET body = $1, updated_at = NOW() WHERE id = $2',
          [newBody, q.id]
        );
        console.log(`   [업데이트] 확신도=${result.confidence}, body ${q.body.length}→${newBody.length}자`);
        patched++;
      }

      // API 속도 제한
      if (i < questions.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }

    } catch (err) {
      console.error(`   [오류] ${label}: ${err.message}`);
      failed++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`패치 완료`);
  console.log(`  성공: ${patched}개`);
  console.log(`  건너뜀(확신도 낮음): ${skipped}개`);
  console.log(`  실패: ${failed}개`);
  if (DRY_RUN) console.log('  (DRY-RUN 모드)');
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
