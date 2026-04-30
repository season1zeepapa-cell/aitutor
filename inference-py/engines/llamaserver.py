"""llama-server (C++ binary) 엔진 — Phase 7-2b active (REBUILD28 §11 / REBUILD29 §6).

특징:
    - llama.cpp 의 native C++ 서버 (가장 빠른 GGUF 추론)
    - OpenAI 호환 API (llama-cpp-python 과 동일 엔드포인트)
    - lazy spawn — 첫 호출 시 _daemon.ensure_llama_server 가 process 띄움

격리 service 가 일심동체 image 재사용이라 binary 가 이미 image 안에 있음:
    /usr/local/bin/llama-server (CUDA 89 컴파일됨)
"""
import time
import logging
import httpx

from .catalog import resolve_model
from . import _daemon

log = logging.getLogger("aitutor-inference.llamaserver")


async def infer(*, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """llama-server OpenAI 호환 API 호출 (lazy spawn 자동)."""
    info = resolve_model(model_key, "llama-cpp-python")  # GGUF 매핑 재사용 (repo + filename)

    # lazy spawn / 모델 변경 시 respawn
    port = await _daemon.ensure_llama_server(
        ollama_model_tag=model_key,
        gguf_repo=info["hf_repo"],
        gguf_filename=info["filename"],
    )

    t0 = time.time()
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"http://127.0.0.1:{port}/v1/chat/completions",
            json={
                "model": info["filename"],
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"llama-server HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    return {
        "answer": data["choices"][0]["message"]["content"],
        "infer_ms": int((time.time() - t0) * 1000),
    }
