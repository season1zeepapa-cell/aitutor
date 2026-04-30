"""격리 service — daemon 관리 헬퍼 (REBUILD28 §5.2 / REBUILD29 §6).

llama-server / vLLM 같은 lazy-spawn daemon 을 관리.
같은 GPU L4 24GB 를 여러 daemon 이 공유 → 한 번에 한 모델만 active (재spawn 패턴).

일심동체 (workspace/aitutor/api/local-infer.js) 의 동일 패턴을 Python 으로 포팅.
"""
import os
import time
import asyncio
import subprocess
import logging
import httpx
from pathlib import Path

log = logging.getLogger("aitutor-inference.daemon")

# 같은 컨테이너 (격리 service = 일심동체 image 재사용) 안 모든 daemon 의 메타
_DAEMONS: dict = {
    "llama-server": {"proc": None, "model": None, "port": 11435, "endpoint": "/v1/models", "start_timeout_s": 60},
    "vllm":         {"proc": None, "model": None, "port": 11436, "endpoint": "/v1/models", "start_timeout_s": 600},
}


async def _wait_health(port: int, endpoint: str, timeout_s: int):
    """daemon /v1/models 가 200 OK 응답할 때까지 polling."""
    url = f"http://127.0.0.1:{port}{endpoint}"
    async with httpx.AsyncClient(timeout=2.0) as client:
        for i in range(timeout_s):
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    return
            except Exception:
                pass
            await asyncio.sleep(1)
    raise RuntimeError(f"daemon 헬스체크 타임아웃 ({timeout_s}s, {url})")


async def kill_daemon(key: str):
    """daemon 종료 — 다른 모델 spawn 전 호출."""
    d = _DAEMONS[key]
    proc = d["proc"]
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
    d["proc"] = None
    d["model"] = None


async def ensure_llama_server(*, ollama_model_tag: str, gguf_repo: str, gguf_filename: str) -> int:
    """llama-server lazy spawn — 같은 모델이면 재사용.

    Returns:
        port (int)
    """
    d = _DAEMONS["llama-server"]
    if d["proc"] and d["proc"].poll() is None and d["model"] == ollama_model_tag:
        return d["port"]
    await kill_daemon("llama-server")

    # GGUF 모델 캐시 (HF Hub 직접 다운)
    cache_dir = Path(os.environ.get("HF_HOME", "/var/cache/huggingface")) / "llama-cpp"
    cache_dir.mkdir(parents=True, exist_ok=True)
    model_path = cache_dir / gguf_filename
    if not model_path.exists():
        url = f"https://huggingface.co/{gguf_repo}/resolve/main/{gguf_filename}"
        log.info(f"[daemon] GGUF 다운로드 시작: {url} → {model_path}")
        t0 = time.time()
        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                total = 0
                with open(model_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=1 << 20):
                        f.write(chunk)
                        total += len(chunk)
        log.info(f"[daemon] GGUF 다운로드 완료 ({int((time.time()-t0)*1000)}ms, {total} bytes)")

    log.info(f"[daemon] llama-server spawn: {model_path}")
    d["proc"] = subprocess.Popen(
        [
            "/usr/local/bin/llama-server",
            "--host", "127.0.0.1",
            "--port", str(d["port"]),
            "--model", str(model_path),
            "-ngl", "99",
            "--ctx-size", "4096",
            "--no-warmup",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    await _wait_health(d["port"], d["endpoint"], d["start_timeout_s"])
    d["model"] = ollama_model_tag
    return d["port"]


async def ensure_vllm(*, ollama_model_tag: str, hf_repo: str) -> int:
    """vLLM lazy spawn — 같은 모델이면 재사용.

    Returns:
        port (int)
    """
    d = _DAEMONS["vllm"]
    if d["proc"] and d["proc"].poll() is None and d["model"] == ollama_model_tag:
        return d["port"]
    await kill_daemon("vllm")

    log.info(f"[daemon] vLLM spawn: {hf_repo}")
    env = os.environ.copy()
    env.setdefault("HF_HOME", "/var/cache/huggingface")
    d["proc"] = subprocess.Popen(
        [
            "/opt/venv-vllm/bin/python", "-m", "vllm.entrypoints.openai.api_server",
            "--host", "127.0.0.1",
            "--port", str(d["port"]),
            "--model", hf_repo,
            "--max-model-len", "4096",
            "--gpu-memory-utilization", "0.7",  # 격리 service GPU 단독이라 일심동체보다 높게
            "--enforce-eager",
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    await _wait_health(d["port"], d["endpoint"], d["start_timeout_s"])
    d["model"] = ollama_model_tag
    return d["port"]
