// KISA 드릴 — 문항 조회 API
// GET /api/kisa-drill?action=next&type=mcq|diagnosis4&category=&language=&difficulty=&srs=true
//
// 동작:
//   srs=true 이면 kisa_review_queue에서 next_review_at <= now() 인 문항 우선 출제.
//   그렇지 않으면 사용자가 아직 시도하지 않은 문항 우선, 다음 랜덤.
//
// 쿼리 파라미터 (전부 선택):
//   type        — 'mcq' 또는 'diagnosis4' (기본 전체)
//   category    — weakness_category enum 값 하나
//   language    — 'java'|'python'|'javascript'|'kotlin'|'swift'|'etc'
//   difficulty  — '하'|'중'|'상'
//   srs         — 'true'면 SRS 큐에서만 출제
//   exclude_ids — 쉼표 구분 UUID 리스트 (세션 중 중복 방지)
const { query } = require('./db');
const { withAuth } = require('./middleware');

const ALLOWED_TYPES = ['mcq', 'diagnosis4', 'blank'];
const ALLOWED_STAGES = ['design', 'implementation'];
const ALLOWED_CATEGORIES = [
  'input_validation', 'security_feature', 'time_state',
  'error_handling', 'code_error', 'encapsulation', 'api_abuse',
  'session_control',
];
const ALLOWED_LANGUAGES = ['java', 'python', 'javascript', 'kotlin', 'swift', 'etc'];
const ALLOWED_DIFFICULTIES = ['하', '중', '상'];

module.exports = withAuth(async (req, res) => {
  const action = req.query?.action;
  const userId = req.user?.uid;

  if (action !== 'next' && action !== 'count') {
    return res.status(400).json({ error: '지원하지 않는 action 입니다.' });
  }

  // 필터 파라미터 파싱 + 화이트리스트 검증
  const type = ALLOWED_TYPES.includes(req.query?.type) ? req.query.type : null;
  const stage = ALLOWED_STAGES.includes(req.query?.stage) ? req.query.stage : null;
  const category = ALLOWED_CATEGORIES.includes(req.query?.category) ? req.query.category : null;
  const language = ALLOWED_LANGUAGES.includes(req.query?.language) ? req.query.language : null;
  const difficulty = ALLOWED_DIFFICULTIES.includes(req.query?.difficulty) ? req.query.difficulty : null;
  const srsOnly = req.query?.srs === 'true';
  // chapter_code 필터 (DSG-IV-01, IMP-SF-04 등) — 특정 챕터만 출제
  const chapterCode = typeof req.query?.chapter_code === 'string'
    && /^(DSG|IMP)-[A-Z]{2}-\d{2}$/.test(req.query.chapter_code)
    ? req.query.chapter_code : null;
  const excludeIds = (req.query?.exclude_ids || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // --------------------------------------------------------------------
  // GET ?action=count — 현재 필터 조건에 맞는 총 문항 수 반환
  // (DrillSession 진입 시 progress.total 세팅에 사용)
  // --------------------------------------------------------------------
  if (action === 'count') {
    const conditions = ['q.is_active = TRUE'];
    const params = [];
    let idx = 1;

    if (type) { conditions.push(`q.question_type = $${idx++}`); params.push(type); }
    if (stage) { conditions.push(`q.stage = $${idx++}`); params.push(stage); }
    if (category) { conditions.push(`q.weakness_category = $${idx++}`); params.push(category); }
    if (language) { conditions.push(`q.language = $${idx++}`); params.push(language); }
    if (difficulty) { conditions.push(`q.difficulty = $${idx++}`); params.push(difficulty); }
    if (chapterCode) { conditions.push(`q.chapter_code = $${idx++}`); params.push(chapterCode); }

    let sql;
    if (srsOnly) {
      conditions.push(`r.next_review_at <= NOW()`);
      conditions.push(`r.suspended = FALSE`);
      sql = `SELECT count(*)::int AS total
             FROM kisa_questions q
             INNER JOIN kisa_review_queue r ON r.question_id = q.id AND r.user_id = $${idx++}
             WHERE ${conditions.join(' AND ')}`;
      params.push(userId);
    } else {
      sql = `SELECT count(*)::int AS total
             FROM kisa_questions q
             WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(sql, params);
    return res.json({ total: result.rows[0]?.total || 0 });
  }

  // WHERE 조건 동적 조립 (parameterized)
  const conditions = ['q.is_active = TRUE'];
  const params = [];
  let idx = 1;

  if (type) { conditions.push(`q.question_type = $${idx++}`); params.push(type); }
  if (stage) { conditions.push(`q.stage = $${idx++}`); params.push(stage); }
  if (category) { conditions.push(`q.weakness_category = $${idx++}`); params.push(category); }
  if (language) { conditions.push(`q.language = $${idx++}`); params.push(language); }
  if (difficulty) { conditions.push(`q.difficulty = $${idx++}`); params.push(difficulty); }
  if (chapterCode) { conditions.push(`q.chapter_code = $${idx++}`); params.push(chapterCode); }
  if (excludeIds.length > 0) {
    conditions.push(`q.id <> ALL($${idx++}::uuid[])`);
    params.push(excludeIds);
  }

  let sql;
  if (srsOnly) {
    // SRS 모드: review queue에 있고 next_review_at <= now()인 문항
    conditions.push(`r.next_review_at <= NOW()`);
    conditions.push(`r.suspended = FALSE`);
    sql = `
      SELECT q.*, r.next_review_at, r.repetitions, r.ease_factor, r.interval_days
      FROM kisa_questions q
      INNER JOIN kisa_review_queue r ON r.question_id = q.id AND r.user_id = $${idx++}
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.next_review_at ASC, RANDOM()
      LIMIT 1
    `;
    params.push(userId);
  } else {
    // 일반 모드: 미시도 문항 우선, 다음 랜덤
    sql = `
      SELECT q.*, a.submitted_at AS last_attempted_at
      FROM kisa_questions q
      LEFT JOIN LATERAL (
        SELECT submitted_at
        FROM kisa_diagnosis_attempts
        WHERE question_id = q.id AND user_id = $${idx++}
        ORDER BY submitted_at DESC LIMIT 1
      ) a ON TRUE
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.submitted_at ASC NULLS FIRST, RANDOM()
      LIMIT 1
    `;
    params.push(userId);
  }

  const result = await query(sql, params);

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: srsOnly
        ? '현재 복습 예정인 문항이 없습니다.'
        : '조건에 맞는 문항이 없습니다.',
    });
  }

  const q = result.rows[0];

  // 클라이언트에 반환 — 정답/키워드는 숨김 (채점은 서버에서만)
  const publicQuestion = {
    id: q.id,
    question_type: q.question_type,
    weakness_category: q.weakness_category,
    weakness_code: q.weakness_code,
    weakness_name_ko: q.weakness_name_ko,
    language: q.language,
    difficulty: q.difficulty,
    body: q.body,
    vulnerable_code: q.vulnerable_code,
    code_language: q.code_language,
    // MCQ: 선택지는 노출, 정답 인덱스는 숨김
    choices: q.choices,
    // diagnosis4: 키워드 개수만 힌트로 노출 (힌트 카운터용)
    rationale_keyword_count: Array.isArray(q.rationale_keywords) ? q.rationale_keywords.length : 0,
    fix_keyword_count: Array.isArray(q.fix_keywords) ? q.fix_keywords.length : 0,
    // blank: 빈칸 템플릿만 노출. 정답은 숨김 (채점 후 응답에만 포함)
    blank_template: q.question_type === 'blank' ? q.blank_template : null,
    blank_count: q.question_type === 'blank' && Array.isArray(q.blank_answers)
      ? q.blank_answers.length : 0,
    reference: q.reference,
    tags: q.tags,
    // SRS 메타 (있으면)
    srs: srsOnly ? {
      next_review_at: q.next_review_at,
      repetitions: q.repetitions,
      interval_days: q.interval_days,
    } : null,
  };

  res.json({ question: publicQuestion });
});
