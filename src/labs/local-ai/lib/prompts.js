// 자격증 학과시험 해설 프롬프트 — 객관식 보기별 해설 강제 (컴팩트 튜닝)
//
// 설계 의도:
//   - 소형 모델(0.8B/2B)이 긴 instruction 못 따라가므로 system 짧게
//   - 객관식의 핵심은 "왜 이게 맞고 나머지는 왜 틀렸는가" → 보기별 설명 강제
//   - USER 끝의 cue ("각 보기별 해설:") 로 출력 구조 유도

const SYSTEM_PROMPT = `당신은 한국 자격증 학과시험 강사입니다.

객관식 해설 형식 (반드시 지킬 것):
1) 인사말·서두 없이 바로 "정답은 ②번입니다" 로 시작
2) 각 보기 ①②③④ 마다 한 줄로 정답/오답 이유 설명 (한 줄에 한 보기)
3) 마크다운 강조(**, ##, --- 등) 사용 금지 — 일반 텍스트만
4) 관련 법령·규정은 「도로교통법」 처럼 한국식 따옴표로 인용
5) 한국어로만, 군더더기 없이 핵심만`;

/**
 * @param {object} q - { body, choices: string[], answer: number, answer_extra?: number }
 */
export function buildExplanationPrompt(q) {
  const choiceMarks = ['①','②','③','④','⑤'];
  const choices = (q.choices || []).map((c, i) => `${choiceMarks[i] || `(${i+1})`} ${c}`).join('\n');
  const answerStr = q.answer_extra ? `${q.answer}, ${q.answer_extra}` : String(q.answer);

  return `${q.body}
${choices}

정답: ${answerStr}번

각 보기별 해설:`;
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
