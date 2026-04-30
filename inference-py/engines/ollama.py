"""Ollama 엔진 placeholder — Phase 7-2 active 예정.

활성 시 작업:
    1. start.sh 에 `ollama serve > /tmp/ollama.log 2>&1 &` 추가 (port 11434)
    2. Dockerfile 에 `RUN curl -fsSL https://ollama.com/install.sh | sh` 추가
    3. catalog.ENGINES['ollama'].status = 'active'
    4. engines/__init__.py _DISPATCH 에 등록
    5. 본 파일 infer() 구현 (이미 일심동체 api/local-infer.js 와 동일 호출 패턴)
"""
import os
import time
import httpx

from .catalog import resolve_model

OLLAMA_PORT = int(os.environ.get("OLLAMA_PORT", 11434))
OLLAMA_URL = f"http://127.0.0.1:{OLLAMA_PORT}"


async def infer(*, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """Ollama /api/chat 호출 (Phase 7-2 active 시 사용)."""
    ollama_model = resolve_model(model_key, "ollama")
    t0 = time.time()
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": ollama_model,
                "messages": messages,
                "stream": False,
                "options": {"num_predict": max_tokens, "temperature": temperature},
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"Ollama HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    return {
        "answer": data.get("message", {}).get("content", ""),
        "infer_ms": int((time.time() - t0) * 1000),
    }
