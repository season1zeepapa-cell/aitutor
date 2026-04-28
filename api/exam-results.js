// AWS Lambda Express 핸들러 - 모의고사 결과 API
const { query } = require('./db');
const { withCors } = require('./middleware');

module.exports = withCors(async (req, res) => {
  const action = req.query?.action || req.body?.action;

  // ── 결과 저장 ──
  if (req.method === 'POST' && action === 'save') {
    const { exam_id, category_id, total_questions, correct_count, wrong_count, score, time_spent, time_limit, answers } = req.body;
    if (!total_questions) return res.status(400).json({ error: '데이터 부족' });
    const result = await query(
      `INSERT INTO exam_results (exam_id, category_id, total_questions, correct_count, wrong_count, score, time_spent, time_limit, answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`,
      [exam_id || null, category_id || null, total_questions, correct_count, wrong_count, score, time_spent || 0, time_limit || 0, JSON.stringify(answers || [])]
    );
    return res.json({ result: result.rows[0] });
  }

  // ── 이력 목록 ──
  if (req.method === 'GET' && action === 'list') {
    const result = await query(
      `SELECT r.*, e.title as exam_title, c.name as category_name
       FROM exam_results r
       LEFT JOIN exams e ON r.exam_id = e.id
       LEFT JOIN categories c ON r.category_id = c.id
       ORDER BY r.created_at DESC LIMIT 50`
    );
    return res.json({ results: result.rows });
  }

  // ── 랭킹 (최고점 기준) ──
  if (req.method === 'GET' && action === 'ranking') {
    const result = await query(
      `SELECT category_id, c.name as category_name,
              MAX(score) as best_score, COUNT(*) as attempts,
              ROUND(AVG(score),1) as avg_score
       FROM exam_results r
       LEFT JOIN categories c ON r.category_id = c.id
       GROUP BY category_id, c.name
       ORDER BY best_score DESC`
    );
    return res.json({ ranking: result.rows });
  }

  res.status(400).json({ error: '잘못된 요청' });
});
