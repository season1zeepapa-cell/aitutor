#!/bin/bash
# REBUILD26 §5.2 — 격리 service (workspace/aitutor-inference) 코드를 일심동체 컨테이너의
# Python sub-server (workspace/aitutor/inference-py) 로 sync.
#
# 일심동체 안에서도 같은 Python 엔진 (llama-cpp-python / onnxruntime-genai / transformers)
# 을 동일 코드로 운영 → 양쪽 진정한 비교.
#
# 격리 service 의 engines/* 또는 server.py 변경 시 본 스크립트 실행:
#   bash workspace/aitutor/inference-py/sync-from-isolated.sh

set -e
SRC="$(cd "$(dirname "$0")/../../aitutor-inference" && pwd)"
DST="$(cd "$(dirname "$0")" && pwd)"

echo "[sync] $SRC → $DST"
mkdir -p "$DST/engines"
cp -v "$SRC/engines/"*.py "$DST/engines/"
cp -v "$SRC/server.py" "$DST/server.py"
cp -v "$SRC/requirements.txt" "$DST/requirements.txt"

echo "[sync] 완료. 일심동체 다음 빌드부터 반영됨."
