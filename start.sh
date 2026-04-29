#!/bin/bash
# AI TutorTwo — Cloud Run 컨테이너 시작 스크립트 (REBUILD23 §3.4)
#
# 역할:
#   1) Ollama daemon 기동 (port 11434, GPU 자동 감지)
#   2) Express 메인 앱 기동 (port 8080) — Cloud Run lifecycle 의 메인 프로세스
#
# llama.cpp server (port 11435) 와 vLLM (port 11436) 은 lazy 시작:
#   - api/local-infer.js 가 첫 호출 시 spawn (이미지 크기 절약 + 콜드 스타트 단축)
#
# 시그널 처리:
#   - PID 1 = bash → SIGTERM 시 자식 프로세스 정리 후 종료
#   - exec 으로 node 를 띄우면 node 가 PID 1 이 되어 OS 시그널 직접 받음

set -e

echo "[start.sh] === AI TutorTwo Cloud Run 컨테이너 시작 ==="
echo "[start.sh] OLLAMA_HOST=$OLLAMA_HOST"
echo "[start.sh] OLLAMA_MODELS=$OLLAMA_MODELS"
echo "[start.sh] PORT=${PORT:-8080}"

# ─── 1. Ollama daemon (background) ──────────────────────────────
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
echo "[start.sh] Ollama daemon PID=$OLLAMA_PID (port 11434)"

# Ollama 헬스체크 (최대 30초 대기 — 부팅 직후 첫 호출 실패 방지)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "[start.sh] Ollama ready (after ${i}s)"
    break
  fi
  sleep 1
done

# ─── 2. SIGTERM 트랩 (자식 프로세스 정리) ──────────────────────
trap 'echo "[start.sh] SIGTERM 수신 → 자식 정리"; kill -TERM $OLLAMA_PID 2>/dev/null; wait $OLLAMA_PID 2>/dev/null; exit 0' TERM INT

# ─── 3. Express (foreground, Cloud Run 메인 프로세스) ──────────
echo "[start.sh] Express 시작..."
exec node server.js
