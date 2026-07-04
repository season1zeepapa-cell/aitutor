// 이수시험 신규 유형(objective·shortessay) 문항 적재 (REBUILD81)
//   chapter_code(OBJ-*/ESSAY-*) 기준 UPSERT. 재실행 안전(idempotent).
//   입력: kisa-module/seed/exam/exam.seed.json  { questions:[...] }
//
//   실행: DATABASE_URL=... node scripts/kisa-seed-exam.mjs [seed경로]
import { readFileSync } from 'fs';
import { join, dirname, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 필요'); process.exit(1); }
const arg = process.argv[2];
const seedPath = arg ? (isAbsolute(arg) ? arg : resolve(process.cwd(), arg))
                     : join(root, 'kisa-module/seed/exam/exam.seed.json');
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
const q = (t, p) => pool.query(t, p);

async function main() {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const rows = Array.isArray(seed.questions) ? seed.questions : [];
  console.log(`📦 ${seedPath} — ${rows.length}문항`);

  const admin = await q('SELECT id FROM public.users WHERE is_admin = true ORDER BY id ASC LIMIT 1');
  const createdBy = admin.rows[0]?.id || null;

  let ins = 0, upd = 0, fail = 0;
  for (const r of rows) {
    try {
      const found = await q(
        `SELECT id FROM kisa_questions WHERE chapter_code = $1 AND question_type = $2 LIMIT 1`,
        [r.chapter_code, r.question_type],
      );
      // 공통 필드
      const vals = {
        question_type: r.question_type,
        weakness_category: r.weakness_category,
        weakness_code: r.weakness_code || null,
        weakness_name_ko: r.weakness_name_ko || null,
        language: r.code_language && ['java','python','javascript','kotlin','swift'].includes(r.code_language) ? r.code_language : 'etc',
        code_language: r.code_language || null,
        difficulty: r.difficulty || '중',
        stage: r.stage || 'implementation',
        body: r.body || '',
        vulnerable_code: r.vulnerable_code || null,
        choices: r.choices ? JSON.stringify(r.choices) : null,
        answer_index: typeof r.answer_index === 'number' ? r.answer_index : null,
        rubric: r.rubric ? JSON.stringify(r.rubric) : null,
        // report_template 은 jsonb 컬럼 — 문자열이면 {text} 로 감싸 유효 JSON 화
        report_template: r.report_template
          ? JSON.stringify(typeof r.report_template === 'string' ? { text: r.report_template } : r.report_template)
          : null,
        model_answer: r.model_answer ? JSON.stringify(typeof r.model_answer === 'string' ? { text: r.model_answer } : r.model_answer) : null,
        // shortessay 는 별도 explanation 이 없으면 모범답안을 해설로 노출(ResultOverlay 정답 해설 박스용)
        explanation: r.explanation
          || (r.question_type === 'shortessay' && r.model_answer
              ? '【모범답안】\n' + (typeof r.model_answer === 'string' ? r.model_answer : r.model_answer.text || '')
              : null),
        tags: Array.isArray(r.tags) && r.tags.length ? r.tags : [r.question_type],
      };
      if (found.rows[0]) {
        await q(
          `UPDATE kisa_questions SET
             weakness_category=$1, weakness_code=$2, weakness_name_ko=$3, language=$4, code_language=$5,
             difficulty=$6, stage=$7, body=$8, vulnerable_code=$9, choices=$10::jsonb, answer_index=$11,
             rubric=$12::jsonb, report_template=$13::jsonb, model_answer=$14::jsonb, explanation=$15, tags=$16,
             is_active=TRUE, updated_at=NOW()
           WHERE id=$17`,
          [vals.weakness_category, vals.weakness_code, vals.weakness_name_ko, vals.language, vals.code_language,
           vals.difficulty, vals.stage, vals.body, vals.vulnerable_code, vals.choices, vals.answer_index,
           vals.rubric, vals.report_template, vals.model_answer, vals.explanation, vals.tags, found.rows[0].id],
        );
        upd++;
      } else {
        await q(
          `INSERT INTO kisa_questions
             (question_type, weakness_category, weakness_code, weakness_name_ko, chapter_code,
              language, code_language, difficulty, stage, body, vulnerable_code,
              choices, answer_index, rubric, report_template, model_answer, explanation, tags, is_active, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,TRUE,$19)`,
          [vals.question_type, vals.weakness_category, vals.weakness_code, vals.weakness_name_ko, r.chapter_code,
           vals.language, vals.code_language, vals.difficulty, vals.stage, vals.body, vals.vulnerable_code,
           vals.choices, vals.answer_index, vals.rubric, vals.report_template, vals.model_answer, vals.explanation, vals.tags, createdBy],
        );
        ins++;
      }
    } catch (e) {
      fail++;
      if (fail <= 8) console.error(`  ❌ ${r.chapter_code}: ${e.message}`);
    }
  }
  console.log(`✅ 삽입 ${ins} · 갱신 ${upd} · 실패 ${fail}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
