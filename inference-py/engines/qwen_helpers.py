"""Qwen 모델 호출 헬퍼 (REBUILD29 §13 / §16 — 사용자 결정 2026-04-30).

AI TutorTwo 실험실 전체 공통:
    1) thinking 모드 강제 비활성 (reasoning trace 안 나오게)
    2) 한국어 강제 (Qwen 4B 영어 답변 방지 — system + user + assistant seed)

모든 엔진(Ollama/llama-server/vLLM/llama-cpp-python/onnx/transformers) 통과 시 적용.
"""
import re

QWEN_REGEX = re.compile(r"^qwen", re.IGNORECASE)

KOREAN_FORCE_SYSTEM = "\n\n⚠ CRITICAL: 반드시 한국어로만 답변하세요. 영어 사용 금지. 모든 응답은 한국어로 작성합니다."
KOREAN_FORCE_USER   = "\n\n⚠ 반드시 한국어(Korean)로만 답변하세요. English 사용 금지."
KOREAN_ASSISTANT_SEED = "네, 한국어로 답변드리겠습니다.\n\n"


def is_qwen_model(model_key_or_id: str | None) -> bool:
    if not model_key_or_id:
        return False
    return bool(QWEN_REGEX.match(str(model_key_or_id)))


def apply_qwen_no_think(messages: list, model_key_or_id: str | None) -> list:
    """마지막 user 메시지에 `/no_think` 토큰 추가."""
    if not messages or not is_qwen_model(model_key_or_id):
        return messages

    result = list(messages)
    for i in range(len(result) - 1, -1, -1):
        m = result[i]
        if isinstance(m, dict) and m.get("role") == "user":
            content = str(m.get("content", ""))
            if re.search(r"/no_think\b", content):
                return result
            result[i] = {**m, "content": content + "\n\n/no_think"}
            return result
    return result


def apply_qwen_korean_lock(messages: list, model_key_or_id: str | None) -> list:
    """한국어 강제 3중 패턴 — system + user + assistant seed."""
    if not messages or not is_qwen_model(model_key_or_id):
        return messages

    result = list(messages)

    # 1) system 메시지에 koreanForce 추가 (없으면 신규)
    if result and result[0].get("role") == "system":
        sys = str(result[0].get("content", ""))
        if "CRITICAL: 반드시 한국어" not in sys:
            result[0] = {**result[0], "content": sys + KOREAN_FORCE_SYSTEM}
    else:
        result.insert(0, {
            "role": "system",
            "content": "당신은 한국어 자격증 시험 전문 강사입니다." + KOREAN_FORCE_SYSTEM,
        })

    # 2) 마지막 user 메시지에 userTail
    for i in range(len(result) - 1, -1, -1):
        m = result[i]
        if isinstance(m, dict) and m.get("role") == "user":
            content = str(m.get("content", ""))
            if "한국어(Korean)로만" not in content:
                result[i] = {**m, "content": content + KOREAN_FORCE_USER}
            break

    # 3) assistant seed
    last = result[-1] if result else None
    if not last or last.get("role") != "assistant" or KOREAN_ASSISTANT_SEED not in str(last.get("content", "")):
        result.append({"role": "assistant", "content": KOREAN_ASSISTANT_SEED})

    return result


def apply_qwen_strict(messages: list, model_key_or_id: str | None) -> list:
    """한국어 + no_think 모두 적용."""
    return apply_qwen_korean_lock(apply_qwen_no_think(messages, model_key_or_id), model_key_or_id)
