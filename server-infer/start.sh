#!/bin/bash
# aitutor-server-infer — Cloud Run 컨테이너 시작 (REBUILD32)
#
# 역할:
#   1) Ollama daemon 백그라운드 spawn (port 11434, GPU 자동 감지)
#   2) FastAPI uvicorn 백그라운드 spawn (port 8080)
#   3) bash 가 PID 1 로 wait — SIGTERM 시 trap 으로 두 자식 정리
#
# REBUILD32 §15 R-4 — 시그널 처리 정정:
#   기존: exec uvicorn → bash 가 uvicorn 으로 교체되어 trap 소실 → Ollama 정리 안 됨.
#   수정: uvicorn 도 백그라운드 + bash 가 wait 으로 foreground 유지.
#         Cloud Run SIGTERM → bash trap 발동 → uvicorn + ollama 둘 다 정리.

set -e

echo "[start.sh] === aitutor-server-infer (REBUILD32) 시작 ==="
echo "[start.sh] OLLAMA_HOST=$OLLAMA_HOST"
echo "[start.sh] OLLAMA_MODELS=$OLLAMA_MODELS"
echo "[start.sh] PORT=${PORT:-8080}"

# REBUILD37 Item 3 절충안 — 보안 감사용 Ollama 버전 기록
# (install.sh 가 latest 가져오므로 빌드 시점 정확한 버전을 startup log 에 남김)
echo "[start.sh] Ollama version: $(ollama --version 2>&1 | head -1)"

# 1) Ollama daemon 백그라운드
echo "[start.sh] Ollama daemon 시작..."
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
echo "[start.sh] Ollama PID=$OLLAMA_PID"

# Ollama 헬스체크 (보통 3~5초)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "[start.sh] Ollama ready (after ${i}s)"
    break
  fi
  sleep 1
done

# 2) FastAPI uvicorn 백그라운드 (REBUILD32 §15 R-4 — exec 제거, bash 가 PID 1 유지)
echo "[start.sh] FastAPI uvicorn 시작 (port ${PORT:-8080})..."
/opt/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port "${PORT:-8080}" --log-level info &
UVICORN_PID=$!
echo "[start.sh] uvicorn PID=$UVICORN_PID"

# 3) SIGTERM 트랩 — uvicorn + Ollama 모두 정리
trap '
  echo "[start.sh] SIGTERM 수신 → uvicorn + Ollama 정리"
  kill -TERM $UVICORN_PID 2>/dev/null
  kill -TERM $OLLAMA_PID 2>/dev/null
  wait $UVICORN_PID 2>/dev/null
  wait $OLLAMA_PID 2>/dev/null
  exit 0
' TERM INT

# 4) bash 가 foreground 유지 — uvicorn 종료 시 컨테이너 종료
wait $UVICORN_PID
EXIT_CODE=$?
echo "[start.sh] uvicorn 종료 (code=$EXIT_CODE) → Ollama 정리"
kill -TERM $OLLAMA_PID 2>/dev/null
wait $OLLAMA_PID 2>/dev/null
exit $EXIT_CODE
