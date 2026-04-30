"""vLLM 엔진 — Phase 7-2c active (REBUILD28 §11 / REBUILD29 §6).

특징:
    - 2026 산업 표준 (continuous batching, PagedAttention, GPU 최강)
    - GPU 필수 (격리 service 의 GPU L4 단독)
    - lazy spawn — 첫 호출 시 _daemon.ensure_vllm 가 process 띄움 (cold start 30~60초)

격리 service 가 일심동체 image 재사용이라 vLLM venv 가 이미 image 안에 있음:
    /opt/venv-vllm/bin/python -m vllm.entrypoints.openai.api_server

REBUILD28 P0 fix:
    transformers==4.46.3 + huggingface-hub==0.25.2 명시 잠금 (vllm 0.6.5 의 lockstep 보장)
"""
import time
import logging
import httpx

from .catalog import resolve_model
from . import _daemon

log = logging.getLogger("aitutor-inference.vllm")


async def infer(*, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """vLLM OpenAI 호환 API 호출 (lazy spawn 자동)."""
    info = resolve_model(model_key, "transformers")  # HF repo 매핑 재사용

    # lazy spawn / 모델 변경 시 respawn (cold start 30~60s 예상)
    port = await _daemon.ensure_vllm(
        ollama_model_tag=model_key,
        hf_repo=info["hf_repo"],
    )

    t0 = time.time()
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"http://127.0.0.1:{port}/v1/chat/completions",
            json={
                "model": info["hf_repo"],
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
                # REBUILD29 §13 — Qwen 모델 thinking 비활성 (이중 안전망, dispatch 에서도 처리됨)
                "chat_template_kwargs": {"enable_thinking": False},
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"vLLM HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    return {
        "answer": data["choices"][0]["message"]["content"],
        "infer_ms": int((time.time() - t0) * 1000),
    }
