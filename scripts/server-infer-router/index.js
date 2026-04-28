// REBUILD22 §x — server-infer Router Lambda (RESPONSE_STREAM)
//
// 목적:
//   메인 ALB → 메인 Lambda (BUFFERED) 경로는 ALB Lambda target 한계로 SSE
//   스트리밍이 불가능. 이 라우터를 별도 Lambda Function URL (RESPONSE_STREAM)
//   로 띄워 CloudFront path-based routing(`/api/server-infer/*`)으로 분기시킨다.
//
// 동작:
//   1. CloudFront → Function URL (RESPONSE_STREAM) → 본 핸들러
//   2. URL path 끝의 modelKey 추출 (e2b/e4b/qwen35-4b/e2b-gguf/e4b-gguf)
//   3. HMAC JWT 검증 (메인 api/auth.js 와 같은 SECRET 공유)
//   4. inference Lambda Function URL 로 https POST /infer
//   5. 응답 chunk 를 받자마자 그대로 streamify responseStream 으로 forward
//
// 의존성: Node 22 내장 (https, crypto) — npm install 불필요. 배포 zip 1KB대.
//
// 환경변수:
//   AUTH_TOKEN_SECRET       — 메인과 동일한 32자+ 시크릿
//   URL_E2B / URL_E4B / URL_QWEN35_4B / URL_E2B_GGUF / URL_E4B_GGUF
//                           — 각 inference Lambda 의 Function URL (https://...)
//   UPSTREAM_TIMEOUT_MS     — 옵션, 기본 880000 (메인 Lambda timeout 300s 보다 긺)

'use strict';

const https = require('https');
const crypto = require('crypto');

// ─── 설정 로드 ─────────────────────────────────────────────
const TOKEN_SECRET = (process.env.AUTH_TOKEN_SECRET || '').trim();
const TOKEN_SECRET_OK = TOKEN_SECRET.length >= 32;
if (!TOKEN_SECRET_OK) {
  console.warn('[router] AUTH_TOKEN_SECRET 미설정 또는 32자 미만 — 모든 요청이 401');
}

const FUNCTION_URL_MAP = {
  'e2b':       process.env.URL_E2B,
  'e4b':       process.env.URL_E4B,
  'qwen35-4b': process.env.URL_QWEN35_4B,
  'e2b-gguf':  process.env.URL_E2B_GGUF,
  'e4b-gguf':  process.env.URL_E4B_GGUF,
};

const UPSTREAM_TIMEOUT_MS = parseInt(process.env.UPSTREAM_TIMEOUT_MS, 10) || 880000;

// ─── 토큰 검증 (메인 api/auth.js HMAC-SHA256 호환) ──────────
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function b64urlEncode(buf) {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function verifyToken(token) {
  if (!token || !TOKEN_SECRET_OK) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const signingInput = parts[0] + '.' + parts[1];
    const expected = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(signingInput)
      .digest();
    const expectedB64 = b64urlEncode(expected);

    // 길이 다르면 timingSafeEqual 가 throw — 사전 체크
    if (expectedB64.length !== parts[2].length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expectedB64), Buffer.from(parts[2]))) {
      return null;
    }

    const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function extractToken(event) {
  const headers = event.headers || {};

  // 1) Cookie token=
  const cookieHeader = headers.cookie || headers.Cookie || '';
  for (const c of cookieHeader.split(';')) {
    const trimmed = c.trim();
    if (trimmed.startsWith('token=')) return trimmed.slice('token='.length);
  }

  // 2) Authorization Bearer
  const auth = headers.authorization || headers.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);

  return null;
}

// ─── SSE 헬퍼 ─────────────────────────────────────────────
function sseLine(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// ─── 메인 핸들러 (streamifyResponse) ───────────────────────
exports.handler = awslambda.streamifyResponse(async (event, responseStream) => {
  // SSE 응답 메타 (statusCode + headers) 를 stream 앞에 prepend
  const metadata = {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  };
  responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

  const writeAndEnd = (obj) => {
    try { responseStream.write(sseLine(obj)); } catch {}
    try { responseStream.end(); } catch {}
  };

  // 1) modelKey 추출 — Function URL v2: event.rawPath = "/api/server-infer/e4b"
  const rawPath = event.rawPath || event.requestContext?.http?.path || '';
  const segs = rawPath.split('?')[0].split('/').filter(Boolean);
  const modelKey = segs[segs.length - 1];
  const targetUrl = FUNCTION_URL_MAP[modelKey];
  if (!targetUrl) {
    return writeAndEnd({ error: 'unknown_model', modelKey });
  }

  // 2) 인증 — 메인과 같은 SECRET 으로 JWT 검증
  const token = extractToken(event);
  const payload = verifyToken(token);
  if (!payload) {
    return writeAndEnd({ error: 'unauthorized' });
  }

  // 3) 즉시 첫 chunk — 클라이언트 UX (콜드 스타트 대기 안내)
  try {
    responseStream.write(sseLine({ type: 'connecting', message: '서버 추론 준비 중...' }));
  } catch {}

  // 4) body 추출 (Function URL v2 — base64 가능)
  let upstreamBody = event.body || '';
  if (event.isBase64Encoded) {
    upstreamBody = Buffer.from(upstreamBody, 'base64').toString('utf8');
  }

  // 5) inference Function URL 로 POST /infer 후 chunk forward
  //    inference Lambda 콜드 스타트 (모델 로드) 가 60초+ 걸리는 경우, 첫 chunk 가
  //    오기 전까지 25초 마다 keep-alive 를 클라이언트로 송신해 CloudFront / 브라우저
  //    timeout 을 회피한다. (CloudFront read timeout 은 chunk 마다 reset)
  const url = new URL(targetUrl);
  const reqOptions = {
    method: 'POST',
    hostname: url.hostname,
    port: 443,
    path: '/infer',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(upstreamBody),
    },
  };

  let firstByteSeen = false;
  const keepAlive = setInterval(() => {
    if (firstByteSeen) return;  // upstream 응답 시작했으면 keep-alive 불필요
    try { responseStream.write(': keep-alive\n\n'); } catch {}
  }, 25 * 1000);

  await new Promise((resolve) => {
    const cleanup = () => clearInterval(keepAlive);

    const req = https.request(reqOptions, (resp) => {
      // upstream 이 4xx/5xx 라도 chunk 그대로 forward — body 가 SSE 에러 메시지일 수 있음
      resp.on('data', (chunk) => {
        firstByteSeen = true;
        try { responseStream.write(chunk); } catch {}
      });
      resp.on('end', () => {
        cleanup();
        try { responseStream.end(); } catch {}
        resolve();
      });
      resp.on('error', (err) => {
        cleanup();
        console.error('[router] upstream resp error:', err.message);
        try {
          responseStream.write(sseLine({ error: 'upstream_resp_error', message: err.message }));
          responseStream.end();
        } catch {}
        resolve();
      });
    });

    req.on('error', (err) => {
      cleanup();
      console.error('[router] upstream req error:', err.message);
      try {
        responseStream.write(sseLine({ error: 'upstream_req_error', message: err.message }));
        responseStream.end();
      } catch {}
      resolve();
    });

    req.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      req.destroy(new Error(`upstream timeout (${UPSTREAM_TIMEOUT_MS}ms)`));
    });

    req.write(upstreamBody);
    req.end();
  });
});
