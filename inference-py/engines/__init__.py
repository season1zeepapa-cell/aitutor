"""격리 추론 service — 엔진 디스패처 (REBUILD26 §3.2 / REBUILD28 §0.2)

6 엔진 카탈로그 + 단일 진입점 dispatch().
status='active' 인 엔진만 실제 호출 가능, 'planned' 은 503 응답.

REBUILD28 (2026-04-30) — SGLang / TensorRT-LLM 은 사용 패턴 미스매치로 deferred 처리,
placeholder 코드 완전 제거. 미래 부활 필요 시 별도 의사결정 거쳐 재도입.
"""
from .catalog import ENGINES, MODEL_MAP, DEFAULT_ENGINE, DEFAULT_MODEL_KEY, list_engines, list_models
from .qwen_helpers import apply_qwen_no_think, apply_qwen_strict

# active 엔진 import
from . import llamacpp
from . import onnx
from . import transformers_engine

# Phase 7-2a active — Ollama daemon 은 start.sh isolated+GPU 분기에서 spawn
from . import ollama as _ollama_engine        # noqa: F401
# Phase 7-2b/c active (REBUILD29 — lazy subprocess spawn, _daemon.py 가 GPU 자원 관리)
from . import llamaserver as _llamaserver_engine  # noqa: F401
from . import vllm_engine as _vllm_engine     # noqa: F401


# 엔진 키 → 추론 함수 매핑
_DISPATCH = {
    "llama-cpp-python":  llamacpp.infer,
    "onnxruntime-genai": onnx.infer,
    "transformers":      transformers_engine.infer,
    "ollama":            _ollama_engine.infer,
    "llama-server":      _llamaserver_engine.infer,
    "vllm":              _vllm_engine.infer,
}


async def dispatch(*, engine: str, model_key: str, messages: list, max_tokens: int, temperature: float) -> dict:
    """단일 진입점 — 엔진별 infer() 함수로 라우팅.

    Returns:
        {"answer": str, "infer_ms": int}
    Raises:
        ValueError: 알 수 없는 engine
        RuntimeError: planned 엔진 호출 (Phase 7-2b/c 미활성)
    """
    meta = ENGINES.get(engine)
    if not meta:
        raise ValueError(f"unknown engine: {engine}")
    if meta["status"] != "active":
        raise RuntimeError(f"engine_not_ready: {engine} (Phase 7-2 에서 활성화 예정)")

    fn = _DISPATCH.get(engine)
    if not fn:
        raise RuntimeError(f"engine '{engine}' is marked active but has no dispatcher")

    # REBUILD29 §13 / §16 — Qwen 한국어 강제 + thinking 비활성 (모든 엔진 공통)
    final_messages = apply_qwen_strict(messages, model_key)

    return await fn(model_key=model_key, messages=final_messages, max_tokens=max_tokens, temperature=temperature)


__all__ = [
    "dispatch",
    "ENGINES",
    "MODEL_MAP",
    "DEFAULT_ENGINE",
    "DEFAULT_MODEL_KEY",
    "list_engines",
    "list_models",
]
