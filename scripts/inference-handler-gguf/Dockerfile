# AI TutorTwo Inference — llama-cpp-python (GGUF) — cmake 빌드 (gcc 환경변수 명시)

FROM public.ecr.aws/docker/library/python:3.11-slim-bookworm

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

# build tools — cmake 가 gcc 발견하도록 환경변수 명시
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ make cmake git ninja-build \
    && rm -rf /var/lib/apt/lists/*
ENV CC=/usr/bin/gcc
ENV CXX=/usr/bin/g++
ENV CMAKE_C_COMPILER=/usr/bin/gcc
ENV CMAKE_CXX_COMPILER=/usr/bin/g++

ARG MODEL_KEY=e2b-gguf
ENV MODEL_KEY=${MODEL_KEY}
ENV MODEL_PATH=/var/task/model
ENV PORT=8080
ENV AWS_LWA_INVOKE_MODE=RESPONSE_STREAM
ENV AWS_LWA_READINESS_CHECK_PATH=/ping
ENV AWS_LWA_ASYNC_INIT=true

WORKDIR /var/task

# Python 의존성
RUN pip install --no-cache-dir \
    fastapi==0.115.6 \
    "uvicorn[standard]==0.34.0" \
    psycopg2-binary==2.9.10 \
    boto3==1.35.99

# llama-cpp-python — cmake 빌드 (BLAS 등 가속 옵션 없이 단순 빌드)
ENV CMAKE_ARGS="-DGGML_CUDA=OFF -DGGML_NATIVE=OFF"
ENV FORCE_CMAKE=1
# llama-cpp-python 최신 (Gemma 4 지원 — 2026-04 launch). 0.3.5 → latest
RUN pip install --no-cache-dir --verbose llama-cpp-python 2>&1 | tail -50

COPY app.py auth.py rate_limit.py ./

COPY model/ ${MODEL_PATH}/

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
