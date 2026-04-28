// KISA 모듈 — 관리자 CRUD + seed 일괄 임포트
// 기존 /api/admin.js와 동일한 패턴(withAdmin 래핑, pg Pool 재사용)
//
// 지원 액션 (query string ?action=...):
//   GET    ?action=list   — 문항 목록 (페이지네이션)
//   POST   ?action=upsert — 단일 문항 생성/수정
//   POST   ?action=seed   — seed.json 일괄 임포트 (UPSERT)
//   DELETE ?action=delete&id=<uuid> — 문항 삭제
//
// 기존 서비스와 완전히 독립적. 기존 API·테이블 무영향.
const { query } = require('./db');
const { withAdmin } = require('./middleware');

// kisa_questions 테이블 컬럼 목록 (UPSERT용)
const QUESTION_COLUMNS = [
  'id', 'question_type', 'weakness_category', 'weakness_code',
  'weakness_name_ko', 'language', 'difficulty',
  'body', 'vulnerable_code', 'code_language',
  'choices', 'answer_index',
  'vulnerable_lines', 'rationale_keywords', 'fix_keywords',
  'safe_code', 'model_answer', 'reference', 'tags', 'is_active',
];

// seed.json 한 문항을 DB row로 변환 (JSON/배열 필드 처리)
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
    // blank 전용
    blank_template: q.blank_template || null,
    blank_answers: q.blank_answers ? JSON.stringify(q.blank_answers) : null,
    reference: q.reference || null,
    tags: Array.isArray(q.tags) ? q.tags : [],
    is_active: q.is_active !== false,
  };
}

// 단일 문항 UPSERT (weakness_code 기준)
// weakness_code가 없으면 새 UUID로 INSERT, 있으면 해당 row update
async function upsertQuestion(q, createdBy) {
  const n = normalizeQuestion(q);
  if (n.weakness_code) {
    // weakness_code 기준 UPSERT (동일 약점 코드는 1행)
    const existing = await query(
      'SELECT id FROM kisa_questions WHERE weakness_code = $1 LIMIT 1',
      [n.weakness_code]
    );
    if (existing.rows.length > 0) {
      // UPDATE
      await query(`
        UPDATE kisa_questions SET
          question_type = $1, weakness_category = $2, weakness_name_ko = $3,
          language = $4, difficulty = $5,
          body = $6, vulnerable_code = $7, code_language = $8,
          choices = $9::jsonb, answer_index = $10,
          vulnerable_lines = $11, rationale_keywords = $12, fix_keywords = $13,
          safe_code = $14, model_answer = $15::jsonb,
          blank_template = $16, blank_answers = $17::jsonb,
          reference = $18, tags = $19,
          is_active = $20
        WHERE weakness_code = $21
      `, [
        n.question_type, n.weakness_category, n.weakness_name_ko,
        n.language, n.difficulty,
        n.body, n.vulnerable_code, n.code_language,
        n.choices, n.answer_index,
        n.vulnerable_lines, n.rationale_keywords, n.fix_keywords,
        n.safe_code, n.model_answer,
        n.blank_template, n.blank_answers,
        n.reference, n.tags,
        n.is_active, n.weakness_code,
      ]);
      return { id: existing.rows[0].id, action: 'updated' };
    }
  }
  // INSERT (신규)
  const result = await query(`
    INSERT INTO kisa_questions (
      question_type, weakness_category, weakness_code, weakness_name_ko,
      language, difficulty,
      body, vulnerable_code, code_language,
      choices, answer_index,
      vulnerable_lines, rationale_keywords, fix_keywords,
      safe_code, model_answer,
      blank_template, blank_answers,
      reference, tags,
      is_active, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10::jsonb, $11, $12, $13, $14,
      $15, $16::jsonb, $17, $18::jsonb, $19, $20, $21, $22
    )
    RETURNING id
  `, [
    n.question_type, n.weakness_category, n.weakness_code, n.weakness_name_ko,
    n.language, n.difficulty,
    n.body, n.vulnerable_code, n.code_language,
    n.choices, n.answer_index,
    n.vulnerable_lines, n.rationale_keywords, n.fix_keywords,
    n.safe_code, n.model_answer,
    n.blank_template, n.blank_answers,
    n.reference, n.tags,
    n.is_active, createdBy,
  ]);
  return { id: result.rows[0].id, action: 'inserted' };
}

module.exports = withAdmin(async (req, res) => {
  const action = req.query?.action || (new URL(req.url, 'http://x').searchParams.get('action'));

  // ------------------------------------------------------------------------
  // GET ?action=list — 문항 목록 (페이지네이션)
  // ------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'list') {
    const page = Math.max(1, parseInt(req.query?.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || '20')));
    const offset = (page - 1) * limit;

    const [count, rows] = await Promise.all([
      query('SELECT count(*)::int AS total FROM kisa_questions'),
      query(`
        SELECT id, question_type, weakness_category, weakness_code, weakness_name_ko,
               language, difficulty, is_active, created_at
        FROM kisa_questions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
    ]);

    return res.json({
      total: count.rows[0].total,
      page,
      limit,
      items: rows.rows,
    });
  }

  // ------------------------------------------------------------------------
  // POST ?action=upsert — 단일 문항 생성/수정
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'upsert') {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: '요청 본문이 필요합니다.' });
    }
    const result = await upsertQuestion(req.body, req.user.uid);
    return res.json(result);
  }

  // ------------------------------------------------------------------------
  // POST ?action=seed — seed.json 일괄 임포트 (UPSERT)
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'seed') {
    const seedData = req.body;
    if (!seedData || !Array.isArray(seedData.questions)) {
      return res.status(400).json({
        error: 'seed 데이터는 { questions: [...] } 형태여야 합니다.',
      });
    }

    let inserted = 0, updated = 0, failed = 0;
    const errors = [];

    for (const q of seedData.questions) {
      try {
        const r = await upsertQuestion(q, req.user.uid);
        if (r.action === 'inserted') inserted++;
        else updated++;
      } catch (err) {
        failed++;
        errors.push({ weakness_code: q.weakness_code, error: err.message });
        console.error('[KisaSeed] 문항 임포트 실패:', q.weakness_code, err.message);
      }
    }

    console.log(`[KisaSeed] 임포트 완료: inserted=${inserted}, updated=${updated}, failed=${failed}`);
    return res.json({
      total: seedData.questions.length,
      inserted,
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  // ------------------------------------------------------------------------
  // DELETE ?action=delete&id=<uuid> — 문항 삭제
  // ------------------------------------------------------------------------
  if (req.method === 'DELETE' && action === 'delete') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
    const result = await query('DELETE FROM kisa_questions WHERE id = $1', [id]);
    return res.json({ deleted: result.rowCount });
  }

  // 지원하지 않는 조합
  return res.status(400).json({
    error: `지원하지 않는 요청: ${req.method} ?action=${action}`,
  });
});
