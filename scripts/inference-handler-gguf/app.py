"""FastAPI + llama-cpp-python (GGUF) 추론 (REBUILD21 §17.x)
- ONNX 환경의 12단계 트러블 회피
- llama.cpp Q4_K_M 양자화 — CPU 추론 최적화
"""
import os
import json
import time
import asyncio
import glob
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse

from auth import verify_auth
from rate_limit import check_rate_limit, log_usage

MODEL_KEY = os.environ.get('MODEL_KEY', 'e2b-gguf')
MODEL_PATH = os.environ.get('MODEL_PATH', '/var/task/model')

app = FastAPI(title=f'aitutor-inference-{MODEL_KEY}')

_llm = None
_load_time_ms = None


def get_llm():
    global _llm, _load_time_ms
    if _llm is not None:
        return _llm

    from llama_cpp import Llama

    # MODEL_PATH 안의 .gguf 파일 자동 탐색
    gguf_files = glob.glob(os.path.join(MODEL_PATH, '*.gguf'))
    if not gguf_files:
        raise FileNotFoundError(f'No .gguf file in {MODEL_PATH}')
    model_file = gguf_files[0]

    t0 = time.time()
    print(f'[llm] Loading {model_file} ...', flush=True)
    _llm = Llama(
        model_path=model_file,
        n_ctx=2048,
        n_threads=max(1, (os.cpu_count() or 4)),
        n_batch=512,
        verbose=False,
        use_mlock=False,
        use_mmap=True,           # 디스크 → 메모리 mapping (메모리 절약)
    )
    _load_time_ms = int((time.time() - t0) * 1000)
    print(f'[llm] Loaded in {_load_time_ms}ms', flush=True)
    return _llm


def build_messages(question: dict) -> list:
    circles = ['①', '②', '③', '④', '⑤']
    choices = (question.get('choices') or [])
    choices_text = '\n'.join([f"{circles[i]} {c}" for i, c in enumerate(choices)])
    answer_idx = (question.get('answer') or 1) - 1
    answer_label = circles[answer_idx] if 0 <= answer_idx < len(circles) else '①'
    return [
        {'role': 'user', 'content': (
            f"자격증 시험 강사로서 한국어로 정답 해설.\n"
            f"「법령명」 인용. 보기별 한 줄 설명.\n\n"
            f"[문제]\n{question.get('body', '')}\n\n"
            f"[보기]\n{choices_text}\n\n"
            f"[정답] {answer_label}\n\n"
            f"각 보기가 왜 맞고 틀린지 한 줄씩 설명해주세요."
        )}
    ]


def sse_line(obj) -> str:
    return f'data: {json.dumps(obj, ensure_ascii=False)}\n\n'


def estimate_cost(latency_ms: int) -> float:
    return (latency_ms / 1000.0) * 0.000167


@app.get('/ping')
def ping():
    return {'ok': True, 'model': MODEL_KEY, 'format': 'gguf'}


@app.post('/infer')
async def infer(request: Request):
    t0 = time.time()

    auth = verify_auth(request)
    if not auth:
        return JSONResponse({'error': 'unauthorized'}, status_code=401)

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

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({'error': 'invalid_body'}, status_code=400)

    question = body.get('question')
    if not question or not question.get('body'):
        return JSONResponse({'error': 'missing_question'}, status_code=400)

    max_new_tokens = int(body.get('maxTokens', 512))
    temperature = float(body.get('temperature', 0.3))

    async def stream():
        yield sse_line({
            'type': 'meta',
            'model': MODEL_KEY,
            'format': 'gguf',
            'load_time_ms': _load_time_ms,
            'rate_limit': {
                'user_used': limit.get('user_used'), 'user_limit': limit.get('user_limit'),
                'model_used': limit.get('model_used'), 'model_limit': limit.get('model_limit'),
            },
        })

        output_tokens = 0
        try:
            llm = get_llm()
            messages = build_messages(question)

            # llama-cpp-python streaming 모드
            stream_iter = llm.create_chat_completion(
                messages=messages,
                max_tokens=max_new_tokens,
                temperature=temperature,
                top_p=0.95,
                stream=True,
            )

            for chunk in stream_iter:
                delta = chunk.get('choices', [{}])[0].get('delta', {}).get('content')
                if delta:
                    output_tokens += 1
                    yield sse_line({'type': 'token', 'token': delta})
                    await asyncio.sleep(0)

            latency_ms = int((time.time() - t0) * 1000)
            yield sse_line({
                'type': 'done',
                'latency_ms': latency_ms,
                'output_tokens': output_tokens,
            })
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
            except Exception: pass
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f'[infer] error: {e}\n{tb}', flush=True)
            yield sse_line({'error': 'inference_failed', 'message': str(e), 'traceback': tb[:2000]})

    return StreamingResponse(
        stream(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )
