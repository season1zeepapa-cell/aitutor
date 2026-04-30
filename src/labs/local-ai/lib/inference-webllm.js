// WebLLM 엔진 (REBUILD28 §11 — 데스크톱 큰 모델용, Qwen 7B / DeepSeek R1 / Llama 8B)
//
// transformers.js 와 별도 엔진. 같은 lab 안에서 엔진 토글로 전환.
// 모델 다운로드 + 추론 모두 WebLLM 자체 IndexedDB 캐시 사용 (transformers.js 와 분리).
//
// 사용 패턴:
//   const pipe = await loadWebllmPipe('qwen25-7b', onProgress);
//   const txt  = await explainWebllm(pipe, messages, { maxTokens, onToken });
//   await disposeWebllmPipe(pipe);

import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';

// ─────────────────────────────────────────────────────────────────────────
// WEBLLM_REGISTRY — 데스크톱 권장 7B+ 큰 모델 (REBUILD28 §11)
// ─────────────────────────────────────────────────────────────────────────
//   model_id     : WebLLM prebuiltAppConfig 의 식별자 (정확히 일치해야 함)
//   approxSizeGB : 다운로드 크기 (q4f16 권장)
//   vramGB       : 추론 시 GPU VRAM 점유 (대략, q4f16 기준)
//   family       : 한국어 분류 — qwen2.5 / deepseek-r1 / llama3.1
//
// 카탈로그 출처: github.com/mlc-ai/web-llm/blob/main/src/config.ts
export const WEBLLM_REGISTRY = {
  'qwen25-7b': {
    model_id:     'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    label:        'Qwen 2.5 7B',
    params:       '7B',
    approxSizeGB: 5.1,
    vramGB:       5.1,
    family:       'qwen2.5',
    engine:       'webllm',
    note:         'Alibaba · Apache 2.0 · 한국어 강세 · 자격증 해설 추천 ⭐',
    contextWindow: 4096,
  },
  'deepseek-r1-qwen-7b': {
    model_id:     'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
    label:        'DeepSeek R1 (Qwen 7B)',
    params:       '7B',
    approxSizeGB: 5.1,
    vramGB:       5.1,
    family:       'deepseek-r1',
    engine:       'webllm',
    note:         'Qwen 베이스 · reasoning 특화 · 단계별 설명 강세',
    contextWindow: 4096,
  },
  'llama31-8b': {
    model_id:     'Llama-3.1-8B-Instruct-q4f16_1-MLC',
    label:        'Llama 3.1 8B',
    params:       '8B',
    approxSizeGB: 5.0,
    vramGB:       5.0,
    family:       'llama3.1',
    engine:       'webllm',
    note:         'Meta · 영어 베스트 (한국어 보통)',
    contextWindow: 4096,
  },
};

export const WEBLLM_KEYS = Object.keys(WEBLLM_REGISTRY);

export const WEBLLM_META = Object.fromEntries(
  Object.entries(WEBLLM_REGISTRY).map(([k, v]) => [k, {
    label: v.label,
    params: v.params,
    approxSizeGB: v.approxSizeGB,
    family: v.family,
    note: v.note,
    engine: 'webllm',
  }])
);

// 사전 등록 검증 — 빌드 직후 console 에서 누락 확인 가능
export function validateModelIds() {
  const knownIds = new Set(prebuiltAppConfig.model_list.map(m => m.model_id));
  return WEBLLM_KEYS.map(k => ({
    key: k,
    model_id: WEBLLM_REGISTRY[k].model_id,
    available: knownIds.has(WEBLLM_REGISTRY[k].model_id),
  }));
}

/**
 * WebLLM 엔진 로드 + 모델 다운로드 (재사용 캐시).
 * @param {string} key — WEBLLM_REGISTRY 키 (qwen25-7b 등)
 * @param {(p: {progress, text, timeElapsed}) => void} onProgress
 * @returns {Promise<{engine, key, model_id, family}>}
 */
export async function loadWebllmPipe(key, onProgress) {
  const meta = WEBLLM_REGISTRY[key];
  if (!meta) throw new Error(`unknown WebLLM model: ${key}`);

  const engine = await CreateMLCEngine(
    meta.model_id,
    {
      initProgressCallback: (report) => {
        // report = { progress: 0~1, text: '...', timeElapsed: seconds }
        onProgress?.(report);
      },
    },
  );

  return {
    engine,
    key,
    model_id: meta.model_id,
    family: meta.family,
  };
}

/**
 * 추론 호출 (스트리밍).
 * @param {object} pipe — loadWebllmPipe() 결과
 * @param {Array<{role, content}>} messages
 * @param {object} opts — { maxTokens, temperature, onToken }
 * @returns {Promise<string>} 최종 텍스트
 */
export async function explainWebllm(pipe, messages, opts = {}) {
  const { maxTokens = 512, temperature = 0.3, onToken } = opts;

  const stream = await pipe.engine.chat.completions.create({
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  });

  let result = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) {
      result += delta;
      onToken?.(delta);
    }
  }
  return result;
}

/** 명시적 unload — GPU 메모리 해제 */
export async function disposeWebllmPipe(pipe) {
  try { await pipe?.engine?.unload?.(); } catch {}
}

/**
 * 디바이스 적합성 판정 — WebGPU + 메모리 요구치 대비 검증.
 * @param {object} mem — getMemoryInfo() 결과 (deviceCheck.js)
 * @param {object} meta — WEBLLM_REGISTRY entry
 * @returns {{ok: true|false|null, reason: string}}
 */
export function webllmFitVerdict(mem, meta) {
  if (!mem) return { ok: null, reason: '메모리 정보 측정 중' };

  // WebGPU adapter 없으면 즉시 false
  if (mem.gpu?.adapter !== 'requested') {
    return { ok: false, reason: 'WebGPU 어댑터 없음 — 데스크톱 Chrome / Edge 필요' };
  }

  // GPU VRAM 추정 — adapter limits 의 maxBufferSize 가 GPU 사양 천장 (MB)
  const maxBufMB = mem.gpu?.maxBufferSize || 0;
  const requiredMB = (meta.vramGB || meta.approxSizeGB) * 1024;

  if (maxBufMB && maxBufMB < requiredMB * 0.7) {
    return {
      ok: false,
      reason: `GPU buffer 한계 ${maxBufMB}MB < 모델 필요치 ~${Math.round(requiredMB)}MB`,
    };
  }

  // RAM (system) 도 체크 — 모델 다운 + 적재 시 디스크/RAM 동시 사용
  const ramGB = mem.ram?.total;
  if (typeof ramGB === 'number') {
    if (ramGB < 8) {
      return {
        ok: false,
        reason: `시스템 RAM ${ramGB}GB < 8GB — 7B+ 모델은 RAM 부족 가능`,
      };
    }
    if (ramGB < 16 && (meta.vramGB || 0) >= 5) {
      return {
        ok: 'warn',
        reason: `RAM ${ramGB}GB — 빠듯할 수 있음 (16GB+ 권장)`,
      };
    }
  }

  return { ok: true, reason: '실행 가능' };
}
