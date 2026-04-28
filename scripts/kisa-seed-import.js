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
  };
}

async function upsertQuestion(q, createdBy) {
  const n = normalizeQuestion(q);

  // UPSERT 키: weakness_code + language + difficulty 조합
  // (같은 약점이어도 언어·난이도 변종은 별도 문항으로 관리)
  if (n.weakness_code) {
    const existing = await query(
      'SELECT id FROM kisa_questions WHERE weakness_code = $1 AND language = $2 AND difficulty = $3 LIMIT 1',
      [n.weakness_code, n.language, n.difficulty]
    );
    if (existing.rows.length > 0) {
      await query(`
        UPDATE kisa_questions SET
          question_type = $1, weakness_category = $2, weakness_name_ko = $3,
          body = $4, vulnerable_code = $5, code_language = $6,
          choices = $7::jsonb, answer_index = $8,
          vulnerable_lines = $9, rationale_keywords = $10, fix_keywords = $11,
          safe_code = $12, model_answer = $13::jsonb, reference = $14, tags = $15,
          is_active = $16, stage = $17, chapter_code = $18
        WHERE id = $19
      `, [
        n.question_type, n.weakness_category, n.weakness_name_ko,
        n.body, n.vulnerable_code, n.code_language,
        n.choices, n.answer_index,
        n.vulnerable_lines, n.rationale_keywords, n.fix_keywords,
        n.safe_code, n.model_answer, n.reference, n.tags,
        n.is_active, n.stage, n.chapter_code,
        existing.rows[0].id,
      ]);
      return { id: existing.rows[0].id, action: 'updated' };
    }
  }

  const result = await query(`
    INSERT INTO kisa_questions (
      question_type, weakness_category, weakness_code, weakness_name_ko,
      language, difficulty,
      body, vulnerable_code, code_language,
      choices, answer_index,
      vulnerable_lines, rationale_keywords, fix_keywords,
      safe_code, model_answer, reference, tags,
      is_active, created_by, stage, chapter_code
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10::jsonb, $11, $12, $13, $14,
      $15, $16::jsonb, $17, $18, $19, $20, $21, $22
    )
    RETURNING id
  `, [
    n.question_type, n.weakness_category, n.weakness_code, n.weakness_name_ko,
    n.language, n.difficulty,
    n.body, n.vulnerable_code, n.code_language,
    n.choices, n.answer_index,
    n.vulnerable_lines, n.rationale_keywords, n.fix_keywords,
    n.safe_code, n.model_answer, n.reference, n.tags,
    n.is_active, createdBy, n.stage, n.chapter_code,
  ]);
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
