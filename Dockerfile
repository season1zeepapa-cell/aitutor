# AI TutorTwo — Cloud Run + L4 GPU 컨테이너 (REBUILD33 Phase 2 — A++-2 매장 로컬 AI)
#
# REBUILD33 §28 (2026-05-05 15:00 KST) — 통합 service = "매장 로컬 AI" 컨셉:
#   - 학습 앱 전용 내장 AI (한 개 엔진 + 최소 3 모델)
#   - 일심동체 유지 (Express + Ollama 같은 컨테이너, RTT ~1ms)
#   - 외부 의존 0, 빠른 응답, 단순한 책임
#
# REBUILD33 §29.1 슬림화 결과 (Before → After):
#   image    ~5~6 GB → ~2 GB (-60%)
#   빌드     ~30분  → ~10분 (-67%)
#   stage    3개    → 2개 (Stage 2 llama.cpp CUDA build 제거)
#
# Multi-stage build:
#   1) frontend-builder : Node 22 로 Vite 프론트엔드 빌드 → dist/
#   2) runtime          : CUDA runtime + Node + Ollama (단일 엔진)
#
# 슬림화 폐기 항목 (REBUILD33 §25.1):
#   - Stage 2 llama.cpp CUDA build (~12분, llama-server binary)
#   - Python venv (vLLM 0.6.5 + transformers 4.46 + llama-cpp-python + onnxruntime-genai + accelerate, ~3GB)
#   - llama-server / vLLM lazy spawn 패턴
#   - Python sub-server (FastAPI uvicorn, port 11442)
#
# 모델은 컨테이너에 baked 안 함 — Cloud Run 시작 시 Ollama lazy pull.

# ─── Stage 1: Frontend 빌드 ──────────────────────────────────────
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /build

# 의존성 캐싱
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY src ./src
COPY public ./public
COPY vite.config.js postcss.config.js tailwind.config.js ./

RUN npm run build:fe

# ─── Stage 2: Runtime (CUDA + Node + Ollama) ────────────────────
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/var/ollama/models

# 시스템 패키지 (최소화 — Ollama install + Node 만 필요)
#   - zstd: Ollama install.sh 압축 해제
#   - curl: Ollama install.sh 다운로드 + Node setup
#   - ca-certificates: HTTPS 통신
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl \
      zstd \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Ollama (단일 binary)
RUN curl -fsSL https://ollama.com/install.sh | sh

# ─── 앱 코드 + 프로덕션 의존성 ─────────────────────────────────
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY api ./api
COPY start.sh ./
RUN chmod +x /app/start.sh

# Vite 빌드 산출물
COPY --from=frontend-builder /build/dist ./dist

# Ollama 모델 캐시 디렉토리 (Cloud Run ephemeral 이라 cold start 마다 lazy pull)
RUN mkdir -p /var/ollama/models

EXPOSE 8080

# Cloud Run lifecycle: start.sh 가 PID 1 → SIGTERM 시 자식 정리 + Express exit
CMD ["/app/start.sh"]
