// 로컬 ONNX 추론 (WebGPU 전용, Transformers.js)
// 지원 모델: Gemma 4 (E2B/E4B) + Qwen 3.5 (0.8B/2B)

import * as tf from '@huggingface/transformers';
import { buildMessages } from './prompts';
import { applyQwenStrict } from '../../../lib/qwen';

const { AutoProcessor, AutoTokenizer, TextStreamer } = tf;
const Gemma4ForConditionalGeneration = tf.Gemma4ForConditionalGeneration;
// Qwen 3.5 클래스 — transformers.js v4 에서 export. 미존재 시 AutoModelForCausalLM 폴백.
const Qwen3_5Class = tf.Qwen3_5ForConditionalGeneration || tf.AutoModelForCausalLM;

// WebGPU power preference — 'high-performance' 로 외장/고성능 GPU 우선 사용
//   (노트북: 외장 GPU 활용 / 모바일: 통합 GPU 클럭 ↑)
//   transformers.js v4.2 가 노출한 유일한 webgpu 옵션 (한계 직접 조정은 불가)
if (tf.env?.backends?.onnx?.webgpu) {
  tf.env.backends.onnx.webgpu.powerPreference = 'high-performance';
}

// ─────────────────────────────────────────────────────────────────────────
// MODEL_REGISTRY — 새 모델 추가는 여기 한 줄로 끝
// ─────────────────────────────────────────────────────────────────────────
//   id          : Hugging Face model_id (ONNX 변환본)
//   ModelClass  : Transformers.js 클래스
//   family      : 'gemma4' | 'qwen3.5'
//   approxSizeGB: q4f16 단일 quantization 실측치 (blob.size 합산, IEC GiB)
//                  - Gemma 4 E2B/E4B: 콘솔 실측 (REBUILD17 §12.4)
//                  - Qwen 3.5: HF 모델 카드 추정 (Day 1 검증 필요)
export const MODEL_REGISTRY = {
  e2b: {
    id: 'onnx-community/gemma-4-E2B-it-ONNX',
    ModelClass: Gemma4ForConditionalGeneration,
    family: 'gemma4',
    label: 'Gemma 4 E2B',
    params: '2B',
    approxSizeGB: 3.2,
    note: 'Google · Apache 2.0 · 멀티모달 (text+image+audio)',
  },
  e4b: {
    id: 'onnx-community/gemma-4-E4B-it-ONNX',
    ModelClass: Gemma4ForConditionalGeneration,
    family: 'gemma4',
    label: 'Gemma 4 E4B',
    params: '4B',
    approxSizeGB: 4.9,
    note: 'Google · Apache 2.0 · 한국어 OK · 멀티모달',
  },
  'qwen35-08b': {
    id: 'onnx-community/Qwen3.5-0.8B-ONNX',
    ModelClass: Qwen3_5Class,
    family: 'qwen3.5',
    label: 'Qwen 3.5 0.8B',
    params: '0.8B',
    approxSizeGB: 0.6,
    note: 'Alibaba · Apache 2.0 · 텍스트 전용 · 2026-02 출시',
  },
  'qwen35-2b': {
    id: 'onnx-community/Qwen3.5-2B-ONNX',
    ModelClass: Qwen3_5Class,
    family: 'qwen3.5',
    label: 'Qwen 3.5 2B',
    params: '2B',
    approxSizeGB: 1.6,
    note: 'Alibaba · Apache 2.0 · 한국어 강세 · 2026-03 출시',
  },
  'qwen35-4b': {
    id: 'onnx-community/Qwen3.5-4B-ONNX-OPT',
    ModelClass: Qwen3_5Class,
    family: 'qwen3.5',
    label: 'Qwen 3.5 4B',
    params: '4B',
    approxSizeGB: 2.5,
    note: 'Alibaba · Apache 2.0 · 201개 언어 · 2026-02 출시 · 양자화 최적화판',
  },
};

// 호환성용 — 기존 import 들이 깨지지 않게 derive
export const MODEL_IDS = Object.fromEntries(
  Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, v.id])
);
export const MODEL_META = Object.fromEntries(
  Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, {
    label: v.label,
    params: v.params,
    approxSizeGB: v.approxSizeGB,
    family: v.family,
    note: v.note,
  }])
);
export const MODEL_URLS = Object.fromEntries(
  Object.entries(MODEL_REGISTRY).map(([k, v]) => [k, `https://huggingface.co/${v.id}`])
);
export const MODEL_KEYS = Object.keys(MODEL_REGISTRY);

let cached = null;
let lastUsedDevice = null;

export function getLastUsedDevice() { return lastUsedDevice; }
export function getActiveModelSize() { return cached?.size || null; }

/**
 * @param {string} size - MODEL_REGISTRY 의 키
 * @param {(state: object) => void} onProgress
 */
export async function loadPipe(size = 'e2b', onProgress = () => {}) {
  if (cached && cached.size === size) return cached;

  const meta = MODEL_REGISTRY[size];
  if (!meta) throw new Error(`알 수 없는 모델 키: ${size}`);
  const { id: model_id, ModelClass, family } = meta;

  onProgress({
    status: 'init',
    currentFile: 'processor 로드 중',
    currentPercent: 0, fileCount: 0,
    overallLoaded: 0, overallTotal: 0, overallPercent: 0,
  });

  // family 별로 processor 분기
  // - Gemma 4: AutoProcessor (멀티모달 — image/audio preprocessor 포함)
  // - Qwen 3.5: AutoTokenizer (텍스트 전용 — processor 없음)
  let processor;
  try {
    if (family === 'gemma4') {
      processor = await AutoProcessor.from_pretrained(model_id);
    } else {
      // Qwen — tokenizer 객체를 processor 인터페이스로 감싸 통일
      const tokenizer = await AutoTokenizer.from_pretrained(model_id);
      processor = {
        tokenizer,
        apply_chat_template: (msgs, opts) => tokenizer.apply_chat_template(msgs, opts),
      };
    }
  } catch (e) {
    throw new Error(`[processor 로드] ${e.message || e}`);
  }

  // 파일별 progress 누적 합산 → 단조 증가 진행률
  const makeProgressHandler = (deviceLabel) => {
    const fileMap = {};
    const completed = new Set();

    return (info) => {
      const key = info.file || info.name;

      if (info.status === 'initiate' || info.status === 'download') {
        if (key && !fileMap[key]) fileMap[key] = { loaded: 0, total: 0, done: false };
      } else if (info.status === 'progress' || info.status === 'progress_total') {
        if (key) {
          fileMap[key] = { loaded: info.loaded || 0, total: info.total || 0, done: false };
        }
      } else if (info.status === 'done') {
        if (key && fileMap[key]) {
          fileMap[key].loaded = fileMap[key].total || fileMap[key].loaded;
          fileMap[key].done = true;
          completed.add(key);
        }
      } else if (info.status === 'ready') {
        onProgress({
          status: 'initializing',
          currentFile: `${deviceLabel} 적재 마무리`,
          currentPercent: 100, fileCount: Object.keys(fileMap).length,
          overallLoaded: 0, overallTotal: 0, overallPercent: 100,
        });
        return;
      } else {
        return;
      }

      let sumLoaded = 0, sumTotal = 0;
      for (const k in fileMap) {
        sumLoaded += fileMap[k].loaded;
        sumTotal += fileMap[k].total;
      }
      const pct = sumTotal > 0 ? (sumLoaded / sumTotal) * 100 : 0;
      const totalFiles = Object.keys(fileMap).length;
      const doneFiles = completed.size;
      const shortFile = key ? key.split('/').pop() : '모델 다운로드 중';

      onProgress({
        status: 'downloading',
        currentFile: `${shortFile} (${doneFiles}/${totalFiles})`,
        currentPercent: pct,
        fileCount: totalFiles,
        overallLoaded: sumLoaded,
        overallTotal: sumTotal,
        overallPercent: pct,
      });
    };
  };

  let model;
  try {
    model = await ModelClass.from_pretrained(model_id, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: makeProgressHandler('WebGPU'),
    });
  } catch (eGpu) {
    const msg = eGpu?.message || String(eGpu);
    console.error(`[loadPipe ${size}] WebGPU 적재 실패 —`, msg);
    if (/memory|alloc|out of/i.test(msg)) {
      throw new Error(`[모델 메모리 부족] 디바이스 GPU/RAM 한계. 더 작은 모델로 시도해 보세요. 원본: ${msg}`);
    }
    if (/webgpu|adapter|not supported/i.test(msg)) {
      throw new Error(`[WebGPU 미지원] 데스크탑 Chrome/Edge 에서만 동작합니다. 원본: ${msg}`);
    }
    throw new Error(`[모델 로드 실패] ${msg}`);
  }

  cached = { processor, model, size, family };
  lastUsedDevice = 'webgpu';

  onProgress({
    status: 'ready',
    currentFile: '',
    currentPercent: 100, fileCount: 1,
    overallLoaded: 0, overallTotal: 0, overallPercent: 100,
  });

  return cached;
}

/**
 * @param {{processor, model, family}} pipe
 * @param {object} question - { body, choices, answer, answer_extra }
 * @param {object} opts - { onToken, maxTokens, temperature, topK }
 */
export async function explainQuestion(pipe, question, opts = {}) {
  const { processor, model, family } = pipe;
  const {
    onToken,
    maxTokens = 512,
    temperature = 0.3,
    topK = 20,
  } = opts;

  const baseMessages = buildMessages(question);
  // REBUILD29 §13 / §16 — Qwen 한국어 강제 + thinking 비활성 (family 'qwen3.5' / 'qwen2.5' 모두 매칭)
  const messages = applyQwenStrict(baseMessages, family);
  // tokenize: false 명시 — Qwen tokenizer.apply_chat_template 은 기본값이 tokenize=true 라서
  //                       토큰 array 가 반환되면 다음 단계에서 빈 input_ids ("Array must not be empty") 발생
  let prompt = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
    tokenize: false,
  });

  // 안전망 — 어떤 이유로든 array/Tensor 반환된 경우 string 으로 복원
  if (Array.isArray(prompt) || (prompt && typeof prompt !== 'string')) {
    try {
      prompt = processor.tokenizer.decode(prompt, { skip_special_tokens: false });
    } catch {
      throw new Error('[apply_chat_template] string 으로 변환 실패');
    }
  }

  // tokenizer 직접 호출 — Gemma 4 의 multimodal processor "i.rgb" 에러 우회
  // Qwen 3.5 는 텍스트 전용이라 어차피 tokenizer 만 있음
  const inputs = processor.tokenizer(prompt, {
    add_special_tokens: false,
    return_tensors: 'pt',
  });

  let fullText = '';
  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => {
      fullText += text;
      if (onToken) onToken(text);
    },
  });

  await model.generate({
    ...inputs,
    max_new_tokens: maxTokens,
    do_sample: temperature > 0,
    temperature,
    top_k: topK,
    streamer,
  });

  return fullText.trim();
}

export function disposePipe() {
  if (cached?.model?.dispose) {
    try { cached.model.dispose(); } catch { /* 무시 */ }
  }
  cached = null;
}

export {
  clearAllCache,
  deleteModelCache,
  getModelCacheStatus,
  getModelCacheFiles,
  getStorageEstimate,
} from './modelCache';
