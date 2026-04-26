// Transformers.js + onnx-community Gemma 4 ONNX 모델 추론 (WebGPU 전용)
//
// 정책 — 데스크탑 Chrome/Edge (WebGPU) 만 지원. 모바일/WASM 관련 로직 일체 제거.
//
// 흐름:
//   1) AutoProcessor.from_pretrained(model_id) — 토크나이저/processor 로드
//   2) Gemma4ForConditionalGeneration.from_pretrained(model_id, {
//        dtype: 'q4f16', device: 'webgpu', progress_callback,
//      })
//   3) processor.apply_chat_template + processor.tokenizer 직접 호출
//   4) model.generate({ ...inputs, streamer }) — TextStreamer 로 토큰 스트리밍

import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
} from '@huggingface/transformers';
import { buildMessages } from './prompts';

export const MODEL_IDS = {
  e2b: 'onnx-community/gemma-4-E2B-it-ONNX',
  e4b: 'onnx-community/gemma-4-E4B-it-ONNX',
};

/** UI 표시용 메타 — 사이즈는 q4f16 기준 대략적 */
export const MODEL_META = {
  e2b: { label: 'Gemma 4 E2B', params: '2B', approxSizeGB: 1.5 },
  e4b: { label: 'Gemma 4 E4B', params: '4B', approxSizeGB: 2.7 },
};

// MODEL_URLS는 ModelManagerPanel/캐시 조회 호환을 위해 유지 (model_id 기반)
export const MODEL_URLS = {
  e2b: `https://huggingface.co/${MODEL_IDS.e2b}`,
  e4b: `https://huggingface.co/${MODEL_IDS.e4b}`,
};

let cached = null;     // { processor, model, size }
let lastUsedDevice = null;

/** UI 표시용 — 마지막 적재에 사용된 device */
export function getLastUsedDevice() { return lastUsedDevice; }

/** 현재 메모리에 적재된 모델 size 반환 (없으면 null) */
export function getActiveModelSize() {
  return cached?.size || null;
}

/**
 * 모델 로드 — Transformers.js 가 자체 Cache API 캐싱 + 진행률 callback 제공
 * @param {'e2b'|'e4b'} size
 * @param {(state: object) => void} onProgress
 */
export async function loadPipe(size = 'e2b', onProgress = () => {}) {
  if (cached && cached.size === size) return cached;

  const model_id = MODEL_IDS[size] || MODEL_IDS.e2b;

  // ─── STAGE 1: Processor (토크나이저) 로드 ───
  onProgress({
    status: 'init',
    currentFile: 'processor 로드 중',
    currentPercent: 0, fileCount: 0,
    overallLoaded: 0, overallTotal: 0, overallPercent: 0,
  });

  let processor;
  try {
    processor = await AutoProcessor.from_pretrained(model_id);
  } catch (e) {
    throw new Error(`[processor 로드] ${e.message || e}`);
  }

  // ─── STAGE 2: 모델 로드 (다운로드 + GPU 적재) ───
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

  // WebGPU + q4f16 단일 시도 (폴백 없음)
  let model;
  try {
    model = await Gemma4ForConditionalGeneration.from_pretrained(model_id, {
      dtype: 'q4f16',
      device: 'webgpu',
      progress_callback: makeProgressHandler('WebGPU'),
    });
  } catch (eGpu) {
    const msg = eGpu?.message || String(eGpu);
    console.error('[loadPipe] WebGPU 적재 실패 —', msg);
    if (/memory|alloc|out of/i.test(msg)) {
      throw new Error(`[모델 메모리 부족] 디바이스 GPU/RAM 한계. E4B → E2B 로 시도해 보세요. 원본: ${msg}`);
    }
    if (/webgpu|adapter|not supported/i.test(msg)) {
      throw new Error(`[WebGPU 미지원] 데스크탑 Chrome/Edge 에서만 동작합니다. 원본: ${msg}`);
    }
    throw new Error(`[모델 로드 실패] ${msg}`);
  }

  cached = { processor, model, size };
  lastUsedDevice = 'webgpu';

  console.log(`[loadPipe] 모델 적재 완료 — device: webgpu, size: ${size}`);

  onProgress({
    status: 'ready',
    currentFile: '',
    currentPercent: 100, fileCount: 1,
    overallLoaded: 0, overallTotal: 0, overallPercent: 100,
  });

  return cached;
}

/**
 * 한 문항 해설 생성 — 스트리밍
 * @param {{processor, model}} pipe
 * @param {object} question - { body, choices, answer, answer_extra }
 * @param {object} opts - { onToken, maxTokens, temperature, topK }
 */
export async function explainQuestion(pipe, question, opts = {}) {
  const { processor, model } = pipe;
  const {
    onToken,
    maxTokens = 512,
    temperature = 0.3,
    topK = 20,
  } = opts;

  // 1) chat template 자동 적용 — Gemma 4 의 chat token 을 라이브러리가 처리
  const messages = buildMessages(question);
  const prompt = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  });

  // 2) tokenizer 직접 호출 — multimodal preprocessing 우회
  //    (processor(prompt, ...) 사용 시 "i.rgb is not a function" 에러 발생)
  const inputs = processor.tokenizer(prompt, {
    add_special_tokens: false,
    return_tensors: 'pt',
  });

  // 3) 스트리밍 — TextStreamer 가 토큰 → 문자열 변환
  let fullText = '';
  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => {
      fullText += text;
      if (onToken) onToken(text);
    },
  });

  // 4) 생성 — temperature > 0 이면 sampling, 0 이면 greedy
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

/** 메모리/GPU 자원 해제 */
export function disposePipe() {
  if (cached?.model?.dispose) {
    try { cached.model.dispose(); } catch { /* 무시 */ }
  }
  cached = null;
}

// modelCache 호환 (UI 패널에서 import 함)
export {
  clearAllCache,
  deleteModelCache,
  getModelCacheStatus,
  getModelCacheFiles,
  getStorageEstimate,
} from './modelCache';
