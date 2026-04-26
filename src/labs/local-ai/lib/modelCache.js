// Transformers.js Cache API 조회/관리
//
// 사이즈 측정 정책: 항상 blob.size 사용 (실측 디스크 사이즈)
// — Content-Length 헤더는 압축/proxy 등으로 부정확할 수 있어 신뢰하지 않음

const TRANSFORMERS_CACHE_NAME = 'transformers-cache';

/** Cache Response 의 실측 사이즈 (blob.size 기준) */
async function measureResponseSize(resp) {
  try {
    const blob = await resp.blob();
    return blob.size;
  } catch {
    return 0;
  }
}

/**
 * @param {string} url - MODEL_URLS[size] (https://huggingface.co/{model_id})
 * @returns {Promise<{cached: boolean, size: number, fileCount: number}>}
 */
export async function getModelCacheStatus(url) {
  if (typeof caches === 'undefined') {
    return { cached: false, size: 0, fileCount: 0 };
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
          totalBytes += await measureResponseSize(resp);
          fileCount += 1;
        }
      }
    }
  } catch {
    return { cached: false, size: 0, fileCount: 0 };
  }

  return { cached: fileCount > 0, size: totalBytes, fileCount };
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
          const size = await measureResponseSize(resp);
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
