// AWS Lambda Express 핸들러 - 문제 북마크 API
const { query } = require('./db');
const { withCors } = require('./middleware');

module.exports = withCors(async (req, res) => {
  const action = req.query?.action || req.body?.action;

  // ── 북마크 목록 조회 ──
  if (req.method === 'GET' && action === 'list') {
    const { tag } = req.query;
    let sql = 'SELECT id, question_id, tag, created_at FROM question_bookmarks';
    const params = [];
    if (tag) { sql += ' WHERE tag = $1'; params.push(tag); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return res.json({ bookmarks: result.rows });
  }

  // ── 특정 문제의 북마크 여부 확인 ──
  if (req.method === 'GET' && action === 'check') {
    const { question_id } = req.query;
    if (!question_id) return res.status(400).json({ error: 'question_id 필요' });
    const result = await query(
      'SELECT id, tag FROM question_bookmarks WHERE question_id = $1',
      [question_id]
    );
    return res.json({ bookmarked: result.rows.length > 0, tags: result.rows.map(r => r.tag) });
  }

  // ── 여러 문제의 북마크 상태 일괄 조회 ──
  if (req.method === 'GET' && action === 'bulk-check') {
    const { question_ids } = req.query;
    if (!question_ids) return res.json({ bookmarks: {} });
    const ids = question_ids.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.json({ bookmarks: {} });
    const result = await query(
      `SELECT question_id, array_agg(tag) as tags FROM question_bookmarks
       WHERE question_id = ANY($1) GROUP BY question_id`,
      [ids]
    );
    const map = {};
    result.rows.forEach(r => { map[r.question_id] = r.tags; });
    return res.json({ bookmarks: map });
  }

  // ── 북마크한 문제 목록 (문제 정보 포함) ──
  if (req.method === 'GET' && action === 'questions') {
    const { tag } = req.query;
    let sql = `
      SELECT q.id, q.exam_id, q.question_number, q.original_number, q.body, q.choices, q.answer, q.explanation, q.image_url,
             b.tag, b.created_at as bookmarked_at,
             e.title as exam_title, c.name as category_name
      FROM question_bookmarks b
      JOIN questions q ON b.question_id = q.id
      LEFT JOIN exams e ON q.exam_id = e.id
      LEFT JOIN categories c ON e.category_id = c.id
    `;
    const params = [];
    if (tag) { sql += ' WHERE b.tag = $1'; params.push(tag); }
    sql += ' ORDER BY b.created_at DESC';
    const result = await query(sql, params);
    return res.json({ questions: result.rows, total: result.rows.length });
  }

  // ── 태그 목록 + 개수 ──
  if (req.method === 'GET' && action === 'tags') {
    const result = await query(
      'SELECT tag, COUNT(*) as count FROM question_bookmarks GROUP BY tag ORDER BY count DESC'
    );
    return res.json({ tags: result.rows });
  }

  // ── POST 액션 ──
  if (req.method === 'POST') {
    const { question_id, tag = 'default' } = req.body;

    // 토글 (있으면 삭제, 없으면 추가)
    if (action === 'toggle') {
      if (!question_id) return res.status(400).json({ error: 'question_id 필요' });
      const existing = await query(
        'SELECT id FROM question_bookmarks WHERE question_id = $1 AND tag = $2',
        [question_id, tag]
      );
      if (existing.rows.length > 0) {
        await query('DELETE FROM question_bookmarks WHERE question_id = $1 AND tag = $2', [question_id, tag]);
        return res.json({ bookmarked: false, tag });
      } else {
        await query(
          'INSERT INTO question_bookmarks (question_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [question_id, tag]
        );
        return res.json({ bookmarked: true, tag });
      }
    }

    // 삭제
    if (action === 'delete') {
      if (!question_id) return res.status(400).json({ error: 'question_id 필요' });
      await query('DELETE FROM question_bookmarks WHERE question_id = $1', [question_id]);
      return res.json({ deleted: true });
    }

    // 태그 변경
    if (action === 'update-tag') {
      const { old_tag, new_tag } = req.body;
      if (!question_id) return res.status(400).json({ error: 'question_id 필요' });
      await query(
        'UPDATE question_bookmarks SET tag = $1 WHERE question_id = $2 AND tag = $3',
        [new_tag || 'default', question_id, old_tag || 'default']
      );
      return res.json({ updated: true });
    }
  }

  res.status(400).json({ error: '잘못된 요청입니다.' });
});
