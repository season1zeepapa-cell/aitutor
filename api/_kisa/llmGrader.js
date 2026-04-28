// KISA LLM 보조 채점 — Gemini/OpenAI/Claude 제공자 내부 호출 래퍼
// FEATURE_SPEC §6.2 프롬프트 규격:
//   출력: {"score": int, "strengths": string[], "weaknesses": string[], "missing_keywords": string[]}
//
// 2026-04-25 리팩토링 (REBUILD16): api/_llm/* 공통 fetch 헬퍼 사용으로 단순화.
// 헬퍼들이 환경변수(GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY)·타임아웃·에러 표준화를 처리.

const SYSTEM_PROMPT = `너는 KISA 소프트웨어 보안약점 진단원 이수시험 채점관이다.
아래 [모범답안]과 [응시자답안]을 비교하여 0~100점을 매기고 JSON으로만 응답하라.
채점 기준:
  ① 취약여부 정확성 20점
  ② 라인 지목 정확성 20점
  ③ 근거의 기술적 타당성 30점
  ④ 수정방안의 구체성 30점
필수 키워드 누락은 감점. 과한 서술은 감점하지 않음.
반드시 다음 JSON만 출력 (앞뒤 설명/코드블록 금지):
{"score": <int 0-100>, "strengths": [string...], "weaknesses": [string...], "missing_keywords": [string...]}`;

/** 응답 문자열에서 JSON 블록만 추출 (Claude/OpenAI가 가끔 ```json ... ``` 감싸는 경우 대응) */
function extractJson(text) {
  if (!text) return null;
  const s = text.trim();
  // 1) 순수 JSON 시도
  try { return JSON.parse(s); } catch {}
  // 2) ```json ... ``` 래퍼 제거
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  // 3) 첫 { ... 마지막 } 범위 추출
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(s.slice(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

/** 결과 검증 + 스키마 강제 */
function normalizeGradeResult(parsed) {
  const score = Math.max(0, Math.min(100, parseInt(parsed?.score, 10) || 0));
  return {
    score,
    strengths: Array.isArray(parsed?.strengths) ? parsed.strengths.slice(0, 10).map(String) : [],
    weaknesses: Array.isArray(parsed?.weaknesses) ? parsed.weaknesses.slice(0, 10).map(String) : [],
    missing_keywords: Array.isArray(parsed?.missing_keywords) ? parsed.missing_keywords.slice(0, 20).map(String) : [],
  };
}

/** 사용자 답안 블록 포맷 (프롬프트에 삽입) */
function buildUserPrompt(question, attempt) {
  const modelAnswer = question.model_answer || {};
  return `[문제]
${question.body}

[취약 코드]
${question.vulnerable_code || '(없음)'}

[모범답안]
- 취약 여부: ${modelAnswer.verdict ? '취약(Y)' : '안전(N)'}
- 취약 라인: ${Array.isArray(question.vulnerable_lines) ? question.vulnerable_lines.join(', ') : '없음'}
- 근거: ${modelAnswer.rationale || ''}
- 수정 방안: ${modelAnswer.fix_description || ''}
- 근거 필수 키워드: ${(question.rationale_keywords || []).join(', ')}
- 수정 필수 키워드: ${(question.fix_keywords || []).join(', ')}

[응시자답안]
- 취약 여부: ${attempt.verdict_yn === true ? '취약(Y)' : attempt.verdict_yn === false ? '안전(N)' : '(미응답)'}
- 취약 라인: ${Array.isArray(attempt.cited_lines) ? attempt.cited_lines.join(', ') : '(없음)'}
- 근거 서술: ${attempt.rationale_text || '(미작성)'}
- 수정 방안: ${[attempt.fix_text, attempt.fix_code].filter(Boolean).join('\n') || '(미작성)'}

위 기준에 따라 채점하고 JSON으로만 응답하라.`;
}

// 공통 fetch 헬퍼들 — _llm/* 모듈 (REBUILD16 §8)
const anthropic = require('../_llm/anthropic');
const openaiChat = require('../_llm/openai-chat');
const gemini = require('../_llm/gemini');

// ----------------------------------------------------------------------------
// Provider 1: Gemini
// ----------------------------------------------------------------------------
async function gradeWithGemini(question, attempt, { timeoutMs = 20000, userId } = {}) {
  const userPrompt = buildUserPrompt(question, attempt);
  const { text } = await gemini.chat({
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 1024,
    timeout: timeoutMs,
    userId,
    action: 'kisa_grade',
    questionId: question?.id,
  });
  const parsed = extractJson(text);
  if (!parsed) throw new Error('Gemini 응답을 JSON으로 파싱할 수 없음');
  return normalizeGradeResult(parsed);
}

// ----------------------------------------------------------------------------
// Provider 2: OpenAI
// ----------------------------------------------------------------------------
async function gradeWithOpenAI(question, attempt, { timeoutMs = 20000, userId } = {}) {
  const userPrompt = buildUserPrompt(question, attempt);
  const { text } = await openaiChat.chat({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 1024,
    timeout: timeoutMs,
    userId,
    action: 'kisa_grade',
    questionId: question?.id,
  });
  const parsed = extractJson(text);
  if (!parsed) throw new Error('OpenAI 응답을 JSON으로 파싱할 수 없음');
  return normalizeGradeResult(parsed);
}

// ----------------------------------------------------------------------------
// Provider 3: Claude
// ----------------------------------------------------------------------------
async function gradeWithClaude(question, attempt, { timeoutMs = 20000, userId } = {}) {
  const userPrompt = buildUserPrompt(question, attempt);
  const { text } = await anthropic.chat({
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.3,
    maxTokens: 1024,
    timeout: timeoutMs,
    userId,
    action: 'kisa_grade',
    questionId: question?.id,
  });
  const parsed = extractJson(text);
  if (!parsed) throw new Error('Claude 응답을 JSON으로 파싱할 수 없음');
  return normalizeGradeResult(parsed);
}

// ----------------------------------------------------------------------------
// 통합 진입점
// ----------------------------------------------------------------------------
const GRADERS = {
  gemini: gradeWithGemini,
  openai: gradeWithOpenAI,
  claude: gradeWithClaude,
};

/**
 * LLM 보조 채점 수행
 * @param {string} provider — 'gemini' | 'openai' | 'claude' (기본 gemini)
 * @param {object} question
 * @param {object} attempt
 * @returns {Promise<{score, strengths, weaknesses, missing_keywords}>}
 */
async function gradeWithLlm(provider, question, attempt) {
  const fn = GRADERS[provider] || GRADERS.gemini;
  return await fn(question, attempt);
}

module.exports = {
  gradeWithLlm,
  // 개별 export (테스트/폴백용)
  gradeWithGemini,
  gradeWithOpenAI,
  gradeWithClaude,
  extractJson,
  normalizeGradeResult,
};
