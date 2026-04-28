// KISA 드릴 — 답안 제출 + 자동 채점 + SRS 업데이트
// POST /api/kisa-attempt
//   body: {
//     question_id: uuid,
//     mode: 'drill'|'exam'|'review',
//     exam_session_id?: uuid,     // mode='exam'일 때만
//     mcq_selected?: int,         // MCQ 응시 답
//     verdict_yn?: boolean,
//     cited_lines?: int[],
//     rationale_text?: string,
//     fix_text?: string,
//     fix_code?: string,
//     self_grade?: 'again'|'hard'|'good'|'easy',  // 없으면 SRS 갱신 생략
//     time_spent_sec?: int
//   }
//
// 응답:
//   {
//     attempt_id,
//     auto_score,
//     breakdown: {...},
//     keyword_hits: {...},
//     model_answer: {...},     // 채점 완료 후 모범답안 공개
//     vulnerable_lines,
//     safe_code,
//     srs_updated?: { next_review_at, interval_days, repetitions }
//   }
//
// POST /api/kisa-attempt?action=llm-grade
//   (STEP 10에서 구현 — 현재는 미지원)
const { query } = require('./db');
const { withAuth } = require('./middleware');
const { scoreAttempt } = require('./_kisa/scorer');
const { applySrs } = require('./_kisa/srs');
const { gradeWithLlm } = require('./_kisa/llmGrader');

// LLM 보조채점 일일 호출 제한 (사용자당, FEATURE_SPEC §14)
const LLM_DAILY_LIMIT = parseInt(process.env.KISA_LLM_DAILY_LIMIT || '50', 10);

/** 오늘(KST) 사용자의 LLM 채점 호출 횟수 집계 */
async function countTodayLlmCalls(userId) {
  const result = await query(`
    SELECT count(*)::int AS cnt
    FROM kisa_diagnosis_attempts
    WHERE user_id = $1
      AND llm_score IS NOT NULL
      AND submitted_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')
  `, [userId]);
  return result.rows[0]?.cnt || 0;
}

/**
 * POST /api/kisa-attempt?action=llm-grade
 *   body: { attempt_id, provider?: 'gemini'|'openai'|'claude' }
 * 기존 attempt row를 찾아 llm_score/llm_feedback/final_score 를 갱신.
 * 재채점은 허용(덮어쓰기). 일일 50회 제한.
 */
async function handleLlmGrade(req, res) {
  const userId = req.user?.uid;
  const { attempt_id, provider = 'gemini' } = req.body || {};

  if (!attempt_id) {
    return res.status(400).json({ error: 'attempt_id가 필요합니다.' });
  }
  if (!['gemini', 'openai', 'claude'].includes(provider)) {
    return res.status(400).json({ error: `지원하지 않는 provider: ${provider}` });
  }

  // 1) Rate Limit 확인
  const todayCount = await countTodayLlmCalls(userId);
  if (todayCount >= LLM_DAILY_LIMIT) {
    return res.status(429).json({
      error: `오늘 LLM 채점 한도를 초과했습니다 (${LLM_DAILY_LIMIT}회). 내일 다시 이용해주세요.`,
      limit: LLM_DAILY_LIMIT,
      used: todayCount,
    });
  }

  // 2) Attempt + Question 조회
  const attemptRes = await query(`
    SELECT a.*, q.model_answer, q.vulnerable_lines, q.vulnerable_code, q.body AS q_body,
           q.rationale_keywords, q.fix_keywords, q.question_type
    FROM kisa_diagnosis_attempts a
    INNER JOIN kisa_questions q ON q.id = a.question_id
    WHERE a.id = $1 AND a.user_id = $2
  `, [attempt_id, userId]);

  if (attemptRes.rows.length === 0) {
    return res.status(404).json({ error: 'attempt를 찾을 수 없습니다.' });
  }
  const row = attemptRes.rows[0];

  if (row.question_type !== 'diagnosis4') {
    return res.status(400).json({ error: 'MCQ는 LLM 채점이 불필요합니다.' });
  }

  // 3) LLM 호출
  let llmResult;
  try {
    llmResult = await gradeWithLlm(provider, {
      body: row.q_body,
      vulnerable_code: row.vulnerable_code,
      vulnerable_lines: row.vulnerable_lines,
      model_answer: row.model_answer,
      rationale_keywords: row.rationale_keywords,
      fix_keywords: row.fix_keywords,
    }, {
      verdict_yn: row.verdict_yn,
      cited_lines: row.cited_lines,
      rationale_text: row.rationale_text,
      fix_text: row.fix_text,
      fix_code: row.fix_code,
    });
  } catch (err) {
    console.error('[KisaLLM] 채점 실패:', err.message);
    return res.status(503).json({
      error: `LLM 채점 실패: ${err.message}`,
      auto_score: row.auto_score,
    });
  }

  // 4) 종합 점수 (FEATURE_SPEC §6.3): auto * 0.4 + llm * 0.6
  const finalScore = Math.round(row.auto_score * 0.4 + llmResult.score * 0.6);

  // 5) DB 업데이트
  await query(`
    UPDATE kisa_diagnosis_attempts
    SET llm_score = $1, llm_feedback = $2::jsonb, final_score = $3
    WHERE id = $4
  `, [llmResult.score, JSON.stringify({
    strengths: llmResult.strengths,
    weaknesses: llmResult.weaknesses,
    missing_keywords: llmResult.missing_keywords,
    provider,
  }), finalScore, attempt_id]);

  console.log(`[KisaLLM] user=${userId} attempt=${attempt_id} provider=${provider} llm=${llmResult.score} final=${finalScore}`);
  return res.json({
    attempt_id,
    auto_score: row.auto_score,
    llm_score: llmResult.score,
    final_score: finalScore,
    llm_feedback: {
      strengths: llmResult.strengths,
      weaknesses: llmResult.weaknesses,
      missing_keywords: llmResult.missing_keywords,
      provider,
    },
    daily_usage: { used: todayCount + 1, limit: LLM_DAILY_LIMIT },
  });
}

module.exports = withAuth(async (req, res) => {
  const action = req.query?.action;

  // 액션 기반 분기 (GET/POST 모두 허용되는 액션들)
  if (action === 'list-explanations' && req.method === 'GET') {
    return await handleListExplanations(req, res);
  }

  // 이하 액션들은 POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  if (action === 'llm-grade') {
    return await handleLlmGrade(req, res);
  }
  if (action === 'llm-explain') {
    return await handleLlmExplain(req, res);
  }
  if (action === 'delete-explanation') {
    return await handleDeleteExplanation(req, res);
  }

  const userId = req.user?.uid;
  const body = req.body || {};
  const {
    question_id,
    mode = 'drill',
    exam_session_id,
    mcq_selected,
    verdict_yn,
    cited_lines,
    rationale_text,
    fix_text,
    fix_code,
    blank_answers_user,  // blank 타입: [{idx, text}]
    self_grade,
    time_spent_sec,
  } = body;

  // 필수값 검증
  if (!question_id) {
    return res.status(400).json({ error: 'question_id가 필요합니다.' });
  }
  if (!['drill', 'exam', 'review'].includes(mode)) {
    return res.status(400).json({ error: `잘못된 mode: ${mode}` });
  }
  if (self_grade && !['again', 'hard', 'good', 'easy'].includes(self_grade)) {
    return res.status(400).json({ error: `잘못된 self_grade: ${self_grade}` });
  }

  // 1) 문항 조회 (채점에 필요한 모범답안 포함)
  const qResult = await query(
    'SELECT * FROM kisa_questions WHERE id = $1 AND is_active = TRUE LIMIT 1',
    [question_id]
  );
  if (qResult.rows.length === 0) {
    return res.status(404).json({ error: '문항을 찾을 수 없습니다.' });
  }
  const question = qResult.rows[0];

  // 2) 자동 채점 (결정론)
  const scored = scoreAttempt(question, {
    mcq_selected,
    verdict_yn,
    cited_lines: Array.isArray(cited_lines) ? cited_lines : [],
    rationale_text,
    fix_text,
    fix_code,
    blank_answers_user: Array.isArray(blank_answers_user) ? blank_answers_user : [],
  });

  // 3) attempt row 저장
  const attemptResult = await query(`
    INSERT INTO kisa_diagnosis_attempts (
      user_id, question_id, mode, exam_session_id,
      mcq_selected, verdict_yn, cited_lines,
      rationale_text, fix_text, fix_code,
      blank_answers_user,
      auto_score, keyword_hits, final_score,
      self_grade, time_spent_sec
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11::jsonb, $12, $13::jsonb, $12, $14, $15
    )
    RETURNING id, submitted_at
  `, [
    userId, question_id, mode, exam_session_id || null,
    typeof mcq_selected === 'number' ? mcq_selected : null,
    typeof verdict_yn === 'boolean' ? verdict_yn : null,
    Array.isArray(cited_lines) ? cited_lines : [],
    rationale_text || '',
    fix_text || '',
    fix_code || '',
    JSON.stringify(Array.isArray(blank_answers_user) ? blank_answers_user : []),
    scored.autoScore,
    JSON.stringify(scored.keywordHits || {}),
    self_grade || null,
    Math.max(0, Math.min(36000, Number(time_spent_sec || 0))),
  ]);
  const attemptId = attemptResult.rows[0].id;

  // 4) self_grade 있으면 SRS 큐 업데이트
  let srsUpdated = null;
  if (self_grade) {
    // 현재 review queue 상태 조회 (없으면 기본값 사용)
    const srsCurrentResult = await query(
      'SELECT ease_factor, interval_days, repetitions FROM kisa_review_queue WHERE user_id = $1 AND question_id = $2',
      [userId, question_id]
    );
    const current = srsCurrentResult.rows[0] || {};
    const next = applySrs(current, self_grade);

    // UPSERT
    await query(`
      INSERT INTO kisa_review_queue (
        user_id, question_id, ease_factor, interval_days, repetitions,
        next_review_at, last_reviewed_at, suspended
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), FALSE)
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        ease_factor = EXCLUDED.ease_factor,
        interval_days = EXCLUDED.interval_days,
        repetitions = EXCLUDED.repetitions,
        next_review_at = EXCLUDED.next_review_at,
        last_reviewed_at = EXCLUDED.last_reviewed_at
    `, [
      userId, question_id,
      next.easeFactor, next.intervalDays, next.repetitions,
      next.nextReviewAt,
    ]);

    srsUpdated = {
      next_review_at: next.nextReviewAt,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      ease_factor: next.easeFactor,
    };
  }

  // 5) 응답 — 채점 결과 + 모범답안 + 기본 해설 공개
  res.json({
    attempt_id: attemptId,
    auto_score: scored.autoScore,
    final_score: scored.autoScore, // LLM 미적용 시 동일
    breakdown: scored.breakdown,
    keyword_hits: scored.keywordHits,
    model_answer: question.model_answer,
    vulnerable_lines: question.vulnerable_lines,
    safe_code: question.safe_code,
    answer_index: question.question_type === 'mcq' ? question.answer_index : null,
    user_selected: question.question_type === 'mcq'
      ? (typeof mcq_selected === 'number' ? mcq_selected : null)
      : null,
    // blank 전용: 빈칸별 채점 디테일 + 모범답안 공개
    blank_detail: scored.blankDetail || null,
    blank_answers: question.question_type === 'blank' ? question.blank_answers : null,
    blank_template: question.question_type === 'blank' ? question.blank_template : null,
    // 기본 해설 (Claude Code 사전 작성) — 모든 문항 풀이 후 핵심 정보
    explanation: question.explanation || null,
    question: {
      chapter_code: question.chapter_code,
      weakness_code: question.weakness_code,
      weakness_name_ko: question.weakness_name_ko,
      reference: question.reference,
    },
    srs_updated: srsUpdated,
  });
});

/**
 * POST /api/kisa-attempt?action=llm-explain
 *   body: { question_id, provider?: 'gemini'|'openai'|'claude', force_new?: boolean }
 *
 * 동작:
 *   - force_new=false (기본): 해당 question+provider 조합의 저장된 해설이 있으면 SSE로 즉시 반환
 *   - force_new=true 또는 저장 없음: LLM 스트리밍 생성 + 자동 저장
 *
 * 저장 위치: kisa_question_llm_explanations 테이블
 * 재사용 기준: 사용자와 무관하게 question_id + provider로 최신 해설 반환 (영상정보관리사와 동일)
 */
async function handleLlmExplain(req, res) {
  const userId = req.user?.uid;
  const { question_id, provider = 'gemini', force_new = false } = req.body || {};

  if (!question_id) return res.status(400).json({ error: 'question_id가 필요합니다.' });
  if (!['gemini', 'openai', 'claude'].includes(provider)) {
    return res.status(400).json({ error: `지원하지 않는 provider: ${provider}` });
  }

  // SSE 헤더 공통
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const writeSseLocal = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 저장된 해설 재사용 (force_new=false일 때)
  if (!force_new) {
    const cachedRes = await query(`
      SELECT id, content, provider, model, created_at
      FROM kisa_question_llm_explanations
      WHERE question_id = $1 AND provider = $2
      ORDER BY created_at DESC LIMIT 1
    `, [question_id, provider]);
    if (cachedRes.rows.length > 0) {
      const cached = cachedRes.rows[0];
      writeSseLocal('cached', {
        id: cached.id,
        provider: cached.provider,
        model: cached.model,
        created_at: cached.created_at,
      });
      // 저장된 전체 컨텐츠를 한 번에 chunk로 전송 (클라이언트는 동일하게 처리)
      writeSseLocal('chunk', { content: cached.content });
      writeSseLocal('done', { total_length: cached.content.length, from_cache: true });
      res.end();
      return;
    }
  }

  // 문항 조회
  const qRes = await query(
    `SELECT * FROM kisa_questions WHERE id = $1 AND is_active = TRUE`,
    [question_id]
  );
  if (qRes.rows.length === 0) return res.status(404).json({ error: '문항을 찾을 수 없습니다.' });
  const q = qRes.rows[0];

  // 프롬프트 조립 (영상정보관리사 스타일 + KISA 맥락)
  const systemPrompt = `당신은 KISA 소프트웨어 보안약점 진단원 이수시험 전문 강사입니다.
아래 문제에 대해 다음 형식으로 한국어로 상세 해설을 제공하세요.

**정답**: [정답 번호 및 내용]
**핵심 개념**: [이 문항이 묻는 보안약점/설계 원칙]
**각 선택지 해설**: [선택지별로 왜 맞고 왜 틀린지]
**실무 사례**: [실제 개발/운영에서 주의할 점]
**관련 용어**: [관련된 KISA 가이드 용어/법령]`;

  let userPrompt = `[문제]\n${q.body}\n\n`;
  if (q.question_type === 'mcq' && Array.isArray(q.choices)) {
    const CIRCLE = ['①', '②', '③', '④', '⑤', '⑥'];
    userPrompt += '[선택지]\n';
    q.choices.forEach((c, i) => {
      userPrompt += `${CIRCLE[i] || (i + 1)} ${c.text || c}\n`;
    });
    userPrompt += `\n[정답] ${CIRCLE[q.answer_index] || (q.answer_index + 1)}번\n`;
  } else if (q.question_type === 'diagnosis4') {
    userPrompt += `\n[취약 코드]\n${q.vulnerable_code}\n\n`;
    userPrompt += `[취약 라인] ${q.vulnerable_lines?.join(', ') || '없음'}\n`;
    if (q.model_answer) {
      userPrompt += `[모범답안 근거] ${q.model_answer.rationale || ''}\n`;
      userPrompt += `[모범답안 수정] ${q.model_answer.fix_description || ''}\n`;
    }
  }
  userPrompt += `\n[약점 분류] ${q.weakness_name_ko} (${q.chapter_code || q.weakness_code})`;

  // SSE 헤더는 이미 위에서 설정됨
  let accumulated = '';
  const writeSse = writeSseLocal;

  try {
    if (provider === 'gemini') {
      await streamGemini(systemPrompt, userPrompt, (chunk) => {
        accumulated += chunk;
        writeSse('chunk', { content: chunk });
      });
    } else if (provider === 'openai') {
      await streamOpenAI(systemPrompt, userPrompt, (chunk) => {
        accumulated += chunk;
        writeSse('chunk', { content: chunk });
      });
    } else if (provider === 'claude') {
      await streamClaude(systemPrompt, userPrompt, (chunk) => {
        accumulated += chunk;
        writeSse('chunk', { content: chunk });
      });
    }

    // DB 저장
    if (accumulated.length > 0) {
      await query(`
        INSERT INTO kisa_question_llm_explanations
          (question_id, user_id, provider, model, content)
        VALUES ($1, $2, $3, $4, $5)
      `, [question_id, userId, provider, PROVIDER_MODELS[provider], accumulated]);
    }

    writeSse('done', { total_length: accumulated.length });
    res.end();
  } catch (err) {
    console.error('[KisaExplain] 스트리밍 실패:', err.message);
    writeSse('error', { message: err.message });
    res.end();
  }
}

// LLM provider 별 기본 모델
const PROVIDER_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-haiku-4-5-20251001',
};

// Gemini 스트리밍 (기존 api/gemini.js와 동일한 단일 contents 구조)
async function streamGemini(systemPrompt, userPrompt, onChunk) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY 미설정');

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // 기존 api/gemini.js와 동일한 단순 구조 (systemInstruction 미사용)
  const body = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    const detail = errData?.error?.message || errData?.error || `HTTP ${res.status}`;
    console.error('[Gemini] 요청 실패:', res.status, detail);
    throw new Error(`Gemini ${res.status}: ${String(detail).slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch {}
    }
  }
}

// OpenAI 스트리밍
async function streamOpenAI(systemPrompt, userPrompt, onChunk) {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY 미설정');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2048,
      stream: true,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    const detail = errData?.error?.message || `HTTP ${res.status}`;
    console.error('[OpenAI] 요청 실패:', res.status, detail);
    throw new Error(`OpenAI ${res.status}: ${String(detail).slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
      } catch {}
    }
  }
}

// Claude 스트리밍
async function streamClaude(systemPrompt, userPrompt, onChunk) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 미설정');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PROVIDER_MODELS.claude,
      max_tokens: 2048,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      stream: true,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    const detail = errData?.error?.message || errData?.message || `HTTP ${res.status}`;
    console.error('[Claude] 요청 실패:', res.status, detail);
    throw new Error(`Claude ${res.status}: ${String(detail).slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          onChunk(data.delta.text);
        }
      } catch {}
    }
  }
}

/**
 * GET /api/kisa-attempt?action=list-explanations&question_id=<uuid>
 * → 해당 문항의 저장된 LLM 해설 목록 (provider별 최신 1건)
 */
async function handleListExplanations(req, res) {
  const questionId = req.query?.question_id;
  if (!questionId) return res.status(400).json({ error: 'question_id가 필요합니다.' });

  const result = await query(`
    SELECT DISTINCT ON (provider)
      id, provider, model, created_at,
      substring(content, 1, 200) AS preview
    FROM kisa_question_llm_explanations
    WHERE question_id = $1
    ORDER BY provider, created_at DESC
  `, [questionId]);

  return res.json({ explanations: result.rows });
}

/**
 * POST /api/kisa-attempt?action=delete-explanation
 *   body: { id }
 * → 저장된 해설 삭제 (본인이 생성한 것만)
 */
async function handleDeleteExplanation(req, res) {
  const userId = req.user?.uid;
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

  const result = await query(`
    DELETE FROM kisa_question_llm_explanations
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [id, userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: '해설을 찾을 수 없거나 삭제 권한이 없습니다.' });
  }
  return res.json({ deleted: result.rows[0].id });
}
