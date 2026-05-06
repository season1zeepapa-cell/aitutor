// 자격증 시험 해설 프롬프트 통합 빌더 (REBUILD29 §22 — 사용자 결정 2026-04-30)
//
// 모든 lab 공통 사용. 단순 1줄 system prompt 가 약해서 "문제 echo" 사례 → 강력한
// 객관식 해설 형식 5조 명시 (LocalAiExplanation/prompts.js 패턴 차용).
//
// 사용:
//   import { buildLabMessages } from '../../lib/lab/promptBuilder';
//   const messages = buildLabMessages(question);
//   // → [{role:'system'}, {role:'user'}]

const CIRCLE = ['①','②','③','④','⑤'];

// ─── 통합 SYSTEM PROMPT (REBUILD32 §X — 간결한 시스템 + 항목별 충실 해설) ──
//   기존: "한 줄에 한 보기" + "군더더기 없이 핵심만" → 해설 너무 짧고 학습 가치 ↓
//   개선: 시스템 프롬프트는 간결 유지, 출력은 항목별 2~3줄 + 법령 인용 + 핵심 정리
export const STANDARD_SYSTEM_PROMPT = `당신은 한국 자격증 학과시험 강사입니다. 학생이 시험 후 복기하며 정확히 이해하도록 충실한 해설을 작성합니다.

출력 형식:
1) 첫 줄: "정답은 ②번입니다" (인사말·서두 금지)
2) 정답 보기: 왜 옳은지 2~3줄 — 근거 법령·규정·원리 인용
3) 오답 보기 각각: 2줄 이상 — 잘못된 부분 + 올바른 내용 대비 제시
4) 마지막 "핵심 정리:" 1~2줄 — 시험 빈출 포인트 요약

규칙:
- 한국어만, 마크다운 강조(**, ##) 금지
- 법령·규정은 「도로교통법」 처럼 한국식 따옴표
- 보기별 해설은 새 줄로 시작 (예: "① ...")
- 충실하되 장황하지 않게. 한 보기당 1줄 단답 금지 (반드시 2줄 이상)`;

/**
 * 문항 → user prompt (보기 포함, 정답 명시).
 * REBUILD30 §0.4 — choices 가 JSON 문자열인 경우도 안전 처리 (DB 직접 응답 호환).
 * REBUILD30 §17 — choices 항목이 {num,text} 객체인 경우 text 만 추출.
 */
export function buildUserPrompt(q) {
  const rawChoices = q?.choices;
  const choicesArr = Array.isArray(rawChoices)
    ? rawChoices
    : (typeof rawChoices === 'string' ? safeParseChoices(rawChoices) : []);
  const choices = choicesArr.map((c, i) => {
    const txt = (c && typeof c === 'object') ? (c.text ?? c.num ?? '') : c;
    return `${CIRCLE[i] || `(${i+1})`} ${txt}`;
  }).join('\n');
  const answer = q?.answer_extra ? `${q.answer}, ${q.answer_extra}` : String(q?.answer || '?');

  return `${q?.body || ''}
${choices}

정답: ${answer}번

위 형식에 따라 정답·오답 보기를 모두 충실히 해설하고, 마지막에 핵심 정리를 작성하세요.`;
}

function safeParseChoices(s) {
  try { return JSON.parse(s) || []; } catch { return []; }
}

/**
 * 통합 messages 빌더 — system + user.
 * Qwen 한국어 강제 / no_think 는 호출처에서 applyQwenStrict 추가.
 *
 * @param {object} question - { body, choices, answer, answer_extra }
 * @param {object} opts - { systemOverride?: string }  사용자 정의 system 가능
 * @returns {Array<{role, content}>}
 */
export function buildLabMessages(question, opts = {}) {
  const system = opts.systemOverride || STANDARD_SYSTEM_PROMPT;
  return [
    { role: 'system', content: system },
    { role: 'user',   content: buildUserPrompt(question) },
  ];
}

// REBUILD30 §0.4 — 미리보기 prompt 단일 문자열 (system + user 합본)
// 실제 전송과 정합 보장 위해 buildLabMessages 출력을 그대로 합쳐서 반환.
// REBUILD29 이전: 3 lab 에 동일 함수가 27줄씩 중복 정의되었고, 미리보기 내용이
// 실제 전송 prompt 와 달랐던 semantic bug 가 있었음.
export function buildPromptPreview(question, opts = {}) {
  const messages = buildLabMessages(question, opts);
  return messages
    .map(m => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join('\n\n');
}
