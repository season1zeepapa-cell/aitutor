// 모델 캐시 조회/관리 — Transformers.js Cache API 활용
//
// 2026-04-26 단순화 — Transformers.js v3+ 가 자체적으로 Cache API
// ('transformers-cache') 에 모델 파일을 저장한다.
// 우리는 그 캐시를 조회/삭제하는 기능만 노출.
//
// 이전 IndexedDB 청크 시스템은 MediaPipe 사용 시절 잔재 — 모두 제거.

const TRANSFORMERS_CACHE_NAME = 'transformers-cache';
const LEGACY_DB_NAME = 'gemma4-localai';                  // 이전 청크 IndexedDB
const LEGACY_FULL_CACHE_NAME = 'gemma4-models-v1';        // 이전 통합본 Cache

// ─── 모델별 캐시 상태 조회 ───
// Transformers.js 는 model_id 의 각 파일을 개별 URL 로 캐싱:
//   https://huggingface.co/{model_id}/resolve/main/onnx/decoder_model_merged_q4.onnx
//   https://huggingface.co/{model_id}/resolve/main/tokenizer.json  ... 등
// 캐시 키들에서 model_id 가 들어가는 항목만 합산.

/**
 * 모델별 캐시 상태
 * @param {string} url - 우리 MODEL_URLS[size] (예: https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX)
 * @returns {Promise<{cached: boolean, size: number, partial: boolean, partialBytes: number}>}
 */
export async function getModelCacheStatus(url) {
  if (typeof caches === 'undefined') {
    return { cached: false, size: 0, partial: false, partialBytes: 0 };
  }

  // url 에서 model_id 추출 — 예: "https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX"
  // → matchPrefix = "https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/"
  const matchPrefix = url.endsWith('/') ? url : `${url}/`;

  let totalBytes = 0;
  let fileCount = 0;

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      if (req.url.startsWith(matchPrefix)) {
        const resp = await cache.match(req);
        if (resp) {
          // Content-Length 헤더가 있으면 바로 사용, 없으면 blob 사이즈
          const cl = parseInt(resp.headers.get('Content-Length') || '0', 10);
          if (cl > 0) {
            totalBytes += cl;
          } else {
            const blob = await resp.blob();
            totalBytes += blob.size;
          }
          fileCount += 1;
        }
      }
    }
  } catch {
    return { cached: false, size: 0, partial: false, partialBytes: 0 };
  }

  return {
    cached: fileCount > 0,
    size: totalBytes,
    partial: false,           // Transformers.js 는 파일 단위라 부분 다운로드 개념 없음
    partialBytes: 0,
  };
}

/**
 * 캐시된 파일 상세 목록 — UI "파일 상세 보기" 토글용
 * @returns {Promise<Array<{url, name, size, contentType}>>}
 */
export async function getModelCacheFiles(url) {
  if (typeof caches === 'undefined') return [];
  const matchPrefix = url.endsWith('/') ? url : `${url}/`;
  const files = [];

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      if (req.url.startsWith(matchPrefix)) {
        const resp = await cache.match(req);
        if (resp) {
          const cl = parseInt(resp.headers.get('Content-Length') || '0', 10);
          let size = cl;
          if (size <= 0) {
            try {
              const blob = await resp.blob();
              size = blob.size;
            } catch { size = 0; }
          }
          // 짧은 이름 추출 (model_id 이후 경로)
          const shortName = req.url.replace(matchPrefix, '').replace(/^resolve\/[^/]+\//, '');
          files.push({
            url: req.url,
            name: shortName || req.url.split('/').pop(),
            size,
            contentType: resp.headers.get('Content-Type') || '',
          });
        }
      }
    }
  } catch { /* 무시 */ }

  // 사이즈 큰 순 정렬
  files.sort((a, b) => b.size - a.size);
  return files;
}

/**
 * 특정 모델 캐시 삭제 — Transformers.js Cache 안의 해당 model_id 항목 모두 제거
 */
export async function deleteModelCache(url) {
  if (typeof caches === 'undefined') return;
  const matchPrefix = url.endsWith('/') ? url : `${url}/`;
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const keys = await cache.keys();
    for (const req of keys) {
      if (req.url.startsWith(matchPrefix)) {
        await cache.delete(req);
      }
    }
  } catch (e) {
    console.warn('[modelCache] Cache 삭제 실패', e?.message);
  }
}

/**
 * 모든 캐시 비우기 — Transformers.js + 이전 MediaPipe 잔재 모두
 */
export async function clearAllCache() {
  if (typeof caches !== 'undefined') {
    try { await caches.delete(TRANSFORMERS_CACHE_NAME); } catch { /* 무시 */ }
    try { await caches.delete(LEGACY_FULL_CACHE_NAME); } catch { /* 무시 */ }
  }
  if (typeof indexedDB !== 'undefined') {
    try { await indexedDB.deleteDatabase(LEGACY_DB_NAME); } catch { /* 무시 */ }
  }
}

/**
 * 디스크 사용량 추정 — Storage API
 * @returns {Promise<{usage:number, quota:number}|null>}
 */
export async function getStorageEstimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage || 0, quota: quota || 0 };
  } catch {
    return null;
  }
}
