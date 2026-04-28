#!/usr/bin/env node
/**
 * driver-module/scripts/05_wrap_laws.js
 *
 * 운전면허 해설(explanation) 의 법령명을 「법령명」 형태로 감싸기.
 * → LawLink 컴포넌트가 자동 인식해 클릭 → 법제처 이동 가능.
 *
 * 처리 방식:
 *   - JS regex lookbehind 로 이미 「」 안에 있는 법령명은 제외
 *   - 긴 패턴부터 처리 (substring 충돌 방지)
 *   - explanation + body 모두 처리
 *
 * 사용:
 *   node 05_wrap_laws.js --dry-run   # 미리보기 (DB 변경 없음)
 *   node 05_wrap_laws.js              # 실제 UPDATE
 */

const { Pool } = require('pg');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL 환경변수 필요');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

// 법령명 패턴 — 긴 것부터 정렬 (긴 것이 먼저 매칭되도록)
// lookbehind (?<!「) → 이미 「 로 시작한 곳은 매칭 안 함
// lookahead  (?!」)  → 이미 」 로 끝난 곳도 매칭 안 함
const LAW_PATTERNS = [
  '환경친화적 자동차의 개발 및 보급 촉진에 관한 법률?',
  '특정범죄 가중처벌 등에 관한 법률',
  '교통사고처리 특례법',
  '자동차손해배상 보장법',
  '도로교통법\\s*시행규칙',
  '도로교통법\\s*시행령',
  '자동차관리법',
  '건설기계관리법',
  '도로교통법',     // 짧으니 마지막 — 시행령/규칙 매칭 후 남은 단독 케이스
  '도로법',         // 도로교통법 보다 더 짧으나 도로교통법 매칭 후라 안전
];

/** 법령명 자동 「」 래핑 */
function wrapLawNames(text) {
  if (!text) return text;
  let result = text;
  for (const pattern of LAW_PATTERNS) {
    const re = new RegExp(`(?<!「)(${pattern})(?!」)`, 'g');
    result = result.replace(re, '「$1」');
  }
  return result;
}

(async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, question_number, body, explanation
       FROM questions
       WHERE exam_id = 161
       ORDER BY question_number`
    );
    console.log(`대상 ${r.rows.length}문항`);

    let bodyChanged = 0, explChanged = 0;
    const updates = [];

    for (const row of r.rows) {
      const newBody = wrapLawNames(row.body);
      const newExpl = wrapLawNames(row.explanation);

      const changed = (newBody !== row.body) || (newExpl !== row.explanation);
      if (!changed) continue;

      if (newBody !== row.body) bodyChanged++;
      if (newExpl !== row.explanation) explChanged++;

      updates.push({ id: row.id, no: row.question_number, body: newBody, expl: newExpl });
    }

    console.log(`변경 대상: body ${bodyChanged}건, explanation ${explChanged}건`);

    // 샘플 3건 미리보기
    console.log('\n=== 변환 샘플 (앞 3건) ===');
    updates.slice(0, 3).forEach(u => {
      const orig = r.rows.find(row => row.id === u.id);
      console.log(`#${u.no} explanation:`);
      console.log(`  before: ${orig.explanation.slice(0, 120)}...`);
      console.log(`  after : ${u.expl.slice(0, 120)}...`);
    });

    if (dryRun) {
      console.log('\n[dry-run] DB 변경 없음. --dry-run 해제하면 실제 UPDATE 실행.');
      return;
    }

    // 실제 UPDATE 트랜잭션
    console.log(`\n실제 UPDATE 시작...`);
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query(
        'UPDATE questions SET body = $2, explanation = $3, updated_at = NOW() WHERE id = $1',
        [u.id, u.body, u.expl]
      );
    }
    await client.query('COMMIT');
    console.log(`완료: ${updates.length}건 UPDATE`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('실패:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
