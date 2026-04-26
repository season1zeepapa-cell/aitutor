// 자격증 학과시험 해설 프롬프트 — Transformers.js messages 형식

const SYSTEM_PROMPT = `당신은 한국 자격증 학과시험 전문 강사입니다. 운전면허, 영상정보관리사, KISA 정보보호 진단원 등 다양한 시험을 가르칩니다.

# 역할
학습자가 보기 중 정답을 맞히지 못했거나 왜 정답인지 모를 때, 핵심 근거와 함께 한국어로 해설합니다.

# 답변 원칙
1. 한국어로 답합니다.
2. 정답을 먼저 명시합니다 — "정답은 ②번입니다."
3. 관련 법령·규정·이론을 「도로교통법」 처럼 한국식 따옴표로 인용합니다.
4. 핵심 근거 1~2가지를 짚습니다 — 조항 번호·핵심 키워드 위주.
5. 헷갈리기 쉬운 오답이 있으면 한 줄로 보충합니다 (선택).
6. 친근한 학원 강사 어투를 유지하되 군더더기는 줄입니다.

# 답변 형식 (2~4문장)
- 1문장: 정답 명시 + 핵심 근거
- 2~3문장: 조항·원리·예시
- (선택) 마지막 1문장: 헷갈리는 오답 짚기

# 예시
정답은 ②번입니다. 「도로교통법」 시행령 제48조에 따르면 연습운전면허의 유효기간은 받은 날부터 1년이며, 그 안에 도로주행시험에 합격해 정식 면허로 전환해야 합니다. ①번 6개월은 임시운전증명서 기간과 혼동하기 쉬운 함정 보기입니다.`;

/**
 * @param {object} q - { body, choices: string[], answer: number, answer_extra?: number }
 */
export function buildExplanationPrompt(q) {
  const choiceMarks = ['①','②','③','④','⑤'];
  const choices = (q.choices || []).map((c, i) => `${choiceMarks[i] || `(${i+1})`} ${c}`).join('\n');
  const answerStr = q.answer_extra ? `${q.answer}, ${q.answer_extra}` : String(q.answer);

  return `[문제]
${q.body}

[보기]
${choices}

[정답] ${answerStr}번

위 문제의 해설을 작성해 주세요.`;
}

/** processor.apply_chat_template 에 전달할 messages 배열 */
export function buildMessages(q) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: buildExplanationPrompt(q) },
  ];
}

/** UI "🔍 최종 입력 프롬프트 보기" 토글용 — chat template 적용 전 raw 형식 */
export function buildSinglePrompt(q) {
  const messages = buildMessages(q);
  return messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
}
