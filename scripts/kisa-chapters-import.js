// KISA 학습 챕터 (kisa_chapters) 일괄 임포트 스크립트
//
// 사용법:
//   DATABASE_URL=... node scripts/kisa-chapters-import.js kisa-module/chapters/*.json
//
// chapter_code를 PK로 사용 UPSERT.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const q = (text, params) => pool.query(text, params);

async function upsertChapter(c) {
  await q(`
    INSERT INTO kisa_chapters (
      chapter_code, stage, category, title,
      definition, cause, impact, countermeasures,
      reference_docs, tags, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, TRUE
    )
    ON CONFLICT (chapter_code) DO UPDATE SET
      stage = EXCLUDED.stage,
      category = EXCLUDED.category,
      title = EXCLUDED.title,
      definition = EXCLUDED.definition,
      cause = EXCLUDED.cause,
      impact = EXCLUDED.impact,
      countermeasures = EXCLUDED.countermeasures,
      reference_docs = EXCLUDED.reference_docs,
      tags = EXCLUDED.tags
  `, [
    c.chapter_code,
    c.stage,
    c.category,
    c.title,
    c.definition,
    c.cause || null,
    c.impact || null,
    JSON.stringify(c.countermeasures || []),
    c.reference_docs || [],
    c.tags || [],
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('사용법: node scripts/kisa-chapters-import.js <JSON경로...>');
    process.exit(1);
  }

  let total = 0, inserted = 0, failed = 0;

  for (const file of args) {
    const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    console.log(`\n📦 ${abs}`);
    let data;
    try { data = JSON.parse(fs.readFileSync(abs, 'utf-8')); }
    catch (e) { console.error(`  ❌ 파일 로드 실패: ${e.message}`); failed++; continue; }

    const chapters = data.chapters || [];
    console.log(`   ${chapters.length} 챕터`);

    for (const c of chapters) {
      total++;
      try {
        await upsertChapter(c);
        inserted++;
        console.log(`  ✅ ${c.chapter_code.padEnd(12)} ${c.title}`);
      } catch (err) {
        failed++;
        console.error(`  ❌ ${c.chapter_code}: ${err.message}`);
      }
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 ${total} / 성공 ${inserted} / 실패 ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); pool.end(); process.exit(1); });
