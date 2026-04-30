"""onnxruntime-genai 엔진 — FastAPI 안에서 직접 import (REBUILD26 §2.1 #7)

특징:
    - daemon 모드 표준 없음 → FastAPI process 안에서 직접 import + 호출
    - 첫 호출 시 lazy 모델 다운로드 + 메모리 로드 (이후 재사용)
    - CPU FP16 빠름, int4 는 Issue #1098 로 느린 경우 보고됨

주의:
    - onnxruntime-genai 는 chat template 자동 적용 안 함 → tokenizer 가 직접 처리
    - generation 헬퍼 일부 제한 (system prompt 처리 모델 의존)
"""
import time
import asyncio
from huggingface_hub import snapshot_download

from .catalog import resolve_model

# 모델 로드 캐시 (model_key → (model, tokenizer, tokenizer_stream))
_loaded: dict = {}
_lock = asyncio.Lock()


def _load_model(model_key: str):
    """모델 + tokenizer 동기 로드 (executor 에서 실행)."""
    import onnxruntime_genai as og  # 첫 호출 시 import (FastAPI 시작 시간 단축)

    info = resolve_model(model_key, "onnxruntime-genai")
    repo_id = info["hf_repo"]
    subfolder = info.get("subfolder", "")

    # HF Hub 에서 모델 디렉토리 다운로드 (캐시 사용)
    model_dir = snapshot_download(
        repo_id=repo_id,
        allow_patterns=[f"{subfolder}/*"] if subfolder else None,
    )
    if subfolder:
        model_dir = f"{model_dir}/{subfolder}"

    model = og.Model(model_dir)
    tokenizer = og.Tokenizer(model)
    tokenizer_stream = tokenizer.create_stream()
    return model, tokenizer, tokenizer_stream


async def _ensure_loaded(model_key: str):
    async with _lock:
        if model_key not in _loaded:
            loop = asyncio.get_running_loop()
            _loaded[model_key] = await loop.run_in_executor(None, _load_model, model_key)
        return _loaded[model_key]


def _format_prompt(messages: list) -> str:
    """간이 chat template — Qwen 형식 (system → user → assistant 헤더)."""
    parts = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        parts.append(f"<|im_start|>{role}\n{content}<|im_end|>\n")
    parts.append("<|im_start|>assistant\n")
    return "".join(parts)


def _generate_sync(model_key: str, prompt: str, max_tokens: int, temperature: float) -> str:
    """동기 generation (executor 에서 호출)."""
    import onnxruntime_genai as og

    model, tokenizer, _ = _loaded[model_key]
    input_tokens = tokenizer.encode(prompt)

    params = og.GeneratorParams(model)
    params.set_search_options(
        max_length=len(input_tokens) + max_tokens,
        temperature=temperature,
        do_sample=temperature > 0,
    )
    params.input_ids = input_tokens

    generator = og.Generator(model, params)
    output_tokens = []
    while not generator.is_done():
        generator.compute_logits()
        generator.generate_next_token()
        new_tokens = generator.get_next_tokens()
        output_tokens.extend(new_tokens.tolist() if hasattr(new_tokens, "tolist") else list(new_tokens))

    full_output = tokenizer.decode(output_tokens)
    # input prompt 부분 제거 (모델이 echo 할 수 있음)
    if full_output.startswith(prompt):
        full_output = full_output[len(prompt):]
    return full_output.strip()


async def infer(*, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """onnxruntime-genai 추론 (lazy 로드 + 동기 generation in executor)."""
    await _ensure_loaded(model_key)
    prompt = _format_prompt(messages)
    t0 = time.time()
    loop = asyncio.get_running_loop()
    answer = await loop.run_in_executor(None, _generate_sync, model_key, prompt, max_tokens, temperature)
    return {
        "answer": answer,
        "infer_ms": int((time.time() - t0) * 1000),
    }
