#!/bin/bash
# AI TutorTwo — Cloud Run 컨테이너 시작 스크립트 (REBUILD33 Phase 2 — A++-2 매장 로컬 AI)
#
# REBUILD33 §28 (2026-05-05) — 통합 service = "매장 로컬 AI" 컨셉:
#   - 일심동체 유지 (Express + Ollama 같은 컨테이너, localhost RTT ~1ms)
#   - 한 개 엔진 (Ollama) + 최소 3 모델 (qwen2.5:3b/gemma2:2b/qwen3.5:4b)
#
# 역할:
#   1) Ollama daemon 기동 (port 11434, GPU 자동 감지)
#   2) Express 메인 앱 기동 (port 8080) — Cloud Run lifecycle 의 메인 프로세스
#
# REBUILD33 §29.1 슬림화 결과 (Before 78줄 → After ~30줄, -62%):
#   - llama-server / vLLM lazy spawn 폐기 (Dockerfile 에서 제거됨)
#   - Python sub-server (port 11442) watchdog 폐기 (inference-py/ 제거됨)
#
# 시그널 처리:
#   - PID 1 = bash → SIGTERM 시 Ollama 정리 후 종료
#   - exec 으로 node server.js 띄우면 node 가 PID 1 직접 받음

set -e

echo "[start.sh] === AI TutorTwo Cloud Run (메인 service, REBUILD33) 시작 ==="
echo "[start.sh] OLLAMA_HOST=$OLLAMA_HOST"
echo "[start.sh] OLLAMA_MODELS=$OLLAMA_MODELS"
echo "[start.sh] PORT=${PORT:-8080}"

# ─── 1. Ollama daemon (background) ──────────────────────────────
echo "[start.sh] Ollama daemon 시작..."
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
echo "[start.sh] Ollama daemon PID=$OLLAMA_PID (port 11434)"

# Ollama 헬스체크 (보통 3~5초)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "[start.sh] Ollama ready (after ${i}s)"
    break
  fi
  sleep 1
done

# REBUILD37 Item 3 절충안 — 보안 감사용 Ollama 버전 기록
# daemon ready 후 호출해야 client/server 양쪽 버전 깨끗하게 출력됨
echo "[start.sh] Ollama version: $(ollama --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"

# ─── 2. SIGTERM 트랩 — Ollama 정리 후 종료 ──────────────────────
trap '
  echo "[start.sh] SIGTERM 수신 → Ollama 정리"
  kill -TERM $OLLAMA_PID 2>/dev/null
  wait $OLLAMA_PID 2>/dev/null
  exit 0
' TERM INT

# ─── 3. Express (foreground, Cloud Run 메인 프로세스) ──────────
echo "[start.sh] Express 시작..."
exec node server.js
