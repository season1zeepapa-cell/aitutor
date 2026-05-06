# aitutor-server-infer — Ollama 단일 엔진 격리 추론 service (REBUILD32)
#
# 컨셉:
#   - 메인 service (aitutor) 와 완전 분리된 가벼운 image
#   - Ollama 1개 엔진만 포함 (vLLM/llama-server/llama-cpp/transformers/onnx 모두 없음)
#   - FastAPI uvicorn 단일 진입점, /healthz /infer/models /infer 3개 endpoint
#
# 자원 (cloudbuild 측 cpu/memory):
#   - 16Gi / 4 vCPU + L4 GPU (메인 24Gi/6CPU 보다 작음 → region quota 안전)

FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/var/ollama/models

# 시스템 패키지 — Ollama install.sh 실행 + Python venv 만 필요
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget zstd \
      python3.10 python3.10-venv python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Ollama 단일 binary 설치
RUN curl -fsSL https://ollama.com/install.sh | sh

# Python venv (FastAPI 만)
RUN python3.10 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir --retries 5 --timeout 120 \
       fastapi==0.115.5 \
       'uvicorn[standard]==0.32.1' \
       httpx==0.28.1

WORKDIR /app
COPY server.py start.sh ./
RUN chmod +x /app/start.sh

# Ollama 모델 캐시 디렉토리 (lazy 로드 후 보관 — 단 Cloud Run ephemeral 이므로 콜드 스타트마다 재pull)
RUN mkdir -p /var/ollama/models

EXPOSE 8080

# Cloud Run lifecycle: start.sh 가 PID 1 → SIGTERM 시 Ollama 정리 + uvicorn exit
CMD ["/app/start.sh"]
