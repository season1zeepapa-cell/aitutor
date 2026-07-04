// KISA 드릴 — 문항 조회 API
// GET /api/kisa-drill?action=next&type=objective|diagnosis4&category=&language=&difficulty=&srs=true
//
// 동작:
//   srs=true 이면 kisa_review_queue에서 next_review_at <= now() 인 문항 우선 출제.
//   그렇지 않으면 사용자가 아직 시도하지 않은 문항 우선, 다음 랜덤.
//
// 쿼리 파라미터 (전부 선택):
//   type        — 'objective' 또는 'diagnosis4' 등 (기본 전체)
//   category    — weakness_category enum 값 하나
//   language    — 'java'|'python'|'javascript'|'kotlin'|'swift'|'etc'
//   difficulty  — '하'|'중'|'상'
//   srs         — 'true'면 SRS 큐에서만 출제
//   exclude_ids — 쉼표 구분 UUID 리스트 (세션 중 중복 방지)
const { query } = require('./db');
const { withAuth } = require('./middleware');

const ALLOWED_TYPES = ['diagnosis4', 'blank', 'composite', 'codeid', 'objective', 'shortessay'];
const ALLOWED_STAGES = ['design', 'implementation'];
const ALLOWED_CATEGORIES = [
  'input_validation', 'security_feature', 'time_state',
  'error_handling', 'code_error', 'encapsulation', 'api_abuse',
  'session_control',
];
const ALLOWED_LANGUAGES = ['java', 'python', 'javascript', 'kotlin', 'swift', 'etc'];
const ALLOWED_DIFFICULTIES = ['하', '중', '상'];
// 출처(자료원) 필터 — codeid 문항은 tags 배열에 출처 id 가 저장됨 (build-kisa-codeid-seed.mjs)
const ALLOWED_SOURCES = ['library', 'kisec2026', 'jssec2023', 'devsec2021', 'pysec2023'];

module.exports = withAuth(async (req, res) => {
  const action = req.query?.action;
  const userId = req.user?.uid;

  if (action !== 'next' && action !== 'count' && action !== 'progress') {
    return res.status(400).json({ error: '지원하지 않는 action 입니다.' });
  }

  // 필터 파라미터 파싱 + 화이트리스트 검증
  const type = ALLOWED_TYPES.includes(req.query?.type) ? req.query.type : null;
  const stage = ALLOWED_STAGES.includes(req.query?.stage) ? req.query.stage : null;
  const category = ALLOWED_CATEGORIES.includes(req.query?.category) ? req.query.category : null;
  // categories=a,b — 카테고리 다중선택(이론·단답형 설정). 통과분만. 있으면 단일 category 보다 우선.
  const categories = (req.query?.categories || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => ALLOWED_CATEGORIES.includes(s));
  const language = ALLOWED_LANGUAGES.includes(req.query?.language) ? req.query.language : null;
  const difficulty = ALLOWED_DIFFICULTIES.includes(req.query?.difficulty) ? req.query.difficulty : null;
  const srsOnly = req.query?.srs === 'true';
  const guideOrder = req.query?.order === 'guide'; // 가이드순(단계→분류→번호) 출제 모드
  // chapter_code 필터 (DSG-IV-01, IMP-SF-04 등) — 특정 챕터만 출제
  const chapterCode = typeof req.query?.chapter_code === 'string'
    && /^(DSG|IMP)-[A-Z]{2}-\d{2}$/.test(req.query.chapter_code)
    ? req.query.chapter_code : null;
  const excludeIds = (req.query?.exclude_ids || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  // sources=library,kisec2026 형태 — 화이트리스트 통과분만. 비면 전체(필터 없음).
  const sources = (req.query?.sources || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => ALLOWED_SOURCES.includes(s));
  // dedup=true — 출처 간 동일 코드(dedup_key) 중복 제거. 대표는 chapter_code(CQ 발번순=출처 우선순위) 최소.
  const dedup = req.query?.dedup === 'true';
  const DKEY = `COALESCE(q.dedup_key, q.chapter_code)`; // codeid 는 dedup_key 보유, 방어적으로 COALESCE

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
    if (categories.length > 0) { conditions.push(`q.weakness_category = ANY($${idx++})`); params.push(categories); }
    else if (category) { conditions.push(`q.weakness_category = $${idx++}`); params.push(category); }
    if (language) { conditions.push(`q.language = $${idx++}`); params.push(language); }
    if (difficulty) { conditions.push(`q.difficulty = $${idx++}`); params.push(difficulty); }
    // objective/shortessay 는 chapter_code 'OBJ-/ESSAY-<챕터>[-N]', codeid 는 weakness_code 로 약점 매칭 (chapter_code 는 CQ-XXXX)
    if (chapterCode) { conditions.push(`(q.chapter_code = $${idx} OR q.chapter_code LIKE 'OBJ-' || $${idx} || '%' OR q.chapter_code LIKE 'ESSAY-' || $${idx} || '%' OR (q.question_type = 'codeid' AND q.weakness_code = $${idx}))`); idx++; params.push(chapterCode); }
    if (sources.length > 0) { conditions.push(`q.tags && $${idx++}::text[]`); params.push(sources); }

    // dedup 시 총계는 고유 dedup_key 수, 아니면 문항 수
    const countExpr = dedup ? `count(DISTINCT ${DKEY})::int` : `count(*)::int`;
    let sql;
    if (srsOnly) {
      conditions.push(`r.next_review_at <= NOW()`);
      conditions.push(`r.suspended = FALSE`);
      sql = `SELECT ${countExpr} AS total
             FROM kisa_questions q
             INNER JOIN kisa_review_queue r ON r.question_id = q.id AND r.user_id = $${idx++}
             WHERE ${conditions.join(' AND ')}`;
      params.push(userId);
    } else {
      sql = `SELECT ${countExpr} AS total
             FROM kisa_questions q
             WHERE ${conditions.join(' AND ')}`;
    }

    const result = await query(sql, params);
    const total = result.rows[0]?.total || 0;

    // 이어하기용 — 이 필터 범위에서 이미 시도한 문항 수. dedup 시 시도한 고유 dedup_key 수.
    let attempted = 0;
    if (!srsOnly) {
      const aExpr = dedup ? `count(DISTINCT ${DKEY})::int` : `count(DISTINCT q.id)::int`;
      const aSql = `SELECT ${aExpr} AS n
                    FROM kisa_questions q
                    INNER JOIN kisa_diagnosis_attempts a ON a.question_id = q.id AND a.user_id = $${idx}
                    WHERE ${conditions.join(' AND ')}`;
      const aRes = await query(aSql, [...params, userId]);
      attempted = aRes.rows[0]?.n || 0;
    }
    return res.json({ total, attempted });
  }

  // --------------------------------------------------------------------
  // GET ?action=progress — 유형(기본 codeid)의 전체 + 분류별 진도(시도/총계)
  //   "이어서 학습하기" 랜딩에서 그룹별 완료율 표시에 사용.
  // --------------------------------------------------------------------
  if (action === 'progress') {
    const t = type || 'codeid';
    // 분류별 진도 — 출처 다중선택(sources) 필터 + dedup 토글 반영
    const srcCond = sources.length > 0 ? 'AND q.tags && $3::text[]' : '';
    const srcParams = sources.length > 0 ? [sources] : [];
    const totExpr = dedup ? `count(DISTINCT ${DKEY})::int` : `count(DISTINCT q.id)::int`;
    const attExpr = dedup ? `count(DISTINCT ${DKEY}) FILTER (WHERE a.question_id IS NOT NULL)::int` : `count(DISTINCT a.question_id)::int`;
    const rows = (await query(`
      SELECT q.weakness_category AS category,
             ${totExpr} AS total,
             ${attExpr} AS attempted
      FROM kisa_questions q
      LEFT JOIN kisa_diagnosis_attempts a ON a.question_id = q.id AND a.user_id = $1
      WHERE q.is_active = TRUE AND q.question_type = $2 ${srcCond}
      GROUP BY q.weakness_category
      ORDER BY q.weakness_category
    `, [userId, t, ...srcParams])).rows;
    const overall = rows.reduce(
      (o, r) => ({ total: o.total + r.total, attempted: o.attempted + r.attempted }),
      { total: 0, attempted: 0 },
    );
    // 출처별 문항수·진도 — 상단 다중선택 칩 표시용 (필터와 무관하게 전체 기준)
    const bySource = (await query(`
      SELECT s AS source,
             count(DISTINCT q.id)::int AS total,
             count(DISTINCT a.question_id)::int AS attempted
      FROM kisa_questions q
      CROSS JOIN LATERAL unnest(q.tags) AS s
      LEFT JOIN kisa_diagnosis_attempts a ON a.question_id = q.id AND a.user_id = $1
      WHERE q.is_active = TRUE AND q.question_type = $2 AND s = ANY($3::text[])
      GROUP BY s
      ORDER BY s
    `, [userId, t, ALLOWED_SOURCES])).rows;
    return res.json({ type: t, overall, byCategory: rows, bySource });
  }

  // WHERE 조건 동적 조립 (parameterized)
  const conditions = ['q.is_active = TRUE'];
  const params = [];
  let idx = 1;

  if (type) { conditions.push(`q.question_type = $${idx++}`); params.push(type); }
  if (stage) { conditions.push(`q.stage = $${idx++}`); params.push(stage); }
  if (categories.length > 0) { conditions.push(`q.weakness_category = ANY($${idx++})`); params.push(categories); }
    else if (category) { conditions.push(`q.weakness_category = $${idx++}`); params.push(category); }
  if (language) { conditions.push(`q.language = $${idx++}`); params.push(language); }
  if (difficulty) { conditions.push(`q.difficulty = $${idx++}`); params.push(difficulty); }
  // objective/shortessay 는 chapter_code 'OBJ-/ESSAY-<챕터>[-N]', codeid 는 weakness_code 로 약점 매칭 (chapter_code 는 CQ-XXXX)
  if (chapterCode) { conditions.push(`(q.chapter_code = $${idx} OR q.chapter_code LIKE 'OBJ-' || $${idx} || '%' OR q.chapter_code LIKE 'ESSAY-' || $${idx} || '%' OR (q.question_type = 'codeid' AND q.weakness_code = $${idx}))`); idx++; params.push(chapterCode); }
  let sourcesParamIdx = null;
  if (sources.length > 0) { sourcesParamIdx = idx; conditions.push(`q.tags && $${idx++}::text[]`); params.push(sources); }
  if (excludeIds.length > 0) {
    conditions.push(`q.id <> ALL($${idx++}::uuid[])`);
    params.push(excludeIds);
  }
  // dedup 토글(일반 모드): 각 dedup_key 그룹에서 대표 1개(현재 출처범위 내 chapter_code 최소)만 후보.
  //   SRS 복습 모드는 개별 문항 단위라 dedup 미적용.
  if (dedup && !srsOnly) {
    const srcSub = sourcesParamIdx ? `AND q2.tags && $${sourcesParamIdx}::text[]` : '';
    conditions.push(`q.chapter_code = (
      SELECT min(q2.chapter_code) FROM kisa_questions q2
      WHERE q2.question_type = 'codeid' AND q2.is_active = TRUE
        AND COALESCE(q2.dedup_key, q2.chapter_code) = ${DKEY} ${srcSub})`);
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
      ORDER BY ${guideOrder ? `
        CASE q.stage WHEN 'design' THEN 1 ELSE 2 END,
        CASE q.weakness_category
          WHEN 'input_validation' THEN 1 WHEN 'security_feature' THEN 2 WHEN 'time_state' THEN 3
          WHEN 'error_handling' THEN 4 WHEN 'code_error' THEN 5 WHEN 'encapsulation' THEN 6
          WHEN 'api_abuse' THEN 7 WHEN 'session_control' THEN 8 ELSE 9 END,
        q.chapter_code, q.id` : `a.submitted_at ASC NULLS FIRST, RANDOM()`}
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
    // chapter_code: 풀이 화면의 '관련 지식 라이브러리' 모달이 이 값으로 자료를 매칭
    chapter_code: q.chapter_code,
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
    // composite(복합서술형): 산출물·보고서 양식은 노출. rubric(채점 기준)은 컨닝 방지를 위해 숨김
    artifacts: q.question_type === 'composite' ? q.artifacts : null,
    // composite/shortessay: 작성 양식 노출(rubric 채점기준은 컨닝 방지로 숨김)
    report_template: (q.question_type === 'composite' || q.question_type === 'shortessay') ? q.report_template : null,
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
