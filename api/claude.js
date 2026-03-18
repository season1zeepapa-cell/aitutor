// Vercel 서버리스 함수 - Claude/Anthropic API 프록시
// SSE 스트리밍 + 일반 모드 지원
const https = require('https');

const SYSTEM_PROMPT = '당신은 자격증 시험 전문 강사입니다. 주어진 문제를 분석하고 다음 형식으로 답변해주세요:\n\n**정답**: [번호 및 내용]\n\n**해설**: [상세한 해설]\n\n**핵심 키워드**: [관련 법령, 용어 등]';

const ALLOWED_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
];
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { text, imageBase64, mimeType, model, temperature, maxTokens, stream: useStream } = req.body;
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' });

    // 메시지 구성: 텍스트 + (선택적) 이미지
    let userContent;
    if (imageBase64) {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/png', data: imageBase64 } },
        { type: 'text', text: text }
      ];
    } else {
      userContent = text;
    }

    const resolvedMaxTokens = (maxTokens && parseInt(maxTokens) > 0) ? parseInt(maxTokens) : 2048;
    const body = JSON.stringify({
      model: selectedModel,
      max_tokens: resolvedMaxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      temperature: temperature !== undefined && temperature !== null ? parseFloat(temperature) : 0.3,
      ...(useStream ? { stream: true } : {}),
    });

    // ── 스트리밍 모드 ──
    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const apiReq = https.request('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 120000,
      }, (apiRes) => {
        if (apiRes.statusCode !== 200) {
          const chunks = [];
          apiRes.on('data', c => chunks.push(c));
          apiRes.on('end', () => {
            const errText = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(errText);
              res.write(`data: [ERROR] ${parsed.error?.message || 'Claude API 오류'}\n\n`);
            } catch {
              res.write(`data: [ERROR] Claude API ${apiRes.statusCode}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
          });
          return;
        }

        let buffer = '';
        let currentEvent = '';
        apiRes.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent === 'content_block_delta') {
              try {
                const parsed = JSON.parse(line.slice(6));
                const text = parsed.delta?.text || '';
                if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
              } catch { /* 무시 */ }
            } else if (line.startsWith('data: ') && currentEvent === 'message_stop') {
              // 스트리밍 완료
            }
          }
        });
        apiRes.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
        });
      });

      apiReq.on('error', (err) => {
        res.write(`data: [ERROR] ${err.message}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
      apiReq.on('timeout', () => {
        apiReq.destroy();
        res.write('data: [ERROR] Claude 요청 타임아웃\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });
      apiReq.write(body);
      apiReq.end();

    } else {
      // ── 일반 모드 ──
      const apiRes = await new Promise((resolve, reject) => {
        const req2 = https.request('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 60000,
        }, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => {
            const data = Buffer.concat(chunks).toString('utf8');
            try {
              const parsed = JSON.parse(data);
              if (res2.statusCode !== 200) {
                reject(new Error(parsed.error?.message || `Claude API ${res2.statusCode}`));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error('Claude 응답 파싱 실패'));
            }
          });
        });
        req2.on('error', reject);
        req2.on('timeout', () => { req2.destroy(); reject(new Error('Claude 요청 타임아웃')); });
        req2.write(body);
        req2.end();
      });

      const responseText = apiRes.content?.[0]?.text || '';
      res.json({ text: responseText });
    }

  } catch (err) {
    console.error('[Claude] 에러:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Claude API 오류' });
    }
  }
};
