# AI TutorTwo — Lambda Container Image (단일 스테이지)
# 로컬에서 사전 빌드된 dist/를 COPY하므로 Vite 빌드 단계는 불필요
# 이 컨테이너는 AWS Lambda runtime에서만 실행됨

FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}

# 프로덕션 의존성만 설치
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 런타임에 필요한 파일
COPY server.js lambda.js ./
COPY api ./api
COPY dist ./dist

# Lambda 핸들러
CMD [ "lambda.handler" ]
