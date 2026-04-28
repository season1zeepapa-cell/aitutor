"""FastAPI 진입점 — Lambda Web Adapter 가 Function URL 트래픽 forward (REBUILD21)
- POST /infer : SSE 스트리밍 추론
- GET  /ping  : 헬스체크 (LWA readiness)
"""
import os
import json
import time
import asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from auth import verify_auth
from rate_limit import check_rate_limit, log_usage
from inference import GenerativeInferenceEngine

MODEL_KEY = os.environ.get('MODEL_KEY', 'qwen35-4b')
MODEL_PATH = os.environ.get('MODEL_PATH', '/var/task/model')

app = FastAPI(title=f'aitutor-inference-{MODEL_KEY}')

# 엔진 lazy 로드 (콜드 스타트 단축)
_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = GenerativeInferenceEngine(MODEL_PATH, MODEL_KEY)
    return _engine


def sse_line(obj) -> str:
    return f'data: {json.dumps(obj, ensure_ascii=False)}\n\n'


def estimate_cost(latency_ms: int) -> float:
    # Lambda 메모리·시간 비용 추정 (메모리 10GB 기준 $0.000167/sec)
    return (latency_ms / 1000.0) * 0.000167


@app.get('/ping')
def ping():
    return {'ok': True, 'model': MODEL_KEY}


@app.post('/infer')
async def infer(request: Request):
    t0 = time.time()

    # 1. Auth
    auth = verify_auth(request)
    if not auth:
        return JSONResponse({'error': 'unauthorized'}, status_code=401)

    # 2. Rate Limit
    try:
        limit = check_rate_limit(auth.get('uid'), MODEL_KEY)
    except Exception as e:
        return StreamingResponse(
            iter([sse_line({'error': 'rate_limit_check_failed', 'message': str(e)})]),
            media_type='text/event-stream',
        )
    if limit.get('exceeded'):
        return StreamingResponse(
            iter([sse_line({'error': 'rate_limit_exceeded', **limit})]),
            media_type='text/event-stream',
        )

    # 3. 요청 파싱
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({'error': 'invalid_body'}, status_code=400)

    question = body.get('question')
    if not question or not question.get('body'):
        return JSONResponse({'error': 'missing_question'}, status_code=400)

    max_new_tokens = int(body.get('maxTokens', 512))
    temperature = float(body.get('temperature', 0.3))

    # 4. 스트리밍 응답
    async def stream():
        # 메타 이벤트
        yield sse_line({
            'type': 'meta',
            'model': MODEL_KEY,
            'rate_limit': {
                'user_used': limit.get('user_used'), 'user_limit': limit.get('user_limit'),
                'model_used': limit.get('model_used'), 'model_limit': limit.get('model_limit'),
            },
        })

        output_tokens = 0
        try:
            engine = get_engine()
            for token in engine.generate(question, max_new_tokens=max_new_tokens, temperature=temperature):
                output_tokens += 1
                yield sse_line({'type': 'token', 'token': token})
                # 비동기 yield 양보 (uvicorn 가 chunk flush)
                await asyncio.sleep(0)
            latency_ms = int((time.time() - t0) * 1000)
            yield sse_line({
                'type': 'done',
                'latency_ms': latency_ms,
                'output_tokens': output_tokens,
            })
            # usage-log (fire and forget)
            try:
                log_usage(
                    user_id=auth.get('uid'),
                    provider=f'local-{MODEL_KEY}',
                    model=MODEL_KEY,
                    action='card_explain_server',
                    latency_ms=latency_ms,
                    output_tokens=output_tokens,
                    estimated_cost=estimate_cost(latency_ms),
                    question_id=question.get('id'),
                )
            except Exception as e:
                print(f'[log_usage] 실패 (무시): {e}')
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f'[infer] error: {e}\n{tb}', flush=True)
            yield sse_line({'error': 'inference_failed', 'message': str(e), 'traceback': tb[:2000]})

    return StreamingResponse(
        stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )
