// KISA 실전 모의고사 세션 관리 API
//
//   POST /api/kisa-exam?action=start
//        body: { mode: 'theory60'|'practical100'|'full3h' }
//        → 신규 세션 생성. 해당 mode에 맞는 문항 ID 배열을 랜덤 샘플링하여 저장.
//
//   GET  /api/kisa-exam?action=session&id=<uuid>
//        → 진행 중 세션 조회 (새로고침/재접속 복원용).
//        응답에 문항 본문까지 포함 (정답/키워드는 숨김).
//
//   POST /api/kisa-exam?action=autosave&id=<uuid>
//        body: { answers: { <question_id>: {...}, ... } }
//        → 30초 주기 자동저장. answers jsonb만 갱신.
//
//   POST /api/kisa-exam?action=submit&id=<uuid>
//        body: { answers?: {...} }
//        → 세션 제출. 서버가 모든 문항을 채점하고 총점/이론/실기 계산.
//        attempts 테이블에 mode='exam' 으로 저장. 세션 state='submitted'.
//
//   GET  /api/kisa-exam?action=result&id=<uuid>
//        → 제출 완료된 세션의 성적표.
const { query } = require('./db');
const { withAuth } = require('./middleware');
const { scoreAttempt } = require('./_kisa/scorer');

// 시험 모드별 구성
// theory60 30문항은 mcq 20 + blank 10 으로 혼합 출제 (실제 이수시험 이론 30문항 대비)
const EXAM_CONFIG = {
  theory60:     { timeLimit: 60 * 60,   mcq: 20, blank: 10, practical: 0  },
  practical100: { timeLimit: 100 * 60,  mcq: 0,  blank: 0,  practical: 15 },
  full3h:       { timeLimit: 180 * 60,  mcq: 20, blank: 10, practical: 15 },
};

/** 시험용 문항 랜덤 샘플링 — 이론(mcq) + 단답형(blank) + 실기(diagnosis4) */
async function sampleQuestions(cfg) {
  const ids = [];

  if (cfg.mcq > 0) {
    const mcq = await query(`
      SELECT id FROM kisa_questions
      WHERE question_type = 'mcq' AND is_active = TRUE
      ORDER BY RANDOM() LIMIT $1
    `, [cfg.mcq]);
    ids.push(...mcq.rows.map(r => r.id));
  }

  if (cfg.blank > 0) {
    const blank = await query(`
      SELECT id FROM kisa_questions
      WHERE question_type = 'blank' AND is_active = TRUE
      ORDER BY RANDOM() LIMIT $1
    `, [cfg.blank]);
    ids.push(...blank.rows.map(r => r.id));
  }

  if (cfg.practical > 0) {
    const diag = await query(`
      SELECT id FROM kisa_questions
      WHERE question_type = 'diagnosis4' AND is_active = TRUE
      ORDER BY RANDOM() LIMIT $1
    `, [cfg.practical]);
    ids.push(...diag.rows.map(r => r.id));
  }

  return ids;
}

/** 세션 시간 초과 여부 확인 + 자동 만료 처리 */
async function checkAndExpire(session) {
  if (session.state !== 'in_progress') return session;
  const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 1000;
  if (elapsed > session.time_limit_sec) {
    await query(
      `UPDATE kisa_exam_sessions SET state = 'expired', expired_at = NOW() WHERE id = $1`,
      [session.id]
    );
    return { ...session, state: 'expired', expired_at: new Date() };
  }
  return session;
}

module.exports = withAuth(async (req, res) => {
  const userId = req.user?.uid;
  const action = req.query?.action;

  // ------------------------------------------------------------------------
  // POST ?action=start — 신규 세션 생성
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'start') {
    const mode = req.body?.mode;
    if (!EXAM_CONFIG[mode]) {
      return res.status(400).json({ error: `지원하지 않는 시험 모드: ${mode}` });
    }
    const cfg = EXAM_CONFIG[mode];

    // 기존 in_progress 세션이 있으면 abandoned 처리 (사용자당 동시 1개)
    await query(
      `UPDATE kisa_exam_sessions SET state = 'abandoned' WHERE user_id = $1 AND state = 'in_progress'`,
      [userId]
    );

    const requested = (cfg.mcq || 0) + (cfg.blank || 0) + (cfg.practical || 0);
    const questionIds = await sampleQuestions(cfg);
    if (questionIds.length < requested) {
      return res.status(503).json({
        error: `문항 수가 부족합니다 (요청 ${requested}, 가용 ${questionIds.length})`,
      });
    }

    const result = await query(`
      INSERT INTO kisa_exam_sessions (
        user_id, exam_type, state, question_ids, answers, time_limit_sec, started_at
      ) VALUES ($1, $2, 'in_progress', $3, '{}'::jsonb, $4, NOW())
      RETURNING id, exam_type, state, question_ids, time_limit_sec, started_at
    `, [userId, mode, questionIds, cfg.timeLimit]);

    console.log(`[KisaExam] 세션 시작 user=${userId} mode=${mode} id=${result.rows[0].id}`);
    return res.json({ session: result.rows[0] });
  }

  // ------------------------------------------------------------------------
  // GET ?action=session&id=<uuid> — 세션 상세 조회 (문항 본문 포함)
  // ------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'session') {
    const sessionId = req.query?.id;
    if (!sessionId) return res.status(400).json({ error: 'id가 필요합니다.' });

    const sRes = await query(
      `SELECT * FROM kisa_exam_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (sRes.rows.length === 0) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    let session = sRes.rows[0];

    // 시간 초과 체크
    session = await checkAndExpire(session);

    // 문항 본문 조회 (정답/키워드 숨김)
    const qRes = await query(`
      SELECT id, question_type, weakness_category, weakness_code, weakness_name_ko,
             language, difficulty, body, vulnerable_code, code_language, choices,
             (CASE WHEN question_type = 'diagnosis4'
                   THEN array_length(rationale_keywords, 1)
                   ELSE NULL END) AS rationale_keyword_count,
             (CASE WHEN question_type = 'diagnosis4'
                   THEN array_length(fix_keywords, 1)
                   ELSE NULL END) AS fix_keyword_count
      FROM kisa_questions
      WHERE id = ANY($1::uuid[])
    `, [session.question_ids]);

    // 원래 순서대로 정렬
    const qMap = new Map(qRes.rows.map(q => [q.id, q]));
    const orderedQuestions = session.question_ids.map(id => qMap.get(id)).filter(Boolean);

    // 남은 시간 계산
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    const remainingSec = Math.max(0, session.time_limit_sec - elapsed);

    return res.json({
      session: {
        id: session.id,
        exam_type: session.exam_type,
        state: session.state,
        started_at: session.started_at,
        time_limit_sec: session.time_limit_sec,
        remaining_sec: remainingSec,
        answers: session.answers || {},
      },
      questions: orderedQuestions,
    });
  }

  // ------------------------------------------------------------------------
  // POST ?action=autosave&id=<uuid> — 자동저장
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'autosave') {
    const sessionId = req.query?.id;
    const { answers } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'id가 필요합니다.' });
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers 객체가 필요합니다.' });
    }

    const result = await query(`
      UPDATE kisa_exam_sessions
      SET answers = $1::jsonb
      WHERE id = $2 AND user_id = $3 AND state = 'in_progress'
      RETURNING id
    `, [JSON.stringify(answers), sessionId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: '진행 중 세션이 아닙니다.' });
    }
    return res.json({ saved: true, saved_at: new Date().toISOString() });
  }

  // ------------------------------------------------------------------------
  // POST ?action=submit&id=<uuid> — 세션 제출 + 채점
  // ------------------------------------------------------------------------
  if (req.method === 'POST' && action === 'submit') {
    const sessionId = req.query?.id;
    if (!sessionId) return res.status(400).json({ error: 'id가 필요합니다.' });

    // 1) 세션 조회
    const sRes = await query(
      `SELECT * FROM kisa_exam_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [sessionId, userId]
    );
    if (sRes.rows.length === 0) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    const session = sRes.rows[0];

    if (session.state === 'submitted') {
      return res.status(409).json({ error: '이미 제출된 세션입니다.' });
    }

    // 2) 최종 answers (요청 body 우선)
    const finalAnswers = (req.body?.answers && typeof req.body.answers === 'object')
      ? req.body.answers
      : (session.answers || {});

    // 3) 모든 문항 일괄 채점
    const qRes = await query(
      `SELECT * FROM kisa_questions WHERE id = ANY($1::uuid[])`,
      [session.question_ids]
    );

    let totalScore = 0, theoryScore = 0, practicalScore = 0;
    let theoryCount = 0, practicalCount = 0;
    const attempts = [];

    for (const q of qRes.rows) {
      const ans = finalAnswers[q.id] || {};
      const scored = scoreAttempt(q, {
        mcq_selected: typeof ans.mcq_selected === 'number' ? ans.mcq_selected : null,
        verdict_yn: typeof ans.verdict_yn === 'boolean' ? ans.verdict_yn : null,
        cited_lines: Array.isArray(ans.cited_lines) ? ans.cited_lines : [],
        rationale_text: ans.rationale_text || '',
        fix_text: ans.fix_text || '',
        fix_code: ans.fix_code || '',
        blank_answers_user: Array.isArray(ans.blank_answers_user) ? ans.blank_answers_user : [],
      });

      totalScore += scored.autoScore;
      // mcq, blank 모두 이론(theory) 점수에 합산 (실제 이수시험 이론 영역 기준)
      if (q.question_type === 'mcq' || q.question_type === 'blank') {
        theoryScore += scored.autoScore;
        theoryCount++;
      } else {
        practicalScore += scored.autoScore;
        practicalCount++;
      }

      attempts.push({ question_id: q.id, ans, scored });
    }

    // 평균 내기 (0-100 스케일)
    const avgTotal     = qRes.rows.length > 0 ? Math.round(totalScore / qRes.rows.length)     : 0;
    const avgTheory    = theoryCount      > 0 ? Math.round(theoryScore / theoryCount)         : null;
    const avgPractical = practicalCount   > 0 ? Math.round(practicalScore / practicalCount)   : null;

    // 4) 세션 업데이트
    await query(`
      UPDATE kisa_exam_sessions
      SET state = 'submitted', ended_at = NOW(),
          answers = $1::jsonb,
          total_score = $2, theory_score = $3, practical_score = $4
      WHERE id = $5
    `, [JSON.stringify(finalAnswers), avgTotal, avgTheory, avgPractical, sessionId]);

    // 5) 각 문항에 대해 attempt 저장 (mode='exam')
    for (const a of attempts) {
      await query(`
        INSERT INTO kisa_diagnosis_attempts (
          user_id, question_id, mode, exam_session_id,
          mcq_selected, verdict_yn, cited_lines,
          rationale_text, fix_text, fix_code,
          auto_score, final_score, keyword_hits
        ) VALUES ($1, $2, 'exam', $3, $4, $5, $6, $7, $8, $9, $10, $10, $11::jsonb)
      `, [
        userId, a.question_id, sessionId,
        typeof a.ans.mcq_selected === 'number' ? a.ans.mcq_selected : null,
        typeof a.ans.verdict_yn === 'boolean' ? a.ans.verdict_yn : null,
        Array.isArray(a.ans.cited_lines) ? a.ans.cited_lines : [],
        a.ans.rationale_text || '',
        a.ans.fix_text || '',
        a.ans.fix_code || '',
        a.scored.autoScore,
        JSON.stringify(a.scored.keywordHits || {}),
      ]);
    }

    console.log(`[KisaExam] 제출 완료 user=${userId} id=${sessionId} total=${avgTotal}`);
    return res.json({
      submitted: true,
      total_score: avgTotal,
      theory_score: avgTheory,
      practical_score: avgPractical,
      passed: avgTotal >= 70,
      question_count: qRes.rows.length,
    });
  }

  // ------------------------------------------------------------------------
  // GET ?action=result&id=<uuid> — 제출 완료 세션 결과
  // ------------------------------------------------------------------------
  if (req.method === 'GET' && action === 'result') {
    const sessionId = req.query?.id;
    if (!sessionId) return res.status(400).json({ error: 'id가 필요합니다.' });

    const sRes = await query(
      `SELECT * FROM kisa_exam_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (sRes.rows.length === 0) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

    const session = sRes.rows[0];
    const attemptsRes = await query(`
      SELECT a.question_id, a.auto_score, a.mcq_selected, a.verdict_yn,
             q.weakness_name_ko, q.question_type, q.weakness_category, q.language, q.difficulty
      FROM kisa_diagnosis_attempts a
      INNER JOIN kisa_questions q ON q.id = a.question_id
      WHERE a.exam_session_id = $1
      ORDER BY a.submitted_at ASC
    `, [sessionId]);

    return res.json({ session, items: attemptsRes.rows });
  }

  return res.status(400).json({ error: `지원하지 않는 요청: ${req.method} ?action=${action}` });
});
