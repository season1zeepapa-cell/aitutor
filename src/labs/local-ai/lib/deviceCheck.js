// 디바이스 능력 감지 — 데스크탑(WebGPU) 전용, 모바일 차단
//
// 정책 (2026-04-26 B3):
//   ✅ 데스크탑 (Chrome/Edge + WebGPU) 만 허용
//   ❌ 모바일 (iOS/Android) 진입 자체 차단 — 모바일 GPU 한계로 try/catch fallback 시
//      q4f16 + q4 두 세트 누적되어 9GB 다운로드 + 페이지 크래시 발생하는 알려진 이슈 회피
//   ❌ WebGPU 미지원 브라우저 (Safari, Firefox 등) 차단

/** @returns {{supported: boolean, reason?: string, recommendedSize?: 'e2b'|'e4b', isMobile?: boolean}} */
export async function checkDeviceAi() {
  // 0) 모바일 차단 — UA 기반 (가장 먼저 체크)
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    if (isMobile) {
      return {
        supported: false,
        reason: '📱 모바일 디바이스는 미지원 — 모바일 GPU 메모리 한계로 모델 적재 실패 + 다운로드 누적 이슈가 있어 차단되어 있습니다. 데스크탑(Chrome/Edge)에서 사용해 주세요.',
        isMobile: true,
      };
    }
  }

  // 1) WebGPU API 존재 여부
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, reason: 'WebGPU 미지원 브라우저 — Chrome 또는 Edge 데스크탑에서 동작합니다.' };
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
    userAgent: navigator.userAgent,
    deviceMemory: navigator.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    platform: navigator.platform || '',
  };
}
