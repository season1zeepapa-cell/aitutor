// STEP 5 smoke 테스트 — kisa_questions에서 실제 문항 1개를 가져와서
// 서버 로직(scorer + attempt INSERT + SRS 큐 UPSERT)을 DB 직접 호출로 검증한다.
const { Pool } = require('pg');
const { scoreAttempt } = require('../api/_kisa/scorer');
const { applySrs } = require('../api/_kisa/srs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});
const q = (text, params) => pool.query(text, params);

async function main() {
  // 1) 관리자 userId
  const admin = await q('SELECT id FROM public.users WHERE is_admin = true LIMIT 1');
  const userId = admin.rows[0].id;

  // 2) 대표 문항 (CWE-89 SQL 삽입) 조회
  const qRes = await q("SELECT * FROM kisa_questions WHERE weakness_code = 'CWE-89'");
  const question = qRes.rows[0];
  console.log('📋 테스트 문항:', question.weakness_name_ko);
  console.log('   vulnerable_lines:', question.vulnerable_lines);
  console.log('   rationale_keywords:', question.rationale_keywords);
  console.log('   fix_keywords:', question.fix_keywords);
  console.log('');

  // 3) 만점 시나리오 (모범답안 그대로 투입)
  const perfect = {
    verdict_yn: question.model_answer.verdict,
    cited_lines: question.vulnerable_lines,
    rationale_text: question.rationale_keywords.join(' '),
    fix_text: question.fix_keywords.join(' '),
    fix_code: '',
  };
  const perfectScore = scoreAttempt(question, perfect);
  console.log('🎯 만점 시나리오:', perfectScore.autoScore, '점');
  console.log('   breakdown:', JSON.stringify(perfectScore.breakdown));
  if (perfectScore.autoScore !== 100) {
    console.error('❌ 만점이 아니야! (수용기준 #4 위반)');
    process.exit(1);
  }
  console.log('✅ 만점 시나리오 통과');

  // 4) 0점 시나리오
  const zero = {
    verdict_yn: !question.model_answer.verdict,  // 반대
    cited_lines: [],
    rationale_text: '',
    fix_text: '',
    fix_code: '',
  };
  const zeroScore = scoreAttempt(question, zero);
  console.log('');
  console.log('🚫 0점 시나리오:', zeroScore.autoScore, '점');
  if (zeroScore.autoScore !== 0) {
    console.error('❌ 0점이 아니야! (수용기준 #5 위반)');
    process.exit(1);
  }
  console.log('✅ 0점 시나리오 통과');

  // 5) 실제 DB에 attempt INSERT (drill 모드 + self_grade='good')
  console.log('');
  console.log('💾 DB INSERT 테스트 (attempt + SRS 큐 UPSERT)...');
  const attemptRes = await q(`
    INSERT INTO kisa_diagnosis_attempts (
      user_id, question_id, mode,
      verdict_yn, cited_lines, rationale_text, fix_text, fix_code,
      auto_score, final_score, keyword_hits, self_grade, time_spent_sec
    ) VALUES ($1, $2, 'drill', $3, $4, $5, $6, $7, $8, $8, $9::jsonb, 'good', 120)
    RETURNING id, submitted_at
  `, [
    userId, question.id,
    perfect.verdict_yn, perfect.cited_lines, perfect.rationale_text, perfect.fix_text, perfect.fix_code,
    perfectScore.autoScore,
    JSON.stringify(perfectScore.keywordHits),
  ]);
  console.log('   attempt_id:', attemptRes.rows[0].id);
  console.log('   submitted_at:', attemptRes.rows[0].submitted_at);

  // 6) SRS 큐 UPSERT (good 1회차)
  const srs = applySrs({}, 'good');
  await q(`
    INSERT INTO kisa_review_queue (
      user_id, question_id, ease_factor, interval_days, repetitions,
      next_review_at, last_reviewed_at, suspended
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), FALSE)
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      ease_factor = EXCLUDED.ease_factor,
      interval_days = EXCLUDED.interval_days,
      repetitions = EXCLUDED.repetitions,
      next_review_at = EXCLUDED.next_review_at,
      last_reviewed_at = EXCLUDED.last_reviewed_at
  `, [
    userId, question.id,
    srs.easeFactor, srs.intervalDays, srs.repetitions,
    srs.nextReviewAt,
  ]);
  console.log('   SRS 갱신:', srs.intervalDays, '일 후 복습 예정');

  // 7) 확인
  const verify = await q(`
    SELECT a.id, a.auto_score, a.self_grade, r.interval_days, r.repetitions
    FROM kisa_diagnosis_attempts a
    LEFT JOIN kisa_review_queue r ON r.user_id = a.user_id AND r.question_id = a.question_id
    WHERE a.id = $1
  `, [attemptRes.rows[0].id]);
  console.log('');
  console.log('🔎 DB 검증:', JSON.stringify(verify.rows[0]));

  // 8) 정리 (테스트 데이터 삭제)
  await q('DELETE FROM kisa_diagnosis_attempts WHERE id = $1', [attemptRes.rows[0].id]);
  await q('DELETE FROM kisa_review_queue WHERE user_id = $1 AND question_id = $2', [userId, question.id]);
  console.log('🧹 테스트 데이터 정리 완료');

  await pool.end();
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎊 STEP 5 smoke 테스트 전부 통과');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('❌ ERROR:', err);
  pool.end();
  process.exit(1);
});
