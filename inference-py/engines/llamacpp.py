"""llama-cpp-python 엔진 — daemon 호출 (REBUILD26 §2.1 #3)

이 모듈은 같은 컨테이너 안에서 백그라운드로 돌아가는 llama-cpp-python OpenAI 호환
daemon 에 HTTP 로 요청을 보낸다.

daemon 시작:
    python -m llama_cpp.server --host 127.0.0.1 --port 11437 --model <gguf_path>

문제:
    llama-cpp-python server 는 시작 시 단일 모델 만 로드한다.
    모델 변경 시 daemon 재시작 필요 → 본 구현은 model_key 변경 시 reload.

성능:
    GGUF Q4_K_M 양자화 + Python FFI overhead ~1~3% (네이티브 llama-server 와 거의 동등)
"""
import os
import time
import asyncio
import httpx
from huggingface_hub import hf_hub_download

from .catalog import resolve_model

LLAMACPP_PORT = int(os.environ.get("LLAMACPP_PORT", 11437))
LLAMACPP_URL = f"http://127.0.0.1:{LLAMACPP_PORT}"

# 현재 daemon 이 로드한 모델 (None = 미시작)
_current_model_key: str | None = None
_daemon_proc: asyncio.subprocess.Process | None = None
_lock = asyncio.Lock()


async def _ensure_daemon(model_key: str) -> None:
    """daemon 이 원하는 모델로 살아있도록 보장 (없거나 다른 모델이면 reload)."""
    global _current_model_key, _daemon_proc
    async with _lock:
        if _current_model_key == model_key and _daemon_proc and _daemon_proc.returncode is None:
            return  # 이미 원하는 모델 로드 + 살아있음

        # 기존 daemon 종료
        if _daemon_proc and _daemon_proc.returncode is None:
            _daemon_proc.terminate()
            try:
                await asyncio.wait_for(_daemon_proc.wait(), timeout=10)
            except asyncio.TimeoutError:
                _daemon_proc.kill()
                await _daemon_proc.wait()

        # GGUF 다운로드 (HF Hub 캐시 사용 — ~/.cache/huggingface)
        info = resolve_model(model_key, "llama-cpp-python")
        gguf_path = hf_hub_download(repo_id=info["hf_repo"], filename=info["filename"])

        # daemon 시작
        _daemon_proc = await asyncio.create_subprocess_exec(
            "python", "-m", "llama_cpp.server",
            "--host", "127.0.0.1",
            "--port", str(LLAMACPP_PORT),
            "--model", gguf_path,
            "--n_ctx", "4096",
            "--n_threads", str(os.cpu_count() or 4),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

        # 헬스체크 (최대 60초 대기)
        async with httpx.AsyncClient() as client:
            for _ in range(60):
                try:
                    r = await client.get(f"{LLAMACPP_URL}/v1/models", timeout=2.0)
                    if r.status_code == 200:
                        break
                except (httpx.ConnectError, httpx.ReadTimeout):
                    pass
                await asyncio.sleep(1)
            else:
                raise RuntimeError(f"llama-cpp-python daemon 헬스체크 실패 (60s 초과)")

        _current_model_key = model_key


async def infer(*, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """llama-cpp-python OpenAI 호환 daemon 호출.

    Returns:
        {"answer": str, "infer_ms": int}
    """
    await _ensure_daemon(model_key)

    t0 = time.time()
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"{LLAMACPP_URL}/v1/chat/completions",
            json={
                "model": model_key,  # daemon 이 로드한 단일 모델 — 이름은 무시됨
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False,
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"llama-cpp-python HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    return {
        "answer": data["choices"][0]["message"]["content"],
        "infer_ms": int((time.time() - t0) * 1000),
    }



def unload_all():
    """REBUILD30 §21 — daemon kill + 모델 unload."""
    global _current_model_key, _daemon_proc
    if _daemon_proc and _daemon_proc.returncode is None:
        _daemon_proc.terminate()
        try:
            _daemon_proc.wait(timeout=2)
        except Exception:
            _daemon_proc.kill()
    _daemon_proc = None
    _current_model_key = None
