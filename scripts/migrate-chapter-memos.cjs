// question_memos 확장 — 약점 항목별 메모(chapter_code) 지원
// 실행: node scripts/migrate-chapter-memos.cjs
// 변경:
//   1) chapter_code TEXT 컬럼 추가(약점 학습 화면의 메모 식별자, 예: "IMP-IV-01")
//   2) question_id 를 nullable 로 변경(약점 메모는 question_id 없음)
//   3) chapter_code 인덱스 추가
require('dotenv').config();
const { query } = require('../api/db');

(async () => {
  try {
    await query(`ALTER TABLE question_memos ADD COLUMN IF NOT EXISTS chapter_code TEXT`);
    console.log('✅ chapter_code 컬럼 추가');
    await query(`ALTER TABLE question_memos ALTER COLUMN question_id DROP NOT NULL`);
    console.log('✅ question_id NOT NULL 제거(nullable)');
    await query(`CREATE INDEX IF NOT EXISTS idx_question_memos_chapter ON question_memos(chapter_code)`);
    console.log('✅ chapter_code 인덱스 추가');

    // 검증
    const r = await query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
       WHERE table_name='question_memos' ORDER BY ordinal_position`,
    );
    console.log('\n현재 question_memos 컬럼:');
    r.rows.forEach((c) => console.log('  -', c.column_name, c.data_type, c.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'));
    console.log('\n마이그레이션 완료.');
  } catch (e) {
    console.error('❌ 마이그레이션 실패:', e.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
