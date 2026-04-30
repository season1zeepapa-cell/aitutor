"""transformers (PyTorch native) 엔진 — FastAPI 안에서 직접 import (REBUILD26 §2.1 #8)

특징:
    - HuggingFace transformers + torch CPU 로 추론
    - CPU 매우 느림 (데모급, 1B 모델 ~10 token/s)
    - 가장 다양한 모델 호환 (HuggingFace 모든 모델)
    - GPU 활성 시 (Phase 7-2) 동일 코드로 자동 GPU 사용

주의:
    - 첫 호출 시 모델 다운로드 + 메모리 로드 (큰 모델은 OOM 가능)
    - chat template 은 tokenizer.apply_chat_template 으로 자동 처리
"""
import time
import asyncio

from .catalog import resolve_model

# 모델 캐시 (model_key → (model, tokenizer))
_loaded: dict = {}
_lock = asyncio.Lock()


def _load_model(model_key: str):
    """transformers 모델 + tokenizer 동기 로드."""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    info = resolve_model(model_key, "transformers")
    repo = info["hf_repo"]

    tokenizer = AutoTokenizer.from_pretrained(repo, trust_remote_code=True)
    # CPU 한정: float32 가 안전 (bf16/fp16 일부 op 지원 안 됨)
    # GPU (Phase 7-2) 활성 시 auto-detect 로 dtype/device 자동
    device_map = "auto" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForCausalLM.from_pretrained(
        repo,
        torch_dtype=dtype,
        device_map=device_map,
        trust_remote_code=True,
        low_cpu_mem_usage=True,
    )
    model.eval()
    return model, tokenizer


async def _ensure_loaded(model_key: str):
    async with _lock:
        if model_key not in _loaded:
            loop = asyncio.get_running_loop()
            _loaded[model_key] = await loop.run_in_executor(None, _load_model, model_key)
        return _loaded[model_key]


def _generate_sync(model_key: str, messages: list, max_tokens: int, temperature: float) -> str:
    """동기 generation."""
    import torch

    model, tokenizer = _loaded[model_key]
    # tokenizer 의 chat template 사용 (Qwen2.5 등 표준 모델 지원)
    inputs = tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():
        output = model.generate(
            inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )

    # 입력 부분 제외 후 디코드
    new_tokens = output[0][inputs.shape[1]:]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


async def infer(*, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """transformers 추론 (lazy 로드 + executor 에서 동기 generation)."""
    await _ensure_loaded(model_key)
    t0 = time.time()
    loop = asyncio.get_running_loop()
    answer = await loop.run_in_executor(None, _generate_sync, model_key, messages, max_tokens, temperature)
    return {
        "answer": answer,
        "infer_ms": int((time.time() - t0) * 1000),
    }
