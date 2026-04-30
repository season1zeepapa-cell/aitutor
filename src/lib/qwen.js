// Qwen 모델 호출 헬퍼 (REBUILD29 §13 / §16 — 사용자 결정 2026-04-30)
//
// AI TutorTwo 실험실 전체 공통:
//   1) thinking 모드 강제 비활성 (reasoning trace 안 나오게)
//   2) 한국어 강제 (Qwen 4B 가 영어로 답하는 사례 방지)
//
// 사용:
//   import { applyQwenStrict, isQwenModel } from '../../lib/qwen';
//   const finalMessages = applyQwenStrict(messages, modelKey);  // 한국어 + no_think 모두

const QWEN_REGEX = /^qwen/i;

const KOREAN_FORCE_SYSTEM = '\n\n⚠ CRITICAL: 반드시 한국어로만 답변하세요. 영어 사용 금지. 모든 응답은 한국어로 작성합니다.';
const KOREAN_FORCE_USER   = '\n\n⚠ 반드시 한국어(Korean)로만 답변하세요. English 사용 금지.';
const KOREAN_ASSISTANT_SEED = '네, 한국어로 답변드리겠습니다.\n\n';

export function isQwenModel(modelKeyOrId) {
  if (!modelKeyOrId) return false;
  return QWEN_REGEX.test(String(modelKeyOrId));
}

/** 마지막 user 메시지에 `/no_think` 토큰 추가. */
export function applyQwenNoThink(messages, modelKeyOrId) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  if (!isQwenModel(modelKeyOrId)) return messages;

  const result = [...messages];
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i]?.role === 'user') {
      const content = String(result[i].content || '');
      if (/\/no_think\b/.test(content)) return result;
      result[i] = { ...result[i], content: content + '\n\n/no_think' };
      return result;
    }
  }
  return result;
}

/** 한국어 강제 3중 패턴 (system + user + assistant seed). */
export function applyQwenKoreanLock(messages, modelKeyOrId) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  if (!isQwenModel(modelKeyOrId)) return messages;

  const result = [...messages];

  // 1) system 메시지에 koreanForce 추가
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

  // 2) 마지막 user 메시지에 userTail
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i]?.role === 'user') {
      const content = String(result[i].content || '');
      if (!content.includes('한국어(Korean)로만')) {
        result[i] = { ...result[i], content: content + KOREAN_FORCE_USER };
      }
      break;
    }
  }

  // 3) assistant seed
  const last = result[result.length - 1];
  if (last?.role !== 'assistant' || !String(last.content || '').includes(KOREAN_ASSISTANT_SEED)) {
    result.push({ role: 'assistant', content: KOREAN_ASSISTANT_SEED });
  }

  return result;
}

/** 한국어 + no_think 모두 적용 (자격증 해설 lab 의 표준 호출). */
export function applyQwenStrict(messages, modelKeyOrId) {
  return applyQwenKoreanLock(applyQwenNoThink(messages, modelKeyOrId), modelKeyOrId);
}
