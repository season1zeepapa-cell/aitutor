// 디바이스 능력 감지 — WebGPU 지원 브라우저(데스크탑 Chrome/Edge) 만 허용

/** @returns {{supported: boolean, reason?: string, recommendedSize?: string}} */
export async function checkDeviceAi() {
  // 1) WebGPU API 존재 여부
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return {
      supported: false,
      reason: 'WebGPU 미지원 환경 — 데스크탑 Chrome 또는 Edge 에서만 동작합니다.',
    };
  }

  // 2) WebGPU adapter 실제 동작 확인
  let adapter = null;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (err) {
    return { supported: false, reason: `WebGPU 어댑터 요청 실패: ${err.message}` };
  }
  if (!adapter) {
    return { supported: false, reason: 'WebGPU 어댑터 없음' };
  }

  // 3) 디바이스 메모리 (Chrome/Edge 만 제공)
  const memory = navigator.deviceMemory;

  // 4) 권장 모델 — RAM 8GB 이상이면 Gemma 4 E4B, 미만이면 Qwen 3.5 2B
  //    (Qwen 3.5 2B 가 사이즈 1/3 + 한국어 강세 → 저사양 대안)
  const recommendedSize = (typeof memory === 'number' && memory < 8)
    ? 'qwen35-2b'
    : 'e4b';

  const memoryWarning = (typeof memory === 'number' && memory < 8)
    ? `⚠️ 디바이스 메모리 ${memory}GB — Gemma 4 E4B 는 메모리 한계로 실패 가능. Qwen 3.5 2B (~1.6GB) 권장.`
    : null;

  return { supported: true, recommendedSize, memoryWarning, deviceMemory: memory ?? null };
}

/** UI 표시용 진단 정보 */
export async function getDeviceInfo() {
  const result = await checkDeviceAi();
  return {
    ...result,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    deviceMemory: typeof navigator !== 'undefined' ? (navigator.deviceMemory ?? null) : null,
    hardwareConcurrency: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? null) : null,
    platform: typeof navigator !== 'undefined' ? (navigator.platform || '') : '',
  };
}

/**
 * 메모리 현황 종합 — 휴대폰/데스크탑 모두 표시 가능한 정보 수집
 *
 * 반환:
 *   ram      : { total: GB | null, source: 'navigator.deviceMemory' | null }
 *              ⚠️ Chrome/Edge 만 제공 (Safari/Firefox 는 null)
 *   jsHeap   : { used, total, limit } MB | null
 *              ⚠️ Chromium 계열만 (performance.memory non-standard)
 *   gpu      : { adapter: 'requested' | 'unavailable',
 *                maxBufferSize, maxStorageBufferBindingSize } MB | null
 *   storage  : { usage, quota } bytes | null  (디스크 캐시 사용량)
 */
export async function getMemoryInfo() {
  const out = {
    ram: { total: null, source: null },
    jsHeap: null,
    gpu: { adapter: 'unavailable' },
    storage: null,
  };

  // 1) RAM (디바이스 전체 메모리)
  if (typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number') {
    out.ram = { total: navigator.deviceMemory, source: 'navigator.deviceMemory' };
  }

  // 2) JS Heap (Chromium 전용 — performance.memory)
  //    표준은 아니지만 Chrome/Edge 에서는 동작
  if (typeof performance !== 'undefined' && performance.memory) {
    const m = performance.memory;
    out.jsHeap = {
      used: Math.round(m.usedJSHeapSize / 1024 / 1024),
      total: Math.round(m.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(m.jsHeapSizeLimit / 1024 / 1024),
    };
  }

  // 3) WebGPU adapter limits — 어댑터 한계만 측정
  //    (device 생성하면 transformers.js 의 device 와 경합 + "Device failed at creation"
  //     콘솔 경고. 사양상 device limits 는 어댑터 limits 이하 + requiredLimits 명시 시 그 값
  //     이라 어댑터 limits 와 사양 디폴트 상수로 충분히 비교 가능)
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        const adapterLimits = adapter.limits || {};
        const toMB = (b) => b ? Math.round(b / 1024 / 1024) : null;

        out.gpu = {
          adapter: 'requested',
          // (a) 어댑터 절대 최대 — 하드웨어 천장 (= requiredLimits 명시 시 받을 수 있는 최대치)
          maxBufferSize: toMB(adapterLimits.maxBufferSize),
          maxStorageBufferBindingSize: toMB(adapterLimits.maxStorageBufferBindingSize),
          maxComputeWorkgroupStorageSize: adapterLimits.maxComputeWorkgroupStorageSize ?? null,

          // (b) WebGPU 사양 디폴트 — requiredLimits 미지정 시 받는 보수적 한계 (상수)
          //     출처: WebGPU spec §3.6.2 "Limits"
          webgpuSpecDefault: {
            maxBufferSize: 256,                   // 256 MB
            maxStorageBufferBindingSize: 128,     // 128 MB
          },
        };

        // GPU 어댑터 정보 (브라우저 별 노출 다름)
        try {
          const adapterInfo = await adapter.requestAdapterInfo?.();
          if (adapterInfo) {
            out.gpu.vendor = adapterInfo.vendor || null;
            out.gpu.architecture = adapterInfo.architecture || null;
            out.gpu.device = adapterInfo.device || null;
          }
        } catch { /* 무시 */ }
      }
    } catch { /* 어댑터 요청 실패는 supported=false 로 이미 표시됨 */ }
  }

  // 4) 디스크 캐시 (StorageManager)
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      out.storage = { usage: usage || 0, quota: quota || 0 };
    } catch { /* 무시 */ }
  }

  return out;
}
