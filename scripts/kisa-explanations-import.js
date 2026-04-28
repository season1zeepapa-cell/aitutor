// KISA 문항 기본 해설 UPSERT 스크립트
//
// 사용법:
//   DATABASE_URL=... node scripts/kisa-explanations-import.js kisa-module/explanations/*.json
//
// JSON 구조:
//   { "explanations": [
//     { "weakness_code": "DSG-IV-01-01", "explanation": "..." },
//     ...
//   ]}
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const q = (text, params) => pool.query(text, params);

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { console.log('사용법: node scripts/kisa-explanations-import.js <JSON경로...>'); process.exit(1); }

  let total = 0, updated = 0, notFound = 0;
  for (const file of args) {
    const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    console.log(`\n📦 ${path.basename(abs)}`);
    const data = JSON.parse(fs.readFileSync(abs, 'utf-8'));
    const list = data.explanations || [];
    for (const item of list) {
      total++;
      const res = await q(
        `UPDATE kisa_questions SET explanation = $1 WHERE weakness_code = $2`,
        [item.explanation, item.weakness_code]
      );
      if (res.rowCount > 0) {
        updated += res.rowCount;
        console.log(`  ✅ ${item.weakness_code.padEnd(20)} (${res.rowCount}건)`);
      } else {
        notFound++;
        console.warn(`  ⚠️  ${item.weakness_code} — 매칭 문항 없음`);
      }
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 요청: ${total}  UPDATE: ${updated}  매칭 실패: ${notFound}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  await pool.end();
}

main().catch(err => { console.error(err); pool.end(); process.exit(1); });
