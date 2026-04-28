// Lambda 엔트리포인트 — ALB + Function URL 호환 (serverless-express 기반)
// serverless-express v5가 event 형식을 자동 감지:
//   - ALB v1 (httpMethod/path/multiValueHeaders)
//   - Function URL v2 (requestContext.http.method/rawPath)
//   - API Gateway REST / HTTP API
const serverlessExpress = require('@codegenie/serverless-express');
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');

let cachedHandler;

async function loadSecrets() {
  const ssm = new SSMClient({ region: process.env.AWS_REGION });
  let nextToken;
  let count = 0;
  do {
    const resp = await ssm.send(new GetParametersByPathCommand({
      Path: '/aitutor/',
      Recursive: false,
      WithDecryption: true,
      NextToken: nextToken,
    }));
    (resp.Parameters || []).forEach(p => {
      const key = p.Name.split('/').pop();
      process.env[key] = p.Value;
      count += 1;
    });
    nextToken = resp.NextToken;
  } while (nextToken);
  console.log(`[Bootstrap] SSM 시크릿 ${count}개 로드 완료`);
}

async function init() {
  if (cachedHandler) return cachedHandler;
  await loadSecrets();
  const app = require('./server');
  cachedHandler = serverlessExpress({ app });
  return cachedHandler;
}

exports.handler = async (event, context) => {
  if (event && event.source === 'warmup') {
    console.log('[Warmup] ping received');
    return { statusCode: 200, body: 'warm' };
  }
  const handler = await init();
  return handler(event, context);
};
