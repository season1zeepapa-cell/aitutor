// KISA 드릴 — SRS 복습 큐 + 학습 통계
//
//   GET  /api/kisa-review?action=queue&limit=20
//        → 오늘 복습 예정 문항 목록 (next_review_at <= NOW())
//
//   GET  /api/kisa-review?action=stats
//        → 학습 통계 대시보드용 집계 데이터
//        {
//          by_category: [{weakness_category, attempted, correct, avg_score}],
//          weekly: [{date, count, avg_score}],              // 최근 7일
//          upcoming: [{date, count}],                       // 향후 7일 예정
//          summary: {total_attempts, unique_questions, avg_score, due_today}
//        }
//
//   POST /api/kisa-review?action=suspend
//        body: { question_id, suspended: true|false }
//        → 복습 큐 일시중단/재개
const { query } = require('./db');
const { withAuth } = require('./middleware');

module.exports = withAuth(async (req, res) => {
  const userId = req.user?.uid;
  const action = req.query?.action;

  // ------------------------------------------------------------------------
  // GET ?action=queue — 복습 예정 문항 목록
  // ------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'queue') {
    const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || '20')));

    const result = await query(`
      SELECT
        r.question_id, r.next_review_at, r.repetitions, r.interval_days, r.ease_factor,
        q.weakness_category, q.weakness_code, q.weakness_name_ko,
        q.language, q.difficulty, q.question_type
      FROM kisa_review_queue r
      INNER JOIN kisa_questions q ON q.id = r.question_id
      WHERE r.user_id = $1
        AND r.suspended = FALSE
        AND r.next_review_at <= NOW()
        AND q.is_active = TRUE
      ORDER BY r.next_review_at ASC
      LIMIT $2
    `, [userId, limit]);

    return res.json({ items: result.rows, count: result.rows.length });
  }

  // ------------------------------------------------------------------------
  // GET ?action=stats — 대시보드용 통계
  // ------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'stats') {
    // 4개 집계를 병렬 실행 (커넥션 풀 max=2이므로 순차도 가능)
    const [byCategory, weekly, upcoming, summary] = await Promise.all([
      // 1) 7대 분류별 정답률 (diagnosis4/mcq 구분 없이 auto_score 평균)
      query(`
        SELECT q.weakness_category,
               count(*)::int                               AS attempted,
               count(*) FILTER (WHERE a.auto_score >= 70)::int AS correct,
               ROUND(AVG(a.auto_score)::numeric, 1)::float AS avg_score
        FROM kisa_diagnosis_attempts a
        INNER JOIN kisa_questions q ON q.id = a.question_id
        WHERE a.user_id = $1
        GROUP BY q.weakness_category
        ORDER BY q.weakness_category
      `, [userId]),

      // 2) 최근 7일 주간 학습량
      query(`
        SELECT to_char(date_trunc('day', submitted_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS date,
               count(*)::int                               AS count,
               ROUND(AVG(auto_score)::numeric, 1)::float   AS avg_score
        FROM kisa_diagnosis_attempts
        WHERE user_id = $1
          AND submitted_at >= NOW() - INTERVAL '7 days'
        GROUP BY date_trunc('day', submitted_at AT TIME ZONE 'Asia/Seoul')
        ORDER BY date
      `, [userId]),

      // 3) 향후 7일 복습 예정 히트맵
      query(`
        SELECT to_char(date_trunc('day', next_review_at AT TIME ZONE 'Asia/Seoul'), 'YYYY-MM-DD') AS date,
               count(*)::int AS count
        FROM kisa_review_queue
        WHERE user_id = $1
          AND suspended = FALSE
          AND next_review_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        GROUP BY date_trunc('day', next_review_at AT TIME ZONE 'Asia/Seoul')
        ORDER BY date
      `, [userId]),

      // 4) 요약 카드 4종
      query(`
        SELECT
          (SELECT count(*) FROM kisa_diagnosis_attempts WHERE user_id = $1)::int                        AS total_attempts,
          (SELECT count(DISTINCT question_id) FROM kisa_diagnosis_attempts WHERE user_id = $1)::int     AS unique_questions,
          (SELECT ROUND(AVG(auto_score)::numeric, 1)::float FROM kisa_diagnosis_attempts WHERE user_id = $1) AS avg_score,
          (SELECT count(*) FROM kisa_review_queue
             WHERE user_id = $1 AND suspended = FALSE AND next_review_at <= NOW())::int                AS due_today,
          (SELECT count(*) FROM kisa_diagnosis_attempts
             WHERE user_id = $1 AND submitted_at >= NOW() - INTERVAL '7 days')::int                    AS weekly_count
      `, [userId]),
    ]);

    return res.json({
      by_category: byCategory.rows,
      weekly: weekly.rows,
      upcoming: upcoming.rows,
      summary: summary.rows[0] || {
        total_attempts: 0, unique_questions: 0, avg_score: 0, due_today: 0, weekly_count: 0,
      },
    });
  }

  // ------------------------------------------------------------------------
  // GET ?action=wrong_notes — 오답 노트 (REBUILD16 §12.2-D)
  //   최근 N일 동안 자가채점 < 70 이거나 (mcq 인 경우) 정답이 아닌 시도를 모음.
  //   각 question 의 가장 최근 오답 1건만 가져옴 (중복 제거).
  // ------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'wrong_notes') {
    const days = Math.max(1, Math.min(180, parseInt(req.query?.days || '30', 10)));
    const limit = Math.max(1, Math.min(200, parseInt(req.query?.limit || '50', 10)));
    // DISTINCT ON (question_id) 로 최신 시도 1개만, auto_score < 70 조건
    const result = await query(`
      WITH latest_wrong AS (
        SELECT DISTINCT ON (a.question_id)
          a.id, a.question_id, a.mode, a.auto_score, a.submitted_at,
          a.mcq_selected, a.verdict_yn, a.cited_lines,
          a.rationale_text, a.fix_text, a.blank_answers_user
        FROM kisa_diagnosis_attempts a
        WHERE a.user_id = $1
          AND a.submitted_at > NOW() - ($2 || ' days')::INTERVAL
          AND a.auto_score IS NOT NULL
          AND a.auto_score < 70
        ORDER BY a.question_id, a.submitted_at DESC
      )
      SELECT
        lw.id AS attempt_id,
        lw.auto_score, lw.submitted_at, lw.mode,
        lw.mcq_selected, lw.verdict_yn, lw.cited_lines,
        lw.rationale_text, lw.fix_text, lw.blank_answers_user,
        q.id AS question_id,
        q.question_type, q.weakness_category, q.weakness_code, q.weakness_name_ko,
        q.chapter_code, q.language, q.difficulty,
        q.body, q.choices, q.answer_index,
        q.blank_template, q.blank_answers,
        q.vulnerable_lines, q.explanation
      FROM latest_wrong lw
      JOIN kisa_questions q ON q.id = lw.question_id
      ORDER BY lw.submitted_at DESC
      LIMIT $3
    `, [userId, String(days), limit]);

    // 카테고리별 집계
    const byCategoryQ = await query(`
      WITH latest_wrong AS (
        SELECT DISTINCT ON (a.question_id) a.question_id
        FROM kisa_diagnosis_attempts a
        WHERE a.user_id = $1
          AND a.submitted_at > NOW() - ($2 || ' days')::INTERVAL
          AND a.auto_score IS NOT NULL AND a.auto_score < 70
        ORDER BY a.question_id, a.submitted_at DESC
      )
      SELECT q.weakness_category, count(*)::int AS cnt
      FROM latest_wrong lw JOIN kisa_questions q ON q.id = lw.question_id
      GROUP BY q.weakness_category ORDER BY cnt DESC
    `, [userId, String(days)]);

    return res.json({
      days,
      total: result.rows.length,
      by_category: byCategoryQ.rows,
      items: result.rows,
    });
  }

  // ------------------------------------------------------------------------
  // POST ?action=reset — 본인 학습 통계 전체 초기화
  //   body(optional): { scope: 'all' | 'attempts' | 'srs' | 'exams' }
  //   기본 scope='all' — 응시 기록 + SRS 큐 + 모의고사 세션 전부 삭제
  //   문제 데이터(kisa_questions)는 건드리지 않음.
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'reset') {
    const scope = (req.body && req.body.scope) || 'all';
    if (!['all', 'attempts', 'srs', 'exams'].includes(scope)) {
      return res.status(400).json({ error: `잘못된 scope: ${scope}` });
    }

    const deleted = { attempts: 0, srs: 0, exams: 0 };

    if (scope === 'all' || scope === 'attempts') {
      const r = await query(
        'DELETE FROM kisa_diagnosis_attempts WHERE user_id = $1',
        [userId]
      );
      deleted.attempts = r.rowCount || 0;
    }
    if (scope === 'all' || scope === 'srs') {
      const r = await query(
        'DELETE FROM kisa_review_queue WHERE user_id = $1',
        [userId]
      );
      deleted.srs = r.rowCount || 0;
    }
    if (scope === 'all' || scope === 'exams') {
      const r = await query(
        'DELETE FROM kisa_exam_sessions WHERE user_id = $1',
        [userId]
      );
      deleted.exams = r.rowCount || 0;
    }

    console.log(`[KisaReview] 학습 통계 초기화 user=${userId} scope=${scope} deleted=${JSON.stringify(deleted)}`);
    return res.json({ status: 'ok', scope, deleted });
  }

  // ------------------------------------------------------------------------
  // POST ?action=suspend — 복습 큐 일시중단/재개
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'suspend') {
    const { question_id, suspended } = req.body || {};
    if (!question_id) return res.status(400).json({ error: 'question_id가 필요합니다.' });

    const result = await query(`
      UPDATE kisa_review_queue
      SET suspended = $1
      WHERE user_id = $2 AND question_id = $3
      RETURNING question_id, suspended
    `, [!!suspended, userId, question_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '해당 문항이 복습 큐에 없습니다.' });
    }
    return res.json({ updated: result.rows[0] });
  }

  return res.status(400).json({ error: `지원하지 않는 요청: ${req.method} ?action=${action}` });
});
