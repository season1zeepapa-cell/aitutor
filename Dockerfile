# AI TutorTwo — Cloud Run + L4 GPU 컨테이너 (REBUILD23 / REBUILD26 §5.1 / REBUILD28 §0.2)
#
# Multi-stage build:
#   1) frontend-builder : Node 22 로 Vite 프론트엔드 빌드 → dist/
#   2) llamacpp-builder : CUDA devel + cmake 로 llama.cpp 의 llama-server binary 빌드
#   3) runtime          : CUDA runtime + Node + Ollama + llama-server + Python venv (vLLM)
#
# REBUILD28 §0.3 — 6 엔진 전수 (SGLang / TensorRT-LLM 은 사용 패턴 미스매치로 deferred):
#
# Phase 5-1 추론 엔진 (3 active):
#   - Ollama       (port 11434)  ⭐ active — Go wrapper, 모델 자동관리
#   - llama-server (port 11435)  ⭐ active — C++ native, 가장 빠른 GGUF
#   - vLLM         (port 11436)  ⭐ active — GPU 최강, PagedAttention
#
# Phase 5-2 추론 엔진 (3 active, Python sub-server port 11442):
#   - llama-cpp-python   ⭐ active — CUDA wheel (cu124), 같은 venv 공유
#   - onnxruntime-genai  ⭐ active — CUDA wheel, daemon 없이 in-process
#   - transformers       ⭐ active — vLLM의 transformers 재사용 (HF PyTorch CUDA)
#
# 모델은 컨테이너에 baked 안 함 — Cloud Run 시작 시 lazy 다운로드 (Ollama 자동 / HF Hub 캐시).

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

# ─── Stage 2: llama.cpp llama-server 빌드 ────────────────────────
# CUDA devel base (nvcc + headers 필요) — runtime base 보다 1GB 큼, 빌드 후 폐기.
FROM nvidia/cuda:12.4.0-devel-ubuntu22.04 AS llamacpp-builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git \
      build-essential cmake \
      libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
# 특정 tag 고정 — 빌드 안정성 (b4400 = 2025년 초 stable, 한국어 Qwen 잘 호환)
RUN git clone --depth=1 --branch b4400 https://github.com/ggml-org/llama.cpp.git . \
    || git clone https://github.com/ggml-org/llama.cpp.git .

# CUDA driver stub: build image에는 libcuda.so.1 (driver) 가 없음 — toolkit stubs 활용.
# 실행 시점엔 nvidia container runtime 이 host 의 실제 libcuda 를 mount 하므로 OK.
RUN ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/stubs/libcuda.so.1

# CUDA build (L4 = compute capability 8.9)
ENV LIBRARY_PATH=/usr/local/cuda/lib64/stubs:$LIBRARY_PATH
RUN cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=89 -DLLAMA_CURL=OFF \
      -DCMAKE_EXE_LINKER_FLAGS="-Wl,-rpath-link,/usr/local/cuda/lib64/stubs" \
      -DCMAKE_SHARED_LINKER_FLAGS="-Wl,-rpath-link,/usr/local/cuda/lib64/stubs" \
    && cmake --build build --config Release -j$(nproc) --target llama-server

# 결과물 위치 확인 후 한 디렉토리로 모음 (runtime stage 가 COPY 하기 쉽게)
RUN mkdir -p /out/bin /out/lib && \
    cp build/bin/llama-server /out/bin/ && \
    find build -name "*.so" -exec cp {} /out/lib/ \;

# ─── Stage 3: Runtime ────────────────────────────────────────────
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/var/ollama/models \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/var/cache/huggingface \
    TRANSFORMERS_CACHE=/var/cache/huggingface

# 시스템 패키지
#   - zstd: Ollama install.sh 압축 해제
#   - python3.10 + venv + pip: vLLM venv 생성용
#   - libcurl4: llama-server 의존
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget \
      zstd \
      python3.10 python3.10-venv python3-pip \
      libcurl4 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Ollama (단일 binary)
RUN curl -fsSL https://ollama.com/install.sh | sh

# llama-server binary + .so 라이브러리 (Stage 2 결과물)
COPY --from=llamacpp-builder /out/bin/llama-server /usr/local/bin/llama-server
COPY --from=llamacpp-builder /out/lib/ /usr/local/lib/llama-cpp/
ENV LD_LIBRARY_PATH=/usr/local/lib/llama-cpp:$LD_LIBRARY_PATH

# Python venv (vLLM + Phase 5-2 Python 엔진 통합 — 같은 torch 재사용)
# vllm 0.6.5 = torch 2.5.1 + transformers 4.46 (안정 stable)
# llama-cpp-python: abetlen prebuilt CUDA wheel (cu124) — 빌드 시간 절약
# onnxruntime-genai-cuda: PyPI CUDA wheel
#
# REBUILD28 P0 fix (2026-04-30, 2단계):
#   1차) huggingface-hub 0.26.3 → 0.25.2 다운그레이드 — 부분 fix 였음
#   2차) transformers==4.46.3 잠금 추가 — vllm 0.6.5 의 setup.py 가 transformers
#        upper bound 미명시 → pip 가 transformers 5.7.0 을 자동 설치 → 5.x 가 옛
#        is_offline_mode import 시도 → ImportError 즉사. vllm 과 함께 명시 잠금.
RUN python3.10 -m venv /opt/venv-vllm \
    && /opt/venv-vllm/bin/pip install --upgrade pip \
    && /opt/venv-vllm/bin/pip install --no-cache-dir \
       vllm==0.6.5 \
       transformers==4.46.3 \
       huggingface-hub==0.25.2 \
    && /opt/venv-vllm/bin/pip install --no-cache-dir \
       --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu124 \
       llama-cpp-python==0.3.4 \
    && /opt/venv-vllm/bin/pip install --no-cache-dir \
       onnxruntime-genai-cuda==0.5.2 \
       fastapi==0.115.5 \
       'uvicorn[standard]==0.32.1' \
       httpx==0.28.1

# ─── 앱 코드 + 프로덕션 의존성 ─────────────────────────────────
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY api ./api
COPY start.sh ./
RUN chmod +x /app/start.sh

# Python sub-server (REBUILD26 §5.2 — 격리 service 와 동일 코드, port 11442 운영)
# inference-py/ = workspace/aitutor-inference/ 의 mirror (sync-from-isolated.sh 로 동기화)
COPY inference-py /app/inference-py

# Vite 빌드 산출물
COPY --from=frontend-builder /build/dist ./dist

# 모델 캐시 디렉토리
RUN mkdir -p /var/ollama/models /var/cache/huggingface /var/lib/llama-cpp/models

EXPOSE 8080

# Cloud Run lifecycle: start.sh 가 PID 1 → SIGTERM 시 자식 정리 + Express exit
CMD ["/app/start.sh"]
