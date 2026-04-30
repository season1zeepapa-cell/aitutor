"""격리 추론 service — 모델 + 엔진 카탈로그 (REBUILD26 §2 / REBUILD28 §0.2 / REBUILD29 §24)

일심동체 (workspace/aitutor/api/local-infer.js) 와 동일한 model_key 를 사용해
양쪽 비교가 가능하도록 한다 (REBUILD24 §6.2 비교 모드).

엔진별 실제 모델 이름은 다름 (Ollama 태그 vs HuggingFace repo vs ONNX repo).

REBUILD28 (2026-04-30) — 6 엔진으로 범위 축소. SGLang / TensorRT-LLM 은
AI TutorTwo 사용 패턴(단발 호출 / 동시 1~2 / 모델 교체 빈번) 과 강점 미스매치로 deferred,
placeholder 완전 제거. 미래 부활 시 별도 의사결정.

REBUILD29 §24 (2026-04-30) — local-ai 와 동일 모델 시리즈 통일:
    Qwen 3.5 (2B/4B) + Gemma 4 (E2B/E4B) = 4 모델 × 6 엔진.
"""

# ─── 엔진 카탈로그 (REBUILD26 §2.1, REBUILD28 §0.3) ──────────
# status:
#   active  — 즉시 호출 가능
#   planned — 코드 골격만 있고, Phase 7-2b/c 에서 활성화
#
# port:
#   None    — FastAPI 안에서 직접 import 호출 (별도 daemon 없음)
#   숫자    — 같은 컨테이너 내부 daemon (localhost:port 로 fetch)
ENGINES = {
    # Phase 7-1 active (CPU)
    "llama-cpp-python":  {"label": "llama-cpp-python",  "status": "active",  "port": 11437, "gpu_required": False},
    "onnxruntime-genai": {"label": "onnxruntime-genai", "status": "active",  "port": None,  "gpu_required": False},
    "transformers":      {"label": "transformers",      "status": "active",  "port": None,  "gpu_required": False},

    # Phase 7-2a active (GPU quota 승인 완료 2026-04-29)
    "ollama":       {"label": "Ollama",       "status": "active",  "port": 11434, "gpu_required": False},
    # Phase 7-2b/c active (REBUILD29 — 격리 service 단독 GPU, lazy spawn 패턴)
    "llama-server": {"label": "llama-server", "status": "active",  "port": 11435, "gpu_required": False},
    "vllm":         {"label": "vLLM",         "status": "active",  "port": 11436, "gpu_required": True},
}

# ─── 모델 카탈로그 (REBUILD29 §24 — local-ai 와 동일 시리즈 통일) ─────
# 일심동체 MODEL_MAP (api/local-infer.js) 의 키와 동일.
# 비교 가능: 3 lab (local-ai / 일심동체 / 격리) × 4 모델 × 6 엔진
MODEL_MAP = {
    "qwen35-2b": {
        "name":   "Qwen 3.5 2B",
        "org":    "Alibaba",
        "size":   "~1.6GB",
        "note":   "경량 / 한국어 강",
        "engines": {
            "llama-cpp-python":  {"hf_repo": "unsloth/Qwen3.5-2B-GGUF", "filename": "Qwen3.5-2B-Instruct-Q4_K_M.gguf"},
            "onnxruntime-genai": {"hf_repo": "onnx-community/Qwen3.5-2B-ONNX", "subfolder": "cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4"},
            "transformers":      {"hf_repo": "Qwen/Qwen3.5-2B-Instruct"},
            "ollama":             "qwen3.5:2b",
        },
    },
    "qwen35-4b": {
        "name":   "Qwen 3.5 4B",
        "org":    "Alibaba",
        "size":   "~2.5GB",
        "note":   "균형 / 한국어 강 / 추천",
        "engines": {
            "llama-cpp-python":  {"hf_repo": "unsloth/Qwen3.5-4B-GGUF", "filename": "Qwen3.5-4B-Instruct-Q4_K_M.gguf"},
            "onnxruntime-genai": {"hf_repo": "onnx-community/Qwen3.5-4B-ONNX-OPT", "subfolder": "cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4"},
            "transformers":      {"hf_repo": "Qwen/Qwen3.5-4B-Instruct"},
            "ollama":             "qwen3.5:4b",
        },
    },
    "gemma4-e2b": {
        "name":   "Gemma 4 E2B",
        "org":    "Google",
        "size":   "~3.2GB",
        "note":   "효율적 멀티모달 / 128K context",
        "engines": {
            "llama-cpp-python":  {"hf_repo": "unsloth/gemma-4-E2B-it-GGUF", "filename": "gemma-4-E2B-it-Q4_K_M.gguf"},
            "onnxruntime-genai": {"hf_repo": "onnx-community/gemma-4-E2B-it-ONNX"},
            "transformers":      {"hf_repo": "google/gemma-4-E2B-it"},
            "ollama":             "gemma4:e2b",
        },
    },
    "gemma4-e4b": {
        "name":   "Gemma 4 E4B",
        "org":    "Google",
        "size":   "~4.9GB",
        "note":   "Gemma 패밀리 / 안정 / 멀티모달",
        "engines": {
            "llama-cpp-python":  {"hf_repo": "unsloth/gemma-4-E4B-it-GGUF", "filename": "gemma-4-E4B-it-Q4_K_M.gguf"},
            "onnxruntime-genai": {"hf_repo": "onnx-community/gemma-4-E4B-it-ONNX"},
            "transformers":      {"hf_repo": "google/gemma-4-E4B-it"},
            "ollama":             "gemma4:e4b",
        },
    },
}

DEFAULT_MODEL_KEY = "qwen35-4b"
DEFAULT_ENGINE = "llama-cpp-python"  # 격리 service 의 기본은 llama-cpp-python (CPU 가장 안정)


def list_engines():
    """엔진 카탈로그 직렬화 (UI 표시용)."""
    return [{"key": key, **meta} for key, meta in ENGINES.items()]


def list_models():
    """모델 카탈로그 직렬화 (engines 필드는 키 목록만 노출)."""
    return [
        {
            "key": key,
            "name": meta["name"],
            "org": meta["org"],
            "size": meta["size"],
            "note": meta["note"],
            "available_engines": list(meta["engines"].keys()),
        }
        for key, meta in MODEL_MAP.items()
    ]


def resolve_model(model_key: str, engine: str):
    """model_key + engine 조합으로 실제 모델 식별자 반환.

    Returns:
        dict: 엔진별 식별자 (engine 별 스키마 다름)
    Raises:
        KeyError: model_key 또는 engine 매핑 없음
    """
    meta = MODEL_MAP.get(model_key)
    if not meta:
        raise KeyError(f"unknown model_key: {model_key}")
    engine_meta = meta["engines"].get(engine)
    if not engine_meta:
        raise KeyError(f"engine '{engine}' has no mapping for model '{model_key}'")
    return engine_meta
