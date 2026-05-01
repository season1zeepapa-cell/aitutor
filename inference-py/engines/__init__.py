"""격리 추론 service — 엔진 디스패처 (REBUILD26 §3.2 / REBUILD28 §0.2 / REBUILD30 §21)

6 엔진 카탈로그 + 단일 진입점 dispatch().
status='active' 인 엔진만 실제 호출 가능, 'planned' 은 503 응답.

REBUILD28 (2026-04-30) — SGLang / TensorRT-LLM deferred, placeholder 제거.
REBUILD30 §21 (2026-05-01) — Lazy import 적용. PyTorch / transformers /
   llama-cpp-python / onnxruntime 등 무거운 의존성을 startup 시 import 안 하고
   호출 시점에 import (cache). 결과: startup 메모리 ~2-4 GiB 절감 → OOM 빈도 ↓.
"""
from .catalog import ENGINES, MODEL_MAP, DEFAULT_ENGINE, DEFAULT_MODEL_KEY, list_engines, list_models
from .qwen_helpers import apply_qwen_no_think, apply_qwen_strict

# Ollama / llama-server / vLLM 은 외부 daemon HTTP wrapper 라 가벼움 → 즉시 import OK
from . import ollama as _ollama_engine
from . import llamaserver as _llamaserver_engine
from . import vllm_engine as _vllm_engine


# REBUILD30 §21 — Lazy import: 호출 시점에 module 로드. 같은 엔진 두 번째 호출은 cache hit.
_engine_cache = {}

def _get_lazy(name):
    """호출 시점에 무거운 엔진 모듈을 import. 같은 엔진 재호출 시 캐시 사용.

    transformers_engine: PyTorch + transformers (~2 GiB 메모리)
    llamacpp:            llama-cpp-python (CUDA wheel)
    onnx:                onnxruntime-genai
    """
    if name in _engine_cache:
        return _engine_cache[name]
    if name == "transformers":
        from . import transformers_engine as m
    elif name == "llama-cpp-python":
        from . import llamacpp as m
    elif name == "onnxruntime-genai":
        from . import onnx as m
    else:
        raise ValueError(f"_get_lazy: unknown engine {name}")
    _engine_cache[name] = m
    return m


# 엔진 키 → infer 함수 (immediate 엔진은 직접, lazy 엔진은 wrapper)
_DISPATCH = {
    "ollama":            _ollama_engine.infer,
    "llama-server":      _llamaserver_engine.infer,
    "vllm":              _vllm_engine.infer,
    # lazy 3종 — 호출 시점에 module load
    "llama-cpp-python":  lambda **kw: _get_lazy("llama-cpp-python").infer(**kw),
    "onnxruntime-genai": lambda **kw: _get_lazy("onnxruntime-genai").infer(**kw),
    "transformers":      lambda **kw: _get_lazy("transformers").infer(**kw),
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


def cleanup_all():
    """REBUILD30 §21 — 메모리 정리. 모든 lazy 엔진의 model unload + GPU cache 비우기.

    UI "🧹 메모리 정리" 버튼 또는 cross-engine cleanup 시 호출.
    """
    import gc
    result = {"unloaded": [], "errors": []}
    for name, mod in _engine_cache.items():
        try:
            if hasattr(mod, "unload_all"):
                mod.unload_all()
                result["unloaded"].append(name)
        except Exception as e:
            result["errors"].append(f"{name}: {e}")
    gc.collect()
    # PyTorch CUDA cache 비우기 (transformers 사용 시)
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            result["cuda_cache_cleared"] = True
    except ImportError:
        pass
    return result


__all__ = [
    "dispatch",
    "cleanup_all",
    "ENGINES",
    "MODEL_MAP",
    "DEFAULT_ENGINE",
    "DEFAULT_MODEL_KEY",
    "list_engines",
    "list_models",
]
