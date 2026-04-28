#!/usr/bin/env node
/**
 * driver-module/scripts/04_import.js
 *
 * raw-extracted.json → questions 테이블 INSERT
 *
 * 동작:
 *   1) data/raw-extracted.json 읽기
 *   2) 각 문항을 subject 분류 휴리스틱:
 *      - is_video         → '동영상 문제'
 *      - image_file 있음   → '표지·신호'
 *      - 그 외            → '교통법규' (대다수)
 *   3) 이미지 파일을 data/images/{원본} → public/q-images/driver/q{NNN}.jpg 로 복사
 *      (확장성: /q-images/driver/ 패턴, 향후 1종/이륜 등 동일 트리)
 *   4) 동영상 문항은 video_url 컬럼을 NULL 로 시작 (실제 파일 후속 라운드)
 *   5) questions 테이블 INSERT — 트랜잭션 안전
 *
 * 옵션:
 *   --limit N        N문항만 적재 (시범 적재용)
 *   --dry-run        DB 변경 없이 어떤 INSERT 가 될지 출력만
 *   --start FROM     N번 문항부터 (시범 후 이어서 적재 시)
 *
 * 사용:
 *   node 04_import.js --limit 50           # 시범 적재
 *   node 04_import.js --start 51           # 나머지 적재
 *   node 04_import.js --dry-run --limit 5  # 미리보기
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ─── 인자 파싱 ───
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
function getArg(name, def = null) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : def;
}
const limit = parseInt(getArg('--limit', '0'), 10) || null;
const startFrom = parseInt(getArg('--start', '0'), 10) || 0;

// ─── DB 연결 ───
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL && !dryRun) {
  console.error('DATABASE_URL 환경변수가 없습니다. .env 또는 export 필요.');
  process.exit(1);
}
const pool = dryRun ? null : new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

// ─── 메타 ID 캐시 (실제 DB 값과 동기화 — 등록 직후 확인됨) ───
const META = {
  exam_id:               161,   // '2종 자동 학과시험 (2026.3월 시행)'
  category_id:           4,     // '운전면허'
  subject_traffic_law:   4,     // '교통법규'
  subject_safe_driving:  5,     // '안전운전·차량관리'
  subject_sign:          6,     // '표지·신호'
  subject_video:         7,     // '동영상 문제'
};

// ─── 입력 ───
const RAW_JSON = path.join(__dirname, '../data/raw-extracted.json');
const SRC_IMAGES = path.join(__dirname, '../data/images');
const DEST_IMAGES = path.join(__dirname, '../../public/q-images/driver');

if (!fs.existsSync(DEST_IMAGES)) fs.mkdirSync(DEST_IMAGES, { recursive: true });

console.log(`[import] dry-run=${dryRun}, limit=${limit}, start=${startFrom}`);

const allQuestions = JSON.parse(fs.readFileSync(RAW_JSON, 'utf-8'));
let queue = allQuestions.filter(q => q.no >= startFrom);
if (limit) queue = queue.slice(0, limit);
console.log(`[import] 대상 문항: ${queue.length}개 (전체 ${allQuestions.length}개 중)`);

// ─── 헬퍼 ───
function pickSubject(q) {
  if (q.is_video) return META.subject_video;
  if (q.image_file) return META.subject_sign;
  return META.subject_traffic_law;
}

function imageUrlFor(q) {
  if (!q.image_file) return null;
  // 원본 파일은 jpg/png — 확장자 보존
  const ext = path.extname(q.image_file) || '.jpg';
  return `/q-images/driver/q${String(q.no).padStart(4, '0')}${ext}`;
}

function copyImage(q) {
  if (!q.image_file) return;
  const src = path.join(SRC_IMAGES, q.image_file);
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ #${q.no} 이미지 원본 없음: ${q.image_file}`);
    return;
  }
  const ext = path.extname(q.image_file) || '.jpg';
  const dest = path.join(DEST_IMAGES, `q${String(q.no).padStart(4, '0')}${ext}`);
  fs.copyFileSync(src, dest);
}

// ─── 적재 본 작업 ───
async function importOne(client, q) {
  // 데이터 검증 — 정답·보기·본문 누락 시 스킵 (수동 보정 대상)
  if (q.answer === null || !q.body || q.choices.length < 2) {
    console.warn(`  ⚠ #${q.no} 데이터 부족 — 스킵 (answer=${q.answer}, choices=${q.choices.length})`);
    return { skipped: true };
  }

  const subjectId = pickSubject(q);
  const imageUrl = imageUrlFor(q);

  // 이미지 복사 (dry-run 도 복사 — DB 영향 없음)
  copyImage(q);

  if (dryRun) {
    console.log(`  [dry] #${q.no} subject=${subjectId} img=${imageUrl} ans=${q.answer}/${q.answer_extra}`);
    return { ok: true };
  }

  const sql = `
    INSERT INTO questions
      (exam_id, subject_id, question_number, original_number,
       body, choices, answer, answer_extra, explanation,
       image_url, video_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (exam_id, question_number) DO NOTHING
    RETURNING id
  `;
  const params = [
    META.exam_id,
    subjectId,
    q.no,
    String(q.no),
    q.body.trim(),
    JSON.stringify(q.choices),
    q.answer,
    q.answer_extra,
    q.explanation?.trim() || null,
    imageUrl,
    null,                       // video_url 은 1차 NULL (후속 라운드)
  ];

  const r = await client.query(sql, params);
  return { ok: true, id: r.rows[0]?.id };
}

(async () => {
  let okCount = 0, skipCount = 0, errCount = 0;
  const client = dryRun ? null : await pool.connect();

  try {
    if (!dryRun) await client.query('BEGIN');

    for (const q of queue) {
      try {
        const res = await importOne(client, q);
        if (res.skipped) skipCount++;
        else if (res.ok) okCount++;
        if (okCount % 100 === 0 && okCount > 0) console.log(`  ... ${okCount} 적재됨`);
      } catch (err) {
        errCount++;
        console.error(`  ❌ #${q.no} 에러:`, err.message);
      }
    }

    if (!dryRun) await client.query('COMMIT');
  } catch (err) {
    if (!dryRun) await client.query('ROLLBACK').catch(() => {});
    console.error('적재 실패 — 롤백:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }

  console.log(`\n=== 적재 완료 ===`);
  console.log(`  성공:   ${okCount}`);
  console.log(`  스킵:   ${skipCount} (데이터 부족)`);
  console.log(`  에러:   ${errCount}`);
  console.log(`  이미지: ${fs.readdirSync(DEST_IMAGES).length}개 → ${DEST_IMAGES}`);
})();
