// KISA 드릴 — 클라이언트 미리보기 채점 (서버 결정론 채점과 동일 로직)
// 사용자가 "힌트: 키워드 2/3 포함" 같은 실시간 피드백을 받을 수 있도록
// 서버와 동일한 hits/countHits 로직을 재현한다.
// (서버의 api/_kisa/scorer.js와 동기화 필요 — 변경 시 양쪽 다 수정)

function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[　]/g, ' ')
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .trim();
}

export function keywordHit(text, keyword) {
  const normText = normalizeText(text);
  const candidates = typeof keyword === 'string'
    ? [keyword]
    : [keyword?.base, ...(keyword?.synonyms || [])];
  return candidates.some(kw => kw && normText.includes(normalizeText(kw)));
}

export function countHits(text, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { hits: 0, total: 0 };
  }
  let hits = 0;
  for (const kw of keywords) {
    if (keywordHit(text, kw)) hits++;
  }
  return { hits, total: keywords.length };
}

// 실시간 힌트: "키워드 N/M 포함" 문구 생성
// 실제 키워드 값은 노출하지 않고 개수만 표시
export function keywordHintText(text, keywordCount) {
  // keywordCount는 kisa-drill API가 반환한 rationale_keyword_count/fix_keyword_count
  if (!keywordCount || keywordCount === 0) return '';
  // 실제 키워드를 모르기 때문에 텍스트가 비어있지 않으면 "작성 중" 힌트만 표시
  if (!text || !text.trim()) return `필수 키워드 0 / ${keywordCount} 포함 — 아직 작성 전`;
  return `필수 키워드 개수: ${keywordCount} — 제출 후 매칭 결과 공개`;
}

// ============================================================================
// 단답형(blank) 채점
//   - blankAnswers: [{idx, answers:[...], synonyms:[...]}]
//   - userBlanks:   [{idx, text}]
//   - 반환: { score (0~100), correct, total, detail:[{idx, ok, expected}] }
// ============================================================================
export function gradeBlank(blankAnswers, userBlanks) {
  if (!Array.isArray(blankAnswers) || blankAnswers.length === 0) {
    return { score: 0, correct: 0, total: 0, detail: [] };
  }
  const userMap = new Map();
  (userBlanks || []).forEach(b => {
    if (b && typeof b.idx !== 'undefined') userMap.set(String(b.idx), b.text || '');
  });

  let correct = 0;
  const detail = [];
  for (const blank of blankAnswers) {
    const idx = blank.idx;
    const userText = userMap.get(String(idx)) || '';
    const candidates = [...(blank.answers || []), ...(blank.synonyms || [])].filter(Boolean);
    const ok = candidates.length > 0
      && candidates.some(c => normalizeText(userText) === normalizeText(c));
    if (ok) correct++;
    detail.push({
      idx,
      ok,
      user: userText,
      // 정답은 제출 전에는 노출하지 않음. 서버 응답에서만 공개.
    });
  }
  const total = blankAnswers.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { score, correct, total, detail };
}
