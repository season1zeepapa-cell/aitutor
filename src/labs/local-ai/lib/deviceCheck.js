// 디바이스 능력 감지 — WebGPU + 모바일 + 메모리
//
// 1차(REBUILD17 §8) 결정: 모바일에서만 활성화. 데스크톱은 후속 라운드.
// 미지원 환경은 명확히 안내 — 외부 API 폴백은 본 격리 모듈에서는 미제공
//   (기존 AiExplanation 의 외부 API 흐름을 그대로 사용하면 됨).

/** @returns {{supported: boolean, reason?: string, recommendedSize?: 'e2b'|'e4b'}} */
export async function checkDeviceAi() {
  // 1) WebGPU API 존재 여부
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, reason: 'WebGPU 미지원 브라우저' };
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

  // 3) 디바이스 메모리 (Chrome/Edge 만 제공, Safari/Firefox 는 undefined)
  const memory = navigator.deviceMemory;       // GB 단위 (정확하지 않음)

  // 4) 모델 사이즈 — E4B 단일 정책 (한국어 추론 품질 우선)
  //    데스크탑/모바일 분기 없음 — 동일 로직, 동일 모델
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
