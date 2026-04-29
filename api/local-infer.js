// REBUILD23 §3.4 — Cloud Run 일심동체 추론 + 추론 엔진 교체 가능 구조
//
// 변경 내역 (vs Lambda 시절):
//   - node-llama-cpp 직접 호출 제거
//   - 같은 컨테이너 내부 daemon 들 (Ollama / llama.cpp / vLLM) 에 fetch 분기
//
// 호출:
//   POST /api/local-infer
//   body: {
//     model_key: 'qwen3-4b',
//     engine:    'ollama' | 'llama-cpp' | 'vllm',  // 기본 'ollama'
//     messages:  [...],
//     maxTokens, temperature
//   }
//   응답: { answer, meta: { model_key, engine, infer_ms, total_ms } }
//
//   GET /api/local-infer?action=models
//   응답: { default, default_engine, engines: [...], models: [{key, ...}] }

const { withAuth } = require('./middleware');

// 같은 컨테이너 내부 daemon (Cloud Run 단일 인스턴스 안)
const OLLAMA_URL   = `http://127.0.0.1:${process.env.OLLAMA_PORT   || 11434}`;
const LLAMACPP_URL = `http://127.0.0.1:${process.env.LLAMACPP_PORT || 11435}`;
const VLLM_URL     = `http://127.0.0.1:${process.env.VLLM_PORT     || 11436}`;

// 추론 엔진 카탈로그 (실험실 비교 모드)
//   - ollama   : MVP 메인 (start.sh 가 daemon 띄움)
//   - llama-cpp: Phase 5 추가 예정 (lazy spawn)
//   - vllm     : Phase 5 추가 예정 (Python pip install vllm)
const ENGINES = {
  'ollama':    { label: 'Ollama',         status: 'active'  },
  'llama-cpp': { label: 'llama.cpp',      status: 'planned' },
  'vllm':      { label: 'vLLM',           status: 'planned' },
};

// 모델 카탈로그 (model_key → Ollama 모델 이름) — Ollama 공식 라이브러리 태그 (ollama.com/library)
// 첫 호출 시 Ollama 가 자동 pull (수 분 소요 — 추후 startup pre-pull 로 단축)
const MODEL_MAP = {
  'qwen3-4b':    { ollama: 'qwen3:4b',    name: 'Qwen 3 4B',    org: 'Alibaba', size: '~2.5GB', note: '균형 / 한국어 강 / 추천' },
  'qwen3-1.7b':  { ollama: 'qwen3:1.7b',  name: 'Qwen 3 1.7B',  org: 'Alibaba', size: '~1.4GB', note: '경량 / 콜드 스타트 짧음' },
  'qwen3-0.6b':  { ollama: 'qwen3:0.6b',  name: 'Qwen 3 0.6B',  org: 'Alibaba', size: '~523MB', note: '초경량 / 빠른 응답' },
  'gemma3n-e2b': { ollama: 'gemma3n:e2b', name: 'Gemma 3n E2B', org: 'Google',  size: '~5.6GB', note: '효율적 멀티모달' },
  'gemma3n-e4b': { ollama: 'gemma3n:e4b', name: 'Gemma 3n E4B', org: 'Google',  size: '~7.5GB', note: 'Gemma 패밀리 / 안정' },
};
const DEFAULT_MODEL_KEY = 'qwen3-4b';
const DEFAULT_ENGINE = 'ollama';

// ─── Ollama 모델 존재 확인 + 자동 pull ───────────────────────
// Ollama 의 /api/chat 은 모델 없으면 404 응답하고 자동 pull 안 함.
// 호출 전에 /api/tags 로 보유 확인 → 없으면 /api/pull 로 다운로드 (블로킹).
// 첫 호출 시 모델 다운로드 시간:
//   qwen3:0.6b   523MB  ~30s
//   qwen3:1.7b   1.4GB  ~1~2분
//   qwen3:4b     2.5GB  ~2~3분
//   gemma3n:e2b  5.6GB  ~5분
//   gemma3n:e4b  7.5GB  ~7분
// Cloud Run timeout 600s 안에 들어가야 함 (e4b 는 위험 — 첫 호출만)
async function ensureModelLoaded(ollamaModel) {
  // 1) /api/tags 로 현재 보유 모델 조회
  const tagsResp = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!tagsResp.ok) {
    throw new Error(`Ollama /api/tags 실패: HTTP ${tagsResp.status}`);
  }
  const { models = [] } = await tagsResp.json();
  const has = models.some(m => m.name === ollamaModel || m.model === ollamaModel);
  if (has) return { pulled: false, ms: 0 };

  // 2) 없으면 /api/pull (stream:false 로 블로킹 다운로드)
  console.log(`[local-infer] 모델 자동 pull 시작: ${ollamaModel}`);
  const t0 = Date.now();
  const pullResp = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ollamaModel, stream: false }),
  });
  if (!pullResp.ok) {
    const err = await pullResp.text();
    throw new Error(`Ollama /api/pull 실패 (HTTP ${pullResp.status}): ${err.slice(0, 200)}`);
  }
  const ms = Date.now() - t0;
  console.log(`[local-infer] 모델 pull 완료: ${ollamaModel} (${ms}ms)`);
  return { pulled: true, ms };
}

// ─── Ollama 호출 (native /api/chat 형식) ──────────────────────
async function callOllama({ ollamaModel, messages, maxTokens, temperature }) {
  // 모델 없으면 자동 pull 후 재시도
  await ensureModelLoaded(ollamaModel);

  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
      options: { num_predict: maxTokens, temperature },
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Ollama HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.message?.content || '';
}

// ─── OpenAI 호환 호출 (llama.cpp server / vLLM 공통) ──────────
// Phase 5 활성화 시 사용
async function callOpenAICompat({ baseUrl, ollamaModel, messages, maxTokens, temperature }) {
  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

module.exports = withAuth(async (req, res) => {
  // 카탈로그 조회
  if (req.method === 'GET' && req.query?.action === 'models') {
    return res.json({
      default: DEFAULT_MODEL_KEY,
      default_engine: DEFAULT_ENGINE,
      engines: Object.entries(ENGINES).map(([key, m]) => ({ key, ...m })),
      models: Object.entries(MODEL_MAP).map(([key, m]) => ({ key, ...m })),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 만 허용 (GET ?action=models 가능)' });
  }

  const {
    messages,
    model_key   = DEFAULT_MODEL_KEY,
    engine      = DEFAULT_ENGINE,
    maxTokens   = 512,
    temperature = 0.3,
  } = req.body || {};

  // 입력 검증
  const meta = MODEL_MAP[model_key];
  if (!meta) {
    return res.status(400).json({
      error: `unknown model_key: ${model_key}`,
      available: Object.keys(MODEL_MAP),
    });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
  }

  // 엔진 검증 (planned 는 차단)
  const eng = ENGINES[engine];
  if (!eng) {
    return res.status(400).json({
      error: `unknown engine: ${engine}`,
      available: Object.keys(ENGINES),
    });
  }
  if (eng.status === 'planned') {
    return res.status(503).json({
      error: `engine_not_ready`,
      message: `${eng.label} 엔진은 Phase 5 에서 활성화 예정입니다. 현재는 'ollama' 만 사용 가능합니다.`,
      engine,
    });
  }

  const t0 = Date.now();
  try {
    let answer = '';
    if (engine === 'ollama') {
      answer = await callOllama({ ollamaModel: meta.ollama, messages, maxTokens, temperature });
    } else if (engine === 'llama-cpp') {
      answer = await callOpenAICompat({ baseUrl: LLAMACPP_URL, ollamaModel: meta.ollama, messages, maxTokens, temperature });
    } else if (engine === 'vllm') {
      answer = await callOpenAICompat({ baseUrl: VLLM_URL, ollamaModel: meta.ollama, messages, maxTokens, temperature });
    }

    const inferMs = Date.now() - t0;
    res.json({
      answer,
      meta: {
        model_key,
        model_name: meta.name,
        engine,
        infer_ms: inferMs,
        total_ms: inferMs,
        warm: true,  // GCP 에서는 daemon 이 항상 살아있음 (인스턴스 살아있는 한)
      },
    });
  } catch (err) {
    console.error('[local-infer] 에러:', err);
    res.status(500).json({
      error: err.message,
      meta: { model_key, engine, total_ms: Date.now() - t0 },
    });
  }
});

module.exports.MODEL_MAP = MODEL_MAP;
module.exports.DEFAULT_MODEL_KEY = DEFAULT_MODEL_KEY;
module.exports.ENGINES = ENGINES;
