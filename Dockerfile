# AI TutorTwo — Cloud Run + L4 GPU 컨테이너 (REBUILD23)
#
# Multi-stage build:
#   1) builder : Node 22 로 Vite 프론트엔드 빌드 → dist/ 생성
#   2) runtime : nvidia/cuda + Node 22 + Ollama + llama.cpp 서버 + Express 앱
#
# 추론 엔진 (실험실 비교 모드 — REBUILD23 §3.4):
#   - Ollama          (port 11434)  ⭐ MVP 메인 — 가장 안정, OpenAI 호환, 모델 자동관리
#   - llama.cpp server(port 11435)  Phase 5 옵션 — GGUF 직접 로드, lazy 시작
#   - vLLM            (port 11436)  Phase 5 추가 예정 — 이미지 크기 ↓ 위해 MVP 제외
#
# 모델은 컨테이너에 패킹 X — Cloud Run 시작 시 Ollama 가 자동 pull (또는 GCS pre-download).
# Artifact Registry 10GB 한도 회피 + 빌드 시간 ↓.

# ─── Stage 1: Frontend 빌드 ──────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /build

# 의존성 캐싱 — package.json 만 먼저 복사
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Vite 빌드 입력
COPY src ./src
COPY public ./public
COPY vite.config.js postcss.config.js tailwind.config.js ./

# 빌드 → /build/dist
RUN npm run build:fe

# ─── Stage 2: Runtime (CUDA + Node + Ollama + llama.cpp) ─────────
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/var/ollama/models

# 시스템 패키지 (MVP — Ollama 만 사용. llama.cpp / vLLM 은 Phase 5 에서 multi-stage 로 추가)
# zstd: Ollama 설치 스크립트의 압축 해제에 필요 (없으면 install.sh 가 ERROR)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget \
      zstd \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (NodeSource 공식 스크립트)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Ollama 설치 (단일 binary, 자체 CUDA 감지)
RUN curl -fsSL https://ollama.com/install.sh | sh

# Phase 5 추가 예정 (multi-stage devel 베이스 필요 — runtime 이미지엔 nvcc 없음):
#   - llama.cpp server (CUDA build, port 11435)
#   - vLLM (Python pip install vllm, port 11436)

# 앱 코드 + 프로덕션 의존성
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY api ./api
COPY start.sh ./
RUN chmod +x /app/start.sh

# Vite 빌드 산출물 (Stage 1 에서 가져옴)
COPY --from=builder /build/dist ./dist

# Ollama 모델 디렉토리 (Cloud Run 컨테이너는 stateless — 매 spawn 시 모델 재다운로드 필요.
# 추후 GCS pre-download startup 으로 콜드 스타트 단축 가능 — REBUILD23 §14.7)
RUN mkdir -p /var/ollama/models

EXPOSE 8080

# Cloud Run 컨테이너 lifecycle: start.sh 가 PID 1 → SIGTERM 시 자식 프로세스 종료 + Express exit
CMD ["/app/start.sh"]
