// codeid 문항 전용 적재 (REBUILD69)
//   기존 kisa-seed-import.js 는 (weakness_code+language+difficulty) 기준 UPSERT 라
//   한 약점당 코드예시가 여럿인 codeid 를 덮어쓴다. 그래서 codeid 는 chapter_code(=CQ-XXXX)
//   기준으로 UPSERT 하는 전용 스크립트를 둔다. 재실행 안전(idempotent).
//
// 실행: DATABASE_URL=... node scripts/kisa-seed-codeid.mjs [seed경로]
//        (기본 kisa-module/seed/codeid/codeid.seed.json)

import { readFileSync } from 'fs';
import { join, dirname, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 필요'); process.exit(1); }

const arg = process.argv[2];
const seedPath = arg ? (isAbsolute(arg) ? arg : resolve(process.cwd(), arg))
                     : join(root, 'kisa-module/seed/codeid/codeid.seed.json');

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
const q = (t, p) => pool.query(t, p);

async function main() {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const rows = Array.isArray(seed.questions) ? seed.questions : [];
  console.log(`📦 ${seedPath} — ${rows.length}문항`);

  // dedup_key 컬럼 보장(멱등) — codeid 중복제거 토글(REBUILD76)용. 출처 무관 동일코드 판별.
  await q(`ALTER TABLE kisa_questions ADD COLUMN IF NOT EXISTS dedup_key TEXT`);
  await q(`CREATE INDEX IF NOT EXISTS idx_kisa_questions_dedup_key
           ON kisa_questions (dedup_key) WHERE question_type='codeid'`);

  const admin = await q('SELECT id FROM public.users WHERE is_admin = true ORDER BY id ASC LIMIT 1');
  const createdBy = admin.rows[0]?.id || null;

  let ins = 0, upd = 0, fail = 0;
  for (const r of rows) {
    try {
      const found = await q(
        `SELECT id FROM kisa_questions WHERE question_type = 'codeid' AND chapter_code = $1 LIMIT 1`,
        [r.chapter_code],
      );
      const vals = {
        weakness_category: r.weakness_category,
        weakness_code: r.weakness_code,
        weakness_name_ko: r.weakness_name_ko,
        language: r.language,
        code_language: r.code_language,
        difficulty: r.difficulty,
        stage: r.stage,
        body: r.body,
        vulnerable_code: r.vulnerable_code,
        choices: JSON.stringify(r.choices),
        answer_index: r.answer_index,
        model_answer: JSON.stringify(r.model_answer),
        explanation: r.explanation,
        tags: r.tags || [],
        dedup_key: r.dedup_key || null,
        is_active: r.is_active !== false,
      };
      if (found.rows[0]) {
        await q(
          `UPDATE kisa_questions SET
             weakness_category=$1, weakness_code=$2, weakness_name_ko=$3, language=$4, code_language=$5,
             difficulty=$6, stage=$7, body=$8, vulnerable_code=$9, choices=$10::jsonb, answer_index=$11,
             model_answer=$12::jsonb, explanation=$13, tags=$14, dedup_key=$15, is_active=$16, updated_at=NOW()
           WHERE id=$17`,
          [vals.weakness_category, vals.weakness_code, vals.weakness_name_ko, vals.language, vals.code_language,
           vals.difficulty, vals.stage, vals.body, vals.vulnerable_code, vals.choices, vals.answer_index,
           vals.model_answer, vals.explanation, vals.tags, vals.dedup_key, vals.is_active, found.rows[0].id],
        );
        upd++;
      } else {
        await q(
          `INSERT INTO kisa_questions
             (question_type, weakness_category, weakness_code, weakness_name_ko, chapter_code,
              language, code_language, difficulty, stage, body, vulnerable_code,
              choices, answer_index, model_answer, explanation, tags, dedup_key, is_active, created_by)
           VALUES ('codeid',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14,$15,$16,$17,$18)`,
          [vals.weakness_category, vals.weakness_code, vals.weakness_name_ko, r.chapter_code,
           vals.language, vals.code_language, vals.difficulty, vals.stage, vals.body, vals.vulnerable_code,
           vals.choices, vals.answer_index, vals.model_answer, vals.explanation, vals.tags, vals.dedup_key, vals.is_active, createdBy],
        );
        ins++;
      }
    } catch (e) {
      fail++;
      if (fail <= 5) console.error(`  ❌ ${r.chapter_code}: ${e.message}`);
    }
  }
  console.log(`✅ 삽입 ${ins} · 갱신 ${upd} · 실패 ${fail}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
