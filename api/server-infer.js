// REBUILD21 §17.4 — 서버 추론 프록시 (Raw HTTP + AWS SigV4 직접 서명)
// 의존성 0 — Node 내장 crypto + https 만. SDK transitive 충돌 회피.
//
// 호출 패턴:
//   POST /api/server-infer/{model_key}
//   Authorization: Bearer <token>  또는  Cookie token=<>
//   body: { question, maxTokens, temperature }
//
// 동작:
//   메인 Lambda → Lambda Invoke API (SigV4 서명) → inference Lambda
//   응답 받으면 SSE chunk 단위로 클라이언트에 forward

const crypto = require('crypto');
const https = require('https');
const { withCors } = require('./middleware');
const { extractToken, verifyToken } = require('./auth');

const REGION = process.env.AWS_REGION || 'ap-northeast-2';
const FUNCTION_MAP = {
  'e4b':       'aitutor-inference-e4b',
  'e2b':       'aitutor-inference-e2b',
  'qwen35-4b': 'aitutor-inference-qwen35-4b',
  // REBUILD21 §17.x — GGUF 변형
  'e2b-gguf':  'aitutor-inference-e2b-gguf',
  'e4b-gguf':  'aitutor-inference-e4b-gguf',
};

// ─── AWS SigV4 ────────────────────────────────────────────
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secret, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function signedHeaders({ method, host, path, body, region, service, accessKey, secretKey, sessionToken }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');  // 20260428T103045Z
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256(body || '');

  // 정규 헤더
  const headers = {
    'host': host,
    'content-type': 'application/json',
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;

  // 정규 요청
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k].trim()}\n`).join('');
  const signedHeadersStr = sortedKeys.join(';');

  const canonicalRequest = [
    method,
    path,
    '',  // query string
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join('\n');

  // 서명 string
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return { ...headers, 'authorization': authorization };
}

// ─── Lambda Invoke (RequestResponse) ───────────────────────
function invokeLambda(functionName, payload) {
  return new Promise((resolve, reject) => {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    if (!accessKey || !secretKey) {
      return reject(new Error('AWS 자격증명 없음 (AWS_ACCESS_KEY_ID 미설정)'));
    }

    const host = `lambda.${REGION}.amazonaws.com`;
    const path = `/2015-03-31/functions/${functionName}/invocations`;
    const body = JSON.stringify(payload);

    const headers = signedHeaders({
      method: 'POST',
      host, path, body,
      region: REGION,
      service: 'lambda',
      accessKey, secretKey, sessionToken,
    });

    const req = https.request(
      { host, path, method: 'POST', headers, timeout: 880 * 1000 },
      (resp) => {
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (resp.statusCode >= 400) {
            return reject(new Error(`Lambda invoke ${resp.statusCode}: ${buf.toString('utf8').slice(0, 500)}`));
          }
          // FunctionError 헤더 확인
          if (resp.headers['x-amz-function-error']) {
            return reject(new Error(`FunctionError ${resp.headers['x-amz-function-error']}: ${buf.toString('utf8').slice(0, 500)}`));
          }
          resolve(buf);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Lambda invoke timeout (880s)')));
    req.write(body);
    req.end();
  });
}

// ─── Express handler ──────────────────────────────────────
module.exports = withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 만 허용' });
  }

  // 인증
  const token = extractToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // model 추출
  const url = req.originalUrl || req.url || '';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  const modelKey = parts[parts.length - 1];
  const functionName = FUNCTION_MAP[modelKey];
  if (!functionName) {
    return res.status(404).json({ error: 'unknown_model', modelKey });
  }

  // SSE 헤더 + 즉시 첫 chunk (CloudFront OriginReadTimeout 60s 우회)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write(`data: ${JSON.stringify({ type: 'connecting', message: '콜드 스타트 진행 중...' })}\n\n`);
  if (typeof res.flush === 'function') res.flush();

  // 30초마다 keep-alive (chunk timeout 리셋)
  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch {}
  }, 25 * 1000);

  // inference Lambda Function URL v2 형식 이벤트
  const event = {
    version: '2.0',
    rawPath: '/infer',
    requestContext: { http: { method: 'POST', path: '/infer' } },
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(req.body || {}),
    isBase64Encoded: false,
  };

  try {
    const respBuf = await invokeLambda(functionName, event);
    clearInterval(keepAlive);
    let respPayload;
    try {
      respPayload = JSON.parse(respBuf.toString('utf8'));
    } catch {
      // raw text — 그대로 forward
      res.write(respBuf.toString('utf8'));
      return res.end();
    }

    if (respPayload.statusCode === 200 && respPayload.body) {
      const body = respPayload.isBase64Encoded
        ? Buffer.from(respPayload.body, 'base64').toString('utf8')
        : respPayload.body;
      res.write(body);
    } else {
      res.write(`data: ${JSON.stringify({
        error: 'inference_returned_error',
        statusCode: respPayload.statusCode,
        body: respPayload.body,
      })}\n\n`);
    }
    res.end();
  } catch (e) {
    clearInterval(keepAlive);
    console.error('[server-infer]', e);
    try {
      res.write(`data: ${JSON.stringify({ error: 'server_infer_failed', message: e.message })}\n\n`);
      res.end();
    } catch {}
  }
});
