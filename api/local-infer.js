// REBUILD33 Phase 2 (2026-05-05) — 메인 service "매장 로컬 AI" 컨셉 (Ollama 단일 엔진)
//
// REBUILD33 §28 — 통합 service = "매장 로컬 AI" 컨셉:
//   - 일심동체 유지 (Express + Ollama 같은 컨테이너, localhost RTT ~1ms)
//   - 한 개 엔진 (Ollama) + 최소 3 모델 (Q9-c)
//   - 학습 앱 전용 내장 AI (qwen2.5:3b default — 한국어 강 + 영어 번역 가능)
//
// REBUILD33 §29.1 슬림화 결과 (Before 890줄 → After ~430줄, -52%):
//   폐기: vLLM / llama-server lazy spawn / cleanupOtherEngines / Python sub-server
//   유지: Ollama 단일 dispatch, 동적 가용성, /memory, /healthz, /cleanup (Ollama unload)
//
// REBUILD32 §15 R-3 (2026-05-05) — 통합/분리 서버 완전 독립 운영 원칙:
//   ⚠ 이 MODEL_MAP 은 통합 service 의 단독 진실 소스이다.
//   격리 service (workspace/aitutor/server-infer/server.py) 의 MODELS 와 의도적으로 다를 수 있다.
//   - 통합: 매장 로컬 AI 컨셉 (3 모델, 한국어 + 영어 번역)
//   - 격리: 회사 자산 컨셉 (14 모델, 한국어 8 + 영어 6)
//   동기화 검증/공유 import 금지. "버그" 아닌 "의도된 차이".
//
// 호출:
//   POST /api/local-infer
//   body: { model_key, messages, maxTokens, temperature }   // engine 파라미터 제거됨
//
//   GET  /api/local-infer?action=models           → 카탈로그 (단일 엔진 + 동적 가용성)
//   GET  /api/local-infer?action=memory           → 메모리 상태 (Ollama + RAM + GPU)
//   GET  /api/local-infer?action=health           → Ollama 헬스체크
//   POST /api/local-infer?action=unload-all       → 모든 Ollama 모델 unload (warm 유지)
//   POST /api/local-infer?action=restart-container→ 컨테이너 자체 종료 (본업 영향, 메모리 100% 회수)

const { withAuth } = require('./middleware');
const { applyQwenStrict } = require('./_runtime/qwen');

const OLLAMA_URL = `http://127.0.0.1:${process.env.OLLAMA_PORT || 11434}`;

// ─── 엔진 카탈로그 (REBUILD33 — 단일 엔진) ──────────────────
const ENGINES = {
  'ollama': { label: 'Ollama', status: 'active', note: 'Go wrapper, 모델 자동관리 (매장 로컬 AI 단일 엔진)' },
};

// ─── 모델 카탈로그 (REBUILD33 §28 매장 로컬 AI — Q9-c 채택 3 모델) ──────────
//
// REBUILD33 §28.3 추천 근거:
//   1순위 qwen2.5:3b — 한국어 강(다국어 학습) + 영어 번역 우수 + 1.9GB 가벼움
//   2순위 gemma2:2b  — Google 표준 안정성 + 1.6GB 가장 가벼움 (Qwen 응답 어색 시 fallback)
//   3순위 qwen3.5:4b — 고성능 (필요 시) — 한국어/영어 번역 동급 강세
//
// 격리 service 와 의도적으로 다름 (REBUILD32 §15 R-3 — 동기화 강제 금지).
const MODEL_MAP = {
  'qwen25-3b': {
    name: 'Qwen 2.5 3B',
    org:  'Alibaba',
    size: '~1.9GB',
    note: '범용 / 한국어 강 / 영어 번역 강 (default)',
    ollama: 'qwen2.5:3b',
  },
  'gemma2-2b': {
    name: 'Gemma 2 2B',
    org:  'Google',
    size: '~1.6GB',
    note: '경량 / 다국어 / Qwen fallback',
    ollama: 'gemma2:2b',
  },
  'qwen35-4b': {
    name: 'Qwen 3.5 4B',
    org:  'Alibaba',
    size: '~2.5GB',
    note: '고성능 / 한국어 강 / 영어 번역 강',
    ollama: 'qwen3.5:4b',
  },
};
const DEFAULT_MODEL_KEY = 'qwen25-3b';
const DEFAULT_ENGINE    = 'ollama';

function makeHttpError(statusCode, message, payload = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.payload = payload;
  return err;
}

// ─── Ollama 모델 자동 pull (cold start 시 첫 호출에 ~30~60초) ───
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

// ─── REBUILD33 §15.5 패턴 — 직전 모델 캐시 (동일 모델 연속 호출 시 /api/ps 절약) ───
// 단일 worker uvicorn 단일 스레드 환경 안전. 모델 변경 시에만 unload 트리거.
let _lastServedModel = null;

async function unloadOtherModels(keepModel) {
  try {
    const psResp = await fetch(`${OLLAMA_URL}/api/ps`).catch(() => null);
    if (!psResp || !psResp.ok) return;
    const { models = [] } = await psResp.json();
    for (const m of models) {
      const name = m.name || m.model;
      if (!name || name === keepModel) continue;
      try {
        await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: name, keep_alive: 0, prompt: '' }),
        });
        console.log(`[local-infer] unloaded previous model: ${name} (keep=${keepModel})`);
      } catch (e) {
        console.warn(`[local-infer] unload ${name} 실패 (무시): ${e?.message}`);
      }
    }
  } catch (e) {
    console.warn(`[local-infer] unload_other_models 조회 실패 (무시): ${e?.message}`);
  }
}

// ─── Ollama /api/chat 호출 — 한국어 강제 + thinking off ─────────────
async function callOllama({ ollamaModel, messages, maxTokens, temperature }) {
  await ensureOllamaModel(ollamaModel);

  // REBUILD33 §15.5 I-3 패턴 — 모델 변경 시에만 unload
  if (_lastServedModel && _lastServedModel !== ollamaModel) {
    await unloadOtherModels(ollamaModel);
  }

  // Qwen / DeepSeek 기반 모델: 한국어 강제 + /no_think (실험실 공통 정책)
  const finalMessages = applyQwenStrict(messages, ollamaModel);
  const isQwen = /^qwen/i.test(ollamaModel) || /deepseek/i.test(ollamaModel);

  const body = {
    model: ollamaModel,
    messages: finalMessages,
    stream: false,
    options: { num_predict: maxTokens, temperature },
    keep_alive: '10m',
  };
  if (isQwen) body.think = false;

  const t0 = Date.now();
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
  const inferMs = Date.now() - t0;
  _lastServedModel = ollamaModel;
  return { answer: data.message?.content || '', inferMs };
}

// ─── 동적 가용성 (REBUILD32 §X) ─────────────────────────────────
function _modelSizeGb(sizeStr) {
  if (!sizeStr) return 0;
  const s = String(sizeStr).toUpperCase().replace(/~/g, '').trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(GIB|MIB|GB|MB)\b/);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  const unit = m[2];
  if (unit === 'GIB') return val * 1.073741824;
  if (unit === 'MIB') return (val * 1.073741824) / 1024;
  if (unit === 'MB')  return val / 1024;
  return val;  // GB
}

async function _readResources() {
  const fs = require('fs').promises;
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileP = promisify(execFile);

  let container = {};
  try {
    const text = await fs.readFile('/proc/meminfo', 'utf-8');
    const mem = {};
    text.split('\n').forEach(line => {
      const m = line.match(/^(\w+):\s+(\d+)/);
      if (m) mem[m[1]] = parseInt(m[2], 10);
    });
    const total_kb = mem.MemTotal || 0;
    const avail_kb = mem.MemAvailable || 0;
    container = {
      total_mb: Math.round(total_kb / 1024),
      available_mb: Math.round(avail_kb / 1024),
    };
  } catch {}

  let gpu = {};
  try {
    const { stdout } = await execFileP('nvidia-smi',
      ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 2000 });
    const parts = stdout.trim().split('\n')[0].split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length >= 2 && Number.isFinite(parts[1])) {
      gpu = { used_mb: parts[0], total_mb: parts[1], free_mb: parts[1] - parts[0] };
    }
  } catch {}

  return { container, gpu };
}

function _checkModelAvailable(model, resources) {
  const sizeGb = _modelSizeGb(model.size);
  if (sizeGb <= 0) return [true, null];

  const requiredRamMb = (sizeGb + 2) * 1024;
  const availRamMb = resources.container?.available_mb || 0;
  if (availRamMb && availRamMb < requiredRamMb) {
    return [false, `RAM 부족 (필요 ~${(requiredRamMb / 1024).toFixed(1)}GB, 가용 ${(availRamMb / 1024).toFixed(1)}GB)`];
  }

  const requiredVramMb = sizeGb * 1024 * 1.3;
  if (resources.gpu?.total_mb) {
    const freeVramMb = resources.gpu.free_mb || 0;
    if (freeVramMb < requiredVramMb) {
      return [false, `VRAM 부족 (필요 ~${(requiredVramMb / 1024).toFixed(1)}GB, 가용 ${(freeVramMb / 1024).toFixed(1)}GB)`];
    }
  }

  return [true, null];
}

// ─── 메인 핸들러 ────────────────────────────────────────────────
module.exports = withAuth(async (req, res) => {
  // 카탈로그 조회 — REBUILD32 §X 동적 가용성
  if (req.method === 'GET' && req.query?.action === 'models') {
    const resources = await _readResources().catch(() => ({}));
    return res.json({
      default: DEFAULT_MODEL_KEY,
      default_model: DEFAULT_MODEL_KEY,
      default_engine: DEFAULT_ENGINE,
      engines: Object.entries(ENGINES).map(([key, m]) => ({ key, ...m })),
      models: Object.entries(MODEL_MAP).map(([key, m]) => {
        const [available, reason] = _checkModelAvailable(m, resources);
        return {
          key,
          ...m,
          available_engines: ['ollama'],
          available,
          unavailable_reason: reason,
        };
      }),
      _resources: {
        container_available_mb: resources.container?.available_mb,
        gpu_free_mb: resources.gpu?.free_mb,
      },
    });
  }

  // 모든 Ollama 모델 unload (warm 유지, 모든 인증 사용자 가능)
  // REBUILD33 §31 (2026-05-06) — admin 전용 cleanup 폐기. MemoryCard 의 [🗑️ 모두 언로드] 가 호출.
  // GPU VRAM + weights 회수, 컨테이너는 유지 → 다음 호출 빠른 재로드.
  if (req.method === 'POST' && req.query?.action === 'unload-all') {
    _lastServedModel = null;
    const unloaded = [];
    const errors = [];
    try {
      const psResp = await fetch(`${OLLAMA_URL}/api/ps`).catch(() => null);
      if (psResp?.ok) {
        const { models = [] } = await psResp.json();
        for (const m of models) {
          const name = m.name || m.model;
          if (!name) continue;
          try {
            await fetch(`${OLLAMA_URL}/api/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: name, keep_alive: 0, prompt: '' }),
            });
            unloaded.push(name);
          } catch (e) {
            errors.push(`${name}: ${e?.message}`);
          }
        }
      }
    } catch (e) {
      errors.push(`list_failed: ${e?.message}`);
    }
    return res.json({ ok: true, unloaded, errors });
  }

  // 컨테이너 자체 종료 → Cloud Run 다음 호출 시 새 인스턴스 spawn (메모리 100% 회수)
  // REBUILD33 §31 (2026-05-06) — 격리 service 의 ♻️ 인스턴스 재시작 패턴을 통합 service 에도 적용.
  // ⚠ 통합 service 는 본업 (DB / Gemini API / 메모 등) 도 같은 컨테이너 → 본업도 잠시 다운됨.
  if (req.method === 'POST' && req.query?.action === 'restart-container') {
    _lastServedModel = null;
    setTimeout(() => {
      console.log(`[local-infer] restart-container: SIGTERM to self (PID ${process.pid})`);
      process.kill(process.pid, 'SIGTERM');
    }, 600);
    return res.json({
      ok: true,
      message: '컨테이너 재시작 예약됨 (다음 호출은 cold start)',
      next_call_warning: '~30초~2분 (모델 lazy pull 포함) 소요 예상',
      impact_warning: '본업 (DB / 메모 / Gemini AI 해설 등) 도 컨테이너 재기동 동안 잠시 다운됩니다 (~5~10초)',
    });
  }

  // 메모리 상태 (UI MemoryCard 용) — REBUILD33: Ollama + RAM + GPU 만 (sub_server / daemons 제거)
  if (req.method === 'GET' && req.query?.action === 'memory') {
    const resources = await _readResources().catch(() => ({}));
    const result = {
      service: 'aitutor',
      engines: ['ollama'],
      ollama: { reachable: false, loaded: [] },
      container: resources.container || {},
      gpu: {},
    };

    // Ollama (port 11434) /api/ps
    try {
      const r = await fetch(`${OLLAMA_URL}/api/ps`).catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        result.ollama.reachable = true;
        result.ollama.loaded = (d.models || []).map(m => ({
          name: m.name,
          size_total: m.size,
          size_vram: m.size_vram,
          expires_at: m.expires_at,
        }));
      }
    } catch {}

    // GPU 상세 (util + temp 추가)
    try {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileP = promisify(execFile);
      const { stdout } = await execFileP('nvidia-smi',
        ['--query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu',
         '--format=csv,noheader,nounits'],
        { timeout: 3000 });
      const first = stdout.trim().split('\n')[0];
      const parts = first.split(',').map(s => parseInt(s.trim(), 10));
      if (parts.length >= 4 && Number.isFinite(parts[1]) && parts[1] > 0) {
        result.gpu = {
          used_mb: parts[0],
          total_mb: parts[1],
          util_percent: parts[2],
          temp_c: parts[3],
          percent: Math.round(parts[0] * 1000 / parts[1]) / 10,
        };
      } else {
        result.gpu = { error: 'parse failed' };
      }
    } catch (e) {
      result.gpu = { error: (e?.message || 'nvidia-smi failed').slice(0, 100) };
    }

    // container percent 계산
    if (result.container.total_mb && result.container.available_mb != null) {
      const used_mb = Math.max(0, result.container.total_mb - result.container.available_mb);
      result.container.used_mb = used_mb;
      result.container.percent = Math.round(used_mb * 1000 / result.container.total_mb) / 10;
    }

    return res.json(result);
  }

  // 인프라 헬스체크 — REBUILD33: Ollama 만 (Python sub-server 제거됨)
  if (req.method === 'GET' && req.query?.action === 'health') {
    let ollamaOk = false;
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);
      ollamaOk = r.ok;
    } catch {}
    return res.json({
      ok: ollamaOk,
      ollama: { reachable: ollamaOk, port: 11434 },
      hint: ollamaOk
        ? 'Ollama 정상.'
        : 'Ollama 가 응답하지 않습니다. 컨테이너 재시작이 필요할 수 있습니다.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 만 허용 (GET ?action=models 가능)' });
  }

  const {
    messages,
    model_key   = DEFAULT_MODEL_KEY,
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

  const t0 = Date.now();
  try {
    const { answer, inferMs } = await callOllama({
      ollamaModel: meta.ollama,
      messages,
      maxTokens,
      temperature,
    });
    const totalMs = Date.now() - t0;
    res.json({
      answer,
      meta: {
        model_key,
        model_name: meta.name,
        engine: 'ollama',
        infer_ms: inferMs,
        total_ms: totalMs,
        warm: true,
      },
    });
  } catch (err) {
    console.error('[local-infer] 에러:', err);
    const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    res.status(statusCode).json({
      error: err.message,
      message: err.message,
      detail: err?.payload,
      meta: { model_key, engine: 'ollama', total_ms: Date.now() - t0 },
    });
  }
});

module.exports.MODEL_MAP = MODEL_MAP;
module.exports.DEFAULT_MODEL_KEY = DEFAULT_MODEL_KEY;
module.exports.ENGINES = ENGINES;
