#!/bin/bash
# AI TutorTwo — Cloud Run 컨테이너 시작 스크립트 (REBUILD23 §3.4 / REBUILD26 §5.1 / REBUILD28 §0.2)
#
# 역할:
#   1) Ollama daemon 기동 (port 11434, GPU 자동 감지)
#   2) llama-server / vLLM 은 lazy spawn — api/local-infer.js 가 첫 호출 시 spawn
#      (이미지 콜드 스타트 단축 + 동시 모든 daemon 메모리 점유 방지)
#   3) Express 메인 앱 기동 (port 8080) — Cloud Run lifecycle 의 메인 프로세스
#
# REBUILD28 §0.3 — 6 엔진 전수 (SGLang / TensorRT-LLM 은 deferred):
# Phase 5-1 active 엔진: ollama / llama-server / vllm
# Phase 5-2 active 엔진 (Python sub-server, port 11442):
#   llama-cpp-python / onnxruntime-genai / transformers
#
# 시그널 처리:
#   - PID 1 = bash → SIGTERM 시 자식 프로세스 정리 후 종료
#   - exec 으로 node 를 띄우면 node 가 PID 1 이 되어 OS 시그널 직접 받음

set -e

echo "[start.sh] === AI TutorTwo Cloud Run 컨테이너 시작 ==="
echo "[start.sh] PROCESS_MODE=${PROCESS_MODE:-main}"
echo "[start.sh] OLLAMA_HOST=$OLLAMA_HOST"
echo "[start.sh] OLLAMA_MODELS=$OLLAMA_MODELS"
echo "[start.sh] HF_HOME=$HF_HOME"
echo "[start.sh] PORT=${PORT:-8080}"

# ─── 0. PROCESS_MODE=isolated 분기 (REBUILD26 §7.2a) ──────────
# 같은 image 를 격리 service (aitutor-inference) 에서도 재사용 — 양쪽 코드 통일.
# 격리 service 는 Express 미동작, FastAPI 단일 진입점만 운영.
# Phase 7-2a: Ollama daemon 만 미리 spawn (CPU 3 + Ollama = 4 active).
# Phase 7-2b/c: llama-server / vLLM 는 inference-py/engines 가 lazy spawn 예정.
if [ "${PROCESS_MODE:-main}" = "isolated" ]; then
  echo "[start.sh] [isolated 모드] 격리 service 시작..."

  # GPU 모드 (격리 service Phase 7-2a) — Ollama daemon 백그라운드 spawn
  if [ "${GPU_ENABLED:-0}" = "1" ]; then
    echo "[start.sh] [isolated+GPU] Ollama daemon 시작 (port 11434, GPU 자동 감지)..."
    ollama serve > /tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo "[start.sh] [isolated+GPU] Ollama PID=$OLLAMA_PID"
    for i in $(seq 1 30); do
      if curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
        echo "[start.sh] [isolated+GPU] Ollama ready (after ${i}s)"
        break
      fi
      sleep 1
    done
  fi

  echo "[start.sh] [isolated 모드] FastAPI uvicorn 메인 프로세스로 실행 (port ${PORT:-8080})..."
  cd /app/inference-py
  exec /opt/venv-vllm/bin/python -m uvicorn server:app --host 0.0.0.0 --port "${PORT:-8080}" --log-level info
fi

# ─── 1. Ollama daemon (background) ──────────────────────────────
echo "[start.sh] Ollama daemon 시작..."
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
echo "[start.sh] Ollama daemon PID=$OLLAMA_PID (port 11434)"

# Ollama 헬스체크 (최대 30초 대기)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "[start.sh] Ollama ready (after ${i}s)"
    break
  fi
  sleep 1
done

# ─── 2. llama-server / vLLM 은 api/local-infer.js 가 lazy spawn ─
# 이유:
#   (a) 동시 daemon 띄우면 VRAM 24GB 가 부족 (Qwen 4B Q4 = ~3GB × N)
#   (b) 사용 안 하는 엔진 메모리 낭비 방지
#   (c) 콜드 스타트 시간 단축
echo "[start.sh] llama-server / vLLM = lazy (api/local-infer.js 가 spawn)"

# ─── 2-b. Python sub-server (Phase 5-2, port 11442) ──────────
# 격리 service 와 같은 코드 (workspace/aitutor-inference 미러). FastAPI uvicorn.
# 모델은 첫 호출 시 lazy 로드 (HuggingFace Hub) → 시작은 빠름.
echo "[start.sh] Python sub-server 시작 (port 11442 — llama-cpp-python / onnx / transformers)..."
cd /app/inference-py && \
  PORT=11442 /opt/venv-vllm/bin/python -m uvicorn server:app --host 127.0.0.1 --port 11442 \
    > /tmp/inference-py.log 2>&1 &
PY_SUBSERVER_PID=$!
cd /app
echo "[start.sh] Python sub-server PID=$PY_SUBSERVER_PID"

# Python sub-server 헬스체크 (FastAPI startup ~3~5s)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:11442/healthz > /dev/null 2>&1; then
    echo "[start.sh] Python sub-server ready (after ${i}s)"
    break
  fi
  sleep 1
done

# REBUILD28 — SGLang / TensorRT-LLM placeholder 완전 제거.
# 미래 부활 시 별도 의사결정 거쳐 본 영역에 daemon spawn 코드 추가.

# ─── 3. SIGTERM 트랩 (자식 프로세스 정리) ──────────────────────
trap '
  echo "[start.sh] SIGTERM 수신 → 자식 정리"
  kill -TERM $OLLAMA_PID 2>/dev/null
  kill -TERM $PY_SUBSERVER_PID 2>/dev/null
  pkill -TERM -f llama-server 2>/dev/null || true
  pkill -TERM -f "vllm.entrypoints" 2>/dev/null || true
  wait $OLLAMA_PID $PY_SUBSERVER_PID 2>/dev/null
  exit 0
' TERM INT

# ─── 4. Express (foreground, Cloud Run 메인 프로세스) ──────────
echo "[start.sh] Express 시작..."
exec node server.js
