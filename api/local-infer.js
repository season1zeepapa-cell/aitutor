// REBUILD23 §3.4 / REBUILD26 §5.1 / REBUILD28 §0.2 — Cloud Run 일심동체 추론 6 엔진
//
// Phase 5-1 active (Day 1~2):
//   - ollama       (port 11434)  ⭐ start.sh 가 daemon 항상 띄움
//   - llama-server (port 11435)  ⭐ lazy spawn (이 파일이 child_process 로 spawn)
//   - vllm         (port 11436)  ⭐ lazy spawn (Python venv 사용)
//
// Phase 5-2 active (Python sub-server, port 11442 — 격리 service 와 동일 코드):
//   - llama-cpp-python   ⭐ active — CUDA wheel
//   - onnxruntime-genai  ⭐ active — CUDA wheel, in-process
//   - transformers       ⭐ active — vLLM 의 transformers 재사용
//
// REBUILD28 (2026-04-30) — SGLang / TensorRT-LLM 은 사용 패턴 미스매치로 deferred,
// placeholder 완전 제거. 미래 부활 필요 시 별도 의사결정 거쳐 재도입.
//
// 호출:
//   POST /api/local-infer
//   body: { engine, model_key, messages, maxTokens, temperature }
//
//   GET /api/local-infer?action=models
//   응답: { default, default_engine, engines: [...], models: [...] }

const { withAuth } = require('./middleware');
const { spawn } = require('child_process');
const { applyQwenStrict } = require('./_runtime/qwen');

// 같은 컨테이너 내부 daemon 들
const OLLAMA_URL       = `http://127.0.0.1:${process.env.OLLAMA_PORT       || 11434}`;
const LLAMASERVER_URL  = `http://127.0.0.1:${process.env.LLAMASERVER_PORT  || 11435}`;
const VLLM_URL         = `http://127.0.0.1:${process.env.VLLM_PORT         || 11436}`;
// Phase 5-2: Python sub-server (port 11442) — 격리 service 와 동일 FastAPI
// llama-cpp-python / onnxruntime-genai / transformers 모두 이 sub-server 가 처리
const PY_SUBSERVER_URL = `http://127.0.0.1:${process.env.PY_SUBSERVER_PORT || 11442}`;

// ─── 엔진 카탈로그 (REBUILD28 §0.3 — 6 엔진 전수) ──────────
const ENGINES = {
  'ollama':            { label: 'Ollama',            status: 'active',  note: 'Go wrapper, 모델 자동관리 ⭐' },
  'llama-server':      { label: 'llama-server',      status: 'active',  note: 'C++ native, GGUF 가장 빠름' },
  'vllm':              { label: 'vLLM',              status: 'active',  note: 'GPU 최강, PagedAttention' },
  'llama-cpp-python':  { label: 'llama-cpp-python',  status: 'active',  note: 'Python CUDA wheel (sub-server)' },
  'onnxruntime-genai': { label: 'onnxruntime-genai', status: 'active',  note: 'Microsoft ONNX CUDA' },
  'transformers':      { label: 'transformers',      status: 'active',  note: 'HF PyTorch (sub-server)' },
};

// ─── 모델 카탈로그 (engine 별 식별자) ──────────────────────
//   ollama     : Ollama 태그 (qwen3:4b)
//   gguf       : llama-server / llama-cpp-python (HF repo + 파일명)
//   hf_repo    : vLLM / transformers (HF transformers 표준)
//   onnx       : onnxruntime-genai
// REBUILD29 §24 — local-ai 와 동일 모델 시리즈 (Qwen 3.5 + Gemma 4) 통일
// 비교 가능: 3 lab (local-ai / 일심동체 / 격리) × 4 모델
const MODEL_MAP = {
  'qwen35-2b': {
    name: 'Qwen 3.5 2B', org: 'Alibaba', size: '~1.6GB', note: '경량 / 한국어 강',
    ollama:    'qwen3.5:2b',
    gguf:      { repo: 'unsloth/Qwen3.5-2B-GGUF', file: 'Qwen3.5-2B-Instruct-Q4_K_M.gguf' },
    hf_repo:   'Qwen/Qwen3.5-2B-Instruct',
    onnx_repo: 'onnx-community/Qwen3.5-2B-ONNX',
  },
  'qwen35-4b': {
    name: 'Qwen 3.5 4B', org: 'Alibaba', size: '~2.5GB', note: '균형 / 한국어 강 / 추천',
    ollama:    'qwen3.5:4b',
    gguf:      { repo: 'unsloth/Qwen3.5-4B-GGUF', file: 'Qwen3.5-4B-Instruct-Q4_K_M.gguf' },
    hf_repo:   'Qwen/Qwen3.5-4B-Instruct',
    onnx_repo: 'onnx-community/Qwen3.5-4B-ONNX-OPT',
  },
  'gemma4-e2b': {
    name: 'Gemma 4 E2B', org: 'Google', size: '~3.2GB', note: '효율적 멀티모달 / 128K context',
    ollama:    'gemma4:e2b',
    gguf:      { repo: 'unsloth/gemma-4-E2B-it-GGUF', file: 'gemma-4-E2B-it-Q4_K_M.gguf' },
    hf_repo:   'google/gemma-4-E2B-it',
    onnx_repo: 'onnx-community/gemma-4-E2B-it-ONNX',
  },
  'gemma4-e4b': {
    name: 'Gemma 4 E4B', org: 'Google', size: '~4.9GB', note: 'Gemma 패밀리 / 안정 / 멀티모달',
    ollama:    'gemma4:e4b',
    gguf:      { repo: 'unsloth/gemma-4-E4B-it-GGUF', file: 'gemma-4-E4B-it-Q4_K_M.gguf' },
    hf_repo:   'google/gemma-4-E4B-it',
    onnx_repo: 'onnx-community/gemma-4-E4B-it-ONNX',
  },
};
const DEFAULT_MODEL_KEY = 'qwen35-4b';
const DEFAULT_ENGINE = 'ollama';

// ─── Ollama 모델 자동 pull (기존 로직 유지) ─────────────────
async function ensureOllamaModel(ollamaModel) {
  const tagsResp = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!tagsResp.ok) throw new Error(`Ollama /api/tags 실패: HTTP ${tagsResp.status}`);
  const { models = [] } = await tagsResp.json();
  if (models.some(m => m.name === ollamaModel || m.model === ollamaModel)) return;

  console.log(`[local-infer] Ollama 모델 자동 pull 시작: ${ollamaModel}`);
  const pullResp = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ollamaModel, stream: false }),
  });
  if (!pullResp.ok) {
    const err = await pullResp.text();
    throw new Error(`Ollama /api/pull 실패 (HTTP ${pullResp.status}): ${err.slice(0, 200)}`);
  }
}

// ─── lazy daemon 관리 (llama-server / vLLM) ─────────────────
// 같은 GPU L4 24GB 를 여러 daemon 이 공유 → 한 번에 한 모델만 로드 (재spawn 패턴).
const _daemons = {
  'llama-server': { proc: null, model: null, port: 11435, healthEndpoint: '/v1/models', startTimeoutS: 60 },
  'vllm':         { proc: null, model: null, port: 11436, healthEndpoint: '/v1/models', startTimeoutS: 180 },
};

async function _waitHealth(port, endpoint, timeoutS) {
  const url = `http://127.0.0.1:${port}${endpoint}`;
  for (let i = 0; i < timeoutS; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`daemon 헬스체크 타임아웃 (${timeoutS}s, ${url})`);
}

async function _killDaemon(key) {
  const d = _daemons[key];
  if (d.proc && d.proc.exitCode === null) {
    d.proc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 2000));
    if (d.proc.exitCode === null) d.proc.kill('SIGKILL');
  }
  d.proc = null;
  d.model = null;
}

async function ensureLlamaServer(ollamaModelTag, ggufInfo) {
  const d = _daemons['llama-server'];
  if (d.proc && d.proc.exitCode === null && d.model === ollamaModelTag) return;
  await _killDaemon('llama-server');

  // GGUF 모델 path: HF Hub 캐시 또는 Ollama blob 활용
  // 가장 단순: huggingface-cli 로 다운로드 (HF_HOME 캐시)
  const cacheDir = process.env.HF_HOME || '/var/cache/huggingface';
  const modelPath = `${cacheDir}/llama-cpp/${ggufInfo.file}`;
  const fs = require('fs');
  if (!fs.existsSync(modelPath)) {
    fs.mkdirSync(`${cacheDir}/llama-cpp`, { recursive: true });
    const url = `https://huggingface.co/${ggufInfo.repo}/resolve/main/${ggufInfo.file}`;
    console.log(`[local-infer] GGUF 다운로드: ${url} → ${modelPath}`);
    const t0 = Date.now();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`GGUF 다운로드 실패: HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(modelPath, buf);
    console.log(`[local-infer] GGUF 다운로드 완료 (${Date.now() - t0}ms, ${buf.length} bytes)`);
  }

  console.log(`[local-infer] llama-server spawn: ${modelPath}`);
  d.proc = spawn('/usr/local/bin/llama-server', [
    '--host', '127.0.0.1',
    '--port', String(d.port),
    '--model', modelPath,
    '-ngl', '99',                   // GPU 모든 layer 오프로드
    '--ctx-size', '4096',
    '--no-warmup',
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  d.proc.on('exit', code => console.log(`[local-infer] llama-server 종료 code=${code}`));
  await _waitHealth(d.port, d.healthEndpoint, d.startTimeoutS);
  d.model = ollamaModelTag;
}

async function ensureVllm(ollamaModelTag, hfRepo) {
  const d = _daemons['vllm'];
  if (d.proc && d.proc.exitCode === null && d.model === ollamaModelTag) return;
  await _killDaemon('vllm');

  console.log(`[local-infer] vLLM spawn: ${hfRepo}`);
  d.proc = spawn('/opt/venv-vllm/bin/python', [
    '-m', 'vllm.entrypoints.openai.api_server',
    '--host', '127.0.0.1',
    '--port', String(d.port),
    '--model', hfRepo,
    '--max-model-len', '4096',
    '--gpu-memory-utilization', '0.5',  // Ollama 와 GPU 공유 (Ollama unload 안 함)
    '--enforce-eager',                  // CUDA graph 컴파일 스킵 (시작 빠름)
  ], { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, HF_HOME: process.env.HF_HOME || '/var/cache/huggingface' } });
  d.proc.on('exit', code => console.log(`[local-infer] vLLM 종료 code=${code}`));
  await _waitHealth(d.port, d.healthEndpoint, d.startTimeoutS);
  d.model = ollamaModelTag;
}

// ─── Ollama 호출 (기존 한국어 강제 로직 유지) ──────────────
async function callOllama({ ollamaModel, messages, maxTokens, temperature }) {
  await ensureOllamaModel(ollamaModel);

  const isQwen = ollamaModel.startsWith('qwen3');
  let finalMessages = messages;
  if (isQwen) {
    const koreanForce = '\n\n⚠ CRITICAL: 반드시 한국어로만 답변하세요. 영어 사용 금지. 모든 응답은 한국어로 작성합니다.';
    const userTail   = '\n\n⚠ 반드시 한국어(Korean)로만 답변하세요. English 사용 금지.';
    const assistantSeed = '네, 한국어로 답변드리겠습니다.\n\n';

    let withSystem;
    if (messages[0]?.role === 'system') {
      withSystem = [
        { role: 'system', content: messages[0].content + koreanForce },
        ...messages.slice(1),
      ];
    } else {
      withSystem = [
        { role: 'system', content: '당신은 한국어 자격증 시험 전문 강사입니다.' + koreanForce },
        ...messages,
      ];
    }
    const reversedIdx = [...withSystem].reverse().findIndex(m => m.role === 'user');
    if (reversedIdx >= 0) {
      const lastUserIdx = withSystem.length - 1 - reversedIdx;
      withSystem = withSystem.map((m, i) =>
        i === lastUserIdx ? { ...m, content: m.content + userTail } : m
      );
    }
    finalMessages = [...withSystem, { role: 'assistant', content: assistantSeed }];
  }

  const body = {
    model: ollamaModel,
    messages: finalMessages,
    stream: false,
    options: { num_predict: maxTokens, temperature },
  };
  if (isQwen) body.think = false;

  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Ollama HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.message?.content || '';
}

// ─── OpenAI 호환 호출 (llama-server / vLLM 공통) ────────────
// REBUILD29 §13 — Qwen 모델은 thinking 모드 강제 비활성 (마지막 user 끝에 /no_think)
async function callOpenAICompat({ baseUrl, modelTag, messages, maxTokens, temperature }) {
  const finalMessages = applyQwenStrict(messages, modelTag);
  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelTag,
      messages: finalMessages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
      // vLLM 표준 — chat template 이 enable_thinking kwarg 인식
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Python sub-server 호출 (llama-cpp-python / onnx / transformers) ─
// 격리 service 의 /infer 와 동일 스펙 (engine + model_key + messages)
// 첫 호출 시 sub-server 가 모델 lazy 다운로드 → 1~3분 콜드 가능
// REBUILD29 §13 — Qwen 모델은 thinking 모드 강제 비활성
async function callPySubserver({ engine, modelKey, messages, maxTokens, temperature }) {
  const finalMessages = applyQwenStrict(messages, modelKey);
  const resp = await fetch(`${PY_SUBSERVER_URL}/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engine,
      model_key: modelKey,
      messages: finalMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Python sub-server HTTP ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.answer || '';
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
      message: `${eng.label} 엔진은 ${eng.note}. 현재 active: ${Object.keys(ENGINES).filter(k => ENGINES[k].status === 'active').join(', ')}`,
      engine,
    });
  }

  const t0 = Date.now();
  try {
    let answer = '';
    if (engine === 'ollama') {
      answer = await callOllama({ ollamaModel: meta.ollama, messages, maxTokens, temperature });
    } else if (engine === 'llama-server') {
      if (!meta.gguf) throw new Error(`model_key '${model_key}' has no GGUF mapping (gemma 모델은 Ollama 만 지원)`);
      await ensureLlamaServer(meta.ollama, meta.gguf);
      answer = await callOpenAICompat({ baseUrl: LLAMASERVER_URL, modelTag: meta.gguf.file, messages, maxTokens, temperature });
    } else if (engine === 'vllm') {
      if (!meta.hf_repo) throw new Error(`model_key '${model_key}' has no hf_repo mapping`);
      await ensureVllm(meta.ollama, meta.hf_repo);
      answer = await callOpenAICompat({ baseUrl: VLLM_URL, modelTag: meta.hf_repo, messages, maxTokens, temperature });
    } else if (engine === 'llama-cpp-python' || engine === 'onnxruntime-genai' || engine === 'transformers') {
      // Python sub-server (port 11442) — 격리 service 와 동일 코드, GPU L4 활용
      if (!meta.hf_repo && !meta.gguf && !meta.onnx_repo) {
        throw new Error(`model_key '${model_key}' has no Python engine mapping (gemma 모델은 Ollama 만 지원)`);
      }
      answer = await callPySubserver({ engine, modelKey: model_key, messages, maxTokens, temperature });
    } else {
      throw new Error(`engine '${engine}' marked active but no dispatcher`);
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
        warm: true,
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
