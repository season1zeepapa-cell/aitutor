// KISA 드릴 — 결정론 채점 서버측 구현
// FEATURE_SPEC.md §6.1 알고리즘을 그대로 구현.
//
// auto_score = verdictPoints(20) + linePoints(20) + rationalePoints(30) + fixPoints(30)
//   verdictPoints   = 20 if verdict_yn == model_answer.verdict else 0
//   linePoints      = 20 * |cited ∩ vulnerable| / |vulnerable|
//   rationalePoints = 30 * hits(rationale_text, rationale_keywords) / len(rationale_keywords)
//   fixPoints       = 30 * hits(fix_text+fix_code, fix_keywords)    / len(fix_keywords)
//
// hits 판정: 대소문자 무시 + 공백/전각반각 정규화 + synonyms 배열 하나라도 포함 시 1 카운트

/** 텍스트 정규화 (공백/대소문자/전각반각 통일) */
function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')             // 연속 공백 단일화
    .replace(/[　]/g, ' ')        // 전각 공백 → 반각 공백
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 전각 ASCII → 반각
    .trim();
}

/** 키워드 하나가 텍스트에 포함되는지 (원형 또는 synonyms 지원) */
function keywordHit(text, keyword) {
  const normText = normalizeText(text);
  // keyword는 문자열이거나 { base, synonyms: [...] } 객체
  const candidates = typeof keyword === 'string'
    ? [keyword]
    : [keyword.base, ...(keyword.synonyms || [])];
  return candidates.some(kw => {
    if (!kw) return false;
    return normText.includes(normalizeText(kw));
  });
}

/** 키워드 배열에서 몇 개가 텍스트에 포함되어 있는지 */
function countHits(text, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { hits: 0, total: 0, matched: [] };
  }
  const matched = keywords.filter(kw => keywordHit(text, kw));
  return { hits: matched.length, total: keywords.length, matched };
}

/** 취약 라인 지목 점수 — 교집합 / 정답 라인 수 */
function computeLinePoints(cited, vulnerable) {
  if (!Array.isArray(vulnerable) || vulnerable.length === 0) return 20;
  if (!Array.isArray(cited) || cited.length === 0) return 0;
  const vset = new Set(vulnerable);
  const inter = cited.filter(l => vset.has(l));
  return Math.round(20 * inter.length / vulnerable.length);
}

/**
 * diagnosis4 문항 자동 채점
 * @param {object} question   — kisa_questions row
 * @param {object} attempt    — { verdict_yn, cited_lines, rationale_text, fix_text, fix_code }
 * @returns {{ autoScore, breakdown, keywordHits }}
 */
function scoreDiagnosis4(question, attempt) {
  const modelAnswer = question.model_answer || {};
  const expectedVerdict = modelAnswer.verdict;

  // 1) 취약 여부 (20점)
  const verdictPoints = (typeof expectedVerdict === 'boolean' && attempt.verdict_yn === expectedVerdict) ? 20 : 0;

  // 2) 취약 라인 (20점)
  const linePoints = computeLinePoints(attempt.cited_lines, question.vulnerable_lines);

  // 3) 근거 서술 (30점)
  const rationaleHits = countHits(attempt.rationale_text || '', question.rationale_keywords || []);
  const rationalePoints = rationaleHits.total > 0
    ? Math.round(30 * rationaleHits.hits / rationaleHits.total)
    : 30;

  // 4) 수정 방안 (30점) — 서술과 코드 둘 다 확인
  const fixCombined = `${attempt.fix_text || ''} ${attempt.fix_code || ''}`;
  const fixHits = countHits(fixCombined, question.fix_keywords || []);
  const fixPoints = fixHits.total > 0
    ? Math.round(30 * fixHits.hits / fixHits.total)
    : 30;

  const autoScore = Math.min(100, Math.max(0, verdictPoints + linePoints + rationalePoints + fixPoints));

  return {
    autoScore,
    breakdown: {
      verdictPoints,
      linePoints,
      rationalePoints,
      fixPoints,
    },
    keywordHits: {
      rationale: { matched: rationaleHits.matched, hits: rationaleHits.hits, total: rationaleHits.total },
      fix: { matched: fixHits.matched, hits: fixHits.hits, total: fixHits.total },
    },
  };
}

/**
 * mcq 문항 채점 — 정답과 일치하면 100, 아니면 0
 */
function scoreMcq(question, attempt) {
  const correct = typeof attempt.mcq_selected === 'number'
    && attempt.mcq_selected === question.answer_index;
  return {
    autoScore: correct ? 100 : 0,
    breakdown: { mcqCorrect: correct },
    keywordHits: null,
  };
}

/**
 * 단답형(blank) 문항 채점
 *   blank_answers: [{idx, answers:[...], synonyms:[...]}]
 *   attempt.blank_answers_user: [{idx, text}]
 *
 * 정답 판정: normalizeText 후 사용자 입력이 answers/synonyms 중 어느 하나와 '완전 일치'
 *   (부분 포함 아님 — 단답형 특성상 정확한 단어 기입이 목적)
 */
function scoreBlank(question, attempt) {
  const blanks = Array.isArray(question.blank_answers) ? question.blank_answers : [];
  const userList = Array.isArray(attempt.blank_answers_user) ? attempt.blank_answers_user : [];
  const userMap = new Map();
  for (const b of userList) {
    if (b && typeof b.idx !== 'undefined') userMap.set(String(b.idx), b.text || '');
  }

  let correct = 0;
  const detail = [];
  for (const blank of blanks) {
    const userText = userMap.get(String(blank.idx)) || '';
    const normUser = normalizeText(userText);
    const candidates = [...(blank.answers || []), ...(blank.synonyms || [])].filter(Boolean);
    const ok = normUser.length > 0
      && candidates.some(c => normalizeText(c) === normUser);
    if (ok) correct++;
    detail.push({
      idx: blank.idx,
      ok,
      user: userText,
      expected: blank.answers || [],  // 채점 후 모범답안 공개
    });
  }

  const total = blanks.length;
  const autoScore = total === 0 ? 0 : Math.round((correct / total) * 100);

  return {
    autoScore,
    breakdown: {
      blankCorrect: correct,
      blankTotal: total,
    },
    keywordHits: null,
    blankDetail: detail,
  };
}

/** 통합 채점 함수 — question_type에 따라 위임 */
function scoreAttempt(question, attempt) {
  if (question.question_type === 'mcq') return scoreMcq(question, attempt);
  if (question.question_type === 'diagnosis4') return scoreDiagnosis4(question, attempt);
  if (question.question_type === 'blank') return scoreBlank(question, attempt);
  throw new Error(`Unknown question_type: ${question.question_type}`);
}

module.exports = {
  scoreAttempt,
  scoreDiagnosis4,
  scoreMcq,
  scoreBlank,
  // 내부 유틸 (테스트용)
  normalizeText,
  keywordHit,
  countHits,
  computeLinePoints,
};
