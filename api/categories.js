// Vercel 서버리스 함수 - 카테고리 CRUD API
// 최상위 카테고리 관리 (영상정보관리사, 네트워크관리사 등)
const { query } = require('./db');
const { verifyToken, extractToken } = require('./auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: 카테고리 + 과목 목록 (공개) ──
    if (req.method === 'GET') {
      const result = await query(
        `SELECT c.id, c.name, c.sort_order, c.created_at,
                COUNT(DISTINCT e.id)::int AS exam_count
         FROM categories c
         LEFT JOIN exams e ON e.category_id = c.id
         GROUP BY c.id
         ORDER BY c.sort_order, c.name`
      );
      const subjects = await query(
        'SELECT id, name, sort_order, category_id FROM subjects ORDER BY category_id, sort_order, name'
      );
      return res.json({ categories: result.rows, subjects: subjects.rows });
    }

    // ── POST: 관리자 전용 CRUD ──
    if (req.method === 'POST') {
      const token = extractToken(req);
      const payload = verifyToken(token);
      if (!payload || !payload.admin) {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { action } = req.body || {};

      // 카테고리 생성
      if (action === 'create') {
        const { name, sort_order } = req.body;
        if (!name || !name.trim()) {
          return res.status(400).json({ error: '카테고리 이름을 입력해주세요.' });
        }
        const result = await query(
          'INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id, name, sort_order',
          [name.trim(), sort_order || 99]
        );
        console.log(`[Categories] 생성: ${result.rows[0].name} (id=${result.rows[0].id})`);
        return res.json({ success: true, category: result.rows[0] });
      }

      // 카테고리 수정
      if (action === 'update') {
        const { id, name, sort_order } = req.body;
        if (!id) return res.status(400).json({ error: 'id 필수' });
        if (!name || !name.trim()) return res.status(400).json({ error: '이름을 입력해주세요.' });
        const result = await query(
          'UPDATE categories SET name = $1, sort_order = $2 WHERE id = $3 RETURNING id, name, sort_order',
          [name.trim(), parseInt(sort_order) || 99, parseInt(id)]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
        console.log(`[Categories] 수정: ${result.rows[0].name}`);
        return res.json({ success: true, category: result.rows[0] });
      }

      // 카테고리 삭제
      if (action === 'delete') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'id 필수' });
        // 연결된 시험이 있으면 category_id를 NULL로 설정 (ON DELETE SET NULL)
        const result = await query(
          'DELETE FROM categories WHERE id = $1 RETURNING name',
          [parseInt(id)]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
        console.log(`[Categories] 삭제: ${result.rows[0].name}`);
        return res.json({ success: true });
      }

      // 시험에 카테고리 지정
      if (action === 'assignExam') {
        const { examId, categoryId } = req.body;
        if (!examId) return res.status(400).json({ error: 'examId 필수' });
        const catVal = categoryId ? parseInt(categoryId) : null;
        await query(
          'UPDATE exams SET category_id = $1 WHERE id = $2',
          [catVal, parseInt(examId)]
        );
        console.log(`[Categories] 시험 ${examId} → 카테고리 ${catVal}`);
        return res.json({ success: true });
      }

      // ── 과목 생성 ──
      if (action === 'createSubject') {
        const { name, category_id, sort_order } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: '과목 이름을 입력해주세요.' });
        if (!category_id) return res.status(400).json({ error: '카테고리를 선택해주세요.' });
        const result = await query(
          'INSERT INTO subjects (name, category_id, sort_order) VALUES ($1, $2, $3) RETURNING id, name, category_id, sort_order',
          [name.trim(), parseInt(category_id), parseInt(sort_order) || 99]
        );
        console.log(`[Categories] 과목 생성: ${result.rows[0].name} (cat=${category_id})`);
        return res.json({ success: true, subject: result.rows[0] });
      }

      // ── 과목 수정 ──
      if (action === 'updateSubject') {
        const { id, name, category_id, sort_order } = req.body;
        if (!id) return res.status(400).json({ error: 'id 필수' });
        if (!name || !name.trim()) return res.status(400).json({ error: '이름을 입력해주세요.' });
        const result = await query(
          'UPDATE subjects SET name = $1, category_id = $2, sort_order = $3 WHERE id = $4 RETURNING id, name, category_id, sort_order',
          [name.trim(), category_id ? parseInt(category_id) : null, parseInt(sort_order) || 99, parseInt(id)]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
        return res.json({ success: true, subject: result.rows[0] });
      }

      // ── 과목 삭제 ──
      if (action === 'deleteSubject') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'id 필수' });
        // 해당 과목이 할당된 문제의 subject_id를 NULL로 설정
        await query('UPDATE questions SET subject_id = NULL WHERE subject_id = $1', [parseInt(id)]);
        const result = await query('DELETE FROM subjects WHERE id = $1 RETURNING name', [parseInt(id)]);
        if (result.rows.length === 0) return res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
        console.log(`[Categories] 과목 삭제: ${result.rows[0].name}`);
        return res.json({ success: true });
      }

      return res.status(400).json({ error: '알 수 없는 action' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[Categories] 에러:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: '이미 존재하는 카테고리 이름입니다.' });
    }
    res.status(500).json({ error: '서버 오류', detail: err.message });
  }
};
