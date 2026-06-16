// KISA 시드를 kisa_questions 테이블에 일괄 임포트하는 스크립트
// (api/kisa-admin.js의 seed 액션과 동일한 로직을 DB 직접 호출로 수행)
//
// 사용법:
//   DATABASE_URL=... node scripts/kisa-seed-import.js                                # 기본 seed.json
//   DATABASE_URL=... node scripts/kisa-seed-import.js path/to/custom.json            # 단일 파일
//   DATABASE_URL=... node scripts/kisa-seed-import.js kisa-module/seed/design/*.json # 여러 파일 (shell glob)
//
// 특징:
//   - weakness_code 기준 UPSERT (재실행해도 중복 생성되지 않음)
//   - 실패한 문항은 건너뛰고 끝까지 진행, 마지막에 요약 출력
//   - stage + chapter_code 필드 지원 (schema v2)
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 필요합니다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// api/kisa-admin.js와 동일한 정규화 함수 (+ stage/chapter_code 추가)
function normalizeQuestion(q) {
  return {
    question_type: q.question_type,
    weakness_category: q.weakness_category,
    weakness_code: q.weakness_code || null,
    weakness_name_ko: q.weakness_name_ko,
    language: q.language,
    difficulty: q.difficulty,
    body: q.body,
    vulnerable_code: q.vulnerable_code || null,
    code_language: q.code_language || null,
    choices: q.choices ? JSON.stringify(q.choices) : null,
    answer_index: typeof q.answer_index === 'number' ? q.answer_index : null,
    vulnerable_lines: Array.isArray(q.vulnerable_lines) ? q.vulnerable_lines : null,
    rationale_keywords: Array.isArray(q.rationale_keywords) ? q.rationale_keywords : null,
    fix_keywords: Array.isArray(q.fix_keywords) ? q.fix_keywords : null,
    safe_code: q.safe_code || null,
    model_answer: q.model_answer ? JSON.stringify(q.model_answer) : null,
    reference: q.reference || null,
    tags: Array.isArray(q.tags) ? q.tags : [],
    is_active: q.is_active !== false,
    stage: q.stage || null,
    chapter_code: q.chapter_code || null,
    // REBUILD53 신규: 해설/선지별/blank/composite
    explanation: q.explanation || null,
    choice_explanations: q.choice_explanations ? JSON.stringify(q.choice_explanations) : null,
    blank_template: q.blank_template || null,
    blank_answers: q.blank_answers ? JSON.stringify(q.blank_answers) : null,
    artifacts: q.artifacts ? JSON.stringify(q.artifacts) : null,
    rubric: q.rubric ? JSON.stringify(q.rubric) : null,
    report_template: q.report_template ? JSON.stringify(q.report_template) : null,
  };
}

// UPSERT 컬럼 정의 (한 곳에서 관리 — 컬럼 추가 시 여기만 수정)
// weakness_code/created_by 는 INSERT 전용이라 별도 처리.
const UPSERT_COLS = [
  'question_type', 'weakness_category', 'weakness_name_ko', 'language', 'difficulty',
  'body', 'vulnerable_code', 'code_language', 'choices', 'answer_index',
  'vulnerable_lines', 'rationale_keywords', 'fix_keywords', 'safe_code', 'model_answer',
  'reference', 'tags', 'is_active', 'stage', 'chapter_code',
  'explanation', 'choice_explanations', 'blank_template', 'blank_answers',
  'artifacts', 'rubric', 'report_template',
];
const JSONB_COLS = new Set([
  'choices', 'model_answer', 'choice_explanations', 'blank_answers', 'artifacts', 'rubric', 'report_template',
]);
const cast = (c, i) => `$${i + 1}${JSONB_COLS.has(c) ? '::jsonb' : ''}`;

async function upsertQuestion(q, createdBy) {
  const n = normalizeQuestion(q);
  const vals = UPSERT_COLS.map((c) => n[c]);

  // UPSERT 키: weakness_code + language + difficulty (언어·난이도 변종은 별도 문항)
  if (n.weakness_code) {
    const existing = await query(
      'SELECT id FROM kisa_questions WHERE weakness_code = $1 AND language = $2 AND difficulty = $3 LIMIT 1',
      [n.weakness_code, n.language, n.difficulty]
    );
    if (existing.rows.length > 0) {
      const setClause = UPSERT_COLS.map((c, i) => `${c} = ${cast(c, i)}`).join(', ');
      await query(
        `UPDATE kisa_questions SET ${setClause} WHERE id = $${UPSERT_COLS.length + 1}`,
        [...vals, existing.rows[0].id]
      );
      return { id: existing.rows[0].id, action: 'updated' };
    }
  }

  const insCols = [...UPSERT_COLS, 'weakness_code', 'created_by'];
  const insVals = [...vals, n.weakness_code, createdBy];
  const placeholders = insCols.map((c, i) => cast(c, i)).join(', ');
  const result = await query(
    `INSERT INTO kisa_questions (${insCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    insVals
  );
  return { id: result.rows[0].id, action: 'inserted' };
}

async function main() {
  // CLI 인자 파싱: 파일 경로들 (없으면 기본 seed.json)
  const args = process.argv.slice(2);
  const seedPaths = args.length > 0
    ? args.map(p => path.isAbsolute(p) ? p : path.resolve(process.cwd(), p))
    : [path.join(__dirname, '..', 'kisa-module', 'seed.json')];

  // 관리자 ID 조회
  const adminRow = await query(
    'SELECT id FROM public.users WHERE is_admin = true ORDER BY id ASC LIMIT 1'
  );
  const adminId = adminRow.rows[0]?.id || null;
  console.log(`👤 created_by = ${adminId}`);
  console.log('');

  let totalInserted = 0, totalUpdated = 0, totalFailed = 0;
  const allErrors = [];

  for (const seedPath of seedPaths) {
    console.log(`📦 Loading: ${seedPath}`);
    let seedData;
    try {
      // require 캐시 우회하기 위해 readFileSync 사용
      const fs = require('fs');
      seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    } catch (err) {
      console.error(`  ❌ 파일 로드 실패: ${err.message}`);
      totalFailed++;
      continue;
    }
    if (!Array.isArray(seedData.questions)) {
      console.error(`  ❌ questions 배열이 없음`);
      totalFailed++;
      continue;
    }
    console.log(`   → ${seedData.questions.length}문항`);

    for (const q of seedData.questions) {
      try {
        const r = await upsertQuestion(q, adminId);
        if (r.action === 'inserted') totalInserted++;
        else totalUpdated++;
        const tag = q.chapter_code || q.weakness_code || '(no-code)';
        console.log(`  ${r.action === 'inserted' ? '✅' : '🔄'} ${r.action.padEnd(8)} ${tag.padEnd(12)} ${q.language.padEnd(10)} ${q.difficulty}  ${q.weakness_name_ko}`);
      } catch (err) {
        totalFailed++;
        const tag = q.chapter_code || q.weakness_code || '(no-code)';
        allErrors.push({ chapter_code: tag, language: q.language, error: err.message });
        console.error(`  ❌ FAILED  ${tag} ${q.language} ${q.difficulty} — ${err.message}`);
      }
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 전체 결과 요약 (${seedPaths.length} 파일)`);
  console.log(`  신규 INSERT: ${totalInserted}`);
  console.log(`  UPDATE: ${totalUpdated}`);
  console.log(`  실패: ${totalFailed}`);
  if (allErrors.length > 0) {
    console.log('');
    console.log('실패 목록:');
    allErrors.forEach(e => console.log(`  - ${e.chapter_code} ${e.language}: ${e.error}`));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');

  await pool.end();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
