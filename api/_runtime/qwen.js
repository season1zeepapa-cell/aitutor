// Qwen 모델 호출 헬퍼 (REBUILD29 §13 / §16 — 사용자 결정 2026-04-30)
//
// AI TutorTwo 실험실 전체 공통:
//   1) thinking 모드 강제 비활성 (reasoning trace 안 나오게)
//   2) 한국어 강제 (Qwen 4B 가 영어로 답하는 사례 → system + user + assistant seed 3중 강제)
//
// 적용 방법 (엔진 호환성):
//   A) Ollama: body.think = false + messages 의 system/user 변환 + assistant seed
//   B) OpenAI 호환 (vLLM/llama-server/WebLLM/HF): messages 변환 + chat_template_kwargs
//   C) chat_template_kwargs: { enable_thinking: false } (vLLM 표준)
//
// 본 헬퍼는 messages 변환 일괄 적용. think:false 는 호출처에서 별도 분기.

const QWEN_REGEX = /^qwen/i;

const KOREAN_FORCE_SYSTEM = '\n\n⚠ CRITICAL: 반드시 한국어로만 답변하세요. 영어 사용 금지. 모든 응답은 한국어로 작성합니다.';
const KOREAN_FORCE_USER   = '\n\n⚠ 반드시 한국어(Korean)로만 답변하세요. English 사용 금지.';
const KOREAN_ASSISTANT_SEED = '네, 한국어로 답변드리겠습니다.\n\n';

/**
 * 모델 식별자가 Qwen 계열인지 판정.
 * model_id / family / hf_repo / ollama tag 모두 'qwen' prefix 매칭.
 */
function isQwenModel(modelKeyOrId) {
  if (!modelKeyOrId) return false;
  return QWEN_REGEX.test(String(modelKeyOrId));
}

/**
 * messages 의 마지막 user 메시지에 `/no_think` 토큰 추가.
 * Qwen 이 아니면 변경 없이 반환.
 */
function applyQwenNoThink(messages, modelKeyOrId) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  if (!isQwenModel(modelKeyOrId)) return messages;

  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i]?.role === 'user') {
      const content = String(result[i].content || '');
      if (/\/no_think\b/.test(content)) return result;  // 이미 적용됨
      result[i] = { ...result[i], content: content + '\n\n/no_think' };
      return result;
    }
  }
  return result;
}

/**
 * messages 에 한국어 강제 패턴 적용 (Qwen 모델 영어 답변 방지).
 * - system 메시지에 koreanForce 추가 (없으면 신규 추가)
 * - 마지막 user 메시지에 userTail 추가
 * - 마지막에 assistant seed 추가 (가장 강력한 강제)
 *
 * Qwen 이 아니면 변경 없이 반환.
 */
function applyQwenKoreanLock(messages, modelKeyOrId) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  if (!isQwenModel(modelKeyOrId)) return messages;

  const result = [...messages];

  // 1) system 메시지에 koreanForce 추가 (없으면 신규)
  if (result[0]?.role === 'system') {
    const sys = String(result[0].content || '');
    if (!sys.includes('CRITICAL: 반드시 한국어')) {
      result[0] = { ...result[0], content: sys + KOREAN_FORCE_SYSTEM };
    }
  } else {
    result.unshift({
      role: 'system',
      content: '당신은 한국어 자격증 시험 전문 강사입니다.' + KOREAN_FORCE_SYSTEM,
    });
  }

  // 2) 마지막 user 메시지에 userTail 추가
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i]?.role === 'user') {
      const content = String(result[i].content || '');
      if (!content.includes('한국어(Korean)로만')) {
        result[i] = { ...result[i], content: content + KOREAN_FORCE_USER };
      }
      break;
    }
  }

  // 3) 마지막에 assistant seed 추가 (이미 있으면 skip)
  const last = result[result.length - 1];
  if (last?.role !== 'assistant' || !String(last.content || '').includes(KOREAN_ASSISTANT_SEED)) {
    result.push({ role: 'assistant', content: KOREAN_ASSISTANT_SEED });
  }

  return result;
}

/**
 * applyQwenNoThink + applyQwenKoreanLock 한 번에 적용 (가장 흔한 케이스).
 * 자격증 해설 lab 등 한국어 + thinking false 모두 필요할 때.
 */
function applyQwenStrict(messages, modelKeyOrId) {
  return applyQwenKoreanLock(applyQwenNoThink(messages, modelKeyOrId), modelKeyOrId);
}

module.exports = { isQwenModel, applyQwenNoThink, applyQwenKoreanLock, applyQwenStrict };
