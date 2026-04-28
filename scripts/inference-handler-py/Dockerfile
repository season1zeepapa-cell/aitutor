# AI TutorTwo Inference — Python + ONNX Runtime + Lambda Web Adapter (REBUILD21)
# AWS LWA 공식 패턴: 일반 Python image + LWA layer (Lambda base image 사용 X)
# 빌드 인자: MODEL_KEY (e2b | e4b | qwen35-4b)

FROM public.ecr.aws/docker/library/python:3.12-slim-bullseye

# Lambda Web Adapter — Function URL RESPONSE_STREAM 변환 (extension)
# https://github.com/awslabs/aws-lambda-web-adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

ARG MODEL_KEY=qwen35-4b
ENV MODEL_KEY=${MODEL_KEY}
ENV MODEL_PATH=/var/task/model
ENV PORT=8080
ENV AWS_LWA_INVOKE_MODE=RESPONSE_STREAM
ENV AWS_LWA_READINESS_CHECK_PATH=/ping
ENV AWS_LWA_ASYNC_INIT=true

WORKDIR /var/task

# Python 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 핸들러 + 보조 모듈
COPY app.py inference.py auth.py rate_limit.py ./

# 모델 데이터 (CodeBuild 가 빌드 컨텍스트의 model/ 디렉토리에 S3 sync 해 둠)
COPY model/ ${MODEL_PATH}/

# uvicorn 직접 실행 (run.sh 제거 — exec form 으로 PID 1 처리)
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
