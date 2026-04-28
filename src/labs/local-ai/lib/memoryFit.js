// 메모리 적합성 판정 — MemoryStatus / ModelManagerPanel / ModelDownloadCard 공유

/**
 * 모델이 현재 디바이스에서 적재 가능한지 판정
 *
 * 휴리스틱:
 *   필요 메모리 = approxSizeGB × 1.5  (KV 캐시 + 작업 버퍼 마진)
 *   1) GPU 버퍼 한계 (있으면 우선) — WebGPU 데스크탑/Safari
 *   2) RAM (있으면) — Chromium 계열만
 *
 * @param {{ram, gpu}} mem - getMemoryInfo() 결과
 * @param {{approxSizeGB}} model - MODEL_REGISTRY 항목
 * @returns {{ok: true|false|'warn', reason: string|null, requiredGB: number}}
 */
export function fitVerdict(mem, model) {
  const requiredGB = model.approxSizeGB * 1.5;

  // 1) GPU 버퍼 한계 (있으면 우선)
  if (mem?.gpu?.maxBufferSize) {
    const gpuGB = mem.gpu.maxBufferSize / 1024;
    if (gpuGB < requiredGB) {
      return {
        ok: false,
        reason: `GPU 버퍼 한계 ${gpuGB.toFixed(1)}GB < 필요 ${requiredGB.toFixed(1)}GB`,
        requiredGB,
      };
    }
  }

  // 2) RAM (있으면)
  if (mem?.ram?.total != null) {
    if (mem.ram.total < requiredGB) {
      return {
        ok: false,
        reason: `RAM ${mem.ram.total}GB < 필요 ${requiredGB.toFixed(1)}GB`,
        requiredGB,
      };
    }
    if (mem.ram.total < requiredGB + 2) {
      return {
        ok: 'warn',
        reason: `RAM ${mem.ram.total}GB — 여유 부족 가능`,
        requiredGB,
      };
    }
  }

  // 정보가 둘 다 없으면 판정 불가 (Safari/Firefox 데스크탑은 GPU 정보로 통과)
  if (!mem?.gpu?.maxBufferSize && mem?.ram?.total == null) {
    return { ok: 'warn', reason: '메모리 정보 미제공 (Safari/Firefox)', requiredGB };
  }

  return { ok: true, reason: null, requiredGB };
}

/** UI 표시 헬퍼 */
export function fitBadge(verdict) {
  if (!verdict) return { icon: '⏳', color: 'gray', label: '측정 중' };
  if (verdict.ok === true) return { icon: '✅', color: 'green', label: '가능' };
  if (verdict.ok === 'warn') return { icon: '⚠️', color: 'amber', label: '주의' };
  return { icon: '❌', color: 'red', label: '부족' };
}
