// Transformers.js Cache API 조회/관리

const TRANSFORMERS_CACHE_NAME = 'transformers-cache';

/**
 * @param {string} url - MODEL_URLS[size] (https://huggingface.co/{model_id})
 * @returns {Promise<{cached: boolean, size: number, partial: boolean, partialBytes: number}>}
 */
export async function getModelCacheStatus(url) {
  if (typeof caches === 'undefined') {
    return { cached: false, size: 0, partial: false, partialBytes: 0 };
  }

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
    partial: false,
    partialBytes: 0,
  };
}

/**
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

  files.sort((a, b) => b.size - a.size);
  return files;
}

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

export async function clearAllCache() {
  if (typeof caches !== 'undefined') {
    try { await caches.delete(TRANSFORMERS_CACHE_NAME); } catch { /* 무시 */ }
  }
}

/**
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
