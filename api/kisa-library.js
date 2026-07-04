// 예시코드 라이브러리 학습 API (REBUILD86)
//
//   GET  /api/kisa-library?action=read
//        → 내 읽음 목록 + 최근 읽은 항목(이어보기용)
//        { items: [{source, item_id, read_at}], last: {source, item_id} | null }
//
//   POST /api/kisa-library?action=read
//        body: { source, item_id, read: true|false }
//        → 읽음 표시 upsert / 해제
//
//   POST /api/kisa-library?action=srs-add
//        body: { chapter_code: 'CQ-XXXX' }
//        → 블라인드 판별에서 "헷갈림" 코드의 codeid 문항을 복습 큐에 즉시 등록
//          (이미 큐에 있으면 오늘 복습으로 당기고 suspended 해제)
const { query } = require('./db');
const { withAuth } = require('./middleware');

// kisa-library.json sources 와 동일 체계 (코드예시 보유 자료원)
const SOURCES = ['library', 'kisec2026', 'jssec2023', 'devsec2021', 'pysec2023'];

module.exports = withAuth(async (req, res) => {
  const userId = req.user?.uid;
  const action = req.query?.action;

  if (req.method === 'GET' && action === 'read') {
    const r = await query(
      `SELECT source, item_id, read_at FROM kisa_library_read
       WHERE user_id = $1 ORDER BY read_at DESC`,
      [userId]
    );
    return res.json({ items: r.rows, last: r.rows[0] || null });
  }

  if (req.method === 'POST' && action === 'read') {
    const { source, item_id, read } = req.body || {};
    if (!SOURCES.includes(source) || typeof item_id !== 'string' || !item_id || item_id.length > 60) {
      return res.status(400).json({ error: 'source/item_id 가 올바르지 않습니다.' });
    }
    if (read === false) {
      await query(
        `DELETE FROM kisa_library_read WHERE user_id = $1 AND source = $2 AND item_id = $3`,
        [userId, source, item_id]
      );
    } else {
      await query(
        `INSERT INTO kisa_library_read (user_id, source, item_id, read_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, source, item_id) DO UPDATE SET read_at = NOW()`,
        [userId, source, item_id]
      );
    }
    return res.json({ ok: true });
  }

  if (req.method === 'POST' && action === 'srs-add') {
    const chapterCode = req.body?.chapter_code;
    if (!/^CQ-\d{1,5}$/.test(chapterCode || '')) {
      return res.status(400).json({ error: 'chapter_code 형식 오류 (CQ-XXXX)' });
    }
    const q = await query(
      `SELECT id FROM kisa_questions
       WHERE question_type = 'codeid' AND chapter_code = $1 AND is_active = TRUE LIMIT 1`,
      [chapterCode]
    );
    if (!q.rows.length) return res.status(404).json({ error: '해당 코드의 문항이 없습니다.' });

    // 신규 등록은 SRS 초기값(반복 0), 기존 항목은 오늘 복습으로 당기고 재개만 한다
    await query(`
      INSERT INTO kisa_review_queue (
        user_id, question_id, ease_factor, interval_days, repetitions,
        next_review_at, suspended
      ) VALUES ($1, $2, 2.5, 0, 0, NOW(), FALSE)
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        next_review_at = LEAST(kisa_review_queue.next_review_at, NOW()),
        suspended = FALSE
    `, [userId, q.rows[0].id]);
    return res.json({ ok: true, question_id: q.rows[0].id });
  }

  return res.status(400).json({ error: `지원하지 않는 요청: ${req.method} ?action=${action}` });
});
