"""격리 추론 service — FastAPI 라우터 (REBUILD26 §3.2)

엔드포인트:
    GET  /healthz         — Cloud Run liveness (즉시 응답)
    GET  /readyz          — daemon 헬스체크 포함 (active 엔진 ping)
    GET  /infer/models    — 모델 + 엔진 카탈로그 조회
    POST /infer           — 추론 호출 (engine + model_key + messages)

인증:
    Cloud Run --no-allow-unauthenticated + IAM (메인 service SA → invoker)
    개발 시 INTERNAL_TOKEN 환경변수 설정 → X-Internal-Token 헤더 검증.
"""
import os
import time
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engines import (
    dispatch,
    ENGINES,
    DEFAULT_ENGINE,
    DEFAULT_MODEL_KEY,
    list_engines,
    list_models,
)

# ─── 로깅 설정 ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("aitutor-inference")

# ─── FastAPI 앱 ────────────────────────────────────────────
app = FastAPI(
    title="AI TutorTwo — 격리 추론 service",
    description="REBUILD26 §3.2 / REBUILD28 §0.2 — 6 엔진 동거 격리 service (4 active, 2 planned)",
    version="0.2.0",
)

# 메인 service (workspace/aitutor) 에서만 호출되지만, 디버깅 편의를 위해 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

INTERNAL_TOKEN = os.environ.get("INTERNAL_TOKEN")  # 미설정 시 인증 생략


def _check_token(token: Optional[str]):
    """INTERNAL_TOKEN 환경변수가 설정된 경우만 검증."""
    if INTERNAL_TOKEN and token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="invalid_internal_token")


# ─── 요청 / 응답 스키마 ────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str


class InferRequest(BaseModel):
    engine:      str = Field(default=DEFAULT_ENGINE,     description="엔진 키 (catalog 참조)")
    model_key:   str = Field(default=DEFAULT_MODEL_KEY,  description="모델 키 (qwen3-4b 등)")
    messages:    list[Message]
    max_tokens:  int = Field(default=512, ge=1, le=8192)
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)


class InferResponse(BaseModel):
    answer: str
    meta: dict


# ─── 엔드포인트 ────────────────────────────────────────────
@app.get("/healthz")
async def healthz():
    """Cloud Run liveness probe — 즉시 200 OK 반환."""
    return {"ok": True, "service": "aitutor-inference"}


@app.get("/readyz")
async def readyz():
    """Readiness probe — active 엔진들이 호출 가능 상태인지 확인.

    구현 단순화: active 엔진 목록만 반환. daemon 헬스 ping 은 cold start 방해 가능.
    """
    active = [k for k, m in ENGINES.items() if m["status"] == "active"]
    return {"ok": True, "active_engines": active}


@app.get("/infer/models")
async def get_models(x_internal_token: Optional[str] = Header(default=None)):
    """모델 + 엔진 카탈로그 조회 (UI 표시용)."""
    _check_token(x_internal_token)
    return {
        "default_engine": DEFAULT_ENGINE,
        "default_model":  DEFAULT_MODEL_KEY,
        "engines": list_engines(),
        "models":  list_models(),
    }


@app.post("/infer", response_model=InferResponse)
async def post_infer(req: InferRequest, x_internal_token: Optional[str] = Header(default=None)):
    """8 엔진 통합 추론 진입점.

    body 예시:
        {
          "engine": "llama-cpp-python",
          "model_key": "qwen3-1.7b",
          "messages": [{"role": "user", "content": "안녕"}],
          "max_tokens": 256,
          "temperature": 0.3
        }
    """
    _check_token(x_internal_token)

    t_total = time.time()
    try:
        result = await dispatch(
            engine=req.engine,
            model_key=req.model_key,
            messages=[m.model_dump() for m in req.messages],
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
    except RuntimeError as e:
        msg = str(e)
        if msg.startswith("engine_not_ready"):
            raise HTTPException(status_code=503, detail={"error": "engine_not_ready", "message": msg})
        log.exception("infer failed")
        raise HTTPException(status_code=500, detail={"error": "infer_failed", "message": msg})
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": str(e)})
    except Exception as e:
        log.exception("infer unexpected error")
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})

    total_ms = int((time.time() - t_total) * 1000)
    return InferResponse(
        answer=result["answer"],
        meta={
            "engine":     req.engine,
            "model_key":  req.model_key,
            "infer_ms":   result.get("infer_ms", total_ms),
            "total_ms":   total_ms,
        },
    )


# ─── uvicorn 직접 실행 (start.sh 가 호출) ──────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
