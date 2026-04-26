// 디바이스 능력 감지 — WebGPU 전용 (데스크탑 Chrome/Edge)
//
// 정책:
//   ✅ WebGPU 지원 브라우저 (데스크탑 Chrome/Edge) 만 허용
//   ❌ WebGPU 미지원 (Safari/Firefox/모바일 등) 차단

/** @returns {{supported: boolean, reason?: string, recommendedSize?: 'e2b'|'e4b'}} */
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

  // 4) 모델 사이즈 — E4B 단일 정책 (한국어 추론 품질 우선)
  const recommendedSize = 'e4b';
  const memoryWarning = (typeof memory === 'number' && memory < 8)
    ? `⚠️ 디바이스 메모리 ${memory}GB — E4B 모델(약 5.5GB)이 메모리 한계로 실패할 수 있습니다.`
    : null;

  return { supported: true, recommendedSize, memoryWarning, deviceMemory: memory ?? null };
}

/** 진단 정보 한 번에 — UI 표시용 */
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
