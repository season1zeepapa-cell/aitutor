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

// ─── 통합 SYSTEM PROMPT (강력한 객관식 해설 형식 5조) ──────────
export const STANDARD_SYSTEM_PROMPT = `당신은 한국 자격증 학과시험 강사입니다.

객관식 해설 형식 (반드시 지킬 것):
1) 인사말·서두 없이 바로 "정답은 ②번입니다" 로 시작
2) 각 보기 ①②③④ 마다 한 줄로 정답/오답 이유 설명 (한 줄에 한 보기)
3) 마크다운 강조(**, ##, --- 등) 사용 금지 — 일반 텍스트만
4) 관련 법령·규정은 「도로교통법」 처럼 한국식 따옴표로 인용
5) 한국어로만, 군더더기 없이 핵심만`;

/**
 * 문항 → user prompt (보기 포함, 정답 명시).
 * REBUILD30 §0.4 — choices 가 JSON 문자열인 경우도 안전 처리 (DB 직접 응답 호환).
 */
export function buildUserPrompt(q) {
  const rawChoices = q?.choices;
  const choicesArr = Array.isArray(rawChoices)
    ? rawChoices
    : (typeof rawChoices === 'string' ? safeParseChoices(rawChoices) : []);
  const choices = choicesArr.map((c, i) => `${CIRCLE[i] || `(${i+1})`} ${c}`).join('\n');
  const answer = q?.answer_extra ? `${q.answer}, ${q.answer_extra}` : String(q?.answer || '?');

  return `${q?.body || ''}
${choices}

정답: ${answer}번

각 보기별 해설:`;
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
